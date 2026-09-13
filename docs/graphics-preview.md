# Crown Falls — isolated graphics preview, do not merge wholesale

This branch replaces the live App entry point with a separate visual experiment. Keep PR 108 as a draft. If approved, selectively port the artwork and renderer; never merge the preview App wholesale into production.

## Protected live version

- Live commit and checkpoint: b711faeb21b99c771e3a64bb6b3e5fbcd8bb1c43
- Remote checkpoint branch: checkpoint/live-before-graphics-2026-09-13
- Preview branch: preview/championship-graphics
- Previous three-hole experiment remains in commit 33e70812ec2fb70879138bc4d6ec4c8d398daef3.

## Current experience

Crown Falls is a new single-hole art direction built around a custom portrait garden scene, rather than retouching the old procedural turf. It features sculpted porcelain-and-gold curbs, waterfalls, landscaped ponds and flowers, illustrated spectators, a gold crown bumper and a red plunger obstacle. The course entrance presents the entire artwork before Play this hole starts gameplay.

The art is a prerendered 2.5D background. Water highlights, waterfall streaks, bumper glint and crowd callouts animate independently; the illustrated spectator bodies are static in this first prototype. Reduced-motion mode suppresses those animations. A new porcelain cup is rendered at the actual capture circle, and the tall plunger handle is composited in front of a ball passing behind it.

The collision loop follows the visible inside edge of the putting turf, extracted from the artwork and simplified to 89 vertices. The bumper and plunger bases have matched circular collision shapes. The existing simulation, aiming, score recap and physics parameters are unchanged. Original / Revamp renders the same new hole with either renderer, preserving ball position and strokes when switched.

No live menus, matchmaking, presence, daily score submission or course record writes run here. The hole and artwork are bundled; no runtime course generation occurs. Required artwork is decoded before revealing the scene, with a timeout and retry state for load failures. The live game's files and checkpoint remain unchanged.

## Artwork provenance

- Project asset: public/art/crown-falls/course.webp (1024 × 1536)
- Built-in image-generation tool used, not CLI.
- Prompt: finished portrait overhead orthographic premium 3D cartoon mini-golf garden for Putt Putt Potty; continuous broad S-shaped lime-green putting fairway with ivory porcelain and gold curbs; turquoise ornamental ponds and sculpted waterfalls outside play, lush trees, flowers and rocks; organized crowned cartoon spectators outside the curbs; gold crown bumper and red plunger on the fairway; warm afternoon lighting, dimensional ceramic, brushed gold, rich ambient occlusion. No concessions, crowd ropes, interface, text, golf ball, cup or flag. The generated scene defines the exact prototype layout; pixel coordinates map to a 30 × 45 unit simulation space.

## Validation

- TypeScript/Vite production build passed.
- Existing solver accepted the hole (par 2), and the successful two-stroke solution replayed to a sunk ball through the unchanged simulation.
- Both full course renderers produced native Canvas frames without changing the hole data. The redesigned frame was visually inspected with the live ball and cup overlays.
- Vercel preview authentication prevents automated browser UI verification; native renderer validation does not replace a phone playtest.
