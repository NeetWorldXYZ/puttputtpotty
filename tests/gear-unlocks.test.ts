import { expect,test } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import headsMigration from '../supabase/migrations/20260911060146_avatar_head_unlocks.sql?raw';
import gearMigration from '../supabase/migrations/20260911110527_avatar_gear_unlocks.sql?raw';
import { EARNABLE_BALLS,EARNABLE_SHIRTS,STARTER_BALLS,STARTER_SHIRTS,gearUnlocked } from '../server/potty/cosmeticCatalog';
import { lockedAvatarPart,normalizeAvatarChoice } from '../server/potty/avatarUnlocks';
import { DEFAULT_AVATAR,avatarPartSvg,avatarSvg,randomAvatar,resultAvatarSvg,starterAvatar } from '../src/game/avatarParts';
import { ballMaterialPaths,ballMaterialSvg,paintBallMaterial } from '../src/game/ballMaterials';
import type { HeadProgress } from '../src/game/earnedHeads';

test('all gear has distinct art, survives saved profiles, and stays out of starter randomization',()=>{
  expect(Object.keys(EARNABLE_BALLS)).toHaveLength(13);expect(Object.keys(EARNABLE_SHIRTS)).toHaveLength(13);
  const base=JSON.stringify(DEFAULT_AVATAR);
  for(const [slot,catalog] of [['ball',EARNABLE_BALLS],['seat',EARNABLE_SHIRTS]] as const){
    for(const key of Object.keys(catalog)){
      const av={...DEFAULT_AVATAR,[slot]:key};
      const part=avatarPartSvg(av,slot,'card-'+key);
      expect(part.markup).not.toMatch(/NaN|undefined/);
      expect(part.markup).toContain(slot==='ball'?`data-ball-material="${key}"`:`data-shirt-material="${key}"`);
      expect(avatarSvg(av,key)).toContain(slot==='ball'?`data-ball-material="${key}"`:`data-shirt-material="${key}"`);
      if(slot==='seat')for(const mood of ['win','loss','draw'] as const)expect(resultAvatarSvg(av,mood,key)).toContain(`data-shirt-material="${key}"`);
      expect(gearUnlocked(slot,key,null)).toBe(false);
      expect(lockedAvatarPart(av,{unlocked:[],shirts:[],balls:[]})).toBe(slot==='ball'?'ball':'shirt');
      const awards={unlocked:[],shirts:slot==='seat'?[key]:[],balls:slot==='ball'?[key]:[]};
      expect(lockedAvatarPart(av,awards)).toBe(null);
      expect(gearUnlocked(slot,key,awards)).toBe(true);
    }
  }
  for(let i=0;i<100;i++)for(const av of [starterAvatar(()=>i/100),randomAvatar(()=>i/100)]){
    expect(STARTER_SHIRTS).toContain(av.seat);expect(STARTER_BALLS).toContain(av.ball);
  }
  expect(JSON.stringify(DEFAULT_AVATAR)).toBe(base);
  expect(normalizeAvatarChoice({ball:'__proto__',seat:'not-real'},()=>({...DEFAULT_AVATAR}))).toEqual(DEFAULT_AVATAR);
});

test('course balls and portrait balls use exactly the same path art',()=>{
  const original=globalThis.Path2D;
  class TestPath {constructor(public d:string){}}
  globalThis.Path2D=TestPath as unknown as typeof Path2D;
  try{
    for(const key of Object.keys(EARNABLE_BALLS) as (keyof typeof EARNABLE_BALLS)[]){
      const painted:string[]=[];
      const ctx={save(){},restore(){},translate(){},scale(){},fill(path:TestPath){painted.push(path.d);},stroke(path:TestPath){painted.push(path.d);}} as unknown as CanvasRenderingContext2D;
      paintBallMaterial(ctx,key,0,0,1);
      const svg=ballMaterialSvg(key);
      for(const {d} of ballMaterialPaths(key)){expect(painted).toContain(d);expect(svg).toContain(`d="${d}"`);}
    }
  }finally{globalThis.Path2D=original;}
});

