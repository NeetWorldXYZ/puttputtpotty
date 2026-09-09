import { MenuVolume, GolferChip } from './MenuControls';
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
import { stopTheme } from './music';
import { GameIcon } from './GameIcon';
import { MatchIcon } from './MatchIcon';
import { MatchArt } from './MatchArt';
import './MatchLobby.css';

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
/** Random matchmaking waits this long for a person before a bot is seated (shorter with ?bot=1 for testing). */
const BOT_WAIT_MS = 12000 + Math.random() * 8000;

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
  const [codeInput, setCodeInput] = useState('');
  const [askName, setAskName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opp, setOpp] = useState<Progress | null>(null);
  const [oppOnline, setOppOnline] = useState(false);
  const [mine, setMine] = useState<{ score: number; holes: number[]; elapsed: number } | null>(null);
  const [shared, setShared] = useState(false);
  const [inviteLen, setInviteLen] = useState<number>(9);
  const [record, setRecord] = useState<{ matches: number; matches_won: number } | null>(null);
  useEffect(() => {
    if (phase !== 'lobby' || !me) return;
    api
      .profile(me)
      .then((p) => setRecord(p && typeof p.matches === 'number' ? { matches: p.matches, matches_won: p.matches_won ?? 0 } : { matches: 0, matches_won: 0 }))
      .catch(() => setRecord({ matches: 0, matches_won: 0 }));
  }, [phase, me]);
  const strokesRef = useRef<Stroke[][]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const totalRef = useRef(0);
  /** The bot opponent's clock and hole scores, when the opponent is a bot. Its "live" progress is derived from these. */
  const botRef = useRef<{ times: number[]; scores: (number | null)[] } | null>(null);

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

  // Waiting: if nobody comes, seat a bot (random matchmaking only, never invites).
  useEffect(() => {
    if (phase !== 'waiting' || !match || match.code) return;
    const quick = new URLSearchParams(location.search).get('bot') === '1';
    const id = setTimeout(() => {
      api
        .botJoin(match.id)
        .then((r) => {
          if (r.status !== 'playing') return;
          botRef.current = { times: r.holeTimes ?? [], scores: [] };
          return api.matchState(match.id).then((m) => {
            sfx.pop();
            buzz(20);
            enter(m);
          });
        })
        .catch(() => {});
    }, quick ? 1500 : BOT_WAIT_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, match?.id]);

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
      const k = bot.times.filter((t) => t <= elapsed).length;
      const total = bot.scores.slice(0, k).reduce<number>((a, b) => a + (b ?? 0), 0);
      setOpp({ hole: Math.min(k + 1, n), strokes: k > 0 ? (bot.scores[k - 1] ?? 0) : 0, total, done: k >= n });
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

  if (phase === 'lobby') {
    return (
      <div className="leaders match-screen ml">
        <div className="map-head menu-controls-only">
          <MenuVolume />
          <GolferChip />
        </div>
        <div className="ml-lobby">
          {error && <div className="ml-err" role="alert">{error}</div>}
          <div className="ml-heading">
            <h1>PUTT UP.</h1>
            <p>Same holes, head to head. Fewest strokes wins.</p>
          </div>
          <button className="ml-invitation" disabled={busy} aria-label="Find an opponent for a nine-hole match" onClick={() => void start(() => api.findMatch())}>
            <MatchArt />
            <span className="ml-cta">
              {busy ? 'Connecting…' : 'Find an opponent'} <span aria-hidden="true">→</span>
            </span>
          </button>
          <p className="ml-rule">Nine holes. Tied score? The faster round takes it.</p>
          <button className="ml-record" onClick={() => navigate('profile')}>
            <GameIcon kind="trophy" />
            <strong>YOUR RECORD</strong>
            <span>{record === null ? 'Loading…' : record.matches === 0 ? 'No matches yet' : `${record.matches_won} ${record.matches_won === 1 ? 'win' : 'wins'} · ${record.matches - record.matches_won} ${record.matches - record.matches_won === 1 ? 'loss' : 'losses'}`}</span>
          </button>
          <div className="ml-tile" aria-labelledby="friend-title">
            <MatchIcon />
            <span className="ml-tile-text">
              <strong id="friend-title">Play a friend</strong>
              <small>Pick the holes, share the invite</small>
            </span>
            <span className="ml-controls">
              <span className="ml-chips" aria-label="Invite round length">
                {INVITE_LENGTHS.map((n) => (
                  <button key={n} aria-pressed={n === inviteLen} disabled={busy} className={n === inviteLen ? 'active' : ''} onClick={() => setInviteLen(n)}>
                    {n}
                    <small>holes</small>
                  </button>
                ))}
              </span>
              <button className="ml-go" disabled={busy} onClick={() => void start(() => api.createInvite(inviteLen))}>
                Invite
              </button>
            </span>
          </div>
          <form
            className="ml-tile"
            onSubmit={(e) => {
              e.preventDefault();
              if (codeInput.trim().length === 6 && !busy) void start(() => api.joinInvite(codeInput.trim()));
            }}
          >
            <span className="ml-emoji" aria-hidden="true">
              🎟️
            </span>
            <label className="ml-tile-text" htmlFor="match-code">
              <strong>Got a code?</strong>
              <small>Join a friend's round</small>
            </label>
            <span className="ml-controls">
              <input id="match-code" className="ml-code" maxLength={6} minLength={6} required autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoComplete="off" placeholder="6 characters" value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/\s/g, ''))} />
              <button type="submit" className="ml-go" disabled={codeInput.trim().length !== 6 || busy}>
                Join
              </button>
            </span>
          </form>
        </div>
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
