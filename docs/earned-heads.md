# Earned heads

Thirteen code-native vector heads are implemented in the same renderer used by profiles, leaderboards, matches, and the customizer. They share the existing face and hat anchors and have seven colourways. The original five heads and starter/bot selection are unchanged.

Open `?preview=heads` to inspect the artwork without signing in or playing a match. Each card opens a full-body portrait with working hat, face, shirt, and colour selectors and 32/44/60 px portrait samples. It does not mount the game, start presence, equip an avatar, grant a reward, or write a profile.

## Unlock behavior

The customizer shows all heads. Locked cards display verified progress; earned cards can be equipped. The server verifies every earned-head save, and unlock records are permanent. Existing verified history is backfilled. Unlocks follow an account when it is moved to a new device.

| Head | Milestone |
| --- | --- |
| Bubble Head | Level 4 / 450 TP |
| Bogey Bot | 10 ranked wins |
| Swamp Thing | Rounds completed at 5 distinct map locations |
| Count Flush | A daily course completed on 10 different dates, not necessarily consecutive |
| Shark Head | 25 lifetime aces |
| Porcelain Phantom | Level 8 / 1,750 TP |
| Trash Panda | Rounds completed at 15 distinct map locations |
| Hot Head | 50 ranked wins |
| Royal Lion | 5 simultaneously held thrones |
| Diamond Dome | Level 12 / 3,850 TP |
| Dunk Head (basketball) | 25 ranked wins |
| Big Dill (pickle) | Rounds completed at 10 distinct map locations |
| Glazed & Confused (doughnut) | A daily course completed on 20 different dates |

Unlocks never spend TP or change gameplay. Royal Lion is persisted at the moment the threshold is reached, so losing a throne later does not relock it. Earned heads do not enter the random starter or bot catalogs.

## Checks

- TypeScript and production build.
- Avatar test suite includes all thirteen new heads, all expressions and hats, independent part previews, colour/reference integrity, and existing server catalog round trips for the starter choices.
- Actual artwork is rendered locally and visually inspected in `public/art/earned-heads-review-v2.webp` and the larger four-head detail sheet `public/art/earned-heads-spotlight-v2.webp`. Reproduce with the exports in `scripts/render-earned-heads-v2.ts`.
- Database tests cover verified history, permanent Royal Lion awards, and account moves.

## Second art pass

Hot Head is redrawn as layered curling flames with no heavy outline around the inner heat. It now includes red/orange outer tongues, a yellow-white core, and floating embers. The first ten heads have refined highlights, edges, fur/metal/gem details, and silhouettes. The basketball has leather pebbling and recessed-looking seams, the pickle has brine highlights and raised bumps, and the doughnut has a genuine transparent centre, wider-set eyes, golden dough, flowing icing, and individual sprinkles.
