# List Capability V2

> Status: Fixe
> CodPlay version: V2 foundation
> Review: contrat V2 de la capacité et branchement FLIP validés le 2026-08-21

The list module is a player-scoped capability used by the `list` component
declaration. It supplies the automatic-reorder policy to the structural
boundary; it does not own a second order history. Ordered membership remains
part of the canonical `SolvedGraph` and its immutable `StructuralTimeline`.

The policy is read from `initial.config` on a list perso:

```ts
config: {
  reorderOnMove?: boolean
  reorderOnAdd?: boolean
  reorderOnRemove?: boolean
}
```

All three switches default to `true`. An explicit placement mode (`first`,
`last`, `prepend`, `append` or a numeric position) remains effective. An
automatic placement (`auto`) can be kept at its current position when the
corresponding switch is `false`; `reorder: false` always suppresses the order
change. The rule is expressed without direct DOM mutation.

The structural reducer applies one complete event boundary at a time:

1. remove moved or detached items from their previous target;
2. insert mounted items according to `first`, `last`, numeric or automatic mode;
3. reconcile exact membership against the solved scene;
4. freeze the complete order snapshot.

An intra-list reorder keeps the same target and is presented as local movement by
default. A transfer to another list changes target and is classified as reparent
movement by the motion graph. This inference does not require `flipMode`.

The HTML materializer reads the resulting complete order and projects it onto
the persistent author nodes. The FLIP reader then compares the complete
before/after layouts. Transition parameters remain on the authored `move`:
`move.transition.duration`, `ease`, `path` and `traversal` are consumed by the
existing motion graph; the list module does not create a parallel animation
pipeline.

The list capability does not read the DOM, measure geometry or perform visual
materialization. Visual preview remains the responsibility of the selected
materializer and its source-specific adapter.
