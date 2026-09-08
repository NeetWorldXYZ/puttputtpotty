# Gameplay sprite pilot

Three top-down, transparent WebP assets in public/art/gameplay: toilet, plunger, paper-roll. Generated with the built-in image tool and optimized to 512 pixels wide with alpha preserved. Reused by all themes; no images per course.

Prompt direction: orthographic overhead adult arcade art; glazed white porcelain with blue shading and brass flush button; circular red rubber plunger with diagonal wooden handle; circular embossed paper roll with cardboard core and short loose sheet. No faces, text, ground or scene. Upper-left light and navy contours.

The actual course renderer uses these images, with the previous vector drawings as loading/error fallbacks. Image readiness increments the static-layer cache version. Images are decoded once; static objects are drawn into the existing course cache. No added per-frame image decoding.

Registration uses normalized artwork anchors: plunger base center (.426,.626) and diameter .52; paper roll center (.48,.49) and diameter .80. The toilet drain anchors at (.50,.64); a native dark circle preserves the true capture radius. Transparent margins are intentionally retained. Decorative handles/tabs are not new colliders, as with the existing procedural versions.

Preview: sprite-course.webp. Left is the unchanged shipped Two Stalls hole rendered at 390x844 in full-course overview. Right shows enlarged sprites with gold contact circles for inspection. This is actual Canvas output, not an image-generation mockup. It is not a browser interaction or frame-rate test. The remaining course art is intentionally unchanged in this pilot.

Reproduce with node docs/art-preview/sprite-preview.mjs from the repo root, with esbuild and @napi-rs/canvas available. The script outputs PNG; the committed WebP is an optimized copy. Gameplay rules, camera, map ownership and hitboxes are unchanged. Geographic map pins stay as clear existing markers; these assets are for the playable course.
