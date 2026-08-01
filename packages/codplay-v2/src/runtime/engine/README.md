# Engine

> Status: En cours
> CodPlay version: V2 foundation

This folder owns capabilities shared by player instances.

- component and module catalogs
- shared resources and caches
- clock ownership
- instance ordering and shared services

Runtime modules are defined at engine scope and instantiated per player. The engine
owns shared capability availability and grouped seek coordination; module state is
never a module-level singleton.

`RuntimeModuleServiceCatalog` now provides the definition/factory boundary. Player lifecycle
creation, initial solved-scene initialization, move-delta routing, staged seek
preparation/commit, and destruction are wired.

Grouped seek is synchronous and returns one structured diagnostic report per target
instance after `validate -> prepare -> commit -> present`.

The engine does not read `SceneDoc`.
