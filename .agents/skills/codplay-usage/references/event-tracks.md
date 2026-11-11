# Organize event tracks and insert dynamic occurrences

Read the [event pipeline](../../../../packages/codplay/specs/event-pipeline-v2-spec.md),
[scene authoring](../../../../packages/codplay/specs/scene-authoring-spec.md) and
[facade](../../../../packages/codplay/specs/facade-v2-spec.md) contracts.
[Event scopes](event-scopes.md) covers addressing/visibility; this guide covers
where facts are organized and how relative eventimes enter the journal.

## One timeline, several tracks

A track groups event occurrences and controls whether its facts participate
in materialization. It is not a component, a story instance, an event emitter
or a separate clock. All tracks in an occurrence use the same player time.
At a requested time, the player combines eligible authored occurrences and
journaled facts, then resolves matching perso actions and scoped state updates.

The registry is established from the compiled scene before dispatch. Insertion
adds facts to existing tracks; it never creates an unknown track automatically.
Tracks belong to one player occurrence, not a shared global application bus.

| Track source | Responsibility |
| --- | --- |
| Scene global track | Common scene eventimes and globally routed facts |
| Story default track | That story's eventimes; selected by `story.trackId`, otherwise `story.id` |
| Dedicated strap tracks | Immediate/planned events and updates owned by each declared scene/story strap |
| `scene.tracks` / `story.tracks` declarations | Additional tracks or metadata for existing IDs |

`global` and the generated strap-track names come from runtime configuration.
Do not reconstruct strap IDs or manage a second registry in application code.
An authored name such as `operator` does not imply a behavior or destination.

## Track properties

| Property | Owner and meaning |
| --- | --- |
| Declaration key / runtime `id` | Exact track identity; use that ID in a target |
| `active` | Initial participation flag, default `true`; runtime control changes the current flag |
| `role` | Optional string metadata; it does not execute behavior or define scope |
| Runtime `order` | Derived registry order, not an authored numeric priority or a CSS stacking order |
| `story.trackId` | Selects the story's default track; does not select all tracks eligible for that story |

The registry registers global first, story identities/default tracks and
declared strap tracks, then explicit scene/story track declarations. A repeated
track ID enriches its metadata without obtaining a new order. A declaration's
arbitrary `order` value does not set runtime priority.

Disabling a track omits its contribution; it does not delete stored facts,
destroy its persos, stop the player clock or close a story isolation period.
A live fact addressed to a story on another active track can still contribute
when the story's default track is inactive. Do not equate track activity with
[story isolation](../../../../packages/codplay/specs/story-isolation-spec.md).

## Example: a declared destination for later input

This scene starts with a label and one authored change at 100 ms. Its
`operator` track is declared but initially inactive. It will receive the
dynamic sequence below; no second story or player is required.

```ts
import type { SceneDoc } from 'codplay'

export const trackScene: SceneDoc = {
  id: 'track-example',
  tracks: { operator: { active: false, role: 'operator-input' } },
  stories: {
    main: {
      id: 'main',
      persos: [{
        id: 'track-label',
        type: 'tag',
        initial: { tag: 'p', attr: { id: 'track-label' }, content: 'Initial', move: '@root' },
        actions: { 'label:set': true },
      }],
      eventimes: [{ name: 'label:set', startAt: 100, data: { content: 'Authored' } }],
    },
  },
}
```

The `true` action declares a recipient whose patch is supplied by event data;
see [perso actions](perso-actions.md). `role: 'operator-input'` is descriptive
metadata; explicit insertion targets select that track.

## Insert a relative eventime tree

These functions use an already created occurrence of `trackScene`. They do
not create a player or a track. The public method returns `Promise<void>`;
diagnostics and trace observation belong to the existing instance ports.

```ts
import type { CodPlayInstance } from 'codplay'

/** Adds one finite relative sequence to an existing story-addressed track. */
export async function insertSequence(instance: CodPlayInstance) {
  await instance.events.emit(
    {
      name: 'operator:sequence',
      startAt: 100,
      events: [
        { name: 'label:set', startAt: 50, data: { content: 'First' } },
        { name: 'label:set', startAt: 200, data: { content: 'Second' } },
      ],
    },
    { scope: 'story', storyId: 'main', trackId: 'operator' },
  )
}

/** Changes the participation of the already declared operator track. */
export async function setOperatorTrack(instance: CodPlayInstance, active: boolean) {
  await instance.events.emit(
    {
      name: active ? 'track:activate' : 'track:deactivate',
      data: { trackIds: ['operator'] },
    },
    { scope: 'scene' },
  )
}

/** Stores a fact without applying it to the current presentation at insertion. */
export async function recordOnly(instance: CodPlayInstance) {
  await instance.events.emit(
    { name: 'label:set', data: { content: 'Recorded' }, mode: 'persist-only' },
    { scope: 'story', storyId: 'main', trackId: 'operator' },
  )
}
```

For example, call `insertSequence` at logical time 500 ms:

