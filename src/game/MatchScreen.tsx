import { useCallback, useEffect, useRef, useState } from 'react';
import { TabBar } from './TabBar';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Hole, Stroke } from '../sim/types';
import { DEFAULT_PARAMS } from '../sim/params';
import { api, fmtElapsed, type MatchRow } from '../net/api';

const INVITE_LENGTHS = [3, 9, 18] as const;
import { ensureSession, getSavedName, loadProfile, supabase } from '../net/supabase';
import { navigate } from '../router';
import { Avatar } from './Avatar';
import { PlayView, type HoleDoneInfo } from './PlayView';
import { NamePrompt } from './NamePrompt';
import { sfx, unlockAudio } from './sound';
import { buzz } from './haptics';

interface Props {
  /** Invite code from a shared link. */
  code: string | null;
  /** Resume a match by id (after a reload). */
  matchId: string | null;
}

type Phase = 'lobby' | 'waiting' | 'loading' | 'playing' | 'result';
interface Progress {
  hole: number;
  strokes: number;
  total: number;
  done: boolean;
}

const POLL_MS = 2000;

/**
 * Quick match: two players, the same three server-generated holes, live
 * progress over a Realtime channel, result verified by the server's replay.
 */
export function MatchScreen({ code, matchId }: Props) {
  const [phase, setPhase] = useState<Phase>(matchId ? 'loading' : code ? 'loading' : 'lobby');
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [holes, setHoles] = useState<Hole[] | null>(null);
  const [building, setBuilding] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [askName, setAskName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opp, setOpp] = useState<Progress | null>(null);
  const [oppOnline, setOppOnline] = useState(false);
  const [mine, setMine] = useState<{ score: number; holes: number[]; elapsed: number } | null>(null);
  const [shared, setShared] = useState(false);
  const [inviteLen, setInviteLen] = useState<number>(9);
  const strokesRef = useRef<Stroke[][]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const totalRef = useRef(0);

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
    setMatch(m);
    setError(null);
    if (m.status === 'waiting') setPhase('waiting');
    else if (m.status === 'playing' || m.status === 'done') setPhase('loading');
    else setPhase('lobby');
    navigate('match', null, null, { match: m.id, replace: true });
  };

  // Waiting: poll until an opponent joins.
  useEffect(() => {
    if (phase !== 'waiting' || !match) return;
    const id = setInterval(() => {
      api
        .matchState(match.id)
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
          let hole: Hole | null = null;
          for (let attempt = 0; attempt < 4 && !hole; attempt++) {
            try {
              hole = (await api.courseHole(match.seed, i)).hole;
            } catch (e) {
              if (attempt === 3) throw e;
              await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
            }
          }
          hs.push(hole!);
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

  // Live channel while playing or waiting for the opponent's result.
  useEffect(() => {
    if (!match || !me || (phase !== 'playing' && phase !== 'result')) return;
    const ch = supabase.channel(`match:${match.id}`, { config: { broadcast: { self: false }, presence: { key: me } } });
    ch.on('broadcast', { event: 'progress' }, ({ payload }) => {
      const p = payload as Progress & { from: string };
      if (p.from !== me) setOpp({ hole: p.hole, strokes: p.strokes, total: p.total, done: p.done });
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

  // Result: poll until the match is done (opponent finishes, or forfeits after ten minutes).
  useEffect(() => {
    if (phase !== 'result' || !match || match.status === 'done') return;
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
  }, [phase, match?.id, match?.status]);

  const broadcast = (p: Progress) => {
    void channelRef.current?.send({ type: 'broadcast', event: 'progress', payload: { ...p, from: me } });
  };

  const onHoleDone = (info: HoleDoneInfo) => {
    if (!match) return;
    strokesRef.current[info.holeIndex] = info.strokes;
    totalRef.current += info.score;
    const n = match.holes || 9;
    const last = info.holeIndex === n - 1;
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
  if (phase === 'playing' && holes && match) {
    const strip = (
      <div className={`opp-strip${oppOnline ? ' online' : ''}`}>
        <span className="opp-name">
          <Avatar av={match[`${other}_avatar`]} size={22} className="opp-avatar" /> {oppName}
        </span>
        <span className="opp-prog">{opp ? (opp.done ? `finished · ${opp.total}` : `hole ${opp.hole} done · ${opp.total} so far`) : oppOnline ? 'on hole 1' : 'connecting…'}</span>
      </div>
    );
    return (
      <PlayView
        key={match.id}
        holes={holes}
        courseSeed={null}
        onExit={() => navigate('play')}
        exitLabel="Quit"
        lockedParams={DEFAULT_PARAMS}
        noRetry
        timerFrom={match.started_at ? new Date(match.started_at).getTime() : null}
        onHoleDone={onHoleDone}
        topExtra={strip}
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
        scorecardExtra={
          <div className="match-result">
            {error && <div className="err" role="alert">{error}</div>}
            {!mine && !error && <div className="sub">Submitting your round…</div>}
            {mine && match.status !== 'done' && (
              <div className="sub">
                You: <strong>{mine.score}</strong> ({mine.holes.join('-')}) in {fmtElapsed(mine.elapsed)} · waiting for {oppName}
                {opp ? ` · they're ${opp.done ? 'finished' : `on hole ${opp.hole + 1}`}` : ''}
              </div>
            )}
            {match.status === 'done' && <Verdict match={match} me={me} side={side} />}
            <button onClick={() => void start(() => api.findMatch())}>Rematch a stranger</button>
          </div>
        }
      />
    );
  }

  return (
    <div className="leaders match-screen">
      <div className="map-head">
        <button className="corner-btn" onClick={() => navigate('play')} title="Title screen">
          ⌂
        </button>
        <div className="map-title">
          <div className="map-title-main">Match</div>
          <div className="map-title-sub">Same course. Settle it on the green.</div>
        </div>
      </div>

      <div className="board match-board">
        {error && <div className="err" role="alert">{error}</div>}

        {phase === 'lobby' && (
          <>
            <section className="match-hero">
              <div className="match-eyebrow">HEAD TO HEAD</div>
              <div className="match-duel" aria-hidden="true"><span>YOU</span><b>VS</b><span>?</span></div>
              <h1>A little friendly competition.</h1>
              <p>Same holes. Fewest strokes wins.<br />Tied score? The faster round takes it.</p>
              <button className="match-find" disabled={busy} onClick={() => void start(() => api.findMatch())}>
                {busy ? 'Connecting…' : 'Find an opponent'} <span aria-hidden="true">→</span>
              </button>
              <small>Nine holes · matched with another player</small>
            </section>
            <section className="friend-card" aria-labelledby="friend-title">
              <div className="match-section-heading"><span className="match-section-icon" aria-hidden="true">↗</span><div><h2 id="friend-title">Play a friend</h2><p>Pick your round, then share the invite.</p></div></div>
              <div className="friend-controls">
                <div className="len-chips" aria-label="Invite round length">
                  {INVITE_LENGTHS.map(n => <button key={n} aria-pressed={n === inviteLen} disabled={busy} className={n === inviteLen ? 'active' : ''} onClick={() => setInviteLen(n)}>{n}<small>holes</small></button>)}
                </div>
                <button className="invite-create" disabled={busy} onClick={() => void start(() => api.createInvite(inviteLen))}>Create invite</button>
              </div>
            </section>
            <form className="join-card" onSubmit={e => { e.preventDefault(); if (codeInput.trim().length === 6 && !busy) void start(() => api.joinInvite(codeInput.trim())); }}>
              <label htmlFor="match-code">Already have an invite?</label>
              <div><input id="match-code" className="code-input" maxLength={6} minLength={6} required autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoComplete="off" placeholder="6-character code" value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase().replace(/\s/g, ''))} />
              <button type="submit" disabled={codeInput.trim().length !== 6 || busy}>Join →</button></div>
            </form>
          </>
        )}

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
              <div className="sub" role="status">Waiting for another player to join.<br />Your round starts when you’re paired.</div>
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
          <div className="waiting">
            {match.status === 'done' ? <Verdict match={match} me={me} side={side} /> : <div className="sub">You finished. Waiting for {oppName}…</div>}
            {mine && (
              <div className="sub">
                You: <strong>{mine.score}</strong> ({mine.holes.join('-')}) in {fmtElapsed(mine.elapsed)}
              </div>
            )}
            <button className="primary" onClick={() => void start(() => api.findMatch())}>
              Play again
            </button>
            <button onClick={() => navigate('play')}>Home</button>
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
          <span>You</span>
          <strong>{mine.score ?? '–'}</strong>
          <small>
            {mine.holes?.join('-') ?? ''}
            {mine.t != null ? ` · ${fmtElapsed(mine.t)}` : ''}
          </small>
        </div>
        <div className={!won && !tie ? 'lead' : ''}>
          <span>{theirs.name}</span>
          <strong>{theirs.score ?? '–'}</strong>
          <small>
            {theirs.holes?.join('-') ?? (match.forfeit ? 'did not finish' : '')}
            {theirs.t != null ? ` · ${fmtElapsed(theirs.t)}` : ''}
          </small>
        </div>
      </div>
    </div>
  );
}
