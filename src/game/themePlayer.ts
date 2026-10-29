/**
 * Music uses the browser's native media pipeline, never a Web Audio node.
 * In particular, don't connect this element to an AudioContext: doing so
 * brings back the live context/output-route dependency this player removes.
 */
export function createThemePlayer(onInterrupted: () => void) {
  let element: HTMLAudioElement | null = null;
  let wanted = false;
  let generation = 0;

  return {
    setPlaying(play: boolean): void {
      if (play === wanted) return;
      wanted = play;
      const attempt = ++generation;
      if (!play) {
        element?.pause();
        return;
      }
      if (!element) {
        element = new Audio(`${import.meta.env.BASE_URL}audio/potty-theme-v1.m4a`);
        element.loop = true;
        element.preload = 'auto';
        // A pause while we still want playback came from the OS/another app.
        // Never fight it with a play() loop on ordinary taps.
        element.addEventListener('pause', () => {
          if (wanted && element?.paused) onInterrupted();
        });
        element.addEventListener('error', () => {
          if (wanted) onInterrupted();
        });
      }
      const media = element;
      const failed = () => {
        if (attempt === generation && wanted) onInterrupted();
      };
      try {
        if (media.error) media.load(); // Explicit retry after a failed download.
        void media.play().then(() => {
          // A slow load must never start music after leaving menus or muting.
          if (!wanted) media.pause();
        }, failed);
      } catch { failed(); }
    },
  };
}
