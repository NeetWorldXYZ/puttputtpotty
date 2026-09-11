import {test,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import migration from '../supabase/migrations/20260911090000_gameplay_tp.sql?raw';

test('verified gameplay awards are idempotent, scoped, and preserve challenge balances',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key);
 grant usage on schema auth to authenticated;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table profiles(id uuid primary key); create table challenge_claims(user_id uuid,points int);
 create table runs(id uuid primary key default gen_random_uuid(),user_id uuid,location_id text,season text,score int,par int,hole_scores int[],elapsed_ms int,created_at timestamptz default now(),course_seed text,hole_index int);
 create view thrones as select distinct on(location_id,season) location_id,season,user_id from runs where location_id is not null and hole_scores is not null order by location_id,season,score,coalesce(elapsed_ms,2147483647),created_at;
 create table matches(id uuid primary key default gen_random_uuid(),status text,p1 uuid,p2 uuid,p1_score int,p2_score int,p1_holes int[],p2_holes int[],holes int,p2_bot boolean default false,winner uuid);
 create function player_profile(uuid) returns jsonb language sql as $$select jsonb_build_object('name','Test','points',100)$$;
 create function move_account(uuid,uuid) returns text language sql as $$select 'Test'::text$$;
 insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
 insert into profiles select id from auth.users;
 insert into challenge_claims select id,100 from auth.users;
 `);
 await db.exec(migration);
 const u='00000000-0000-4000-8000-000000000001',v='00000000-0000-4000-8000-000000000002';
 const total=async(user=u)=>Number((await db.query<{n:string}>('select coalesce(sum(points),0)::text n from gameplay_tp where user_id=$1',[user])).rows[0].n);
 await db.query("insert into matches(id,status,p1,p2,p1_score,p2_score,p1_holes,p2_holes,holes,winner) values($1,'playing',$2,$3,5,6,array[1,2,2],array[2,2,2],3,$2)",[u,u,v]);
 expect(await total()).toBe(0);
 await db.query("update matches set status='done' where id=$1",[u]);
 expect(await total()).toBe(50);expect(await total(v)).toBe(20);
 await db.query("update matches set status='done' where id=$1",[u]);
 expect(await total()).toBe(50);
 // Quitter without a verified round receives no reward; the completed winner does.
 await db.query("insert into matches(id,status,p1,p2,p1_score,p1_holes,holes,winner) values($1,'playing',$2,$3,6,array[2,2,2],3,$2)",[v,u,v]);
 await db.query("update matches set status='done' where id=$1",[v]);
 expect(await total()).toBe(90);expect(await total(v)).toBe(20);
 for(let i=0;i<8;i++)await db.query("insert into runs(user_id,course_seed,hole_index,score,par) values($1,'2026-09-11-am',$2,1,3)",[u,i]);
 expect(await total()).toBe(90);
 await db.query("insert into runs(user_id,course_seed,hole_index,score,par) values($1,'2026-09-11-am',8,3,3)",[u]);
 expect(await total()).toBe(200); // 30 completion + 80 aces.
 await db.query("insert into runs(user_id,course_seed,hole_index,score,par) values($1,'2026-09-11-am',8,3,3)",[u]);
 expect(await total()).toBe(200);
 await db.query("insert into runs(user_id,location_id,season,score,hole_scores,elapsed_ms) values($1,'place','season',5,array[1,2,2],10000)",[u]);
 expect(await total()).toBe(280); // 20 round + 10 ace + 50 first capture.
 await db.query("insert into runs(user_id,location_id,season,score,hole_scores,elapsed_ms) values($1,'place','season',4,array[1,1,2],9000)",[u]);
 expect(await total()).toBe(280); // Same-day repeat and self-defence do not farm points.
 await db.query("insert into runs(user_id,location_id,season,score,hole_scores,elapsed_ms) values($1,'place','season',3,array[1,1,1],8000)",[v]);
 expect(await total(v)).toBe(120);
 await db.query("select set_config('test.uid',$1,false)",[u]);
 const earned=await db.query<{r:{points:number}}>("select gameplay_reward($1) r",['match:'+u]);
 expect(earned.rows[0].r.points).toBe(50);
 const profile=await db.query<{p:{points:number;name:string}}>('select player_profile($1) p',[u]);
 expect(profile.rows[0].p).toEqual({points:380,name:'Test'});
 await db.exec('set role authenticated');
 expect((await db.query('select * from gameplay_tp where user_id<>auth.uid()')).rows).toHaveLength(0);
 await expect(db.query("select record_gameplay_tp($1,'fake','fake','fake',999)",[u])).rejects.toThrow();
 await expect(db.query("insert into gameplay_tp values($1,'fake','fake','fake',999,now())",[u])).rejects.toThrow();
 } finally {await db.close();}
},30000);
