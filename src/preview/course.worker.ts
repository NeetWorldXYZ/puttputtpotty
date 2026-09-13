import { generateHole, courseSlots } from '../generator/generator';
import { dressHole, courseTheme } from './course';
import {replay,validateHole} from '../sim';
import type { BathThemeId } from './themes';
self.onmessage=(e:MessageEvent<{seed:string;count:number;theme?:BathThemeId}>)=>{
 const {seed,count,theme}=e.data;
 try{
  const holes=[];
  for(const slot of courseSlots(seed,count)){
   const g=generateHole({seed:slot.seed,archetype:slot.archetype,difficulty:slot.difficulty,maxAttempts:4});
   if(!g.report.accepted)throw Error('This layout needs another pass.');
   const dressed=dressHole(g.hole,courseTheme(slot.index,theme),slot.index);
   if(!g.report.bestRun||!validateHole(dressed).ok||!replay(dressed,1,g.report.bestRun.solution).state.sunk)throw Error('This route needs a fresh roll.');
   holes.push(dressed);
   self.postMessage({type:'progress',done:holes.length,total:count});
  }
  self.postMessage({type:'ready',holes});
 }catch(error){self.postMessage({type:'error',message:error instanceof Error?error.message:'Could not prepare this course.'});}
};
