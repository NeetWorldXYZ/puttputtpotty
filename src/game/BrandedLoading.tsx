import { useEffect, useState } from 'react';
import { TabBar, type Tab } from './TabBar';
import './BrandedLoading.css';

const scenes = [
  { title: 'CHASE THE CROWN', tip: 'Three holes. One throne. Lowest score rules.', tag: 'YOUR NEXT REIGN STARTS HERE' },
  { title: 'GOOD PUTTS. BETTER DUMPS.', tip: 'Tied on strokes? The faster round takes the throne.', tag: 'A LITTLE PUTT. A LOT OF GLORY.' },
  { title: 'MAKE YOUR DAILY COUNT', tip: 'One daily course attempt. Make every putt count.', tag: 'SAME COURSE. EVERYBODY COMPETES.' },
];
const labels: Record<Tab, string> = { play: 'Opening your kingdom', map: 'Finding the thrones', match: 'Getting match ready', leaders: 'Gathering the rankings', profile: 'Getting your golfer ready' };

export function BrandedLoading({ page, label }: { page: Tab; label?: string }) {
  const [scene, setScene] = useState(() => Math.floor(Math.random() * scenes.length));
  useEffect(() => {
    const timer = window.setInterval(() => setScene(i => (i + 1) % scenes.length), 3500);
    return () => window.clearInterval(timer);
  }, []);
  const current = scenes[scene];
  return <div className="pp-loading">
    <main className="pp-loading-content">
      <img className="pp-loading-logo" src="/art/arcade-logo.webp" alt="Putt Putt Potty" width="300" height="150" />
      <div className="pp-loading-stage" aria-hidden="true">
        <div className="pp-loading-orbit" />
        <img className="pp-loading-mascot" src="/art/results/par-mascot-v2.webp" alt="" width="640" height="640" />
        <span className="pp-loading-star star-one">✦</span><span className="pp-loading-star star-two">✦</span>
      </div>
      <div className="pp-loading-copy" key={scene}>
        <span className="pp-loading-eyebrow">{current.tag}</span>
        <h1>{current.title}</h1>
        <p>{current.tip}</p>
      </div>
      <div className="pp-loading-track" aria-hidden="true"><i /></div>
      <div className="pp-loading-status" role="status">{label ?? labels[page]}<span aria-hidden="true">…</span></div>
    </main>
    <TabBar active={page} />
  </div>;
}
