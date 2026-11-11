# Select discrete reactions with listen

Read the [event pipeline](../../../../packages/codplay/specs/event-pipeline-v2-spec.md)
and [Perso.emit](../../../../packages/codplay/specs/perso-emit-v2-spec.md) contracts.
`listen` belongs to a scene or story. It selects reactions to a live discrete
event by exact `on` name. It does not install a DOM listener, define a component
action or sample a continuous source.

## Example: map a button request to a declared event

Put this story in `SceneDoc.stories.reaction`. During playback a click emits
`requested`; the listener declares `ready`, whose action changes the button.

```ts
import type { StoryDoc } from 'codplay'

export const reactionStory: StoryDoc = {
  id: 'reaction',
  persos: [{
    id: 'reaction-button',
    type: 'tag',
    initial: { tag: 'button', attr: { id: 'reaction-button' }, content: 'Start', move: '@root' },
    actions: { ready: { content: 'Ready' } },
    emit: { click: { event: { name: 'requested', visibility: 'story' } } },
  }],
  listen: [{ on: 'requested', emit: [{ name: 'ready' }] }],
}
```

`Perso.emit.click` connects native input to the existing player event path.
`listen.on` selects the rule, `listen.emit` supplies a discrete output, and
`perso.actions.ready` supplies the receiving component's patch. None of these
names carries behavior without its declaration. No callback is needed for
this constant mapping.

## Role of each listener field

| Field | Role |
| --- | --- |
| `on` | Matches the source event name exactly |
| `transform` | Ordered synchronous functions producing event descriptors from the source; see [transforms](transforms.md) |
| `straps` | Ordered names resolved in the selected scene/story collection; see [straps](straps.md) |
| `emit` | Declared event descriptors produced after the straps have completed; omitted data uses source data |
| `active` | Story isolation control, not a continuous callback; follow [story isolation](../../../../packages/codplay/specs/story-isolation-spec.md) |
| `reset` | Story projection boundary: starts from initial state at that event without deleting prior journal facts or resetting the scene clock |

For a story-targeted live event, a matching story rule takes priority. Only
when no story rule matches does the dispatcher select scene rules. It does
not execute both collections automatically. Strap lookup follows the selected
rule's owner, not an arbitrary collection with the same strap name.

The source event is journaled before the reaction pipeline. An empty transform
result contributes no transformed event; it does not erase the source fact,
cancel declared straps or cancel `emit`. A pipeline without rules passes the
event through; one with rules selects matching names only.

## When this path runs

The ordinary HTML source emits during Play, not before Play, during pause or
after teardown. `ref` selects a materialized part and `keyCode` matches
`KeyboardEvent.code`; source-specific limits remain in the Perso.emit spec.

Ordinary authored `eventimes` and future planned occurrences apply actions
without invoking this live pipeline. Seek reconstructs the journal without
running transforms or straps again. An immediate strap event can re-enter the
dispatcher and trigger another listener. Avoid recursive re-emission.

Outside injection also depends on the existing facade boundary: an ordinary
scene-targeted `instance.events.emit` inserts a journal occurrence rather than
calling `scene.listen` directly. See [event scopes](event-scopes.md) and the
[scene example](scene-model.md#external-control-example-and-method-roles).

Continuous input uses [capture](capture.md); there is no `loop` emitter. Use
[perso actions](perso-actions.md) for the patch that a discrete fact applies.

## Implementation references

- [`listen.ts`](../../../../packages/codplay/src/runtime/player/pipeline/listen.ts): name matching, transform evaluation, strap ordering and declared emissions.
- [`runtime-event-dispatcher.ts`](../../../../packages/codplay/src/runtime/player/pipeline/runtime-event-dispatcher.ts): scene/story selection and journal boundaries.
- [`listen.spec.ts`](../../../../packages/codplay/tests/runtime/player/listen.spec.ts): matching, fan-out, source input and straps-before-emit ordering.
