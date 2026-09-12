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
import { PageReveal, MenuLoading, preparePageArtwork } from './game/PageReveal';
import { ProfileLoading, prepareProfileArtwork } from './game/ProfileLoading';

// The map (Leaflet) and location play load on demand so the game shell stays small.
const loadMap = () => import('./game/MapScreen').then((m) => ({ default: m.MapScreen }));
const MapScreen = lazy(loadMap);
const LocationPlay = lazy(() => import('./game/LocationPlay').then((m) => ({ default: m.LocationPlay })));
const loadLeaderboard = () => import('./game/LeaderboardScreen').then((m) => ({ default: m.LeaderboardScreen }));
const LeaderboardScreen = lazy(loadLeaderboard);
const loadMatch = () => import('./game/MatchScreen').then((m) => ({ default: m.MatchScreen }));
const MatchScreen = lazy(loadMatch);
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
  // Warm tab modules and hero art after the first menu paint.
  useEffect(() => {
    if (!menu) return;
    const timer = window.setTimeout(() => {
      void loadProfile().catch(() => {});
      void prepareProfileArtwork();
      for (const load of [loadMatch, loadLeaderboard, loadMap]) void load().catch(() => {});
      for (const page of ['play', 'match', 'leaders', 'map'] as const) void preparePageArtwork(page);
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
      <Suspense fallback={<MenuLoading page="map" />}>
        <PageReveal key="map" page="map"><MapScreen /></PageReveal>
      </Suspense>
    );
  if (loc.route === 'match')
    return (
      <Suspense fallback={<MenuLoading page="match" />}>
        <PageReveal key={loc.match ?? loc.code ?? 'lobby'} page="match"><MatchScreen code={loc.code} matchId={loc.match} /></PageReveal>
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
      <Suspense fallback={<MenuLoading page="leaders" />}>
        <PageReveal key="leaders" page="leaders"><LeaderboardScreen /></PageReveal>
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
  return <PageReveal key="play" page="play"><TitleScreen /></PageReveal>;
}
