import type { Hole, Point } from '../sim/types';
import { BATH_THEMES, type BathThemeId } from './themes';
import { Rng } from '../generator/rng';
/** Room margins give every shape spectator space without changing its physics. */
export function dressHole(input:Hole,theme:BathThemeId,index:number):Hole {
  const h:Hole=JSON.parse(JSON.stringify(input));
  const shift=(p:Point)=>{p.x+=5;p.y+=4;};
  h.walls.forEach(w=>{shift(w.a);shift(w.b);});shift(h.tee);shift(h.cup);
  [...h.surfaceZones,...h.slopeZones,...h.hazards].forEach(z=>z.polygon.forEach(shift));
  h.obstacles.forEach(o=>{if(o.shape.kind==='polygon')o.shape.points.forEach(shift);else shift(o.shape);if(o.type==='pipe')shift(o.exit);});
  h.bounds={x:0,y:0,w:input.bounds.w+10,h:input.bounds.h+8};h.theme=`bath-${theme}`;h.id=`bath-${theme}-${index}-${input.id}`;
  return h;
}
export function pickCourse(pool:Hole[],seed:string,count:number,theme?:BathThemeId):Hole[]{
  const rng=new Rng(seed);const available=theme?pool.filter(h=>h.theme===`bath-${theme}`):pool;
  const shuffled=rng.shuffle(available.length?available:pool);
  return Array.from({length:count},(_,i)=>shuffled[i%shuffled.length]);
}
export function dailyKey(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function courseTheme(index:number,theme?:BathThemeId):BathThemeId{return theme??BATH_THEMES[index%BATH_THEMES.length].id;}
