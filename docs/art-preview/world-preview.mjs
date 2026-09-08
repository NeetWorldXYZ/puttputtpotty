// Run from repository root with @napi-rs/canvas and esbuild installed.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {buildSync}=require('esbuild');
const code=`export { drawHole } from './src/render/drawHole';export {fitCamera} from './src/render/camera';export {loadGameplaySprites} from './src/render/sprites';export {drawCup,drawObstacle} from './src/render/objects';export {COURSE} from './src/holes';export {THEMES} from './src/render/themes';export {drawProp} from './src/render/props';export {drawHazard,drawSurfaceZone,drawMover} from './src/render/objects';export {DEFAULT_PARAMS,cupRadius} from './src/sim/params';`;
const built=buildSync({stdin:{contents:code,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,define:{'import.meta.env.BASE_URL':'"/"'}});
const mod={exports:{}};
function OffscreenCanvas(w,h){return createCanvas(w,h);}
new Function('module','exports','OffscreenCanvas',built.outputFiles[0].text)(mod,mod.exports,OffscreenCanvas);
const {drawHole,fitCamera,loadGameplaySprites,drawCup,drawObstacle,drawHazard,drawSurfaceZone,drawMover,drawProp,THEMES,COURSE,DEFAULT_PARAMS,cupRadius}=mod.exports;
await loadGameplaySprites('public/art/gameplay/',loadImage);

const c=createCanvas(1200,1840),ctx=c.getContext('2d');ctx.fillStyle='#13283e';ctx.fillRect(0,0,c.width,c.height);
ctx.fillStyle='#fff4d6';ctx.font='bold 28px sans-serif';ctx.fillText('PUTT PUTT POTTY / THE ROOM COLLECTION',24,42);
ctx.font='16px sans-serif';ctx.fillText('Actual course renderer. Same layout, twelve environments. Gameplay geometry unchanged.',24,69);
for(let i=0;i<THEMES.length;i++){
 const theme=THEMES[i], x=20+(i%4)*295,y=95+Math.floor(i/4)*575;
 const hole=structuredClone(COURSE[1]);hole.theme=theme.id;hole.id=COURSE[1].id+'-art-'+theme.id;
 const before=JSON.stringify(hole);const tile=createCanvas(275,525);
 drawHole(tile.getContext('2d'),hole,fitCamera(hole.bounds,275,525,8),{ballRadius:DEFAULT_PARAMS.ballRadius,cupRadius:cupRadius(DEFAULT_PARAMS),ball:hole.tee,time:1.2});
 if(before!==JSON.stringify(hole))throw new Error('Renderer mutated course');
 ctx.drawImage(tile,x,y);ctx.fillStyle='#fff4d6';ctx.font='bold 18px sans-serif';ctx.fillText(theme.name,x,y+550);
}
writeFileSync('docs/art-preview/world-rooms.png',c.toBuffer('image/png'));
const d=createCanvas(1200,1200),dc=d.getContext('2d');dc.fillStyle='#13283e';dc.fillRect(0,0,1200,1200);dc.fillStyle='#fff4d6';dc.font='bold 26px sans-serif';dc.fillText('MATERIALS, FIXTURES & OBSTACLES / ACTUAL RENDERER',24,40);
const poly=[{x:-3,y:-2},{x:3,y:-2},{x:3,y:2},{x:-3,y:2}];
const entries=[
['Ceramic blocker',()=>drawObstacle(dc,{type:'blocker',shape:{kind:'rect',x:-3,y:-2,w:6,h:4}},4)],
['Rubber dead wall',()=>drawObstacle(dc,{type:'deadWall',shape:{kind:'rect',x:-3,y:-2,w:6,h:4}},4)],
['Caution curb',()=>drawObstacle(dc,{type:'curb',shape:{kind:'rect',x:-3,y:-1,w:6,h:2}},4)],
['Porcelain sink',()=>drawProp(dc,{kind:'sink',x:0,y:0,r:0,seed:4})],
['Janitor bucket',()=>drawProp(dc,{kind:'mopBucket',x:0,y:0,r:0,seed:4})],
['Resort plant',()=>drawProp(dc,{kind:'palm',x:0,y:0,r:0,seed:4})],
...['water','drain','pit','overflow','outOfBounds'].map(type=>[type,()=>drawHazard(dc,{type,polygon:poly},4)]),
...['tile','shag','wet','sand','sticky'].map(surfaceType=>[surfaceType,()=>drawSurfaceZone(dc,{surfaceType,polygon:poly},4)]),
['Windmill',()=>drawMover(dc,{type:'windmill',shape:{kind:'circle',x:0,y:0,r:2.5},phase:0,direction:1,period:5,blades:3,bladeWidth:.7},1)],
['Plunger',()=>drawObstacle(dc,{type:'post',shape:{kind:'circle',x:0,y:0,r:1}},4)],
['Paper roll',()=>drawObstacle(dc,{type:'bumper',shape:{kind:'circle',x:0,y:0,r:1.5}},4)],
['Goal',()=>drawCup(dc,0,0,1)],
];
entries.forEach(([label,draw],i)=>{const x=20+(i%4)*295,y=65+Math.floor(i/4)*225;dc.fillStyle='#39765f';dc.fillRect(x,y,275,205);dc.save();dc.translate(x+137,y+100);dc.scale(20,20);draw();dc.restore();dc.fillStyle='#fff4d6';dc.font='bold 16px sans-serif';dc.fillText(label,x+12,y+192);});
writeFileSync('docs/art-preview/world-items.png',d.toBuffer('image/png'));
console.log('Rendered 12 rooms and 20 item samples; course mutation checks passed.');
