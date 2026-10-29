/** Only accept this project's original email verification URL, never arbitrary redirects. */
export function emailLoginToken(link: string, projectUrl: string): string {
  let url: URL;
  try { url = new URL(link.trim()); } catch { throw new Error('Paste the sign-in button’s link from your email.'); }
  const type = url.searchParams.get('type');
  const token = url.searchParams.get('token');
  if (url.origin !== new URL(projectUrl).origin || url.pathname !== '/auth/v1/verify' ||
      !['magiclink', 'email'].includes(type ?? '') || !token || !/^[a-zA-Z0-9_-]+$/.test(token)) {
    throw new Error('Copy the original sign-in link from your Putt Putt Potty email.');
  }
  return token;
}
