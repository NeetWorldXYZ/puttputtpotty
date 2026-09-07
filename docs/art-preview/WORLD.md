# Course world visual redesign

This builds on the combined approved arcade Home and gameplay sprite pilot. Home, navigation, geographic map ownership, course generation, physics, scoring and collision data are unchanged by this pass.

## Rendering changes

- All twelve room themes receive revised floor palettes and a shared material finish. Ceramic, stone, rubber, metal, wood, fabric, water and turf use deterministic procedural detail so arbitrary generated shapes remain supported.
- Room surrounds use subtle tile aprons. Rails have flush joint caps and fasteners.
- Solid blockers, rubber dead walls, caution curbs, surface zones and hazards gain clipped material finishes. Drains use recessed slots. Sliding gates and windmill blades receive material detailing within their original geometry.
- Three new overhead transparent WebP sprites: porcelain sink, resort plant and janitor bucket. They reuse the existing lazy image loader, vector fallbacks and static-cache revision system. Total additional runtime image payload: 78,806 bytes.
- Native furnishings redesigned: stall doors, dispensers/sensors, folded towels, suitcases, mirrors, bottles, brass taps, doilies, knit covers and potpourri bowls. Other theme accents remain native vectors.
- Decorative placements reject positions inside the playable region or too close to walls after jitter. This changes only decorative placement; it does not add colliders.

The three new sprite prompts used direct overhead orthographic adult arcade styling, navy contours, upper-left lighting, no text, faces, ground or background. They were generated with the image tool and optimized to 384px alpha WebP. Original toilet, plunger and paper-roll registration remains unchanged.

## Review

- `world-rooms.webp`: actual renderer, same shipped L-bend layout in all twelve themes.
- `world-items.webp`: enlarged actual renderer samples for material and fixture inspection.
- Reproduce PNG previews with `node docs/art-preview/world-preview.mjs` with esbuild and @napi-rs/canvas available. WebP files are optimized copies.
- Production build and all 47 existing tests pass. The preview script also checks that rendering each theme leaves its course data unchanged. Changes in this pass are restricted to render modules, art and preview documentation.
- These are Canvas render previews, not browser screenshots. Browser interaction and mobile frame-rate QA remain to be done in the deployment preview. No production deployment or merge is performed by this change.
