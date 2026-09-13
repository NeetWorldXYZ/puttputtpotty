import {useEffect,useRef,type ReactNode} from 'react';
import type {Hole} from '../sim/types';
import {drawHole} from '../render/drawHole';
import {DEFAULT_PARAMS,cupRadius} from '../sim/params';
import {prop,type PropName} from './art';
export function Icon({name,size=24}:{name:string;size?:number}){const paths:Record<string,ReactNode>={
 crown:<path d="m3 8 4 3 5-7 5 7 4-3-3 12H6Z M6 17h12"/>,
 home:<><path d="m3 11 9-8 9 8M6 10v11h5v-6h3v6h4V10"/></>,
 match:<><path d="m5 3 14 18M19 3 5 21M3 17l4 4M17 21l4-4"/><circle cx="12" cy="20" r="2"/></>,
 map:<><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16"/><circle cx="15" cy="9" r="2"/></>,
 trophy:<><path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 14v6M7 21h10"/></>,
 profile:<><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3Z"/></>,
 flag:<><path d="M6 21V3l13 5-13 5"/><path d="M3 21h9"/></>,
 random:<><path d="m3 5 4 0 10 14h4M3 19h4l10-14h4m-3-3 3 3-3 3m0 8 3 3-3 3"/></>,
 gear:<><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></>,
 arrow:<path d="M3 12h17m-7-7 7 7-7 7"/>,
 close:<path d="m5 5 14 14M19 5 5 19"/>,
 sound:<><path d="m3 9 5 0 6-5v16l-6-5H3ZM18 8q5 4 0 8"/></>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
 check:<path d="m4 12 5 5L21 4"/>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]??paths.crown}</svg>;
}
export function PropIcon({name,size=80}:{name:PropName;size?:number}){const ref=useRef<HTMLCanvasElement>(null);useEffect(()=>{const c=ref.current!.getContext('2d')!;c.clearRect(0,0,size*2,size*2);prop(c,name,0,0,size*2,size*2);},[name,size]);return <canvas ref={ref} width={size*2} height={size*2} style={{width:size,height:size}} aria-hidden="true"/>;}
export function CourseThumb({hole}:{hole:Hole}){const ref=useRef<HTMLCanvasElement>(null);useEffect(()=>{const c=ref.current!.getContext('2d')!,s=Math.min(480/hole.bounds.w,620/hole.bounds.h);drawHole(c,hole,{scale:s,ox:(480-hole.bounds.w*s)/2,oy:(620-hole.bounds.h*s)/2},{ballRadius:DEFAULT_PARAMS.ballRadius,cupRadius:cupRadius(DEFAULT_PARAMS),ball:hole.tee,time:3,dpr:1,reducedMotion:true});},[hole]);return <canvas className="br-course-thumb" ref={ref} width="480" height="620" aria-label={`${hole.name} course layout`}/>;}
export function Dialog({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){const ref=useRef<HTMLDivElement>(null);useEffect(()=>{const old=document.activeElement as HTMLElement|null;ref.current?.querySelector<HTMLElement>('button,input')?.focus();const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=oldOverflow;old?.focus();};},[]);return <div className="br-overlay" onClick={onClose}><section ref={ref} className={`br-dialog ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const els=Array.from(ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a[href]'));if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els[els.length-1]?.focus();}else if(!e.shiftKey&&document.activeElement===els[els.length-1]){e.preventDefault();els[0]?.focus();}}}}><header><div><span className="br-kicker">PUTT PUTT POTTY</span><h2>{title}</h2></div><button className="br-circle" onClick={onClose} aria-label="Close"><Icon name="close"/></button></header>{children}</section></div>;}
