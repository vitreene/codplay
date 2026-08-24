# Validation

> Status: En cours
> CodPlay version: V2 foundation
> Review: contrat initial validé le 2026-08-20; les services core portent leurs formes et politiques ouvertes

Validation is the pure bridge between the declarations in
`RuntimeCapabilityCatalog` and the `CompiledScene` build. It does not own a second
mutable registration catalog.

The compile-time markup sanitizer also lives in this boundary. It consumes the
pure `MarkupAttributeSanitizer` policies declared by services and writes the
sanitized template into `CompiledScene`; the runtime markup capability only owns
player-scoped parts and materialization registration.

Component declarations may also publish `sanitizeInitial` and `sanitizeAction`.
Those pure functions receive the validated perso profile and return the form
that is extracted into `CompiledScene`. They are the only place for deterministic
component defaults and author-to-runtime normalization; component classes do not
repeat those guards on the player hot path.

Service declarations may publish the same kind of pure `sanitize` function for
their namespace. The builder applies the component sanitizer first, then the
sanitizers of the services required by that component. For example, the `style`
service turns its declared color properties into ACE `ColorValue` records,
including OKLCH, before the compiled scene is frozen.

## Role

- CodPlay registers component, data-service, and ModuleService requirements in one runtime catalog.
- `RuntimeCapabilityCatalog.validationSnapshot()` produces the pure snapshot before compilation.
- `CompiledSceneValidationEngine` consumes that snapshot during compilation without instantiating runtime components or services.
- `GuardPipeline` runs named structural and capability rules in deterministic phases.
- Every registered component, core or foreign, declares a validator for its initial data profile.
- The built-in `tag`, `layout`, `list`, and `media` component boundaries are
  validated from their catalog definitions.
- A missing component validator is rejected at catalog registration; a service without a validator still produces the existing detailed warning until that service contract is completed.
- Unknown component types and unknown required services are errors because the player cannot execute them.
- The core `style`, `className`, `attr`, and `content` service validators are always present in the initial catalog.

## Definitions

Component definitions declare their type, required services, runtime ModuleServices, and their `validateInitial` function;
`validateAction` is added when the component owns action-specific fields. Service definitions declare reusable group validators and optional validators for named properties inside
those groups. Service names are therefore the property namespaces, including namespaces owned by one component.

The core declarations currently use the following policy: `style` and `attr`
remain open maps, `className` is the V1 string-or-patch form, and `content` is
string-valued at the serializable `CompiledScene` boundary. Runtime-only DOM
content is handled by the content materializer adapter and is not compiled.

The runtime component definition is the source of the component type, service names,
ModuleService names and component validators. The runtime service definition is the
source of its validation rules and materializer destinations. The builder therefore
does not receive a second authored component/service list.

Runtime modules are validated as engine capabilities and instantiated per player;
they are not added to the authored service namespace.
