# Create and register a component

Read [component materialization](../../../../packages/codplay/specs/component-materialization-v2-spec.md),
the [catalog contract](../../../../packages/codplay/specs/facade-v2-spec.md) and
[library preparation](../../../../packages/codplay/specs/third-party-library-spec.md).
The example below is an external author-defined component, not a new core type.
It uses the existing validation, service and materialization circuits.

## Create a component with its own profile

A counter owns a numeric `count` and projects it into an `<output>`. It derives
from `BaseHTMLComponent`, not `TagComponent`. Its `render`, `update`, validation
and initial normalization are explicit. Save this example as `counter.ts` in a
feature folder of the integration package:

```ts
import {
  BaseHTMLComponent,
  type ComponentInput,
  type ComponentUpdateInput,
  type RuntimeComponentDefinition,
  type ValidationFunction,
} from 'codplay'
import {
  isComponentRecord,
  reportInvalidComponentValue,
} from 'codplay/runtime/components/component-validation'

export type CounterInitial = Readonly<{ count?: number }>
export type CounterAction = Readonly<{ count?: number }>
export type CounterState = Readonly<{ count: number }>

/** Projects the counter's resolved numeric state through the content service. */
export class CounterComponent extends BaseHTMLComponent<CounterState> {
  static readonly declaredServices = ['content'] as const

  /** Declares only the service needed by this component. */
  constructor(input: ComponentInput<CounterState>) {
    super(input)
    this.services.declare(CounterComponent.declaredServices)
  }

  /** Supplies the persistent HTML representation to the materializer. */
  render(): string {
    return '<output id="counter-root"></output>'
  }

  /** Displays complete resolved state without keeping another counter value. */
  update(input: ComponentUpdateInput<CounterState>): void {
    if (this.node === null) throw new Error('Counter root is not materialized')
    this.services.apply(this.node, { content: String(input.state.count) })
  }
}

/** Validates the component-owned count in initial data and partial actions. */
export const validateCounter: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_COUNTER_INVALID', 'Counter data must be a plain object.')
    return
  }
  if (value.count === undefined) return
  if (typeof value.count === 'number' && Number.isFinite(value.count)) return
  reportInvalidComponentValue(context, 'AUTHOR_COUNTER_COUNT_INVALID', 'count must be a finite number.', 'count')
}

/** Completes the initial state once; partial actions must retain omitted fields. */
export function sanitizeCounterInitial(value: Readonly<Record<string, unknown>>) {
  return { ...value, count: value.count === undefined ? 0 : value.count }
}

export const counterDefinition: RuntimeComponentDefinition = {
  type: 'counter',
  component: CounterComponent,
  modules: [],
  validateInitial: validateCounter,
  validateAction: validateCounter,
  sanitizeInitial: sanitizeCounterInitial,
}
```

Validation happens at build time. `update` receives the complete resolved state;
it does not repeat author validation or increment mutable component state.
The [perso action guide](perso-actions.md) explains how the component's action
profile relates to patches, incoming data, recipients and calculated values.
`sanitizeInitial` makes the initial zero explicit. It is deliberately not used
as `sanitizeAction`: an action `{}` must not reset `count` to zero.

The service namespace `content` is used to project the component's own `count`;
`count` is not a new global service. A component can translate its own domain
fields into existing services. No new module is needed for this counter, and
there is no initialization or destruction work beyond the inherited lifecycle.
The fixed DOM ID illustrates one authored template; scope authored IDs when an
integration places several such templates on the same page.

For plain tag specialization without a new profile, extending `TagComponent`
and reusing `validateTagInitial`/`sanitizeTagInitial` remains the shorter choice.
Use the appropriate base for the actual responsibility.

## Author a scene using the external component

Save this declaration as `counter-scene.ts` beside `counter.ts`. The authored
scene selects the registered type and supplies its profile:

