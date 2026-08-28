# Animation Core

Status: Fixe
CodPlay version: V1 reference

Phase 1 implementation target (Lot 03):

- `adapter.ts`
- `derive-simple.ts`
- `run-batch.ts`
- `types.ts`

Current baseline behavior:

- `derive-simple.ts` forwards any valid `style` property without an allowlist.
- animation targets can be html-like nodes or arbitrary objects.

Roadmap:

- Phase 2 (Lot 05): property-agnostic transition derivation (done).
- Phase 3 (planned Lot 06+): support broader style transitions with stronger validation.

Reference:

- `evolution/lots/lot-03-animation-bridge.md`
- `evolution/lots/backlog.md`
