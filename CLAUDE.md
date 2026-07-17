# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working rules

- Ask when implementation certainty is below 95%.
- Respect established specs strictly. Do not patch behavior opportunistically when the implementation diverges from the spec.
- If a gap, ambiguity, or design failure is discovered, stop and discuss how to enrich or correct the spec before changing the implementation.
- Demos exist to validate the project and reveal missing pieces; they must not hide gaps or be made to work at all costs.
- Never deviate from a validated plan's text at implementation time — even for an apparent improvement (an optimization, a shortcut). Stop and ask first.
- Before calling a chantier done, actually exercise the base interaction it touches (not just its own target scenario) — run the app, don't just read the diff.

## Commands

```bash
# Development (from repo root)
npm run dev:demos    # Vite dev server for demos (port 5173)
npm run dev:editor   # Vite dev server for editor (port 5174)

# Build (from repo root)
npm run build        # build the codplay library

# Tests (from repo root)
npm run test                          # all tests
npm run test:gates                    # critical gate tests only (lot7, lot8, lot18)

# Tests (from packages/codplay)
npm run test:lot lot3                 # one specific lot
npm run test:lot lot3 lot12           # multiple lots
node scripts/run-tests.mjs watch      # watch mode

# Run a single test file directly (from packages/codplay)
npx vitest run tests/v1/reference-scenes.spec.ts
npx vitest run tests/lot13/create-player.spec.ts
```

Tests are split into `tests/lot1`–`tests/lot20` (feature-focused) and `tests/v1/` (comprehensive spec compliance). Gate tests (lot7, lot8, lot18) must pass before merging.

## Architecture

The system has three layers: **Builder** compiles authored scene definitions into a normalized `CompiledScene`; the **Player** is a lifecycle state machine that ingests a `CompiledScene` and drives playback; the **Runtime** executes component mutations frame-by-frame against the DOM.

### Scene authoring model

A `SceneDoc` is the top-level authored artifact. It contains:
- `stories`: map of `StoryDef`, each owning `persos` (visual components), `eventimes` (timeline-scheduled events), and `listen` (reactive rules).
- `tracks`: optional metadata per story (e.g. `role: "master"` for horizon projection).
- `rootStories`: which stories auto-initialize.

The builder (`packages/codplay/src/builder/`) normalizes a `SceneDoc` into a `CompiledScene` with fully resolved IDs, validated perso types, and a flat event schedule. This is a pure transformation — no side effects.

### Player lifecycle

`PlayerApi` (`packages/codplay/src/player/player.ts`):
```
init → play ↔ pause/resume → stop → destroy
                ↕
              seek / emit
```

`player.init({ mountTarget, compiledScene, strapCollection })` wires the scene to the DOM and prepares tracks. `player.play()` starts the timeline ticker. `player.seek({ timelineMs })` replays materialized track events to reconstruct state — it never re-executes straps or effects.

The player exposes `player.schedule` (a `RuntimeScheduleHelpers` facade) for imperative event scheduling outside of straps.

### Straps

Straps are the primary behavior unit — pure functions triggered by named events:

```ts
type StrapCollection = Record<string, (input: StrapInput) => StrapReturnValue>
```

A strap receives `{ event, state, meta, context }` and can return:
- `StrapRuntimeOutput` (`{ events?, update?, warnings? }`) — immediate effects.
- `PlannedStrapOccurrence[]` — declarative timeline steps (from `context.planned.*`).
- A mix of both in a flat or nested array (the runtime flattens recursively).

`context.planned.*` helpers (`wait`, `delay`, `repeat`, `stagger`, `loop`) return `PlannedStrapOccurrence[]` synchronously. No side effects during strap execution.

`context.live.*` helpers fire occurrence-by-occurrence at runtime and return `HelperHandle` (cancellable). `loop` is `jit`-only and supports `until: { type: "event", name }` for event-driven stopping.

`context.planned` is the default for finite sequences; `context.live` is for sequences that depend on future events or must be interruptible.

### Event materialization and seek

Every event and state mutation emitted by a strap is written to a **track** as a `TrackEntry`. `seek` replays these entries in track-then-insertion order; it never re-executes straps or `effects`.

`eventInsertMode` on a track entry controls live behavior:
- `apply-now` (default): materialized and applied immediately.
- `persist-only`: materialized but not applied live; replayed by seek. Reserved for cases where the live tracking (e.g. pointermove) has already produced the visual effect.
- `persist-future`: materialized and treated as a future event regardless of position.

`listen.transform` inherits the `eventInsertMode` of the triggering event. A strap body always emits `apply-now` regardless of the triggering event's mode.

### Runtime components

`packages/codplay/src/runtime/components/` contains typed component classes: `TextComponent`, `ImageComponent`, `MediaComponent`, `ListComponent`, `LayoutComponent`, `InputComponent`. The `RuntimeComponentOrchestrator` dispatches mutations to the correct component based on perso type.

Each component responds to action payloads (style, content, broadcast, etc.) resolved by the director from `perso.actions[eventName]`.

### Key source locations

| Area | Path |
|---|---|
| Player API + lifecycle | `packages/codplay/src/player/player.ts`, `create-player.ts` |
| Strap types | `packages/codplay/src/player/strap-types.ts` |
| Helper scheduling | `packages/codplay/src/player/helper-finite-core.ts`, `helper-loop-core.ts` |
| Builder normalization | `packages/codplay/src/builder/` |
| Runtime orchestration | `packages/codplay/src/runtime/components/runtime-component-orchestrator.ts` |
| Component types | `packages/codplay/src/runtime/types.ts` |
| Track management | `packages/codplay/src/track-manager/` |
| Authoring API | `packages/codplay/src/creator/` |
| Demo scenes | `packages/demos/src/scenes/` |
| Demo entry points | `packages/demos/src/codplay/` |
| Authoring helpers | `packages/authoring/capsule-automation/src/` |
| Specifications | `docs/formalisation/` |

### Specifications

All normative behavior is documented in `docs/formalisation/`. Key files:
- `v1-index.md` — index of all specs
- `v1-scene-spec.md`, `v1-story-spec.md`, `v1-perso-spec.md` — core domain model
- `v1-strap-helpers-spec.md` — scheduling helpers, `eventInsertMode`, `chunk.update`
- `v1-seek-spec.md` — seek policies, horizon, reconstruction rules
- `v1-event-spec.md` — event routing and lifecycle

When implementation diverges from these specs, the spec is authoritative unless a documented decision overrides it.
