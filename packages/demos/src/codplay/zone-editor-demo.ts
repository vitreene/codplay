import { AutoCapsule } from "@codplay/capsule-automation";
import { createAuthorApi, createZoneEditor } from "@codplay/selection-frame";
import type { ZoneDef, ZoneEditorHandle } from "@codplay/selection-frame";
import { createZoneEditorScene, ZONE_EDITOR_CONTAINER_ID } from "../scenes/zone-editor-scene";
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo";

// Fine enough to force the low-definition regime (§Affichage de la grille:
// "grille jusqu'à ~160×90"), well past createZoneEditor's own default threshold (40).
const GRID_ROWS = 90;
const GRID_COLS = 160;

export async function runZoneEditorDemo(): Promise<void> {
  // capsule-automation reste la source de vérité de la structure grid — même
  // artifact que selection-frame-grid-demo.ts, réutilisé ici pour le style du
  // conteneur édité (le zone editor ne connaît, lui, que rows/cols).
  const capsule = new AutoCapsule({
    capsule: { id: "zone-editor", type: "grille", grid: { rows: GRID_ROWS, cols: GRID_COLS } },
    children: [],
  });
  const result = capsule.resolve();

  await runCodPlaySceneDemo({
    title: "Éditeur de zones",
    subtitle:
      "Grille fine 160×90 (régime basse définition, survol pour matérialiser). Tracer une zone : drag sur le gabarit. Poignées : redimensionner. Drag du corps : déplacer. Boutons : card, split, merge.",
    scene: createZoneEditorScene(result.grid),
    activeDemo: "zone-editor",
    mode: "author",
    onControlsReady: ({ player, container }) => {
      const sceneRoot = globalThis.document.querySelector("#demo-container");
      if (sceneRoot === null) return;

      const authorApi = createAuthorApi(player);
      let selectedNames: string[] = [];

      const statusNode = globalThis.document.createElement("div");
      statusNode.style.marginTop = "12px";
      statusNode.style.fontSize = "13px";
      statusNode.style.color = "#4a5568";
      container.appendChild(statusNode);

      const renderStatus = (state: { zones: ZoneDef[] }): void => {
        const names = state.zones.map((z) => z.name).join(", ") || "(aucune)";
        statusNode.textContent = `Zones : ${names} — sélection : ${selectedNames.join(", ") || "(aucune)"}`;
      };

      const editor: ZoneEditorHandle = createZoneEditor({
        authorApi,
        sceneRoot,
        containerId: ZONE_EDITOR_CONTAINER_ID,
        initialState: { grid: { rows: GRID_ROWS, cols: GRID_COLS }, zones: [] },
        onZonesChange: (state) => renderStatus(state),
        onSelectionChange: (names) => {
          selectedNames = names;
          renderStatus(editor.getState());
        },
      });
      renderStatus(editor.getState());

      // Recalage sur les événements d'environnement — même responsabilité
      // éditeur que la démo grid du cs (resize/scroll désynchronisent les
      // coordonnées fixed de l'éditeur vis-à-vis du player).
      globalThis.addEventListener("resize", () => editor.sync());
      globalThis.document.addEventListener("scroll", () => editor.sync(), { capture: true, passive: true });

      // ── Contrôles éditeur (externes à la scène, outillage — cf selection-frame-grid-demo.ts) ─

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

      // Card "titre / corps / footer" (plan §Cards: un ensemble de zones
      // pré-construites posé d'un coup, via le canal setState — comme n'importe
      // quel autre remplacement d'état, rien de spécial côté module).
      makeButton("Poser la card titre/corps/footer", () => {
        editor.setState({
          grid: editor.getState().grid,
          zones: [
            { id: "card-titre", name: "titre", row: 1, col: 1, rowSpan: 12, colSpan: GRID_COLS },
            { id: "card-corps", name: "corps", row: 13, col: 1, rowSpan: 65, colSpan: GRID_COLS },
            { id: "card-footer", name: "footer", row: 78, col: 1, rowSpan: 13, colSpan: GRID_COLS },
          ],
        });
      });

      // Diviseur (design doc `2026-07-10-zone-container-design.md` §Cycle de vie: "diviser en 2"
      // est le signal fondateur — la MÊME zone gagne `container`, reste sélectionnable/déplaçable
      // comme toute autre zone).
      makeButton("Diviser la sélection en 2 (vertical)", () => {
        const [name] = selectedNames;
        if (name === undefined) return;
        editor.divideZone(name);
      });

      // Cassure (design doc §Ce que ce document NE couvre PAS → §L'opération de cassure elle-même
      // — geste ponctuel sur UNE zone-conteneur précise, jamais en bloc). La zone source disparaît,
      // remplacée par ses enfants devenus des ZoneDef indépendantes.
      makeButton("Détacher les zones enfants de la sélection", () => {
        const [name] = selectedNames;
        if (name === undefined) return;
        editor.breakContainer(name);
      });

      // Fusion (plan §Gestes d'édition: emprise englobante, prend le nom de
      // la première zone sélectionnée) — sur la sélection courante.
      makeButton("Fusionner la sélection", () => {
        if (selectedNames.length < 2) return;
        editor.mergeZones(selectedNames);
      });

      makeButton("Tout supprimer", () => {
        for (const zone of [...editor.getState().zones]) editor.removeZone(zone.name);
      });
    },
  });
}
