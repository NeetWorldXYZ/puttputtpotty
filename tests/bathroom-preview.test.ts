import {describe,it,expect} from 'vitest';
import {freshState,finishRound,stats,streak,visit,type Round} from '../src/preview/store';
import {dailyKey,pickCourse,dressHole} from '../src/preview/course';
import poolJson from '../src/preview/coursePool.json';
import solutions from '../src/preview/courseSolutions.json';
import {replay,validateHole,type Hole} from '../src/sim';
import {wallLoops,pointInRegion,distToWalls} from '../src/render/region';
import {placeSpectators} from '../src/render/spectators';
const pool=poolJson as Hole[];
const round=():Round=>({id:'one',title:'Daily Flush',mode:'daily',date:'2026-09-13',started:1000,holes:pool.slice(0,3),scores:pool.slice(0,3).map(h=>({id:h.id,name:h.name,theme:h.theme!,par:h.par,score:h.par,strokes:h.par,sunk:true}))});
describe('isolated bathroom preview progress',()=>{
 it('records a finished daily once, preserves a recap, and never records an unfinished round',()=>{
  const initial=freshState(),r=round();expect(finishRound(initial,{...r,scores:r.scores.slice(0,2)})).toBe(initial);
  const finished=finishRound(initial,r,6000);expect(finished.results).toHaveLength(1);expect(finished.results[0].holes).toEqual(r.scores);expect(finished.results[0].duration).toBe(5000);
  expect(finishRound(finished,r).results).toHaveLength(1);expect(finishRound(finished,{...r,id:'other'}).results).toHaveLength(1);
  expect(finishRound(finished,{...r,id:'next',date:'2026-09-14'}).results).toHaveLength(2);
 });
 it('uses consecutive calendar visits and does not reset a streak on repeat visits',()=>{
  let state=freshState();state={...state,visits:['2026-09-11','2026-09-12']};state=visit(state,'2026-09-13');expect(streak(state.visits,'2026-09-13')).toBe(3);expect(visit(state,'2026-09-13')).toBe(state);expect(streak(state.visits,'2026-09-14')).toBe(3);expect(streak(state.visits,'2026-09-15')).toBe(0);
 });
 it('keeps daily editions on one Eastern midnight, including daylight-saving changes',()=>{
  expect(dailyKey(new Date('2026-09-14T03:59:59Z'))).toBe('2026-09-13');expect(dailyKey(new Date('2026-09-14T04:00:00Z'))).toBe('2026-09-14');expect(dailyKey(new Date('2026-11-02T04:59:59Z'))).toBe('2026-11-01');expect(dailyKey(new Date('2026-11-02T05:00:00Z'))).toBe('2026-11-02');
 });
 it('derives all profile and score records from the same completed results',()=>{
  const r=round();r.mode='practice';r.bot=12;r.scores[0]={...r.scores[0],score:1,strokes:1};const state=finishRound(freshState(),r);const s=stats(state);expect(s.wins).toBe(1);expect(s.losses).toBe(0);expect(s.rounds).toBe(1);expect(s.aces).toBe(1);expect(s.crowns).toHaveLength(2);expect(s.holes).toBe(3);
 });
});
describe('bathroom course integrity',()=>{
 it('replays a verified route into every one of the 14 cups',()=>{
  for(const h of pool){expect(validateHole(h).ok,h.name).toBe(true);const solution=solutions.find(s=>s.id===h.id)!;expect(solution,h.name).toBeTruthy();const result=replay(h,1,solution.strokes).state;expect(result.sunk,h.name).toBe(true);}
 });
 it('keeps a dense gallery outside every playable shape',()=>{
  for(const h of pool){const region=wallLoops(h),people=placeSpectators(h,region,[]);expect(people.length,h.name).toBeGreaterThan(20);for(const p of people){expect(pointInRegion(region,p.x,p.y),h.name).toBe(false);expect(distToWalls(h,p.x,p.y),h.name).toBeGreaterThanOrEqual(1.4);}}
 });
 it('provides stable daily mixes, different random selections and real obstacle variety',()=>{
  expect(pickCourse(pool,'today',3)).toEqual(pickCourse(pool,'today',3));expect(pickCourse(pool,'tomorrow',3).map(h=>h.id)).not.toEqual(pickCourse(pool,'today',3).map(h=>h.id));
  expect(new Set(pool.map(h=>h.theme)).size).toBe(6);expect(pool.some(h=>h.obstacles.some(o=>o.type==='pipe'))).toBe(true);expect(pool.some(h=>h.slopeZones.length)).toBe(true);expect(pool.some(h=>h.hazards.some(z=>z.type==='water'))).toBe(true);expect(pool.some(h=>h.hazards.some(z=>z.type==='drain'))).toBe(true);expect(pool.some(h=>h.surfaceZones.some(z=>z.surfaceType==='sticky'))).toBe(true);
 });
 it('translates the tee, cup and tunnel exits together without mutating source geometry',()=>{
  const original=pool.find(h=>h.obstacles.some(o=>o.type==='pipe'))!,before=JSON.stringify(original),d=dressHole(original,'royal',99);expect(JSON.stringify(original)).toBe(before);expect(d.tee.x).toBe(original.tee.x+5);expect(d.cup.y).toBe(original.cup.y+4);const a=original.obstacles.find(o=>o.type==='pipe')!,b=d.obstacles.find(o=>o.type==='pipe')!;expect(b.exit.x).toBe(a.exit.x+5);expect(b.exit.y).toBe(a.exit.y+4);
 });
});
