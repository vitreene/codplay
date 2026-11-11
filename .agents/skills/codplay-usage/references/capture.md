# Use continuous capture mode

Read the [capture](../../../../packages/codplay/specs/capture-v2-spec.md) and
[source-emission](../../../../packages/codplay/specs/perso-emit-v2-spec.md) contracts.
Use [listen](listen.md), [transforms](transforms.md) and [straps](straps.md) for
discrete reactions. [Event scopes](event-scopes.md) distinguishes event routing,
callback state and live-action recipients.

## Event emission is not a continuous-input channel

The event path is reserved for discrete facts. **Using it as a continuous
source, including 60 events per second or one event per frame, is forbidden.**
Pointer positions, scroll progress and successive device measurements belong
to capture samples and `trackCommand`; samples must not call the dispatcher or
fill the journal. Lowering the emission rate does not change this boundary.

A capture uses discrete opening/conclusion events around ephemeral tracking.
A timed animation derived from player time instead uses the existing action/
presentation sampler. Neither path generates an event for every presented
value. Do not turn compiled eventimes into a sampled signal either.

The interface deliberately excludes a `loop` event emitter and
`context.planned.loop` to prevent this misuse. This is not an unfinished
capability to supply. A timer, recursive
strap or `repeat` that emits a sampled signal would recreate the forbidden
path. Finite planned helpers remain for discrete occurrences. In reviewing a
scene, distinguish these three cases before choosing the input mechanism:

| Source or need | Circuit |
| --- | --- |
| A click, a decision, a known authored boundary | Discrete event and matching actions/listeners |
| Pointer movement, scroll progress, successive measurements | Capture session and `trackCommand` |
| An animated value calculated from elapsed player time | Action/tween presentation sampling |

## Continuous input is a session

