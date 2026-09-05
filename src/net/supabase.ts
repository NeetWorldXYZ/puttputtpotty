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

/** Your profile as the server knows it. Caches the name locally. */
export async function loadProfile(): Promise<{ id: string; name: string | null; email: string | null; anonymous: boolean } | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;
  const { data: row } = await supabase.from('profiles').select('display_name').eq('id', session.user.id).maybeSingle();
  const name = (row?.display_name as string | undefined) ?? null;
  if (name) saveName(name);
  return { id: session.user.id, name, email: session.user.email ?? null, anonymous: !!session.user.is_anonymous };
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
