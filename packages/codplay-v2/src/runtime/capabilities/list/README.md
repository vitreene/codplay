# List Capability V2

Status: En cours  
CodPlay version: V2 foundation

## Role

`ListCapabilityState` is a pure capability/service state. It consumes generic
`mount`, `unmount`, and `move` deltas produced by the move core and maintains
logical parent, mounted state, and child order for registered list targets.

The list capability is cross-layer by contract: its state coordinates the affected
item set and batched render ordering before projection.
`ListCapabilityState` now publishes authoritative child order and a consumed
touched-item snapshot to the player projection boundary. The snapshot contains no
DOM handle and does not perform FLIP itself.

`createListModuleServiceDefinition()` wraps this state for the engine module-service catalog. The
factory receives the initial solved scene and subsequent move deltas through the
player lifecycle. A future list implementation can add `prepareSeek` to stage a
replacement state before the grouped commit.

It does not create components, read the DOM, perform FLIP, or assume one list
component implementation. Renderer and component adapters consume its snapshots.

## Contract

- list target IDs are opaque;
- reorder policies are owned by the capability configuration;
- explicit move modes override disabled automatic reorder policies;
- transfer is processed as source removal followed by target insertion;
- the capability is deterministic and replayable from move deltas.

For a cold historical HTML presentation, the player creates a temporary module
instance, initializes it from the `t=0` solved scene, and replays compiled event
boundaries up to the requested scene before consuming the layout snapshot. The
live player-scoped instance is not modified by this replay.
