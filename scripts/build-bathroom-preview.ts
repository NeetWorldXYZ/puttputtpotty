/** Offline fixture builder. Runtime random rounds use course.worker.ts. */
import {writeFileSync} from 'node:fs';
import {generateHole} from '../src/generator/generator';
import {BATH_THEMES} from '../src/preview/themes';
import {dressHole} from '../src/preview/course';
import {solveHole} from '../src/solver/solver';
import {replay,validateHole,type Hole} from '../src/sim';
import {COURSE} from '../src/holes';
const plans=[['lBend','chamber'],['dogleg','sCurve'],['splitPath','bottleneck'],['loopAround','zFold'],['funnel','cross'],['ring','forkMerge']] as const;
const names=[['Paper Chase','Royal Treatment'],['Sticky Situation','Service Station'],['Home Advantage','Vent Session'],['Afterparty','Last Call'],['Porta Power','The Queue'],['Airlock Ace','Mission Flush']];
const holes:Hole[]=[];const solutions=[];
function accept(h:Hole){const r=solveHole(h);if(!validateHole(h).ok||!r.accepted||!r.bestRun){console.log('Retry',h.name,r.rejectReasons.join(';'));return false;}h.par=r.par!;const s=replay(h,1,r.bestRun.solution).state;if(!s.sunk)throw Error('Replay failed: '+h.name);holes.push(h);solutions.push({id:h.id,strokes:r.bestRun.solution,score:s.strokes});console.log(h.name,h.par,h.obstacles.map(o=>o.type).join(','));return true;}
for(let t=0;t<BATH_THEMES.length;t++)for(let j=0;j<2;j++){
 let okay=false;
 for(let retry=0;retry<8&&!okay;retry++){
  const g=generateHole({seed:`bathroom-rebuild-v1:${t}:${j}:${retry}`,archetype:plans[t][j],difficulty:j===0?'easy':'medium'});
  if(!g.report.accepted)continue;
  const h=dressHole(g.hole,BATH_THEMES[t].id,holes.length);h.name=names[t][j];okay=accept(h);
 }
 if(!okay)throw Error('No playable layout for '+names[t][j]);
}
const tunnel:Hole=JSON.parse(JSON.stringify(COURSE[2]));tunnel.id='pipe-dream';tunnel.name='Pipe Dream';tunnel.obstacles.push({type:'pipe',shape:{kind:'circle',x:23.5,y:86,r:1.4},exit:{x:7,y:23},mode:'redirect',exitAngle:-Math.PI/2});if(!accept(dressHole(tunnel,'night',12)))throw Error('Tunnel rejected');
const ramp:Hole={version:1,id:'rise-and-flush',name:'Rise & Flush',par:2,bounds:{x:0,y:0,w:30,h:50},tee:{x:15,y:41},cup:{x:15,y:10},walls:[],surfaceZones:[{surfaceType:'sticky',polygon:[{x:6,y:35},{x:10,y:35},{x:10,y:39},{x:6,y:39}]}],slopeZones:[{direction:'N',grade:1,polygon:[{x:6,y:26},{x:24,y:26},{x:24,y:33},{x:6,y:33}]}],hazards:[{type:'water',penalty:1,resetTo:'lastSafe',polygon:[{x:20,y:12},{x:24,y:12},{x:24,y:19},{x:20,y:19}]}],obstacles:[{type:'post',shape:{kind:'circle',x:10,y:20,r:1}},{type:'bumper',shape:{kind:'circle',x:19,y:24,r:1.3}}]};
const p=[{x:5,y:4},{x:25,y:4},{x:25,y:46},{x:5,y:46}];ramp.walls=p.map((a,i)=>({a,b:p[(i+1)%4]}));if(!accept(dressHole(ramp,'royal',13)))throw Error('Ramp rejected');
writeFileSync('src/preview/coursePool.json',JSON.stringify(holes,null,2)+'\n');writeFileSync('src/preview/courseSolutions.json',JSON.stringify(solutions,null,2)+'\n');
