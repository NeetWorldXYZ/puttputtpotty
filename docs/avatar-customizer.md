# Avatar dressing room

The customizer now uses a bathroom scene, a live modular golfer, six category tabs, isolated item previews, and a persistent Save button. It opens from the existing profile customization action. Account, identity, and friends forms keep their existing routes.

`avatarArt.ts` owns the shared vector artwork. Profiles, rankings, matches, and the editor all use it through `avatarSvg`; item cards use `avatarPartSvg`. Head and colour cards use a neutral expression independently of the equipped face and hat. Every face includes eyes and a mouth. The fire graphic is an emblem inside a circular ball, not a flame-shaped ball.

## Saved looks

The deployed backend imports the engine at `26fcf4621098b49d7aa759981df2665deb16ea61`. This change retains every accepted cosmetic key and the existing avatar schema. No database migration or backend deployment is needed. Additional existing colours, the halo, and patterned balls remain available under More.

Some cosmetic slots are deliberately refreshed as part of this redesign:

| Stored key | New artwork |
| --- | --- |
| Shirt `white` | White hoodie |
| Shirt `wood` | Pizza shirt |
| Face `sleepy` | Mustache, with visible eyes and a separate smile |
| Ball `tomato` | Fire emblem |
| Ball `lemon` | Gold golf ball |
| Ball `ink` | 8 ball |

Other selections retain their identity with upgraded art. The optional Cool expression still supplies sunglasses; choosing a new head never adds glasses. Ball emblems are also drawn in the course renderer without changing the ball radius, collision geometry, scoring, or physics.

Saving still uses the existing profile endpoint, then updates the local saved avatar only after success. Failed saves keep the editor open. A late profile response cannot replace a look the player has already started editing. Closing without saving leaves the persisted look unchanged.

## Background asset

`public/art/avatar-locker-room.webp` is an original generated illustration exported at 1200 × 800. The brief: a polished blue tiled bathroom dressing room in the game's navy-outline, softly shaded cartoon style; warm hanging lamps, a gold GOOD PUTTS BETTER DUMPS sign on the left, PLAY SIT REPEAT sign on the right, a plant and paper roll at left, a porcelain toilet and plunger at right, and an empty central area for a live avatar. No character or interactive UI is baked into the image. Editable avatar parts are drawn separately as vectors.

## Verification

- Production build (`npm run build`).
- Avatar tests (`npm test -- tests/avatar.test.ts`), including round-tripping every offered selection through the exact checked-in engine used by the deployed backend.
- Rendered artwork review: all five heads, expressions, hats, and round ball designs.
- Keyboard focus stays inside the editor; tabs support arrow keys, Home, and End. Escape and either close control dismiss the editor when it is not saving.

Publish this branch to a preview first. Production remains unchanged until the preview is approved.
