# Renderer

Status: Fixe
CodPlay version: V1 reference

Current implementation targets:

- `types.ts`
- `create-renderer.ts`

Phase B integration scope now covered:

- component registry (`registerComponent`, `overrideComponent`) locked after `load`
- one runtime component instance per story item
- update routing by target item id toward component instances
- global move routing child -> parent list via runtime registry
- stable runtime registry API (`getNodeById`, `getListById`, parent/mounted maps)

Reference:

- `evolution/formalisation-modele/06-runtime-contract.md`
- `evolution/formalisation-modele/12-runtime-migration-plan-v1.md`
