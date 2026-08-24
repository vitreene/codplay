# Engine

> Status: En cours
> CodPlay version: V2 foundation

This folder owns the engine boundary for capabilities shared by player instances.

- the `RuntimeCapabilityCatalog` supplied by CodPlay initialization
- shared resources and caches
- clock ownership
- instance ordering and shared services

The engine does not own the preload decision. The external `RuntimePreload`
service receives manifests from diffusion, Sighty, or the editor. Once that
service has prepared a manifest, its caller registers the available URLs with
`registerResources()` before initializing a player. This keeps requirement
validation synchronous without adding a preload branch to player initialization.

Components, data services and runtime modules are registered in the same catalog.
Each component declaration names the services and modules it accepts; the catalog
creates only those service instances for the selected materializer. Core definitions
can be overridden, and foreign definitions can be added, before the catalog is
locked.

Runtime modules are defined in the catalog and instantiated per player. The engine
owns capability availability and grouped seek coordination; module state is never
a module-level singleton. A module receives only the typed
`RuntimeComponentSurfaceResolver` needed to operate on player-local mounted
components; the engine never exposes a concrete component instance through this
context.

Player lifecycle creation, initial solved-scene initialization, move-delta routing,
staged seek preparation/commit, and destruction are wired through that single
catalog boundary.

Grouped seek is synchronous and returns one structured diagnostic report per target
instance after `validate -> prepare -> commit -> present`.

The engine does not read `SceneDoc`.
