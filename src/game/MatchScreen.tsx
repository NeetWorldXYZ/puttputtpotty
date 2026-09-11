import { MenuVolume, GolferChip } from './MenuControls';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TabBar } from './TabBar';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Hole, Stroke } from '../sim/types';
import { DEFAULT_PARAMS } from '../sim/params';
import { api, fmtElapsed, type MatchRow } from '../net/api';

import { ensureSession, getSavedName, loadProfile, supabase } from '../net/supabase';
import { navigate } from '../router';
import { Avatar } from './Avatar';
import { PlayView, type HoleDoneInfo } from './PlayView';
import { NamePrompt } from './NamePrompt';
import { sfx, unlockAudio } from './sound';
import { buzz } from './haptics';
import { stopTheme } from './music';
import { MatchLobby } from './MatchLobby';
import { MatchResultModal } from './MatchResultModal';
import { loadRankedRecord, type RankedRecord } from '../net/rankedRecord';
import './MatchLobby.css';
import './MatchWaiting.css';

interface Props {
  /** Invite code from a shared link. */
  code: string | null;
  /** Resume a match by id (after a reload). */
  matchId: string | null;
}

type Phase = 'lobby' | 'waiting' | 'loading' | 'playing' | 'result';
/** Broadcast after each hole: the hole just finished (1-based), its strokes, the running total. */
interface Progress {
  hole: number;
  strokes: number;
  total: number;
  done: boolean;
}

/** What we know of the opponent's round so far. */
interface OppState {
  /** Strokes on each finished hole. */
  holes: number[];
  total: number;
  finished: boolean;
}

