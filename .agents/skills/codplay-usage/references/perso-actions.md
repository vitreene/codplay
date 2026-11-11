# Declare perso actions and calculated values

Read [scene authoring](../../../../packages/codplay/specs/scene-authoring-spec.md),
[action resolution](../../../../packages/codplay/specs/action-sequence-tween-v2-spec.md)
and [component materialization](../../../../packages/codplay/specs/component-materialization-v2-spec.md).
For continuous input, also read the [capture contract](../../../../packages/codplay/specs/capture-v2-spec.md).

## From an action name to a component

`perso.type` selects the registered component definition. That definition owns
the initial/action profile, validation and normalization; its class projects
resolved state through `update(input)`. An action is data for this circuit,
not a component method to call or an arbitrary DOM operation.

For `type: 'tag'`, `{ content: 'Ready' }` changes content; for the external
[counter component](component-extension.md), `{ count: 5 }` changes the
counter's own domain value. Registering a field in a scene does not give a
component new behavior. Use its declared profile and services. `validateAction`
checks authored action data at build; it is not a validation call on every
sample or on every value returned by a function.

The action key selects its recipients by exact match. In the discrete event
path, the event's scope/track determines which persos can receive it, then
their `actions[event.name]` supplies the action. Several persos can declare
the same key and react differently. A name has no intrinsic action or scope.
There is no general action-level CSS `target` selector: the perso carrying the
entry is the recipient. `move.target` is a placement destination, and immutable
`initial.rel` binds a native target; neither changes action-name matching.

Capture actions use the compiled action-name index to find their recipients,
which can include several persos. They do not inherit a story event target
from the perso owning the capture. Use distinct keys when a live action must
affect only one recipient. Do not build this internal index yourself.

## Accepted declaration forms

| Value in `perso.actions[name]` | Role |
| --- | --- |
| `{ content: 'Ready' }` or another component patch | Supplies the authored values for that occurrence |
| `true` or `null` | Declares a recipient without a default patch; incoming `data` supplies the action payload. Without data, no patch is applied |
| `[{ action: patch, durationMs: 200 }, { action: nextPatch }]` | Orders action steps; use explicit step durations in the verified sequence form |
| `{ duration: 1000, ease: 'linear', fn }` | Calculates an action payload from player-time progression and merged action data |

These are scene declaration forms; the selected component's validators still
decide which profiles it accepts. Use the same registered definition for
authoring, export and playback.

A bare callback is not the action form. Put the callback in `fn`, with a
strictly positive finite `duration`. Write actual functions in the authored
document; build extracts them into its function collection. Do not write the
compiled `{ ref: '...' }` representation by hand.

For an object action, incoming `data` overlays the authored object **at the
top level**. With `actions.show = { content: 'Default', style: { opacity: 1 } }`,
`{ name: 'show', data: { content: 'Received' } }` retains the authored style.
But `data: { style: { x: 20 } }` replaces that occurrence's entire authored
`style` group; it does not merge `opacity` into it. Subsequent application to
the existing resolved state follows each field's patch semantics.
For `true`/`null`, data is the whole patch. Sequence steps retain their declared
payloads rather than receiving this event-data overlay.

The builder reserves `actions[perso.id] = null` for self-addressing with data.
Do not replace it with a non-null authored action. `null` does not mean reset,
removal, hiding or deactivation.

## Example: patches, incoming data and a sequence

Put this story in `SceneDoc.stories.main`. At 100 ms both persos react to
`show`: one combines its authored patch with incoming data, the other uses
the supplied data alone. At 300 ms
the first sequence step begins; at 500 ms its second step applies.

```ts
import type { StoryDoc } from 'codplay'

export const actionStory: StoryDoc = {
  id: 'main',
  persos: [
    {
      id: 'message',
      type: 'tag',
      initial: { tag: 'p', attr: { id: 'message' }, content: 'Waiting', move: '@root' },
      actions: {
        show: { content: 'Default', className: { add: 'ready' } },
        steps: [
          { action: { content: 'First step' }, durationMs: 200 },
          { action: { content: 'Second step' } },
        ],
      },
    },
    {
      id: 'echo',
      type: 'tag',
      initial: { tag: 'p', attr: { id: 'echo' }, content: 'No data yet', move: '@root' },
      actions: { show: true },
    },
  ],
  eventimes: [
    { name: 'show', startAt: 100, data: { content: 'Received' } },
    { name: 'steps', startAt: 300 },
  ],
}
```

Both labels become `Received` at 100 ms; only `message` also receives the
`ready` class. `echo` does not declare `steps`, so its content stays `Received`.
No listener or strap is required for these authored dates.

## Example: a function sampled at player time

This story declares one animation start. The player calculates intermediate
values without emitting an event at every frame. `style.opacity.to` in
`fade-property` is an alternative declaration for a supported property tween;
`fade-function` shows calculation of an entire component patch.

