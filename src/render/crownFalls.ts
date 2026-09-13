/** Custom scene renderer for the isolated Crown Falls art-direction prototype.
 * Background and collision geometry share a 1024 × 1536 coordinate space.
 */
import type { Hole } from '../sim/types';
let artwork: HTMLImageElement | undefined;
let loading: Promise<void> | undefined;
export const FALLS_ART = '/art/crown-falls/course.webp';
export function prepareFallsArt(): Promise<void> {
  if (artwork) return Promise.resolve();
  return loading ??= (async () => {
    const image = new Image(); image.src = FALLS_ART;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([image.decode(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Artwork timeout')),12000);})]);
      artwork=image;
    } catch (error) { loading=undefined; image.src=''; throw error; }
    finally { clearTimeout(timer); }
  })();
}
export function paintFalls(ctx:CanvasRenderingContext2D,hole:Hole,cupR:number):boolean {
  if (!artwork) return false;
  const b=hole.bounds;ctx.drawImage(artwork,b.x,b.y,b.w,b.h);
  drawFallsCup(ctx,hole.cup.x,hole.cup.y,cupR);
  return true;
}
/** Porcelain seat, recessed opening and gold lid: the dark opening is the real cup. */
export function drawFallsCup(c:CanvasRenderingContext2D,x:number,y:number,r:number,flash=0) {
  c.save();c.translate(x,y);
  c.fillStyle='#163d3970';c.beginPath();c.ellipse(.14,.27,r*1.7,r*1.38,0,0,Math.PI*2);c.fill();
  const lid=c.createLinearGradient(0,-r*3,0,-r);
  lid.addColorStop(0,'#fffdf0');lid.addColorStop(.5,'#eee9d6');lid.addColorStop(1,'#adad91');
  c.fillStyle=lid;c.strokeStyle='#bea166';c.lineWidth=.08;
  c.beginPath();c.roundRect(-r*1.25,-r*2.7,r*2.5,r*1.8,.24);c.fill();c.stroke();
  c.fillStyle='#d4a941';c.beginPath();c.moveTo(-.29,-r*1.65);c.lineTo(-.36,-r*2.14);c.lineTo(-.12,-r*1.94);c.lineTo(0,-r*2.28);c.lineTo(.12,-r*1.94);c.lineTo(.36,-r*2.14);c.lineTo(.29,-r*1.65);c.closePath();c.fill();
  const seat=c.createLinearGradient(-r,-r,r,r);
  seat.addColorStop(0,'#ffffff');seat.addColorStop(.45,'#fffcea');seat.addColorStop(1,'#abae91');
  c.fillStyle=seat;c.strokeStyle='#e2c071';c.lineWidth=.09;c.beginPath();c.ellipse(0,0,r*1.52,r*1.34,0,0,Math.PI*2);c.fill();c.stroke();
  const bowl=c.createRadialGradient(0,.18,.05,0,0,r);
  bowl.addColorStop(0,flash?'#52d9de':'#143e42');bowl.addColorStop(.68,'#123139');bowl.addColorStop(1,'#527e78');
  c.fillStyle=bowl;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill();
  c.strokeStyle='#ffffffaa';c.lineWidth=.065;c.beginPath();c.ellipse(0,-.02,r*1.32,r*1.14,0,Math.PI,Math.PI*1.9);c.stroke();
  if(flash){c.globalAlpha=flash*.5;c.strokeStyle='#ffdc73';c.lineWidth=.08;c.beginPath();c.arc(0,0,r*(1.9+1-flash),0,Math.PI*2);c.stroke();}
  c.restore();
}
const ponds = [
  [[265,281],[403,323],[511,370],[526,432],[405,481],[293,510],[205,448],[211,354]],
  [[601,694],[736,664],[807,750],[898,771],[923,939],[870,972],[766,933],[647,837],[505,787]],
] as const;
function polygon(c:CanvasRenderingContext2D,points:readonly (readonly number[])[]) {
  c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();
}
export function animateFalls(c:CanvasRenderingContext2D,time:number,cheer:boolean,reduced:boolean,aiming:boolean) {
  if(reduced)return;
  c.save();c.scale(30/1024,45/1536);
  // Delicate moving caustics and waterfall foam are confined to the illustrated water.
  for(let p=0;p<ponds.length;p++) {
    c.save();polygon(c,ponds[p]);c.clip();
    for(let i=0;i<15;i++) {
      const x=(p?566:250)+(i*61%250),y=(p?705:333)+(i*37%145);
      const phase=(time*.22+i*.17)%1;
      c.strokeStyle=`rgba(210,255,250,${Math.sin(phase*Math.PI)*.22})`;c.lineWidth=1.3;
      c.beginPath();c.ellipse(x,y,8+phase*28,3+phase*12,-.3,0,Math.PI*2);c.stroke();
    }
    c.restore();
  }
  // Waterfall streaks flow down the painted cascade faces, with no gameplay effect.
  for(const [x,y,w,h] of [[289,226,50,88],[870,702,35,80]]){
    for(let i=0;i<7;i++){
      const phase=(time*.72+i*.13)%1;c.strokeStyle=`rgba(238,255,253,${.10*Math.sin(phase*Math.PI)})`;c.lineWidth=2+i%2;
      c.beginPath();c.moveTo(x+i*w/7,y+phase*h);c.lineTo(x+i*w/7-3,y+phase*h+15);c.stroke();
    }
  }
  // Soft gold glint on the physical bumper, matching its illustrated top surface.
  c.save();c.translate(315,744);c.rotate(-.2);c.globalAlpha=.13+.09*Math.sin(time*1.6);c.strokeStyle='#fff6a8';c.lineWidth=2;c.beginPath();c.ellipse(0,0,30,25,0,Math.PI*1.1,Math.PI*1.8);c.stroke();c.restore();
  if(!aiming) {
    const phase=time%10;
    if(cheer || phase<2.8){
      const anchors=[[164,591],[861,199],[885,530],[178,1135]];
      const [x,y]=anchors[Math.floor(time/10)%anchors.length];
      const text=cheer?'CROWN-WORTHY!':['You got this!','Good putts!','Let it roll!','Chase the crown!'][Math.floor(time/10)%4];
      c.font='bold 17px sans-serif';const w=c.measureText(text).width+24;
      c.fillStyle='#072f35ee';c.strokeStyle='#efd07f';c.lineWidth=2;c.beginPath();c.roundRect(Math.max(6,Math.min(1018-w,x-w/2)),y-48,w,31,12);c.fill();c.stroke();
      c.fillStyle='#fff2c5';c.textAlign='center';c.fillText(text,Math.max(6,Math.min(1018-w,x-w/2))+w/2,y-27);
    }
  }
  c.restore();
}
/** The tall plunger handle occludes a ball that rolls behind it. Base collision stays circular. */
export function fallsForeground(c:CanvasRenderingContext2D) {
  if(!artwork)return;
  c.save();c.scale(30/1024,45/1536);
  polygon(c,[[717,359],[730,364],[748,281],[747,275],[737,272],[729,280]]);c.clip();
  c.drawImage(artwork,0,0,1024,1536);c.restore();
}
