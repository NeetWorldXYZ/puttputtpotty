import { useEffect, useState } from 'react';
import { PlayView } from './PlayView';
import type { Hole } from '../sim/types';
import crownFalls from './crownFalls.json';
import { DEFAULT_PARAMS } from '../sim/params';
import { FALLS_ART, prepareFallsArt } from '../render/crownFalls';
import { invalidateStaticLayers } from '../render/drawHole';
import { loadGameplaySprites } from '../render/sprites';
import './GraphicsPreview.css';

// Both art styles receive exactly the same course and the existing physics.
const HOLES = [crownFalls as Hole];
export function GraphicsPreview() {
  const [style, setStyle] = useState<'classic'|'tour'>('tour');
  const [round, setRound] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    let active=true;setFailed(false);setReady(false);
    void Promise.all([prepareFallsArt(),loadGameplaySprites()]).then(()=>{
      if(active){invalidateStaticLayers();setReady(true);}
    }).catch(()=>{if(active)setFailed(true);});
    return ()=>{active=false;};
  },[attempt]);
  return <div className={`tour-preview falls-preview tour-${style}`}>
    <header className="tour-topbar">
      <div className="tour-brand"><span aria-hidden="true">♛</span><div><strong>CROWN FALLS</strong><small>PUTT PUTT POTTY · GRAPHICS LAB</small></div></div>
      {playing ? <div className="tour-switch" role="group" aria-label="Compare graphics">
        <button aria-pressed={style==='classic'} onClick={()=>setStyle('classic')}>Original</button>
        <button aria-pressed={style==='tour'} onClick={()=>setStyle('tour')}>Revamp</button>
      </div> : <span className="falls-par">1 HOLE <b>PAR {crownFalls.par}</b></span>}
    </header>
    {ready ? playing ? <PlayView key={round} holes={HOLES} visualStyle={style} lockedParams={DEFAULT_PARAMS} onExit={()=>{setPlaying(false);setRound(r=>r+1);}} exitLabel="Course overview"/> : <main className="falls-intro">
      <img src={FALLS_ART} alt="Crown Falls: a winding porcelain and gold golf course, waterfalls, a crown bumper, a plunger and spectators in a lush garden."/>
      <div className="falls-intro-copy"><span>THE ROYAL GARDENS</span><h1>Welcome to<br/>Crown Falls.</h1><p>A new look. Same putting feel.</p><button onClick={()=>setPlaying(true)}>PLAY THIS HOLE <span aria-hidden="true">→</span></button></div>
    </main> : <div className="tour-preparing" role="status"><div><span className="falls-loading-crown" aria-hidden="true">♛</span><p>{failed?'The garden couldn’t load.':'Opening the royal gardens…'}</p>{failed&&<button onClick={()=>setAttempt(n=>n+1)}>Try again</button>}</div></div>}
    <footer className="tour-note"><span>SEPARATE PREVIEW</span> Your live game is unchanged.</footer>
  </div>;
}
