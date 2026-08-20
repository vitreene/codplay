# Move State

Status: Fixe
CodPlay version: V2 foundation
Review: placement pure et deltas structurels validés le 2026-08-20; les politiques de liste restent hors de ce module

This folder owns pure placement policy and generic state deltas.

The author-facing `move` shape is specified in
[`../../plan/move-contract-plan.md`](../../plan/move-contract-plan.md). The
author uses `target`; the runtime policy may resolve it to opaque `targetId` and
`parentKey` values. Transition properties are part of the author contract. SVG
`path` values are compiled into normalized prepared segments before this policy
receives the compiled scene; this folder only carries them through placement
state and deltas.

- same-tick move conflict resolution;
- opaque target placement selection;
- `mount`, `unmount`, and `move` deltas between solved scenes;
- no list ordering policy, DOM access, component instance, or FLIP materializer.

List capabilities consume the deltas and own their container-specific reorder
policies. Materializers consume later presentation requests.
