// Run from repository root with @napi-rs/canvas and esbuild installed.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {buildSync}=require('esbuild');
const code=`export { drawHole } from './src/render/drawHole';export {fitCamera} from './src/render/camera';export {loadGameplaySprites} from './src/render/sprites';export {drawCup,drawObstacle} from './src/render/objects';export {COURSE} from './src/holes';export {DEFAULT_PARAMS,cupRadius} from './src/sim/params';`;
const built=buildSync({stdin:{contents:code,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,define:{'import.meta.env.BASE_URL':'"/"'}});
const mod={exports:{}};
function OffscreenCanvas(w,h){return createCanvas(w,h);}
new Function('module','exports','OffscreenCanvas',built.outputFiles[0].text)(mod,mod.exports,OffscreenCanvas);
const {drawHole,fitCamera,loadGameplaySprites,drawCup,drawObstacle,COURSE,DEFAULT_PARAMS,cupRadius}=mod.exports;
await loadGameplaySprites('public/art/gameplay/',loadImage);
const c=createCanvas(960,1000),ctx=c.getContext('2d');ctx.fillStyle='#14283f';ctx.fillRect(0,0,960,1000);
const hole=COURSE[2];const course=createCanvas(390,844);drawHole(course.getContext('2d'),hole,fitCamera(hole.bounds,390,844,12),{ballRadius:DEFAULT_PARAMS.ballRadius,cupRadius:cupRadius(DEFAULT_PARAMS),ball:hole.tee});ctx.drawImage(course,20,90);
ctx.fillStyle='#fff7dd';ctx.font='bold 25px sans-serif';ctx.fillText('SPRITE PILOT / ACTUAL 2D RENDERER',25,40);ctx.font='15px sans-serif';ctx.fillText('Left: shipped Two Stalls hole at phone size. Right: enlarged alignment check.',25,65);
const demos=[['Toilet goal',()=>drawCup(ctx,0,0,1)],['Plunger / contact ring',()=>{drawObstacle(ctx,{type:'post',shape:{kind:'circle',x:0,y:0,r:1}},1);ring();}],['Paper roll / contact ring',()=>{drawObstacle(ctx,{type:'bumper',shape:{kind:'circle',x:0,y:0,r:1}},1);ring();}]];
function ring(){ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.strokeStyle='#ffcf48';ctx.lineWidth=.035;ctx.setLineDash([.1,.1]);ctx.stroke();ctx.setLineDash([]);}
demos.forEach(([name,draw],i)=>{const y=110+i*275;ctx.fillStyle='#369367';ctx.fillRect(440,y,490,245);ctx.save();ctx.translate(680,y+140);ctx.scale(28,28);draw();ctx.restore();ctx.fillStyle='#fff7dd';ctx.font='18px sans-serif';ctx.fillText(name,455,y+227);});
writeFileSync('docs/art-preview/sprite-course.png',c.toBuffer('image/png'));
