# Render native content through CodPlay

Read [rel](../../../../packages/codplay/specs/third-party-rel-spec.md), the
[target bridge](../../../../packages/codplay/specs/third-party-target-bridge-spec.md)
and [library preparation](../../../../packages/codplay/specs/third-party-library-spec.md).
For an existing integration, read its owning specification before composing it:
[Three.js](../../../../packages/codplay/specs/third-party-threejs-spec.md),
[Rive](../../../../packages/codplay/specs/third-party-rive-spec.md) or
[Avatar](../../../../packages/codplay/specs/third-party-avatar-spec.md).

## Separate the visible host and native components

A non-HTML component extends `BaseComponent`; it is not an HTML component with
empty markup. In the verified Three.js and Rive integrations, one HTML host
provides a canvas, while the native logical components have no DOM root.
This is not a promise of a public arbitrary non-browser renderer: the facade's
instance root remains an HTML integration boundary.

| Concern | Owner |
| --- | --- |
| Definitions, prepared library | CodPlay owner's configured engine; `load()` performs preparation |
| Library code versus files/models | `libraries` versus preload resources, respectively |
| Canvas, native context, final drawing | Host component |
| Camera, lights, model, state-machine inputs or feature contributions | Dedicated logical components |
| Resolve host/target identity | Player-local target registry |
| Time and presentation order | CodPlay player and its content/commit phases |

Only the host is placed with `move`. Logical consumers use
`initial.rel: { host: 'host-perso-id', target?: 'published-target-id' }` and a
runtime definition with `runtimeProfile: 'attached'`. `rel` is immutable and is
extracted beside the initial payload by compilation. It is not a selector, a
native handle or a dynamic action. A target identifies a published capability,
not a mesh, bone, morph or internal Rive node to discover in the core.

## Compose an existing Three.js integration

The integration package is `@codplay/component-v2`. Save this authored scene
as `native-scene.ts` and export it with a configuration registering the Three
library, its core components and the grid definition shown below:

```ts
import type { SceneDoc } from 'codplay'

export const scene: SceneDoc<string> = {
  id: 'native-grid',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'three-stage',
          type: 'three-scene-host',
          initial: { width: 640, height: 360, move: '@root' },
        },
        {
          id: 'camera',
          type: 'three-camera',
          initial: { rel: { host: 'three-stage' }, position: [0, 0, 8], lookAt: [0, 0, 0] },
        },
        {
          id: 'light',
          type: 'three-light',
          initial: { rel: { host: 'three-stage' }, kind: 'ambient', intensity: 1 },
        },
        {
          id: 'grid',
          type: 'three-instanced-grid',
          initial: { rel: { host: 'three-stage' } },
        },
      ],
    },
  },
}
```

The site configures the public owner before loading the exported package:

```ts
import { CodPlay } from 'codplay'
import {
  THREEJS_CORE_COMPONENTS,
  THREE_INSTANCED_GRID_DEFINITION,
  THREE_LIBRARY,
  THREE_PRELOAD_STRATEGIES,
} from '@codplay/component-v2'

export const player = new CodPlay({
  engine: {
    components: { register: [...THREEJS_CORE_COMPONENTS, THREE_INSTANCED_GRID_DEFINITION] },
    libraries: { register: [THREE_LIBRARY] },
  },
  preload: { strategies: THREE_PRELOAD_STRATEGIES },
})
export const instance = await player.load('/scenes/native-grid/', { root: '#scene-root' })
await instance.telco.play()
```

The existing `scene-root` hosts the Three canvas. The export configuration and
site must use the same definitions. See [component registration](component-extension.md)
for that shared configuration and [single-scene playback](single-scene-playback.md)
for package export/loading. `load()` performs library/resource preparation;
components consume the injected library rather than loading it themselves.
Call `player.destroy()` when the owning integration ends.

For several occurrences, reuse the same owner and capabilities; use the
[multi-instance guide](engine-and-instances.md) when explicitly orchestrating
their shared engine. Runtime integrators use the separate internal assembly
reference in the single-scene guide.

Keep file preparation separate. Three's `three-glb`/`three-fbx` strategies
prepare bytes from explicitly declared resource manifests; the generic builder
does not infer these integration-specific types from file extensions. Instances
parse prepared bytes into their own native state, without another fetch/cache.

## Use Rive or an Avatar

For one Rive scene, register `RIVE_LIBRARY` in the owner's `engine.libraries`,
`RIVE_COMPONENTS` in `engine.components` and `RIVE_PRELOAD_STRATEGIES` in
`preload.strategies`, all from
`@codplay/component-v2`. In multi-instance composition, `RIVE_ENGINE` supplies
the corresponding facade engine groups. A `rive` perso owns `src`, artboard, animations and
canvas; a separate `rive-state-machine` perso declares its `stateMachine` and
`rel: { host: 'rive-host-id' }`. Actions set named `inputs` or send documented
broadcasts. Those names belong to the supplied Rive document. The core has no
built-in emotion or lip-sync interpretation for them. The host commits after
logical contributions and reconstructs the artboard on a temporal return.

For a 3D character, combine `THREEJS_CORE_COMPONENTS` and `AVATAR_COMPONENTS`
with the Three library/strategies on the same owner. In multi-instance
composition, register arrays together instead of spreading two engine objects
that would overwrite `components`. Declare an `avatar`
perso attached to the Three host, then features such as `avatar-mood`,
`avatar-lip-sync`, `avatar-gesture`, `avatar-idle`, `avatar-gaze` or
`avatar-motion` attached with `rel: { host: 'three-stage', target: 'avatar-id' }`.
The central Avatar publishes the capability; features contribute through it.
Read the Avatar specification and its linked author types for source and action
payloads. The verified subset does not promise a complete TalkingHead port or
complete composition of all animation layers. Lottie is not a certified V2
integration merely because the generic bridge can carry opaque targets.

## Extend the native boundary

A provider definition supplies `targetProvider(component, identity, materializer)`
returning `{ value, scope }` or `undefined`. A host publishes scope `'host'`;
a named capability publishes scope `'target'`. Consumers receive the resolved
opaque value in `ComponentUpdateInput.target`. The integration validates its
own native shape at that boundary; the core does not traverse it.

Publications are player-local and become available after mounting/initialization;
consumer declaration order does not resolve dependencies. `placed` availability
follows placement, while `attached` components do not need fake placement.
An unavailable target remains an identity, not permission for a DOM lookup,
global registry or alternate relation circuit. Target publication is distinct
from component `surfaces` and from the placement registry used by `move`.

Use `timeMs`, active occurrences and registered presentation animations for
native updates. Sample native content on CodPlay time, then let the host render
in `presentationPhase: 'commit'`, after `'content'` samples. Seek uses the same
sampling path; do not add `requestAnimationFrame`, `setAnimationLoop`, an
independent mixer clock or a generic flush on the target registry. The host
owns its renderer; each logical component releases its own resources.

Verify deterministic sampling, target publication/availability, content-before-
commit order, Seek reconstruction, independent instances and resource teardown.
The integration specifications distinguish isolated/synthetic evidence from
complete browser validation; preserve those limits when reporting results.
