import type { AutoCapsuleGridArtifact } from "@codplay/capsule-automation";
import type { SceneDoc } from "codplay/player/types";

export const ZONE_EDITOR_CONTAINER_ID = "zone-editor-capsule";

/**
 * Validation scene for the zone editor: one grid capsule whose structure comes
 * from capsule-automation (`AutoCapsuleGridArtifact.inlineStyle`), exactly like
 * `selection-frame-grid-scene.ts` — the zone editor divides this SAME capsule
 * into zones (plan §Éditeur de zones: "un bloc (capsule) est divisé en zones").
 * No child item here — zones are placement TARGETS an author would drop future
 * items onto, not persos of their own.
 */
export function createZoneEditorScene(grid: AutoCapsuleGridArtifact): SceneDoc {
  return {
    id: "zone-editor-scene",
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      "zone-editor-story": {
        id: "zone-editor-story",
        initial: { move: "@root" },
        persos: [
          {
            id: ZONE_EDITOR_CONTAINER_ID,
            type: "layout",
            initial: {
              move: "@root",
              markup: `<div class="zone-editor-capsule"></div>`,
              style: {
                ...grid.inlineStyle,
                width: "520px",
                height: "360px",
                margin: "60px 0 0 120px",
                background: "#e8eef7",
                border: "2px dashed #7c93b5",
                borderRadius: "8px",
                boxShadow: "inset 0 0 0 1px rgba(124, 147, 181, 0.25)",
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
