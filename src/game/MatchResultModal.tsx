import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { api, fmtElapsed, type MatchRow } from '../net/api';
import type { Hole } from '../sim/types';
import { Avatar } from './Avatar';
import { resultAvatarSvg } from './avatarParts';
import { REACTIONS, useResultSocial } from './useResultSocial';
import './MatchResultModal.css';
import { ResultReaction } from './ResultReaction';

function Crown() {return <svg viewBox="0 0 56 48" aria-hidden="true"><path d="m6 11 12 10L28 4l10 17 12-10-5 30H11Z" fill="#ffda48" stroke="#b77c21" strokeWidth="2" strokeLinejoin="round"/><path d="m10 14 8 10L28 8l10 16 8-10" fill="none" stroke="#fff3a6" strokeWidth="3"/><path d="M12 43h32" stroke="#e7aa31" strokeWidth="5" strokeLinecap="round"/></svg>;}
function ActionIcon({kind}:{kind:'share'|'home'|'rematch'}) {return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='share'?<><path d="M10 13H6v16h20V13h-4M16 22V3m-6 6 6-6 6 6"/></>:kind==='home'?<><path d="m3 15 13-12 13 12M7 13v16h7v-9h5v9h6V13"/></>:<><path d="M5 12a12 12 0 0 1 21-4l2 3M28 3v8h-8M27 20a12 12 0 0 1-21 4l-2-3M4 29v-8h8"/></>}</svg>;}
const relative=(score:number|null,par:number)=>score===null?'—':score-par===0?'E':score-par>0?`+${score-par}`:String(score-par);

