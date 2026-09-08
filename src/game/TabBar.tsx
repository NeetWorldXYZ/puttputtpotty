import { navigate } from '../router';
import { sfx, unlockAudio } from './sound';
import { GameIcon } from './GameIcon';

export type Tab = 'play' | 'map' | 'match' | 'leaders' | 'profile';

/** Stable destinations on every menu screen. Gameplay retains its own controls. */
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
        <span className="tb-icon"><GameIcon kind="home" /></span>
        <span>Home</span>
      </button>
      <button className={active === 'map' ? 'on' : ''} onClick={() => go('map')}>
        <span className="tb-icon"><GameIcon kind="map" /></span>
        <span>Map</span>
      </button>
      <button className={active === 'match' ? 'on' : ''} onClick={() => go('match')}>
        <span className="tb-icon"><GameIcon kind="flag" /></span>
        <span>Match</span>
      </button>
      <button className={active === 'leaders' ? 'on' : ''} onClick={() => go('leaders')}>
        <span className="tb-icon"><GameIcon kind="trophy" /></span>
        <span>Ranks</span>
      </button>
      <button className={active === 'profile' ? 'on' : ''} onClick={() => go('profile')}>
        <span className="tb-icon"><GameIcon kind="crown" /></span>
        <span>Profile</span>
      </button>
    </nav>
  );
}
