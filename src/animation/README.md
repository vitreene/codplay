# Animation Core

Phase 1 implementation target (Lot 03):

- `adapter.ts`
- `derive-simple.ts`
- `run-batch.ts`
- `types.ts`

Current temporary limitation (Phase 1 / Lot 03):

- `derive-simple.ts` only supports `opacity`, `x`, `y`, `scale`, `rotate`.

Roadmap to lift this limitation:

- Phase 2 (planned Lot 05): replace the hardcoded subset with a configurable property registry.
- Phase 3 (planned Lot 06+): support broader style transitions with stronger validation.

Reference:

- `evolution/lots/lot-03-animation-bridge.md`
- `evolution/lots/backlog.md`
