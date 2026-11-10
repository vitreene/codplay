---
name: codplay-usage
description: Apply CodPlay scene, event, action, and playback contracts when building or changing player behavior in CodPlay or Elcé. Use whenever a change affects scene composition, reading, timing, reactions, replay, or animation; not for isolated editor UI work.
---

# CodPlay usage

CodPlay is the repository's scene and playback runtime. Treat its verified
specifications as the contract for how authored scenes become a compiled
timeline and how that timeline is played, reconstructed, and observed. It is
not a game engine; Elcé features author and compose scenes through CodPlay.

## Read the owning contract first

Read the verified specification that owns the capability. For player behavior
owned by Elcé, read its owning specification and the relevant CodPlay
specifications. Use specifications as the skill’s source of contracts; do not
follow links into plans or notes to infer behavior. Start with:

- `packages/codplay/specs/scene-authoring-spec.md` for `SceneDoc`, `StoryDoc`,
  `PersoDoc`, and compilation to `CompiledScene`.
- `packages/codplay/specs/event-pipeline-v2-spec.md` for live event dispatch,
  journaling, `listen`, and replay boundaries.
- `packages/codplay/specs/strap-execution-v2-spec.md` for straps and the
  certified `context.planned` helpers and their limits.

Use the existing CodPlay circuit that owns the behavior. Do not infer missing
contracts from a demo or a familiar browser API. If the required behavior has
no verified contract, report the gap before implementing dependent behavior.
A change to `packages/codplay` requires explicit user authorization and must
respect the repository’s implementation gates.

## Keep the event paths distinct

Choose the path based on when the trigger becomes known:

- **Fixed authored timeline:** declare a scene or story `eventime`. CodPlay
  compiles it into a timeline occurrence. At materialization, a matching
  `PersoDoc.actions` entry applies directly. A compiled eventime does not go
  through `RuntimeEventDispatcher` and does not invoke `listen` or straps.
- **Live runtime input:** `RuntimePlayer.emit()` enters the dispatcher, which
  journals the event and runs matching `listen` rules, transforms, and straps.
  Immediate strap events are re-dispatched and can match another listener.
- **Future output from a live strap:** use a verified `context.planned` helper
  such as `wait`. Its planned event is journaled as a future fact and is not
  immediately re-dispatched through `listen`; matching actions are materialized
  at its scheduled time.

Do not attach a `listen` rule expecting it to receive a compiled eventime. If a
fixed timeline occurrence should change a perso, declare the matching action.
If the response must be calculated from a live interaction, use the live event
path.

`seek()` reconstructs from the journal and materialization; it does not rerun
transforms or straps. Keep event handling reproducible and do not rely on a
strap executing again during seek. Use only helpers and semantics documented
as verified by the current strap specification; in particular, check its
certification status before relying on `planned.delay` or other unverified
helpers. The strap specification excludes `planned.delay` from its certified
contract; `planned.wait` is the verified helper for a one-off offset.

## Animate through CodPlay

Any animation that changes reading or player presentation belongs to CodPlay's
actions and timing mechanisms. Do not use CSS animations, CSS transitions,
browser timers, or a parallel animation circuit to implement reading behavior.
Keep CSS responsible for static presentation. For timed reveals, use fixed
eventimes when the complete schedule is authored up front, or live straps with
verified planned helpers when the schedule starts from a runtime event.

## Validate the real path

Trace the feature across its actual authoring input, scene builder, compiled
actions/events, player journal, and materialized output. A successful build or
demo-local behavior alone does not establish runtime behavior. When a demo
fails, determine whether the CodPlay contract or runtime is responsible before
changing the fixture; the fixture must exercise the real runtime path.