```ts
import type { SceneDoc } from 'codplay'

export const scene: SceneDoc<string> = {
  id: 'counter-scene',
  stories: {
    main: {
      id: 'main',
      persos: [{
        id: 'score',
        type: 'counter',
        initial: { count: 1, move: '@root' },
        actions: { 'show-result': { count: 5 } },
      }],
      eventimes: [{ name: 'show-result', startAt: 500 }],
    },
  },
}
```

`SceneDoc<string>` allows external types while registered validators enforce
their profiles. The output reads `1`, then `5` at 500 ms; Seek reconstructs
those values. External registration does not add `counter` to the core types.

## Register and load through the public facade

Save the shared definition configuration as `counter-engine.ts`. Supply it as
`--engine-config` when [exporting the scene package](../../../../packages/codplay/specs/scene-package-export-v1-spec.md#entrée-et-production-du-paquet),
so export validates the same definitions that the site registers:

```ts
import { counterDefinition } from './counter'

export const engineCapabilities = {
  components: { register: [counterDefinition] },
}
```

The site loads that exported package into an existing `scene-root` element.
Save this application module as `counter-player.ts`:

```ts
import { CodPlay } from 'codplay'
import { engineCapabilities } from './counter-engine'

export const player = new CodPlay({ engine: engineCapabilities })
export const instance = await player.load('/scenes/counter/', { root: '#scene-root' })
await instance.telco.play()
```

Construction registers the external definition before loading. Alternatively,
use `player.components.register(counterDefinition)` and check its structured
result before the first build/load/create. `load()` handles preparation and
creation; normal playback uses [telco](telco.md). Call `player.destroy()` when
the owning integration ends. Registration configures capabilities, not a new
clock; explicit engine orchestration belongs to [multiple instances](engine-and-instances.md).

Keep an external component's classes, validators and types in its own feature
folder/package. Import `BaseComponent`, `BaseHTMLComponent` and `TagComponent`
from the root `codplay` module used by the runtime. For a bundled integration,
keep that root module external and resolve it to the already loaded player;
a second copy breaks the HTML `instanceof` boundary. The counter's two pure
validation helpers are existing runtime subpath exports, not alternate bases.
A scene package does not install external component code: its site must already
have registered the definitions before `load()`.

## Add an accepted component to the core

Adding a core type changes the shared runtime and authoring contract. It requires
explicit core authorization and accepted implementation work under repository
gates. This example is documentation, not authorization to add a counter.
When that integration is authorized, the owners to update are:

1. Put the feature under
   `packages/codplay/src/runtime/components/counter/`, with
   `counter-component.ts`, `counter-types.ts`, `counter-validation.ts` and
   `index.ts`. Separate the example's class, types and validators by those
   responsibilities. Inside core, use the existing relative imports for bases
   and validation helpers rather than importing the package into itself.
2. Re-export the feature from
   [`runtime/components/index.ts`](../../../../packages/codplay/src/runtime/components/index.ts).
   In [`create-core-runtime-catalog.ts`](../../../../packages/codplay/src/runtime/catalog/create-core-runtime-catalog.ts),
   add its definition and register it with core origin, using the same class,
   service declaration, validators and sanitizers. Do not keep a second external
   registration of that type in applications.
3. Add `counter: { initial: CounterInitial; action: CounterAction }` to
   `PersoTypeRegistry` in [`scene/types.ts`](../../../../packages/codplay/src/scene/types.ts).
   `CorePersoType` derives from this registry. Export public types/classes from
   [`src/index.ts`](../../../../packages/codplay/src/index.ts) when the agreed
   public API requires them. Updating TypeScript types alone does not register
   a runtime capability.
4. Reuse existing services. If the accepted capability needs a new service or
   module, register its definition in that same core catalog; do not create a
   parallel property application, preload, event or placement mechanism.
5. Verify the catalog snapshot and compiled requirements, valid/invalid initial
   and action inputs, preserved partial-action semantics, real materialization,
   Play/Seek/reset and destruction. Run package checks from `packages/codplay`.
   Maintain the owning specification for the implemented, verified behavior;
   adding a type to a list does not certify it.

A library-specific integration normally remains in its integration package,
like `@codplay/component-v2`. Core promotion and dependency loading are separate
decisions; an external component can be fully supported without becoming core.

## Connect an external component to a third-party library

External **component code**, a prepared **library runtime**, and scene **assets**
are three different inputs. Installing/registering the component does not load
its library, and registering a library does not discover component definitions.
The dependency-free counter above needs no library preload.

For the existing Three.js integration, configure the same public owner before
loading a package. This example belongs to the site integration module:

```ts
import { CodPlay } from 'codplay'
import {
  THREEJS_CORE_COMPONENTS,
  THREE_LIBRARY,
  THREE_PRELOAD_STRATEGIES,
} from '@codplay/component-v2'

export const player = new CodPlay({
  engine: {
    components: { register: THREEJS_CORE_COMPONENTS },
    libraries: { register: [THREE_LIBRARY] },
  },
  preload: { strategies: THREE_PRELOAD_STRATEGIES },
})
```

These are the existing host/camera/light definitions. Use the
[native scene example](native-rendering.md) to author them. Reuse `THREE_LIBRARY`
rather than creating another Three loader. Its `load()` imports the library;
the component definitions declare `libraries: ['three']`, so the builder derives
`requirements.libraries`. For another library, its integration supplies a
`RuntimeLibraryDefinition` with its own ID and `load()` result, and optional
`release()` for resources the engine owns.

The component constructor consumes the already prepared value with
`input.runtime!.getLibrary<ThreeRuntime>('three')`; it does not call `import`,
`fetch`, `load()` or a global library registry. The existing
[`BaseThreeComponent` and `BaseThreeHTMLComponent`](../../../../packages/authoring/component-v2/src/threejs/core/threejs-component.ts)
show this injection in full. Reuse these bases for a Three extension, or use
the same `ComponentInput.runtime` contract for another integration. Native
consumers receive their opaque target separately through `input.target` on
update; library injection is not `rel` resolution.

| Mode | Existing preparation boundary |
| --- | --- |
| Runtime integrator assembling a runner | Internal `runner.run({ preload })` prepares required libraries before preload and initialization |
| One exported package | `CodPlay.load()` performs preparation before returning the occurrence |
| Shared multi-instance engine with manual creation | `await codplay.engine.prepareScene(compiledScene)` precedes resource preload and `instances.create()` |

Use this configured owner for `player.load()`; register the same capabilities
for export through a configuration module. For explicit multi-instance
composition, use these same engine groups and preload options. Library
preparation is shared per engine, while component-native
resources remain per component. `release()` runs when the library-owning
engine is destroyed; destroying a component does not release the shared library.

Files such as GLB/FBX/Rive documents remain preload resources and use the
integration's strategies. They are not library definitions and no handle enters
`CompiledScene`. A missing library can be a build warning, but failed library
preparation prevents initialization; never compensate with a late load in
`initialize()` or `update()`.

## Preserve component boundaries

For another HTML/SVG feature use `BaseHTMLComponent`; for a logical native
component use `BaseComponent` without fake markup. Static `declaredServices`
and constructor `services.declare` must agree. Define `validatePerso` for new
root-level fields, `validateAction` for action payloads and sanitizers only at
the build boundary that owns normalization.

`initialize` follows materialization and precedes the first update. The runtime
keeps component instances across snapshots, supplies resolved state/time and,
when relevant, `activeActions`, `target` and `registerAnimation`. Content samples
precede host commit. Use `beforeSeek`/`afterSeek`, `onSequenceEnd`/`onReset` and
`destroy` for owned sources/resources rather than adding an independent clock.
For continuous sources use the provided [capture port](capture.md).

`mountableParts`/`mountablePartResolver` selects public outlets/anchors from a
template. `surfaces` exposes component operations, while `targetProvider`
publishes opaque `rel` targets. These remain distinct from each other and from
the placement registry. See [native rendering](native-rendering.md).
