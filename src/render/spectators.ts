import type { Hole } from '../sim/types';
import { pointInRegion, distToWalls, type Region } from './region';
import type { PropPlacement } from './props';
import { roundRectPath } from './shapes';

export interface Spectator { x: number; y: number; group: number; variant: number }
/** Visual-only, deterministic rows following the OUTSIDE of each playable wall. */
export function placeSpectators(hole: Hole, region: Region, props: PropPlacement[] = []): Spectator[] {
  const out: Spectator[] = [];
  const b = hole.bounds;
  for (let group = 0; group < hole.walls.length; group++) {
    const wall = hole.walls[group];
    const dx = wall.b.x - wall.a.x, dy = wall.b.y - wall.a.y;
    const length = Math.hypot(dx, dy);
    if (length < 2) continue;
    for (const offset of [1.7, 3.5]) {
    for (let step = offset === 1.7 ? 1.1 : 1.9; step < length - .6; step += 1.65) {
      for (const side of [-1, 1]) {
        const x = wall.a.x + dx * step / length - dy / length * offset * side;
        const y = wall.a.y + dy * step / length + dx / length * offset * side;
        if (x < b.x + .8 || x > b.x + b.w - .8 || y < b.y + 1.1 || y > b.y + b.h - .8) continue;
        if (pointInRegion(region, x, y) || distToWalls(hole, x, y) < 1.4) continue;
        if (props.some(p => Math.hypot(p.x - x, p.y - y) < 3.1)) continue;
        if (out.some(p => Math.hypot(p.x - x, p.y - y) < 1.5)) continue;
        out.push({ x, y, group, variant: out.length % 12 });
        if (out.length >= 150) return out;
      }
    }
    }
  }
  return out;
}
const SHIRTS = ['#4a9af0','#ec6785','#ffcf62','#58d5ad','#b899ef','#f78c54'];
const SKIN = ['#ffe1ad','#be875d','#8e5d45','#f2c697'];
const SHOUTS = ['GET IN!', 'FLUSH IT!', 'SEND IT!', 'OH, SHIT!', 'CROWN HIM!', 'NICE PUTT!'];
export function drawSpectators(ctx: CanvasRenderingContext2D, people: Spectator[], region: Region, time: number, scale: number, cheer: boolean, quiet: boolean, view: { left: number; top: number; right: number; bottom: number }): void {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const p of people) {
    if (p.x < view.left - 1 || p.x > view.right + 1 || p.y < view.top - 5 || p.y > view.bottom + 5) continue;
    const bounce = Math.sin(time * (cheer ? 8 : 1.6) + p.variant * 1.9) * (cheer ? .15 : .035);
    const wave = cheer || (Math.floor(time / 4) + p.variant) % 11 === 0;
    ctx.save();ctx.translate(p.x,p.y+bounce);
    ctx.fillStyle='#00192844';ctx.beginPath();ctx.ellipse(0,.55,.54,.17,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#08283c';ctx.lineWidth=.11;
    ctx.fillStyle=SHIRTS[p.variant%6];roundRectPath(ctx,-.36,-.05,.72,.67,.18);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(-.3,.05);ctx.lineTo(-.58,wave ? -.35 : .38);ctx.moveTo(.3,.05);ctx.lineTo(.58,wave ? -.42 + Math.sin(time*6+p.variant)*.1 : .38);ctx.stroke();
    ctx.fillStyle=SKIN[p.variant%4];ctx.beginPath();ctx.arc(0,-.36,.34,0,Math.PI*2);ctx.fill();ctx.stroke();
    if(p.variant%3===0){ctx.fillStyle=SHIRTS[(p.variant+2)%6];ctx.beginPath();ctx.arc(0,-.39,.35,Math.PI,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-.4,-.4);ctx.lineTo(.35,-.4);ctx.stroke();}
    else if(p.variant%3===1){ctx.fillStyle='#583c32';ctx.beginPath();ctx.arc(0,-.48,.29,Math.PI,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#08283c';ctx.fillRect(-.14,-.39,.07,.08);ctx.fillRect(.07,-.39,.07,.08);
    ctx.beginPath();ctx.moveTo(-.1,-.21);ctx.quadraticCurveTo(0,-.13,.1,-.21);ctx.stroke();
    ctx.restore();
  }
  // One short bubble per interval; keep all of it outside the playable floor.
  if (!quiet && time > 3 && time % 14 < 2.4 && people.length) {
    const cycle = Math.floor(time / 14);
    const text = cheer ? 'LET’S GO!' : SHOUTS[cycle % SHOUTS.length];
    const fontSize = Math.max(.65, 11/scale);
    ctx.font=`800 ${fontSize}px system-ui,sans-serif`;
    const width=ctx.measureText(text).width+.65, height=fontSize+.55;
    for(let j=0;j<people.length;j++){
      const p=people[(cycle*7+j)%people.length];
      const x=p.x-width/2,y=p.y-1.05-height;
      if (x < view.left + .4 || x + width > view.right - .4 || y < view.top || y + height > view.bottom) continue;
      let safe=true;
      for(let xx=x;xx<=x+width;xx+=.4)for(let yy=y;yy<=y+height;yy+=.4)if(pointInRegion(region,xx,yy))safe=false;
      if(!safe)continue;
      ctx.fillStyle='#fff3ce';ctx.strokeStyle='#08283c';ctx.lineWidth=.1;roundRectPath(ctx,x,y,width,height,.2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#08283c';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,p.x,y+height/2);break;
    }
  }
  ctx.restore();
}
