# Share an engine across multiple instances

Read the [facade](../../../../packages/codplay/specs/facade-v2-spec.md),
[Engine/Player](../../../../packages/codplay/specs/engine-player-v2-spec.md),
[preload](../../../../packages/codplay/specs/preload-v2-spec.md) and
[library preparation](../../../../packages/codplay/specs/third-party-library-spec.md)
contracts. Use this path for several occurrences sharing preparation, resources
and an engine. For one scene, start with [single-scene playback](single-scene-playback.md).
Use the public `CodPlay` facade for this multi-instance composition; do not
create parallel runtime engines or players in the application.

## Build, prepare and create

Given the exported `scene` from the [scene guide](scene-authoring.md), this
browser module prepares it once and creates two independently controlled
occurrences in existing `scene-root-a` and `scene-root-b` containers.

```ts
import { CodPlay } from 'codplay'
import { scene } from './scene'

export const codplay = new CodPlay()
const firstRoot = document.getElementById('scene-root-a')
const secondRoot = document.getElementById('scene-root-b')
if (firstRoot === null || secondRoot === null) throw new Error('Missing scene roots')

const build = codplay.build({ scene })
if (!build.ok) {
  throw new Error(build.diagnostics.errors.map(({ message }) => message).join('\n'))
}

await codplay.engine.prepareScene(build.compiledScene)
const preload = await codplay.preload.load({
  manifest: build.compiledScene.resources,
  options: { mode: 'author' },
})
if (!preload.ok) throw new Error(preload.error.message)
codplay.resources.register(preload.data)

export const instance = codplay.instances.create({
  instanceId: 'welcome-1',
  compiledScene: build.compiledScene,
  functions: build.functions,
  root: firstRoot,
})
export const secondInstance = codplay.instances.create({
  instanceId: 'welcome-2',
  compiledScene: build.compiledScene,
  functions: build.functions,
  root: secondRoot,
})
await instance.telco.play()
await secondInstance.telco.play()
```

The build uses the owner's catalog and does not create a live component or DOM
node. Branch on `build.ok` before using its artifact. Always carry `functions`
from that same build; serializing `CompiledScene` alone loses executable
functions. The library barrier precedes resource preload and player creation.
`mode: 'author'` makes a failed resource block this example instead of accepting
the default broadcast-mode warning.

Configure additional definitions with `new CodPlay({ engine: { components,
services, modules, libraries }, preload: { strategies } })` as needed. Each
engine capability group has `register` and `override` arrays. Alternatively,
call `codplay.components.register(definition)` and check its structured result.
All registrations/overrides must precede the first build, instance creation or
`load()`. A scene package cannot introduce engine capabilities.

For generated CSS in memory, use `codplay.preload.css.set({ slot, cssText,
container })` for the relevant root before mounting. Reuse a slot ID to replace its sheet;
release that slot when its owning integration ends. Resource preparation does
not transfer component lifecycle ownership to preload.

## Control the occurrence, not another clock

Use each occurrence's [`instance.telco`](telco.md) for transport commands and
state/progress observation. That guide owns its complete example, method roles,
returns and subscription cleanup. The normal browser path owns its ticker;
do not add a frame loop. The shared clock is a separate multi-instance concern.

If the host already supplies frames, establish that mode before playing and
supply positions through the same engine. Pause both occurrences before
switching clock mode. An alternative externally driven sequence is:

```ts
await instance.telco.pause()
await secondInstance.telco.pause()
codplay.engine.pause()
codplay.engine.advance(0)
await instance.telco.play()
codplay.engine.advance(150)
codplay.engine.advance(300)
```

`advance` receives the external clock position, not an elapsed delta and not an
instance seek request. Do not combine external frames with the autonomous
ticker. Global `engine.start/pause/stop` affect the shared clock; an individual
pause or seek belongs to that instance's telco. Several instances share an
engine while retaining their own journals, positions and lifecycle.

For application input use `instance.events.emit(eventime, target)`; address
`{ scope: 'story', storyId: 'main' }` separately from event data. Public output
uses `instance.events.onEvent`; diagnostics/traces use `instance.diagnostic`.
These are distinct observations. See [event scopes](event-scopes.md) for routing.

## Load packages on the shared owner

`codplay.load(packagePath, { root })` can also create occurrences on this same
owner, including beside manually created authoring occurrences. Each result has
its own `telco`; engine capabilities and preparation remain shared. The short
single-package example is in [single-scene playback](single-scene-playback.md).

For delaying creation after package preparation, the facade also exposes
`codplay.prepare(path, { root, cssSlot? })`. The returned fields feed the same
instance registry; the integration owns a CSS slot it explicitly chose.

Read the [scene package contract](../../../../packages/codplay/specs/scene-package-export-v1-spec.md)
for export/build tools and transport. Package loading does not require a second
manual preload, resource registration or instance creation.

## Read, preview, mount and release

- `instance.snapshot.get()` reads base logical state. `set(patches)` replaces a
  temporary preview at the presented time; inspect its structured result.
  `clear()` removes it. A preview is not a recorded action.
- `instance.presentation.get()` reads numeric rendered poses without DOM nodes.
  `instance.projection.setInputValue()` has a separate
  [input projection contract](../../../../packages/codplay/specs/input-projection-spec.md).
- To show one instance inside another, declare a `slot` with root-level `name`,
  create the child (a detached root is allowed), then use
  `codplay.instances.mount({ host: { instanceId, storyId, persoId }, childInstanceId })`.
  Its `detach()` removes the relationship, not the child. Read the
  [slot contract](../../../../packages/codplay/specs/slot-component-spec.md).
- Dispose subscriptions, call `codplay.instances.destroy(instanceId)` when an
  occurrence ends, and `codplay.destroy()` when the owner ends. Mounting never
  transfers the decision to play, seek or destroy another instance.
