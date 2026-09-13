import {normalizeAvatar,type Avatar} from '../game/avatarParts';
import type {Hole} from '../sim/types';
import {dailyKey} from './course';
export const PREVIEW_KEY='ppp.bathroom-preview.v1';
export interface ResultHole {id:string;name:string;theme:string;par:number;score:number;strokes:number;sunk:boolean;}
export interface Round {id:string;title:string;mode:'tour'|'daily'|'practice'|'random'|'venue';date:string;started:number;holes:Hole[];scores:ResultHole[];bot?:number;}
export interface Result {id:string;title:string;mode:Round['mode'];date:string;finished:number;duration:number;holes:ResultHole[];bot?:number;}
export interface PreviewState {version:1;name:string;avatar:Avatar;results:Result[];active:Round|null;visits:string[];reduced:boolean;crowd:boolean;}
export function freshState():PreviewState{return{version:1,name:'KingKory',avatar:{head:'classic',porcelain:'white',seat:'ink',hat:'crown',face:'cool',ball:'white'},results:[],active:null,visits:[dailyKey()],reduced:false,crowd:true};}
export function loadState():PreviewState{try{const value=JSON.parse(localStorage.getItem(PREVIEW_KEY)??'null');if(value?.version!==1)return freshState();return{...freshState(),...value,avatar:normalizeAvatar(value.avatar),name:String(value.name||'KingKory').slice(0,18),results:Array.isArray(value.results)?value.results.filter((r:Result)=>r&&Array.isArray(r.holes)):[],visits:Array.isArray(value.visits)?value.visits.filter((s:unknown)=>typeof s==='string'):[]};}catch{return freshState();}}
export function visit(s:PreviewState,key=dailyKey()):PreviewState{return s.visits.includes(key)?s:{...s,visits:[...s.visits,key].slice(-365)};}
export function streak(visits:string[],today=dailyKey()){const days=new Set(visits);const d=new Date(today+'T12:00:00Z');if(!days.has(today))d.setUTCDate(d.getUTCDate()-1);let n=0;while(days.has(d.toISOString().slice(0,10))){n++;d.setUTCDate(d.getUTCDate()-1);}return n;}
export const total=(r:Pick<Result,'holes'>)=>r.holes.reduce((n,h)=>n+h.score,0);
export const relative=(r:Pick<Result,'holes'>)=>r.holes.reduce((n,h)=>n+h.score-h.par,0);
export const rel=(n:number)=>n===0?'E':n>0?`+${n}`:String(n);
export function stats(s:PreviewState){const holes=s.results.flatMap(r=>r.holes),practice=s.results.filter(r=>r.bot!==undefined);const wins=practice.filter(r=>total(r)<r.bot!).length,losses=practice.filter(r=>total(r)>r.bot!).length,draws=practice.length-wins-losses;const crowns=[...new Set(holes.filter(h=>h.sunk&&h.score<=h.par).map(h=>h.theme))];const aces=holes.filter(h=>h.sunk&&h.strokes===1).length;const xp=holes.length*15+aces*35+crowns.length*50+wins*40;return{holes:holes.length,rounds:s.results.length,wins,losses,draws,crowns,aces,xp,level:1+Math.floor(xp/200),streak:streak(s.visits)};}
/** Only complete rounds are recorded, exactly once; a daily edition has one entry. */
export function finishRound(s:PreviewState,round:Round,now=Date.now()):PreviewState{
 if(round.scores.length!==round.holes.length)return s;
 if(s.results.some(r=>r.id===round.id||(round.mode==='daily'&&r.mode==='daily'&&r.date===round.date)))return{...s,active:null};
 const result:Result={id:round.id,title:round.title,mode:round.mode,date:round.date,finished:now,duration:Math.max(0,now-round.started),holes:round.scores,bot:round.bot};return{...s,active:null,results:[result,...s.results]};
}
