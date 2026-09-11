import { useId, useState } from 'react';
import { Avatar } from './Avatar';
import { DEFAULT_AVATAR, FACES, HATS, SEATS, avatarPartSvg, headTones, type Avatar as Look } from './avatarParts';
import { EARNABLE_HEADS, type EarnableHead } from './earnedHeads';
import './HeadGallery.css';

function Head({ look }: {look:Look}) {
  const id=useId(), art=avatarPartSvg(look,'head',id);
  return <svg viewBox="20 10 120 116" aria-hidden="true" dangerouslySetInnerHTML={{__html:art.markup}}/>;
}

/** Isolated artwork review. No sign-in, API requests, equipping, or reward mutations. */
export function HeadGallery() {
  const [selected,setSelected]=useState<EarnableHead>('bubble');
  const [look,setLook]=useState<Look>({...DEFAULT_AVATAR,head:'bubble',seat:'blue'});
  const [inspect,setInspect]=useState(false);
  const item=EARNABLE_HEADS[selected];
  const choose=(key:EarnableHead)=>{
    setSelected(key);setLook({...DEFAULT_AVATAR,head:key,seat:EARNABLE_HEADS[key].shirt});setInspect(true);
  };
  return <main className="head-gallery">
    <header className="hg-intro"><p>PUTT PUTT POTTY · THE EARNED COLLECTION</p><h1>GOOD LOOKS.<br/><em>EARNED, NOT GIVEN.</em></h1><span>{Object.keys(EARNABLE_HEADS).length} new heads. Your same golfer. A little more personality.</span><small>Collection preview · Milestones are live and permanent.</small></header>
    <div className="hg-grid">{(Object.keys(EARNABLE_HEADS) as EarnableHead[]).map((key,index)=>{
      const h=EARNABLE_HEADS[key];
      return <button className={`hg-card hg-${key}`} key={key} onClick={()=>choose(key)} aria-label={`Inspect ${h.label}`}>
        <div className="hg-topline"><span>NO. {String(index+1).padStart(2,'0')}</span><span>{h.metric==='points'?'LEVEL REWARD':h.metric==='places'||h.metric==='thrones'?'MAP REWARD':'SKILL & PLAY'}</span></div>
        <div className="hg-art"><Head look={{...DEFAULT_AVATAR,head:key}}/></div>
        <h2>{h.label}</h2><p>{h.blurb}</p><div className="hg-rule"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5Z"/><path d="M12 14v3"/></svg><span>{h.requirement}</span></div>
        <span className="hg-inspect">TRY HATS & COLOURS <b>↗</b></span>
      </button>;
    })}</div>
    <footer className="hg-foot">Permanent unlocks. No TP spent. Your five starter heads stay free.<br/><small>These are the actual vector portraits, not concept images.</small></footer>
    {inspect&&<div className="hg-overlay" onClick={()=>setInspect(false)}><section className="hg-inspector" role="dialog" aria-modal="true" aria-labelledby="hg-selected" onClick={e=>e.stopPropagation()} onKeyDown={e=>{
      if(e.key==='Escape')setInspect(false);
      if(e.key==='Tab'){
        const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button,select'));
        if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items[items.length-1]?.focus();}
        else if(!e.shiftKey&&document.activeElement===items[items.length-1]){e.preventDefault();items[0]?.focus();}
      }
    }}>
      <button className="hg-close" autoFocus aria-label="Close inspection" onClick={()=>setInspect(false)}>×</button>
      <p className="hg-eyebrow">ACTUAL IN-GAME ART</p><h2 id="hg-selected">{item.label}</h2>
      <div className="hg-portrait"><Avatar av={look} size={240}/></div>
      <p className="hg-blurb">{item.blurb}</p>
      <div className="hg-controls">{([
        ['hat','Hat',Object.entries(HATS)],['face','Face',Object.entries(FACES)],
        ['seat','Shirt',Object.entries(SEATS).map(([k,v])=>[k,v.label])],
        ['porcelain','Colour',Object.entries(headTones(look.head)).map(([k,v])=>[k,v.label])],
      ] as [keyof Look,string,string[][]][]).map(([key,label,options])=><label key={key}>{label}<select value={look[key]} onChange={e=>setLook({...look,[key]:e.target.value})}>{options.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>)}</div>
      <div className="hg-small"><span>LEADERBOARD SIZE</span><Avatar av={look} size={32}/><Avatar av={look} size={44}/><Avatar av={look} size={60}/></div>
      <p className="hg-requirement">{item.requirement}</p><small>Preview only. This does not change your saved avatar.</small>
    </section></div>}
  </main>;
}
