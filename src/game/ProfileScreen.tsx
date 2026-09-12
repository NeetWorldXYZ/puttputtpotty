import { useEffect, useMemo, useState } from 'react';
import { api, fmtElapsed, type PlayerProfile } from '../net/api';
import { currentUserId, ensureSession } from '../net/supabase';
import { POI_ICON } from '../net/places';
import { navigate } from '../router';
import { AccountSheet } from './AccountSheet';
import { GameIcon } from './GameIcon';
import { TabBar } from './TabBar';
import { ReportSheet } from './ReportSheet';
import { ProfileName, ProfileSign } from './ProfileIdentity';
import { ProfilePlaceholder } from './ProfileLoading';
import './Profile.css';
import './ProfilePolish.css';
import { ProfileGolfer, ProfileRecentCrowns, ProfileStage, ProfileStats, PublicProfileExtras } from './ProfileExtras';
import { ChallengesSheet } from './ChallengesSheet';
import { checkProgress, levelProgress, royalTitle, type PromoEvent } from './progress';
import { PromoSheet } from './PromoSheet';
import { useOnline } from '../net/presence';

function ago(iso: string): string { const s = (Date.now() - new Date(iso).getTime()) / 1000; if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`; if (s < 86400) return `${Math.round(s / 3600)}h`; return `${Math.round(s / 86400)}d`; }
function relPar(n: number | null): string { if (n === null) return '–'; return n > 0 ? `+${n}` : n === 0 ? 'E' : String(n); }
function memberSince(iso: string): string { return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); }

function FriendsIcon() {
  return <svg className="pf3-row-art" viewBox="0 0 72 56" aria-hidden="true"><defs><linearGradient id="pf3-friend-fill" x2="0" y2="1"><stop stopColor="#e8eeff"/><stop offset="1" stopColor="#8d9fe4"/></linearGradient></defs><g fill="url(#pf3-friend-fill)" stroke="#08283d" strokeWidth="3"><circle cx="25" cy="18" r="11"/><circle cx="47" cy="18" r="11"/><path d="M7 50q1-19 18-19t18 19Z"/><path d="M29 50q1-19 18-19t18 19Z"/></g></svg>;
}

function ChallengeIcon() {
  return <svg className="pf3-row-art" viewBox="0 0 64 64" aria-hidden="true"><circle cx="29" cy="34" r="23" fill="#fff5df" stroke="#08283d" strokeWidth="4"/><circle cx="29" cy="34" r="15" fill="none" stroke="#f14e5d" strokeWidth="6"/><circle cx="29" cy="34" r="5" fill="#f14e5d"/><path d="m32 30 20-20m-8 1 9-2-2 9" fill="none" stroke="#51c8d9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function ProfileScreen({ userId, addCode = null }: { userId: string | null; addCode?: string | null }) {
  const [me, setMe] = useState<string | null>(null);
  const [p, setP] = useState<PlayerProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState(false);
  const [edit, setEdit] = useState(false);
  const [report, setReport] = useState(false);
  const [thrones, setThrones] = useState(false);
  const [challenges, setChallenges] = useState(false);
  const [friends, setFriends] = useState<boolean>(!!addCode);
  const [promo, setPromo] = useState<PromoEvent | null>(null);
  const [friendRows, setFriendRows] = useState<{ user_id: string; relation: string }[]>([]);
  const isOnline = useOnline();
  const [toast, setToast] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => { void currentUserId().then(id => (id || userId ? setMe(id) : ensureSession().then(s => setMe(s.user.id)).catch((e: Error) => setError(e.message)))); }, [userId]);
  const id = userId ?? me;
  const mineNow = !!me && (userId === null || userId === me);
  useEffect(() => { if (!mineNow || friends) return; api.friends().then(rows => setFriendRows(rows.map(r => ({ user_id: r.user_id, relation: r.relation })))).catch(() => {}); }, [mineNow, friends]);
  useEffect(() => { if (!id) return; let cancelled = false; setError(null); api.profile(id).then(r => { if (cancelled) return; setP(r); if (r && (userId === null || userId === me)) setPromo(checkProgress(r)); }).catch((e: Error) => !cancelled && setError(e.message)); return () => { cancelled = true; }; }, [id, reload]);

  const mine = userId === null || (!!id && id === me);
  const progress = useMemo(() => levelProgress(p?.points ?? 0), [p?.points]);
  const friendCount = friendRows.filter(f => f.relation === 'friend').length;
  const share = async () => { const url = location.href; try { if (navigator.share) await navigator.share({ title: `${p?.name ?? 'Player'} · Putt Putt Potty`, url }); else { await navigator.clipboard.writeText(url); setToast('Profile link copied'); } } catch { /* cancelled */ } };
  const back = () => { if (history.length > 1) history.back(); else navigate('leaders'); };

  return <div className={`leaders profile profile-polished profile-v3 ${mine ? 'pf-private' : 'pf-public'}`}>
    {mine ? <div className="pf3-topbar"><button className="pf3-round-button" aria-label="Profile settings" onClick={() => setAccount(true)}>⚙</button><button className="pf3-points" onClick={() => setChallenges(true)} aria-label={`${p?.points ?? 0} Throne Points`}><GameIcon kind="crown"/>{(p?.points ?? 0).toLocaleString()}<b>+</b></button></div>
      : <div className="pf3-topbar"><button className="pf3-round-button pf3-back" aria-label="Go back" onClick={back}>‹</button><button className="pf3-round-button pf3-more" aria-label="Report player" onClick={() => setReport(true)}>•••</button></div>}

    {error && <div className="lb-note">Profile offline · {error}</div>}
    {!error && p === undefined && <ProfilePlaceholder/>}
    {!error && p === null && <div className="lb-note">No such player.</div>}
    {p && <div className="profile-body">
      <section className="pf3-hero" aria-label={`${p.name}'s profile`}>
        <div className="pf3-avatar"><ProfileSign slogan={p.slogan} onEdit={mine ? () => setAccount(true) : undefined}/><div className="pf3-golfer-group"><ProfileStage/><ProfileGolfer av={p.avatar}/></div></div>
        <div className="pf3-identity">
          <div className="pf3-name-row"><ProfileName name={p.name}/>{mine && <button aria-label="Edit profile" onClick={() => setAccount(true)}>✎</button>}</div>
          <div className="pf3-rank-row"><span className="pf3-title">♛&nbsp; {p.house_tag ?? royalTitle(p.thrones)}</span>{!mine && <span className="pf3-level-chip">LVL <b>{progress.level}</b></span>}</div>
          <small>Playing since {memberSince(p.since)}</small>
          {mine && <div className="pf3-level-box"><div><b>LVL {progress.level}</b><span>{progress.into} / {progress.span} XP</span></div><i><em style={{ width: `${Math.round((100 * progress.into) / progress.span)}%` }}/></i><small><b>{progress.toNext} TP</b> to next level{(p.streak ?? 0) > 0 && <span>🔥 {p.streak} day streak</span>}</small></div>}
          {mine && <button className="pf3-customize" onClick={() => setEdit(true)}><span>👕</span>Customize My Look&nbsp; ›</button>}
        </div>
      </section>

      {mine ? <><ProfileStats p={p} mine/><button className="pf3-row" onClick={() => setFriends(true)}><FriendsIcon/><span><strong>Friends</strong><small>{friendCount} {friendCount === 1 ? 'friend' : 'friends'}{friendRows.some(f => f.relation === 'friend' && isOnline(f.user_id)) ? ' · friends online' : ''}</small></span><b>›</b></button><button className="pf3-row" onClick={() => setChallenges(true)}><ChallengeIcon/><span><strong>Challenges</strong><small>Daily and weekly · Earn Throne Points</small></span><b>›</b></button><ProfileRecentCrowns p={p} onViewAll={() => setThrones(true)}/></> : <PublicProfileExtras p={p} me={me} onFriends={() => setFriends(true)} onThrones={() => setThrones(true)} onShare={() => void share()}/>}
    </div>}

    {thrones && p && <div className="overlay" onClick={() => setThrones(false)}><div className="card pop pf-sheet" role="dialog" aria-modal="true" aria-label="Thrones held" onClick={e => e.stopPropagation()}><h2>{mine ? 'Your thrones' : `${p.name}'s thrones`}</h2><div className="sub">{p.thrones === 0 ? (mine ? 'None yet. The map is full of empty ones.' : 'None yet.') : `${p.thrones} held this season`}</div>{p.throne_list.length > 0 && <ul className="pf-thrones">{p.throne_list.map(t => <li key={t.location_id} className="pf-throne"><span className="pf-emoji" aria-hidden="true">{POI_ICON[t.poi_type] ?? '🚽'}</span><span className="pf-throne-text"><strong>{t.name}</strong><span>par {t.par}{t.elapsed_ms !== null ? ` · ${fmtElapsed(t.elapsed_ms)}` : ''} · held {ago(t.since)}</span></span><b>{t.score}<small>{relPar(t.score - t.par)}</small></b></li>)}</ul>}<button className={mine ? 'primary' : ''} onClick={() => mine ? navigate('map') : setThrones(false)}>{mine ? 'Open the map' : 'Close'}</button></div></div>}
    {promo && <PromoSheet event={promo} onClose={() => setPromo(null)}/>}
    {(friends || account) && <AccountSheet initialMode={friends ? 'friends' : undefined} addCode={addCode ?? (!mine ? p?.name ?? null : null)} onClose={() => { setFriends(false); setAccount(false); setReload(n => n + 1); if (addCode) navigate('profile', null, null, { replace: true }); }}/>}
    {challenges && <ChallengesSheet onClose={() => { setChallenges(false); setReload(n => n + 1); }}/>}
    {edit && <AccountSheet initialMode="look" onClose={() => { setEdit(false); setReload(n => n + 1); }}/>}
    {report && p && <ReportSheet userId={p.id} name={p.name} onClose={msg => { setReport(false); if (msg) { setToast(msg); setTimeout(() => setToast(null), 2500); } }}/>}
    {toast && <div className="map-toast">{toast}</div>}
    <TabBar active="profile"/>
  </div>;
}
