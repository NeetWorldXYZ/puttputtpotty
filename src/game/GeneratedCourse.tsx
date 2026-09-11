import { useEffect, useState } from 'react';
import type { Hole } from '../sim/types';
import { courseSlots, type GeneratedHole } from '../generator/generator';
import { PlayView, type HoleDoneInfo } from './PlayView';
import { EarnedTP } from './EarnedTP';
import { useTuning } from './paramsStore';
import { getBest, goToCourse, secondsUntilNextDaily } from './courses';
import { navigate } from '../router';
import { DEFAULT_PARAMS } from '../sim/params';
import { api } from '../net/api';
import { getSavedName } from '../net/supabase';
import { DailyBoard } from './DailyBoard';
import { NamePrompt } from './NamePrompt';

interface Props {
  seed: string;
  count?: number;
  onOpenEditor?: () => void;
}

/**
 * Generates a course with a pool of workers (one hole per worker, up to
 * the device's core count), then plays it. The plan (archetype /
 * difficulty / seed per hole) is deterministic, so the parallelism never
 * changes the result.
 */
export function GeneratedCourse({ seed, count = 9, onOpenEditor }: Props) {
  const tuning = useTuning();
  const [holes, setHoles] = useState<(Hole | null)[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The daily is ranked: generated with default physics (the server replays with the same) and each hole is submitted.
  const daily = /^\d{4}-\d{2}-\d{2}-(am|pm)$/.test(seed);
  const [alreadyPlayed, setAlreadyPlayed] = useState(daily && getBest(seed) !== null);
  const [checked, setChecked] = useState(!daily);
  const [statusError, setStatusError] = useState('');
  const [revision, setRevision] = useState(0);
  const [savedTotal, setSavedTotal] = useState<number | null>(getBest(seed));
  useEffect(() => {
    if (!daily) return;
    let live = true;
    setStatusError('');
    void api.dailyStanding(seed).then(standing => {
      if (!live) return;
      if (standing) { setAlreadyPlayed(true); setSavedTotal(standing.total); }
      setChecked(true);
    }).catch(() => { if (live) setStatusError('Could not check your round. Please retry.'); });
    return () => { live = false; };
  }, [seed, daily, revision]);
  const [askName, setAskName] = useState(daily && !getSavedName());
  const [submitted, setSubmitted] = useState(0);
  const [submissionFailed,setSubmissionFailed]=useState(false);

  useEffect(() => {
    const slots = courseSlots(seed, count);
    const results: (Hole | null)[] = slots.map(() => null);
    setHoles(results.slice());
    setDone(false);
    setError(null);
    const poolSize = Math.max(1, Math.min(slots.length, (navigator.hardwareConcurrency || 2) - 1, 6));
    const workers: Worker[] = [];
    let next = 0;
    let finished = 0;
    const id = Date.now();
    const params = daily ? DEFAULT_PARAMS : tuning.paramsRef.current;

    const feed = (w: Worker) => {
      if (next >= slots.length) return;
      const slot = slots[next++];
      w.postMessage({ kind: 'slot', id, courseSeed: seed, slot, params });
    };
    for (let i = 0; i < poolSize; i++) {
      const w = new Worker(new URL('../solver/worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<{ id: number; slot?: number; generated?: GeneratedHole; error?: string }>) => {
        if (e.data.id !== id) return;
        if (e.data.error) {
          setError(e.data.error);
          return;
        }
        if (e.data.generated && e.data.slot !== undefined) {
          results[e.data.slot] = e.data.generated.hole;
          setHoles(results.slice());
          finished++;
          if (finished === slots.length) setDone(true);
          else feed(w);
        }
      };
      workers.push(w);
      feed(w);
    }
    return () => workers.forEach((w) => w.terminate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, count]);

  if (daily && !checked) return <div className="play"><div className="overlay"><div className="card"><h2>{statusError || 'Checking your daily round…'}</h2>{statusError && <button onClick={() => setRevision(n => n + 1)}>Retry</button>}<button onClick={() => goToCourse('title')}>Home</button></div></div></div>;

  if (alreadyPlayed) {
    const h = Math.floor(secondsUntilNextDaily() / 3600);
    const m = Math.floor((secondsUntilNextDaily() % 3600) / 60);
    return (
      <div className="play">
        <div className="overlay" style={{ background: 'var(--page)' }}>
          <div className="card" style={{ minWidth: 300 }}>
            <h2>You&apos;ve played this one</h2>
            <div className="sub">
              You shot {savedTotal} · the next course opens in {h > 0 ? `${h}h ` : ''}
              {m}m
            </div>
            <p>Only a fully synced round appears on the leaderboard.</p><button onClick={() => { setChecked(false); setRevision(n => n + 1); }}>Retry leaderboard sync</button><DailyBoard seed={seed} refreshKey={revision} />
            <button className="primary" onClick={() => navigate('leaders', seed)}>
              Full leaderboard
            </button>
            <button onClick={() => goToCourse('random')}>Custom game instead</button>
            <button onClick={() => goToCourse('title')}>Home</button>
          </div>
        </div>
      </div>
    );
  }

  if (!done) {
    const built = holes.filter(Boolean).length;
    return (
      <div className="play">
        <div className="overlay" style={{ background: 'var(--page)' }}>
          <div className="card" style={{ minWidth: 300 }}>
            <h2>{error ? 'Generation failed' : 'Building course'}</h2>
            <div className="sub">
              seed <strong>{seed}</strong>
              {!error && ` · ${built} of ${count} ready`}
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <table>
              <tbody>
                {Array.from({ length: count }, (_, i) => (
                  <tr key={i}>
                    <td>{i + 1}.</td>
                    <td style={{ textAlign: 'left', color: holes[i] ? 'var(--text)' : 'var(--dim)' }}>
                      {holes[i] ? holes[i]!.name : error ? '' : 'generating…'}
                    </td>
                    <td>{holes[i] ? `par ${holes[i]!.par}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {error && (
              <button className="primary" onClick={() => goToCourse('random')}>
                Try another seed
              </button>
            )}
            <button onClick={() => goToCourse('title')}>Back to title</button>
          </div>
        </div>
      </div>
    );
  }

  const onHoleDone = daily
    ? (info: HoleDoneInfo) => {
        api
          .submitDaily(seed, info.holeIndex, info.strokes)
          .then(() => setSubmitted((n) => n + 1))
          .catch(() => {
            setSubmissionFailed(true);
          });
      }
    : undefined;

  return (
    <>
      <PlayView
        holes={holes as Hole[]}
        onOpenEditor={onOpenEditor}
        courseSeed={seed}
        lockedParams={daily ? DEFAULT_PARAMS : undefined}
        onHoleDone={onHoleDone}
        noRetry={daily}
        scorecardExtra={daily ? <>{submissionFailed?<p role="status">Some holes have not synced. Your shots are saved on this device; return Home and open Daily Results to retry.</p>:<EarnedTP context={`daily:${seed}`} pending={submitted<9}/>}<DailyBoard seed={seed} refreshKey={submitted} /></> : undefined}
      />
      {askName && <NamePrompt title="Name for the leaderboard" sub="Today's course is ranked. Pick the name others will see." onDone={() => setAskName(false)} onCancel={() => setAskName(false)} />}
    </>
  );
}
