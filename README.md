# Putt Putt Potty — Phase 1

Top-down 2D mini golf for phones, portrait, one thumb. This phase is the
physics engine, the hole data format, a level editor and three playable
test holes. Nothing else.

```
npm install
npm run dev        # game at http://localhost:5173/, editor at /editor
npm test           # replay-determinism + no-tunneling tests
npm run build      # typecheck + production build into dist/
```

Stack: Vite + React + TypeScript, HTML5 Canvas 2D. No game engine, no
physics library, no backend. Physics is hand-written in `src/sim/`.

## Layout

```
src/sim/        simulation — zero imports from the UI layer
  types.ts      Hole / zone / obstacle / Stroke types (the JSON format)
  params.ts     global physics params + defaults + dev-panel metadata
  geometry.ts   swept circle-vs-segment / circle-vs-point, point-in-polygon
  world.ts      compiles a Hole into flat collider lists
  sim.ts        SimState, applyStroke(), step(), runUntilRest()
  replay.ts     replay(hole, seed, strokes) -> final state
  rng.ts        mulberry32, state lives inside SimState
  validate.ts   runtime validation of imported hole JSON
src/render/     canvas renderer + camera (shared by game and editor)
src/game/       play view, drag input, HUD, dev panel, params store
src/editor/     level editor
src/holes/      the shipped holes (JSON) + index.ts (play order)
schema/         hole.schema.json (JSON Schema draft-07)
tests/          determinism.test.ts, tunneling.test.ts
```

## Playing

- Drag anywhere on screen and release. Default is **pull back to shoot**
  (drag away from the target, like a slingshot). Drag distance sets power;
  full power at 180 px (tunable). Drag back to near zero power and release
  to cancel.
- Stroke cap is 8. Sinking scores your strokes (capped at par + 4);
  failing to sink in 8 scores par + 4.
- Holes that fit the screen are shown whole; longer holes follow the ball
  with a minimap in the corner.
- `⚙` opens the dev panel: every physics constant as a live slider,
  input options (drag direction, drag distance, aim line length), hole
  jump buttons, and a "copy strokes JSON" button that exports the current
  hole's `{seed, strokes}` for replay.
- `✎` opens the editor.

## Hole JSON format

A hole is data. Units: **1 unit = one ball diameter** (ball radius 0.5).
`x` grows right, `y` grows **down** (canvas convention), so compass
directions are N = −y, S = +y, E = +x, W = −x.

```jsonc
{
  "version": 1,
  "id": "02-l-bend",            // unique, stable; also seeds the RNG
  "name": "The Elbow",
  "par": 3,
  "bounds": { "x": 0, "y": 0, "w": 30, "h": 60 },   // playfield rect
  "walls": [                    // line segments; optional per-wall restitution
    { "a": { "x": 17, "y": 56 }, "b": { "x": 17, "y": 18 } },
    { "a": { "x": 5, "y": 10 }, "b": { "x": 22, "y": 10 }, "restitution": 0.2 }
  ],
  "tee": { "x": 21, "y": 50 },
  "cup": { "x": 9, "y": 14 },
  "surfaceZones": [             // polygons; later zones override earlier ones
    { "polygon": [{ "x": 3, "y": 26 }, { "x": 10, "y": 26 }, { "x": 10, "y": 78 }, { "x": 3, "y": 78 }],
      "surfaceType": "tile" }   // felt | tile | shag | wet | sand | sticky
  ],
  "slopeZones": [               // overlapping slopes add up
    { "polygon": [...], "direction": "W", "grade": 1 }   // N NE E SE S SW W NW; grade 1..3
  ],
  "hazards": [
    { "polygon": [...], "type": "drain", "penalty": 1, "resetTo": "lastSafe" }
    // type: drain | water | outOfBounds | pit | overflow
    // resetTo: lastSafe (where the ball was before the stroke) | tee | entry
  ],
  "obstacles": [
    { "type": "blocker", "shape": { "kind": "rect", "x": 10, "y": 26, "w": 10, "h": 52 } },
    { "type": "blocker", "shape": { "kind": "circle", "x": 15, "y": 30, "r": 1.5 }, "restitution": 0.2 },
    { "type": "bumper",  "shape": { "kind": "circle", "x": 24, "y": 10, "r": 1.2 } }
  ]
}
```

Notes:

- **`bounds` is also a wall.** The ball can never leave the playfield
  rectangle, so a hole doesn't strictly need an outer wall loop, but the
  shipped holes draw one so the corridor reads clearly.
- **Walls are zero-thickness segments.** Collision is continuous (swept),
  so a ball cannot tunnel through one at any speed — see
  `tests/tunneling.test.ts`.
- **Surface zones** change friction (multipliers on base friction, all
  tunable in the dev panel). `sticky` stops the ball dead on entry.
- **Obstacles.** Phase 1 simulates `blocker` (rect or circle, plain wall)
  and `bumper` (circle, restitution 1.15 by default). The other obstacle
  type names from the design doc (`gate`, `post`, `pipe`, `windmill`, ...)
  are accepted by the schema so files written later still validate, but
  the sim ignores them and the renderer draws them as a grey outline.
  Their per-type settings go in a free-form `params` object.
- The full schema is in `schema/hole.schema.json`;
  `src/sim/validate.ts` is the runtime equivalent used by the editor's
  importer.

### Adding a new hole

1. Build it in the editor (`/editor`), test-play it until it's good, then
   **Export .json**.
