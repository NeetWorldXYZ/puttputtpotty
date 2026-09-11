import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { it } from 'vitest';
it('enforces ranked counts and one daily attempt in Postgres', async () => {
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create table matches(p1 uuid,p2 uuid,winner uuid,status text,code text);
create table runs(user_id uuid,location_id text,course_seed text,hole_index int,created_at timestamptz default now());`);
await db.exec(readFileSync('supabase/migrations/20260911231411_profile_daily_consistency.sql','utf8'));
const user='00000000-0000-0000-0000-000000000001';
const other='00000000-0000-0000-0000-000000000002';
await db.query(`insert into matches values ($1,$2,$1,'done',null),($1,$2,$2,'done',null),($1,$2,$1,'done','FRIEND')`,[user,other]);
const r=(await db.query('select * from ranked_profile_record($1)',[user])).rows[0];
if(Number(r.wins)!==1 || Number(r.matches)!==2) throw Error('ranked aggregate incorrect');
const day=(await db.query("select to_char(now() at time zone 'America/New_York','YYYY-MM-DD') as day_key")).rows[0].day_key;
async function add(seed,index){await db.query('insert into runs(user_id,course_seed,hole_index) values ($1,$2,$3)',[user,seed,index]);}
await add(day+'-pm',0);await add(day+'-pm',1);
for(const [seed,index] of [[day+'-pm',0],[day+'-am',2],[day+'-pm',9]]) {
 let blocked=false;try{await add(seed,index);}catch{blocked=true;}if(!blocked)throw Error('duplicate or second round accepted');
}
console.log('Database regression checks passed: ranked-only totals, duplicate hole, second edition, invalid index.');
await db.close();

}, 20000);
