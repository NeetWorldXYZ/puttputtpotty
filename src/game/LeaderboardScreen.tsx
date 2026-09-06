import { useEffect, useState } from 'react';
import { api, fmtElapsed, type DailyRow, type KingRow } from '../net/api';
import { currentUserId, getSavedName } from '../net/supabase';
import { loadProfile } from '../net/supabase';
import { recallFix } from '../net/places';
import { dailyEdition, dailySeed } from './courses';
import { navigate } from '../router';
import { AccountSheet } from './AccountSheet';
import { ReportSheet } from './ReportSheet';
import { Avatar } from './Avatar';
import { TabBar } from './TabBar';

type Tab = 'nearby' | 'world' | 'daily';
const NEARBY_RADIUS_M = 25000;

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

/** Kings nearby, kings everywhere, and today's daily. */
export function LeaderboardScreen() {
  const [tab, setTab] = useState<Tab>(() => (recallFix() ? 'nearby' : 'world'));
  const [kings, setKings] = useState<KingRow[] | null>(null);
  const [daily, setDaily] = useState<DailyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [name, setName] = useState(getSavedName());
  const [askName, setAskName] = useState(false);
  const [report, setReport] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fix = recallFix();

  useEffect(() => {
    void currentUserId().then(setMe);
    void loadProfile().then((p) => p?.name && setName(p.name));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (tab === 'daily') {
      setDaily(null);
      api
        .leaderboard(dailySeed())
        .then((r) => !cancelled && setDaily(r))
        .catch((e: Error) => !cancelled && setError(e.message));
    } else {
      setKings(null);
      const opts = tab === 'nearby' && fix ? { lat: fix.lat, lng: fix.lng, radiusM: NEARBY_RADIUS_M } : {};
      api
        .kings(opts)
        .then((r) => !cancelled && setKings(r))
        .catch((e: Error) => !cancelled && setError(e.message));
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const rows = tab === 'daily' ? daily : kings;
  const myRank = rows ? rows.findIndex((r) => r.user_id === me) : -1;

  return (
    <div className="leaders">
      <div className="map-head">
        <button className="corner-btn" onClick={() => navigate('play')} title="Title screen">
          ⌂
        </button>
        <div className="map-title">
          <div className="map-title-main">Leaderboard</div>
          <div className="map-title-sub">{tab === 'daily' ? `${dailyEdition()} course · ${dailySeed().slice(0, 10)}` : tab === 'nearby' ? 'thrones within 25 km of you' : 'thrones across the whole world'}</div>
        </div>
        <button className="name-chip" onClick={() => setAskName(true)} title="Change name">
          {name ?? 'Set name'}
        </button>
      </div>

      <div className="tabs">
        <button className={tab === 'nearby' ? 'active' : ''} onClick={() => setTab('nearby')} disabled={!fix} title={fix ? '' : 'Open the map once so we know where you are'}>
          Kings near you
        </button>
        <button className={tab === 'world' ? 'active' : ''} onClick={() => setTab('world')}>
          Kings everywhere
        </button>
        <button className={tab === 'daily' ? 'active' : ''} onClick={() => setTab('daily')}>
          {dailyEdition() === 'morning' ? 'Morning' : 'Evening'} course
        </button>
      </div>

      <div className="board">
        {error && <div className="lb-note">Leaderboard offline · {error}</div>}
        {!error && !rows && <div className="lb-note">Loading…</div>}
        {!error && rows && rows.length === 0 && (
          <div className="empty">
            <div className="empty-crown">{tab === 'daily' ? '⛳' : '👑'}</div>
            <div>{tab === 'daily' ? 'Nobody has finished all nine holes today. Be first.' : tab === 'nearby' ? 'No thrones claimed near you yet. Every bathroom is up for grabs.' : 'No thrones claimed anywhere yet. The world is one big empty stall.'}</div>
            <button className="primary" onClick={() => navigate(tab === 'daily' ? 'play' : 'map', tab === 'daily' ? dailySeed() : null)}>
              {tab === 'daily' ? 'Play the daily' : 'Open the map'}
            </button>
          </div>
        )}
        {rows && rows.length > 0 && (
          <ol className="rows">
            {rows.map((r, i) => (
              <li key={r.user_id} className={`row${r.user_id === me ? ' me' : ''}${i < 3 ? ` top${i + 1}` : ''}`}>
                <span className="rank">{i === 0 ? '👑' : i + 1}</span>
                <Avatar av={r.avatar} size={30} className="row-avatar" />
                <button className="who link" onClick={() => navigate('profile', null, null, { user: r.user_id })}>
                  {r.display_name}
                  {r.user_id === me && <small> · you</small>}
                </button>
                {tab === 'daily' ? (
                  <span className="stat">
                    <strong>{(r as DailyRow).total}</strong>
                    <small>{(r as DailyRow).elapsed_ms ? `strokes · ${fmtElapsed((r as DailyRow).elapsed_ms)}` : 'strokes'}</small>
                  </span>
                ) : (
                  <span className="stat">
                    <strong>{(r as KingRow).thrones}</strong>
                    <small>
                      {(r as KingRow).thrones === 1 ? 'throne' : 'thrones'}
                      {(r as KingRow).aces > 0 ? ` · 🎯 ${(r as KingRow).aces} ${(r as KingRow).aces === 1 ? 'ace' : 'aces'}` : ''}
                    </small>
                  </span>
                )}
                <span className="when">{ago(tab === 'daily' ? (r as DailyRow).finished_at : (r as KingRow).last_win)}</span>
                {r.user_id !== me && (
                  <button className="flag-btn" title="Report this player" onClick={() => setReport({ id: r.user_id, name: r.display_name })}>
                    ⚑
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        {rows && rows.length > 0 && myRank < 0 && <div className="lb-note">You&apos;re not on this board yet.{tab !== 'daily' && ' Claim a throne to appear.'}</div>}
      </div>

      {askName && (
        <AccountSheet
          onClose={(n) => {
            setName(n);
            setAskName(false);
          }}
        />
      )}
      {report && (
        <ReportSheet
          userId={report.id}
          name={report.name}
          onClose={(msg) => {
            setReport(null);
            if (msg) {
              setToast(msg);
              setTimeout(() => setToast(null), 2500);
            }
          }}
        />
      )}
      {toast && <div className="map-toast">{toast}</div>}
      <TabBar active="leaders" />
    </div>
  );
}
