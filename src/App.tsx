import { PlayView } from './game/PlayView';
import { GeneratedCourse } from './game/GeneratedCourse';
import { TitleScreen } from './game/TitleScreen';
import { Suspense, lazy } from 'react';
import { EditorView } from './editor/EditorView';
import { COURSE } from './holes';
import { navigate, useLocation } from './router';

// The map (Leaflet) and location play load on demand so the game shell stays small.
const MapScreen = lazy(() => import('./game/MapScreen').then((m) => ({ default: m.MapScreen })));
const LocationPlay = lazy(() => import('./game/LocationPlay').then((m) => ({ default: m.LocationPlay })));
const LeaderboardScreen = lazy(() => import('./game/LeaderboardScreen').then((m) => ({ default: m.LeaderboardScreen })));

function Loading() {
  return (
    <div className="play">
      <div className="overlay" style={{ background: 'var(--page)' }}>
        <div className="card">
          <h2>Loading…</h2>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const loc = useLocation();
  if (loc.route === 'editor') return <EditorView onExit={() => navigate('play')} />;
  if (loc.route === 'map')
    return (
      <Suspense fallback={<Loading />}>
        <MapScreen />
      </Suspense>
    );
  if (loc.route === 'leaders')
    return (
      <Suspense fallback={<Loading />}>
        <LeaderboardScreen />
      </Suspense>
    );
  if (loc.loc)
    return (
      <Suspense fallback={<Loading />}>
        <LocationPlay key={`${loc.loc}:${loc.mode}`} locationId={loc.loc} throne={loc.mode === 'throne'} />
      </Suspense>
    );
  if (loc.seed) return <GeneratedCourse key={`${loc.seed}:${loc.n ?? 9}`} seed={loc.seed} count={loc.n ?? 9} onOpenEditor={() => navigate('editor')} />;
  if (loc.course === 'handmade') return <PlayView holes={COURSE} onOpenEditor={() => navigate('editor')} courseSeed={null} />;
  return <TitleScreen />;
}
