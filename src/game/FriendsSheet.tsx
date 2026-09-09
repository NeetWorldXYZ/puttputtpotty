import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type FriendLookupRow, type FriendRelation, type FriendRow } from '../net/api';
import { lastSeen, pokeFriend, useOnline } from '../net/presence';
import { navigate } from '../router';
import { Avatar } from './Avatar';
import { sfx } from './sound';
import './Friends.css';

const REFRESH_MS = 20_000;

function relationLabel(r: FriendRelation): string {
  switch (r) {
    case 'friend':
      return 'Friends';
    case 'outgoing':
      return 'Request sent';
    case 'incoming':
      return 'Wants to be friends';
    case 'blocked':
      return 'Blocked';
    case 'me':
      return "That's you";
    default:
      return '';
  }
}

/**
 * Your friends: who is on, who wants in, and a Play button that opens an
 * invite match and pokes them. Add people by their code (shared from here)
 * or by the start of their name. Lives inside the player locker.
 */
export function FriendsPanel({ initialQuery }: { initialQuery?: string | null }) {
  const [rows, setRows] = useState<FriendRow[] | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery ?? '');
  const [results, setResults] = useState<FriendLookupRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const isOnline = useOnline();
  const searchTimer = useRef(0);

  const load = useCallback(async () => {
    try {
      setRows(await api.friends());
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    void api.myFriendCode().then(setCode).catch(() => {});
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  // Search as you type, a beat after the last key.
  useEffect(() => {
    window.clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    searchTimer.current = window.setTimeout(() => {
      api
        .friendLookup(q)
        .then(setResults)
        .catch((e: Error) => setErr(e.message));
    }, 350);
    return () => window.clearTimeout(searchTimer.current);
  }, [query]);

  const say = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };
  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const request = (r: FriendLookupRow) =>
    act(`req:${r.user_id}`, async () => {
      const rel = await api.friendRequest(r.user_id);
      sfx.pop();
      say(rel === 'friend' ? `You and ${r.display_name} are friends.` : `Request sent to ${r.display_name}.`);
      setResults((rs) => rs?.map((x) => (x.user_id === r.user_id ? { ...x, relation: rel } : x)) ?? null);
      await load();
    });
  const respond = (f: FriendRow, accept: boolean) =>
    act(`resp:${f.user_id}`, async () => {
      await api.friendRespond(f.user_id, accept);
      if (accept) {
        sfx.jingle();
        say(`You and ${f.display_name} are friends.`);
      }
      await load();
    });
  const remove = (f: FriendRow) =>
    act(`rm:${f.user_id}`, async () => {
      await api.friendRemove(f.user_id);
      setMenu(null);
      await load();
    });
  const block = (f: FriendRow) =>
    act(`bl:${f.user_id}`, async () => {
      await api.friendBlock(f.user_id);
      setMenu(null);
      say(`${f.display_name} is blocked.`);
      await load();
    });
  const play = (f: FriendRow) =>
    act(`play:${f.user_id}`, async () => {
      const m = await api.createInvite(9);
      await api.inviteFriend(f.user_id, m.id);
      void pokeFriend(f.user_id);
      sfx.whoosh();
      navigate('match', null, null, { match: m.id });
    });
  const join = (f: FriendRow) =>
    act(`join:${f.user_id}`, async () => {
      if (f.invite_id) await api.inviteRespond(f.invite_id, true);
      sfx.whoosh();
      navigate('match', null, null, { code: f.invite_code });
    });
  const share = async () => {
    if (!code) return;
    const url = `${location.origin}/profile?add=${code.replace('-', '')}`;
    const text = `Add me on Putt Putt Potty. My friend code is ${code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Putt Putt Potty', text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        say('Copied. Send it to a friend.');
      }
    } catch {
      /* cancelled */
    }
  };

  const friends = rows?.filter((r) => r.relation === 'friend') ?? [];
  const incoming = rows?.filter((r) => r.relation === 'incoming') ?? [];
  const outgoing = rows?.filter((r) => r.relation === 'outgoing') ?? [];
  const onlineCount = friends.filter((f) => isOnline(f.user_id)).length;

  return (
    <div className="friends-panel">
        <div className="fr-sub">{rows === null ? 'Loading…' : friends.length === 0 ? 'Nobody yet. Share your code or find a name.' : `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'} · ${onlineCount} online`}</div>

        <div className="fr-code">
          <span>
            <small>Your friend code</small>
            <b>{code ?? '…'}</b>
          </span>
          <button className="primary" onClick={() => void share()} disabled={!code}>
            Share
          </button>
        </div>

        <div className="fr-search">
          <input className="name-input" placeholder="Friend code or name" value={query} onChange={(e) => setQuery(e.target.value)} autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
        </div>
        {results && (
          <ul className="fr-list fr-results">
            {results.length === 0 && <li className="fr-empty">Nobody by that name or code.</li>}
            {results.map((r) => (
              <li key={r.user_id} className="fr-row">
                <Avatar av={r.avatar} size={36} />
                <span className="fr-who">
                  <strong>{r.display_name}</strong>
                  <small>{relationLabel(r.relation) || 'Not friends yet'}</small>
                </span>
                {(r.relation === 'none' || r.relation === 'incoming') && (
                  <button className="fr-btn primary" disabled={busy === `req:${r.user_id}`} onClick={() => void request(r)}>
                    {r.relation === 'incoming' ? 'Accept' : 'Add'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {incoming.length > 0 && (
          <>
            <div className="fr-head">Wants to be friends</div>
            <ul className="fr-list">
              {incoming.map((f) => (
                <li key={f.user_id} className="fr-row">
                  <Avatar av={f.avatar} size={36} />
                  <span className="fr-who">
                    <strong>{f.display_name}</strong>
                    <small>{f.thrones} {f.thrones === 1 ? 'throne' : 'thrones'}</small>
                  </span>
                  <button className="fr-btn primary" disabled={busy === `resp:${f.user_id}`} onClick={() => void respond(f, true)}>
                    Accept
                  </button>
                  <button className="fr-btn" disabled={busy === `resp:${f.user_id}`} onClick={() => void respond(f, false)}>
                    Ignore
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="fr-head">Friends</div>
        <ul className="fr-list">
          {rows !== null && friends.length === 0 && <li className="fr-empty">Share your code, or search a name above.</li>}
          {friends.map((f) => {
            const on = isOnline(f.user_id);
            return (
              <li key={f.user_id} className={`fr-row${on ? ' online' : ''}${f.invite_code ? ' invited' : ''}`}>
                <span className="fr-av">
                  <Avatar av={f.avatar} size={36} />
                  <i className="fr-dot" aria-hidden="true" />
                </span>
                <span className="fr-who">
                  <strong>
                    {f.display_name}
                    {f.house_tag && <em className="fr-tag">{f.house_tag}</em>}
                  </strong>
                  <small>
                    {f.invite_code ? `wants to play · ${f.invite_holes ?? 9} holes` : lastSeen(f.last_seen_at, on)}
                    {!f.invite_code && f.thrones > 0 ? ` · ${f.thrones} ${f.thrones === 1 ? 'throne' : 'thrones'}` : ''}
                  </small>
                </span>
                {f.invite_code ? (
                  <button className="fr-btn primary" disabled={busy === `join:${f.user_id}`} onClick={() => void join(f)}>
                    Join
                  </button>
                ) : (
                  <button className="fr-btn primary" disabled={busy === `play:${f.user_id}`} onClick={() => void play(f)}>
                    {busy === `play:${f.user_id}` ? '…' : 'Play'}
                  </button>
                )}
                <button className="fr-more" aria-label={`More for ${f.display_name}`} onClick={() => setMenu(menu === f.user_id ? null : f.user_id)}>
                  ⋯
                </button>
                {menu === f.user_id && (
                  <div className="fr-menu">
                    <button onClick={() => navigate('profile', null, null, { user: f.user_id })}>See profile</button>
                    <button onClick={() => void remove(f)}>Remove friend</button>
                    <button className="danger" onClick={() => void block(f)}>Block</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {outgoing.length > 0 && (
          <>
            <div className="fr-head">Sent</div>
            <ul className="fr-list">
              {outgoing.map((f) => (
                <li key={f.user_id} className="fr-row muted">
                  <Avatar av={f.avatar} size={36} />
                  <span className="fr-who">
                    <strong>{f.display_name}</strong>
                    <small>waiting for them</small>
                  </span>
                  <button className="fr-btn" disabled={busy === `rm:${f.user_id}`} onClick={() => void remove(f)}>
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {err && <div className="err">{err}</div>}
        {toast && <div className="fr-toast">{toast}</div>}
    </div>
  );
}
