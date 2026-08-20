# Runtime Capability Catalog

> Status: En cours
> CodPlay version: V2 foundation

`RuntimeCapabilityCatalog` is the single registration boundary composed when a
CodPlay instance is initialized. It contains component definitions, service
definitions and player-scoped module definitions.

The same definitions provide runtime factories and the pure validation snapshot.
Each service declaration also lists the materializer IDs it supports; the
component factory receives only the services declared by its component type and
the selected materializer destination.

Core definitions may be overridden and foreign definitions may be added before
the catalog is locked. After the lock, the engine, player, component runtime and
materializers all consume this same catalog. Runners and demos do not register
services, modules or component factories locally.
