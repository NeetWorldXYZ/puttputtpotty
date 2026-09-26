import { beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ getSession: vi.fn(), signInAnonymously: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }));
import { ensureSession } from '../src/net/supabase';
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
