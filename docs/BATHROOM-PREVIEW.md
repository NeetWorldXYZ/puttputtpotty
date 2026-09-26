# Bathroom Tour — isolated design preview

This branch is a complete playable visual prototype of Putt Putt Potty, built from the protected live checkpoint. **Do not merge this branch into main without a new, explicit decision from Kory.**

## Protection and scope

- Live baseline: `b711faeb21b99c771e3a64bb6b3e5fbcd8bb1c43`.
- Remote backup: `checkpoint/live-before-graphics-2026-09-13` at that same commit.
- New preview branch: `preview/bathroom-rebuild`.
- Previous experiment remains on `preview/championship-graphics` / draft PR 108.
- The preview entry mounts `BathroomApp` directly. It does not mount the live router, Supabase client, authentication, live matches, location services, or account persistence.
- Preview progression uses `ppp.bathroom-preview.v1` on the preview origin. The existing audio and control preferences also remain on that separate origin. No live score deletion, score submission, schema change or leaderboard mutation is part of this branch.
- A practice target, Bogey Bob, is explicitly labelled. Ranks contains local preview records, not invented live players or real ranked matchmaking.
- Returning to the current game means opening its existing production URL. Neither production nor the checkpoint needs a rollback.

## Playable content

Home, Match, six-venue directory, Ranks and Profile have a consistent navy, porcelain, cyan and warm-gold design. The mascot retains the cream face, sunglasses, crown and navy hoodie. The crowd uses varied human faces, caps, hair, skin tones and hoodies, with cached portraits and subtle waves, jumps and occasional captions. There are no concessions or spectator rail lines.

The 14 designed holes span Royal Restroom, Roadside Relief, Locker Room, After Hours, Porta Party and Orbital Outhouse. The Tour opens with Rise & Flush, Home Advantage and Pipe Dream. Other shapes include doglegs, split paths, loops, funnels, crosses and forked lanes. All designed holes have a solver route replayed into the cup. `scripts/build-bathroom-preview.ts` reproduces the pool; stored solutions are regression fixtures.

The random-course worker creates genuinely new geometry for 3, 6, 9 or 14 holes. It validates each hole and replays the generator's successful solution after applying room margins. A 45-second timeout, cancel action, retry and tested-tour fallback prevent an indefinite loading state.

The existing shot physics remain intact: paper bumpers, plunger posts, porcelain blockers, sticky gum, rough mats, water and drain hazards, moving gates, vent fans, pendulums and one-way pipes. Ramp zones are **2D slopes that accelerate the ball downhill**, with visual raised edges and directional cues; they are not a new 3D elevation or jumping engine. Pipes transport the ball using the existing simulated entry/exit mechanism.

The ball has a lit spherical surface, dimples, ground shadow, rim and color selection. Decor and crowds remain outside the playable wall boundary. Room materials and static course layers are cached. The Fredoka font is served locally with its license, so the menu does not wait on an external font provider. Moving-obstacle animation always uses simulation time even when decorative motion is reduced.

Daily Flush uses one Eastern calendar edition per day. Completed rounds are saved exactly once, including a full hole-by-hole recap. The recap stays open until the player continues. Pausing saves completed holes; resuming starts the unfinished hole again. A completed daily cannot be submitted twice locally. This is prototype persistence, not a secure ranked submission system.

All wardrobe items can be tried without affecting live unlocks. Preview challenge progress, TP, levels, crowns, aces, practice records and visit streaks derive from the same local result history. Crown definition for this preview: par or better on any hole in a bathroom theme.

## Design research

Two primary papers were downloaded and read before implementation:

1. Hunicke, LeBlanc & Zubek, **MDA: A Formal Approach to Game Design and Game Research**. https://users.cs.northwestern.edu/~hunicke/MDA.pdf
   Mechanics, dynamics and aesthetics should support one coherent player experience. Here, material choices explain collision types; score art escalates with achievement; shot physics stay familiar while the presentation changes.
2. Ryan, Rigby & Przybylski (2006), **The Motivational Pull of Video Games: A Self-Determination Theory Approach**. https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf
   Four studies associated autonomy, competence and relatedness with enjoyment and future play. Intuitive controls also mattered. Applied as course/theme choice, short optional rounds, readable feedback, learnable bank shots, alternate pipe routes and visible mastery progress. These studies do not guarantee retention for this game.

The goal is enjoyable replay and skill growth: clear controls, fast feedback, achievable challenges, variety and personality. There are no pay-to-win mechanics, pressure timers or paid retries.

## Artwork

Generated with the built-in image tool from the actual code-rendered mascot reference:

- `public/art/bathroom-rebuild/hero.webp`: indoor bathroom mini-golf tournament; original crowned cream-face mascot in navy hoodie; porcelain, chrome, teal tiles, copper plumbing and varied human spectators. No woodland or fantasy elements.
- `props.webp`: eight cohesive, shaded bathroom props in a 4×2 atlas: toilet, paper roll, plunger, vent, sink, soap, gum, pipe.
- `tiles.webp`: six orthographic material swatches for the six room themes.

The prop generation returned a baked checker background despite a transparent-background edit request. The source artwork is preserved. `spriteContours.json` supplies silhouette paths so the game's Canvas compositor clips each sprite cleanly; the prop QA sheet was visually checked for background leakage. No checkerboard is shown in the game.

Generated source images were produced in this session under `generated_images/exec-fbeed0b8-a47b-4366-bd3f-5b2e3fa792f4.png` (hero), `exec-151d85e8-c138-4487-a77b-89fadb3a1a10.png` (props), and `exec-bba8c50e-d835-4234-b49a-2ed5d7ee872b.png` (tiles). WebP deliverables in this repository are the durable production inputs. Existing on-brand mascot score illustrations are retained as part of the common visual language.

## Validation and practical limits

- `npm run build`: TypeScript and production bundling.
- `npm run test -- tests/bathroom-preview.test.ts tests/tunneling.test.ts tests/audio-lifecycle.test.ts`: 34 passing tests covering all designed routes, course variety, crowd boundaries, translated pipe exits, daily edition boundaries, daily deduplication, incomplete-round rejection, streaks, shared derived records, collision tunneling and existing audio lifecycle behavior.
- Native Canvas visual checks: the eight clipped props and the actual six-theme course renderer, including crowds and ball.
- Deployment checks are reported on the draft preview PR. Production and checkpoint refs are checked again before delivery.

A physical iPhone/CarPlay session and browser gameplay behind the account's Vercel preview protection cannot be certified by these checks. This branch is for hands-on review and is not a production release.
