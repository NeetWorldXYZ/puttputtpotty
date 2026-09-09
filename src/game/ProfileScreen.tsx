import { MenuVolume, GolferChip } from './MenuControls';
import { useEffect, useState } from 'react';
import { api, fmtElapsed, type PlayerProfile } from '../net/api';
import { currentUserId, ensureSession } from '../net/supabase';
import { POI_ICON } from '../net/places';
import { navigate } from '../router';
import { AccountSheet } from './AccountSheet';
import { Avatar } from './Avatar';
import { GameIcon } from './GameIcon';
import { TabBar } from './TabBar';
import { ReportSheet } from './ReportSheet';
import './Profile.css';
import { ChallengesSheet } from './ChallengesSheet';
import { checkProgress, levelProgress, nextRank, royalTitle, type PromoEvent } from './progress';
import { PromoSheet } from './PromoSheet';
import { useOnline } from '../net/presence';

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

function relPar(n: number | null): string {
  if (n === null) return '–';
  return n > 0 ? `+${n}` : n === 0 ? 'E' : String(n);
}

function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/** A player's royal card. Your own has an edit button; anyone else's has a report flag. */
export function ProfileScreen({ userId, addCode = null }: { userId: string | null; addCode?: string | null }) {
  const [me, setMe] = useState<string | null>(null);
  const [p, setP] = useState<PlayerProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    // Your own page needs a session to know who "you" are; a first-ever visit gets one here.
    void currentUserId().then((id) => (id || userId ? setMe(id) : ensureSession().then((s) => setMe(s.user.id)).catch((e: Error) => setError(e.message))));
  }, [userId]);
  const id = userId ?? me;
  const mineNow = !!me && (userId === null || userId === me);
  useEffect(() => {
    if (!mineNow || friends) return;
    api
      .friends()
      .then((rows) => setFriendRows(rows.map((r) => ({ user_id: r.user_id, relation: r.relation }))))
      .catch(() => {});
  }, [mineNow, friends]);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setError(null);
    api
      .profile(id)
      .then((r) => {
        if (cancelled) return;
        setP(r);
        if (r && (userId === null || userId === me)) setPromo(checkProgress(r));
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id, reload]);

  const mine = !!id && id === me;
  return (
    <div className="leaders profile">
      <div className="map-head menu-controls-only">
        <MenuVolume />
        <GolferChip />
      </div>

      {error && <div className="lb-note">Profile offline · {error}</div>}
      {!error && p === undefined && <div className="lb-note">Loading…</div>}
      {!error && p === null && <div className="lb-note">No such player.</div>}
      {p && (
        <div className="profile-body">
          <section className="pf-hero" aria-label={`${p.name}'s card`}>
            <div className="pf-avatar">
              <Avatar av={p.avatar} size={116} />
              {p.thrones > 0 && (
                <span className="pf-crown" aria-hidden="true">
                  <GameIcon kind="crown" />
                </span>
              )}
            </div>
            <h1 className="pf-name">{p.name}</h1>
            {p.slogan && <div className="pf-slogan">&ldquo;{p.slogan}&rdquo;</div>}
            {p.house_tag ? (
              <span className="pf-titles">
                <span className="pf-title pf-title-house">🧹 {p.house_tag}</span>
                <span className="pf-title">♛ {royalTitle(p.thrones)}</span>
              </span>
            ) : (
              <span className="pf-title">♛ {royalTitle(p.thrones)}</span>
            )}
            <span className="pf-since">Playing since {memberSince(p.since)}</span>
            <span className="pf-level">
              <span className="pf-level-badge">LVL {levelProgress(p.points ?? 0).level}</span>
              <span className="pf-level-bar" role="progressbar" aria-valuemin={0} aria-valuemax={levelProgress(p.points ?? 0).span} aria-valuenow={levelProgress(p.points ?? 0).into}>
                <i style={{ width: `${Math.round((100 * levelProgress(p.points ?? 0).into) / levelProgress(p.points ?? 0).span)}%` }} />
              </span>
              <small>
                <b>{p.points ?? 0}</b> TP · {levelProgress(p.points ?? 0).toNext} to next
                {(p.streak ?? 0) > 0 ? <> · 🔥 {p.streak}-day</> : null}
              </small>
            </span>
            <div className="pf-hero-actions">
              {mine ? (
                <button className="primary" onClick={() => setEdit(true)}>
                  Edit my look
                </button>
              ) : (
                <button className="ghost" onClick={() => setReport(true)}>
                  ⚑ Report
                </button>
              )}
            </div>
          </section>

          <button className="pf-kingdom" onClick={() => setThrones(true)} aria-label={`${mine ? 'Your' : `${p.name}'s`} kingdom: ${p.thrones} thrones. See the list.`}>
            <span className="pf-kingdom-title">
              <GameIcon kind="crown" />
              {mine ? 'Your kingdom' : `${p.name}'s kingdom`}
              <span>{mine && nextRank(p.thrones) ? `${nextRank(p.thrones)!.title} at ${nextRank(p.thrones)!.at} · ` : ''}See thrones ›</span>
            </span>
            <span className="pf-stats">
              <span>
                <b>{p.thrones}</b>
                {p.thrones === 1 ? 'throne' : 'thrones'}
              </span>
              <span>
                <b>{p.aces}</b>
                {p.aces === 1 ? 'ace' : 'aces'}
              </span>
              <span>
                <b>
                  {p.matches_won}
                  <small>/{p.matches}</small>
                </b>
                matches won
              </span>
            </span>
          </button>

          {mine && (
            <button className="pf-challenges pf-friends" onClick={() => setFriends(true)}>
              <span className="pf-emoji" aria-hidden="true">
                👥
              </span>
              <span>
                <strong>Friends</strong>
                <small>{friendRows.filter((f) => f.relation === 'friend').length === 0 ? 'Add friends, see who is on, invite them to a match' : `${friendRows.filter((f) => f.relation === 'friend').length} friends`}</small>
              </span>
              {friendRows.some((f) => f.relation === 'incoming') && <span className="pf-badge">{friendRows.filter((f) => f.relation === 'incoming').length}</span>}
              {friendRows.some((f) => f.relation === 'friend' && isOnline(f.user_id)) && (
                <span className="pf-count">
                  <i /> {friendRows.filter((f) => f.relation === 'friend' && isOnline(f.user_id)).length} online
                </span>
              )}
              <b>›</b>
            </button>
          )}
          {mine && (
            <button className="pf-challenges" onClick={() => setChallenges(true)}>
              <span className="pf-emoji" aria-hidden="true">
                🎯
              </span>
              <span>
                <strong>Challenges</strong>
                <small>Daily and weekly · earn TP</small>
              </span>
              <b>›</b>
            </button>
          )}
          <div className="pf-tiles">
            <div className="pf-tile">
              <span className="pf-emoji" aria-hidden="true">
                ⛳
              </span>
              <span>
                <strong>{relPar(p.best_rel)}</strong>
                <small>Best 9 holes</small>
              </span>
            </div>
            <div className="pf-tile">
              <span className="pf-emoji" aria-hidden="true">
                🧻
              </span>
              <span>
                <strong>{p.runs}</strong>
                <small>Rounds played</small>
              </span>
            </div>
          </div>

          {mine && (
            <button className="pf-cta" onClick={() => navigate('map')}>
              {p.thrones === 0 ? 'GO TAKE A THRONE' : 'DEFEND YOUR THRONES'} <span aria-hidden="true">→</span>
            </button>
          )}
          {mine && p.thrones === 0 && <div className="pf-note">Open the map, find a bathroom, sink it faster than anyone.</div>}
        </div>
      )}

      {thrones && p && (
        <div className="overlay" onClick={() => setThrones(false)}>
          <div className="card pop pf-sheet" role="dialog" aria-modal="true" aria-label="Thrones held" onClick={(e) => e.stopPropagation()}>
            <h2>{mine ? 'Your thrones' : `${p.name}'s thrones`}</h2>
            <div className="sub">{p.thrones === 0 ? (mine ? 'None yet. The map is full of empty ones.' : 'None yet.') : `${p.thrones} held this season`}</div>
            {p.throne_list.length > 0 && (
              <ul className="pf-thrones">
                {p.throne_list.map((t) => (
                  <li key={t.location_id} className="pf-throne">
                    <span className="pf-emoji" aria-hidden="true">
                      {POI_ICON[t.poi_type] ?? '🚽'}
                    </span>
                    <span className="pf-throne-text">
                      <strong>{t.name}</strong>
                      <span>
                        par {t.par}
                        {t.elapsed_ms !== null ? ` · ${fmtElapsed(t.elapsed_ms)}` : ''} · held {ago(t.since)}
                      </span>
                    </span>
                    <b>
                      {t.score}
                      <small>{relPar(t.score - t.par)}</small>
                    </b>
                  </li>
                ))}
              </ul>
            )}
            <button className={mine ? 'primary' : ''} onClick={() => (mine ? navigate('map') : setThrones(false))}>
              {mine ? 'Open the map' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {promo && <PromoSheet event={promo} onClose={() => setPromo(null)} />}
      {friends && (
        <AccountSheet
          initialMode="friends"
          addCode={addCode}
          onClose={() => {
            setFriends(false);
            setReload((n) => n + 1);
            if (addCode) navigate('profile', null, null, { replace: true });
          }}
        />
      )}
            {challenges && (
        <ChallengesSheet
          onClose={() => {
            setChallenges(false);
            setReload((n) => n + 1);
          }}
        />
      )}
      {edit && (
        <AccountSheet
          initialMode="look"
          onClose={() => {
            setEdit(false);
            setReload((n) => n + 1);
          }}
        />
      )}
      {report && p && (
        <ReportSheet
          userId={p.id}
          name={p.name}
          onClose={(msg) => {
            setReport(false);
            if (msg) {
              setToast(msg);
              setTimeout(() => setToast(null), 2500);
            }
          }}
        />
      )}
      {toast && <div className="map-toast">{toast}</div>}
      <TabBar active="profile" />
    </div>
  );
}
