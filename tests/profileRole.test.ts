import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import migration from '../supabase/migrations/20260926233135_protect_profile_admin_role.sql?raw';
it('blocks client role grants without breaking profile edits or server administration', async () => {
 const db = new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table profiles(id int primary key, display_name text, role text not null default 'player');
    grant all on profiles to anon, authenticated, service_role;
    insert into profiles values (1,'Player','player'), (2,'KingKory','admin');`);
  await db.exec(migration);
  for (const role of ['anon','authenticated']) {
   await db.exec(`set role ${role}`);
   await expect(db.exec("update profiles set role='admin' where id=1")).rejects.toThrow('Account roles');
   await expect(db.exec("insert into profiles values(3,'Intruder','admin')")).rejects.toThrow('Account roles');
   await expect(db.exec("update profiles set role='player' where id=2")).rejects.toThrow('Account roles');
   await db.exec("update profiles set display_name='Updated' where id=1; update profiles set role='player' where id=1;");
   await db.exec('reset role');
  }
  await db.exec("set role authenticated; insert into profiles(id,display_name) values(3,'New player'); reset role;");
  await db.exec("set role service_role; update profiles set role='admin' where id=3; reset role;");
  expect((await db.query('select id,role from profiles order by id')).rows).toEqual([{id:1,role:'player'},{id:2,role:'admin'},{id:3,role:'admin'}]);
 } finally { await db.close(); }
},20000);
