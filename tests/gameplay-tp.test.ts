import {test,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import migration from '../supabase/migrations/20260911090000_gameplay_tp.sql?raw';

test('production TP rates, exact round earnings, missing match aces, and caller isolation',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`
 create role anon; create role authenticated;
 create schema auth;
 grant usage on schema auth to authenticated;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table challenge_claims(user_id uuid,points int);
 create table runs(id uuid primary key default gen_random_uuid(),user_id uuid,location_id text,score int,hole_scores int[],course_seed text,hole_index int);
 create table matches(id uuid primary key default gen_random_uuid(),status text,p1 uuid,p2 uuid,p1_score int,p2_score int,p1_holes int[],p2_holes int[],winner uuid);
 `);
 await db.exec(migration);
 const u='00000000-0000-4000-8000-000000000001',v='00000000-0000-4000-8000-000000000002',w='00000000-0000-4000-8000-000000000003';
 const total=async()=>Number((await db.query<{n:number}>('select throne_points($1) n',[u])).rows[0].n);
 const earned=async(c:string)=>(await db.query<{r:{available:boolean;points:number}}>('select gameplay_reward($1) r',[c])).rows[0].r;
 await db.query("select set_config('test.uid',$1,false)",[u]);
 await db.query('insert into challenge_claims values($1,100)',[u]);
 await db.query("insert into matches values($1,'playing',$2,$3,5,6,array[1,2,2],array[2,2,2],null)",[u,u,v]);
 expect((await earned('match:'+u)).available).toBe(false);
 expect(await total()).toBe(100);
 await db.query("update matches set status='done',winner=$1 where id=$1",[u]);
 expect((await earned('match:'+u)).points).toBe(55);
 expect(await total()).toBe(155);
 await earned('match:'+u);await earned('match:'+u);
 expect(await total()).toBe(155);
 // A completed loss earns 10; a quitter with no completed score earns nothing.
 await db.query("select set_config('test.uid',$1,false)",[v]);
 expect((await earned('match:'+u)).points).toBe(10);
 await db.query("update matches set p2_score=null,p2_holes=null where id=$1",[u]);
 expect((await earned('match:'+u)).points).toBe(0);
 await db.query("select set_config('test.uid',$1,false)",[w]);
 expect((await earned('match:'+u)).available).toBe(false);
 await db.query("select set_config('test.uid',$1,false)",[u]);
 // Daily aces already earn TP immediately in the production balance;
 // the complete result card shows the entire course's 15 + ace rewards.
 for(let i=0;i<8;i++)await db.query("insert into runs(user_id,course_seed,hole_index,score) values($1,'2026-09-11-am',$2,1)",[u,i]);
 expect((await earned('daily:2026-09-11-am')).available).toBe(false);
 await db.query("insert into runs(user_id,course_seed,hole_index,score) values($1,'2026-09-11-am',8,3)",[u]);
 expect((await earned('daily:2026-09-11-am')).points).toBe(135);
 expect(await total()).toBe(290);
 await db.query("insert into runs(id,user_id,location_id,score,hole_scores) values($1,$1,'place',5,array[1,2,2])",[u]);
 expect((await earned('run:'+u)).points).toBe(40);
 expect(await total()).toBe(330);
 await db.exec('set role authenticated');
 expect((await earned('match:'+u)).points).toBe(55);
 await db.query("select set_config('test.uid',$1,false)",[w]);
 expect((await earned('run:'+u)).available).toBe(false);
 await db.exec('reset role; set role anon');
 await expect(earned('match:'+u)).rejects.toThrow();
 } finally {await db.close();}
},30000);
