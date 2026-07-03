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
                // Structure grid fournie par capsule-automation, puis pistes
                // rendues irrégulières — le cs mesure les templates résolus
                // (computed styles), aucune hypothèse de cellules uniformes.
                ...grid.inlineStyle,
                gridTemplateColumns: "1fr 2fr 1fr 3fr",
                gridTemplateRows: "2fr 1fr 1fr 2fr",
                width: "520px",
                height: "360px",
                margin: "60px 0 0 120px",
                // Conteneur matérialisé dans la scène : il reste visible même
                // hors contexte grid (mode libre, gabarit masqué).
                background: "#e8eef7",
                border: "2px dashed #7c93b5",
                borderRadius: "8px",
                boxShadow: "inset 0 0 0 1px rgba(124, 147, 181, 0.25)",
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
                // Emprise multi-cellules : le système 2×2 est conservé au drop
                // (cellule d'empoignement comme référence de placement).
                gridRow: "1 / span 2",
                gridColumn: "1 / span 2",
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
