import type {Spectator} from '../render/spectators';
import {pointInRegion,type Region} from '../render/region';
const shirts=['#328ed1','#ee796c','#e1ad4b','#36a58b','#9272c9','#347591'];
const skins=['#ffe0ae','#d99f72','#ac704f','#704630','#e9b794'];
const portraits=new Map<string,HTMLCanvasElement|OffscreenCanvas>();
function portrait(v:number,wave:boolean,cheer:boolean,phase:number){
 const key=`${v%60}:${wave}:${cheer}:${phase}`;let out=portraits.get(key);if(out)return out;
 out=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(72,104):Object.assign(document.createElement('canvas'),{width:72,height:104});
 const c=out.getContext('2d') as CanvasRenderingContext2D;c.scale(40,40);c.translate(.9,1.45);
 const color=shirts[v%6],skin=skins[v%5],t=phase?Math.PI/10:-Math.PI/10;
 c.save();c.fillStyle='#031e324b';c.beginPath();c.ellipse(.06,.75,.57,.18,0,0,Math.PI*2);c.fill();
  c.strokeStyle='#072536';c.lineWidth=.085;
  c.fillStyle='#163043';c.beginPath();c.roundRect(-.33,.36,.27,.36,.06);c.roundRect(.08,.36,.27,.36,.06);c.fill();c.stroke();
  c.fillStyle='#e7f0e9';c.beginPath();c.roundRect(-.4,.64,.35,.15,.08);c.roundRect(.07,.64,.36,.15,.08);c.fill();c.stroke();
  const g=c.createLinearGradient(-.4,-.25,.4,.55);g.addColorStop(0,color);g.addColorStop(1,'#16445d');
  c.fillStyle=g;c.beginPath();c.moveTo(-.28,-.25);c.lineTo(-.51,.15);c.lineTo(-.32,.31);c.lineTo(-.3,.48);c.quadraticCurveTo(0,.6,.35,.48);c.lineTo(.36,.24);c.lineTo(.53,.11);c.lineTo(.27,-.25);c.closePath();c.fill();c.stroke();
  c.strokeStyle=color;c.lineWidth=.19;c.beginPath();c.moveTo(-.36,-.08);c.lineTo(-.57,wave?-.6:.25);c.moveTo(.36,-.08);c.lineTo(.58,wave?-.5+Math.sin(t*5+v)*.08:.24);c.stroke();
  c.fillStyle=skin;c.strokeStyle='#072536';c.lineWidth=.075;for(const [x,y]of[[-.57,wave?-.6:.25],[.58,wave?-.5+Math.sin(t*5+v)*.08:.24]]){c.beginPath();c.arc(x,y,.12,0,Math.PI*2);c.fill();c.stroke();}
  c.fillStyle='#f4cd64';c.beginPath();c.moveTo(-.12,.15);c.lineTo(-.16,-.01);c.lineTo(-.04,.06);c.lineTo(0,-.04);c.lineTo(.08,.06);c.lineTo(.17,0);c.lineTo(.12,.15);c.closePath();c.fill();
  c.fillStyle=skin;c.beginPath();if(v%3===0)c.roundRect(-.32,-.94,.64,.72,.22);else c.ellipse(0,-.57,v%3===1?.35:.31,.39,0,0,Math.PI*2);c.fill();c.stroke();
  c.fillStyle=v%4===0?'#c39652':v%4===1?'#322a28':'#593d2e';
  if(v%3!==2){c.beginPath();c.moveTo(-.32,-.65);c.quadraticCurveTo(-.39,-1.04,.02,-1.01);c.quadraticCurveTo(.35,-1.01,.34,-.63);c.lineTo(.2,-.8);c.lineTo(.04,-.75);c.lineTo(-.18,-.84);c.closePath();c.fill();}
  if(v%4===0||v%4===2){c.fillStyle=color;c.beginPath();c.ellipse(0,-.88,.37,.17,0,Math.PI,Math.PI*2);c.lineTo(.38,-.87);c.lineTo(-.38,-.87);c.closePath();c.fill();c.stroke();c.fillStyle=color;c.beginPath();c.roundRect(-.42,-.89,.52,.095,.04);c.fill();c.stroke();}
  c.fillStyle='#092637';if(v%4===1){c.beginPath();c.roundRect(-.25,-.63,.21,.14,.04);c.roundRect(.04,-.63,.21,.14,.04);c.fill();c.fillRect(-.04,-.6,.08,.04);}else{for(const x of[-.13,.13]){c.beginPath();c.ellipse(x,-.59,.045,.055,0,0,Math.PI*2);c.fill();}}
  c.beginPath();if(cheer){c.ellipse(0,-.37,.1,.08,0,0,Math.PI*2);c.fill();}else{c.moveTo(-.11,-.4);c.quadraticCurveTo(0,-.28,.12,-.4);c.stroke();}c.restore();
 portraits.set(key,out);return out;
}

/** Same graphic vocabulary as the golfer: compact hoodies, sneakers and expressive human faces. */
export function drawBathroomCrowd(c:CanvasRenderingContext2D,people:Spectator[],region:Region,t:number,cheer:boolean,quiet:boolean,view:{left:number;right:number;top:number;bottom:number},scale:number){
 c.save();c.lineJoin='round';c.lineCap='round';
 for(const p of people){
  if(p.x<view.left-1||p.x>view.right+1||p.y<view.top-2||p.y>view.bottom+2)continue;
  const v=p.variant+p.group%9,wave=cheer||(Math.floor(t/5)+v)%13===0;
  const bounce=quiet?0:Math.sin(t*(cheer?8:1.6)+v*1.7)*(cheer?.12:.025);
  c.drawImage(portrait(v,wave,cheer,quiet?0:Math.floor(t*3+v)%2),p.x-.9,p.y+bounce-1.45,1.8,2.6);
 }
 if(!quiet&&people.length&&t>2&&t%11<2.4){const phrases=['FLUSH IT!','GET IN!','OH, SHIT!','NICE PUTT!','SEND IT!'];const text=cheer?'LET’S GO!':phrases[Math.floor(t/11)%phrases.length];const fs=Math.max(.65,10/scale);c.font=`900 ${fs}px sans-serif`;const w=c.measureText(text).width+.6,h=fs+.5;
  for(let j=0;j<people.length;j++){const p=people[(Math.floor(t/11)*7+j)%people.length],x=p.x-w/2,y=p.y-h-1.25;if(x<view.left+.4||x+w>view.right-.4||y<view.top+.3||y+h>view.bottom)continue;let safe=true;for(let xx=x;xx<=x+w;xx+=.3)for(let yy=y;yy<=y+h;yy+=.3)if(pointInRegion(region,xx,yy))safe=false;if(!safe)continue;c.fillStyle='#ffebae';c.strokeStyle='#072536';c.lineWidth=.1;c.beginPath();c.roundRect(x,y,w,h,.2);c.fill();c.stroke();c.fillStyle='#072536';c.textAlign='center';c.textBaseline='middle';c.fillText(text,p.x,y+h/2);break;}
 }
 c.restore();
}
