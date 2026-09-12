import { PlayView } from './game/PlayView';
import { GeneratedCourse } from './game/GeneratedCourse';
import { TitleScreen } from './game/TitleScreen';
import { Suspense, lazy, useEffect } from 'react';
import { stopTheme } from './game/music';
import { EditorView } from './editor/EditorView';
import { COURSE } from './holes';
import { navigate, useLocation } from './router';
import { InviteBanner } from './game/InviteBanner';
import { startPresence } from './net/presence';
import { ProfileLoading, prepareProfileArtwork } from './game/ProfileLoading';

// The map (Leaflet) and location play load on demand so the game shell stays small.
const MapScreen = lazy(() => import('./game/MapScreen').then((m) => ({ default: m.MapScreen })));
const LocationPlay = lazy(() => import('./game/LocationPlay').then((m) => ({ default: m.LocationPlay })));
const LeaderboardScreen = lazy(() => import('./game/LeaderboardScreen').then((m) => ({ default: m.LeaderboardScreen })));
const MatchScreen = lazy(() => import('./game/MatchScreen').then((m) => ({ default: m.MatchScreen })));
const loadProfile = () => import('./game/ProfileScreen').then((m) => ({ default: m.ProfileScreen }));
const ProfileScreen = lazy(loadProfile);

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
  const menu = ['map', 'match', 'profile', 'leaders'].includes(loc.route) || (loc.route !== 'editor' && !loc.loc && !loc.seed && loc.course !== 'handmade');
  useEffect(() => { if (!menu) stopTheme(); }, [menu]);
  // Warm the profile after the menu has painted, before its tab is opened.
  useEffect(() => {
    if (!menu) return;
    const timer = window.setTimeout(() => {
      void loadProfile().catch(() => {});
      void prepareProfileArtwork();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [menu]);
  // Friends see you online, and their invites reach you, on every screen.
  useEffect(() => { startPresence(); }, []);
  return (
    <>
      <Screen loc={loc} />
      <InviteBanner />
    </>
  );
}

function Screen({ loc }: { loc: ReturnType<typeof useLocation> }) {
  if (loc.route === 'editor') return <EditorView onExit={() => navigate('play')} />;
  if (loc.route === 'map')
    return (
      <Suspense fallback={<Loading />}>
        <MapScreen />
      </Suspense>
    );
  if (loc.route === 'match')
    return (
      <Suspense fallback={<Loading />}>
        <MatchScreen key={loc.match ?? loc.code ?? 'lobby'} code={loc.code} matchId={loc.match} />
      </Suspense>
    );
  if (loc.route === 'profile')
    return (
      <Suspense fallback={<ProfileLoading publicProfile={!!loc.user} />}>
        <ProfileScreen key={loc.user ?? 'me'} userId={loc.user} addCode={loc.add} />
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
