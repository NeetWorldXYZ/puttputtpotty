import { useEffect, useRef, useState, type ReactNode } from 'react';
import { navigate } from '../router';
import { api, type ChallengeBoard } from '../net/api';
import { ensureSession, getSavedName, getSavedAvatar, loadProfile } from '../net/supabase';
import { loadRankedRecord, type RankedRecord } from '../net/rankedRecord';
import { COURSE_LENGTHS, dailySeed, getBest, getPreferredLength, goToCourse, secondsUntilNextDaily, setPreferredLength } from './courses';
import { sfx, unlockAudio } from './sound';
import { AccountSheet } from './AccountSheet';
import { Avatar } from './Avatar';
import { TabBar } from './TabBar';
import { MenuVolume } from './MenuControls';
import { ProfileStatIcon } from './ProfileStatIcon';
import { HomeCrown, HomeGear, HomePodium, HomePutters } from './HomeArtwork';
import { ChallengesSheet, claimable } from './ChallengesSheet';
import { checkProgress, type PromoEvent } from './progress';
import { PromoSheet } from './PromoSheet';
import './KingdomHome.css';

type DailyStanding = Awaited<ReturnType<typeof api.dailyStanding>>;
type Sheet = 'settings' | 'help' | 'custom' | null;
const relative = (n: number) => n === 0 ? 'E' : n > 0 ? `+${n}` : String(n);

function HomeSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items[items.length - 1]?.focus(); }
      if (!e.shiftKey && document.activeElement === items[items.length - 1]) { e.preventDefault(); items[0]?.focus(); }
    };
    panel?.addEventListener('keydown', key);
    return () => { panel?.removeEventListener('keydown', key); previous?.focus(); };
    // A sheet owns focus for its lifetime, independently of its changing content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div className="overlay kh-overlay" onClick={onClose}><div className="card kh-sheet" ref={ref} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}><header><h2>{title}</h2><button aria-label="Close" onClick={onClose}>×</button></header>{children}</div></div>;
}

