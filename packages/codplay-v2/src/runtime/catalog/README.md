# Runtime Capability Catalog

> Status: En cours
> CodPlay version: V2 foundation

`RuntimeCapabilityCatalog` is the single registration boundary composed when a
CodPlay instance is initialized. It contains component definitions, service
definitions and player-scoped module definitions.

The same definitions provide runtime factories and the pure validation snapshot.
Pure service declarations live in `src/services/<service>/`; materializer-specific
bindings are assembled by the corresponding runtime adapter. The current HTML/SVG
component family receives the services declared by its component type and the
selected materializer destination.
`BaseComponent` itself does not receive or expose this facade; a future
materializer-specific component family owns its own service boundary.

The current executable factory signature is intentionally limited to the HTML/SVG
tranche: the catalog binds an `HTMLComponentServices` facade for the built-in
components. This does not define the future Canvas, Three.js or Rive factory
contract; that boundary must be specified before another substrate is registered.

Core definitions may be overridden and foreign definitions may be added before
the catalog is locked. After the lock, the engine, player, component runtime and
materializers all consume this same catalog. Runners and demos do not register
services, modules or component factories locally. A component definition may
also publish a typed runtime surface adapter; the component runtime stores the
result per mounted instance and exposes it to modules through a resolver, never
through the concrete component class.
