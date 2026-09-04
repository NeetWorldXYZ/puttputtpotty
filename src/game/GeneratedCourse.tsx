import { useEffect, useRef, useState } from 'react';
import type { Hole } from '../sim/types';
import { PlayView } from './PlayView';
import { useTuning } from './paramsStore';
import { goToCourse } from './courses';

interface Props {
  seed: string;
  count?: number;
  onOpenEditor?: () => void;
}

/** Generates a course in the solver worker, then plays it. */
export function GeneratedCourse({ seed, count = 9, onOpenEditor }: Props) {
  const tuning = useTuning();
  const [holes, setHoles] = useState<Hole[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    setHoles([]);
    setDone(false);
    setError(null);
    started.current = false;
    const w = new Worker(new URL('../solver/worker.ts', import.meta.url), { type: 'module' });
    const id = Date.now();
    w.onmessage = (e: MessageEvent<{ id: number; progress?: number; hole?: Hole; course?: { holes: { hole: Hole }[] }; error?: string }>) => {
      if (e.data.id !== id) return;
      if (e.data.error) setError(e.data.error);
      else if (e.data.hole) setHoles((h) => [...h, e.data.hole as Hole]);
      else if (e.data.course) {
        setHoles(e.data.course.holes.map((g) => g.hole));
        setDone(true);
      }
    };
    w.postMessage({ kind: 'course', id, seed, count, params: tuning.paramsRef.current });
    return () => w.terminate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, count]);

  if (!done) {
    return (
      <div className="play">
        <div className="overlay" style={{ background: 'var(--page)' }}>
          <div className="card" style={{ minWidth: 300 }}>
            <h2>{error ? 'Generation failed' : 'Building course'}</h2>
            <div className="sub">
              seed <strong>{seed}</strong>
              {!error && ` · hole ${Math.min(holes.length + 1, count)} of ${count}`}
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <table>
              <tbody>
                {Array.from({ length: count }, (_, i) => (
                  <tr key={i}>
                    <td>{i + 1}.</td>
                    <td style={{ textAlign: 'left', color: holes[i] ? 'var(--text)' : 'var(--dim)' }}>
                      {holes[i] ? holes[i].name : i === holes.length && !error ? 'generating…' : ''}
                    </td>
                    <td>{holes[i] ? `par ${holes[i].par}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {error && (
              <button className="primary" onClick={() => goToCourse('random')}>
                Try another seed
              </button>
            )}
            <button onClick={() => goToCourse('handmade')}>Handmade course instead</button>
          </div>
        </div>
      </div>
    );
  }

  return <PlayView holes={holes} onOpenEditor={onOpenEditor} courseSeed={seed} />;
}
