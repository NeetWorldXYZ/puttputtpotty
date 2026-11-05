import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {expect,it} from 'vitest';
import {defenseText,captureTarget} from '../src/game/throneDefense';
const base=Date.parse('2026-10-31T06:00:00Z'), start=new Date(base).toISOString(), hour=3600000;
it('runs the preview SQL against the same score/time examples shown to players, including exact cutovers across DST',async()=>{
 const db=new PGlite();
 try{
 for(const [file,fn] of [['20261105030045_iphone_launch_preview','defense_allowance'],['20261105032724_launch_delivery_and_refunds','wins_defense']]){
 const ddl=readFileSync('supabase/migrations/'+file+'.sql','utf8').split('create function public.'+fn+'(')[1].split('$$;')[0];await db.exec('create function public.'+fn+'('+ddl+'$$;');}
 for(const [hours,score,ms,win] of [[0,7,60000,true],[0,8,44999,true],[0,8,45000,false],[0,8,45001,false],[48-1/hour,8,60000,false],[48,8,60000,true],[48,9,1000,false],[72-1/hour,9,1000,false],[72,9,90000,true],[72,10,1000,false],[96,10,90000,true],[120,11,90000,true],[700,12,1000,false]] as const){
 const asof=new Date(base+hours*hour).toISOString();
 const {rows:[row]}=await db.query<{win:boolean;bonus:number}>('select public.wins_defense($1,$2,8,45000,$3,$4) win, public.defense_allowance($3,$4) bonus',[score,ms,start,asof]);
 expect(row.win,JSON.stringify([hours,score,ms])).toBe(win);expect(captureTarget(8,start,Date.parse(asof))).toBe(8+row.bonus);}
 expect(defenseText(8,start,45000,base)).toContain('under 0:45');expect(defenseText(8,start,45000,base+48*hour)).toContain('A tie takes');expect(defenseText(8,start,45000,base+72*hour)).toContain('shoot 9');
 }finally{await db.close();}
},30000);
