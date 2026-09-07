# Gameplay materials and bathroom prop collection

This pass brings the playable course into the detailed 3D sprite style of the existing plunger and paper roll. Seven new transparent WebP assets share an overhead camera, upper-left illumination, realistic material highlights and restrained navy contours. Home, avatars and menu layouts are preserved.

## Coverage

| Item | Visual treatment |
| --- | --- |
| Toilet goal | Reflective gold crown on the tank; original drain center and capture circle retained |
| Plunger post / paper roll bumper | Approved sprites retained as the style reference; original registration preserved |
| Rectangular solid blocker | Soap-topped block with glazed shading; properly proportioned bars repeat along long walls |
| Polygon / circular blocker | Shape-fitted glazed ceramic, with no cropped or distorted soap image |
| Dead wall | Plush fiber material, teal stitching and folded towels for rectangular faces |
| Jumpable curb | Ribbed brass threshold with screws |
| Pipe entry / exit | Chrome flange sprites, paired connection and exit-direction arrow retained |
| Windmill | Brushed-metal blades, rubber tips and fasteners within original blade geometry |
| Sliding gate / piston | Brushed metal, sheen and fastening details |
| Moving luggage | Coral suitcase sprite clipped to original moving body |
| Pendulum | Specular red rubber head on original swinging arm |
| Sticky floor | Small irregular gum pieces over a translucent pink residue and faint boundary |
| Shag floor | Cotton loops, towel texture and stitched edging |
| Wet floor | Translucent water film and compact caution decal |
| Sand | Fine grains and rake grooves |
| Tile / felt | Ceramic sheen / turf material |
| Slopes | Less crowded directional markings, same direction and grade |
| Water / overflow | Recessed depth, caustics and foam; animated ripples clipped to hazard polygon |
| Drain / pit / out-of-bounds | Machined grille; recessed opening; hazard stripes |
| Tee / ball | Turf tee pad and shaded ball highlights with existing ball patterns |
| Room decor | Coordinated sink, plant, janitor bucket, soap, brush, towel, paper and luggage sprites across twelve themes |

The room floor finishes share material sheen and fine grain. Decor density is moderately increased, while keeping the existing no-playable-region and wall-clearance checks. Theme floors, colors and rails remain distinctive. Flat symbolic prop placements are replaced with the material-matched bathroom collection.

## Geometry and performance

No simulation, collision, scoring, course generation or multiplayer behavior is changed. Props are non-colliding scenery. Surface polygons are unchanged: gum splats are smaller artwork, not a smaller sticky hitbox. Pink residue still identifies the full sticky area. Shrinking that area requires a separate gameplay change.

New runtime assets total 191,994 bytes. Images are loaded once using the existing loader and static-cache revision system. New texture loops are bounded. Most texture work is in the static course layer; moving objects use small sprites or gradients. Existing procedural fallbacks remain available when images cannot load.

## Validation

- TypeScript / Vite build passed; 51 existing tests passed.
- Actual Canvas renders cover twelve room themes, 28 item samples, all three shipped courses at three animation phases with frozen input data, and three generated phone-size courses.
- Long obstacle sprites repeat instead of being stretched. Arbitrary polygon blockers use fitted ceramic material rather than clipping recognizable objects into unnatural shapes.
- These are renderer previews, not browser screenshots or on-device frame-rate measurements. Mobile interaction and performance should be reviewed in the deployment preview.
- Preview only. No merge or production promotion.

Reproduce with `node docs/art-preview/gameplay-preview.mjs` (esbuild and @napi-rs/canvas). PNG outputs are intermediate; WebP review sheets are committed.

## Generated asset prompt set

All seven assets were made with the built-in image generation tool, then alpha-preserving crop/resize and WebP conversion. Source art lives in `public/art/gameplay/`.

Shared direction: one isolated production sprite, actual transparent PNG background, direct overhead orthographic camera, premium realistic 3D bathroom mini-golf art, upper-left soft light, restrained navy contour, no scene, floor, branding or text.

- `gum.webp`: small irregular glossy warm-pink chewed gum splat, stretched ridges, five unequal rounded lobes and attached wisps; no perfect circle or rectangle.
- `crown.webp`: broad five-point reflective gold crown, beveled low band, three tiny turquoise cabochons; recognizable at 30 pixels; slight front-face visibility for the tank placement.
- `soap.webp`: horizontal mint-green glycerin bar, rounded corners, worn waxy edges, embossed blank oval and tiny attached bubbles; width twice height.
- `towel.webp`: thick folded ivory terry towel with two teal woven stripes, cotton loops, stitched hem and layered edge; square footprint.
- `flange.webp`: circular polished stainless plumbing flange, countersunk screws, concentric machined lips and dark navy opening; exact circular symmetry.
- `brush.webp`: clean cream-bristle toilet brush lying diagonally, teal rubber grip, molded highlights and hanging hole; no holder.
- `suitcase.webp`: coral hard-shell carry-on, horizontal rectangular footprint, molded ribs, inset handle, zipper seam and rubber corners; no extended trolley handle.
