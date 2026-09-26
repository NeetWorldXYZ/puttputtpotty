import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import migration from '../supabase/migrations/20260926221231_unlockable_carts.sql?raw';
import {CARTS,cartSvg} from '../src/game/carts';
it('grants earned carts permanently, rejects locked equips and isolates player garages',async()=>{
 const db=new PGlite();const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(id uuid primary key,stats jsonb);
 create function refresh_avatar_collection(in_user uuid) returns jsonb language sql as $$select jsonb_build_object('stats',stats) from public.profiles where id=in_user$$;`);
 await db.exec(migration);
 await db.query('insert into profiles values($1,$3),($2,$3)',[a,b,JSON.stringify({points:0,places:0,aces:0,dailyDays:0,rankedWins:0})]);
 const garage=async(user:string,equip:string|null=null)=>(await db.query<{g:{unlocked:string[];selected:string}}>('select cart_garage($1,$2) g',[user,equip])).rows[0].g;
 expect((await garage(a)).unlocked).toEqual(['starter']);
 await expect(garage(a,'gold')).rejects.toThrow('still locked');
 for(const c of CARTS.slice(1)){
  await db.query('update profiles set stats=$2 where id=$1',[a,JSON.stringify({[c.metric]:c.target})]);
  expect((await garage(a,c.id)).selected).toBe(c.id);
 }
 await db.query("update profiles set stats='{}' where id=$1",[a]);
 expect((await garage(a)).unlocked).toHaveLength(7);
 expect((await garage(b)).unlocked).toEqual(['starter']);
 await db.exec('set role authenticated');
 await expect(garage(a)).rejects.toThrow(/permission denied/);
 await expect(db.query('update player_carts set selected=\'gold\'')).rejects.toThrow(/permission denied/);
 }finally{await db.close()}
},20000);
it('provides unique cart art with a safe fallback',()=>{
 expect(new Set(CARTS.map(c=>cartSvg(c.id))).size).toBe(7);
 expect(cartSvg('<script>')).toBe(cartSvg('starter'));
});
