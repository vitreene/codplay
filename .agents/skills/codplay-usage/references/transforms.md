# Transform a discrete event into event descriptors

Read the [event pipeline](../../../../packages/codplay/specs/event-pipeline-v2-spec.md).
A `listen.transform` function is a synchronous mapping from one source event
to zero, one or several event descriptors. Use it for normalization and fan-out.
Use a [strap](straps.md) for scoped state updates or future discrete outputs;
use [capture](capture.md) for continuous measurements.

## Example: normalize a label and publish a separate fact

Put this story in `SceneDoc.stories.normalization`. Its button emits one raw
request. The first transform normalizes its label for a component action; the
second emits a public observation. Both read the same original request.

```ts
import type { StoryDoc } from 'codplay'

export const transformStory: StoryDoc = {
  id: 'normalization',
  persos: [{
    id: 'normalize-button',
    type: 'tag',
    initial: { tag: 'button', attr: { id: 'normalize-button' }, content: 'Normalize', move: '@root' },
    actions: { normalized: true },
    emit: {
      click: { event: { name: 'raw', data: { label: '  hello  ' }, visibility: 'story' } },
    },
  }],
  listen: [{
    on: 'raw',
    transform: [
      // Normalizes source data into a tag action payload.
      (event) => [{
        name: 'normalized',
        data: { content: String(event.data?.label ?? '').trim().toUpperCase() },
      }],
      // Publishes the original source label, independently of the first output.
      (event) => [{
        name: 'label:observed',
        data: { original: event.data?.label },
        visibility: 'public',
      }],
    ],
  }],
}
```

During Play the button becomes `HELLO`. The public observation keeps
`original: '  hello  '`: transform two does not receive transform one's output.
Observe it through `instance.events.onEvent` when playback presents that fact.

## Complete input and return roles

The argument is the **source event descriptor**, not `{ event, state }` and
not a DOM event. The author-facing shape exposes `name`, optional `data` and
optional `visibility`. The runtime descriptor also carries event identity,
logical `applyAtMs`, `trackId` and optional story/context/metadata. The author
type deliberately does not expose those runtime fields as scene input APIs.
Do not use DOM nodes, globals or a fabricated state argument in a transform.

| Return | Meaning |
| --- | --- |
| `[{ name, data?, visibility? }]` | One event descriptor; several entries produce ordered fan-out |
| `[]` | No transformed output from this function |
| `undefined` | No transformed output from this function |

Return an array even for one event. A transform does not return `update`,
`actions`, a planned step or a promise. Omitted output visibility retains the
source visibility. Output data is the data returned for that descriptor,
not an automatic deep merge with the source.

Transforms execute in declaration order against the same source. Their
outputs preserve that order; this is not a chain of successive rewrites.
The source is already a journal fact, so returning `[]` does not retract it
or suppress separate listener straps/declared emissions. Do not mistake a
transform for an event veto.

Build extracts authored functions and transfers them with the compiled scene.
The journal retains their output facts; Seek reuses those facts without
re-executing the transform. Keep external side effects outside the transform.
The scope of the output and public observation follow [event scopes](event-scopes.md).

## Implementation references

- [`scene/types.ts`](../../../../packages/codplay/src/scene/types.ts): `AuthorListenTransform` and author event descriptors.
- [`listen.ts`](../../../../packages/codplay/src/runtime/player/pipeline/listen.ts): complete runtime descriptor, output mapping and visibility inheritance.
- [`listen.spec.ts`](../../../../packages/codplay/tests/runtime/player/listen.spec.ts): source reuse, ordered fan-out and empty output.
- [`runtime-player.spec.ts`](../../../../packages/codplay/tests/runtime/player/runtime-player.spec.ts): output persistence and Seek without transform re-execution.
