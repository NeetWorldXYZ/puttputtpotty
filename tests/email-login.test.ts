import { expect, it } from 'vitest';
import { emailLoginToken } from '../src/net/emailLogin';
const project = 'https://example.supabase.co';
it('exchanges the original email credential in the current app instead of navigating to Safari', () => {
  expect(emailLoginToken(` ${project}/auth/v1/verify?token=abc123&type=magiclink&redirect_to=https%3A%2F%2Fgame.example `, project)).toBe('abc123');
});
it('rejects unrelated projects, reset/change-email links and opened callback URLs', () => {
  for (const link of [
    'https://other.supabase.co/auth/v1/verify?token=abc&type=magiclink',
    `${project}/auth/v1/verify?token=abc&type=recovery`,
    `${project}/auth/v1/verify?token=abc&type=email_change`,
    'https://game.example/#access_token=secret',
    `${project}/somewhere?token=abc&type=email`,
    `${project}/auth/v1/verify?type=email`,
    'not a URL',
  ]) expect(() => emailLoginToken(link, project)).toThrow();
});
