# Championship graphics preview — do not merge wholesale

This branch is an isolated, playable visual experiment. Its App entry point deliberately replaces the live menus with a one-hole comparison. If this direction is approved, port the renderer selectively into the normal game; do not merge this preview App into production.

## Protected live version

- Commit: b711faeb21b99c771e3a64bb6b3e5fbcd8bb1c43
- Remote checkpoint: checkpoint/live-before-graphics-2026-09-13
- Experiment: preview/championship-graphics

The preview uses the original The Elbow hole (COURSE[1]) and DEFAULT_PARAMS. Simulation, collision geometry, aiming, scoring and course data are unchanged. Current / Upgraded swaps rendering without remounting PlayView. Restart preview resets the local round. No live matchmaking, presence, daily score submission or course record writes run in this preview.

Crowds remain animated around the course. Concessions and carried refreshments are omitted in both comparison modes. The upgraded direction adds textured turf, mowing bands, limestone borders, soft directional shading and landscaped trees.

## Artwork

public/art/tour-preview/turf.webp derives from an image-generated seamless overhead grass material: dense short emerald turf, tiny hand-painted blades, subtle organic variation, polished cheerful cartoon environment, uniform daylight, no objects, shadows, perspective, stripes, paths or text. Rendering applies original course geometry and procedural landscaping over this material.

## Validation

Production TypeScript/Vite build passed. The original hole and simulation files are unchanged.

Eight determinism and spectator-placement tests passed, including clearance from the playable floor without mutating hole data.
