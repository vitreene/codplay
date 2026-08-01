# Validation Catalog

> Status: En cours
> CodPlay version: V2 foundation
> Review: required before component integration

The validation catalog is the pure bridge between declared CodPlay capabilities and
the `CompiledScene` build.

## Role

- CodPlay registers component, data-service, and ModuleService requirements while capabilities are declared.
- The catalog produces a snapshot before compilation.
- `CompiledSceneValidationEngine` consumes that snapshot during compilation without instantiating runtime components or services.
- `GuardPipeline` runs named structural and capability rules in deterministic phases.
- A component validator is optional during the initial V2 rollout.
- Missing component or service validators produce detailed author warnings.
- Unknown component types and unknown required services are errors because the player cannot execute them.
- The core `style`, `className`, and `attr` service validators are always present in the initial catalog.

## Definitions

Component definitions declare their type, required services, runtime ModuleServices, and optional `validateInitial` and `validateAction`
functions. Service definitions declare reusable group validators and optional validators for named properties inside
those groups. Service names are therefore the property namespaces, including namespaces owned by one component.

The final registration API must have one source for the service declaration. Two shapes
remain to be decided: static metadata read from the component at registration, or one
descriptor consumed both by the runtime component and by the validation catalog. The
current V2 implementation is `En cours`; it must not introduce a second authored service
list while this boundary is being fixed.

The initial catalog imports the core service definitions for `style`, `className`,
and `attr` from `src/services/`. The catalog owns registration and snapshotting;
the services own their validation rules.

Runtime modules and capabilities follow a separate engine catalogue boundary. A
module requirement is validated as an engine capability and instantiated per player;
it is not added to the authored service namespace.
