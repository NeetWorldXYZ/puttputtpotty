import { navigate } from '../router';
import { sfx, unlockAudio } from './sound';

export type Tab = 'play' | 'map' | 'leaders';

/** The three places you can be: home, the map, the boards. */
export function TabBar({ active }: { active: Tab }) {
  const go = (t: Tab) => {
    unlockAudio();
    if (t === active) return;
    sfx.tap();
    navigate(t);
  };
  return (
    <nav className="tabbar" aria-label="Main">
      <button className={active === 'play' ? 'on' : ''} onClick={() => go('play')}>
        <span className="tb-icon">▶</span>
        <span>Play</span>
      </button>
      <button className={active === 'map' ? 'on' : ''} onClick={() => go('map')}>
        <span className="tb-icon">📍</span>
        <span>Map</span>
      </button>
      <button className={active === 'leaders' ? 'on' : ''} onClick={() => go('leaders')}>
        <span className="tb-icon">🏆</span>
        <span>Ranks</span>
      </button>
    </nav>
  );
}
