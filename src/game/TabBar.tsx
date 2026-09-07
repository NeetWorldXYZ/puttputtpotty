import { navigate } from '../router';
import { sfx, unlockAudio } from './sound';
import './TabBar.css';
import { MatchIcon } from './MatchIcon';

export type Tab = 'play' | 'map' | 'match' | 'leaders' | 'profile';

/** Navigation-only artwork; the icons elsewhere in the game stay unchanged. */
function NavIcon({ tab }: { tab: Tab }) {
  if (tab === 'match') return <MatchIcon />;
  const art = {
    play: <><path d="M10 23h28v21H10Z" fill="#f6efdc"/><path d="m5 24 19-17 19 17-5 5-14-12-14 12Z" fill="#59cd83"/><path d="M19 44V31h10v13" fill="#327d74"/><path d="M30 8V3h10l-10 6" fill="#ffca47"/><path d="M14 25h5m11 0h5" stroke="#fff" strokeWidth="2"/></>,
    map: <><path d="m4 14 13-5 14 5 13-5v32l-13 5-14-5-13 5Z" fill="#f9edc8"/><path d="M17 10v31l14 5V15Z" fill="#66cd9a"/><path d="m7 33 8-8 9 5 13-11" stroke="#429b8c" strokeWidth="3" strokeDasharray="3 4"/><path d="M33 7c-6 0-9 4-9 8 0 7 9 14 9 14s9-7 9-14c0-4-3-8-9-8Z" fill="#ffd24c"/><circle cx="33" cy="15" r="3" fill="#15384b"/></>,
    leaders: <><path d="M14 10H5v7q0 12 12 12m17-19h9v7q0 12-12 12" fill="#eea937"/><path d="M13 6h22v15q0 12-11 12T13 21Z" fill="#ffdb62"/><path d="M24 33v8" stroke="#ffdc65" strokeWidth="7"/><path d="M14 40h20v5H14Z" fill="#f4ae3e"/><path d="m24 12 3 5 5 1-4 4 1 5-5-3-5 3 1-5-4-4 5-1Z" fill="#fff3bc" strokeWidth="1.5"/></>,
    profile: <><path d="M8 43q0-13 16-13t16 13Z" fill="#67bfce"/><circle cx="24" cy="24" r="10" fill="#fff0cf"/><path d="m12 17-3-11 9 5 6-8 6 8 9-5-3 11Z" fill="#ffd34b"/><path d="M20 26q4 4 8 0" fill="none" strokeWidth="2"/></>,
  };
  return <svg viewBox="0 0 48 48" fill="none" stroke="#092b40" strokeWidth="2.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{art[tab]}</svg>;
}
const TABS: { tab: Tab; label: string }[] = [
  {tab:'play',label:'Home'}, {tab:'map',label:'Map'}, {tab:'match',label:'Match'},
  {tab:'leaders',label:'Ranks'}, {tab:'profile',label:'Profile'},
];

/** Stable destinations on every menu screen. Gameplay retains its own controls. */
export function TabBar({ active }: { active: Tab }) {
  const go = (tab: Tab) => {
    unlockAudio();
    if (tab === active) return;
    sfx.tap();
    navigate(tab);
  };
  return <nav className="tabbar arcade-dock" aria-label="Main">
    {TABS.map(({tab,label}) => <button key={tab} className={active === tab ? 'on' : ''} aria-current={active === tab ? 'page' : undefined} onClick={() => go(tab)}>
      <span className={`dock-icon dock-${tab}`}><NavIcon tab={tab}/></span>
      <span className="dock-label">{label}</span>
    </button>)}
  </nav>;
}
