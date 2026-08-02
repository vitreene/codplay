# HTML FLIP

Status: En cours  
CodPlay version: V2 foundation

This module is an HTML-only FLIP capability. It does not know list policy or the
generic move contract. Consumers provide a stable touched set and one mutation.

The host owns the canonical pose implementation from `overlay-pose.ts`. FLIP stores
only numeric poses in persist-only captures and resolves one hierarchical pose graph
for both play and seek. The persisted capture contains no HTML handle.

The projection adapter declares its host context and projection epoch. A cold seek
may use a consumer-owned `FlipCaptureResolver` to realize an existing capture from
the event/history boundary; FLIP then caches that capture before resolving it.

The validation demo lives in `packages/authoring/selection-frame/demos/flip` and
runs with `npm run demo:flip` from the repository root. It reproduces the Player
POC scene at `packages/demos/src/scenes/player-poc-scene.ts`, including drifting
transformed lists, five staged inserts, the first-item reorder and returns to the
origin, while replacing the V1 FLIP engine with the V2 runtime and exact seek path.
