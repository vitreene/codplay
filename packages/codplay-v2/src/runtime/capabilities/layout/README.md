# Layout Capability V2

Status: En cours  
CodPlay version: V2 foundation

`LayoutCapabilityState` stores the opaque mountable-part declarations owned by
component instances. `createLayoutModuleServiceDefinition()` exposes that state
through the existing player-scoped `RuntimeModuleService` catalog.

The capability does not create components, parse templates, read the DOM, or
mount children. A future component boundary registers materialized parts, and a
future renderer resolves those logical targets to substrate nodes.

## Contract

- one module instance exists per player;
- one component registration owns its mountable-part declarations;
- target IDs are compared as opaque exact values;
- target IDs are unique within one player module instance;
- removing a component removes all of its mountable parts;
- the module does not infer meaning from target names;
- the module state is independent from the logical `PersoState`.
