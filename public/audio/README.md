# Native menu music

`potty-theme-v1.m4a` is the game's original eight-bar theme, rendered once
from `src/game/music.ts`, rather than synthesized on each player's phone.
It is AAC-LC, mono, 44.1 kHz, with the existing music and master levels baked
in for iOS. The second rendered pass supplies the loop's carried-over tails.

To rebuild with the pinned development renderer and ffmpeg installed:

```
npm run render:theme
```

The checked-in asset is copied by Vite; normal builds do not require ffmpeg
or execute the renderer. The renderer is never imported into the app bundle.
If the music changes, bump the asset filename and `themePlayer.ts` reference
because `/audio/` is served with immutable caching.

Playback deliberately uses an HTMLAudioElement directly, with no
createMediaElementSource or live Web Audio music fallback. Effects use a
separate lazy context that suspends after its scheduled tails finish.
