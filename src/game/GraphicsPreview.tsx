import { useEffect, useState } from 'react';
import { PlayView } from './PlayView';
import type { Hole } from '../sim/types';
import previewCourse from './previewCourse.json';
import { DEFAULT_PARAMS } from '../sim/params';
import { prepareTourArt } from '../render/tour';
import { invalidateStaticLayers } from '../render/drawHole';
import { loadGameplaySprites } from '../render/sprites';
import './GraphicsPreview.css';

// Prebuilt, solver-validated holes: no network or generation delay on the preview.
// Both renderers share this exact geometry; switching art never remounts the simulation.
const HOLES = previewCourse as Hole[];
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
      <div className="tour-brand"><span aria-hidden="true">♛</span><div><strong>THE CROWN CLASSIC</strong><small>3-HOLE OBSTACLE PREVIEW</small></div></div>
      <div className="tour-switch" role="group" aria-label="Compare graphics">
        <button aria-pressed={style==='classic'} onClick={()=>setStyle('classic')}>Current</button>
        <button aria-pressed={style==='tour'} onClick={()=>setStyle('tour')}>Upgraded</button>
      </div>
    </header>
    {ready ? <PlayView key={round} holes={HOLES} visualStyle={style} lockedParams={DEFAULT_PARAMS} onExit={()=>setRound(r=>r+1)} exitLabel="Restart preview"/> : <div className="tour-preparing" role="status">Preparing the green…</div>}
    <footer className="tour-note"><span>PREVIEW ONLY</span> 3 holes. Same physics. Your live game is safe.</footer>
  </div>;
}
