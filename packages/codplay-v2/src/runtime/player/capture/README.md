# Player capture internals

> Status: Fixe
> CodPlay version: V2 foundation

This folder contains the source-agnostic capture subdomains used by
`RuntimePlayer`. It does not own the public capture API or a second journal.

- `action-target-index.ts` resolves compiled live-action targets once;
- `live-capture-actions.ts` reapplies active actions through component surfaces;
- `state-updates.ts` reconciles non-journaled capture state and cancellation;
- `types.ts` defines the player-owned capture state shapes.