For the receiving perso's action forms and an example passing captured values
to a calculated `fn`, read [perso actions](perso-actions.md#example-a-function-driven-by-continuous-capture-data).

A capture opens on a discrete event and receives ordered raw samples. Use it
for pointer movement, scroll, or another registered continuous source. The
capture is source-agnostic; the source adapter interprets native input.

| Declaration | Role |
| --- | --- |
| Source key, such as `pointerdown` | Selects the source's opening boundary on the owning perso |
| `event` | Discrete opening event, using the normal event circuit |
| `capture.trackOn` / `endOn` | Native event names routed as tracking/closure by a source that uses these boundaries |
| `stateScope` | Chooses scene/story state read by initialization and conclusion; does not choose event visibility |
| `initCaptureState({ state })` | Initializes the session-local accumulator once |
| `trackCommand({ sample, samples, captureState })` | Synchronously returns live actions, replacement capture state and/or ephemeral scoped `updateState` |
| `endEmit` | Declares an ordinary conclusion event, with final state under reserved `data.captureState` |
| `endCapture({ samples, captureState, state, meta })` | Computes persistent conclusion events from the complete history, final session state, current scoped state and runtime metadata |

The two end outputs are independent and optional. `endCapture` returns
`{ events?, duration?, durationMode? }` or no result, not a state mutation.
Its events follow persist-only insertion. See [event scopes](event-scopes.md)
for the distinct state, visibility and live-recipient choices.

This perso demonstrates pointer tracking with an ephemeral sample count and a
live action. Its ordinary end event applies `capture:done`; its separate
`endCapture` output records `capture:stored` for later reconstruction. The
recorded style remains absent from the closing frame and appears on Seek; the
end event changes the label immediately.

```ts
import type { PersoDoc } from 'codplay'

export const capturePerso: PersoDoc<'tag'> = {
  id: 'capture-pad',
  type: 'tag',
  initial: { tag: 'div', content: 'Drag here', style: { opacity: 1 }, move: '@root' },
  actions: {
    tracking: { content: 'Tracking' },
    'capture:done': { content: 'Done' },
    'capture:stored': { style: { opacity: 0.75 } },
  },
  emit: {
    pointerdown: {
      event: { name: 'capture:start', visibility: 'story' },
      capture: {
        trackOn: ['pointermove'],
        endOn: ['pointerup'],
        stateScope: 'story',
        // Initializes session-local data, independent of scene/story state.
        initCaptureState: () => ({ sampleCount: 0, firstPointer: null }),
        // Uses the current sample, session history and previous local state.
        trackCommand: (input) => {
          const { sample, samples, captureState } = input
          const pointer = { clientX: sample.clientX, clientY: sample.clientY }
          return {
            actions: [{ name: 'tracking' }],
            captureState: {
              sampleCount: samples.length,
              firstPointer: captureState.firstPointer ?? pointer,
              lastPointer: pointer,
            },
          }
        },
        endEmit: { name: 'capture:done', visibility: 'story' },
        // Records a conclusion anchored by the measured session duration.
        endCapture: ({ captureState }) => ({
          events: [{ name: 'capture:stored', data: { sampleCount: captureState.sampleCount } }],
          durationMode: 'capture',
        }),
      },
    },
  },
}
```

### What `trackCommand` receives

It receives **one complete object**, named `input` in the example. The
`const { sample, samples, captureState } = input` line only reads its three
properties; it does not change the value supplied by the runtime. Their roles
are:

| Property | Content at this callback |
| --- | --- |
| `sample` | The one source sample currently being processed. Its shape belongs to the source adapter. |
| `samples` | All tracked samples in this session, in arrival order, **including the current sample** as the last entry. At the first call, its length is `1`. |
| `captureState` | The previous session-local state: first the result of `initCaptureState`, then the latest `captureState` returned by tracking. With no initializer it starts as `{}`. |

For the pointer example, here is the **entire argument supplied to the second
call**. These numerical values illustrate the shape; they are not a recording:

```json
{
  "sample": {
    "clientX": 124,
    "clientY": 83,
    "movementX": 4,
    "movementY": 3
  },
  "samples": [
    { "clientX": 120, "clientY": 80, "movementX": 2, "movementY": 1 },
    { "clientX": 124, "clientY": 83, "movementX": 4, "movementY": 3 }
  ],
  "captureState": {
    "sampleCount": 1,
    "firstPointer": { "clientX": 120, "clientY": 80 },
    "lastPointer": { "clientX": 120, "clientY": 80 }
  }
}
```

`input.samples` already contains the second sample. `input.captureState` still
contains the first call's result because this second call has not returned
yet. The example's second return sets `sampleCount: 2`, preserves the first
pointer and updates `lastPointer` to `{ clientX: 124, clientY: 83 }`.

The full argument is built by
[`RuntimeCaptureSession.track`](../../../../packages/codplay/src/runtime/capture/runtime-capture-session.ts).
The nested `input.sample` is prepared earlier by the
[HTML pointer adapter](../../../../packages/codplay/src/runtime/capture/sources/html-pointer-capture-source-adapter.ts).
That adapter copies four numeric fields; this source-specific extraction must
not be confused with the callback's complete argument:

- `clientX`/`clientY` are native viewport coordinates in CSS pixels, not scene
  coordinates, `cqw` values, element-local coordinates or a displacement from
  capture start.
- `movementX`/`movementY` are the native event's movement values. The adapter
  copies them; it does not calculate a cumulative displacement or derive them
  from the last sample delivered to the callback.
- This sample is a plain data record, **not** a `PointerEvent`. It has no DOM
  `target`, `preventDefault`, `pointerId`, time or automatic `x`/`y` fields.
  Pointer identity stays with the adapter, outside this sample.

With `trackOn: ['pointermove']` and `endOn: ['pointerup']`, pointerdown opens
the session but is not its first sample; the first tracked pointermove is.
Pointerup closes it without adding a final pointer sample. A pointer event must
provide finite values for all four copied fields to produce a valid sample.

At the first callback, `input.samples` contains just that first tracked move,
and `input.captureState` is the initializer's `{ sampleCount: 0, firstPointer:
null }`. `firstPointer` records the first **tracked move**, not pointerdown.

Treat all inputs as read-only. Return a complete `captureState` to replace the
previous one; it is not automatically merged. Omitting that output retains
the previous state. The callback is synchronous and receives no additional
`state`, `meta`, `timeMs`, event or presentation node. To seed it from
scene/story state, copy the necessary values in `initCaptureState({ state })`;
that is an opening snapshot, not a continuously refreshed state argument.

### Full input for a non-pointer source

The connected non-pointer source is the scroll container. It supplies a record
`{ progress }`, where progress is normalized from `0` to `1` for the configured
axis. Native scroll/resize notifications can be coalesced before delivery;
`samples` contains the delivered samples, not every browser notification.

If tracking retains its latest progress with
`captureState: { progress: input.sample.progress }`, the complete second-call
argument could be:

```json
{
  "sample": { "progress": 0.4 },
  "samples": [
    { "progress": 0.2 },
    { "progress": 0.4 }
  ],
  "captureState": { "progress": 0.2 }
}
```

These are illustrative numbers. `input.sample.progress` is the source's new
measurement. The `progress` field inside `input.captureState` exists only
because that callback returned it earlier; CodPlay does not create it there
automatically. With no initializer and no returned capture state,
`input.captureState` remains `{}`. The scroll sample does not include `scrollTop`, DOM nodes,
axis metadata or an automatic timestamp. Read the
[scroll contract](../../../../packages/codplay/specs/scroll-container-spec.md).

For a new source, its producer chooses a data record and sends it through
`session.track(record)`. The common capture session places that record in
`input.sample`, appends it to `input.samples` and supplies the author-controlled
`input.captureState`. It does not infer a device schema, convert it into pointer
coordinates or automatically capture the whole native event. A new source
therefore needs an explicit producer and data contract; no additional sensor,
audio or other payload is implied by the generic capture type.

The returned actions name entries already declared in compiled perso actions.
They pass through the ordinary component/services/materializer path; no sample
becomes an event automatically. An empty/absent action list removes the previous
live actions for that session.

| Data or output | Durable journal fact? | Purpose |
| --- | --- | --- |
| Samples and `captureState` | No | Session input and accumulator |
| `trackCommand.actions` | No | Immediate presentation through declared actions |
| `trackCommand.updateState` | No | Ephemeral update of the read scope |
| `endEmit` | Yes | Ordinary insertion, `apply-now` by default, with reserved `data.captureState` |
| Events returned by `endCapture` | Yes, `persist-only` | Recorded conclusion for later reconstruction; no current-frame application |

`stateScope` selects state read by capture callbacks, not event write scope.
Opening and end events use their own visibility. Omitted capture-event
visibility targets the owning story; scene/public use the global track, and
public also reaches the public observer. Capture events do not accept
`cascade`. Durable application state changes use the normal end-event ->
listen/strap -> `update` path, not a capture-state mutation.

Persistent conclusion events are anchored at `now - resolvedDuration`.
`durationMode` chooses an explicit value, the runtime default, or measured
capture duration; automatic duration reaches transitions that omit theirs.
Do not assume the conclusion is dated at closure. Samples and live actions are
not replayed by Seek; Seek cancels an open session and reconstructs only its
already journalized outputs. An output-free capture is valid but has no
persistent conclusion to reconstruct.

For the shared journal's track properties and dynamic insertion modes, read
[event tracks](event-tracks.md).

## Add or consume a continuous source

Use the existing player-scoped circuit:

```text
native source -> RuntimeCaptureSourcePort -> compiled perso/source rule
              -> opening event through RuntimePlayer.emit
              -> capture session -> trackCommand -> declared actions
              -> end outputs -> the same dispatcher and journal