| Occurrence | Calculation | Logical date |
| --- | --- | --- |
| `operator:sequence` root | Current time 500 + root offset 100 | 600 ms |
| First `label:set` | Root date 600 + child offset 50 | 650 ms |
| Second `label:set` | Root date 600 + child offset 200 | 800 ms |

Children are relative to their parent, not all directly to insertion time.
The root may omit `startAt` and then uses zero; children need explicit finite,
non-negative offsets. The root is also an occurrence, even when no perso has
an action for its name. Use a finite tree of authored steps, never a dense
sample list standing in for [capture](capture.md).

If `operator` stays inactive through 800 ms, the label stays `Authored`.
Activating it then lets reconstruction include its retained due facts, giving
`Second`. Alternatively, activate it at 500 ms to see `First` at 650 ms and
`Second` at 800 ms. Deactivation removes the track's contribution without
erasing the inserted sequence.

## Dynamic eventime properties

| Public field | Meaning |
| --- | --- |
| `name` | Exact discrete name matched against actions/rules under the selected entry path |
| `startAt` | Relative non-negative offset in milliseconds; not an absolute journal time |
| `data` | Event payload, including any component action patch supplied by the receiving declaration |
| `events` | Finite nested eventime children, each relative to its parent |
| `visibility` | Optional routing/observation declaration; see [event scopes](event-scopes.md) |
| Root `mode` | Insertion policy for the tree, separate from scope and activation |
| Separate `target` | `{ scope, storyId?, trackId? }`; a story target requires a declared story and a custom track must already exist |

The ordinary insertion tree retains the resolved target track/story for its
facts; do not treat each child's `visibility` as a new independent target
address. Use the documented entry and source-specific routing boundaries.
Child-specific insertion modes are not a separate supported policy: put the
mode on the root.

## Apply-now, persistence and replay

| Mode | Effect |
| --- | --- |
| `apply-now` (ordinary default) | Adds facts eligible for normal presentation at their dates; future children still wait for their logical dates |
| `persist-only` | Adds facts without applying them at insertion/current presentation; a later reconstruction, such as Seek, can include them |

Neither mode changes the clock, creates a track or changes visibility.
`apply-now` does not promise synchronous DOM changes before `emit` returns:
ordinary facade insertion is presented on the existing playback path.
At 800 ms with `operator` active, `recordOnly` retains `Second` on the current
presentation; `await instance.telco.seek(800)` reconstructs `Recorded`.

Immediate matching story commands have a separate live-dispatch boundary;
ordinary inserted/future eventimes do not call listeners at their presentation
date. Immediate strap events can re-enter the dispatcher, whereas future
planned events are recorded facts. Seek reconstructs actions and state without
rerunning transforms, straps or capture tracking.

Capture conclusion events use the same journal: `endEmit` normally applies
now, while `endCapture` outputs are persist-only and anchored by their resolved
duration. Capture samples and live actions never become a per-frame track.
See [capture mode](capture.md) for full arguments and conclusion semantics.

## Control events and deterministic order

The reserved `track:activate`, `track:deactivate` and `track:toggle` commands
consume `{ trackIds: string[] }` on the scene control path. In the public
example the command omits `startAt` and children so it takes the immediate
control boundary. Do not assume that adding `startAt: 0` or scheduling one of
these names as an ordinary authored eventime has the same effect.
Unknown IDs do not create tracks. Malformed command data produces a diagnostic.
These exact protocol symbols are explicitly recognized; a similar name or
the `role` field has no control effect.

Journal facts have an absolute `applyAtMs`, runtime `eventId` and monotonic
`eventSeq`, plus their track/story, payload and optional visibility/mode/context.
These are runtime properties, not fields the author must invent for `emit`.
Within a track, facts sort by date then insertion sequence. Materialized
actions sort by date, derived track order, then declaration path; live paths
retain insertion sequence. Thus same-time actions on different tracks are
not governed solely by which API call came last. Use distinct dates when the
scenario requires a strict progression rather than relying on a tie.

Do not assume historical track-activity replay or rollback from a Seek;
certification of story isolation/reset does not supply that separate guarantee.
Public authored occurrences and journaled facts share the
[public observation channel](event-scopes.md#visibility-and-observation).

## Implementation and validation references

- [`tracks.ts`](../../../../packages/codplay/src/runtime/player/pipeline/tracks.ts): registry, default story tracks, derived order and strap destinations.
- [`track-journal.ts`](../../../../packages/codplay/src/runtime/player/pipeline/track-journal.ts): existing-track insertion, runtime fact properties, anchoring and activity.
- [`eventime-routing.ts`](../../../../packages/codplay/src/runtime/player/runtime-player/eventime-routing.ts): public targets, offsets and immediate command boundaries.
- [`materialize.ts`](../../../../packages/codplay/src/runtime/player/pipeline/materialize.ts): eligible facts and action ordering.
- [`pipeline.spec.ts`](../../../../packages/codplay/tests/runtime/player/pipeline.spec.ts): registry, active-track selection, unknown destinations, anchoring and strap tracks.
- [`facade.spec.ts`](../../../../packages/codplay/tests/facade/facade.spec.ts): public insertion, nested eventimes and next-frame observation.
