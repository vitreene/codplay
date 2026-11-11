# Author a scene and its persos

Read [scene authoring](../../../../packages/codplay/specs/scene-authoring-spec.md),
[move](../../../../packages/codplay/specs/move-v2-spec.md) and, for templates,
[layout](../../../../packages/codplay/specs/layout-component-spec.md).

For the relationship between scene, stories, persos, components and straps,
event scopes and external control, read [Scene model and event flow](scene-model.md).

## Start with a typed scene

A scene contains named stories. A story contains persos and may have its own
eventimes, state, listeners and straps. A perso's `type` selects a registered
component; `initial` and action payloads follow that component's profile.

This example can be saved as `scene.ts`. The message starts in the layout's
`body` outlet, changes after one second and detaches after three seconds. The
scene's terminal event is shared across its stories.

```ts
import type { SceneDoc } from 'codplay'

export const scene: SceneDoc = {
  id: 'welcome',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'stage',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<main id="welcome-stage"><section id="welcome-body" data-part="body"></section></main>',
          },
        },
        {
          id: 'message',
          type: 'tag',
          initial: { tag: 'p', content: 'Welcome', move: 'body' },
          actions: {
            greet: { content: 'Ready to begin' },
            hide: { move: '@off' },
          },
        },
      ],
      eventimes: [
        { name: 'greet', startAt: 1_000 },
        { name: 'hide', startAt: 3_000 },
      ],
    },
  },
  eventimes: [{ name: 'sequence:end', startAt: 4_000 }],
}
```

An action is an entry keyed by an event name. Matching occurrences apply the
action to its perso; an event name may address several declared actions. A
story eventime acts within that story. Use this path directly for authored
timing; adding `listen` is unnecessary for these fixed changes.

The builder completes omitted `initial`/`actions` and reserves the internal
`actions[perso.id] = null` entry. Do not use a perso's own ID for an authored
non-null action. Do not rely on `SceneDoc.defaults`: its application and
precedence are outside the verified contract.

## Pick the component and placement

| Need | Component or circuit |
| --- | --- |
| Plain text or a plain HTML tag | `tag`, with `tag`, `content`, `className`, `style`, `attr` |
| Rich HTML text | `text`; its content projection differs from `tag` |
| A template with named mounting zones | `layout`, `initial.markup`, `data-part` |
| Image, form control, media, polygon | `img`, `input`, `media`, `polygon`, with the corresponding profile |
| A host for another representation or instance | `slot`, with its immutable root-level `name` |
| An ordered list | `list`, with its [capability contract](../../../../packages/codplay/specs/list-capability-v2-spec.md) |
| A scroll source/container | Optional `scroll-container` integration; register it before build |
| Camera, Rive state machine, Avatar feature | Registered native component and immutable `initial.rel`; see [native rendering](native-rendering.md) |

Core types are `tag`, `text`, `img`, `input`, `layout`, `list`, `media`,
`polygon` and `slot`. Use `SceneDoc` for core profiles and `SceneDoc<string>`
when explicitly registered custom types are present. The latter opens the type
boundary; it does not replace build validation.

`move: '@root'` mounts at the instance root; `move: '@off'` detaches. Another
string identifies a registered placement target, not a DOM selector. An outlet
owns a real container; `<!-- data-part="point" -->` is an anchor that inserts
roots before its comment without another container. Every authored parent
element in `markup` needs an explicit `id`. Parts selected by the component's
definition are the public mounting targets.

Change placement through an action, for example
`{ move: { target: 'body', transition: { duration: 400 } } }`. `mode` chooses
order in the destination; it does not choose animation mode. Read the move and
[motion](../../../../packages/codplay/specs/motion-frame-v2-spec.md) contracts
before using paths, retargeting or reparent transitions. A recognized option
such as `resize.width: 'preserve'` is not automatically a certified behavior.

Use the owning profiles for [images](../../../../packages/codplay/specs/image-component-v2-spec.md),
[inputs](../../../../packages/codplay/specs/input-component-v2-spec.md),
[media](../../../../packages/codplay/specs/media-sync-v2-spec.md),
[polygons](../../../../packages/codplay/specs/polygon-component-v2-spec.md),
[units](../../../../packages/codplay/specs/unit-values-v2-spec.md) and
[colors](../../../../packages/codplay/specs/color-values-v2-spec.md). Do not
encode a profile by copying the compact compiled representation.

## Use actions for time-dependent changes

Read [perso action forms and examples](perso-actions.md) for the connection
between `perso.type`, the component profile, action recipients and incoming
data. It covers patches, `true`/`null`, sequences, property tweens and `fn`,
including the distinction between player-time progression and capture data.

A static action changes resolved state when its event is materialized. An
`ActionSequence` orders action steps; a `TweenAction` resolves a patch from
progression over player time. Use the
[verified sequence/tween contract](../../../../packages/codplay/specs/action-sequence-tween-v2-spec.md)
for the supported forms and limits. Do not infer full author exposure from
isolated [ACE primitives](../../../../packages/codplay/specs/ace-calculation-v2-spec.md).

Continuous input is never authored as an event stream: no event per frame,
60-Hz position/progress emissions or dense eventimes standing in for samples.
Use [capture and `trackCommand`](capture.md) for such inputs; use
player-time presentation sampling for an authored animation. There is no
`loop` event emitter by deliberate interface choice. `repeat` is not a way to
recreate one.

For live decisions, add a [listen](listen.md)/[strap](straps.md) path.
Keep application state in scene/story state and durable updates in that path,
not in a DOM node or a capture-local accumulator. For story activation/reset,
read [story isolation](../../../../packages/codplay/specs/story-isolation-spec.md)
and the event pipeline rather than removing earlier journal entries.

Export the source document as a scene package, then follow
[single-scene playback](single-scene-playback.md) to load and play it.
That guide also separates the runtime integrator's internal assembly. Use the
[shared-engine guide](engine-and-instances.md) for several instances.