test('gear awards use verified achievements, match UI milestones, survive losses/account moves, and deny direct grants',async()=>{
  const db=new PGlite();
  const oldId='00000000-0000-4000-8000-000000000001',newId='00000000-0000-4000-8000-000000000002';
  try{
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table profiles(id uuid primary key,display_name text,is_bot boolean default false,points int default 0,avatar jsonb);
      create table runs(id uuid primary key default gen_random_uuid(),user_id uuid,location_id text,course_seed text,score int,hole_scores int[],created_at timestamptz default now());
      create table matches(id uuid primary key default gen_random_uuid(),status text,code text,winner uuid,p1 uuid,p2 uuid,p1_score int,p2_score int,p1_holes int[],p2_holes int[]);
      create table current_thrones(user_id uuid);
      create view thrones as select user_id,1 season from current_thrones;
      create function current_season() returns int language sql stable as 'select 1';
      create function throne_points(in_user uuid) returns int language sql stable as 'select points from profiles where id=in_user';
      create function move_account(old_id uuid,new_id uuid) returns text language plpgsql as $$
        declare n text; begin select display_name into n from profiles where id=old_id; delete from profiles where id=old_id; return n; end $$;
    `);
    await db.exec(headsMigration);await db.exec(gearMigration);
    await db.query("insert into profiles(id,display_name,points,avatar) values($1,'King',249,$3),($2,'New',0,$3)",[oldId,newId,DEFAULT_AVATAR]);
    const refresh=async(id=oldId)=>(await db.query<{result:HeadProgress}>('select refresh_avatar_collection($1) result',[id])).rows[0].result;
    expect((await refresh()).balls).toEqual([]);
    await db.query('update profiles set points=250 where id=$1',[oldId]);
    expect((await refresh()).balls).toEqual(['pearl']);
    await db.query('update profiles set points=350 where id=$1',[oldId]);
    expect((await refresh()).shirts).toEqual(['varsity']);
    // Friend wins, unfinished ranked games, and partial daily courses earn no corresponding milestone.
    await db.query("insert into matches(status,code,winner,p1) select 'done','friend',$1,$1 from generate_series(1,60)",[oldId]);
    await db.query("insert into matches(status,code,winner,p1) select 'playing',null,$1,$1 from generate_series(1,60)",[oldId]);
    await db.query("insert into runs(user_id,course_seed,score) select $1,'2026-09-01',2 from generate_series(1,8)",[oldId]);
    expect((await refresh()).stats).toMatchObject({rankedWins:0,dailyDays:0});
    await db.query("insert into matches(status,winner,p1,p1_score,p1_holes) select 'done',$1,$1,18,array[2,2,2,2,2,2,2,2,2] from generate_series(1,60)",[oldId]);
    await db.query("insert into runs(user_id,location_id,score,hole_scores) select $1,'place-'||i,3,array[1,1,1] from generate_series(1,20) i",[oldId]);
    await db.query("insert into runs(user_id,course_seed,score) select $1,'2026-08-'||lpad(day::text,2,'0'),2 from generate_series(1,20) day cross join generate_series(1,9) hole",[oldId]);
    await db.query('update profiles set points=5000 where id=$1',[oldId]);
    const all=await refresh();
    expect(all.balls?.sort()).toEqual(Object.keys(EARNABLE_BALLS).sort());
    expect(all.shirts?.sort()).toEqual(Object.keys(EARNABLE_SHIRTS).sort());
    expect(all.stats).toMatchObject({rankedWins:60,dailyDays:20,aces:60,places:20,points:5000});
    const rows=await db.query<{slot:string;item_id:string;metric:string;target:number}>('select slot,item_id,metric,target from avatar_gear_catalog');
    expect(rows.rows).toHaveLength(26);
    for(const row of rows.rows){
      const catalog=row.slot==='ball'?EARNABLE_BALLS:EARNABLE_SHIRTS;
      expect(catalog[row.item_id as keyof typeof catalog]).toMatchObject({metric:row.metric,target:row.target});
    }
    // Totals may drop across a season; awards never disappear and TP is never deducted.
    expect((await db.query<{points:number}>('select points from profiles where id=$1',[oldId])).rows[0].points).toBe(5000);
    await db.query('update profiles set points=0 where id=$1',[oldId]);
    expect((await refresh()).balls).toHaveLength(13);
    const equipped={...DEFAULT_AVATAR,ball:'prism',seat:'monarch'};
    await db.query('update profiles set avatar=$2 where id=$1',[oldId,equipped]);
    await db.query('select move_account_with_heads($1,$2)',[oldId,newId]);
    expect((await refresh(newId)).shirts).toHaveLength(13);
    expect((await refresh(newId)).balls).toHaveLength(13);
    expect((await db.query<{avatar:unknown}>('select avatar from profiles where id=$1',[newId])).rows[0].avatar).toEqual(equipped);
    await db.exec('grant select,update on profiles to authenticated; set role authenticated;');
    await expect(db.query("update profiles set avatar=jsonb_set(avatar,'{ball}','\"meteor\"') where id=$1",[newId])).rejects.toThrow('verify earned balls');
    await expect(db.query('select refresh_avatar_collection($1)',[newId])).rejects.toThrow(/permission denied/);
    await expect(db.query("insert into avatar_gear_unlocks(user_id,slot,item_id) values($1,'ball','meteor')",[newId])).rejects.toThrow(/permission denied/);
    await db.query("update profiles set display_name='King Two' where id=$1",[newId]);
    await db.query("update profiles set avatar=jsonb_set(avatar,'{ball}','\"white\"') where id=$1",[newId]);
  }finally{await db.close();}
},30000);