```

A component receives optional `captureSources` in its construction context.
Resolve its rule by compiled perso identity and source through that port;
never construct a dispatcher, journal or capture controller in the component.
Initialize listeners after root materialization, suspend them for Seek and
release them at teardown. A component-owned adapter can open a compiled source
rule from the construction input it already receives:

```ts
import type { ComponentInput } from 'codplay'

/** Opens the owning perso's compiled rules for a component-owned source. */
export function openSource(input: ComponentInput, source: string) {
  return input.captureSources?.open({
    storyId: input.perso.storyId,
    persoId: input.perso.id,
    source,
  }) ?? []
}
```

Keep the returned session handles with that adapter. Send converted samples
through `session.track(sample)`, then `await session.end(meta)` or
`session.cancel()`; `session.route({ eventType, sample, meta })` instead applies
the compiled `trackOn`/`endOn` boundaries for native event names. Cancel and
release those handles when the source's lifecycle ends. The player owns the
shared port; a component must not destroy or suspend the port for other sources.

The circuit queues samples received while opening is being dispatched and
opens only if that emission succeeds. The HTML pointer adapter already owns
pointer conversion and native-to-perso association; reuse it for pointer input.

For scroll, use the optional integration and its
[scroll-container specification](../../../../packages/codplay/specs/scroll-container-spec.md).
`ScrollContainerComponent` owns its root source and uses the shared port. Its
HTML factory owns descendant observations, not a second capture mechanism.
Read that contract for progress, intersection observations and registration;
do not present all scroll input as interchangeable pointer samples.

### Files to consult when adding a source

Start with the [capture specification](../../../../packages/codplay/specs/capture-v2-spec.md)
and the owning source contract, such as
[scroll-container](../../../../packages/codplay/specs/scroll-container-spec.md).
Then use this reading map; these implementation references locate the existing
boundaries, not a parallel source API to recreate.

| Concern | File and what to inspect |
| --- | --- |
| Author declaration | [`scene/capture/authoring-types.ts`](../../../../packages/codplay/src/scene/capture/authoring-types.ts): `emit`, source key, opening event, `trackOn`/`endOn`, capture callbacks and their complete inputs |
| Source port and sessions | [`capture-source-circuit.ts`](../../../../packages/codplay/src/runtime/capture/capture-source-circuit.ts): `RuntimeCaptureSourcePort`, `RuntimeCaptureSourceSession`, `open`, `track`, `route`, `end`, `cancel`, opening queue and identity resolution |
| Runtime payload types | [`capture-types.ts`](../../../../packages/codplay/src/runtime/capture/capture-types.ts): sample record, capture state, callback inputs/outputs and session results |
| Callback execution | [`runtime-capture-session.ts`](../../../../packages/codplay/src/runtime/capture/runtime-capture-session.ts): accumulation, complete `trackCommand` argument, state replacement and conclusion handling |
| Component access to a source | [`component-types.ts`](../../../../packages/codplay/src/runtime/components/component-types.ts) and [`base-component.ts`](../../../../packages/codplay/src/runtime/components/base-component.ts): injected `captureSources` port and lifecycle hooks |
| Player integration | [`capture-controller.ts`](../../../../packages/codplay/src/runtime/player/runtime-player/capture-controller.ts): apply live actions and state, close/cancel sessions and route end outputs through the existing player |
| HTML host integration | [`runtime-runner.ts`](../../../../packages/codplay/src/runtime/runner-html/player-runner/runtime-runner.ts): create/inject the shared circuit, attach sources and coordinate Seek/reset/teardown |

Choose the source implementation relevant to the new producer:

| Existing source | Files and role |
| --- | --- |
| Pointer at the HTML-host boundary | [`html-pointer-capture-source-adapter.ts`](../../../../packages/codplay/src/runtime/capture/sources/html-pointer-capture-source-adapter.ts): associate native input with a perso, convert samples, route native track/end events and isolate pointer sessions |
| Continuous source owned by a component | [`scroll-container-component.ts`](../../../../packages/authoring/component-v2/src/scroll-container/scroll-container-component.ts): attach after materialization, open by compiled identity, send samples and close/cancel at lifecycle boundaries |
| Source-specific measurement and coalescing | [`scroll-progress-provider.ts`](../../../../packages/authoring/component-v2/src/scroll-container/scroll-progress-provider.ts) and [`abstract-live-source-provider.ts`](../../../../packages/authoring/component-v2/src/scroll-container/abstract-live-source-provider.ts): separate measurement publication and provider lifecycle from capture/journal ownership |

For a component-owned source, extend the component integration and consume its
provided capture port. Define the new sample record's fields, units and meaning
in the owning source contract before implementation. Reuse the shared opening,
tracking and end paths; emitting one event per measurement remains forbidden.

The optional HTML factory interface in
[`source-adapter.ts`](../../../../packages/codplay/src/runtime/runner-html/source-adapter.ts)
provides bounded host commands and lifecycle notifications; it does **not**
expose the capture session port. In particular,
[`scroll-container-source-adapter.ts`](../../../../packages/authoring/component-v2/src/scroll-container/scroll-container-source-adapter.ts)
owns descendant observations, not the continuous scroll capture. Do not infer
`registerSource`, capture methods on the factory context or unrestricted player
access from that interface. Changing a core integration boundary requires the
repository's explicit authorization and implementation gates.

If the authoring declaration itself must change, inspect
[`capture-event-validation.ts`](../../../../packages/codplay/src/scene/compiled/capture-event-validation.ts)
and [`compiled-capture.ts`](../../../../packages/codplay/src/runtime/capture/compiled-capture.ts)
for validation and function resolution. A different sample record alone does
not require duplicating compilation or session execution.

Read these tests to identify the acceptance boundaries:

- [`capture-source-circuit.spec.ts`](../../../../packages/codplay/tests/runtime/capture/capture-source-circuit.spec.ts): compiled rule selection, opening queue, session routing and cancellation.
- [`runtime-capture-session.spec.ts`](../../../../packages/codplay/tests/runtime/capture/runtime-capture-session.spec.ts): callback values, sample accumulation, capture state and conclusion outputs.
- [`html-pointer-capture-source-adapter.spec.ts`](../../../../packages/codplay/tests/runtime/capture/html-pointer-capture-source-adapter.spec.ts): source conversion, pointer identity, end routing and listener teardown.
- [`scroll-container-component-source.spec.ts`](../../../../packages/authoring/component-v2/tests/scroll-container-component-source.spec.ts): component-owned source and its injected port.
- [`scroll-container-player-integration.spec.ts`](../../../../packages/authoring/component-v2/tests/scroll-container-player-integration.spec.ts): actual component -> runner -> capture -> player/journal path, Seek and teardown.

Validate opening, samples, live projection, both end-output modes, visibility,
Seek cancellation and teardown through the source actually used. Unit tests of
an end callback alone do not establish its connection to the runtime.
