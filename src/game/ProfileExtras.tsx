import { useEffect, useState } from 'react';
import { api, type PlayerProfile, type FriendRelation } from '../net/api';
import { navigate } from '../router';
import { Avatar } from './Avatar';
import { ProfileStatIcon } from './ProfileStatIcon';

export function ProfileStage() {
  return <svg className="pf-stage" viewBox="0 0 220 210" aria-hidden="true">
    <path d="M8 181q14-25 54-22l38 4 37-10q36-8 69 18l6 18q-23 18-82 17l-71-1q-39-2-51-24Z" fill="#248f50" stroke="#08283d" strokeWidth="3"/>
    <path d="M23 178q14-18 43-14l34 7 31-10q29-9 57 9 16 11 3 20-17 10-56 7l-36-3-28 7q-39-2-48-23Z" fill="#87d151"/>
    <path d="M33 178q38-1 70 14M94 166q28 8 55 29" fill="none" stroke="#b7eb73" strokeWidth="3" opacity=".65"/>
    <ellipse cx="183" cy="176" rx="14" ry="7" fill="#e4f3a3"/><ellipse cx="183" cy="175" rx="10" ry="4.5" fill="#08283d"/>
    <path d="M183 174V51" stroke="#08283d" strokeWidth="7" strokeLinecap="round"/><path d="M183 171V52" stroke="#fff5dd" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M184 53q17-3 31 10l-31 17Z" fill="#ff5d54" stroke="#08283d" strokeWidth="3.5" strokeLinejoin="round"/>
    <circle cx="50" cy="181" r="12" fill="#fff" stroke="#08283d" strokeWidth="3"/><g fill="#b8d0da"><circle cx="45" cy="176" r="1.5"/><circle cx="53" cy="175" r="1.5"/><circle cx="49" cy="183" r="1.5"/></g>
  </svg>;
}

function winRate(p: PlayerProfile) { return p.matches ? `${Math.round((p.matches_won / p.matches) * 100)}%` : '–'; }

export function ProfileStats({ p, mine }: { p: PlayerProfile; mine: boolean }) {
  const rows = mine
    ? ([['throne', p.thrones, 'Thrones', 'Locations owned'], ['ace', p.aces, 'Aces', 'Hole in ones'], ['match', p.matches, 'Matches', 'Played'], ['win', winRate(p), 'Win rate', p.matches ? 'Nice.' : 'Play to rank']] as const)
    : ([['throne', p.thrones, 'Thrones', 'Locations controlled'], ['ace', p.aces, 'Aces', 'Hole in ones'], ['match', p.matches_won, 'Ranked wins', 'Ranked matches'], ['win', winRate(p), 'Win rate', p.matches ? 'Impressive!' : 'No matches yet']] as const);
  return <section className="pf3-stat-card" aria-label="Career stats">{rows.map(([kind, value, label, detail]) => <div key={label}>
    <ProfileStatIcon kind={kind}/><strong>{value}</strong><b>{label}</b><small>{detail}</small>
  </div>)}</section>;
}

function crownAge(iso: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  return days === 0 ? 'Today' : days === 1 ? '1 day ago' : days < 7 ? `${days} days ago` : days < 14 ? '1 week ago' : `${Math.floor(days / 7)} weeks ago`;
}

export function ProfileRecentCrowns({ p, onViewAll }: { p: PlayerProfile; onViewAll: () => void }) {
  return <section className="pf3-recent">
    <header><span aria-hidden="true">♛</span><h2>Recent Crowns</h2>{p.throne_list.length > 0 && <button onClick={onViewAll}>View all&nbsp; ›</button>}</header>
    {p.throne_list.length ? <div className="pf3-crown-grid">{p.throne_list.slice(0, 4).map((t, i) => <button key={t.location_id} className={`pf3-crown-place pf3-crown-place-${i + 1}`} onClick={onViewAll}>
      <span className="pf3-crown-art"><i/><em>♛</em></span><strong>{t.name}</strong><small>{crownAge(t.since)}</small>
    </button>)}</div> : <button className="pf3-no-crowns" onClick={() => navigate('map')}>No crowns yet · find one on the map&nbsp; →</button>}
  </section>;
}

