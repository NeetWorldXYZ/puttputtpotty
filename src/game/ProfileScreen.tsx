import { useEffect, useState } from 'react';
import { api, fmtElapsed, type PlayerProfile } from '../net/api';
import { currentUserId } from '../net/supabase';
import { POI_ICON } from '../net/places';
import { navigate } from '../router';
import { AccountSheet } from './AccountSheet';
import { Avatar } from './Avatar';
import { TabBar } from './TabBar';
import { ReportSheet } from './ReportSheet';

function since(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** A player's public page. Your own has an edit button; anyone else's has a report flag. */
export function ProfileScreen({ userId }: { userId: string | null }) {
  const [me, setMe] = useState<string | null>(null);
  const [p, setP] = useState<PlayerProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [report, setReport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    void currentUserId().then(setMe);
  }, []);
  const id = userId ?? me;
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setError(null);
    api
      .profile(id)
      .then((r) => !cancelled && setP(r))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id, reload]);

  const mine = !!id && id === me;
  return (
    <div className="leaders profile">
      <div className="map-head">
        <button className="corner-btn" onClick={() => (window.history.length > 1 ? window.history.back() : navigate('play'))} title="Back">
          ‹
        </button>
        <div className="map-title">
          <div className="map-title-main">{p?.name ?? 'Player'}</div>
          <div className="map-title-sub">{p ? `playing since ${since(p.since)}` : ''}</div>
        </div>
        <button className="corner-btn" onClick={() => navigate('leaders')} title="Leaderboard">
          🏆
        </button>
      </div>

      {error && <div className="lb-note">Profile offline · {error}</div>}
      {!error && p === undefined && <div className="lb-note">Loading…</div>}
      {!error && p === null && <div className="lb-note">No such player.</div>}
      {p && (
        <div className="profile-body">
          <div className="profile-hero">
            <Avatar av={p.avatar} size={132} />
            <div className="profile-name">{p.name}</div>
            {p.slogan && <div className="profile-slogan">&ldquo;{p.slogan}&rdquo;</div>}
            {mine ? (
              <button className="primary small" onClick={() => setEdit(true)}>
                Edit my look and name
              </button>
            ) : (
              <button className="quiet-btn" onClick={() => setReport(true)}>
                ⚑ Report
              </button>
            )}
          </div>
          <div className="stat-grid">
            <div className="stat-tile">
              <strong>{p.thrones}</strong>
              <small>{p.thrones === 1 ? 'throne held' : 'thrones held'}</small>
            </div>
            <div className="stat-tile">
              <strong>{p.aces}</strong>
              <small>{p.aces === 1 ? 'ace' : 'aces'}</small>
            </div>
            <div className="stat-tile">
              <strong>{p.best_rel === null ? '–' : p.best_rel > 0 ? `+${p.best_rel}` : p.best_rel === 0 ? 'E' : p.best_rel}</strong>
              <small>best round</small>
            </div>
            <div className="stat-tile">
              <strong>
                {p.matches_won}
                <span className="of">/{p.matches}</span>
              </strong>
              <small>matches won</small>
            </div>
          </div>
          <div className="lb-title">Thrones this season</div>
          {p.throne_list.length === 0 ? (
            <div className="lb-note">{mine ? 'No thrones yet. Open the map and go take one.' : 'No thrones yet.'}</div>
          ) : (
            <ol className="rows">
              {p.throne_list.map((t) => (
                <li key={t.location_id} className="row">
                  <span className="rank">{POI_ICON[t.poi_type] ?? '🚽'}</span>
                  <span className="who">{t.name}</span>
                  <span className="stat">
                    <strong>{t.score}</strong>
                    <small>par {t.par}{t.elapsed_ms ? ` · ${fmtElapsed(t.elapsed_ms)}` : ''}</small>
                  </span>
                  <span className="when">{ago(t.since)}</span>
                </li>
              ))}
            </ol>
          )}
          {mine && p.throne_list.length === 0 && (
            <button className="primary" onClick={() => navigate('map')}>
              Open the map
            </button>
          )}
        </div>
      )}

      {edit && (
        <AccountSheet
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
