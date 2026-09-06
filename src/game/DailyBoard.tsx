import { useEffect, useState } from 'react';
import { api, fmtElapsed, type DailyRow as Row } from '../net/api';
import { currentUserId } from '../net/supabase';

/** Today's course leaderboard (server-verified totals over all nine holes). */
export function DailyBoard({ seed, refreshKey }: { seed: string; refreshKey?: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void currentUserId().then((id) => !cancelled && setMe(id));
    api
      .leaderboard(seed)
      .then((r) => !cancelled && setRows(r))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [seed, refreshKey]);
  if (error) return <div className="lb-note">Leaderboard offline · {error}</div>;
  if (!rows) return <div className="lb-note">Loading leaderboard…</div>;
  if (!rows.length) return <div className="lb-note">No finished rounds yet today. Yours could be first.</div>;
  return (
    <div className="lb">
      <div className="lb-title">Today&apos;s leaderboard</div>
      <table>
        <tbody>
          {rows.slice(0, 10).map((r, i) => (
            <tr key={r.user_id} className={r.user_id === me ? 'me' : ''}>
              <td>{i + 1}.</td>
              <td style={{ textAlign: 'left' }}>{r.display_name}</td>
              <td>{r.total}</td>
              <td className="lb-time">{r.elapsed_ms ? fmtElapsed(r.elapsed_ms) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