export function TitleScreen() {
  const [name, setName] = useState(getSavedName);
  const [avatar, setAvatar] = useState(getSavedAvatar);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [account, setAccount] = useState(false);
  const [len, setLen] = useState(getPreferredLength);
  const [thrones, setThrones] = useState<number | null>(null);
  const [record, setRecord] = useState<RankedRecord | null>(null);
  const [board, setBoard] = useState<ChallengeBoard | null>(null);
  const [promo, setPromo] = useState<PromoEvent | null>(null);
  const [challenges, setChallenges] = useState(false);
  const [seed, setSeed] = useState(dailySeed);
  const [seconds, setSeconds] = useState(secondsUntilNextDaily);
  const [refresh, setRefresh] = useState(0);
  const [daily, setDaily] = useState<{ seed: string; standing: DailyStanding; error: boolean } | null>(null);

  useEffect(() => {
    const tick = () => { setSeed(dailySeed()); setSeconds(secondsUntilNextDaily()); };
    const visible = () => { if (!document.hidden) { tick(); setRefresh(n => n + 1); } };
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      const session = await ensureSession().catch(() => null);
      if (!active || !session) return;
      await Promise.allSettled([
        loadProfile().then(p => { if (active && p) { setName(p.name); setAvatar(getSavedAvatar()); } }),
        api.profile(session.user.id).then(p => { if (active && p) { setThrones(p.thrones); setPromo(checkProgress(p)); } }),
        loadRankedRecord(session.user.id).then(r => { if (active) setRecord(r); }),
        api.challenges().then(b => { if (active) setBoard(b); }),
      ]);
    })();
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    void api.dailyStanding(seed).then(standing => { if (active) setDaily({ seed, standing, error: false }); }).catch(() => { if (active) setDaily({ seed, standing: null, error: true }); });
    return () => { active = false; };
  }, [seed, refresh]);

  const current = daily?.seed === seed ? daily : null;
  const standing = current?.standing ?? null;
  const best = getBest(seed);
  const played = standing !== null || best !== null;
  const untilNext = `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
  const go = (fn: () => void, sound: 'tap' | 'whoosh' = 'tap') => { unlockAudio(); sfx[sound](); fn(); };
  const openDaily = () => {
    if (played) go(() => navigate(standing ? 'leaders' : 'play', seed));
    else if (current?.error) { setDaily(null); setRefresh(n => n + 1); }
    else go(() => goToCourse('daily'), 'whoosh');
  };
  const dailyDescription = played ? `${standing ? relative(standing.total - standing.par) : best} ${standing ? `· #${standing.rank}` : 'strokes'}. Next course in ${untilNext}. View daily rankings.` : current?.error ? 'Could not check your daily round. Tap to retry.' : !current ? 'Checking your round…' : 'Play today to join the leaderboard.';

  return <div className="kingdom-home" onPointerDown={unlockAudio}>
    <main className="kh-content">
      <section className="kh-hero" aria-labelledby="kh-title">
        <img className="kh-hero-art" src={`${import.meta.env.BASE_URL}art/home-kingdom-city.webp`} alt="" draggable={false} fetchPriority="high" />
        <h1 id="kh-title" className="kh-sr">Putt Putt Potty. Take over real bathrooms near you.</h1>
        <p className="kh-sr">Explore bars, restaurants, rest areas, hotels, and more. Beat the course record to claim their throne.</p>
        <header className="kh-tools">
          <button className="kh-settings" aria-label="Settings" onClick={() => go(() => setSheet('settings'))}><HomeGear/>{claimable(board) > 0 && <span className="kh-notification" aria-label="Challenges ready to claim"/>}</button>
          <button className="kh-kingdom" aria-label={`Your kingdom${name ? `, ${name}` : ''}${thrones !== null ? `, ${thrones} thrones held` : ''}`} onClick={() => go(() => navigate('profile'))}>
            <span className="kh-portrait"><Avatar av={avatar} size={42}/></span><span className="kh-kingdom-copy"><strong>Your Kingdom</strong><span><HomeCrown/><b>{thrones ?? '–'}</b></span></span><span className="kh-chevron" aria-hidden="true">›</span>
          </button>
        </header>
      </section>
      <div className="kh-actions">
        <button className="kh-map" onClick={() => go(() => navigate('map'), 'whoosh')}>OPEN THRONE MAP <span aria-hidden="true">➜</span></button>
        <section className="kh-secondary" aria-label="More ways to play">
          <button className={`kh-card kh-daily${played ? ' kh-played' : ''}`} onClick={openDaily} disabled={!played && !current} aria-label={`Daily course. ${dailyDescription}`}>
            <span className="kh-card-icon"><ProfileStatIcon kind="win"/></span><span className="kh-card-copy"><strong>{played ? 'DAILY RESULTS' : 'DAILY COURSE'}</strong><span>{played ? (standing ? 'Your round is in.' : 'Round saved on device · sync incomplete.') : current?.error ? 'Tap to retry your daily status.' : !current ? 'Checking your round…' : 'Play today to join the leaderboard.'}</span></span><span className="kh-chevron" aria-hidden="true">›</span>
            {played ? <span className="kh-daily-result"><b>{standing ? relative(standing.total - standing.par) : best}</b><span>{standing ? `#${standing.rank} on the board` : 'strokes · view results'}<small>Next in {untilNext}</small></span></span> : <HomePodium/>}
          </button>
          <button className="kh-card kh-quick" onClick={() => go(() => navigate('match'), 'whoosh')}>
            <span className="kh-card-icon"><HomePutters/></span><span className="kh-card-copy"><strong>QUICK MATCH</strong><span>Ranked 1v1.<br/>Prove your skills.</span></span><span className="kh-chevron" aria-hidden="true">›</span>
            <span className="kh-record"><HomeCrown/>{record ? <><b>{record.wins} – {record.losses}</b><small>ALL TIME{record.draws > 0 ? ` · ${record.draws}D` : ''}</small></> : <small>YOUR RANKED RECORD</small>}</span>
          </button>
        </section>
      </div>
    </main>
    <TabBar active="play"/>
    {sheet === 'settings' && <HomeSheet title="Settings" onClose={() => setSheet(null)}><div className="kh-sound-row"><span><strong>Game sound</strong><small>Music and sound effects</small></span><MenuVolume/></div><button onClick={() => { setSheet(null); setAccount(true); }}>Your golfer & account <span>›</span></button><button onClick={() => setSheet('help')}>How to play <span>›</span></button><button onClick={() => { setSheet(null); setChallenges(true); }}>Challenges <span>{claimable(board) > 0 ? `${claimable(board)} ready` : '›'}</span></button><button onClick={() => setSheet('custom')}>Custom practice round <span>›</span></button></HomeSheet>}
    {sheet === 'help' && <HomeSheet title="Claim your kingdom" onClose={() => setSheet(null)}><ol><li><strong>Open the map.</strong> Discover real bathrooms around you.</li><li><strong>Visit and play.</strong> Get within 50 m and play the bathroom’s three-hole course.</li><li><strong>Take the crown.</strong> Fewest strokes wins. Round time breaks ties. Hold the throne until someone beats you.</li></ol><p>Daily Course is a shared nine-hole challenge. A new course opens at noon and midnight Eastern. Quick Match pairs you with an opponent on the same nine holes.</p><button className="primary" onClick={() => go(() => navigate('map'), 'whoosh')}>Open throne map →</button></HomeSheet>}
    {sheet === 'custom' && <HomeSheet title="Custom practice" onClose={() => setSheet(null)}><p>Choose your round length.</p><div className="kh-lengths">{COURSE_LENGTHS.map(l => <button key={l.n} aria-pressed={l.n === len} onClick={() => { setLen(l.n); setPreferredLength(l.n); sfx.select(); }}>{l.label}<small>holes</small></button>)}</div><button className="primary" onClick={() => go(() => goToCourse('random', len), 'whoosh')}>Tee off · {len} holes</button></HomeSheet>}
    {account && <AccountSheet onClose={n => { setName(n); setAvatar(getSavedAvatar()); setAccount(false); setRefresh(v => v + 1); }}/>}
    {promo && <PromoSheet event={promo} onClose={() => setPromo(null)}/>}
    {challenges && <ChallengesSheet initial={board} onClose={b => { setChallenges(false); if (b) setBoard(b); }}/>}
  </div>;
}
