# Player

Status: Fixe
CodPlay version: V1 reference

Current implementation targets:

- `types.ts`
- `create-player.ts`
- `create-player-utils.ts`

Phase B integration scope now covered:

- `registerComponent(persoType, componentClass)` before `init(scene)`
- `overrideComponent(persoType, componentClass)` before `init(scene)`
- `getRuntimeRegistry()` for integration/editing commands
- runtime component orchestration delegated to renderer with stable registry exposure

Reference:

- `evolution/lots/lot-13-create-player-api-state.md`

Current proof-of-concept notes:

- public event injection available through `PlayerFacade.emit(...)`
