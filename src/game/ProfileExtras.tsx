import { useEffect, useId, useState } from 'react';
import { api, type PlayerProfile, type FriendRelation } from '../net/api';
import { navigate } from '../router';
import { Avatar } from './Avatar';
import { profileAvatarSvg, type Avatar as AvatarSpec } from './avatarParts';
import { ProfileStatIcon } from './ProfileStatIcon';
import { levelProgress } from './progress';

export function ProfileStage() {
  return <svg className="pf-stage" viewBox="0 0 220 210" aria-hidden="true">
    <ellipse cx="183" cy="176" rx="14" ry="7" fill="#e4f3a3"/><ellipse cx="183" cy="175" rx="10" ry="4.5" fill="#08283d"/>
    <path d="M183 174V51" stroke="#08283d" strokeWidth="7" strokeLinecap="round"/><path d="M183 171V52" stroke="#fff5dd" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M184 53q17-3 31 10l-31 17Z" fill="#ff5d54" stroke="#08283d" strokeWidth="3.5" strokeLinejoin="round"/>

  </svg>;
}

/** Full golfer pose is confined to profiles; other avatar portraits stay compact. */
export function ProfileGolfer({ av }: { av: AvatarSpec | null | undefined }) {
  const id = useId().replace(/:/g, '');
  return <svg className="avatar pf-standing-golfer" viewBox="0 0 160 210" aria-hidden="true" dangerouslySetInnerHTML={{ __html: profileAvatarSvg(av, `profile-${id}`) }}/>;
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
      <span className="pf3-crown-art"><em>♛</em></span><strong>{t.name}</strong><small>{crownAge(t.since)}</small>
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
    <ProfileComparison p={p} own={own} busy={busy} onChallenge={() => void challenge()}/>
    <ProfileRecentCrowns p={p} onViewAll={onThrones}/>
  </>;
}

/** These are career totals, not a record of direct games between the players. */
export function ProfileComparison({ p, own, busy, onChallenge }: { p: PlayerProfile; own: PlayerProfile | null; busy: boolean; onChallenge: () => void }) {
  const rows = [
    { label: 'Thrones', mine: own?.thrones, theirs: p.thrones },
    { label: 'Aces', mine: own?.aces, theirs: p.aces },
    { label: 'Ranked wins', mine: own?.matches_won, theirs: p.matches_won },
    { label: 'Win rate', mine: own?.matches ? own.matches_won / own.matches : undefined, theirs: p.matches ? p.matches_won / p.matches : undefined, percent: true },
  ];
  const value = (n: number | undefined, percent?: boolean) => n === undefined ? '–' : percent ? `${Math.round(n * 100)}%` : n;
  return <section className="pf3-h2h pf3-duel" aria-label={`Career comparison with ${p.name}`}>
    <header><h2>Head-to-Head</h2><span>Career comparison</span></header>
    <div className="pf3-duel-players">
      <div className="pf3-duel-player pf3-duel-you">
        <div className="pf3-duel-portrait">{own ? <Avatar av={own.avatar} size={94}/> : <span className="pf3-duel-placeholder" aria-label="Your profile unavailable">?</span>}</div>
        <strong title={own?.name}>You</strong><small>{own ? `LEVEL ${levelProgress(own.points ?? 0).level}` : '—'}</small>
      </div>
      <span className="pf3-duel-vs" aria-hidden="true">VS</span>
      <div className="pf3-duel-player pf3-duel-them">
        <div className="pf3-duel-portrait"><Avatar av={p.avatar} size={94}/></div>
        <strong title={p.name}>{p.name}</strong><small>LEVEL {levelProgress(p.points ?? 0).level}</small>
      </div>
    </div>
    <table className="pf3-duel-stats">
      <thead className="pf3-visually-hidden"><tr><th scope="col">You</th><th scope="col">Career stat</th><th scope="col">{p.name}</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.label}>
        <td className={row.mine !== undefined && row.theirs !== undefined && row.mine > row.theirs ? 'pf3-duel-leading' : ''}>{value(row.mine, row.percent)}</td>
        <th scope="row">{row.label}</th>
        <td className={row.mine !== undefined && row.theirs !== undefined && row.theirs > row.mine ? 'pf3-duel-leading' : ''}>{value(row.theirs, row.percent)}</td>
      </tr>)}</tbody>
    </table>
    <button className="pf3-duel-challenge" disabled={busy} onClick={onChallenge}><span aria-hidden="true">⚔</span><span>{busy ? 'Sending challenge…' : 'Challenge to a match'}</span><b aria-hidden="true">›</b></button>
  </section>;
}
