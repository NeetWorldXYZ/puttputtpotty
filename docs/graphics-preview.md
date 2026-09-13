# Championship graphics preview — do not merge wholesale

This branch is an isolated, playable visual experiment. Its App entry point deliberately replaces the live menus with a three-hole comparison. If this direction is approved, port the renderer selectively into the normal game; do not merge this preview App into production.

## Protected live version

- Commit: b711faeb21b99c771e3a64bb6b3e5fbcd8bb1c43
- Remote checkpoint: checkpoint/live-before-graphics-2026-09-13
- Experiment: preview/championship-graphics

The preview bundles three prebuilt holes from the existing generator in src/game/previewCourse.json, using DEFAULT_PARAMS. The live simulation, aiming, scoring and original course files are unchanged. Both renderers receive the same hole geometry and obstacle clock. There is no runtime course generation or network fetch. Current / Upgraded swaps rendering without remounting PlayView. Restart preview resets the local round. No live matchmaking, presence, daily score submission or course record writes run in this preview.

Crowds remain animated around the course. Concessions and carried refreshments are omitted in both comparison modes. The upgraded direction adds textured turf, mowing bands, limestone borders, soft directional shading and landscaped trees.

## Preview course

1. **Bumper Bend — par 2:** L-bend with a bumper and faster tile surface.
2. **Split Decision — par 3:** split route, central blocker, bumper, plunger post, sand and drain hazard.
3. **Royal Windmill — par 5:** chamber with a rotating windmill, blockers, bumper, plunger post, shag, pit and drain hazards.

All three holes passed the existing generator's solver checks. They are bundled so every preview visitor receives the same course. Standard hole recaps advance through all three holes into a final scorecard; replay restarts the course.

## Artwork

public/art/tour-preview/turf.webp derives from an image-generated seamless overhead grass material: dense short emerald turf, tiny hand-painted blades, subtle organic variation, polished cheerful cartoon environment, uniform daylight, no objects, shadows, perspective, stripes, paths or text. Rendering applies original course geometry and procedural landscaping over this material.

## Validation

Production TypeScript/Vite build passed. Successful solver strokes were replayed through the simulation for every bundled preview hole. The original live hole and simulation files are unchanged.

Eight determinism and spectator-placement tests passed, including clearance from the playable floor without mutating hole data.
