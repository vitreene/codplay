# Play one scene

Read the [facade contract](../../../../packages/codplay/specs/facade-v2-spec.md).
Use `CodPlay.load()` for a scene exported as a package. It owns preparation,
resource preload and occurrence creation; the returned instance owns transport.
The final section documents internal assembly for runtime integrators.
Shared-engine orchestration belongs to the
[multi-instance guide](engine-and-instances.md).

## Load one exported package

Read [package loading](../../../../packages/codplay/specs/scene-package-export-v1-spec.md)
and the [facade](../../../../packages/codplay/specs/facade-v2-spec.md). The
short public distribution path is:

```ts
import { CodPlay } from 'codplay'

export const player = new CodPlay()
export const instance = await player.load('/scenes/welcome/', { root: '#scene-root' })
await instance.telco.play()
```

Here the scene has already been compiled and exported. `load()` prepares the
package and returns a paused occurrence; it does not start playback. Configure
any required components, libraries and preload strategies before loading.
Export a module exposing `scene` using the
[scene package tools](../../../../packages/codplay/specs/scene-package-export-v1-spec.md#entrée-et-production-du-paquet);
optional component definitions used during export and loading must agree.
The same method can later load several occurrences,
but loading one requires no explicit engine management.

Use [`instance.telco`](telco.md) to pause, seek or reset this loaded occurrence, and
`player.destroy()` when its owner ends. Use instance events for live input;
see [listen](listen.md), [straps](straps.md) and [capture](capture.md). Do not copy the manual
multi-instance preparation sequence into this package-loading path.

## Internal assembly for an authored SceneDoc

This is a runtime integration reference, not the user-facing loading API. It
exposes a catalog, builder, compiled functions and preload ownership. Do not
recommend it as the normal way for an author to play a scene.

Given `scene` from the [scene guide](scene-authoring.md) and an existing
`<div id="scene-root"></div>`, build with one catalog and give the result to
`HtmlPlayerRunner`. This example uses core capabilities. Omit its `engine`
option: the runner owns its internal
engine and ticker. `run()` handles library preparation, resource preload,
resource handoff, initialization and Play in order.

```ts
import { createCoreRuntimeCatalog } from 'codplay/runtime/catalog'
import { createRuntimePreload } from 'codplay/runtime/preload'
import { HtmlPlayerRunner } from 'codplay/runtime/runner-html'
import { SceneBuilder } from 'codplay/scene/compiled'
import { scene } from './scene'

const root = document.getElementById('scene-root')
if (root === null) throw new Error('Missing scene-root')
export const catalog = createCoreRuntimeCatalog()
export const preload = createRuntimePreload()
const build = new SceneBuilder(catalog.validationSnapshot()).build(scene)
if (!build.ok) {
  throw new Error(build.diagnostics.errors.map(({ message }) => message).join('\n'))
}

export const runner = new HtmlPlayerRunner({
  id: 'welcome-player',
  compiledScene: build.compiledScene,
  functions: build.functions,
  catalog,
  root,
})
const result = await runner.run({ preload, preloadOptions: { mode: 'author' } })
if (!result.ok) {
  runner.destroy()
  preload.cancel()
  preload.release(build.compiledScene.resources.entries.map(({ url }) => url))
  throw new Error(`Scene startup failed: ${result.phase}`)
}
```

These are the existing runtime subpath imports, not new root-facade helpers.
For an optional integration, substitute its existing `catalog` and `preload`
for the two core-only constructions above. Register definitions before taking
the validation snapshot and constructing the runner; build and playback use
that same catalog. Do not build with one catalog and give a different one to
the runner.
Configure integration-specific strategies on `preload`; see
[component extension](component-extension.md) and [native rendering](native-rendering.md).

The successful `run` has already started playback. Control this scene through
`runner.pause()`, `runner.play()`, `runner.seek(timeMs)`, `runner.reset()` and
`runner.setRate(rate)`. `seek` returns a structured result; inspect `ok` and
its diagnostics. No `instances.create`, explicit `engine.prepareScene`,
`resources.register` or engine transport calls are needed for this path.
The internal engine still performs its normal preparation and timing work.

On teardown call `runner.destroy()`. The preload service is supplied by its
caller and has a separate lifecycle: cancel pending work, release retained
resource URLs and clear any CSS slots that caller owns. A runner given a shared
engine does not own that engine's destruction; that is a different composition.