const relPar = (d: number) => (d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`);

const POLL_MS = 2000;
/** What the search says while it looks, one line every few seconds. */
const SEARCH_LINES = ['Looking for players near you…', 'Checking who’s on the course…', 'Paging the clubhouse…', 'Rolling the greens…', 'Almost paired up…'];

/**
 * Quick match: two players, the same three server-generated holes, live
 * progress over a Realtime channel, result verified by the server's replay.
 */
export function MatchScreen({ code, matchId }: Props) {
  const [phase, setPhase] = useState<Phase>(matchId ? 'loading' : code ? 'loading' : 'lobby');
  useEffect(() => { if (phase === 'playing') stopTheme(); }, [phase]);
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [holes, setHoles] = useState<Hole[] | null>(null);
  const [building, setBuilding] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [askName, setAskName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opp, setOpp] = useState<OppState | null>(null);
  const [myProg, setMyProg] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [oppOnline, setOppOnline] = useState(false);
  const [mine, setMine] = useState<{ score: number; holes: number[]; elapsed: number } | null>(null);
  const [shared, setShared] = useState(false);
  const [record, setRecord] = useState<RankedRecord | null>(null);
  const [recordError, setRecordError] = useState(false);
  const [recordRevision, setRecordRevision] = useState(0);
  useEffect(() => {
    if ((phase !== 'lobby' && phase !== 'waiting') || !me) return;
    let live = true;
    setRecordError(false);
    void loadRankedRecord(me)
      .then(value => { if (live) setRecord(value); })
      .catch(() => { if (live) setRecordError(true); });
    return () => { live = false; };
  }, [phase, me, recordRevision]);
  const strokesRef = useRef<Stroke[][]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const totalRef = useRef(0);
  /** The bot opponent's clock and hole scores, when the opponent is a bot. Its "live" progress is derived from these. */
  const botRef = useRef<{ times: number[]; scores: (number | null)[] } | null>(null);
  const matchIdRef = useRef<string | null>(null);

  useEffect(() => {
    void ensureSession()
      .then((s) => setMe(s.user.id))
      .catch((e: Error) => setError(e.message));
  }, []);

  // Entry from a link or a reload.
  useEffect(() => {
    if (!me) return;
    if (matchId) {
      api
        .matchState(matchId)
        .then((m) => enter(m))
        .catch((e: Error) => {
          setError(e.message);
          setPhase('lobby');
        });
    } else if (code) {
      api
        .joinInvite(code)
        .then((m) => enter(m))
        .catch((e: Error) => {
          setError(e.message);
          setPhase('lobby');
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, matchId, code]);

  const enter = (m: MatchRow) => {
    if (m.id !== matchIdRef.current) {
      // A fresh match: nothing carries over from the last one.
      matchIdRef.current = m.id;
      botRef.current = null;
      strokesRef.current = [];
      totalRef.current = 0;
      setMyProg({ done: 0, total: 0 });
      setOpp(null);
      setOppOnline(false);
      setMine(null);
    }
    // The server may have seated a bot itself (after ten seconds of waiting): pick up its clock so we plan its round and show it moving.
    if (m.p2_bot && !botRef.current) botRef.current = { times: m.bot_times ?? [], scores: [] };
    setMatch(m);
    setError(null);
    if (m.status === 'waiting') setPhase('waiting');
    else if (m.status === 'playing' || m.status === 'done') setPhase('loading');
    else setPhase('lobby');
    navigate('match', null, null, { match: m.id, replace: true });
  };

  // Waiting: poll until an opponent joins (the server seats a bot after ten seconds; ?bot=1 makes it two).
  const quickBot = typeof location !== 'undefined' && new URLSearchParams(location.search).get('bot') === '1';
  const [waitSec, setWaitSec] = useState(0);
  const waitStartRef = useRef(0);
  useEffect(() => {
    if (phase !== 'waiting' || !match) return;
    // match_state rows carry no created_at; the clock starts from the row that opened the match and is not reset by polls.
    waitStartRef.current = match.created_at ? new Date(match.created_at).getTime() : Date.now();
    const tick = () => setWaitSec(Math.max(0, Math.floor((Date.now() - waitStartRef.current) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, match?.id]);
  useEffect(() => {
    if (phase !== 'waiting' || !match) return;
    const id = setInterval(() => {
      api
        .matchState(match.id, quickBot && !match.code)
        .then((m) => {
          if (m.status === 'playing') {
            sfx.pop();
            buzz(20);
            enter(m);
          } else if (m.status === 'cancelled') setPhase('lobby');
          else setMatch(m);
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, match?.id]);

  // Loading: fetch the three holes from the server (it generates and caches them).
  useEffect(() => {
    if (phase !== 'loading' || !match) return;
    let cancelled = false;
    (async () => {
      try {
        const hs: Hole[] = [];
        const n = match.holes || 9;
        for (let i = 0; i < n; i++) {
          setBuilding(i + 1);
          // The server builds a match hole a couple of attempts per request; keep asking until it is laid out.
          let hole: Hole | null = null;
          let failures = 0;
          for (let attempt = 0; attempt < 30 && !hole; attempt++) {
            if (cancelled) return;
            try {
              const r = await api.courseHole(match.seed, i);
              failures = 0;
              if (r.hole) hole = r.hole;
              else await new Promise((res) => setTimeout(res, 250));
            } catch (e) {
              failures++;
              if (failures >= 4) throw e;
              await new Promise((res) => setTimeout(res, 600 * failures));
            }
          }
          if (!hole) throw new Error(`hole ${i + 1} is taking too long to build, try again`);
          hs.push(hole);
        }
        if (cancelled) return;
        setHoles(hs);
        if (match.status === 'done' || (me && ((match.p1 === me && match.p1_score !== null) || (match.p2 === me && match.p2_score !== null)))) {
          const side = match.p1 === me ? 'p1' : 'p2';
          setMine({ score: match[`${side}_score`] ?? 0, holes: match[`${side}_holes`] ?? [], elapsed: match[`${side}_elapsed_ms`] ?? 0 });
          setPhase('result');
        } else setPhase('playing');
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, match?.id]);

  // Bot opponent: plan its round in the background (one hole per request), then let its clock run.
  useEffect(() => {
    const bot = botRef.current;
    if (!match || !bot || (phase !== 'playing' && phase !== 'result')) return;
    let cancelled = false;
    const n = match.holes || 9;
    if (bot.scores.length < n) {
      void (async () => {
        for (let i = 0; i < n && !cancelled; i++) {
          if (bot.scores[i] !== undefined && bot.scores[i] !== null) continue;
          try {
            const r = await api.botPlan(match.id, i);
            bot.scores[i] = r.score;
          } catch {
            await new Promise((res) => setTimeout(res, 1500));
            i--; // try this hole again
          }
        }
      })();
    }
    const startedAt = match.started_at ? new Date(match.started_at).getTime() : Date.now();
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const k = Math.min(n, bot.times.filter((t) => t <= elapsed).length);
      const done = bot.scores.slice(0, k).map((x) => x ?? 0);
      setOpp({ holes: done, total: done.reduce((a, b) => a + b, 0), finished: k >= n });
      setOppOnline(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, match?.id]);

  // Live channel while playing or waiting for the opponent's result.
  useEffect(() => {
    if (!match || !me || (phase !== 'playing' && phase !== 'result')) return;
    const ch = supabase.channel(`match:${match.id}`, { config: { broadcast: { self: false }, presence: { key: me } } });
    ch.on('broadcast', { event: 'progress' }, ({ payload }) => {
      const p = payload as Progress & { from: string };
      if (p.from === me) return;
      setOpp((prev) => {
        const holes = prev ? [...prev.holes] : [];
        holes[p.hole - 1] = p.strokes;
        return { holes: holes.map((x) => x ?? 0), total: p.total, finished: p.done };
      });
    });
    ch.on('presence', { event: 'sync' }, () => {
      const others = Object.keys(ch.presenceState()).filter((k) => k !== me);
      setOppOnline(others.length > 0);
    });
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') void ch.track({ name: getSavedName() ?? 'Golfer', at: Date.now() });
    });
    channelRef.current = ch;
    return () => {
      void supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [match?.id, me, phase]);

  // Finished: poll until the match is done (the opponent finishes, or forfeits after enough time).
  const finished = phase === 'result' || (phase === 'playing' && mine !== null);
  useEffect(() => {
    if (!finished || !match || match.status === 'done') return;
    const id = setInterval(() => {
      api
        .matchState(match.id)
        .then((m) => {
          setMatch(m);
          if (m.status === 'done') {
            if (m.winner === me) {
              sfx.fanfare('ace');
              buzz([30, 40, 30, 40, 80]);
            } else sfx.pop();
          }
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, match?.id, match?.status]);

  const broadcast = (p: Progress) => {
    void channelRef.current?.send({ type: 'broadcast', event: 'progress', payload: { ...p, from: me } });
  };

  const onHoleDone = (info: HoleDoneInfo) => {
    if (!match) return;
    strokesRef.current[info.holeIndex] = info.strokes;
    totalRef.current += info.score;
    const n = match.holes || 9;
    const last = info.holeIndex === n - 1;
    setMyProg({ done: info.holeIndex + 1, total: totalRef.current });
    broadcast({ hole: info.holeIndex + 1, strokes: info.score, total: totalRef.current, done: last });
    if (!last) return;
    const lists = strokesRef.current.slice(0, n);
    api
      .submitMatch(match.id, lists)
      .then((r) => {
        setMine({ score: r.score, holes: r.holeScores, elapsed: r.elapsedMs });
        return api.matchState(match.id);
      })
      .then((m) => {
        setMatch(m);
        if (m.status === 'done') {
          if (m.winner === me) {
            sfx.fanfare('ace');
            buzz([30, 40, 30, 40, 80]);
          }
        }
      })
      .catch((e: Error) => setError(e.message));
  };

  const start = useCallback(
    async (fn: () => Promise<MatchRow>) => {
      unlockAudio();
      if (!getSavedName()) {
        const p = await loadProfile();
        if (!p?.name || /^Golfer [A-F0-9]+$/.test(p.name)) {
          setAskName(true);
          return;
        }
      }
      setBusy(true);
      setError(null);
      try {
        enter(await fn());
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const cancel = async () => {
    if (match) await api.cancelMatch(match.id).catch(() => {});
    setMatch(null);
    setPhase('lobby');
    navigate('match', null, null, { replace: true });
  };

  const share = async () => {
    if (!match?.code) return;
    const url = `${location.origin}/match?code=${match.code}`;
    const text = `Play me at Putt Putt Potty. Same ${match.holes || 9} holes, fewest strokes wins. Code ${match.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Putt Putt Potty match', text, url });
      else await navigator.clipboard.writeText(`${text}\n${url}`);
      setShared(true);
    } catch {
      /* cancelled */
    }
  };

  const side = match && me ? (match.p1 === me ? 'p1' : 'p2') : 'p1';
  const other = side === 'p1' ? 'p2' : 'p1';
  const oppName = match ? (match[`${other}_name`] ?? 'Opponent') : 'Opponent';

  // ---------- screens
  const leave = () => navigate('play');
  const rematch = () => void start(() => api.findMatch());
  const panel = match ? (
    <MatchPanel match={match} me={me} side={side} opp={opp} oppOnline={oppOnline} mine={mine} holes={holes} error={error} onLeave={leave} onRematch={rematch} />
  ) : null;
  const resultModal = match?.status === 'done' && me && holes ? <MatchResultModal
    key={match.id} match={match} me={me} holes={holes} onLeave={leave} onEnter={enter}
    friendAction={!match.p2_bot && match[other] ? <AddFriend userId={match[other] as string} name={oppName}/> : null}
  /> : null;

  if (phase === 'result' && resultModal) return resultModal;
  const waitingModal = <div className="mr-overlay"><div className="mr-dialog mw-dialog" role="dialog" aria-modal="true" aria-label="Waiting for opponent">{panel}</div></div>;
  if (phase === 'result' && match?.status !== 'done') return waitingModal;

  if (phase === 'playing' && holes && match) {
    const pars = holes.map((h) => h.par);
    const myRel = myProg.total - pars.slice(0, myProg.done).reduce((a, b) => a + b, 0);
    const oppDone = opp?.holes.length ?? 0;
    const oppRel = (opp?.total ?? 0) - pars.slice(0, oppDone).reduce((a, b) => a + b, 0);
    const gap = oppRel - myRel;
    const lead = myProg.done === 0 && oppDone === 0 ? 'square' : gap > 0 ? 'up' : gap < 0 ? 'down' : 'square';
    const card = (
      <div className={`duel-card hud-extra${oppOnline ? ' online' : ''}`} aria-live="polite">
        <Avatar av={match[`${other}_avatar`]} size={26} className="duel-avatar" />
        <span className="duel-who">
          <span className="duel-name">{oppName}</span>
          <span className="duel-thru">
            {opp ? (opp.finished ? `finished · ${opp.total}` : oppDone ? `thru ${oppDone} · ${relPar(oppRel)}` : 'on hole 1') : oppOnline ? 'on hole 1' : 'connecting…'}
          </span>
        </span>
        <span className={`duel-lead ${lead}`}>{lead === 'square' ? 'ALL SQUARE' : lead === 'up' ? `${gap} UP` : `${-gap} DOWN`}</span>
      </div>
    );
    return (
      <PlayView
        key={match.id}
        holes={holes}
        courseSeed={null}
        onExit={leave}
        exitLabel="Quit"
        lockedParams={DEFAULT_PARAMS}
        noRetry
        timerFrom={match.started_at ? new Date(match.started_at).getTime() : null}
        onHoleDone={onHoleDone}
        topExtra={card}
        renderDoneCard={(info, actions) => (
          <>
            <div className="sub">
              Match · hole {info.holeIndex + 1} of {match.holes}
            </div>
            <button className="primary" onClick={actions.next}>
              {info.holeIndex + 1 < match.holes ? 'Next hole →' : 'See result'}
            </button>
          </>
        )}
        renderScorecard={() => resultModal ?? waitingModal}
      />
    );
  }

  if (phase === 'lobby' || (phase === 'waiting' && match && !match.code)) {
    return (
      <div className="leaders match-screen ma">
        <div className="map-head menu-controls-only"><MenuVolume /><GolferChip /></div>
        <MatchLobby
          busy={busy}
          error={error}
          record={record}
          recordError={recordError}
          onRetryRecord={() => setRecordRevision(n => n + 1)}
          onFind={() => void start(() => api.findMatch())}
          onInvite={n => start(() => api.createInvite(n))}
          onJoin={inviteCode => start(() => api.joinInvite(inviteCode))}
          searching={phase === 'waiting'}
          waitSeconds={waitSec}
          searchLine={SEARCH_LINES[Math.floor(waitSec / 3) % SEARCH_LINES.length]}
          onCancel={() => void cancel()}
        />
        <TabBar active="match" />
        {askName && <NamePrompt title="Name for the match" sub="Your opponent will see it." onDone={() => setAskName(false)} onCancel={() => setAskName(false)} />}
      </div>
    );
  }

  return (
    <div className="leaders match-screen">
      <div className="map-head menu-controls-only">
        <MenuVolume />
        <GolferChip />
      </div>

      <div className="board match-board">
        {error && <div className="err" role="alert">{error}</div>}

        {phase === 'waiting' && match && (
          <div className="waiting">
            <div className="match-search-orbit" aria-hidden="true">⛳</div>
            <h2>{match.code ? "Your friend’s seat is ready" : "Finding your matchup"}</h2>
            {match.code ? (
              <>
                <div className="sub">Your invite code</div>
                <div className="big-code">{match.code}</div>
                <button className="primary" onClick={() => void share()}>
                  {shared ? 'Share again' : 'Share invite'}
                </button>
                <div className="sub">{match.holes} holes · waiting for your friend to join…</div>
              </>
            ) : (
              <div className="search-live" role="status" aria-live="polite">
                <div className="search-line" key={Math.floor(waitSec / 3) % SEARCH_LINES.length}>
                  {SEARCH_LINES[Math.floor(waitSec / 3) % SEARCH_LINES.length]}
                </div>
                <div className="search-meta">
                  <span className="search-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    Searching · {Math.floor(waitSec / 60)}:{String(waitSec % 60).padStart(2, '0')}
                  </span>
                </div>
                <div className="search-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(96, 8 + waitSec * 9)}%` }} />
                </div>
              </div>
            )}
            <button onClick={() => void cancel()}>Cancel</button>
          </div>
        )}

        {phase === 'loading' && (
          <div className="waiting">
            <div className="match-search-orbit" aria-hidden="true">⛳</div>
            <h2>Getting the course ready</h2>
            {building > 0 && <progress aria-label="Course loading progress" value={building} max={match?.holes || 9} />}
            <div className="sub">{building ? `Laying out hole ${building} of ${match?.holes ?? 9}…` : 'Opening the match…'}</div>
          </div>
        )}

        {phase === 'result' && match && (
          <div className="waiting match-done">
            {panel}
            {match.status === 'done' && (
              <>
                <button className="primary" onClick={rematch}>
                  Rematch a stranger
                </button>
                <button onClick={leave}>Home</button>
              </>
            )}
          </div>
        )}
      </div>

      <TabBar active="match" />
      {askName && (
        <NamePrompt
          title="Name for the match"
          sub="Your opponent will see it."
          onDone={() => setAskName(false)}
          onCancel={() => setAskName(false)}
        />
      )}
    </div>
  );
}

