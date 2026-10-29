import { useEffect, useState } from 'react';
import { getAudio, isMuted, setMuted } from './sound';
import { startTheme, stopTheme } from './music';
import { getSavedAvatar, getSavedName, loadProfile } from '../net/supabase';
import { Avatar } from './Avatar';
import { AccountSheet } from './AccountSheet';
import './MenuControls.css';

/** Menu mounts share one idempotent music player. Unmounting a menu never restarts it. */
export function useMenuMusic() {
  useEffect(() => {
    const sync = () => {
      if (isMuted()) { stopTheme(); return; }
      const audio = getAudio();
      if (audio && !document.hidden) startTheme(audio.ctx, audio.master, .45);
    };
    sync();
    window.addEventListener('pointerdown', sync);
    window.addEventListener('keydown', sync);
    window.addEventListener('ppp:mutechange', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.removeEventListener('pointerdown', sync);
      window.removeEventListener('keydown', sync);
      window.removeEventListener('ppp:mutechange', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
}

export function MenuVolume() {
  const [muted, update] = useState(isMuted);
  useEffect(() => { const sync = () => update(isMuted()); window.addEventListener('ppp:mutechange',sync); return () => window.removeEventListener('ppp:mutechange',sync); }, []);
  return <button className="menu-volume" aria-label={muted ? 'Turn sound on' : 'Mute sound'} aria-pressed={muted} onClick={() => setMuted(!isMuted())}>
    <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h5l7-6v20l-7-6H5Z" fill="#ffd65c" stroke="#ffe9ad"/>{muted ? <path d="m23 12 6 8m0-8-6 8"/> : <><path d="M22 11q5 5 0 10"/><path d="M26 7q9 9 0 18"/></>}</svg>
  </button>;
}

export function GolferChip() {
  const [name, setName] = useState(getSavedName());
  const [avatar, setAvatar] = useState(getSavedAvatar());
  const [open, setOpen] = useState(false);
  useEffect(() => { let live=true; void loadProfile().then(p => { if(live && p) { setName(p.name); setAvatar(getSavedAvatar()); } }).catch(() => {});return () => {live=false;}; }, []);
  return <><button className="name-chip menu-golfer" onClick={() => setOpen(true)} aria-label="Your golfer and account"><Avatar av={avatar} size={24}/><span>{name ?? 'Your golfer'}</span></button>{open && <AccountSheet onClose={n => {setName(n);setAvatar(getSavedAvatar());setOpen(false);}}/>}</>;
}
