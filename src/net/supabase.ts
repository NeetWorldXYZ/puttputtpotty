import { createClient, type Session } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

const NAME_KEY = 'ppp.name.v1';

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

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
