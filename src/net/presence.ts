import { useEffect, useState } from 'react';
import { api, type MatchInvite } from './api';
import { ensureSession, supabase } from './supabase';

/**
 * Who is online and who wants to play, app-wide.
 *
 * Online: everyone with the app open sits in one Realtime presence channel,
 * keyed by user id. Last seen: a heartbeat every two minutes stamps the
 * profile, for friends whose phone has put the app to sleep. Invites: a
 * friend who invites you pokes your own channel; the app also asks the
 * server on each heartbeat, so a missed poke still lands.
 */
type Listener = () => void;
let started = false;
let me: string | null = null;
const online = new Set<string>();
let invites: MatchInvite[] = [];
const onlineListeners = new Set<Listener>();
const inviteListeners = new Set<Listener>();
const emit = (ls: Set<Listener>) => ls.forEach((l) => l());

const HEARTBEAT_MS = 120_000;

export function startPresence(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  void (async () => {
    const s = await ensureSession().catch(() => null);
    if (!s) {
      started = false;
      return;
    }
    me = s.user.id;
    const lobby = supabase.channel('lobby', { config: { presence: { key: me } } });
    lobby.on('presence', { event: 'sync' }, () => {
      online.clear();
      for (const k of Object.keys(lobby.presenceState())) online.add(k);
      emit(onlineListeners);
    });
    lobby.subscribe((st) => {
      if (st === 'SUBSCRIBED') void lobby.track({ at: Date.now() });
    });
    const mine = supabase.channel(`user:${me}`);
    mine.on('broadcast', { event: 'invite' }, () => void refreshInvites());
    mine.subscribe();
    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      void api.heartbeat().catch(() => {});
      void refreshInvites();
    };
    beat();
    setInterval(beat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', beat);
  })();
}

export async function refreshInvites(): Promise<void> {
  try {
    invites = await api.myInvites();
    emit(inviteListeners);
  } catch {
    /* next beat */
  }
}

export function dismissInvite(id: string): void {
  invites = invites.filter((i) => i.id !== id);
  emit(inviteListeners);
}

/** Tell a friend's open app to look for a new invite (best effort; the heartbeat catches the rest). */
export async function pokeFriend(userId: string): Promise<void> {
  const ch = supabase.channel(`user:${userId}`);
  try {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 4000);
      ch.subscribe((st) => {
        if (st === 'SUBSCRIBED') {
          clearTimeout(t);
          resolve();
        } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
          clearTimeout(t);
          reject(new Error(st));
        }
      });
    });
    await ch.send({ type: 'broadcast', event: 'invite', payload: { from: me } });
  } catch {
    /* they will see it on their next heartbeat */
  } finally {
    setTimeout(() => void supabase.removeChannel(ch), 500);
  }
}

export function isOnline(userId: string): boolean {
  return online.has(userId);
}

/** Re-renders when the online set changes. Returns a checker. */
export function useOnline(): (userId: string) => boolean {
  const [, bump] = useState(0);
  useEffect(() => {
    startPresence();
    const l = () => bump((n) => n + 1);
    onlineListeners.add(l);
    return () => {
      onlineListeners.delete(l);
    };
  }, []);
  return isOnline;
}

export function useInvites(): MatchInvite[] {
  const [list, setList] = useState<MatchInvite[]>(invites);
  useEffect(() => {
    startPresence();
    const l = () => setList(invites);
    inviteListeners.add(l);
    l();
    return () => {
      inviteListeners.delete(l);
    };
  }, []);
  return list;
}

/** "online", "5m ago", "yesterday". */
export function lastSeen(iso: string | null, isOn: boolean): string {
  if (isOn) return 'online';
  if (!iso) return 'not seen yet';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 180) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 172800) return 'yesterday';
  return `${Math.round(s / 86400)}d ago`;
}
