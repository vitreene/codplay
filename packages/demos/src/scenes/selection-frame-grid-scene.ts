import type { AutoCapsuleGridArtifact } from "@codplay/capsule-automation";
import type { SceneDoc } from "codplay/player/types";

export const GRID_CONTAINER_ID = "grid-capsule";
export const GRID_ITEM_ID = "grid-edited-item";

/**
 * Validation scene for the SelectionFrame grid mode: one grid container whose
 * structure comes from capsule-automation (AutoCapsuleGridArtifact.inlineStyle)
 * and one child placed in the grid. The demo wires a GridPlacementAdapter and
 * the gabarit on top. See docs/plans/2026-06-09-selection-frame-plan.md.
 */
export function createSelectionFrameGridScene(grid: AutoCapsuleGridArtifact): SceneDoc {
  return {
    id: "selection-frame-grid-scene",
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      "selection-frame-grid-story": {
        id: "selection-frame-grid-story",
        initial: { move: "@root" },
        persos: [
          {
            id: GRID_CONTAINER_ID,
            type: "layout",
            initial: {
              move: "@root",
              markup: `<div class="grid-capsule"></div>`,
              style: {
                // Structure grid fournie par capsule-automation — source de
                // vérité unique pour le conteneur ET pour le gabarit du cs.
                ...grid.inlineStyle,
                width: "520px",
                height: "360px",
                margin: "60px 0 0 120px",
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                rotate: "20deg",
              },
            },
            actions: {},
          },
          {
            id: GRID_ITEM_ID,
            type: "layout",
            initial: {
              move: { parentId: GRID_CONTAINER_ID },
              markup: `<div class="grid-item"><h2>Item</h2></div>`,
              style: {
                gridRow: "1 / span 1",
                gridColumn: "1 / span 1",
                background: "#f3c96b",
                border: "2px solid #a97d1f",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              },
            },
            actions: {},
          },
        ],
        straps: undefined,
        listen: [],
      },
    },
    tracks: {},
  };
}
