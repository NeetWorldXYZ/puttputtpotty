import { useEffect, useState } from 'react';
import { api, fmtElapsed, type DailyRow, type KingRow, type PlayerProfile } from '../net/api';
import { currentUserId } from '../net/supabase';
import { dailySeed } from './courses';
import { navigate } from '../router';
import { Avatar } from './Avatar';
import { ProfileStatIcon } from './ProfileStatIcon';
import { AccountSheet } from './AccountSheet';
import { MenuVolume } from './MenuControls';
import { TabBar } from './TabBar';
import './Ranks.css';

type Board = 'wins' | 'thrones' | 'daily';
type RankRow = {
  user_id: string;
  display_name: string;
  avatar: KingRow['avatar'];
  wins?: number;
  thrones?: number;
  total?: number;
  elapsed_ms?: number;
};

const boards: { key: Board; title: string; description: string; icon: 'win' | 'throne' | 'best' }[] = [
  { key: 'wins', title: 'Ranked Wins', description: 'Most ranked matches won', icon: 'win' },
  { key: 'thrones', title: 'Thrones Controlled', description: 'Most bathrooms owned', icon: 'throne' },
  { key: 'daily', title: 'Daily Course', description: "Today's leaderboard", icon: 'best' },
];

function profileRow(p: PlayerProfile): RankRow {
  return { user_id: p.id, display_name: p.name, avatar: p.avatar, wins: p.matches_won, thrones: p.thrones };
}

async function loadProfiles(ids: string[]): Promise<PlayerProfile[]> {
  const unique = [...new Set(ids)];
  const output: PlayerProfile[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(5, unique.length) }, async () => {
      while (next < unique.length) {
        const id = unique[next++];
        const profile = await api.profile(id);
        if (profile) output.push(profile);
      }
    }),
  );
  return output;
}

