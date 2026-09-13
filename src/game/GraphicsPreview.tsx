import { useEffect, useState } from 'react';
import { PlayView } from './PlayView';
import { COURSE } from '../holes';
import { DEFAULT_PARAMS } from '../sim/params';
import { prepareTourArt } from '../render/tour';
import { invalidateStaticLayers } from '../render/drawHole';
import { loadGameplaySprites } from '../render/sprites';
import './GraphicsPreview.css';

// Original, unedited course data. Switching artwork never remounts the simulation.
const HOLES = [COURSE[1]];
export function GraphicsPreview() {
  const [style, setStyle] = useState<'classic'|'tour'>('tour');
  const [round, setRound] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active=true;
    const reveal=()=>{if(active){invalidateStaticLayers();setReady(true);}};
    void Promise.allSettled([prepareTourArt(),loadGameplaySprites()]).then(reveal);
    const timer=window.setTimeout(reveal,5000);
    return ()=>{active=false;clearTimeout(timer);};
  },[]);
  return <div className={`tour-preview tour-${style}`}>
    <header className="tour-topbar">
      <div className="tour-brand"><span aria-hidden="true">♛</span><div><strong>THE CROWN CLASSIC</strong><small>PLAYABLE GRAPHICS PREVIEW</small></div></div>
      <div className="tour-switch" role="group" aria-label="Compare graphics">
        <button aria-pressed={style==='classic'} onClick={()=>setStyle('classic')}>Current</button>
        <button aria-pressed={style==='tour'} onClick={()=>setStyle('tour')}>Upgraded</button>
      </div>
    </header>
    {ready ? <PlayView key={round} holes={HOLES} visualStyle={style} lockedParams={DEFAULT_PARAMS} onExit={()=>setRound(r=>r+1)} exitLabel="Restart preview"/> : <div className="tour-preparing" role="status">Preparing the green…</div>}
    <footer className="tour-note"><span>PREVIEW ONLY</span> Same hole. Same physics. Your live game is safe.</footer>
  </div>;
}
