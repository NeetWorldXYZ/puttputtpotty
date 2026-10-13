import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import migration from '../supabase/migrations/20261013215009_ongoing_throne_competition.sql?raw';

it('combines past seasons without losing rounds and keeps old writers in ongoing competition', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create function current_season() returns integer language sql as $$ select 2; $$;
      create table runs(id int primary key, location_id text, user_id text, score int, elapsed_ms int, season int default current_season());
      insert into runs values (1,'a','old-owner',8,60000,1),(2,'a','challenger',9,40000,2),(3,'b','new-owner',7,50000,2);
      create view thrones as select distinct on(location_id,season) * from runs order by location_id,season,score,elapsed_ms;`);
    await db.exec(migration);
    expect((await db.query('select id from thrones where season=current_season() order by id')).rows).toEqual([{id:1},{id:3}]);
    expect((await db.query('select count(*)::int as n from runs')).rows).toEqual([{n:3}]);
    await db.exec("insert into runs values(4,'a','winner',7,60000,99); update runs set season=100 where id=4;");
    expect((await db.query('select id from thrones where season=current_season() order by id')).rows).toEqual([{id:3},{id:4}]);
    expect((await db.query('select distinct season from runs')).rows).toEqual([{season:1}]);
  } finally { await db.close(); }
},20000);