export function LeaderboardScreen() {
  const [board, setBoard] = useState<Board>(() =>
    new URLSearchParams(window.location.search).get('seed') === dailySeed() ? 'daily' : 'wins',
  );
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [rows, setRows] = useState<RankRow[] | null>(null);
  const [error, setError] = useState('');
  const [me, setMe] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const seed = dailySeed();

  useEffect(() => {
    void currentUserId().then(setMe).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError('');
    if (!ready) return;

    async function fetchBoard(): Promise<RankRow[]> {
      let friendIds: Set<string> | null = null;
      if (friendsOnly) {
        if (!me) return [];
        const friends = (await api.friends()).filter((friend) => friend.relation === 'friend');
        friendIds = new Set([me, ...friends.map((friend) => friend.user_id)]);
      }

      if (board === 'daily') {
        const daily = await api.leaderboard(seed);
        const visible = friendIds ? daily.filter((row) => friendIds!.has(row.user_id)) : daily;
        return visible.map((row: DailyRow) => ({
          user_id: row.user_id,
          display_name: row.display_name,
          avatar: row.avatar,
          total: row.total,
          elapsed_ms: row.elapsed_ms,
        }));
      }

      if (friendIds) {
        const profiles = await loadProfiles([...friendIds]);
        return profiles.map(profileRow).sort((a, b) =>
          board === 'wins'
            ? (b.wins ?? 0) - (a.wins ?? 0) || (b.thrones ?? 0) - (a.thrones ?? 0)
            : (b.thrones ?? 0) - (a.thrones ?? 0) || (b.wins ?? 0) - (a.wins ?? 0),
        );
      }

      const kings = await api.kings({ limit: 50 });
      if (board === 'thrones') return kings;

      // Ranked wins are already part of public profiles. Hydrate known competitors and
      // sort those real values without changing the server or its deployed schema.
      const profiles = await loadProfiles([...kings.map((king) => king.user_id), ...(me ? [me] : [])]);
      return profiles.map(profileRow).sort((a, b) =>
        (b.wins ?? 0) - (a.wins ?? 0) || (b.thrones ?? 0) - (a.thrones ?? 0) || a.display_name.localeCompare(b.display_name),
      );
    }

    void fetchBoard()
      .then((result) => !cancelled && setRows(result))
      .catch(() => !cancelled && setError('Could not load these rankings. Please try again.'));
    return () => {
      cancelled = true;
    };
  }, [board, friendsOnly, me, ready, retry, seed]);

  const selected = boards.find((item) => item.key === board)!;
  const valueLabel = board === 'wins' ? 'Wins' : board === 'thrones' ? 'Thrones' : 'Score';

  return (
    <div className={`leaders ranks-screen ranks-city-screen rk2-${board}`}>
      <main className="rk2-content">
        <header className="rk2-hero">
          <img className="rk2-scene" src="/art/ranks-city-hero.webp" alt="" />
          <MenuVolume />
          <img className="rk2-logo" src="/art/arcade-logo.webp" alt="Putt Putt Potty" />
          <div className="rk2-tagline">CHASE THE CROWN</div>
          <div className="rk2-sign rk2-sign-left">REAL<br />PLACES.<br />REAL<br />THRONES.</div>
          <div className="rk2-sign rk2-sign-right">BARS<br />RESTAURANTS<br />REST AREAS<br />HOTELS<br />AND MORE...</div>
        </header>

        <nav className="rk2-tabs" aria-label="Ranking categories">
          {boards.map((item) => (
            <button key={item.key} aria-pressed={item.key === board} onClick={() => setBoard(item.key)}>
              <ProfileStatIcon kind={item.icon} />
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </nav>

        <button className="rk2-friends-toggle" role="switch" aria-checked={friendsOnly} onClick={() => setFriendsOnly((value) => !value)}>
          <span className="rk2-friends-icon" aria-hidden="true"><i /><i /></span>
          <span><strong>Friends Only</strong><small>Show only rankings from your friends</small></span>
          <span className="rk2-switch" aria-hidden="true"><i /></span>
        </button>

        <section className="rk2-board" aria-label={`${selected.title} rankings`} aria-busy={!rows && !error}>
          <div className="rk2-columns"><span>#</span><span>Player</span><span>{valueLabel}</span></div>
          {error ? (
            <div className="rk2-empty" role="alert">{error}<button onClick={() => setRetry((value) => value + 1)}>Try again</button></div>
          ) : !rows ? (
            <div className="rk2-empty" role="status">Getting the latest rankings…</div>
          ) : rows.length === 0 ? (
            <div className="rk2-empty">
              <strong>{friendsOnly ? 'No friends on this board yet' : 'The crown is up for grabs'}</strong>
              <small>{friendsOnly ? 'Add friends to compare your scores.' : board === 'daily' ? 'Be the first to finish today’s course.' : 'Play to claim your place.'}</small>
              <button onClick={() => friendsOnly ? setFriendsOpen(true) : board === 'daily' ? navigate('play', seed) : navigate('match')}>
                {friendsOnly ? 'Find friends' : board === 'daily' ? 'Play daily' : 'Play now'}
              </button>
            </div>
          ) : (
            <ol>
              {rows.slice(0, 20).map((row, index) => (
                <li key={row.user_id} className={`${row.user_id === me ? 'rk2-mine ' : ''}rk2-place-${index + 1}`}>
                  <span className="rk2-number">{index + 1}</span>
                  <Avatar av={row.avatar} size={37} />
                  <button className="rk2-player" onClick={() => navigate('profile', null, null, { user: row.user_id })}>
                    <strong>{row.display_name}</strong>{row.user_id === me && <small>You</small>}
                  </button>
                  <strong className="rk2-value">{board === 'wins' ? row.wins ?? 0 : board === 'thrones' ? row.thrones ?? 0 : row.total ?? '–'}</strong>
                  {board === 'daily' && <small className="rk2-time">{row.elapsed_ms != null ? fmtElapsed(row.elapsed_ms) : '–'}</small>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
      {friendsOpen && <AccountSheet initialMode="friends" onClose={() => { setFriendsOpen(false); setRetry((value) => value + 1); }} />}
      <TabBar active="leaders" />
    </div>
  );
}
