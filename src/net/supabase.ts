import { createClient, type Session } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config';
import { normalizeAvatar, type Avatar } from '../game/avatarParts';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

const NAME_KEY = 'ppp.name.v1';
const AVATAR_KEY = 'ppp.avatar.v1';

/** The avatar this phone last saw for its player (drives the ball look in play). */
export function getSavedAvatar(): Avatar | null {
  try {
    const raw = localStorage.getItem(AVATAR_KEY);
    return raw ? normalizeAvatar(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
export function saveAvatar(av: Avatar | null): void {
  try {
    if (av) localStorage.setItem(AVATAR_KEY, JSON.stringify(normalizeAvatar(av)));
    else localStorage.removeItem(AVATAR_KEY);
  } catch {
    /* ignore */
  }
}

export function getSavedName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}
export function saveName(n: string): void {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* ignore */
  }
}

/** Anonymous session on demand. Throws a readable error if anonymous sign-in is disabled. */
export async function ensureSession(): Promise<Session> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.session) {
    throw new Error(
      /anonymous/i.test(error?.message ?? '')
        ? 'Anonymous sign-ins are off for this project. Enable them in Supabase → Authentication → Sign In / Providers.'
        : (error?.message ?? 'could not sign in'),
    );
  }
  return anon.session;
}

/**
 * The access token without waiting on the auth client. supabase-js serialises
 * every getSession() behind a browser lock, and a stalled token refresh on a
 * flaky phone connection can hold that lock for a long time. If the client
 * doesn't answer within `ms`, fall back to the session it persisted to
 * storage (still valid until `expires_at`), else null.
 */
export async function quickToken(ms = 1500): Promise<string | null> {
  const fromClient = supabase.auth.getSession().then(({ data }) => data.session?.access_token ?? null);
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), ms));
  const token = await Promise.race([fromClient, timeout]);
  if (token) return token;
  try {
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const stored = JSON.parse(raw) as { access_token?: string; expires_at?: number };
    if (stored.access_token && (!stored.expires_at || stored.expires_at * 1000 > Date.now() + 30_000)) return stored.access_token;
  } catch {
    /* ignore */
  }
  return null;
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Your profile as the server knows it. Caches the name locally. */
export async function loadProfile(): Promise<{ id: string; name: string | null; slogan: string | null; avatar: Avatar | null; email: string | null; anonymous: boolean } | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;
  const { data: row } = await supabase.from('profiles').select('display_name, slogan, avatar').eq('id', session.user.id).maybeSingle();
  const name = (row?.display_name as string | undefined) ?? null;
  if (name) saveName(name);
  const avatar = row?.avatar ? normalizeAvatar(row.avatar) : null;
  if (avatar) saveAvatar(avatar);
  return { id: session.user.id, name, slogan: (row?.slogan as string | null | undefined) ?? null, avatar, email: session.user.email ?? null, anonymous: !!session.user.is_anonymous };
}

/** Attach an email to the current (anonymous) account so it can be recovered on any phone. Sends a confirmation link. */
export async function linkEmail(email: string): Promise<void> {
  await ensureSession();
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: window.location.origin });
  if (error) throw new Error(error.message);
}

/** Sign in to an existing account by magic link. */
export async function signInWithEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin } });
  if (error) throw new Error(/signups not allowed|not found/i.test(error.message) ? 'No account uses that email yet. Save your account first on the phone that has it.' : error.message);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  try {
    localStorage.removeItem(NAME_KEY);
  } catch {
    /* ignore */
  }
}