export function MatchResultModal({match,me,holes,onLeave,onEnter,friendAction}:{match:MatchRow;me:string;holes:Hole[];onLeave:()=>void;onEnter:(match:MatchRow)=>void;friendAction?:ReactNode}) {
  const side=match.p1===me?'p1':'p2',other=side==='p1'?'p2':'p1';
  const mood=match.winner===null?'draw':match.winner===me?'win':'loss';
  const won=mood==='win',lost=mood==='loss',score=match[`${side}_score`],par=holes.reduce((sum,h)=>sum+h.par,0);
  const opponent=match[`${other}_name`]||'Opponent';
  const [points,setPoints]=useState<number|null>(null),[pointsError,setPointsError]=useState(false),[revision,setRevision]=useState(0);
  const [shared,setShared]=useState(false),[shareError,setShareError]=useState('');
  const social=useResultSocial(match,me,onEnter);
  const dialog=useRef<HTMLDivElement>(null),closeRef=useRef(onLeave),id=useId().replace(/:/g,'');
  closeRef.current=onLeave;
  useEffect(()=>{
    let active=true;setPointsError(false);
    void api.profile(me).then(p=>{if(active){setPoints(typeof p?.points==='number'?p.points:null);setPointsError(typeof p?.points!=='number');}}).catch(()=>{if(active)setPointsError(true);});
    return()=>{active=false;};
  },[me,match.id,revision]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const root=dialog.current!;root.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();closeRef.current();}
      if(event.key!=='Tab')return;
      const items=[...root.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]')];
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===root)){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    root.addEventListener('keydown',key);return()=>{root.removeEventListener('keydown',key);previous?.focus();};
  },[]);
  const share=async(invite=false)=>{
    setShareError('');
    const text=invite?`Rematch me at Putt Putt Potty! Code ${social.pending?.code}`:`${won?'I won':lost?'A tough loss':'A dead heat'} at Putt Putt Potty! ${match[`${side}_name`]||'Me'}: ${score??'DNF'} vs ${opponent}: ${match[`${other}_score`]??'DNF'}. ${match.holes} holes, par ${par}.`;
    const url=invite?`${location.origin}/match?code=${social.pending?.code}`:location.origin;
    try{if(navigator.share)await navigator.share({title:'Putt Putt Potty',text,url});else await navigator.clipboard.writeText(`${text}\n${url}`);setShared(true);}catch(e){if((e as Error).name!=='AbortError')setShareError('Could not share. Please try again.');}
  };
  const subtitle=match.forfeit?(won?'Opponent did not finish':'You did not finish'):mood==='draw'?'A dead heat!':score===null?'Round complete':score<par?'Under par!':score===par?'Even par!':won?'Crown secured!':'Rough round…';
  return <div className="mr-overlay">
    <div className={`mr-dialog mr-${mood}`} ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <button className="mr-close" aria-label="Close result and go home" onClick={onLeave}>×</button>
      <div className="mr-hero">
        <div className="mr-art" aria-hidden="true">
          {won&&<div className="mr-confetti">{Array.from({length:16},(_,i)=><i key={i} style={{left:`${(i*29)%100}%`,top:`${(i*17)%85}%`,background:['#ffe449','#49ebbc','#69caff','#ff7e97'][i%4],transform:`rotate(${i*37}deg)`,animationDelay:`${i*.07}s`}}/>)}</div>}
          {lost&&<svg className="mr-cloud" viewBox="0 0 180 120"><path d="M15 58Q0 25 35 24 47-8 78 15 108 0 125 28 165 16 169 51 191 77 154 81H31Q7 83 15 58" fill="#102439"/><g stroke="#8db1cb" strokeWidth="4" strokeLinecap="round" opacity=".7"><path d="m32 90-5 17m35-17-5 17m35-17-5 17m35-17-5 17m35-17-5 17"/></g></svg>}
          <svg className="mr-avatar" viewBox="-12 -15 202 210" dangerouslySetInnerHTML={{__html:resultAvatarSvg(match[`${side}_avatar`],mood,`result-${id}`)}}/>
        </div>
        <div className="mr-headline">
          <h1 id={`${id}-title`}>{won?'YOU WIN!':lost?'YOU LOSE!':'A DRAW!'}</h1>
          <p className="mr-subtitle">{subtitle}</p>
          <div className="mr-score">{score??'DNF'}{score!==null&&<small className={score<par?'mr-under':score>par?'mr-over':''}>{relative(score,par)}</small>}</div>
          <p className="mr-par">par {par}</p>
          <div className="mr-points"><Crown/><div>{points===null?(pointsError?<button onClick={()=>setRevision(n=>n+1)}>Retry points</button>:<strong aria-label="Loading points">…</strong>):<strong>{points.toLocaleString()}</strong>}<span>Throne Points <small>total</small></span></div></div>
        </div>
      </div>
      <div className="mr-scorecard" role="region" aria-label="Both players, hole by hole" tabIndex={0}>
        <table><thead><tr><th scope="col">HOLE</th>{Array.from({length:match.holes},(_,i)=><th scope="col" key={i}>{i+1}</th>)}</tr></thead>
        <tbody>{([side,other] as const).map(player=>{
          const own=player===side,name=own?'You':opponent;
          return <tr key={player}><th scope="row"><span><Avatar av={match[`${player}_avatar`]} size={24}/><b title={name}>{name}</b></span></th>{Array.from({length:match.holes},(_,i)=>{
            const n=match[`${player}_holes`]?.[i],p=holes[i]?.par;
            const cls=n===undefined?'':p!==undefined&&n<p?'mr-birdie':p!==undefined&&n>=p+3?'mr-bogey':'';
            return <td key={i}><span className={cls} title={`Hole ${i+1}: ${n===undefined?'not completed':`${n} strokes, par ${p}`}`}>{n??'—'}</span></td>;
          })}</tr>;
        })}</tbody></table>
      </div>
      <div className="mr-totals">{([side,other] as const).map(player=>{
        const total=match[`${player}_score`],elapsed=match[`${player}_elapsed_ms`];
        return <div key={player} className={player===side?'mr-you':''}>
          <Avatar av={match[`${player}_avatar`]} size={37}/>
          <span className="mr-total-name" title={player===side?'You':opponent}>{player===side?'You':opponent}<small>{elapsed===null?'Did not finish':fmtElapsed(elapsed)}</small></span>
          <strong>{total??'—'}<small className={(total??par)<par?'mr-under':(total??par)>par?'mr-over':''}>{relative(total,par)}</small></strong>
        </div>;
      })}</div>
      <div className="mr-reaction-area">
        <p className="mr-reaction-label">SEND A REACTION</p>
        <div className="mr-reactions">{REACTIONS.map((reaction,i)=><button key={reaction} className={`mr-reaction mr-reaction-${i}`} onClick={()=>void social.sendReaction(reaction)} aria-label={`React ${reaction}`}><ResultReaction index={i}/></button>)}</div>
        {social.reaction&&<div key={social.reaction.key} className="mr-reaction-pop" role="status">{social.reaction.from===me?'You':opponent}: <b>{social.reaction.text}</b></div>}
      </div>
      <button className="mr-rematch" disabled={social.busy||!!social.pending&&!social.offer} onClick={()=>void social.rematch()}><ActionIcon kind="rematch"/><span>{social.busy?'ONE MOMENT…':!match.code||match.p2_bot?'FIND ANOTHER MATCH':social.offer?`ACCEPT ${opponent.toUpperCase()}’S REMATCH`:social.pending?'REMATCH REQUESTED':`REMATCH ${opponent.toUpperCase()}`}</span></button>
      <div className="mr-social-status">{social.pending?<><span>Waiting for {opponent} · code {social.pending.code}</span><button onClick={()=>void share(true)}>Share invite</button><button onClick={social.cancel}>Cancel</button></>:!match.p2_bot?<span>{social.online?'Opponent is here':social.connected?'Opponent is away':'Connecting…'}</span>:null}</div>
      {(social.error||shareError)&&<p className="mr-error" role="alert">{social.error||shareError}</p>}
      <div className="mr-actions"><button onClick={()=>void share()}><ActionIcon kind="share"/>{shared?'Shared!':'Share Result'}</button><button onClick={onLeave}><ActionIcon kind="home"/>Home</button></div>
      {friendAction&&<div className="mr-friend">{friendAction}</div>}
      <p className="mr-footer">— &nbsp; GOOD GOLFERS MAKE BETTER FRIENDS &nbsp; — <Crown/></p>
    </div>
  </div>;
}
