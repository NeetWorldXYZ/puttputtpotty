import {test,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import migration from '../supabase/migrations/20260912002659_activity_streak_challenges.sql?raw';

test('activity streak recovers play days, handles gaps and yesterday, and cannot be forged',async()=>{
 const db=new PGlite();
 const me='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create schema auth;
   create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated;
   create table profiles(id uuid primary key,last_seen_at timestamptz,avatar jsonb,is_bot boolean default false);
   create table runs(user_id uuid,created_at timestamptz);
   create table challenge_claims(user_id uuid,claimed_at timestamptz);
  `);
  await db.query('insert into profiles(id) values($1),($2)',[me,other]);
  await db.query("insert into runs select $1,(((now() at time zone 'America/New_York')::date-i)+time '12:00') at time zone 'America/New_York' from generate_series(0,6) i",[me]);
  await db.exec(migration);
  const streak=async()=>Number((await db.query<{n:number}>('select challenge_streak($1) n',[me])).rows[0].n);
  expect(await streak()).toBe(7);
  await db.query("delete from player_activity_days where user_id=$1 and activity_date=(now() at time zone 'America/New_York')::date-3",[me]);
  expect(await streak()).toBe(3);
  await db.query("delete from player_activity_days where user_id=$1 and activity_date=(now() at time zone 'America/New_York')::date",[me]);
  expect(await streak()).toBe(2);
  await db.query("delete from player_activity_days where user_id=$1 and activity_date>=(now() at time zone 'America/New_York')::date-2",[me]);
  expect(await streak()).toBe(0);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[me]);
  await db.exec('set role authenticated;select heartbeat();select heartbeat();');
  expect(await streak()).toBe(1);
  await expect(db.query('insert into player_activity_days values($1,current_date)',[other])).rejects.toThrow(/permission denied/);
  await expect(db.query('select * from player_activity_days')).rejects.toThrow(/permission denied/);
  await db.exec('reset role;');
  const others=await db.query<{n:number}>('select count(*)::int n from player_activity_days where user_id=$1',[other]);
  expect(others.rows[0].n).toBe(0);
 }finally{await db.close();}
},20000);
