import type { Hole } from '../sim/types';
import type { PropPlacement } from './props';
import { pointInRegion, distToWalls, type Region } from './region';
import { roundRectPath } from './shapes';
export interface FanArea { x:number; y:number; kind:'bar'|'food' }
/** Small concessions occupy only generous, unplayable pockets of the surround. */
export function placeFanAreas(hole:Hole, region:Region, props:PropPlacement[]):FanArea[]{
  const spots:FanArea[]=[];const b=hole.bounds;
  for(let y=b.y+3.5;y<b.y+b.h-3.5;y+=3)for(let x=b.x+3.5;x<b.x+b.w-3.5;x+=3){
    if(pointInRegion(region,x,y)||distToWalls(hole,x,y)<3.4)continue;
    if(props.some(p=>Math.hypot(p.x-x,p.y-y)<5.7)||spots.some(p=>Math.hypot(p.x-x,p.y-y)<10))continue;
    spots.push({x,y,kind:spots.length%2?'food':'bar'});if(spots.length===3)return spots;
  }
  return spots;
}
export function drawFanArea(c:CanvasRenderingContext2D,p:FanArea):void{
  c.save();c.translate(p.x,p.y);c.lineJoin='round';c.lineCap='round';c.lineWidth=.13;c.strokeStyle='#08283c';
  const box=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;roundRectPath(c,x,y,w,h,.14);c.fill();c.stroke();};
  c.fillStyle='#00192838';c.beginPath();c.ellipse(0,1.5,2.45,.7,0,0,Math.PI*2);c.fill();
  if(p.kind==='bar'){
    box(-1.8,-.8,3.6,2.3,'#b97d40');box(-2,.05,4,.42,'#ffe0a0');
    box(-1.9,-2.25,3.8,1.25,'#fff1c9');
    for(let i=0;i<6;i++){c.fillStyle=i%2?'#fff1c9':'#078aa0';c.fillRect(-1.87+i*.62,-2.21,.62,1.14);}
    box(-2.1,-1.2,4.2,.38,'#087085');
    c.fillStyle='#fff2c4';c.font='800 .39px system-ui';c.textAlign='center';c.fillText('19TH HOLE',0,1.14);
    c.fillStyle='#edc698';c.beginPath();c.arc(0,-.56,.35,0,Math.PI*2);c.fill();c.stroke();box(-.4,-.28,.8,.36,'#244d6e');
    for(const x of [-1.2,.9]){box(x,-.22,.38,.45,'#ffbb3f');box(x-.04,-.3,.45,.14,'#fff9dc');}
    c.strokeStyle='#d2e5ed';c.lineWidth=.18;c.beginPath();c.moveTo(.55,0);c.lineTo(.55,-.62);c.lineTo(.8,-.62);c.stroke();
  }else{
    c.fillStyle='#e4aa60';c.beginPath();c.ellipse(0,.8,1.65,.85,0,0,Math.PI*2);c.fill();c.stroke();
    box(-1.9,.5,.4,1.1,'#bc733e');box(1.5,.5,.4,1.1,'#bc733e');
    c.strokeStyle='#08283c';c.lineWidth=.15;c.beginPath();c.moveTo(0,.8);c.lineTo(0,-1.35);c.stroke();
    c.fillStyle='#ffdb70';c.beginPath();c.moveTo(-2,-1);c.quadraticCurveTo(0,-3,2,-1);c.closePath();c.fill();c.stroke();
    c.fillStyle='#ee7065';c.beginPath();c.moveTo(0,-2);c.lineTo(-.7,-1);c.lineTo(.7,-1);c.closePath();c.fill();
    box(-1,.45,.6,.25,'#f5ce85');box(-.97,.47,.53,.1,'#b84135');
    c.fillStyle='#ffd969';c.beginPath();c.moveTo(.5,.35);c.lineTo(1.1,.85);c.lineTo(.35,1);c.closePath();c.fill();c.stroke();
    box(-.25,.7,.3,.4,'#f3f8ef');
  }
  c.restore();
}
