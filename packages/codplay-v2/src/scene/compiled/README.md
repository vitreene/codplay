# Compiled Scene

> Status: En cours
> CodPlay version: V2 foundation

This folder owns the versioned, serializable `CompiledScene` contract.

- schema and declared requirements
- immutable artifact types
- scene builder, function extraction, and deterministic derivations
- codecs for serialization and deserialization

The V2 contract keeps the V1 envelope and adds typed requirements. Authoring
types remain in `src/scene/types.ts`; they do not leak into the
compiled artifact.

`CompiledScene` is an artifact produced by the scene build. It is not a
parallel top-level `compiled-scene` module.

`SceneBuilder` currently covers the first build slice: active stories, structural
and catalog validation, external function references, resource requirements, root
candidates, and runtime freezing. Codec support and full property/default
derivation remain open in V2 foundation.

Target IDs in the runtime artifact are opaque and scene-unique. Factories outside
CodPlay may compose story and perso IDs; CodPlay does not infer target origin from
their spelling.

Runtime ModuleService requirements are derived from component capability declarations
at build time and stored in `CompiledRequirements.modules`. The builder does not load
or instantiate runtime services.