/** Head to head once you have finished: their live progress until the result lands, then the verdict. */
function MatchPanel({
  match,
  me,
  side,
  opp,
  oppOnline,
  mine,
  holes,
  error,
  onLeave,
}: {
  match: MatchRow;
  me: string | null;
  side: 'p1' | 'p2';
  opp: OppState | null;
  oppOnline: boolean;
  mine: { score: number; holes: number[]; elapsed: number } | null;
  holes: Hole[] | null;
  error: string | null;
  onLeave: () => void;
  onRematch: () => void;
}) {
  const other = side === 'p1' ? 'p2' : 'p1';
  const oppName = match[`${other}_name`] ?? 'Opponent';
  const n = match.holes || 9;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (match.status === 'done') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [match.status]);
  if (match.status === 'done') return <Verdict match={match} me={me} side={side} />;
  const done = opp?.holes.length ?? 0;
  const pars = holes?.map((h) => h.par) ?? [];
  const oppRel = pars.length ? (opp?.total ?? 0) - pars.slice(0, done).reduce((a, b) => a + b, 0) : null;
  // The server calls a forfeit when the other side has had twice your time (eight minutes at least).
  const started = match.started_at ? new Date(match.started_at).getTime() : now;
  const deadline = started + Math.max(480_000, (mine?.elapsed ?? 0) * 2);
  const left = Math.max(0, deadline - now);
  return (
    <div className="duel-wait">
      <header className="mw-header">
        <svg viewBox="0 0 64 58" aria-hidden="true"><path d="m8 13 14 11L32 5l10 19 14-11-6 34H14Z" fill="#ffdb4d" stroke="#09263d" strokeWidth="4" strokeLinejoin="round"/><path d="m13 17 9 11L32 11l10 17 9-11M16 44h32" fill="none" stroke="#fff2a2" strokeWidth="3"/><path d="M15 51h34" stroke="#dc9826" strokeWidth="5" strokeLinecap="round"/></svg>
        <p>ROUND COMPLETE</p>
        <h2>{!mine ? 'SAVING YOUR ROUND' : opp?.finished ? 'TALLYING THE SCORES' : 'WAITING ON THE GREEN'}</h2>
        <span>{mine ? 'Your score is in. The crown is still in play.' : 'Hang tight while your score is recorded.'}</span>
      </header>
      {error && <div className="err" role="alert">{error}</div>}
      {!mine && !error && <div className="sub">Submitting your round…</div>}
      <div className="duel-rows">
        <div className="duel-row me">
          <Avatar av={match[`${side}_avatar`]} size={30} />
          <span className="duel-row-name">You</span>
          <span className="duel-row-sub">{mine ? `finished · ${fmtElapsed(mine.elapsed)}` : 'sending…'}</span>
          <b>{mine?.score ?? '–'}</b>
        </div>
        <div className={`duel-row them${oppOnline ? ' online' : ''}`}>
          <Avatar av={match[`${other}_avatar`]} size={30} />
          <span className="duel-row-name">{oppName}</span>
          <span className="duel-row-sub">
            {opp?.finished ? 'finished · tallying' : done ? `thru ${done}${oppRel !== null ? ` · ${relPar(oppRel)}` : ''}` : oppOnline ? 'on hole 1' : 'not here yet'}
          </span>
          <b>{opp ? opp.total : '–'}</b>
        </div>
      </div>
      <div className="mw-progress-heading"><span>OPPONENT’S ROUND</span><b>{Math.min(done,n)} / {n} holes</b></div>
      <progress className="mw-progress" value={Math.min(done,n)} max={n} aria-label="Opponent completed holes"/>
      <div className="duel-holes" aria-label={`${oppName}'s holes`}>
        {Array.from({ length: n }, (_, i) => {
          const sc = opp?.holes[i];
          const par = pars[i];
          const cls = sc === undefined ? (i === done && !opp?.finished ? 'now' : '') : sc === 1 ? 'ace' : par !== undefined && sc < par ? 'under' : par !== undefined && sc > par ? 'over' : 'par';
          return (
            <span key={i} className={`duel-hole ${cls}`} aria-label={`Hole ${i+1}: ${sc ?? (i===done?'playing':'not played')}`}>
              <small>{i+1}</small><b>{sc ?? (i===done&&!opp?.finished?'•':'—')}</b>
            </span>
          );
        })}
      </div>
      <div className="duel-status">
        <span className="duel-spin" aria-hidden="true" />
        {opp?.finished ? `${oppName} is done, the result lands any second` : done >= n ? `${oppName} is finishing up` : `${oppName} is on hole ${done + 1}`}
        {!opp?.finished && left > 0 && <small> · forfeit in {fmtClock(left)}</small>}
      </div>
      <button className="quiet duel-leave" onClick={onLeave}>
        Back to home <span aria-hidden="true">→</span>
      </button>
      <p className="mw-leave-note">You can leave. Your result still counts.</p>
    </div>
  );
}

