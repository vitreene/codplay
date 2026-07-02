import { AutoCapsule } from "@codplay/capsule-automation";
import {
  createAuthorApi,
  createGridPlacementAdapter,
  createSelectionFrame
} from "@codplay/selection-frame";
import {
  createSelectionFrameGridScene,
  GRID_CONTAINER_ID,
  GRID_ITEM_ID
} from "../scenes/selection-frame-grid-scene";
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo";

const GRID_ROWS = 4;
const GRID_COLS = 4;
const GRID_GAP_PX = 12;

export async function runSelectionFrameGridDemo(): Promise<void> {
  // capsule-automation est la source de vérité de la structure grid : le même
  // artifact alimente le style du conteneur, le gabarit du cs et l'adaptateur.
  const capsule = new AutoCapsule({
    capsule: {
      id: "selection-frame-grid",
      type: "grille",
      timeRange: { startMs: 0, endMs: 1000 },
      grid: { mode: "manual", rows: GRID_ROWS, cols: GRID_COLS, gap: `${GRID_GAP_PX}px` }
    },
    children: [{ id: GRID_ITEM_ID, order: 0 }]
  });
  const result = capsule.resolve();

  await runCodPlaySceneDemo({
    title: "Selection Frame — grid",
    subtitle:
      "Positionnement grid : drag = drop dans une cellule (clone aimanté), poignées = spans. Structure fournie par capsule-automation.",
    scene: createSelectionFrameGridScene(result.grid),
    activeDemo: "selection-frame-grid",
    mode: "author",
    onReady: ({ player }) => {
      const sceneRoot = globalThis.document.querySelector("#demo-container");
      if (sceneRoot === null) return;

      const authorApi = createAuthorApi(player);

      let containerNode: HTMLElement | null = null;
      let itemNode: HTMLElement | null = null;
      authorApi.subscribeToNode(GRID_CONTAINER_ID, (node) => {
        containerNode = node instanceof HTMLElement ? node : null;
      });
      authorApi.subscribeToNode(GRID_ITEM_ID, (node) => {
        itemNode = node instanceof HTMLElement ? node : null;
      });

      const adapter = createGridPlacementAdapter({
        grid: result.grid,
        // Dimensions locales par computed styles — jamais getBoundingClientRect.
        getContainerSize: () => {
          if (containerNode === null) return { width: 1, height: 1 };
          const computed = globalThis.getComputedStyle(containerNode);
          return {
            width: Number.parseFloat(computed.width) || 1,
            height: Number.parseFloat(computed.height) || 1
          };
        },
        gaps: { column: GRID_GAP_PX, row: GRID_GAP_PX },
        initialPlacement: { row: 1, col: 1 },
        onPlacement: (placement) => {
          if (itemNode === null) return;
          itemNode.style.gridRow = `${placement.row} / span ${placement.rowSpan ?? 1}`;
          itemNode.style.gridColumn = `${placement.col} / span ${placement.colSpan ?? 1}`;
        }
      });

      const frame = createSelectionFrame({
        itemId: GRID_ITEM_ID,
        containerId: GRID_CONTAINER_ID,
        authorApi,
        sceneRoot,
        adapter
      });

      frame.applyPreset({
        name: "grid-positioning",
        capabilities: ["move", "resize", "positioning"]
      });
      frame.setContainerGrid(result.grid);
    }
  });
}
