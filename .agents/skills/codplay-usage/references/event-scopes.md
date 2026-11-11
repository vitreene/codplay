# Choose event, state and live-action scopes

Read the [event pipeline](../../../../packages/codplay/specs/event-pipeline-v2-spec.md),
[facade](../../../../packages/codplay/specs/facade-v2-spec.md),
[capture](../../../../packages/codplay/specs/capture-v2-spec.md) and
[story isolation](../../../../packages/codplay/specs/story-isolation-spec.md) contracts.
Scope comes from explicit declarations and addresses, not an event name's
prefix, punctuation or vocabulary.

For track properties, activation and dynamic insertion dates, read
[event tracks](event-tracks.md). Scope and track participation remain separate.

## Four distinct choices

| Choice | What it controls |
| --- | --- |
| Event target | The addressed scene/story and optional existing track; the facade carries this separately from event data |
| Event `visibility` | Journal/observation routing: `story`, `scene` or `public` |
| Reaction/state owner | The selected scene/story listener and strap collection; capture `stateScope` separately chooses callback state reads |
| Live-action recipients | Persos indexed under the declared action name; not an implied restriction to the source perso |

The instance is the enclosing runtime boundary. A public event remains an
output of this instance; the host owns any transport to another instance.
Telco commands control this occurrence's playback and are [documented separately](telco.md).

## Example: local occurrence, shared occurrence and public output

This scene has two stories declaring the same action names. At 100 ms only
the first story receives its local occurrence. At 200 ms the scene occurrence
updates both. At 300 ms an authored public occurrence updates both and reaches
the instance observer. The outside-injection example uses the same public channel.

```ts
import type { SceneDoc } from 'codplay'

export const scopeScene: SceneDoc = {
  id: 'scope-example',
  stories: {
    first: {
      id: 'first',
      persos: [{
        id: 'first-label',
        type: 'tag',
        initial: { tag: 'p', attr: { id: 'first-label' }, content: 'Initial first', move: '@root' },
        actions: {
          local: { content: 'Local first' },
          shared: { content: 'Shared first' },
          announced: { content: 'Public first' },
        },
      }],
      eventimes: [{ name: 'local', startAt: 100 }],
    },
    second: {
      id: 'second',
      persos: [{
        id: 'second-label',
        type: 'tag',
        initial: { tag: 'p', attr: { id: 'second-label' }, content: 'Initial second', move: '@root' },
        actions: {
          local: { content: 'Local second' },
          shared: { content: 'Shared second' },
          announced: { content: 'Public second' },
        },
      }],
    },
  },
  eventimes: [
    { name: 'shared', startAt: 200, visibility: 'scene' },
    { name: 'announced', startAt: 300, visibility: 'public' },
  ],
}
```

The second label stays `Initial second` at 100 ms despite declaring `local`.
The shared names do not erase the story boundary. Ordinary authored eventimes
apply matching actions without invoking live listeners or straps.

## Visibility and observation

The dispatcher and capture routes use the following visibility choices:

| `visibility` | Existing route |
| --- | --- |
| `story` | Addressed story's track; the runtime needs a story identity |
| `scene` | Global track; participates in story materialization |
| `public` | Global route plus public observation when playback reaches the fact |

Authored eventimes retain their containing scene/story action scope;
`visibility: 'public'` adds outside observation without moving a story's
authored actions to other stories. Ordinary facade insertion retains the
explicit target track/story for its tree. Visibility is not a replacement for
that address; see [dynamic insertion](event-tracks.md#dynamic-eventime-properties).

Omitting visibility does not mean `public`. The existing target determines
the route: with a story identity it follows that story; without one it follows
the scene path. Capture opening/end events default to the owning story.
Source-specific certified limits still apply: the ordinary HTML `Perso.emit`
guide certifies its story route, not every generic visibility combination.

Public event observations are `instance.events.onEvent`, transport observations
are `instance.telco.onChange/onProgress`, and diagnostic traces are
`instance.diagnostic.onTrace`. These are different channels. Release each
subscription with its returned unsubscribe function.

Public authored eventimes are observed after their playback presentation,
including relative children. They retain their compiled `eventId` and absolute
`timeMs`. Journaled facts also carry `eventSeq`; compiled occurrences do not.
Each occurrence is observed once per reading cycle. Pause and Seek do not
publish reconstructed occurrences; reset starts a fresh observation cycle.

## Outside addressing is separate from event data

```ts
import type { CodPlayInstance } from 'codplay'

/** Inserts a public fact for this occurrence, with an explicit scene target. */
export async function announceFromOutside(instance: CodPlayInstance) {
  await instance.events.emit(
    { name: 'announced', visibility: 'public' },
    { scope: 'scene' },
  )
}
```

For `scopeScene`, this ordinary scene injection enters the journal and becomes
visible/observable on the next playback presentation. It does not directly
call `scene.listen`. Do not put the address in `data`.
For example, after the local/shared occurrences, call
`await announceFromOutside(instance)` at logical time 400 ms during playback;
the next frame presents `Public first` and `Public second` and publishes
`announced`. Subscribe before that presentation to observe it.

A matching story command can use live dispatch when it has a story target,
omitted/zero `startAt`, no nested eventimes and story/omitted visibility:
`instance.events.emit({ name: 'requested', visibility: 'story' },
{ scope: 'story', storyId: 'interaction' })` reaches the matching listener in
the [strap example](straps.md). Do not generalize this behavior to all facade
targets. Internal `RuntimePlayer.emit()` is a different entry boundary, not an
extra user API to call around the facade.

## Listener and state ownership

For a story-targeted live event, matching story listeners take priority over
scene listeners; scene rules are a fallback when no story rule matches. The
collections are not merged. The selected listener's owner selects its strap
collection and the state passed to those straps. A missing local strap does
not resolve through another scope's collection.

An immediate strap output can enter the dispatcher and reach another matching
reaction. Future planned outputs and ordinary authored eventimes do not run
the live listener pipeline at their presentation time. Seek reconstructs facts
without rerunning these functions.

A story `reset` reprojects that story from initial state at its boundary,
without deleting journal history or resetting scene time/other stories. Story
isolation is an explicit `active` contract, not an effect of event spelling.
`init`, `onStart` and `onSequenceEnd` are lifecycle callbacks, not arbitrary
event names automatically sent to `listen`. The reserved `sequence:end` has
its own terminal contract; Seek across it is not playback completion.

## Capture state and live recipients

`capture.stateScope` chooses the state read by `initCaptureState` and
`endCapture`. It does not choose event visibility or restrict live recipients.
`captureState` is session-local and ephemeral; `trackCommand` receives that
state with samples, not a newly supplied scene/story state property.

The opening event, `endEmit` and each `endCapture` output have their own
visibility. Story visibility uses the capture's owning story; scene/public
use the global track. Capture events reject `cascade`.

`trackCommand` returns named live actions. Their compiled index can select
several persos, including recipients outside the source's story; a unique key
is needed when only one recipient should react. No sample is journaled or
forwarded as a public event. See [capture mode](capture.md) and the
[calculated action example](perso-actions.md#example-a-function-driven-by-continuous-capture-data).

The mode `apply-now` versus `persist-only` controls insertion/presentation,
not event scope. In particular, `endCapture` outputs are persist-only and
back-anchored; `endEmit` normally applies now. Their detailed lifecycle and
reconstruction rules stay in [capture mode](capture.md).
