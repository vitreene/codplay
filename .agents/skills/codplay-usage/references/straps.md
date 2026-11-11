# Compute discrete reactions with straps

Read [strap execution](../../../../packages/codplay/specs/strap-execution-v2-spec.md)
and the [event pipeline](../../../../packages/codplay/specs/event-pipeline-v2-spec.md).
A strap is a named function in `story.straps` or `scene.straps`, selected by a
[listen rule](listen.md). It computes explicit outputs from a discrete event
and scoped logical state. It does not update a DOM node or install a clock.

## Example: update state now, change a label later

Put this story in `SceneDoc.stories.interaction`. A click runs `plan-ready`,
which records the new request count and schedules one label change 250 ms
after the triggering event.

```ts
import type { StoryDoc } from 'codplay'

export const interaction: StoryDoc = {
  id: 'interaction',
  state: { requests: 0 },
  persos: [{
    id: 'start-button',
    type: 'tag',
    initial: { tag: 'button', attr: { id: 'start-button' }, content: 'Start', move: '@root' },
    actions: { ready: { content: 'Ready' } },
    emit: { click: { event: { name: 'requested', visibility: 'story' } } },
  }],
  listen: [{ on: 'requested', straps: ['plan-ready'] }],
  straps: {
    // Returns an immediate state update and one finite future occurrence.
    'plan-ready': ({ state, context }) => [
      { update: { requests: Number(state.requests) + 1 } },
      context.planned.wait(250, { event: { name: 'ready' } }),
    ],
  },
}
```

`plan-ready` is resolved in this story's collection. Its update goes through
the existing scoped journal; it does not mutate `state.requests`. `wait`
returns a future occurrence, not a sleeping callback. The `ready` event later
applies the declared action without running a live listener at that future time.

## Complete function argument

Every strap receives one object `{ strapName, event, state, meta, context }`,
including fields omitted by this example's destructuring:

| Field | Role |
| --- | --- |
| `strapName` | Invoked name in the selected collection |
| `event` | Triggering discrete descriptor: name, optional data and runtime event identity/time fields |
| `state` | Read-only logical state of the selected scene or story scope |
| `meta` | Invocation metadata supplied by the runtime |
| `context` | Runtime context containing the existing `planned` helpers |

It is neither the component's visual state nor `captureState`. Scene and story
collections are separate: a missing story strap does not fall back to a
scene strap of the same name. Local declarations can override matching entries
in the reusable collection of that same scope. See [event scopes](event-scopes.md).

## Returns and ordering

| Return field/form | Role |
| --- | --- |
| `{ update: patch }` | Records partial logical state for the strap's scope |
| `{ events: [...] }` | Immediate discrete outputs, which re-enter the dispatcher and can select further listeners |
| `{ warnings: ['...'] }` | Explicit warnings |
| Planned occurrence list | Future event/update steps, relative to the source occurrence |
| Nested arrays of these forms | Flattened in declaration order |
| `undefined` / no return | No output |

The runtime awaits straps sequentially in the listener's declared order.
Async functions are accepted, but cancellation/invalidation of a result arriving
after a more recent operation is not guaranteed. Do not infer safe late-result
handling from the presence of a promise. Missing functions and exceptions
produce named issues; continuation after an exception is outside certification.

An immediate output may trigger another listener; a planned output does not
re-enter immediate dispatch. Both use the existing journal and remain
reconstructible. Seek does not execute straps again. Do not assume that one
strap receives another strap's newly reconciled state as an implicit chain.

Their dedicated destinations, insertion modes and relative dates are explained
in [event tracks](event-tracks.md).

| Helper | Role |
| --- | --- |
| `context.planned.wait(ms, step)` | One future occurrence at an offset |
| `context.planned.repeat({ eachMs, times }, step)` | A finite set of discrete occurrences |
| `context.planned.stagger({ stepMs }, steps)` | Declared steps distributed at offsets |
| `context.planned.sequence(steps)` | Ordered steps using the certified duration/start forms |

A step may contain `event` or `update`. These helpers describe logical dates;
they do not create timers or a second clock. `planned.delay` and other
uncertified forms are not a usable contract.

There is no `context.planned.loop` or event `loop` emitter. Never use recursive
straps, timers or finite `repeat` to turn measurements or frames into an event
stream. Continuous sources use [capture](capture.md); animation calculations
use [perso actions](perso-actions.md).

For a scene strap and its interaction with story output, see the complete
[scene model example](scene-model.md#complete-scene-example).

## Implementation references

- [`strap-executor.ts`](../../../../packages/codplay/src/runtime/player/pipeline/strap-executor.ts): argument, return forms, sequential calls and flattening.
- [`strap-collections.ts`](../../../../packages/codplay/src/runtime/player/pipeline/strap-collections.ts): scope-specific lookup and local declarations.
- [`planned-helpers.ts`](../../../../packages/codplay/src/runtime/player/pipeline/planned-helpers.ts): existing temporal helpers.
- [`strap-executor.spec.ts`](../../../../packages/codplay/tests/runtime/player/strap-executor.spec.ts), [`strap-collections.spec.ts`](../../../../packages/codplay/tests/runtime/player/strap-collections.spec.ts) and [`planned-helpers.spec.ts`](../../../../packages/codplay/tests/runtime/player/planned-helpers.spec.ts): call order, scope and helper boundaries.
