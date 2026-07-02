import type { SceneDoc } from "codplay/player/types";

/**
 * Validation scene for the SelectionFrame: one rotated layout element
 * so the cs must anchor, size and orient itself on a transformed target.
 * See docs/plans/2026-06-09-selection-frame-plan.md (étape 4).
 */
export function createSelectionFrameScene(): SceneDoc {
  return {
    id: "selection-frame-scene",
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      "selection-frame-story": {
        id: "selection-frame-story",
        initial: { move: "@root" },
        persos: [
          {
            id: "edited-item",
            type: "layout",
            initial: {
              move: "@root",
              // markup est une propriété d'initial, pas de style — placé dans
              // style il serait ignoré (traité comme propriété CSS inconnue).
              markup: `<div class="wrapper">
             <h1>Toot</h1>
            </div>
          `,
              style: {
                width: "220px",
                height: "140px",
                transform: "rotate(20deg)",
                background: "#f3c96b",
                border: "2px solid #a97d1f",
                borderRadius: "8px",
                // Position explicite : un centrage margin:auto recentrerait
                // l'élément à chaque changement de largeur, ce qui fausse la
                // lecture des gestes du cs (le layout bouge sous l'éditeur).
                margin: "120px 0 0 180px",
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
