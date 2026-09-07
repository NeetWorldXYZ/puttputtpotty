/** Material-rich course art. All paths are visual only; polygon data is never changed. */
import type { Hazard, Polygon, Rect, SurfaceZone } from '../sim/types';
import { bbox, circle, chunky, ellipse, makeRand } from './shapes';
import { drawSprite } from './sprites';
import { finishMaterial } from './materials';
import { OUTLINE } from './themes';

function trace(ctx: CanvasRenderingContext2D, poly: Polygon): void {
  ctx.beginPath(); poly.forEach((p,i)=>i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath();
}
function rect(poly: Polygon): Rect {
  const b=bbox(poly); return {x:b.minX,y:b.minY,w:b.maxX-b.minX,h:b.maxY-b.minY};
}
function glaze(ctx: CanvasRenderingContext2D,b:Rect, colors:string[]): void {
  const g=ctx.createLinearGradient(b.x,b.y,b.x+b.w*.7,b.y+b.h);
  colors.forEach((color,i)=>g.addColorStop(i/(colors.length-1),color));
  ctx.fillStyle=g;ctx.fillRect(b.x,b.y,b.w,b.h);
}
export function screw(ctx: CanvasRenderingContext2D,x:number,y:number,r=.13):void {
  circle(ctx,x,y,r);chunky(ctx,'#d8e3e5',r*.3);
  ctx.strokeStyle='#405866';ctx.lineWidth=r*.35;ctx.beginPath();ctx.moveTo(x-r*.5,y);ctx.lineTo(x+r*.5,y);ctx.stroke();
}
function flecks(ctx:CanvasRenderingContext2D,b:Rect,seed:number,color:string,density:number):void {
  const rand=makeRand(seed);ctx.fillStyle=color;
  const count=Math.min(1600,Math.ceil(b.w*b.h*density));
  for(let i=0;i<count;i++) {const x=b.x+rand()*b.w,y=b.y+rand()*b.h;ellipse(ctx,x,y,.025+rand()*.075,.02+rand()*.045);ctx.fill();}
}
/** Small splats over an explicit residue footprint, so no sticky area is invisible. */
export function detailedSurface(ctx:CanvasRenderingContext2D,z:SurfaceZone,seed:number):void {
  const b=rect(z.polygon); if(b.w<=0||b.h<=0)return;
  ctx.save();trace(ctx,z.polygon);ctx.clip();
  if(z.surfaceType==='sticky') {
    glaze(ctx,b,['#f091bb38','#c6659c45']);
    // Full physical footprint is lightly coated; the gum pieces stay compact.
    flecks(ctx,b,seed,'#ffa9d180',.5);
    const step=3.5, rand=makeRand(seed);
    for(let y=b.y+Math.min(1.5,b.h/2);y<b.y+b.h;y+=step) for(let x=b.x+Math.min(1.5,b.w/2);x<b.x+b.w;x+=step){
      const size=Math.min(2.5,b.w*.85,b.h*.85)*(0.75+rand()*.25);
      ctx.save();ctx.translate(x,y);ctx.rotate(rand()*6.28);
      if(!drawSprite(ctx,'gum',-size/2,-size/2,size,size)) {
        ctx.beginPath();for(let k=0;k<=24;k++){const a=k/24*Math.PI*2,r=size*.38*(1+.23*Math.cos(a*5));k?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(r,0);}ctx.closePath();chunky(ctx,'#ed76ac',.08);
      }ctx.restore();
    }
    trace(ctx,z.polygon);ctx.lineWidth=.12;ctx.strokeStyle='#b9548fa0';ctx.setLineDash([.25,.22]);ctx.stroke();
  } else if(z.surfaceType==='shag') {
    glaze(ctx,b,['#ecdfbd','#b6a888']);
    // Dense terry loops and an inset stitched edge keep this distinct from gum.
    const rand=makeRand(seed);ctx.lineWidth=.07;
    for(let i=0;i<Math.min(2200,b.w*b.h*12);i++){
      const x=b.x+rand()*b.w,y=b.y+rand()*b.h;
      ctx.strokeStyle=i%2?'#fff9dfaa':'#817b6266';ctx.beginPath();ctx.arc(x,y,.09,Math.PI,0);ctx.stroke();
    }
    drawSprite(ctx,'towel',b.x-b.w*.08,b.y-b.h*.08,b.w*1.16,b.h*1.16);
    trace(ctx,z.polygon);ctx.strokeStyle='#397c7b';ctx.lineWidth=.42;ctx.stroke();
    ctx.setLineDash([.13,.13]);ctx.lineWidth=.08;ctx.strokeStyle='#eaffef';ctx.stroke();
  } else if(z.surfaceType==='wet') {
    glaze(ctx,b,['#ddfaff75','#76c7d58c','#b8eefc80']);
    finishMaterial(ctx,b,'water',seed);flecks(ctx,b,seed,'#f5ffff99',.35);
    trace(ctx,z.polygon);ctx.lineWidth=.16;ctx.strokeStyle='#d5ffffbb';ctx.stroke();
    // Small floor decal, not a solid cone that suggests a collider.
    const size=Math.min(1.2,b.w*.18,b.h*.18),x=b.x+b.w/2,y=b.y+b.h/2;
    ctx.beginPath();ctx.moveTo(x,y-size);ctx.lineTo(x+size,y+size*.8);ctx.lineTo(x-size,y+size*.8);ctx.closePath();chunky(ctx,'#f3cf6199',.08);
    ctx.fillStyle=OUTLINE;ctx.fillRect(x-.07,y-size*.25,.14,size*.6);circle(ctx,x,y+size*.55,.08);ctx.fill();
  } else if(z.surfaceType==='sand') {
    glaze(ctx,b,['#f4e4bf','#ccb080']);flecks(ctx,b,seed,'#a28a60',5);flecks(ctx,b,seed+1,'#fff5dc',3);
    ctx.strokeStyle='#a78c5b70';ctx.lineWidth=.08;
    for(let y=b.y+.6;y<b.y+b.h;y+=.7){ctx.beginPath();ctx.moveTo(b.x,y);ctx.bezierCurveTo(b.x+b.w*.3,y-.2,b.x+b.w*.7,y+.2,b.x+b.w,y);ctx.stroke();}
  } else if(z.surfaceType==='tile') {
    glaze(ctx,b,['#e1f2ef','#96b9b9']);finishMaterial(ctx,b,'ceramic',seed);
    ctx.strokeStyle='#ffffff8c';ctx.lineWidth=.08;ctx.beginPath();ctx.moveTo(b.x+.3,b.y+b.h*.55);ctx.lineTo(b.x+b.w*.55,b.y+.3);ctx.stroke();
  } else {
    glaze(ctx,b,['#489268','#286444']);finishMaterial(ctx,b,'turf',seed);
  }
  ctx.restore();
}
export function detailedHazard(ctx:CanvasRenderingContext2D,h:Hazard,seed:number):void {
  const b=rect(h.polygon);if(b.w<=0||b.h<=0)return;
  ctx.save();trace(ctx,h.polygon);ctx.clip();
  if(h.type==='drain') {
    glaze(ctx,b,['#e4ecec','#819aa4','#dce5e5','#5d7783']);
    finishMaterial(ctx,b,'metal',seed);
    const inset=Math.min(.5,b.w*.16,b.h*.16);
    ctx.lineCap='round';
    for(let y=b.y+inset+.2;y<b.y+b.h-inset;y+=.65){
      ctx.beginPath();ctx.moveTo(b.x+inset,y);ctx.lineTo(b.x+b.w-inset,y);ctx.lineWidth=.32;ctx.strokeStyle='#142630';ctx.stroke();
      ctx.beginPath();ctx.moveTo(b.x+inset,y+.15);ctx.lineTo(b.x+b.w-inset,y+.15);ctx.lineWidth=.065;ctx.strokeStyle='#ecfaff';ctx.stroke();
    }
    for(const x of [b.x+inset*.5,b.x+b.w-inset*.5])for(const y of [b.y+inset*.5,b.y+b.h-inset*.5])screw(ctx,x,y,.11);
  } else if(h.type==='water'||h.type==='overflow') {
    glaze(ctx,b,h.type==='water'?['#5cd0d4','#158397','#084956']:['#92dbc9','#459f98','#215969']);
    finishMaterial(ctx,b,'water',seed);
    const rand=makeRand(seed);ctx.lineWidth=.035;
    for(let i=0;i<Math.min(180,b.w*b.h*(h.type==='overflow'?2:.2));i++){
      const x=b.x+rand()*b.w,y=b.y+rand()*b.h,r=.04+rand()*.13;
      circle(ctx,x,y,r);ctx.strokeStyle='#eaffee88';ctx.stroke();
      if(h.type==='overflow'){circle(ctx,x-r*.23,y-r*.23,r*.45);ctx.fillStyle='#e8fff4a0';ctx.fill();}
    }
    // Dark inset edge gives flooded recesses depth, unlike slippery floor film.
    trace(ctx,h.polygon);ctx.strokeStyle='#0a374c';ctx.lineWidth=.38;ctx.stroke();
    trace(ctx,h.polygon);ctx.strokeStyle='#a1edf0';ctx.lineWidth=.09;ctx.stroke();
  } else if(h.type==='pit') {
    glaze(ctx,b,['#050e17','#12222f','#030a11']);
    trace(ctx,h.polygon);ctx.lineWidth=.8;ctx.strokeStyle='#344e5d';ctx.stroke();
    trace(ctx,h.polygon);ctx.lineWidth=.24;ctx.strokeStyle='#94a4a8';ctx.stroke();
    // Recessed pipework lies below the playable plane.
    ctx.strokeStyle='#607b7b44';ctx.lineWidth=.12;ctx.beginPath();ctx.moveTo(b.x,b.y+b.h*.6);ctx.lineTo(b.x+b.w,b.y+b.h*.8);ctx.stroke();
  } else {
    glaze(ctx,b,['#d9b969','#a9823b']);
    ctx.strokeStyle='#283743';ctx.lineWidth=.65;
    for(let x=b.x-b.h;x<b.x+b.w;x+=1.7){ctx.beginPath();ctx.moveTo(x,b.y);ctx.lineTo(x+b.h,b.y+b.h);ctx.stroke();}
    finishMaterial(ctx,b,'rubber',seed);
  }
  trace(ctx,h.polygon);ctx.strokeStyle=OUTLINE;ctx.lineWidth=.18;ctx.stroke();ctx.restore();
}
/** Repeat objects along long walls instead of stretching a single sprite. */
function dressWall(ctx:CanvasRenderingContext2D,b:Rect,name:'soap'|'towel'):void {
  const vertical=b.h>b.w, long=vertical?b.h:b.w, short=vertical?b.w:b.h;
  const ratio=name==='soap'?1.95:1.05;
  const cross=Math.min(short*.88,3.5), length=cross*ratio;
  const count=Math.max(1,Math.min(20,Math.floor(long/(length+.3))));
  for(let i=0;i<count;i++){
    const center=long*(i+.5)/count;
    ctx.save();ctx.translate(b.x+(vertical?b.w/2:center),b.y+(vertical?center:b.h/2));
    if(vertical)ctx.rotate(Math.PI/2);
    drawSprite(ctx,name,-length/2,-cross/2,length,cross);ctx.restore();
  }
}
/** Raised faces are already clipped to their actual obstacle footprint by the caller. */
export function solidDetail(ctx:CanvasRenderingContext2D,b:Rect,kind:string,seed:number,spriteFace=true):void {
  if(kind==='deadWall') {
    glaze(ctx,b,['#ebdec2','#b4b39d']);finishMaterial(ctx,b,'fabric',seed);flecks(ctx,b,seed,'#fff8de99',7);
    ctx.strokeStyle='#548e88';ctx.lineWidth=.16;
    for(const yy of [.7,.82]){ctx.beginPath();ctx.moveTo(b.x,b.y+b.h*yy);ctx.lineTo(b.x+b.w,b.y+b.h*yy);ctx.stroke();}
    if(spriteFace)dressWall(ctx,b,'towel');
  } else if(kind==='blocker') {
    glaze(ctx,b,['#faf9ed','#d9e8e7','#9ebcbd']);finishMaterial(ctx,b,'ceramic',seed);
    if(spriteFace){glaze(ctx,b,['#afd5b9','#6f9e88']);dressWall(ctx,b,'soap');}
  } else {
    glaze(ctx,b,['#fff0a7','#c5a258','#f5d984','#927745']);finishMaterial(ctx,b,'metal',seed);
    ctx.strokeStyle='#253947';ctx.lineWidth=.12;
    for(let x=b.x+.3;x<b.x+b.w;x+=.45){ctx.beginPath();ctx.moveTo(x,b.y);ctx.lineTo(x,b.y+b.h);ctx.stroke();}
    screw(ctx,b.x+.2,b.y+b.h/2,.09);screw(ctx,b.x+b.w-.2,b.y+b.h/2,.09);
  }
}
export function goalCrown(ctx:CanvasRenderingContext2D,x:number,y:number,r:number):void {
  if(drawSprite(ctx,'crown',x-r*1.25,y-r*3.7,r*2.5,r*2.3))return;
  ctx.beginPath();ctx.moveTo(x-r,y-r*2);ctx.lineTo(x-r*1.2,y-r*3.3);ctx.lineTo(x-r*.5,y-r*2.9);ctx.lineTo(x,y-r*3.6);ctx.lineTo(x+r*.5,y-r*2.9);ctx.lineTo(x+r*1.2,y-r*3.3);ctx.lineTo(x+r,y-r*2);ctx.closePath();chunky(ctx,'#ffcf4b',.15);
}
export function portal(ctx:CanvasRenderingContext2D,x:number,y:number,r:number):void {
  if(drawSprite(ctx,'flange',x-r,y-r,r*2,r*2))return;
  circle(ctx,x,y,r);chunky(ctx,'#b5ccd1',.18);circle(ctx,x,y,r*.62);chunky(ctx,'#092335',.1);
  for(let k=0;k<4;k++){const a=k*Math.PI/2;screw(ctx,x+Math.cos(a)*r*.8,y+Math.sin(a)*r*.8,r*.09);}
}
export function rubberHead(ctx:CanvasRenderingContext2D,x:number,y:number,r:number):void {
  const g=ctx.createRadialGradient(x-r*.35,y-r*.4,r*.1,x,y,r);
  g.addColorStop(0,'#ffb4a7');g.addColorStop(.35,'#ed655c');g.addColorStop(.8,'#be303b');g.addColorStop(1,'#5f1c2e');
  circle(ctx,x,y,r);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle=OUTLINE;ctx.lineWidth=.12;ctx.stroke();
  circle(ctx,x,y,r*.8);ctx.strokeStyle='#fa9c8455';ctx.lineWidth=.08;ctx.stroke();
}
