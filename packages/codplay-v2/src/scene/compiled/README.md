# Compiled Scene

> Status: En cours
> CodPlay version: V2 foundation

This folder owns the versioned, serializable `CompiledScene` contract.

- schema and declared requirements
- immutable artifact types
- codecs for serialization and deserialization

The V2 contract keeps the V1 envelope and adds typed requirements. Authoring
types remain in `src/scene/types.ts`; they do not leak into the
compiled artifact.

`CompiledScene` is an artifact produced by the scene build. It is not a
parallel top-level `compiled-scene` module.