2. Save the file as `src/holes/NN-name.json`.
3. Add it to the course in `src/holes/index.ts`:

   ```ts
   import myHole from './04-my-hole.json';
   export const COURSE: Hole[] = [straight, lBend, splitPath, myHole as Hole];
   ```

4. `npm test` — the determinism test runs across every hole in the course.

## Physics

Fixed timestep of **1/120 s** (`FIXED_DT`), accumulator pattern in the
play view; rendering interpolates between the previous and current step
and never drives the simulation.

Per step, in order:

1. Zone lookup at the ball centre (surface, slope, sticky).
2. Slope acceleration: `v += grade × slopeAccelPerGrade × dir × dt`.
3. Friction as velocity damping: `v *= 1 − baseFriction × surfaceMult × dt`.
4. Move with continuous collision detection: find the earliest time of
   impact against every wall segment (as a capsule: faces + endpoint
   circles) and circle, advance to it, reflect with restitution, repeat
   for the remaining time (up to 12 contacts per step). Hits within 1e‑7 s
   of each other are merged and their normals averaged so shared
   vertices and concave corners don't double-reflect. Normal speeds below
   0.75 u/s don't bounce, they slide, which kills wall jitter. A static
   push-out pass cleans up any residual overlap.
5. Cup check along the whole swept path: within cup radius and at or
   below the capture speed sinks it; faster **lips out** — the velocity
   is bent away from the cup centre in proportion to how off-centre the
   pass was, speed is bled to 82 %, and the cup ring flashes. The cup is
   ignored for 0.25 s after a lip-out, so a ball that rattles and slows
   can still drop.
6. Hazard check along the swept path (sampled every half ball radius):
   penalty added, ball reset per `resetTo`, stroke ends.
7. Rest: below `restThreshold` → snap to zero and end the stroke. On a
   slope the ball has to stay slow for 0.5 s first, so a pinned ball
   rests but a free one keeps rolling.
8. `maxSimTime` (8 s) hard stop.

### Parameter interpretation

Defaults come from section 1 of the parameter doc. Two rows needed a
reading:

- **Base friction 0.85** is implemented as a *damping coefficient per
  second* (`v *= 1 − 0.85·dt`). That gives a full-power shot on felt a
  roll-out of ~70 units in ~5.6 s, which is the only interpretation that
  lands inside the 8 s max sim time; "0.85 × per second" or a linear
  0.85 u/s² would take 30 s+. Slider: *Base friction (felt)*.
- **Power curve "ease-out"** — the note next to it says eased gives finer
  control on short putts, which is what a >1 exponent does (small drags →
  small power). Default exponent 1.6; 1.0 is linear. Slider: *Power curve
  exponent*.

Everything else is used literally: max velocity 60 u/s, wall restitution
0.75, rest threshold 0.5 u/s, cup capture 18 u/s, cup radius 1.2 × ball
radius, slope 12 u/s² per grade.

Values not in the spec (surface multipliers, bumper/dead-wall
restitution, lip-out feel, drag distance) are phase-1 choices and also on
sliders. Slider values persist in `localStorage`.

## Determinism

- The sim never calls `Math.random()`; a mulberry32 state is carried in
  `SimState.rng`. Phase 1 physics doesn't consume it (bank shots must be
  predictable), it's threaded through for later phases.
- `SimState` is a plain object. `JSON.parse(JSON.stringify(state))` is a
  valid clone at any point — a test round-trips it every step.
- Inside `step()` only `+ − × ÷`, comparisons and `Math.sqrt` are used,
  all of which are correctly rounded under IEEE‑754, so results are
  bit-identical across JS engines. `Math.cos/sin/pow` are used exactly
  once per stroke in `applyStroke()` to turn `{angle, power}` into a
  launch velocity. (Nothing uses `Math.hypot`, `exp` or `atan2`, whose
  last-bit results vary between engines.)
- Collider and zone iteration order is the JSON order, so it's stable.
- `replay(hole, seed, strokes)` in `src/sim/replay.ts` is the
  verification entry point. `tests/determinism.test.ts` proves the same
  inputs produce a bit-identical final state, that step batching doesn't
  matter, and that the state survives serialisation mid-flight.

## Editor (`/editor`)

Desktop only. Keyboard: `V` select, `W` wall, `T` tee, `C` cup,
`S` surface, `L` slope, `H` hazard, `B` rect blocker, `O` circle blocker,
`U` bumper, `G` snap toggle, `F` fit, `P` test play, `Enter` finish,
`Esc` cancel, `Delete` remove, `Ctrl+Z` / `Ctrl+Shift+Z` undo / redo.
Wheel zooms, Alt‑drag or middle‑drag pans.

- Walls and zones are drawn by clicking points. Click the first point (the
  ringed one) to close a loop, or press Enter / double-click to finish an
  open polyline. Backspace removes the last point.
- Rect blockers and circles are dragged out.
- Select tool: click to select a wall segment / zone / obstacle / tee /
  cup; drag vertices (shared vertices move together), the tee, the cup
  or an obstacle body. The right panel edits the selection's properties.
- **Test play** swaps in the real game with the current hole; the back
  button returns with everything intact.
- The hole autosaves to `localStorage` on every change; refresh is safe.
- JSON panel: edit and **Apply**, **Export** (download), **Copy**,
  **Import** a file. Invalid files are rejected with the reason.

## Hosting

`/editor` is a real path. Vite's dev server serves it; on a static host
without an SPA fallback use `/#/editor` instead, which the router also
accepts.

## Out of scope in this phase

Backend, auth, database, GPS, generator, solver, moving obstacles,
tiers, daily course, practice mode, leaderboards, thrones, seasons,
accounts, notifications, sound, art.
