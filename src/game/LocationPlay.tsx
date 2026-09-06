import { useEffect, useRef, useState } from 'react';
import type { Hole, Stroke } from '../sim/types';
import { DEFAULT_PARAMS } from '../sim/params';
import type { GeneratedHole } from '../generator/generator';
import { HOLES_PER_COURSE, api, fmtElapsed, type King, type LocationRow } from '../net/api';
import { currentUserId } from '../net/supabase';
import { watchPosition, type Fix } from '../net/geo';
import { bandFor, recallPlace } from '../net/places';
import { loadCourse } from '../net/course';
import { navigate } from '../router';
import { Avatar } from './Avatar';
import { PlayView, type HoleDoneInfo } from './PlayView';
import { sfx } from './sound';
import { buzz } from './haptics';

interface Props {
  locationId: string;
  /** Submit the run for the throne (needs GPS + check-in); otherwise practice. */
  throne: boolean;
}

type Submit = { state: 'idle' } | { state: 'sending' } | { state: 'done'; score: number; holeScores: number[]; elapsedMs: number | null; king: King | null; isKing: boolean } | { state: 'error'; message: string };

const RAMP: Record<string, ('easy' | 'medium' | 'hard')[]> = {
  easy: ['easy', 'easy', 'medium'],
  medium: ['easy', 'medium', 'medium'],
  hard: ['medium', 'hard', 'hard'],
};

const toMap = () => navigate('map');

