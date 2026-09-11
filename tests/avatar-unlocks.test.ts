import { expect, test } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import migration from '../supabase/migrations/20260911060146_avatar_head_unlocks.sql?raw';

test('earned heads use verified history, remain permanent, and move with an account', async () => {
  const db=new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table profiles(id uuid primary key,display_name text,is_bot boolean default false,points int default 0);
      create table runs(id uuid primary key default gen_random_uuid(),user_id uuid,location_id text,course_seed text,score int,hole_scores int[],created_at timestamptz default now());
      create table matches(id uuid primary key default gen_random_uuid(),status text,code text,winner uuid,p1 uuid,p2 uuid,p1_score int,p2_score int,p1_holes int[],p2_holes int[]);
      create table current_thrones(user_id uuid);
      create view thrones as select user_id,1 season from current_thrones;
      create function current_season() returns int language sql stable as 'select 1';
      create function throne_points(in_user uuid) returns int language sql stable as 'select points from profiles where id=in_user';
      create function move_account(old_id uuid,new_id uuid) returns text language plpgsql as $$
      declare n text; begin select display_name into n from profiles where id=old_id; delete from profiles where id=old_id; return n; end
      $$;
    `);
    await db.exec(migration);
    const oldId='00000000-0000-4000-8000-000000000001';
    const newId='00000000-0000-4000-8000-000000000002';
    await db.query('insert into profiles(id,display_name,points) values($1,\'King\',500),($2,\'New\',0)',[oldId,newId]);
    for(let i=0;i<10;i++) await db.query("insert into matches(status,code,winner,p1,p1_score,p1_holes) values('done',null,$1,$1,4,array[2,2,2])",[oldId]);
    for(let i=0;i<5;i++) await db.query("insert into runs(user_id,location_id,score,hole_scores) values($1,$2,6,array[2,2,2])",[oldId,'place-'+i]);
    const first=(await db.query<{result:{unlocked:string[];stats:{rankedWins:number;places:number}}}>('select refresh_avatar_heads($1) result',[oldId])).rows[0].result;
    expect(first.stats).toMatchObject({rankedWins:10,places:5});
    expect(first.unlocked).toEqual(expect.arrayContaining(['bubble','robot','swamp']));
    await db.query('insert into current_thrones(user_id) select $1 from generate_series(1,5)',[oldId]);
    await db.query("insert into runs(user_id,location_id,score,hole_scores) values($1,'royal',5,array[2,2,1])",[oldId]);
    await db.query('delete from current_thrones where user_id=$1',[oldId]);
    const afterLoss=(await db.query<{result:{unlocked:string[]}}>('select refresh_avatar_heads($1) result',[oldId])).rows[0].result;
    expect(afterLoss.unlocked).toContain('lion');
    await db.query('select move_account_with_heads($1,$2)',[oldId,newId]);
    const moved=await db.query<{head_id:string}>('select head_id from avatar_head_unlocks where user_id=$1',[newId]);
    expect(moved.rows.map(row=>row.head_id)).toEqual(expect.arrayContaining(['bubble','robot','swamp','lion']));
  } finally {
    await db.close();
  }
},30000);