const fmtClock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** After a match against a person: one tap to be friends. */
function AddFriend({ userId, name }: { userId: string; name: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'friends' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    // Already friends, or already asked: say so instead of offering again.
    api
      .friendLookup(name)
      .then((rows) => {
        const r = rows.find((x) => x.user_id === userId);
        if (r?.relation === 'friend') setState('friends');
        else if (r?.relation === 'outgoing') setState('sent');
      })
      .catch(() => {});
  }, [userId, name]);
  if (state === 'friends') return <div className="verdict-friend done">✓ Friends with {name}</div>;
  if (state === 'sent') return <div className="verdict-friend done">Friend request sent</div>;
  return (
    <button
      className="verdict-friend"
      disabled={state === 'busy'}
      onClick={() => {
        setState('busy');
        api
          .friendRequest(userId)
          .then((rel) => {
            sfx.pop();
            setState(rel === 'friend' ? 'friends' : 'sent');
          })
          .catch((e: Error) => {
            setMsg(e.message);
            setState('error');
          });
      }}
    >
      {state === 'error' ? msg : `＋ Add ${name} as a friend`}
    </button>
  );
}

function Verdict({ match, me, side }: { match: MatchRow; me: string | null; side: 'p1' | 'p2' }) {
  const other = side === 'p1' ? 'p2' : 'p1';
  const mine = { score: match[`${side}_score`], holes: match[`${side}_holes`], t: match[`${side}_elapsed_ms`] };
  const theirs = { score: match[`${other}_score`], holes: match[`${other}_holes`], t: match[`${other}_elapsed_ms`], name: match[`${other}_name`] ?? 'Opponent' };
  const won = match.winner === me;
  const tie = match.winner === null;
  return (
    <div className={`verdict ${tie ? 'tie' : won ? 'won' : 'lost'}`}>
      <div className="verdict-title">{tie ? 'Dead heat' : won ? (match.forfeit ? 'Win by forfeit' : 'You win!') : match.forfeit ? 'Lost by forfeit' : `${theirs.name} wins`}</div>
      <div className="verdict-rows">
        <div className={won ? 'lead' : ''}>
          <Avatar av={match[`${side}_avatar`]} size={34} className="verdict-avatar" />
          <span>You</span>
          <strong>{mine.score ?? '–'}</strong>
          <small>
            {mine.holes?.join('-') ?? ''}
            {mine.t != null ? ` · ${fmtElapsed(mine.t)}` : ''}
          </small>
        </div>
        <div className={!won && !tie ? 'lead' : ''}>
          <Avatar av={match[`${other}_avatar`]} size={34} className="verdict-avatar" />
          <span>{theirs.name}</span>
          <strong>{theirs.score ?? '–'}</strong>
          <small>
            {theirs.holes?.join('-') ?? (match.forfeit ? 'did not finish' : '')}
            {theirs.t != null ? ` · ${fmtElapsed(theirs.t)}` : ''}
          </small>
        </div>
      </div>
      {!match.p2_bot && match[other] && <AddFriend userId={match[other] as string} name={theirs.name} />}
    </div>
  );
}
