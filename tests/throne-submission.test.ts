import { describe, expect, it } from 'vitest';
import migration from '../supabase/migrations/20260922021750_throne_round_submission.sql?raw';
import { PGlite } from '@electric-sql/pglite';
import { validThroneFinish } from '../server/potty/throneRules';

it('accepts small indoor drift from a valid check-in, but rejects remote or uncertain fixes', () => {
  expect(validThroneFinish(10, 5, 32, 5)).toBe(true);
  expect(validThroneFinish(10, 5, 76, 5)).toBe(false);
  expect(validThroneFinish(32, 5, 0, 5)).toBe(false);
  expect(validThroneFinish(10, 5, 32, 151)).toBe(false);
  expect(validThroneFinish(10, 5, NaN, 5)).toBe(false);
});

describe('atomic throne round saving', () => {
  it('records losses, allows an immediate winning attempt, retries once, and preserves failed rounds', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        create role anon; create role authenticated; create role service_role;
        create table public.checkins(user_id uuid,location_id text,started_at timestamptz,primary key(user_id,location_id));
        create table public.runs(id uuid default gen_random_uuid(), user_id uuid,location_id text,hole_index int,
          strokes jsonb,hole_scores int[],elapsed_ms int,score int check(score>0),par int,season int,
          lat double precision,lng double precision,accuracy double precision,created_at timestamptz default now());
      `);
      await db.exec(migration);
      const user = '00000000-0000-0000-0000-000000000001';
      const run = {user_id:user,location_id:'test',strokes:[[],[],[]],hole_scores:[3,3,3],elapsed_ms:45000,score:9,par:9,season:1,lat:0,lng:0,accuracy:5};
      const first = new Date(Date.now()-60000).toISOString();
      await db.query('insert into checkins values ($1,$2,$3)',[user,'test',first]);
      const save = (body:typeof run, clock:string) => db.query<{r:{id:string;score:number}}>('select to_jsonb(public.save_throne_round($1::jsonb,$2::timestamptz)) r',[JSON.stringify(body),clock]);
      const a = await save(run,first);
      const retry = await save(run,first);
      expect(retry.rows[0].r.id).toBe(a.rows[0].r.id);
      expect((await db.query('select * from runs')).rows).toHaveLength(1);
      expect((await db.query<{started_at:null}>('select started_at from checkins')).rows[0].started_at).toBeNull();
      const next = new Date(Date.now()-1000).toISOString();
      await db.query('update checkins set started_at=$1',[next]);
      await expect(save({...run,score:-1},next)).rejects.toThrow();
      expect((await db.query('select * from checkins where started_at is not null')).rows).toHaveLength(1);
      const b = await save({...run,score:7,hole_scores:[3,2,2]},next);
      expect(b.rows[0].r.score).toBe(7);
      expect((await db.query('select * from runs')).rows).toHaveLength(2);
      await expect(save(run,new Date().toISOString())).rejects.toThrow('Round is no longer active');
      const permissions = await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','public.save_throne_round(jsonb,timestamptz)','execute') allowed");
      expect(permissions.rows[0].allowed).toBe(false);
    } finally { await db.close(); }
  }, 20000);
});
