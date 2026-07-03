import { AutoCapsule } from "@codplay/capsule-automation";
import {
  createAuthorApi,
  createGridPlacementAdapter,
  createLibreAdapter,
  createSelectionFrame,
  measureGridTracks,
  uniformTrackGeometry
} from "@codplay/selection-frame";
import type { CapabilityPreset } from "@codplay/selection-frame";
import {
  createSelectionFrameGridScene,
  GRID_CONTAINER_ID,
  GRID_ITEM_ID
} from "../scenes/selection-frame-grid-scene";
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo";

const GRID_ROWS = 4;
const GRID_COLS = 4;
const GRID_GAP_PX = 12;

// Politiques configurées par preset, pas de cas particulier codé.
const GRID_PRESET: CapabilityPreset = {
  name: "grid-positioning",
  capabilities: ["move", "resize", "positioning"],
  handles: { corners: { ratio: "free" } }
};

// Mode libre : rotation, pivot, scale (pas de resize ici — c'est un scale) ;
// le gabarit disparaît (capacité positioning absente).
const LIBRE_PRESET: CapabilityPreset = {
  name: "libre-transform",
  capabilities: ["move", "rotate", "rotation-origin", "scale"]
};

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
      "Grid : drop en cellule, poignées = emprise. Libre : rotation, pivot, scale. La bascule conserve les transforms.",
    scene: createSelectionFrameGridScene(result.grid),
    activeDemo: "selection-frame-grid",
    mode: "author",
    onControlsReady: ({ player, container }) => {
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

      const gridAdapter = createGridPlacementAdapter({
        grid: result.grid,
        // Géométrie de pistes mesurée sur le conteneur réel (templates
        // résolus en px par le navigateur) — cellules irrégulières comprises.
        getTrackGeometry: () => {
          const measured = containerNode !== null ? measureGridTracks(containerNode) : null;
          if (measured !== null) return measured;
          const computed = containerNode !== null ? globalThis.getComputedStyle(containerNode) : null;
          return uniformTrackGeometry({
            rows: GRID_ROWS,
            cols: GRID_COLS,
            localWidth: (computed ? Number.parseFloat(computed.width) : 0) || 1,
            localHeight: (computed ? Number.parseFloat(computed.height) : 0) || 1,
            columnGap: GRID_GAP_PX,
            rowGap: GRID_GAP_PX
          });
        },
        initialPlacement: { row: 1, col: 1, rowSpan: 2, colSpan: 2 },
        onPlacement: (placement) => {
          if (itemNode === null) return;
          itemNode.style.gridRow = `${placement.row} / span ${placement.rowSpan ?? 1}`;
          itemNode.style.gridColumn = `${placement.col} / span ${placement.colSpan ?? 1}`;
        }
      });

      const libreAdapter = createLibreAdapter({ authorApi, itemId: GRID_ITEM_ID });

      const frame = createSelectionFrame({
        itemId: GRID_ITEM_ID,
        containerId: GRID_CONTAINER_ID,
        authorApi,
        sceneRoot,
        adapter: gridAdapter
      });
      frame.setContainerGrid(result.grid);

      // Recalage sur les événements d'environnement — responsabilité de
      // l'éditeur selon le plan (« Scroll, resize et changements
      // d'environnement ») : tout resize/scroll désynchronise les coordonnées
      // fixed du cs vis-à-vis du player → sync() intégral.
      globalThis.addEventListener("resize", () => frame.sync());
      globalThis.document.addEventListener("scroll", () => frame.sync(), { capture: true, passive: true });

      // ── Contrôles éditeur (externes à la scène) ──────────────────────────

      let editMode: "grid" | "libre" = "grid";

      const applyEditMode = (): void => {
        if (editMode === "grid") {
          frame.setAdapter(gridAdapter);
          frame.applyPreset(GRID_PRESET);
        } else {
          frame.setAdapter(libreAdapter);
          frame.applyPreset(LIBRE_PRESET);
        }
      };
      applyEditMode();

      const makeButton = (label: string, onClick: () => void): HTMLButtonElement => {
        const button = globalThis.document.createElement("button");
        button.textContent = label;
        button.style.display = "block";
        button.style.width = "100%";
        button.style.marginTop = "8px";
        button.style.padding = "6px 10px";
        button.addEventListener("click", onClick);
        container.appendChild(button);
        return button;
      };

      const toggleButton = makeButton("Mode : grid → passer en libre", () => {
        editMode = editMode === "grid" ? "libre" : "grid";
        toggleButton.textContent =
          editMode === "grid" ? "Mode : grid → passer en libre" : "Mode : libre → passer en grid";
        applyEditMode();
      });

      makeButton("Reset transforms", () => {
        if (itemNode === null) return;
        itemNode.style.translate = "";
        itemNode.style.rotate = "";
        itemNode.style.scale = "";
        itemNode.style.transformOrigin = "";
        frame.sync();
      });
    }
  });
}
