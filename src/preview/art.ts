import contours from './spriteContours.json';
export type PropName=keyof typeof contours;
export const ART='/art/bathroom-rebuild/';
let atlas:HTMLImageElement|undefined,tiles:HTMLImageElement|undefined;
let task:Promise<void>|undefined;
const tileCanvases=new Map<number,HTMLCanvasElement|OffscreenCanvas>();
async function load(src:string){const im=new Image();im.src=src;let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([im.decode(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Art load timeout')),15000);})]);return im;}finally{clearTimeout(timer);}}
export function prepareBathroomArt(){return task??=(async()=>{try{const [a,t]=await Promise.all([load(ART+'props.webp'),load(ART+'tiles.webp'),load(ART+'hero.webp')]);atlas=a;tiles=t;}catch(e){task=undefined;throw e;}})();}
export function prop(c:CanvasRenderingContext2D,name:PropName,x:number,y:number,w:number,h:number){
 if(!atlas)return;const shape=contours[name],r=shape.rect;
 c.save();c.translate(x,y);c.scale(w/r[2],h/r[3]);c.beginPath();shape.path.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.clip();c.drawImage(atlas,r[0],r[1],r[2],r[3],0,0,r[2],r[3]);c.restore();
}
export function tileMaterial(index:number){
 if(!tiles)return undefined;let out=tileCanvases.get(index);if(!out){out=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(512,512):Object.assign(document.createElement('canvas'),{width:512,height:512});const c=out.getContext('2d') as CanvasRenderingContext2D;c.drawImage(tiles,(index%3)*512,Math.floor(index/3)*512,512,512,0,0,512,512);tileCanvases.set(index,out);}return out;
}
