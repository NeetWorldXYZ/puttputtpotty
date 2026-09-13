import type {Hole,Point,Obstacle,ObstacleShape,MovingObstacle} from '../sim/types';
import {isMoving} from '../sim/types';
import {traceRegion,wallLoops,pointInRegion,distToWalls,type Region} from '../render/region';
import {placeSpectators,type Spectator} from '../render/spectators';
import {drawSlopeZone,type BallStyle} from '../render/objects';
import {bathTheme} from './themes';
import {prop,tileMaterial,type PropName} from './art';
import {drawBathroomCrowd} from './crowd';
const ink='#092a3b',TAU=Math.PI*2;
function path(c:CanvasRenderingContext2D,ps:Point[]){c.beginPath();ps.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();}
function circle(c:CanvasRenderingContext2D,x:number,y:number,r:number,fill:string,stroke?:string,lw=.12){c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
function shadow(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number){c.fillStyle='#03203350';c.beginPath();c.ellipse(x+.15,y+.23,rx,ry,0,0,TAU);c.fill();}
function bbox(ps:Point[]){const x=Math.min(...ps.map(p=>p.x)),y=Math.min(...ps.map(p=>p.y));return{x,y,w:Math.max(...ps.map(p=>p.x))-x,h:Math.max(...ps.map(p=>p.y))-y};}
function shapePath(c:CanvasRenderingContext2D,s:ObstacleShape){if(s.kind==='polygon')path(c,s.points);else{c.beginPath();if(s.kind==='circle')c.arc(s.x,s.y,s.r,0,TAU);else c.roundRect(s.x,s.y,s.w,s.h,Math.min(.2,s.w/4,s.h/4));}}
function port(c:CanvasRenderingContext2D,x:number,y:number,r:number,entry:boolean){shadow(c,x,y,r*1.2,r*.9);prop(c,'pipe',x-r*1.52,y-r*2.9,r*3.4,r*3.6);circle(c,x,y,r*.94,ink,'#f5c755',.2);circle(c,x,y,r*.72,'#031c28','#228799',.12);c.font=`900 ${r*.64}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=entry?'#ffdd64':'#8de4d0';c.fillText(entry?'IN':'OUT',x,y);}
export function bathroomObstacle(c:CanvasRenderingContext2D,o:Obstacle,hole:Hole){
 const s=o.shape,t=bathTheme(hole.theme);c.save();c.lineJoin='round';c.lineCap='round';
 if(o.type==='pipe'){port(c,o.shape.x,o.shape.y,o.shape.r,true);port(c,o.exit.x,o.exit.y,o.shape.r,false);}
 else if(s.kind==='circle'&&(o.type==='bumper'||o.type==='post')){
  const{x,y,r}=s;shadow(c,x,y,r*1.15,r*.9);circle(c,x,y,r,t.trim,ink,.13);
  if(o.type==='bumper'){
   // The physical contact ring is always visible, even behind the raised paper roll.
   prop(c,'paper',x-r*1.04,y-r*1.85,r*2.14,r*2.63);c.strokeStyle='#ffdf6a';c.lineWidth=.14;c.beginPath();c.arc(x,y,r,.05,Math.PI-.05);c.stroke();
  }else{prop(c,'plunger',x-r*1.05,y-r*3.35,r*2.15,r*4.15);}
 }else{
  shapePath(c,s);c.save();c.translate(.15,.32);c.fillStyle='#03213470';c.fill();c.restore();
  shapePath(c,s);const b=s.kind==='rect'?s:s.kind==='circle'?{x:s.x-s.r,y:s.y-s.r,w:s.r*2,h:s.r*2}:bbox(s.points);
  const g=c.createLinearGradient(b.x,b.y,b.x+b.w,b.y+b.h);g.addColorStop(0,'#fffdf0');g.addColorStop(.42,t.wall);g.addColorStop(1,t.trim);c.fillStyle=o.type==='deadWall'?'#263c4a':o.type==='curb'?'#d99d57':g;c.fill();c.strokeStyle=ink;c.lineWidth=.23;c.stroke();
  c.save();shapePath(c,s);c.clip();c.strokeStyle='#ffffff99';c.lineWidth=.11;for(let y=b.y+.3;y<b.y+b.h;y+=1.8){c.beginPath();c.moveTo(b.x+.18,y);c.lineTo(b.x+b.w-.18,y);c.stroke();}c.restore();
  if(b.w>2.5&&b.h>2.5&&b.w<8&&b.h<8)prop(c,'sink',b.x+.15,b.y-.5,b.w-.3,b.h+.6);
 }
 c.restore();
}
function roomProps(c:CanvasRenderingContext2D,hole:Hole,region:Region){
 const b=hole.bounds,placed:{kind:'crowd';x:number;y:number;r:number;seed:number}[]=[];
 // Fixtures live in pockets outside the playable boundary, never on a putting lane.
 for(let y=b.y+4;y<b.y+b.h-4;y+=11)for(const x of[b.x+3,b.x+b.w-3]){
  if(pointInRegion(region,x,y)||distToWalls(hole,x,y)<3.2)continue;
  const name:PropName=(Math.round(y)%3===0)?'soap':Math.round(y)%2===0?'paper':'sink';
  shadow(c,x,y,1.6,.7);prop(c,name,x-1.7,y-3.2,3.4,4.2);placed.push({kind:'crowd',x,y:y-1,r:0,seed:0});
 }
 return placed;
}
export function paintBathroom(c:CanvasRenderingContext2D,hole:Hole,cupR:number,ballR:number){
 const b=hole.bounds,t=bathTheme(hole.theme),region=wallLoops(hole);c.save();
 c.fillStyle='#163b4b';c.fillRect(b.x,b.y,b.w,b.h);const tile=tileMaterial(t.tile);if(tile){const pattern=c.createPattern(tile,'repeat');if(pattern){pattern.setTransform(new DOMMatrix().scale(12/512));c.fillStyle=pattern;c.fillRect(b.x,b.y,b.w,b.h);}}
 // Bathroom skirting and copper plumbing make the whole arena read as an interior.
 c.strokeStyle=ink;c.lineWidth=.7;c.strokeRect(b.x+.45,b.y+.45,b.w-.9,b.h-.9);c.strokeStyle=t.trim;c.lineWidth=.22;c.strokeRect(b.x+.45,b.y+.45,b.w-.9,b.h-.9);
 const fixtures=roomProps(c,hole,region);
 const spectators=placeSpectators(hole,region,fixtures);
 // Raised, curved porcelain course bed with a rubber putting surface.
 c.save();c.translate(.15,.55);traceRegion(c,region);c.fillStyle='#062435a0';c.fill('evenodd');c.strokeStyle='#082b3b';c.lineWidth=1.15;c.lineJoin='round';c.stroke();c.restore();
 c.save();traceRegion(c,region);c.clip('evenodd');
 const g=c.createLinearGradient(b.x,b.y,b.x+b.w,b.y+b.h);g.addColorStop(0,t.light);g.addColorStop(.38,t.floor);g.addColorStop(1,t.floor);c.fillStyle=g;c.fillRect(b.x,b.y,b.w,b.h);
 // Fine rubber grain, quieter than the outer tile so the ball and boundaries stay legible.
 c.fillStyle='#071f3424';for(let y=b.y;y<b.y+b.h;y+=.47)for(let x=b.x;x<b.x+b.w;x+=.47){c.beginPath();c.ellipse(x+(Math.round(y/.47)%2)*.22,y,.046,.035,0,0,TAU);c.fill();}
 c.strokeStyle='#ffffff0d';c.lineWidth=.06;for(let y=b.y+6;y<b.y+b.h;y+=6){c.beginPath();c.moveTo(b.x,y);c.lineTo(b.x+b.w,y);c.stroke();}
 for(const z of hole.surfaceZones){const q=bbox(z.polygon);c.save();path(c,z.polygon);c.clip();
  c.fillStyle=({felt:'#16687b',tile:'#b9ddde',shag:'#779b56',wet:'#5fcfe79c',sand:'#b59360',sticky:'#cf6097'}[z.surfaceType]);c.fillRect(q.x,q.y,q.w,q.h);
  if(z.surfaceType==='sticky') {prop(c,'gum',q.x,q.y,q.w,q.h);}
  else {c.strokeStyle=z.surfaceType==='shag'?'#d6e3a87a':'#ffffff50';c.lineWidth=.09;for(let y=q.y+.3;y<q.y+q.h;y+=.55){c.beginPath();c.moveTo(q.x+.15,y);c.lineTo(q.x+q.w-.15,y-.16);c.stroke();}}
  c.restore();path(c,z.polygon);c.strokeStyle='#062c4355';c.lineWidth=.12;c.stroke();
 }
 for(const z of hole.slopeZones){c.save();path(c,z.polygon);const q=bbox(z.polygon),g=c.createLinearGradient(q.x,q.y,q.x,q.y+q.h);g.addColorStop(0,'#e5d9a77a');g.addColorStop(1,'#174d6150');c.fillStyle=g;c.fill();c.strokeStyle='#d6efdcb0';c.lineWidth=.18;c.stroke();drawSlopeZone(c,z);c.restore();}
 for(const h of hole.hazards){const q=bbox(h.polygon);c.save();path(c,h.polygon);c.clip();const wet=h.type==='water'||h.type==='overflow';const g=c.createLinearGradient(q.x,q.y,q.x,q.y+q.h);g.addColorStop(0,wet?'#176e98':'#051621');g.addColorStop(1,wet?'#74e3e9':'#244858');c.fillStyle=g;c.fillRect(q.x,q.y,q.w,q.h);if(h.type==='drain')prop(c,'vent',q.x,q.y,q.w,q.h);if(wet){c.fillStyle='#ecffff6b';for(let i=0;i<5;i++){c.beginPath();c.ellipse(q.x+q.w*(.12+i*.18),q.y+q.h*(.25+(i%2)*.4),Math.min(q.w*.13,1.5),.08,-.1,0,TAU);c.fill();}}c.restore();path(c,h.polygon);c.strokeStyle=wet?'#b5ffff':'#a2b9c2';c.lineWidth=.17;c.stroke();}
 traceRegion(c,region);c.strokeStyle='#05283880';c.lineWidth=1.3;c.lineJoin='round';c.stroke();c.restore();
 // Course curbs: the centre of every visible edge is the exact collision boundary.
 for(const [width,color,dy]of[[.92,ink,.2],[.76,t.trim,.08],[.51,t.wall,-.07],[.1,'#ffffff',-.18]]as const){c.save();c.translate(0,dy);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();for(const w of hole.walls){c.moveTo(w.a.x,w.a.y);c.lineTo(w.b.x,w.b.y);}c.stroke();c.restore();}
 for(const o of hole.obstacles)if(!isMoving(o))bathroomObstacle(c,o,hole);
 circle(c,hole.tee.x,hole.tee.y,ballR*1.7,'#092f4240','#cdf9f58c',.1);
 bathroomCup(c,hole.cup.x,hole.cup.y,cupR);
 c.restore();return{animated:[],region,spectators};
}
export function bathroomCup(c:CanvasRenderingContext2D,x:number,y:number,r:number){
 shadow(c,x,y+.3,r*2.2,r*1.1);prop(c,'toilet',x-r*2.05,y-r*4.85,r*4.0,r*6.6);
 // Visible capture aperture aligns with the actual cup, not with the toilet's outer rim.
 circle(c,x,y,r,'#082c3c','#92f5ed',.11);circle(c,x,y,r*.68,'#021620');c.save();c.strokeStyle='#ecffff70';c.lineWidth=.1;c.beginPath();c.arc(x,y,r*.82,Math.PI,Math.PI*1.75);c.stroke();c.restore();
}
export function bathroomLife(c:CanvasRenderingContext2D,hole:Hole,people:Spectator[],region:Region,t:number,cheer:boolean,quiet:boolean,view:{left:number;right:number;top:number;bottom:number},scale:number,clock=t,reduced=false){
 drawBathroomCrowd(c,people,region,reduced?0:t,cheer,quiet,view,scale);
 if(reduced)t=0;
 for(const z of hole.hazards){if(z.type!=='water'&&z.type!=='overflow')continue;const b=bbox(z.polygon);c.save();path(c,z.polygon);c.clip();c.strokeStyle='#ecffff70';c.lineWidth=.09;for(let i=0;i<3;i++){const ph=(t*.28+i/3)%1;c.globalAlpha=1-ph;c.beginPath();c.ellipse(b.x+b.w*.5,b.y+b.h*.5,.4+ph*b.w*.42,.13+ph*b.h*.32,0,0,TAU);c.stroke();}c.restore();}
 for(const o of hole.obstacles){if(isMoving(o))bathroomMover(c,o,clock,hole);else if(o.type==='pipe'){c.save();c.strokeStyle='#ffe489';c.lineWidth=.09;c.globalAlpha=.4+.3*Math.sin(t*2);for(const p of[o.shape,o.exit]){c.beginPath();c.arc(p.x,p.y,o.shape.r*1.09,0,TAU);c.stroke();}c.restore();}}
}
function bathroomMover(c:CanvasRenderingContext2D,o:MovingObstacle,t:number,hole:Hole){
 if(o.type==='slidingGate'){
  let off=o.amplitude*Math.sin(TAU*t/o.period+o.phase);if(o.look==='luggage'){const u=((t/o.period+o.phase/TAU)%1+1)%1;off=o.amplitude*(u<.5?u*4-1:3-u*4);}
  bathroomObstacle(c,{type:'blocker',shape:{...o.shape,x:o.shape.x+(o.axis==='x'?off:0),y:o.shape.y+(o.axis==='y'?off:0)}},hole);
 }else if(o.type==='windmill'){
  const s=o.shape;c.save();c.translate(s.x,s.y);const ang=o.phase+o.direction*TAU*t/o.period;for(let k=0;k<o.blades;k++){c.save();c.rotate(ang+k*TAU/o.blades);const bw=o.bladeWidth??.7;const g=c.createLinearGradient(0,-bw/2,0,bw/2);g.addColorStop(0,'#f7faf3');g.addColorStop(.5,'#95b9c9');g.addColorStop(1,'#466978');c.beginPath();c.roundRect(0,-bw/2,s.r,bw,.14);c.fillStyle=g;c.fill();c.lineWidth=.12;c.strokeStyle=ink;c.stroke();c.restore();}circle(c,0,0,.5,'#d9e5e7',ink);circle(c,0,0,.15,'#607d8c');c.restore();
 }else {
  const a=Math.PI/2+o.arc*Math.sin(TAU*t/o.period+o.phase),s=o.shape,bx=s.x+Math.cos(a)*s.r,by=s.y+Math.sin(a)*s.r,br=o.bobRadius??.9;
  c.save();c.lineCap='round';c.strokeStyle=ink;c.lineWidth=.6;c.beginPath();c.moveTo(s.x,s.y);c.lineTo(bx,by);c.stroke();c.strokeStyle='#deb676';c.lineWidth=.34;c.stroke();circle(c,s.x,s.y,.48,'#bccdd1',ink,.1);bathroomObstacle(c,{type:'post',shape:{kind:'circle',x:bx,y:by,r:br}},hole);c.restore();
 }
}
export function drawBathroomBall(c:CanvasRenderingContext2D,x:number,y:number,r:number,style?:BallStyle|null){
 c.save();c.translate(x,y);shadow(c,0,r*.16,r*1.18,r*.76);const g=c.createRadialGradient(-r*.33,-r*.4,r*.06,0,0,r);g.addColorStop(0,'#ffffff');g.addColorStop(.35,style?.color??'#ffffff');g.addColorStop(.8,style?.color==='#1f2a44'?'#28485a':'#d7e8ed');g.addColorStop(1,'#6e9aaf');circle(c,0,0,r,'#ffffff',ink,.08);c.fillStyle=g;c.fill();
 c.save();c.beginPath();c.arc(0,0,r*.92,0,TAU);c.clip();c.rotate((x+y)*.6);for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const dx=(i+(j%2)*.5)*r*.32,dy=j*r*.31;if(Math.hypot(dx,dy)>r*.78)continue;c.fillStyle='#355d7a30';c.beginPath();c.ellipse(dx,dy,r*.078,r*.065,0,0,TAU);c.fill();c.strokeStyle='#ffffff80';c.lineWidth=r*.025;c.beginPath();c.arc(dx,dy,r*.08,0,Math.PI);c.stroke();}if(style?.pattern==='stripe'){c.fillStyle=style.accent;c.globalAlpha=.7;c.fillRect(-r,-r*.16,r*2,r*.3);}c.restore();
 c.strokeStyle='#ffffffd9';c.lineWidth=r*.09;c.beginPath();c.arc(-r*.02,-r*.02,r*.75,Math.PI*1.1,Math.PI*1.6);c.stroke();c.restore();
}
