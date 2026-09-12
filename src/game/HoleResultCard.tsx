import { useId, type ReactNode } from 'react';
import './HoleResultCard.css';
import { HoleResultArt } from './HoleResultArt';

export function HoleResultCard({ score, strokes, par, sunk, holeIndex, holeCount, children }: {
  score: number; strokes: number; par: number; sunk: boolean;
  holeIndex: number; holeCount: number; children: ReactNode;
}) {
  const id = useId();
  const delta = score - par;
  const ace = sunk && strokes === 1;
  const tone = !sunk ? 'cap' : ace ? 'ace' : delta <= -3 ? 'albatross' : delta === -2 ? 'eagle' : delta === -1 ? 'birdie' : delta === 0 ? 'par' : delta === 1 ? 'over' : delta === 2 ? 'double' : 'triple';
  const title = !sunk ? 'STROKE CAP' : ace ? 'ACE!' : delta <= -3 ? 'ALBATROSS!' : delta === -2 ? 'EAGLE!' : delta === -1 ? 'BIRDIE!' : delta === 0 ? 'PAR' : delta === 1 ? 'BOGEY' : delta === 2 ? 'DOUBLE BOGEY' : delta === 3 ? 'TRIPLE BOGEY' : `+${delta} OVER PAR`;
  const line = !sunk ? 'Shake it off. Fresh green ahead.' : ace ? 'One shot. Straight to royalty.' : delta <= -3 ? 'A rare bird. A royal round.' : delta === -2 ? 'Two under. Crown-worthy.' : delta === -1 ? 'One under. Keep it rolling.' : delta === 0 ? 'Right on the money.' : 'Flush it. On to the next.';
  const celebrate = ace || (sunk && delta < 0);
  return <div className={`overlay hr-overlay hr-${tone}${delta > 0 ? ' hr-over' : ''}`}>
    <section className="card hr-card" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      {celebrate && <div className="hr-sparks" aria-hidden="true">{Array.from({ length: ace ? 32 : tone === 'albatross' ? 22 : tone === 'eagle' ? 16 : 8 }, (_, i) => <i key={i} style={{ left: `${4 + (i * 17) % 92}%`, top: `${5 + (i * 13) % 80}%`, transform: `rotate(${i * 31}deg)` }}/>)}</div>}
      <div className="hr-eyebrow">{ace ? 'HOLE IN ONE' : celebrate ? 'ROYAL SHOT' : 'HOLE COMPLETE'}<span>HOLE {holeIndex + 1} / {holeCount}</span></div>
      <div className="hr-medal" aria-hidden="true">
        <HoleResultArt tone={tone}/>
      </div>
      <h2 id={`${id}-title`} className={title.length > 11 ? 'hr-long-title' : ''}>{title}</h2>
      <p className="hr-tagline">{line}</p>
      <div className="hr-score-strip">
        <div><strong>{strokes}</strong><small>STROKES</small></div>
        <div><strong>{par}</strong><small>PAR</small></div>
        <div className="hr-relative"><strong>{delta === 0 ? 'E' : delta > 0 ? `+${delta}` : delta}</strong><small>TO PAR</small></div>
      </div>
      {!sunk && <p className="hr-cap-note">Stroke cap reached · recorded score {score}</p>}
      <div className="hr-progress" aria-label={`${holeIndex + 1} of ${holeCount} holes completed`}>{Array.from({ length: holeCount }, (_, i) => <i key={i} className={i < holeIndex ? 'complete' : i === holeIndex ? 'current' : ''}/>)}</div>
      <div className="hr-actions">{children}</div>
    </section>
  </div>;
}
