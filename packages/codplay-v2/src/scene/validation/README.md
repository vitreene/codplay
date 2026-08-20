# Validation

> Status: En cours
> CodPlay version: V2 foundation
> Review: contrat initial validé le 2026-08-20; validateurs de propriétés et de familles restent à ajouter

Validation is the pure bridge between the declarations in
`RuntimeCapabilityCatalog` and the `CompiledScene` build. It does not own a second
mutable registration catalog.

## Role

- CodPlay registers component, data-service, and ModuleService requirements in one runtime catalog.
- `RuntimeCapabilityCatalog.validationSnapshot()` produces the pure snapshot before compilation.
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

The runtime component definition is the source of the component type, service names,
ModuleService names and component validators. The runtime service definition is the
source of its validation rules and materializer destinations. The builder therefore
does not receive a second authored component/service list.

Runtime modules are validated as engine capabilities and instantiated per player;
they are not added to the authored service namespace.
