// Run from repository root; requires @napi-rs/canvas and esbuild.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {createCanvas}=require('@napi-rs/canvas');
const {buildSync}=require('esbuild');
const bundle=buildSync({entryPoints:['src/render/objects.ts'],bundle:true,platform:'node',format:'cjs',write:false});
const mod={exports:{}};new Function('module','exports',bundle.outputFiles[0].text)(mod,mod.exports);
const {drawCup,drawBall,drawObstacle}=mod.exports;
const canvas=createCanvas(1000,620),ctx=canvas.getContext('2d');
ctx.fillStyle='#14283f';ctx.fillRect(0,0,1000,620);ctx.fillStyle='#fff7dd';ctx.font='bold 30px sans-serif';ctx.fillText('PUTT PUTT POTTY / COURSE ART',35,50);ctx.fillStyle='#b5ced8';ctx.font='16px sans-serif';ctx.fillText('Actual renderer output / presentation-only first pass',35,80);
const items=[['Porcelain goal',()=>drawCup(ctx,0,0,1)],['Golf ball',()=>drawBall(ctx,0,0,1)],['Plunger post',()=>drawObstacle(ctx,{type:'post',shape:{kind:'circle',x:0,y:0,r:1}},1)],['Paper-roll bumper',()=>drawObstacle(ctx,{type:'bumper',shape:{kind:'circle',x:0,y:0,r:1.3}},1)]];
items.forEach(([name,draw],i)=>{const x=35+(i%3)*325,y=115+Math.floor(i/3)*245;ctx.fillStyle='#33885e';ctx.beginPath();ctx.roundRect(x,y,300,218,16);ctx.fill();ctx.save();ctx.translate(x+150,y+109);ctx.scale(21,21);draw();ctx.restore();ctx.fillStyle='#fff7dd';ctx.font='bold 17px sans-serif';ctx.fillText(name,x+16,y+197);});
writeFileSync('docs/art-preview/course-art.png',canvas.toBuffer('image/png'));
