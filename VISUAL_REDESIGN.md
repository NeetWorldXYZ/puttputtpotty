# Royal Clubhouse visual pass

## Implemented

- Island-led home, gold daily CTA, cyan throne-map entry; no home map preview.
- Kingdom summary uses existing live counts, with em-dash placeholders when unavailable.
- Shared vector UI icons, rounded navigation, panels, button surfaces and focus states.
- Golf-course map palette: fairway greens, blue water, sand and cream cart paths.
- Crowned-toilet marker artwork: gray unclaimed, red claimed by another player, gold yours. Existing score badges remain.
- Profile, leaderboard, match, HUD, account and map-detail presentation updates.
- Course theme palettes, scenery shading, ball dimples and obstacle color treatments.

## Preserved

Simulation, physics, collision shapes, hole layouts, generation, scoring, record ownership,
check-in requirements, database, APIs and daily attempt restrictions are unchanged.
There are no attack timers, defense mechanics, fictional statistics or new destinations.

## Art scope

The shipped logo and island WebP artwork are reused. New UI and marker art is vector-native.
Course/obstacle changes are procedural styling, not a complete replacement sprite library.
No new dependencies are needed. Royal styles are isolated in src/royal.css.

## Review before merge

Browser preview was blocked from accessing the local server by network policy. Visual QA
is still required; this branch should not be treated as a fully approved production release.

- Check home at 320, 390, 430 and 768px widths, including completed daily state.
- Confirm all custom-length choices and lower menu items remain reachable by scrolling.
- Open map with real tiles and check unclaimed, rival, owned and selected pins at each zoom.
- Check long venue/player names, unavailable location and disconnected services.
- Inspect light and dark course themes, obstacle silhouettes, ball and aiming readability.
- Check profile, account, leaderboard, match and map-detail panels with real data.
- Check reduced motion and keyboard focus.

No merge or production deployment is part of this handoff.
