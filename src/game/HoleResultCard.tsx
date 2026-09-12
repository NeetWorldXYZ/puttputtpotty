import { useId, type ReactNode } from 'react';
import './HoleResultCard.css';

export function HoleResultCard({ score, strokes, par, sunk, holeIndex, holeCount, children }: {
  score: number; strokes: number; par: number; sunk: boolean;
  holeIndex: number; holeCount: number; children: ReactNode;
}) {
  const id = useId();
  const delta = score - par;
  const ace = sunk && strokes === 1;
  const tone = !sunk ? 'cap' : ace ? 'ace' : delta <= -3 ? 'albatross' : delta === -2 ? 'eagle' : delta === -1 ? 'birdie' : delta === 0 ? 'par' : 'over';
  const title = !sunk ? 'STROKE CAP' : ace ? 'ACE!' : delta <= -3 ? 'ALBATROSS!' : delta === -2 ? 'EAGLE!' : delta === -1 ? 'BIRDIE!' : delta === 0 ? 'PAR' : delta === 1 ? 'BOGEY' : delta === 2 ? 'DOUBLE BOGEY' : delta === 3 ? 'TRIPLE BOGEY' : `+${delta} OVER PAR`;
  const line = !sunk ? 'Shake it off. Fresh green ahead.' : ace ? 'One shot. Straight to royalty.' : delta <= -3 ? 'A rare bird. A royal round.' : delta === -2 ? 'Two under. Crown-worthy.' : delta === -1 ? 'One under. Keep it rolling.' : delta === 0 ? 'Right on the money.' : 'Flush it. On to the next.';
  const celebrate = ace || (sunk && delta < 0);
  return <div className={`overlay hr-overlay hr-${tone}`}>
    <section className="card hr-card" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      {celebrate && <div className="hr-sparks" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ left: `${6 + i * 8}%`, top: `${12 + (i % 4) * 15}%`, transform: `rotate(${i * 31}deg)` }}/>)}</div>}
      <div className="hr-eyebrow">{ace ? 'HOLE IN ONE' : celebrate ? 'ROYAL SHOT' : 'HOLE COMPLETE'}<span>HOLE {holeIndex + 1} / {holeCount}</span></div>
      <div className="hr-medal" aria-hidden="true">
        <svg viewBox="0 0 200 140" fill="none">
          <path d="m59 85-18 45 27-8 14 13 14-44m45-6 18 45-27-8-14 13-14-44" fill="#1689ae" stroke="#042438" strokeWidth="5"/>
          <circle cx="100" cy="65" r="56" fill="#062b43" stroke="var(--hr-accent)" strokeWidth="5"/>
          <circle cx="100" cy="65" r="47" fill="#104d67" stroke="#ffffff35" strokeWidth="2"/>
          <ellipse cx="101" cy="94" rx="36" ry="12" fill="#28b68a" stroke="#042438" strokeWidth="4"/>
          <ellipse cx="109" cy="94" rx="13" ry="4" fill="#032435"/>
          <path d="M109 92V39l31 12-31 12" fill="#ff5969" stroke="#042438" strokeWidth="5" strokeLinejoin="round"/>
          <path d="M109 41v50" stroke="#e3f6ff" strokeWidth="3"/>
          <circle cx="83" cy="86" r="13" fill="#f5fcff" stroke="#042438" strokeWidth="3"/>
          <path d="m77 83 3 1m6-4 2 2m-6 6 2 2m-7 1 2 1" stroke="#b6cfdf" strokeWidth="3" strokeLinecap="round"/>
          <path d="m76 27-5-19 17 8 12-14 12 14 17-8-5 19Z" fill="#ffdb51" stroke="#042438" strokeWidth="4" strokeLinejoin="round"/>
          {celebrate && <path d="m24 40 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm150-8 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#fff0a1"/>}
        </svg>
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
