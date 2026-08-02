# Markup Module V2

Status: En cours  
CodPlay version: V2 foundation

`MarkupCapabilityState` stores the opaque public-part declarations owned by
component instances. `createMarkupModuleServiceDefinition()` exposes that state
through the existing player-scoped `RuntimeModuleService` catalog.

The module does not create components, sanitize templates, read the DOM, or mount
children. `registerMaterializedComponent()` is the boundary adapter for a future
component materializer; a future renderer resolves those logical targets to
substrate nodes.

Registered targets are exposed to the player through `getMountTargets()`. The
player merges those declarations with its host targets before calling
`solveScene()`.

`materializeComponentWithMarkup()` stores the component root, registers the
public materialized parts, and returns the matching cleanup operation. The DOM
or JSX materializer remains responsible for producing the root and all detected
parts. The runtime component definition selects which detected part IDs may be
published as public mount targets.

## Contract

- one module instance exists per player;
- one component registration owns its mountable-part declarations;
- target IDs are compared as opaque exact values;
- target IDs are unique within one player module instance;
- removing a component removes all of its mountable parts;
- the module does not infer meaning from target names;
- the module state is independent from the logical `PersoState`.
