import { useEffect, useRef, useState } from 'react';
import type { Hole } from '../sim/types';
import { DEFAULT_PARAMS } from '../sim/params';
import type { GeneratedHole } from '../generator/generator';
import { api, type King } from '../net/api';
import { watchPosition, type Fix } from '../net/geo';
import { bandFor, recallPlace } from '../net/places';
import { navigate } from '../router';
import { PlayView, type HoleDoneInfo } from './PlayView';
import { sfx } from './sound';
import { buzz } from './haptics';

interface Props {
  locationId: string;
  /** Submit the run for the throne (needs GPS + check-in); otherwise practice. */
  throne: boolean;
}

type Submit = { state: 'idle' } | { state: 'sending' } | { state: 'done'; score: number; king: King | null; isKing: boolean } | { state: 'error'; message: string };

const toMap = () => navigate('map');

/**
 * One bathroom's hole. The hole comes from the server (which founds the
 * bathroom on first visit); practice falls back to generating the same
 * seed locally when the backend is unreachable.
 */
export function LocationPlay({ locationId, throne }: Props) {
  const place = recallPlace(locationId);
  const [hole, setHole] = useState<Hole | null>(null);
  const [king, setKing] = useState<King | null>(null);
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
    api
      .hole(place)
      .then((r) => {
        if (cancelled) return;
        setHole(r.hole);
        setKing(r.king);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        if (throne) {
          setLoadError(e.message);
          return;
        }
        // Practice without a backend: same seed and band as the server would use.
        const band = bandFor(place.poiType, place.id);
        const w = new Worker(new URL('../solver/worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (ev: MessageEvent<{ generated?: GeneratedHole; error?: string }>) => {
          w.terminate();
          if (cancelled) return;
          if (ev.data.generated) {
            const h = ev.data.generated.hole;
            setHole({ ...h, id: place.id, name: place.name, theme: band.theme });
            setOffline(true);
          } else setLoadError(ev.data.error ?? e.message);
        };
        w.postMessage({ kind: 'generate', id: 1, options: { seed: place.id, difficulty: band.difficulty } });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, throne]);

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
    if (!throne) return;
    const f = fixRef.current;
    if (!f) {
      setSubmit({ state: 'error', message: 'No GPS fix. Your run was not submitted.' });
      return;
    }
    setSubmit({ state: 'sending' });
    api
      .submitLocation(locationId, info.strokes, f.lat, f.lng, f.accuracy)
      .then((r) => {
        setSubmit({ state: 'done', score: r.score, king: r.king, isKing: r.isKing });
        if (r.isKing) {
          sfx.fanfare('ace');
          buzz([30, 40, 30, 40, 80]);
        }
      })
      .catch((e: Error) => setSubmit({ state: 'error', message: e.message }));
  };

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

  if (!hole) {
    return (
      <div className="play">
        <div className="overlay" style={{ background: 'var(--page)' }}>
          <div className="card">
            <h2>Opening the stall</h2>
            <div className="sub">{place.name}</div>
            <button onClick={toMap}>Back to map</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PlayView
      key={hole.id}
      holes={[hole]}
      courseSeed={null}
      onExit={toMap}
      exitLabel="Map"
      lockedParams={DEFAULT_PARAMS}
      noRetry={throne}
      onHoleDone={onHoleDone}
      renderDoneCard={(info, actions) => (
        <>
          {throne ? (
            <div className="throne-result">
              {submit.state === 'sending' && <div className="sub">Submitting to the throne room…</div>}
              {submit.state === 'error' && <div className="err">{submit.message}</div>}
              {submit.state === 'done' &&
                (submit.isKing ? (
                  <div className="king-banner">
                    <div className="king-crown">👑</div>
                    <div className="king-title">King of the Throne</div>
                    <div className="sub">
                      {place.name} · {submit.score} (par {info.hole.par})
                    </div>
                  </div>
                ) : (
                  <div className="sub">
                    {submit.king ? (
                      <>
                        <strong>{submit.king.display_name}</strong> keeps the throne with <strong>{submit.king.score}</strong>. Beat it next visit.
                      </>
                    ) : (
                      'Recorded. The throne stays empty until someone sinks it.'
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="sub">
              {offline ? 'Practice (offline) · ' : 'Practice · '}
              {king ? (
                <>
                  <strong>{king.display_name}</strong> holds the throne with <strong>{king.score}</strong>
                </>
              ) : (
                'nobody holds this throne yet'
              )}
            </div>
          )}
          <button className="primary" onClick={toMap}>
            Back to map
          </button>
          {!throne && <button onClick={actions.retry}>Play again</button>}
        </>
      )}
    />
  );
}
