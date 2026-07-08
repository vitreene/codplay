import { AutoCapsule } from "@codplay/capsule-automation";
import {
  createAuthorApi,
  createGridPlacementAdapter,
  createLibreAdapter,
  createSelectionFrame,
  measureGridTracks,
  uniformTrackGeometry
} from "@codplay/selection-frame";
import type {
  AuthorApi,
  CapabilityPreset,
  CreationResult,
  GridPlacementAdapter,
  LibreAdapter,
  SelectionFrameHandle
} from "@codplay/selection-frame";
import {
  createSelectionFrameGridScene,
  GRID_CONTAINER_ID,
  GRID_ITEM_ID
} from "../scenes/selection-frame-grid-scene";
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo";

/**
 * Demo-only wrapper: resolves synthetic, non-persistent elements created by
 * the trace-to-create flow below, on top of the real authorApi. No perso is
 * ever added to the scene — this purely lets a created item's attachItem
 * resolve a DOM node the same way a real persoId would (see
 * docs/plans/2026-07-03-selection-frame-variantes-plan.md, "mode création").
 */
function createDemoAuthorApi(base: AuthorApi): AuthorApi & {
  registerSyntheticNode: (id: string, node: Element) => void;
} {
  const synthetic = new Map<string, Element>();
  const subscribers = new Map<string, Set<(node: Element | null) => void>>();
  return {
    ...base,
    subscribeToNode: (persoId, cb) => {
      if (synthetic.has(persoId)) {
        let set = subscribers.get(persoId);
        if (set === undefined) {
          set = new Set();
          subscribers.set(persoId, set);
        }
        set.add(cb);
        cb(synthetic.get(persoId) ?? null);
        return () => set!.delete(cb);
      }
      return base.subscribeToNode(persoId, cb);
    },
    registerSyntheticNode(id: string, node: Element): void {
      synthetic.set(id, node);
      for (const cb of subscribers.get(id) ?? []) cb(node);
    }
  };
}

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
      grid: { rows: GRID_ROWS, cols: GRID_COLS, gap: `${GRID_GAP_PX}px` }
    },
    children: [{ id: GRID_ITEM_ID, order: 0, timeRange: { startMs: 0, endMs: 1000 } }]
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
      // Demo-only: lets a traced-and-created item (below) be edited through
      // the exact same subscribeToNode path as a real perso, without ever
      // persisting anything into the scene.
      const demoAuthorApi = createDemoAuthorApi(authorApi);

      let containerNode: HTMLElement | null = null;
      let itemNode: HTMLElement | null = null;
      demoAuthorApi.subscribeToNode(GRID_CONTAINER_ID, (node) => {
        containerNode = node instanceof HTMLElement ? node : null;
      });
      demoAuthorApi.subscribeToNode(GRID_ITEM_ID, (node) => {
        itemNode = node instanceof HTMLElement ? node : null;
      });

      // Géométrie de pistes mesurée sur le conteneur réel (templates résolus
      // en px par le navigateur) — cellules irrégulières comprises. Partagée
      // par l'item d'origine et par tout item tracé à la volée.
      const getTrackGeometry = () => {
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
      };

      const gridAdapter = createGridPlacementAdapter({
        grid: result.grid,
        getTrackGeometry,
        initialPlacement: { row: 1, col: 1, rowSpan: 2, colSpan: 2 },
        onPlacement: (placement) => {
          if (itemNode === null) return;
          itemNode.style.gridRow = `${placement.row} / span ${placement.rowSpan ?? 1}`;
          itemNode.style.gridColumn = `${placement.col} / span ${placement.colSpan ?? 1}`;
        }
      });

      const libreAdapter = createLibreAdapter({ authorApi: demoAuthorApi, itemId: GRID_ITEM_ID });

      const frame = createSelectionFrame({
        itemId: GRID_ITEM_ID,
        containerId: GRID_CONTAINER_ID,
        authorApi: demoAuthorApi,
        sceneRoot,
        adapter: gridAdapter
      });
      frame.setContainerGrid(result.grid);

      // ── Édition de la cible courante (item d'origine, ou item tracé) ─────
      // Le toggle grid/libre et le reset ci-dessous agissent sur activeTarget,
      // qui bascule vers le dernier item créé par tracé (voir plus bas).

      type EditableTarget = {
        frame: SelectionFrameHandle;
        node: HTMLElement;
        gridAdapter: GridPlacementAdapter;
        libreAdapter: LibreAdapter;
      };
      let activeTarget: EditableTarget = { frame, node: itemNode ?? globalThis.document.createElement("div"), gridAdapter, libreAdapter };
      demoAuthorApi.subscribeToNode(GRID_ITEM_ID, (node) => {
        if (node instanceof HTMLElement && activeTarget.frame === frame) activeTarget.node = node;
      });

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
          activeTarget.frame.setAdapter(activeTarget.gridAdapter);
          activeTarget.frame.applyPreset(GRID_PRESET);
        } else {
          activeTarget.frame.setAdapter(activeTarget.libreAdapter);
          activeTarget.frame.applyPreset(LIBRE_PRESET);
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
        activeTarget.node.style.translate = "";
        activeTarget.node.style.rotate = "";
        activeTarget.node.style.scale = "";
        activeTarget.node.style.transformOrigin = "";
        activeTarget.frame.sync();
      });

      // ── Créer un item par tracé (mode création, pas de persistance) ──────
      // Trace un rectangle sur la grille : le résultat crée un élément DOM
      // ordinaire (jamais un perso, jamais persisté dans la SceneDoc), qui
      // devient ensuite la cible active des contrôles ci-dessus (toggle,
      // reset) via attachItem — même cs, continuité visuelle du tracé à
      // l'édition. Voir docs/plans/2026-07-03-selection-frame-variantes-plan.md.

      let createdCount = 0;

      // Contexte du TRACÉ (pas du preset d'édition) — décidé par l'éditeur,
      // jamais déduit : 'grille' aimante aux cellules ; 'libre' trace un
      // rectangle pixel même à l'intérieur du conteneur grid.
      let creationContext: "grid" | "libre" = "grid";

      const startCreation = (): void => {
        // Désélection de l'item courant : un seul cs actif à la fois, le
        // tracé démarre sur une ardoise vide.
        activeTarget.frame.setPartActive("cs", false);
        activeTarget.frame.setPartVisibility("cs", false);

        const creationFrame = createSelectionFrame({
          authorApi: demoAuthorApi,
          sceneRoot,
          containerId: GRID_CONTAINER_ID,
          creation: {
            context: creationContext,
            onCreate: (trace: CreationResult) => {
              if (containerNode === null) return;
              createdCount += 1;
              const newId = `demo-created-${createdCount}`;

              const el = globalThis.document.createElement("div");
              el.textContent = `Item créé #${createdCount}`;
              el.style.background = "#8fd0a0";
              el.style.border = "2px solid #3f8a54";
              el.style.borderRadius = "6px";
              el.style.display = "flex";
              el.style.alignItems = "center";
              el.style.justifyContent = "center";
              if (trace.kind === "cell-area") {
                el.style.gridRow = `${trace.area.row} / span ${trace.area.rowSpan}`;
                el.style.gridColumn = `${trace.area.col} / span ${trace.area.colSpan}`;
              } else {
                // Libre à l'intérieur du conteneur grid : ancré sur la toute
                // première cellule (foyer) pour sa référence de placement,
                // mais en position:absolute — un enfant grid absolument
                // positionné se réfère toujours à la zone grid-row/column
                // pour son cadre englobant, SANS jamais participer au calcul
                // des pistes (auto/fr) : le layout du conteneur reste stable
                // quelle que soit la taille de l'item tracé. Le rect tracé
                // est en px locaux au conteneur ; l'ancre de la cellule (1,1)
                // est l'origine locale (0,0), le translate vaut donc le rect
                // tel quel.
                el.style.position = "absolute";
                el.style.gridRow = "1 / span 1";
                el.style.gridColumn = "1 / span 1";
                el.style.width = `${trace.rect.width}px`;
                el.style.height = `${trace.rect.height}px`;
                el.style.translate = `${trace.rect.x}px ${trace.rect.y}px`;
              }
              containerNode.appendChild(el);
              demoAuthorApi.registerSyntheticNode(newId, el);

              const newGridAdapter = createGridPlacementAdapter({
                grid: result.grid,
                getTrackGeometry,
                initialPlacement:
                  trace.kind === "cell-area"
                    ? trace.area
                    : { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                onPlacement: (placement) => {
                  el.style.gridRow = `${placement.row} / span ${placement.rowSpan ?? 1}`;
                  el.style.gridColumn = `${placement.col} / span ${placement.colSpan ?? 1}`;
                }
              });
              const newLibreAdapter = createLibreAdapter({ authorApi: demoAuthorApi, itemId: newId });

              creationFrame.attachItem({
                itemId: newId,
                adapter: trace.kind === "cell-area" ? newGridAdapter : newLibreAdapter
              });
              creationFrame.setContainerGrid(result.grid);

              activeTarget = {
                frame: creationFrame,
                node: el,
                gridAdapter: newGridAdapter,
                libreAdapter: newLibreAdapter
              };
              editMode = trace.kind === "cell-area" ? "grid" : "libre";
              toggleButton.textContent =
                editMode === "grid" ? "Mode : grid → passer en libre" : "Mode : libre → passer en grid";
              applyEditMode();
            }
          }
        });
        creationFrame.setContainerGrid(result.grid);
      };

      const creationContextButton = makeButton("Tracé : grille → passer en libre", () => {
        creationContext = creationContext === "grid" ? "libre" : "grid";
        creationContextButton.textContent =
          creationContext === "grid" ? "Tracé : grille → passer en libre" : "Tracé : libre → passer en grille";
      });

      makeButton("Créer un item (tracé)", startCreation);
    }
  });
}