```ts
import type { StoryDoc } from 'codplay'

export const animatedStory: StoryDoc = {
  id: 'animation',
  persos: [{
    id: 'animated-message',
    type: 'tag',
    initial: { tag: 'p', attr: { id: 'animated-message' }, content: 'Player time', style: { opacity: 0 }, move: '@root' },
    actions: {
      'fade-property': {
        style: { opacity: { from: 0, to: 1, duration: 1_000, ease: 'linear' } },
      },
      'fade-function': {
        duration: 1_000,
        ease: 'linear',
        // Returns a tag action patch for the requested player-time position.
        fn: ({ progress }: { progress: number }) => ({ style: { opacity: progress } }),
      },
    },
  }],
  eventimes: [{ name: 'fade-function', startAt: 100 }],
}
```

At logical time 600 ms, 500 ms have elapsed since the occurrence: with linear
easing, `progress` is `0.5` and opacity is `0.5`. At 1,100 ms it is `1`.
Replacing the event name with `fade-property` exercises the property form.

The **complete argument** supplied to `fn` is `{ progress, data }`:

| Field | Meaning |
| --- | --- |
| `progress` | Elapsed player time divided by action duration, clamped to `[0, 1]`, then passed through the declared easing |
| `data` | The complete action object after its top-level overlay with occurrence data; includes `duration`, the compiled `fn` reference and any authored/received parameters |

`fn` returns a component action patch, or `undefined` for no contribution.
It does not receive the DOM node, current component state, capture session or
event object as separate arguments. Destructuring just `progress` above does
not mean that `data` is absent. Keep the calculation synchronous and free of
side effects: Seek evaluates it for reconstruction, and live presentation can
evaluate it again. Use straps for discrete decisions/state updates, not `fn`.
Keep the build's function collection with its compiled scene.

## Example: a function driven by continuous capture data

Continuous input does not consist of repeated events. The capture callback
produces named **live actions**; their data can parameterize an existing `fn`.
This perso accumulates native pointer deltas and translates its tag while the
capture is open. It deliberately returns to zero on release rather than
recording a drag trajectory.

```ts
import type { PersoDoc } from 'codplay'

export const draggedPerso: PersoDoc<'tag'> = {
  id: 'dragged-label',
  type: 'tag',
  initial: { tag: 'p', attr: { id: 'dragged-label' }, content: 'Drag me', style: { x: 0 }, move: '@root' },
  actions: {
    'drag:position': {
      duration: 1,
      // Computes a tag patch from this live action's supplied parameter.
      fn: ({ data }: { data: Readonly<Record<string, unknown>> }) => ({
        style: { x: Number(data.offsetX) },
      }),
    },
    'drag:finished': { content: 'Released', style: { x: 0 } },
  },
  emit: {
    pointerdown: {
      event: { name: 'drag:start', visibility: 'story' },
      capture: {
        trackOn: ['pointermove'],
        endOn: ['pointerup'],
        // Starts this gesture's local offset; it is not durable story state.
        initCaptureState: () => ({ offsetX: 0 }),
        // Receives the complete capture input, then selects its needed fields.
        trackCommand: (input) => {
          const { sample, captureState } = input
          const offsetX = Number(captureState.offsetX) + Number(sample.movementX)
          return {
            actions: [{ name: 'drag:position', data: { offsetX } }],
            captureState: { offsetX },
          }
        },
        endEmit: { name: 'drag:finished', visibility: 'story' },
      },
    },
  },
}
```

`trackCommand` receives `{ sample, samples, captureState }` as explained in
[capture inputs](capture.md#what-trackcommand-receives). Its result
above selects `drag:position`, and `{ offsetX }` overlays that action before
`fn` runs. The function receives `{ progress: 0, data: mergedAction }` on this
live path: the resolver uses elapsed time zero. `duration: 1` satisfies the
TweenAction shape; it does not start a one-millisecond clock or advance the
scene. Read the external value from `data`, not from temporal `progress`.

The component receives the resulting resolved state through the standard
`update`/service/materializer path. Live actions cannot target an
`ActionSequence`. Missing/empty tracking actions remove the session's previous
live contribution. Release closes tracking and its end event follows the
ordinary event circuit. Seek cancels an open session without replaying samples
or live patches.
For a durable trajectory or final state, explicitly produce the appropriate
end outputs; see [capture conclusions](capture.md).

The existing scroll observation integration similarly supplies its measured
ratio in `input.data.ratio` to a declared `liveAction`; this is a non-journaled
live output, separate from its discrete enter/leave events. Follow the
[scroll-container contract](../../../../packages/codplay/specs/scroll-container-spec.md)
for that source rather than inventing ratio events or a `loop` emitter.

## Files that own these boundaries

- [`scene/types.ts`](../../../../packages/codplay/src/scene/types.ts): author action forms and component profiles.
- [`action-resolution.ts`](../../../../packages/codplay/src/runtime/player/pipeline/action-resolution.ts): action selection and top-level data overlay.
- [`resolve.ts`](../../../../packages/codplay/src/runtime/player/pipeline/resolve.ts): component patches, property tweens and complete `fn` argument.
- [`action-target-index.ts`](../../../../packages/codplay/src/runtime/player/live-actions/action-target-index.ts): live recipients from the compiled index.
- [`apply-live-actions.ts`](../../../../packages/codplay/src/runtime/player/live-actions/apply-live-actions.ts): source data through normal component updates.

Use the sequence/tween specification's certified limits. In particular, do not
assume sequence `startAt`, implicit tween-step duration or stopping a tween
inside a sequence are verified because a type accepts them.
