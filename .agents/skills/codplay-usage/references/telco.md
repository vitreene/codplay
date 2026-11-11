# Control one occurrence with telco

Read the [public facade](../../../../packages/codplay/specs/facade-v2-spec.md)
and [Engine/Player](../../../../packages/codplay/specs/engine-player-v2-spec.md)
contracts. `instance.telco` is the existing occurrence's transport: it controls
Play/Pause, logical position, reset and rate, and exposes state/progress.
It does not construct a scene, emit scenario events or create another clock.

Use it for both a single loaded occurrence and each occurrence of a shared
multi-instance engine. Explicit shared-engine orchestration belongs to
[engine and instances](engine-and-instances.md). Scene authoring, listeners and
straps are described in [scene model](scene-model.md).

## Example: observe transport and inspect a position

These two application functions accept the public `CodPlayTelco` already
provided by an instance. They do not define a new CodPlay wrapper API:

```ts
import type { CodPlayTelco } from 'codplay'

/** Observes transport state/progress and returns cleanup for these observers. */
export function observeTransport(telco: CodPlayTelco) {
  // Receives the transport-state snapshot for a change notification.
  const stopState = telco.onChange((state) => {
    console.info('Transport state', state.status)
  })
  // Receives a full transport-state snapshot with logical time and duration.
  const stopProgress = telco.onProgress((state) => {
    console.info('Progress', state.timelineMs, state.durationMs)
  })

  // Removes only the observations installed by this application function.
  return () => {
    stopState()
    stopProgress()
  }
}

/** Pauses at a logical position and returns its time/duration for inspection. */
export async function inspectAtTime(telco: CodPlayTelco, timeMs: number) {
  await telco.pause()
  await telco.seek(timeMs)
  return telco.getProgress()
}
```

Given an existing `instance`, call `observeTransport(instance.telco)` and retain
its returned cleanup function. `await inspectAtTime(instance.telco, 1_100)`
presents that position and leaves the occurrence paused. Resume with
`await instance.telco.play()` when wanted. The explicit `pause()` makes this
example's intent readable; `seek()` also pauses playback before reconstructing.

The callbacks log observations only. They do not update scene state or append
events. The cleanup calls `stopState` and `stopProgress`; it does not destroy
the occurrence. Its owning integration decides when to destroy the instance.

## Command roles and returns

| Public method | Role | Return |
| --- | --- | --- |
| `play()` | Starts/resumes this occurrence through its existing player | `Promise<void>` |
| `pause()` | Pauses this occurrence while retaining its logical position | `Promise<void>` |
| `togglePlay()` | Switches between playback and pause | `Promise<void>` |
| `seek(timeMs)` | Pauses, reconstructs and presents a finite non-negative logical time | `Promise<void>` |
| `rewind()` | Pauses and seeks to zero through the same transport; it is not a reset command | `Promise<void>` |
| `reset()` | Resets the occurrence's player cycle; distinct from a single story's declarative reset | `Promise<void>` |
| `setRate(rate)` | Sets this occurrence's supported positive playback rate | `void` |
| `getState()` | Reads the public lifecycle/transport snapshot | `CodPlayTelcoState` |
| `getProgress()` | Reads only logical time and duration | `{ timelineMs, durationMs }` |
| `onChange(listener)` | Subscribes to transport-state notifications | Unsubscribe function |
| `onProgress(listener)` | Subscribes to progress notifications on the existing update circuit | Unsubscribe function |

Await asynchronous commands to order operations. The public facade returns
`Promise<void>`, not the internal telco's structured command result. Command
failures are published through the instance's diagnostic channel; a resolved
promise alone is not an error-result object. Use the public state/progress and
`instance.diagnostic.onDiagnostic` when the integration must observe outcomes.
The telco's `rate` and `commandInFlight` are read-only properties, not methods.

Reset and rewind have different roles: rewind uses reconstruction at zero;
reset runs the player's reset boundary. Neither is a request named `reset`
sent through `events.emit`. State changes, source lifecycle and terminal
restart guarantees remain those of the owning runtime contracts.

## Values returned and passed to observers

`getProgress()` returns a compact value such as:

```json
{ "timelineMs": 1100, "durationMs": 10000 }
```

`getState()`, the `onChange` callback and the `onProgress` callback expose the
full public transport-state shape instead:

| Field | Meaning |
| --- | --- |
| `instanceId` | Occurrence identified by this telco |
| `status` | Current player lifecycle state |
| `timelineMs` | Logical reading position in milliseconds |
| `durationMs` | Current known duration/horizon in milliseconds |
| `rate` | Current playback rate |
| `initialized` | Whether this target has passed initialization and is not destroyed |
| `sequenceEnded` | Whether the sequence has reached its terminal state |
| `runtimeRevision` | Transport-state revision, not a journal event sequence |

In particular, `onProgress` does not pass only the two-field `getProgress()`
value: its listener receives a `CodPlayTelcoState`. Duration is not an
application percentage; a UI can derive a percentage when it has a suitable
non-zero duration. Do not assume an authored fixed duration for every scene.

## Keep transport separate from scenario logic

- `instance.telco` commands affect this occurrence. They do not pause, seek or
  reset other occurrences merely because they share an engine.
- `instance.events.emit` injects scenario occurrences under the separate event
  contract. A name like `pause` or `rewind` does not invoke a telco method.
- `instance.events.onEvent` observes public scenario output; it is not
  `telco.onChange` or `telco.onProgress`.
- Seek reconstructs recorded facts without rerunning straps or continuous
  capture tracking. Crossing `sequence:end` by Seek is not terminal completion
  during playback. Terminal restart details follow Engine/Player's limits.
- Progress observation never becomes a continuous event source. Do not emit an
  event per progress callback or implement a `loop` emitter. Continuous external
  input belongs to [capture](capture.md); animation uses player time.

The instance's owner provides and destroys the telco with the occurrence.
There is no public `telco.destroy()` on `CodPlayTelco`. Release application
observers with their unsubscribe functions and use owner-level destruction for
actual teardown. Do not construct another internal telco or clock around it.

## Implementation and validation references

These files locate the established circuit; they are not extra construction
steps for ordinary application usage:

- [`facade-types.ts`](../../../../packages/codplay/src/facade/facade-types.ts): public methods, values and listener signatures.
- [`instance-facade.ts`](../../../../packages/codplay/src/facade/instance-facade.ts): instance ownership, transport adaptation and diagnostic publication.
- [`runtime-telco.ts`](../../../../packages/codplay/src/runtime/telco/runtime-telco.ts): existing command and observation implementation.
- [`runtime-telco.spec.ts`](../../../../packages/codplay/tests/runtime/telco/runtime-telco.spec.ts): command ordering, pause-before-seek, rewind/reset, rate, progress and terminal behavior.
- [`facade.spec.ts`](../../../../packages/codplay/tests/facade/facade.spec.ts): public commands on the real player, progress and independent occurrences.
