# Earned balls and shirts

Thirteen new balls and thirteen shirts extend the permanent head collection. The original eleven balls and six shirts remain free. Every item uses the real modular SVG art in the customizer, profiles, match portraits, and the isolated `?preview=gear` gallery. Balls share their material paths with the course canvas renderer; no physical properties change. Shirts have individual fabric designs, collars, sleeves, and trim.

| Ball | Unlock | Shirt | Unlock |
| --- | --- | --- | --- |
| Royal Pearl | 250 TP | Varsity | 350 TP |
| Meteor | 5 ranked wins | Trail Caddy | 4 map locations |
| Ooze Ball | 3 map locations | Wave Rider | 7 daily course days |
| Glacier | 5 daily course days | Tour Pro | 8 ranked wins |
| Court King | 15 ranked wins | Star Chaser | 1,250 TP |
| Sushi Roll | 15 aces | Bad to the Bone | 20 aces |
| Orbit | 1,000 TP | Wild Thing | 8 map locations |
| Sugar Rush | 15 daily course days | Inferno | 30 ranked wins |
| Black Pearl | 12 map locations | Sprinkle Drip | 18 daily course days |
| Dragon Egg | 35 ranked wins | Circuit Breaker | 2,300 TP |
| Disco Ball | 40 aces | Dragon Guard | 60 ranked wins |
| Nebula | 2,800 TP | Royal Robes | 4,400 TP |
| Crown Jewel | 5,000 TP | Ace of Clubs | 60 aces |

TP unlocks spend no points. Map progress counts completed rounds at distinct real map locations. Daily progress counts completed nine-hole courses on distinct dates, without a consecutive-day requirement. Ranked win requirements exclude friend matches. Aces include verified daily, map, and completed match holes using the existing head progress calculation.

The customizer's expanded collection uses three columns for legible names and art. A locked item can be previewed without changing the saved avatar. Its requirement and verified progress are displayed above the collection; saving is disabled during locked previews. Return to the saved look or select an unlocked item to save.

`refresh_avatar_collection` wraps the existing head progress function and records qualified gear in `avatar_gear_unlocks`. Award rows are permanent. Existing achievements are credited on migration, and refresh occurs when opening the customizer or verifying an equip. Account linking preserves both collections and the saved avatar. The legacy `avatar-heads` response retains its head fields and adds `shirts` and `balls` for cache compatibility.

The catalog and awards tables use RLS and service-only grants. The Edge Function takes the user ID from its verified session; clients never submit achievement totals. Equip validation rejects a locked head, shirt, or ball. A profile trigger also rejects direct client assignments of earned gear, requiring the verified profile editor. Public art previews grant no unlocks.

The gameplay engine stays pinned to the existing release. No scoring, matchmaking, ball radius, simulation, TP awards, or navbar changes are included.

Validation: TypeScript and production build, modular avatar compatibility tests, identical ball path checks for SVG/canvas, and Postgres integration tests covering verified milestones, old/new catalogs, permanent awards, account moves, and denied direct grants. Collection sheets are rendered from the same code as the live assets.