export function PublicProfileExtras({ p, me, onFriends, onThrones, onShare }: { p: PlayerProfile; me: string | null; onFriends: () => void; onThrones: () => void; onShare: () => void }) {
  const [own, setOwn] = useState<PlayerProfile | null>(null);
  const [relation, setRelation] = useState<FriendRelation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true; setOwn(null); setRelation(me ? null : 'none'); setError('');
    if (me) {
      void api.profile(me).then(x => { if (live) setOwn(x); }).catch(() => {});
      void api.friendLookup(p.name).then(rows => { if (live) setRelation(rows.find(r => r.user_id === p.id)?.relation ?? 'none'); }).catch(() => {});
    }
    return () => { live = false; };
  }, [p.id, me, p.name]);
  async function add() { setBusy(true); setError(''); try { setRelation(relation === 'incoming' ? await api.friendRespond(p.id, true) : await api.friendRequest(p.id)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function challenge() { if (relation !== 'friend') { onFriends(); return; } setBusy(true); setError(''); try { const match = await api.createInvite(9); await api.inviteFriend(p.id, match.id); navigate('match', null, null, { match: match.id }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const addLabel = relation === 'friend' ? 'Friends' : relation === 'incoming' ? 'Accept Friend' : relation === 'outgoing' ? 'Request Sent' : relation === 'blocked' ? 'Unavailable' : 'Add Friend';
  return <>
    <div className="pf3-public-actions">
      <button className="pf3-add" disabled={busy || relation === null || relation === 'outgoing' || relation === 'blocked'} onClick={() => relation === 'friend' ? onFriends() : void add()}><span>♟+</span>{addLabel}</button>
      <button className="pf3-challenge" disabled={busy} onClick={() => void challenge()}><span>⚔</span>{busy ? 'Please wait…' : 'Challenge'}</button>
      <button className="pf3-share" onClick={onShare}><span>⇧</span>Share</button>
    </div>
    {error && <p className="pf3-error" role="alert">{error}</p>}
    <ProfileStats p={p} mine={false}/>
    <section className="pf3-h2h">
      <header><ProfileStatIcon kind="match"/><span><h2>Head-to-Head</h2><small>How you stack up against {p.name}</small></span></header>
      <div className="pf3-versus-card">
        <div className="pf3-player-side"><span>You</span>{own ? <Avatar av={own.avatar} size={62}/> : <i className="pf3-avatar-placeholder"/>}<dl><div><dt>♛</dt><dd>{own?.thrones ?? '–'}</dd></div><div><dt>●</dt><dd>{own?.aces ?? '–'}</dd></div><div><dt>⚔</dt><dd>{own?.matches_won ?? '–'}</dd></div><div><dt>♜</dt><dd>{own ? winRate(own) : '–'}</dd></div></dl></div>
        <b className="pf3-vs">VS</b>
        <div className="pf3-player-side pf3-player-them"><span>{p.name}</span><Avatar av={p.avatar} size={62}/><dl><div><dt>♛</dt><dd>{p.thrones}</dd></div><div><dt>●</dt><dd>{p.aces}</dd></div><div><dt>⚔</dt><dd>{p.matches_won}</dd></div><div><dt>♜</dt><dd>{winRate(p)}</dd></div></dl></div>
      </div>
      <div className="pf3-h2h-cta"><small>Challenge {p.name} to improve your record!</small><button disabled={busy} onClick={() => void challenge()}>⚔&nbsp; Challenge</button></div>
    </section>
    <ProfileRecentCrowns p={p} onViewAll={onThrones}/>
  </>;
}
