---
name: codplay-usage
description: Build and integrate CodPlay V2 scenes, persos, engine instances, components, captures, and HTML or native rendering in CodPlay and Elcé. Use for scene authoring, playback, timing, interaction, replay, component extensions, and Three.js/Rive/Avatar integration; not for isolated editor UI work.
---

# CodPlay usage

Use CodPlay V2's verified specifications to author scenes and connect them to
one runtime circuit. A **perso** is a declared component instance: text, image,
layout, input, native camera, avatar, or another registered type. It need not
represent a human character. Elcé authors scenes through this same contract.

## Continuous input must use capture

**Never use the event circuit as a continuous source.** Emitting 60 events per
second, one event per frame, or successive position/progress measurements is
forbidden. This is a boundary between continuous input and discrete facts, not
an event-rate budget. Throttling such a stream does not make it an event flow.

Use a capture session: discrete opening -> samples -> `trackCommand` and live
actions -> explicit end outputs for the facts to retain. Do not call `emit`
for every sample or generate a dense eventime list to replace this circuit.
For animation computed from player time, use action/tween presentation samples
without generating events at each frame.

There is **no `loop` event emitter and no `context.planned.loop`**. Its absence
is a deliberate interface boundary against continuous event emission, not a
missing helper to implement. Do not add it, schedule a strap that repeatedly
emits itself, or use `repeat`, timers or a library render callback to recreate
continuous event emission.
Finite planned helpers describe discrete authored occurrences, not a sampling
clock. A tween's repetition options do not turn it into an event emitter.

## Names identify; declarations define behavior

