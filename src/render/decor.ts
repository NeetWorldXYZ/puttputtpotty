/** Top-down furnishings, kept within the decorative 2.3-unit placement envelope. */
import type { PropKind } from './themes';
import { circle, chunky, ellipse, roundRectPath } from './shapes';
import { finishMaterial } from './materials';

export function drawFurnishing(ctx: CanvasRenderingContext2D, kind: PropKind): boolean {
  const panel = (x:number,y:number,w:number,h:number,color:string,r=0.2) => {
    roundRectPath(ctx,x,y,w,h,r);chunky(ctx,color,0.12);
    ctx.save();ctx.clip();finishMaterial(ctx,{x,y,w,h},'metal');ctx.restore();
  };
  const screw = (x:number,y:number) => { circle(ctx,x,y,0.065);ctx.fillStyle='#284152';ctx.fill(); };
  switch(kind) {
    case 'stallDoor':
      panel(-1.3,-1.9,2.6,3.8,'#6e9da6');
      panel(-1.05,-1.62,2.1,3.24,'#a4c5c7');
      panel(-1.42,-1.3,0.27,0.6,'#d5e3e5',0.05);panel(-1.42,0.8,0.27,0.6,'#d5e3e5',0.05);
      panel(0.67,-0.2,0.2,0.55,'#f2ece0',0.05);
      circle(ctx,0.75,-0.53,0.13);chunky(ctx,'#ee675d',0.05);
      return true;
    case 'dispenser':
    case 'sensor':
      panel(-0.85,-1.3,1.7,2.6,'#e8eeee',0.3);
      panel(-0.6,-1,1.2,1.3,'#afcdd6',0.1);
      panel(-0.4,0.65,0.8,0.2,'#23374b',0.03);
      ctx.fillStyle='#45d3bc';ctx.fillRect(-0.22,-0.7,0.44,0.55);
      return true;
    case 'towel':
      panel(-1.4,-1.5,2.8,3,'#d6e5e8',0.25);
      panel(-1.25,-1.45,2.5,2.55,'#fff8ea',0.18);
      ctx.strokeStyle='#6fbbc0';ctx.lineWidth=0.14;ctx.beginPath();
      ctx.moveTo(-1.1,0.52);ctx.lineTo(1.1,0.52);ctx.moveTo(-1.1,0.78);ctx.lineTo(1.1,0.78);ctx.stroke();
      return true;
    case 'suitcase':
      panel(-1.1,-1.5,2.2,3,'#ec7359',0.3);
      panel(-0.5,-1.87,1,0.35,'#365366',0.1);
      for(const x of [-0.65,0,0.65]) {ctx.strokeStyle='#9e413f';ctx.lineWidth=0.08;ctx.beginPath();ctx.moveTo(x,-1.2);ctx.lineTo(x,1.2);ctx.stroke();}
      panel(-1.1,1.35,0.4,0.4,'#23374b',0.12);panel(0.7,1.35,0.4,0.4,'#23374b',0.12);
      return true;
    case 'crackedMirror':
      panel(-1.35,-1.8,2.7,3.6,'#71849d',0.3);
      panel(-1.12,-1.55,2.24,3.1,'#b2dbe2',0.2);
      ctx.strokeStyle='#f4fcff';ctx.lineWidth=0.13;ctx.beginPath();ctx.moveTo(-0.8,-0.55);ctx.lineTo(0.6,-1.2);ctx.stroke();
      ctx.strokeStyle='#59768f';ctx.lineWidth=0.07;ctx.beginPath();ctx.moveTo(-0.5,-1.5);ctx.lineTo(0.12,-0.3);ctx.lineTo(-0.2,0.4);ctx.lineTo(0.8,1.5);ctx.moveTo(-0.2,0.4);ctx.lineTo(-1.1,0.7);ctx.stroke();
      return true;
    case 'bottle':
      panel(-0.52,-0.85,1.04,2.3,'#348b79',0.3);
      panel(-0.24,-1.5,0.48,0.8,'#27645c',0.13);
      panel(-0.28,-1.6,0.56,0.25,'#ddbb65',0.06);
      panel(-0.4,-0.05,0.8,0.78,'#f8e9c7',0.04);return true;
    case 'goldTap':
      circle(ctx,0,0.6,0.65);chunky(ctx,'#bf8d39',0.1);
      panel(-0.22,-1.15,0.44,1.85,'#e5bd59');
      panel(-0.2,-1.3,1.18,0.42,'#ffe3a1');
      screw(0,0.6);return true;
    case 'doily':
    case 'knitCover':
      ellipse(ctx,0,0,1.75,1.5);chunky(ctx,kind==='doily'?'#f7ebcf':'#ce849e',0.1);
      ctx.save();ctx.clip();finishMaterial(ctx,{x:-1.75,y:-1.5,w:3.5,h:3},'fabric');
      ctx.strokeStyle=kind==='doily'?'#c0b39d':'#905878';ctx.lineWidth=0.07;
      for(let y=-1.3;y<1.5;y+=0.3){ctx.beginPath();ctx.moveTo(-1.7,y);ctx.lineTo(1.7,y);ctx.stroke();}ctx.restore();return true;
    case 'potpourri':
      ellipse(ctx,0,0,1.45,1.1);chunky(ctx,'#e9d5ad',0.12);
      ellipse(ctx,0,0,1.15,0.8);chunky(ctx,'#81506a',0.08);
      for(let i=0;i<7;i++){const a=i*2.4;ellipse(ctx,Math.cos(a)*0.7,Math.sin(a)*0.5,0.3,0.17);ctx.fillStyle=i%2?'#c3a38d':'#c4808b';ctx.fill();}return true;
    default:return false;
  }
}
