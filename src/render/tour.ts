/** Preview-only art direction. All paths use the original simulation geometry. */
import type { Hole, Wall } from '../sim/types';
import { isMoving } from '../sim/types';
import { wallLoops, traceRegion, pointInRegion, distToWalls } from './region';
import { makeRand } from './shapes';
import { drawCup, drawTee, drawHazard, drawObstacle, drawSlopeZone, drawSurfaceZone, holeSeed } from './objects';
import { placeSpectators, type Spectator } from './spectators';
let turf: HTMLImageElement | undefined;
let prepared: Promise<void> | undefined;
export function prepareTourArt(): Promise<void> {
  return prepared ??= (async () => {
    const img = new Image(); img.src = '/art/tour-preview/turf.webp';
    try { await img.decode(); turf = img; } catch { /* Painted turf remains usable offline. */ }
  })();
}
function grass(c: CanvasRenderingContext2D, hole: Hole, rough: boolean) {
  const b = hole.bounds;
  c.fillStyle = rough ? '#327441' : '#67af49'; c.fillRect(b.x,b.y,b.w,b.h);
  if (turf) {
    const pattern = c.createPattern(turf, 'repeat');
    if (pattern) {
      pattern.setTransform(new DOMMatrix().scale(10 / turf.width));
      c.save(); c.globalAlpha = rough ? .34 : .22; c.fillStyle = pattern; c.fillRect(b.x,b.y,b.w,b.h); c.restore();
    }
  }
  if (!rough) {
    c.save(); c.translate(b.x,b.y); c.rotate(-Math.PI/5);
    for(let x=-b.h; x<b.w+b.h; x+=6) { c.fillStyle='#e5f1a319'; c.fillRect(x,-b.h,3,b.h*3); }
    c.restore();
  }
  const sun = c.createLinearGradient(b.x,b.y,b.x+b.w,b.y+b.h);
  sun.addColorStop(0,rough ? '#c4d36612' : '#faffb329'); sun.addColorStop(1,rough ? '#002f3440' : '#063e3620');
  c.fillStyle=sun; c.fillRect(b.x,b.y,b.w,b.h);
}
function tree(c: CanvasRenderingContext2D,x:number,y:number,r:number,seed:number) {
  const rand=makeRand(seed);
  c.save();c.translate(x,y);
  const shadow=c.createRadialGradient(r*.6,r*.8,0,r*.6,r*.8,r*1.5);
  shadow.addColorStop(0,'#062e32aa');shadow.addColorStop(.6,'#062e3266');shadow.addColorStop(1,'#062e3200');
  c.fillStyle=shadow;c.beginPath();c.ellipse(r*.6,r*.8,r*1.6,r*1.3,0,0,Math.PI*2);c.fill();
  for(let i=0;i<12;i++) {
    const a=i*2.399, d=Math.sqrt(i/12)*r*.7, px=Math.cos(a)*d,py=Math.sin(a)*d;
    const size=r*(.36+rand()*.2), g=c.createRadialGradient(px-size*.35,py-size*.45,0,px,py,size);
    g.addColorStop(0,i>8?'#a0c94c':'#6aaf42');g.addColorStop(.5,'#3a8740');g.addColorStop(1,'#15543a');
    c.fillStyle=g;c.strokeStyle='#1a5636';c.lineWidth=.055;c.beginPath();c.arc(px,py,size,0,Math.PI*2);c.fill();c.stroke();
    c.strokeStyle='#b6d96655';c.lineWidth=.06;c.beginPath();c.arc(px-.04,py-.04,size*.72,Math.PI*1.04,Math.PI*1.5);c.stroke();
  }
  c.restore();
}
function walls(c: CanvasRenderingContext2D, ws: Wall[]) {
  const path=()=>{c.beginPath();for(const w of ws){c.moveTo(w.a.x,w.a.y);c.lineTo(w.b.x,w.b.y);}};
  c.save();c.lineJoin='round';c.lineCap='round';
  // Broad soft contact shadow, stone side, then a narrow lit cap. Collision line is unchanged.
  for(const [dx,dy,width,color] of [[.36,.72,2.2,'#062d3430'],[.2,.48,1.7,'#062d3455'],[0,.36,1.45,'#334d47'],[0,.19,1.25,'#9b9679'],[0,0,1.15,'#f1e7c2'],[-.08,-.12,.72,'#fff4d6']] as const){
    c.save();c.translate(dx,dy);c.lineWidth=width;c.strokeStyle=color;path();c.stroke();c.restore();
  }
  for(const w of ws){
    const dx=w.b.x-w.a.x,dy=w.b.y-w.a.y,l=Math.hypot(dx,dy);
    c.strokeStyle='#8f927661';c.lineWidth=.055;
    for(let d=1.7;d<l-.8;d+=2.2){const x=w.a.x+dx*d/l,y=w.a.y+dy*d/l;c.beginPath();c.moveTo(x-dy/l*.45,y+dx/l*.45);c.lineTo(x+dy/l*.45,y-dx/l*.45);c.stroke();}
    // Brass inlays at corners keep the crown palette in the physical course.
    c.fillStyle='#dcb54e';c.beginPath();c.arc(w.a.x,w.a.y,.28,0,Math.PI*2);c.fill();c.strokeStyle='#fff0a8';c.lineWidth=.06;c.stroke();
  }
  c.restore();
}
function crest(c:CanvasRenderingContext2D,x:number,y:number) {
  c.save();c.translate(x,y);c.globalAlpha=.22;c.strokeStyle='#ecf8b2';c.lineWidth=.09;
  c.beginPath();c.arc(0,0,1.7,0,Math.PI*2);c.stroke();
  c.beginPath();c.moveTo(-1,.55);c.lineTo(-1.15,-.65);c.lineTo(-.45,-.15);c.lineTo(0,-.9);c.lineTo(.45,-.15);c.lineTo(1.15,-.65);c.lineTo(1,.55);c.closePath();c.stroke();c.restore();
}
export function paintTour(c:CanvasRenderingContext2D,hole:Hole,cupR:number,ballR:number) {
  const region=wallLoops(hole),seed=holeSeed(hole),b=hole.bounds;
  const spectators:Spectator[]=placeSpectators(hole,region);
  grass(c,hole,true);
  // Landscape pockets stay clear of both the playing surface and the gallery.
  const rand=makeRand(seed^831);
  for(let i=0;i<160;i++) {
    const x=b.x+rand()*b.w,y=b.y+rand()*b.h,r=1+rand()*.85;
    if(pointInRegion(region,x,y)||distToWalls(hole,x,y)<r+2.8||spectators.some(p=>Math.hypot(p.x-x,p.y-y)<r+1.2))continue;
    tree(c,x,y,r,seed+i*41);
  }
  // A velvet rough collar makes the raised stone track sit in the landscape.
  c.lineJoin='round';c.strokeStyle='#1e603d';c.lineWidth=2.6;traceRegion(c,region);c.stroke();
  c.save();traceRegion(c,region);c.clip('evenodd');grass(c,hole,false);
  crest(c,hole.tee.x,hole.tee.y-5);
  hole.surfaceZones.forEach((z,i)=>drawSurfaceZone(c,z,seed+i*7));
  hole.slopeZones.forEach(z=>drawSlopeZone(c,z));
  hole.hazards.forEach((h,i)=>drawHazard(c,h,seed+i));
  // Directional wall shadows and contact shading are clipped to the fairway.
  c.save();c.translate(.25,.65);c.lineWidth=1.9;c.strokeStyle='#06332e35';traceRegion(c,region);c.stroke();c.restore();
  c.lineWidth=.85;c.strokeStyle='#1a57363b';traceRegion(c,region);c.stroke();c.restore();
  drawTee(c,hole.tee.x,hole.tee.y,ballR);
  hole.obstacles.forEach((o,i)=>{if(!isMoving(o))drawObstacle(c,o,seed+31*i);});
  // Glazed porcelain retains the true cup center/radius and familiar game identity.
  c.save();c.shadowColor='#002a3266';c.shadowBlur=8;c.shadowOffsetY=4;drawCup(c,hole.cup.x,hole.cup.y,cupR);c.restore();
  walls(c,hole.walls);
  // Warm corner illumination; no vignette over the player's aiming line.
  const light=c.createLinearGradient(b.x,b.y,b.x+b.w,b.y+b.h);
  light.addColorStop(0,'#ffef9910');light.addColorStop(.6,'#ffffff00');light.addColorStop(1,'#073c3c18');
  c.fillStyle=light;c.fillRect(b.x,b.y,b.w,b.h);
  return {animated:[],region,spectators};
}
