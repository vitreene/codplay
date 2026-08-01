# List Capability V2

Status: En cours  
CodPlay version: V2 foundation

## Role

`ListCapabilityState` is a pure capability/service state. It consumes generic
`mount`, `unmount`, and `move` deltas produced by the move core and maintains
logical parent, mounted state, and child order for registered list targets.

The list capability is cross-layer by contract: a future instance will also
coordinate the affected-item set and batched render measurement before projection.
That render coordination is intentionally not implemented in this state module.

It does not create components, read the DOM, perform FLIP, or assume one list
component implementation. Renderer and component adapters consume its snapshots.

## Contract

- list target IDs are opaque;
- reorder policies are owned by the capability configuration;
- explicit move modes override disabled automatic reorder policies;
- transfer is processed as source removal followed by target insertion;
- the capability is deterministic and replayable from move deltas.
