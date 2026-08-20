# Compiled Scene

> Status: En cours
> CodPlay version: V2 foundation
> Review: tranche structurelle validée le 2026-08-20; dérivation complète des propriétés reste ouverte

This folder owns the internal, serializable `CompiledScene` contract.

- schema and declared requirements
- immutable artifact types
- scene builder, function extraction, and deterministic derivations
- codecs for serialization and deserialization

The V2 contract owns its envelope and typed requirements. Authoring
types remain in `src/scene/types.ts`; they do not leak into the compiled
artifact.

`CompiledScene` is an artifact produced by the scene build. It is not a
parallel top-level `compiled-scene` module.

`SceneBuilder` currently covers the first build slice: active stories, structural
and catalog validation, external function references, resource requirements, root
candidates, and runtime freezing. The structural codec boundary is fixed; semantic
import validation and full property/default derivation remain open in
V2 foundation.

## Path values

An authored `move.transition.path` remains an SVG `d` string in `SceneDoc`. The
builder converts it once into the JSON-safe `Path` object defined by ACE. The
canonical syntax transformation is `prepareSvgPath`, exported from
`src/ace/index.ts`; it is pure, deterministic, independent of the DOM and safe
to reuse from a future strap that produces a dynamic path. A strap must return
the prepared object rather than making the runtime parse SVG syntax.

`compileMovePath`, exported from this folder, is the higher-level payload
transform used by `SceneBuilder`: it finds a `move.transition.path`, applies
the shared ACE conversion and preserves the surrounding move declaration. It is
useful to code that transforms a complete move payload, while
`prepareSvgPath` remains the primitive for a single path value.

Target IDs in the runtime artifact are opaque and scene-unique. Factories outside
CodPlay may compose story and perso IDs; CodPlay does not infer target origin from
their spelling.

Runtime ModuleService requirements are derived from component capability declarations
at build time and stored in `CompiledRequirements.modules`. The builder does not load
or instantiate runtime services.
