import { useId, useState } from 'react';
import { Avatar } from './Avatar';
import { DEFAULT_AVATAR, avatarPartSvg } from './avatarParts';
import { EARNABLE_BALLS, EARNABLE_SHIRTS } from '../../server/potty/cosmeticCatalog';
import './HeadGallery.css';
import './GearGallery.css';

function Gear({slot,value}:{slot:'ball'|'seat';value:string}){
  const id=useId(),art=avatarPartSvg({...DEFAULT_AVATAR,[slot]:value},slot,id);
  return <svg viewBox={art.viewBox} aria-hidden="true" dangerouslySetInnerHTML={{__html:art.markup}}/>;
}
/** Art-only gallery: no sign-in, reward claims, profile updates, or gameplay. */
export function GearGallery(){
  const [slot,setSlot]=useState<'ball'|'seat'>('ball');
  const [selected,setSelected]=useState({ball:'pearl',seat:'varsity'});
  const catalog=slot==='ball'?EARNABLE_BALLS:EARNABLE_SHIRTS;
  return <main className="head-gallery gear-gallery">
    <header className="hg-intro"><p>PUTT PUTT POTTY · THE EARNED COLLECTION</p><h1>GEAR WORTH<br/><em>PLAYING FOR.</em></h1><span>13 balls. 13 shirts. Every one earned.</span></header>
    <section className="gg-preview"><Avatar av={{...DEFAULT_AVATAR,...selected,hat:'crown'}} size={210}/><div><p>BUILD YOUR LOOK</p><h2>SHARP THREADS.<br/>SWEET ROLLS.</h2><span>Tap any design to try it on.<br/>This preview never changes your saved look.</span><div className="gg-tabs" role="group" aria-label="Gear category"><button aria-pressed={slot==='ball'} onClick={()=>setSlot('ball')}>BALLS · 13</button><button aria-pressed={slot==='seat'} onClick={()=>setSlot('seat')}>SHIRTS · 13</button></div></div></section>
    <div className="hg-grid">{Object.entries(catalog).map(([key,item],i)=><button key={key} className="hg-card gg-card" aria-pressed={selected[slot]===key} onClick={()=>setSelected(current=>({...current,[slot]:key}))}>
      <div className="hg-topline"><span>NO. {String(i+1).padStart(2,'0')}</span><span>{item.metric==='places'?'MAP REWARD':item.metric==='points'?'TP REWARD':'SKILL & PLAY'}</span></div><div className="hg-art"><Gear slot={slot} value={key}/></div><h2>{item.label}</h2><div className="hg-rule"><span>{item.requirement}</span></div><span className="hg-inspect">TRY IT ON <b>↗</b></span>
    </button>)}</div>
    <footer className="hg-foot">Your existing shirts and balls stay free. No TP is spent.<br/>Permanent unlocks. Identical ball physics.</footer>
  </main>;
}
