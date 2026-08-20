# List Capability V2

> Status: Fixe
> CodPlay version: V2 foundation
> Review: contrat de membership et d'ordre structurel validé le 2026-08-20; politiques de reorder restent une extension

The list module is now a capability marker. Ordered membership is part of the
canonical `SolvedGraph` and its immutable `StructuralTimeline`; list no longer
maintains mutable state, touched sets, capture groups or a historical replay.

The structural reducer applies one complete event boundary at a time:

1. remove moved or detached items from their previous target;
2. insert mounted items according to `first`, `last`, numeric or automatic mode;
3. reconcile exact membership against the solved scene;
4. freeze the complete order snapshot.

An intra-list reorder keeps the same target and is presented as local movement by
default. A transfer to another list changes target and is classified as reparent
movement by the motion graph. This inference does not require `flipMode`.

The list capability does not read the DOM, measure geometry or perform visual
materialization.
