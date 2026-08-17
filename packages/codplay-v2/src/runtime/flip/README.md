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

`HtmlFlipRuntime` returns structured `FlipOperationResult` diagnostics through the
V2 `DiagnosticCollector` boundary. Pure pose/capture functions may still reject
invalid invariants internally; the runtime converts those failures into diagnostic
reports for the application.

The FLIP runtime and its standalone HTML pose utility do not import `codplay` V1.
The authoring `selection-frame` package remains a separate V1 application; its
package typecheck is not a CodPlay V2 validation command.

The standalone HTML pose utility derives layout origins, local dimensions, parent
matrices, and transformed AABB values from layout offsets and computed transforms.
It does not use `getBoundingClientRect()` as a position source or as a calibration
source.

The validation demo lives in `packages/authoring/selection-frame/demos/flip` and
runs with `npm run demo:flip` from the repository root. It reproduces the Player
POC scene at `packages/demos/src/scenes/player-poc-scene.ts`, including drifting
transformed lists, five staged inserts, the first-item reorder and returns to the
origin, while replacing the V1 FLIP engine with the V2 runtime and exact seek path.
