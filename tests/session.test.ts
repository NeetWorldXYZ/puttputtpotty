import { beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ getSession: vi.fn(), signInAnonymously: vi.fn(), verifyOtp: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }));
import { ensureSession, signInWithEmailLink } from '../src/net/supabase';
import { SUPABASE_URL } from '../src/net/config';
beforeEach(() => vi.resetAllMocks());

it('creates only one guest for concurrent first-visit requests', async () => {
  const session = { user: { id: 'new-guest' } };
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth.signInAnonymously.mockResolvedValue({ data: { session }, error: null });
  expect(await Promise.all([ensureSession(), ensureSession(), ensureSession()])).toEqual([session, session, session]);
  expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
});
it('uses the current saved session and checks it again after an account change', async () => {
  const guest = { user: { id: 'guest' } }, saved = { user: { id: 'saved-player' } };
  auth.getSession.mockResolvedValueOnce({ data: { session: guest } }).mockResolvedValueOnce({ data: { session: saved } });
  expect(await ensureSession()).toBe(guest);
  expect(await ensureSession()).toBe(saved);
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
});
it('does not replace an account after a session error, and can retry', async () => {
  auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Offline' } });
  await expect(ensureSession()).rejects.toThrow('Offline');
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
  const session = { user: { id: 'restored-player' } };
  auth.getSession.mockResolvedValueOnce({ data: { session } });
  expect(await ensureSession()).toBe(session);
});

it('finishes a copied email link using the persistent client in this app', async () => {
  const storage = { setItem: vi.fn(), removeItem: vi.fn() };
  vi.stubGlobal('localStorage', storage);
  try {
    auth.verifyOtp.mockResolvedValue({ data: { session: { user: { id: 'bobby' } } }, error: null });
    await signInWithEmailLink(`${SUPABASE_URL}/auth/v1/verify?type=magiclink&token=private_one_time_token`);
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'private_one_time_token', type: 'email' });
    expect(storage.removeItem).toHaveBeenCalledWith('ppp.name.v1');
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    storage.setItem.mockImplementation(() => { throw new Error('blocked'); });
    auth.verifyOtp.mockClear();
    await expect(signInWithEmailLink(`${SUPABASE_URL}/auth/v1/verify?type=magiclink&token=fresh_token`)).rejects.toThrow('Allow website storage');
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