/** Best round per player at this bathroom this season. */
function LocationBoard({ locationId, refreshKey }: { locationId: string; refreshKey: number }) {
  const [rows, setRows] = useState<LocationRow[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void currentUserId().then((id) => !cancelled && setMe(id));
    api
      .locationBoard(locationId, 10)
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [locationId, refreshKey]);
  if (!rows || !rows.length) return null;
  return (
    <div className="lb">
      <div className="lb-title">Throne room</div>
      <ol className="sheet-board dark">
        {rows.map((r) => (
          <li key={r.user_id} className={r.user_id === me ? 'me' : ''}>
            <span className="rank">{r.rank === 1 ? '👑' : r.rank}</span>
            <span className="who">
              <Avatar av={r.avatar} size={22} className="row-avatar" />
              {r.display_name}
            </span>
            <span className="stat">
              {r.score}
              {r.hole_scores && <small> {r.hole_scores.join('-')}</small>}
            </span>
            <span className="when">{r.elapsed_ms !== null ? fmtElapsed(r.elapsed_ms) : ''}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * One bathroom's three-hole course. The holes come from the server (which
 * founds the bathroom on first visit); practice falls back to generating
 * locally when the backend is unreachable. A throne run submits all three
 * stroke lists at the end and the server replays them.
 */
export function LocationPlay({ locationId, throne }: Props) {
  const place = recallPlace(locationId);
  const [holes, setHoles] = useState<Hole[] | null>(null);
  const [king, setKing] = useState<King | null>(null);
  const strokesRef = useRef<Stroke[][]>([]);
  const [timerFrom, setTimerFrom] = useState<number | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [building, setBuilding] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [submit, setSubmit] = useState<Submit>({ state: 'idle' });
  const fixRef = useRef<Fix | null>(null);

  useEffect(() => {
    if (!place) {
      navigate('map', null, null, { replace: true });
      return;
    }
    let cancelled = false;
    const signal = { cancelled: false };
    loadCourse(place, { signal, onProgress: (n) => !cancelled && setBuilding(n) })
      .then((r) => {
        if (cancelled) return;
        setHoles(r.holes);
        setKing(r.king);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        if (throne) {
          setLoadError(e.message);
          return;
        }
        // Practice without a backend: same seeds and band as the server would use (archetypes may differ).
        const band = bandFor(place.poiType, place.id);
        const w = new Worker(new URL('../solver/worker.ts', import.meta.url), { type: 'module' });
        const out: Hole[] = [];
        const ask = (i: number) => w.postMessage({ kind: 'generate', id: i, options: { seed: `${place.id}:${i}`, difficulty: RAMP[band.difficulty][i] } });
        w.onmessage = (ev: MessageEvent<{ id: number; generated?: GeneratedHole; error?: string }>) => {
          if (cancelled) {
            w.terminate();
            return;
          }
          if (!ev.data.generated) {
            w.terminate();
            setLoadError(ev.data.error ?? e.message);
            return;
          }
          const h = ev.data.generated.hole;
          out.push({ ...h, id: `${place.id}#${ev.data.id + 1}`, name: `${place.name} ${ev.data.id + 1}`, theme: band.theme });
          if (out.length === HOLES_PER_COURSE) {
            w.terminate();
            setHoles(out);
            setOffline(true);
          } else ask(out.length);
        };
        ask(0);
      });
    return () => {
      cancelled = true;
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, throne]);

  useEffect(() => {
    if (!throne || !holes) return;
    let cancelled = false;
    api
      .start(locationId)
      .then((r) => {
        if (!cancelled) setTimerFrom(new Date(r.startedAt).getTime());
      })
      .catch((e: Error) => {
        if (!cancelled) setStartError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [throne, holes, locationId]);

  useEffect(() => {
    if (!throne) return;
    return watchPosition(
      (f) => {
        fixRef.current = f;
      },
      () => {},
    );
  }, [throne]);

  const onHoleDone = (info: HoleDoneInfo) => {
    strokesRef.current[info.holeIndex] = info.strokes;
    if (!throne || info.holeIndex !== HOLES_PER_COURSE - 1) return;
    const f = fixRef.current;
    if (!f) {
      setSubmit({ state: 'error', message: 'No GPS fix. Your round was not submitted.' });
      return;
    }
    const lists = strokesRef.current.slice(0, HOLES_PER_COURSE);
    if (lists.some((l) => !l || !l.length)) {
      setSubmit({ state: 'error', message: 'A hole was skipped, so the round was not submitted.' });
      return;
    }
    setSubmit({ state: 'sending' });
    api
      .submitLocation(locationId, lists, f.lat, f.lng, f.accuracy)
      .then((r) => {
        setSubmit({ state: 'done', score: r.score, holeScores: r.holeScores, elapsedMs: r.elapsedMs, king: r.king, isKing: r.isKing });
        if (r.isKing) {
          sfx.fanfare('ace');
          buzz([30, 40, 30, 40, 80]);
        }
      })
      .catch((e: Error) => setSubmit({ state: 'error', message: e.message }));
  };

  const coursePar = holes ? holes.reduce((a, h) => a + h.par, 0) : 0;

  if (!place) return null;

  if (loadError) {
    return (
      <div className="play">
        <div className="overlay" style={{ background: 'var(--page)' }}>
          <div className="card">
            <h2>Couldn&apos;t open this bathroom</h2>
            <div className="sub">{place.name}</div>
            <div className="err">{loadError}</div>
            <button className="primary" onClick={toMap}>
              Back to map
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!holes) {
    return (
      <div className="play">
        <div className="overlay" style={{ background: 'var(--page)' }}>
          <div className="card">
            <h2>{building ? `Building hole ${building} of ${HOLES_PER_COURSE}` : 'Opening the stall'}</h2>
            <div className="sub">{place.name}{building ? ' · first visit, the course is being laid out' : ''}</div>
            <button onClick={toMap}>Back to map</button>
          </div>
        </div>
      </div>
    );
  }

  const throneStatus = (
    <div className="throne-result">
      {submit.state === 'sending' && <div className="sub">Submitting to the throne room…</div>}
      {submit.state === 'error' && <div className="err">{submit.message}</div>}
      {submit.state === 'idle' && startError && <div className="err">Clock did not start: {startError}</div>}
      {submit.state === 'done' && submit.elapsedMs !== null && (
        <div className={`race-result${submit.king && submit.king.elapsed_ms !== null && !submit.isKing ? (submit.elapsedMs <= submit.king.elapsed_ms ? ' ahead' : ' behind') : ''}`}>
          ⏱ Your round {fmtElapsed(submit.elapsedMs)}
          {submit.king && submit.king.elapsed_ms !== null && !submit.isKing ? ` · ${submit.king.display_name} ${fmtElapsed(submit.king.elapsed_ms)}` : ''}
        </div>
      )}
      {submit.state === 'done' &&
        (submit.isKing ? (
          <div className="king-banner">
            <div className="king-crown">👑</div>
            <div className="king-title">King of the Throne</div>
            <div className="sub">
              {place.name} · {submit.score} (par {coursePar}) · {submit.holeScores.join('-')}
              {submit.elapsedMs !== null && ` · ${fmtElapsed(submit.elapsedMs)}`}
            </div>
          </div>
        ) : (
          <div className="sub">
            {submit.king ? (
              <>
                <Avatar av={submit.king.avatar} size={28} className="row-avatar" />
                <strong>{submit.king.display_name}</strong> keeps the throne with <strong>{submit.king.score}</strong>
                {submit.king.hole_scores && ` (${submit.king.hole_scores.join('-')})`}
                {submit.king.elapsed_ms !== null && ` in ${fmtElapsed(submit.king.elapsed_ms)}`}. Beat it next visit.
              </>
            ) : (
              'Recorded. The throne stays empty until someone finishes all three holes.'
            )}
          </div>
        ))}
    </div>
  );

  return (
    <PlayView
      key={holes[0].id}
      holes={holes}
      courseSeed={null}
      onExit={toMap}
      exitLabel="Map"
      lockedParams={DEFAULT_PARAMS}
      noRetry={throne}
      timerFrom={timerFrom}
      raceMs={throne ? (king?.elapsed_ms ?? null) : null}
      raceLabel={king?.display_name ?? null}
      onHoleDone={onHoleDone}
      scorecardExtra={
        throne ? (
          <>
            {throneStatus}
            <LocationBoard locationId={locationId} refreshKey={submit.state === 'done' ? 1 : 0} />
          </>
        ) : (
          <div className="sub" style={{ marginBottom: 10 }}>
            {offline ? 'Practice (offline) · ' : 'Practice · '}
            {king ? (
              <>
                <Avatar av={king.avatar} size={28} className="row-avatar" />
                <strong>{king.display_name}</strong> holds the throne with <strong>{king.score}</strong>
                {king.hole_scores && ` (${king.hole_scores.join('-')})`}
                {king.elapsed_ms !== null && ` in ${fmtElapsed(king.elapsed_ms)}`}
              </>
            ) : (
              'nobody holds this throne yet'
            )}
            <LocationBoard locationId={locationId} refreshKey={0} />
          </div>
        )
      }
      renderDoneCard={(info, actions) => (
        <>
          <div className="sub">
            {throne ? 'Throne run' : 'Practice'} · hole {info.holeIndex + 1} of {HOLES_PER_COURSE}
          </div>
          <button className="primary" onClick={actions.next}>
            {info.holeIndex + 1 < HOLES_PER_COURSE ? 'Next hole →' : 'See scorecard'}
          </button>
          {!throne && <button onClick={actions.retry}>Retry hole</button>}
          {!throne && <button onClick={toMap}>Back to map</button>}
        </>
      )}
    />
  );
}