This is a CodPlay design principle, not just an example-writing convention.
Do not infer an action, event scope or lifecycle from a name's words, prefix,
suffix or separator. Naming conventions can differ: behavior comes from exact
references, declared actions/listeners, registrations and explicit configuration.
Preserve those associations and accepted identifier formats when renaming.
API keys and explicitly recognized protocol symbols retain their contracts;
see [naming and configuration](references/scene-model.md#naming-is-not-an-execution-mechanism).

## Choose the relevant workflow

Read the matching guide and its owning specifications before implementing.
The guides explain usage; the specifications remain authoritative. Paths in
the guides point into this repository, relative to the guide file.

| Task | Guide | Owning specifications |
| --- | --- | --- |
| Understand the scene model, event scopes and external control | [Scene model and event flow](references/scene-model.md) | [SceneDoc](../../../packages/codplay/specs/scene-authoring-spec.md), [event pipeline](../../../packages/codplay/specs/event-pipeline-v2-spec.md), [facade](../../../packages/codplay/specs/facade-v2-spec.md) |
| Build a scene, add a perso, place it, declare actions or timed changes | [Scene authoring](references/scene-authoring.md) | [SceneDoc and build](../../../packages/codplay/specs/scene-authoring-spec.md), [move](../../../packages/codplay/specs/move-v2-spec.md) |
| Choose perso action forms, their component profile and recipients; calculate temporal or captured values | [Perso actions](references/perso-actions.md) | [Actions](../../../packages/codplay/specs/action-sequence-tween-v2-spec.md), [components](../../../packages/codplay/specs/component-materialization-v2-spec.md), [capture](../../../packages/codplay/specs/capture-v2-spec.md) |
| Load and play one exported scene | [Single-scene playback](references/single-scene-playback.md) | [Facade](../../../packages/codplay/specs/facade-v2-spec.md), [scene package](../../../packages/codplay/specs/scene-package-export-v1-spec.md) |
| Control one occurrence, seek, reset, change rate, observe transport state/progress | [Telco](references/telco.md) | [Facade](../../../packages/codplay/specs/facade-v2-spec.md), [Engine/Player](../../../packages/codplay/specs/engine-player-v2-spec.md) |
| Share an engine across several instances and orchestrate their lifecycle | [Engine and multiple instances](references/engine-and-instances.md) | [Facade](../../../packages/codplay/specs/facade-v2-spec.md), [Engine/Player](../../../packages/codplay/specs/engine-player-v2-spec.md), [preload](../../../packages/codplay/specs/preload-v2-spec.md) |
| Create a component, register it externally or integrate it into core, prepare its library | [Component creation and integration](references/component-extension.md) | [Component materialization](../../../packages/codplay/specs/component-materialization-v2-spec.md) |
| Select a discrete reaction and declare listener outputs | [Listen](references/listen.md) | [Events](../../../packages/codplay/specs/event-pipeline-v2-spec.md), [Perso.emit](../../../packages/codplay/specs/perso-emit-v2-spec.md) |
| Normalize or fan out a source event | [Transforms](references/transforms.md) | [Event pipeline](../../../packages/codplay/specs/event-pipeline-v2-spec.md) |
| Compute scoped state updates and immediate or finite future events | [Straps](references/straps.md) | [Strap execution](../../../packages/codplay/specs/strap-execution-v2-spec.md), [events](../../../packages/codplay/specs/event-pipeline-v2-spec.md) |
| Track continuous input, retain explicit conclusions or add a source | [Capture mode](references/capture.md) | [Capture](../../../packages/codplay/specs/capture-v2-spec.md), [Perso.emit](../../../packages/codplay/specs/perso-emit-v2-spec.md) |
| Choose targets, visibility, callback state and live-action recipients | [Event scopes](references/event-scopes.md) | [Events](../../../packages/codplay/specs/event-pipeline-v2-spec.md), [facade](../../../packages/codplay/specs/facade-v2-spec.md), [capture](../../../packages/codplay/specs/capture-v2-spec.md) |
| Organize event tracks, control their participation and insert relative eventime trees | [Event tracks and dynamic insertion](references/event-tracks.md) | [Event pipeline](../../../packages/codplay/specs/event-pipeline-v2-spec.md), [facade](../../../packages/codplay/specs/facade-v2-spec.md) |
| Render with Three.js or Rive, use an Avatar, or implement a native target | [Native rendering](references/native-rendering.md) | [Immutable rel](../../../packages/codplay/specs/third-party-rel-spec.md), [target bridge](../../../packages/codplay/specs/third-party-target-bridge-spec.md), [libraries](../../../packages/codplay/specs/third-party-library-spec.md) |

Load only the guides needed for the task. Their examples use the verified V2
surface. Do not use working plans, study notes, or proposed V2.5/V3
features as contracts. For a capability-specific limit, read its specification
rather than assuming that every field accepted by a type is certified.

## Keep ownership clear

```text
one exported scene: CodPlay.load(packagePath, { root }) -> instance.telco.play()
multiple instances: CodPlay.build -> explicit shared preparation
                      -> instances.create for each occurrence -> instance.telco

DOM input / matching immediate story command -> dispatcher -> journal
ordinary facade eventime insertion ------------------------> journal
compiled eventimes + journal -> materialize -> resolve -> components -> presentation
capture samples -> trackCommand -> live actions -> components -> presentation
```

- For one scene, author a `SceneDoc`, export its package and use `load()` then
  `instance.telco.play()`. Configure capabilities before loading. Catalog/builder/
  runner construction belongs to runtime integration; explicit shared-engine
  orchestration belongs to multi-instance composition.
- In multi-instance composition, one `CodPlay` owner shares its engine, catalog,
  libraries and resource registry across its instances. Each instance owns its player, journal, time and runtime
  component instances. The player does not create an independent clock.
- Register capabilities before build and runtime construction. Facade registries
  lock at the first build, instance creation or `load()`.
  Deliver the compiled scene and the functions from the same build together.
- The authoring document contains serializable data and extractable functions,
  never DOM nodes, native library handles or a player. The compiled artifact
  does not contain the live functions or native resources.
- `move` controls placement. `rel` connects an immutable host/target identity to
  an opaque native capability. A `slot` mounts foreign content or another
  instance; these three concerns use distinct existing circuits.
- `snapshot` and input projection are previews, not durable event insertion.
  Presentation geometry does not reconstruct logical state.

## Choose the event path by when the trigger is known

| Need | Existing path |
| --- | --- |
| A change authored at a known scene/story time | `eventimes` and matching `perso.actions` |
| An interaction received during playback | `emit` source or `instance.events.emit`, then `listen`/straps as needed |
| A future change calculated by a live strap | Verified `context.planned` helpers, such as `wait` |
| Continuous input, such as pointer movement, scroll progress or measurements | Capture samples and `trackCommand`, followed by explicit end outputs; no event per sample |

Ordinary compiled eventimes apply matching actions without running live
`listen` rules or straps. The terminal `sequence:end` has its own verified
player dispatch boundary; do not generalize it to ordinary timed occurrences.
Immediate strap events re-enter the dispatcher. Planned occurrences are future
journal facts and do not re-enter immediate `listen`. Seek reconstructs the
journal without rerunning transforms, straps or live capture tracking.

Animate playback through CodPlay actions, transitions and player time. Keep CSS
for static styling; do not add CSS animations, timers, Anime.js, a library's
autonomous ticker or another playback loop to drive scene behavior.

## Verify the usage that changed

Follow the actual path: authoring -> build -> preparation -> event/journal or
compiled timeline -> logical state -> component -> rendered presentation.
For interaction or motion, exercise Play, Seek, replay/reset and teardown at
the affected boundaries. Native content must also be sampled before the host's
final render commit. A typecheck proves example syntax, not browser rendering.

Use an owning specification's evidence and limits to choose appropriate checks.
If a required contract is absent or implementation diverges, report the gap
before implementing dependent behavior. This skill authorizes no core change;
repository authorization and implementation gates still apply. Do not repair
a demo by bypassing the owning runtime circuit.
