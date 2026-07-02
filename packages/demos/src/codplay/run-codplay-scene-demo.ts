import "../shared/demo-shell.css";

import { CodPlay } from "codplay/creator";
import { createDemoRemote } from "@codplay/remote";
import { createTraceLogPanel } from "../shared/trace-log-panel";
import { resolveSceneSeekMaxMs } from "../shared/resolve-scene-seek-max-ms";
import { buildDemoLinksMarkup } from "../shared/demo-registry";
import type { PlayerSceneDemoConfig } from "../shared/demo-scene-types";
import type { Player } from "codplay/player/player";
import type { TelcoApi } from "codplay/telco/types";

type CodPlaySceneDemoConfig = PlayerSceneDemoConfig & {
  /** Mode d'initialisation du player ('author' pour les démos d'édition). */
  mode?: "author" | "broadcast";
  /** Appelé une fois après studio.load(), donc après init. Permet d'attacher des écouteurs
   *  (onTrace, onChange…) avant le premier appel à play(). */
  onReady?: (context: { player: Player; telco: TelcoApi }) => void;
  /** Hook async pour les démos nécessitant une initialisation préalable (ex. Three.js, TalkingHead).
   *  Exécuté une seule fois avant la construction de CodPlay. Les clés retournées écrasent
   *  les valeurs éventuellement présentes dans la config principale. */
  setup?: () => Promise<Pick<PlayerSceneDemoConfig, "components" | "renderAdapters">>;
};

/**
 * Monte le gabarit HTML d'une démo CodPlay et initialise la scène.
 */
export async function runCodPlaySceneDemo(config: CodPlaySceneDemoConfig): Promise<void> {
  // --- Page ---
  // Injection du markup et résolution des nœuds DOM cibles.

  const appNode = globalThis.document.querySelector<HTMLDivElement>("#app");
  if (appNode === null) {
    throw new Error("Expected #app root element");
  }

  const demoLinksMarkup = buildDemoLinksMarkup(config.activeDemo);
  appNode.innerHTML = `
    <main class="demo-shell">
      <aside>
        <p class="eyebrow">CodPlay V1</p>
        ${demoLinksMarkup.length > 0 ? `<nav class="demo-links">${demoLinksMarkup}</nav>` : ""}
        <h1>${config.title}</h1>
        <p class="subtitle">${config.subtitle}</p>
        <div id="demo-remote-slot"></div>
        <div id="player-trace-count" class="player-trace-count"></div>
        <div id="player-trace" class="player-state player-trace"></div>
      </aside>
      <div class="container" id="demo-container"></div>
    </main>
  `;

  const demoContainerNode = globalThis.document.querySelector<HTMLDivElement>("#demo-container");
  if (demoContainerNode === null) throw new Error("Expected #demo-container element");
  demoContainerNode.style.position = "relative";

  const remoteSlotNode = globalThis.document.querySelector<HTMLDivElement>("#demo-remote-slot");
  if (remoteSlotNode === null) throw new Error("Expected #demo-remote-slot element");

  const playerTraceNode = globalThis.document.querySelector<HTMLDivElement>("#player-trace");
  if (playerTraceNode === null) throw new Error("Expected #player-trace element");

  const playerTraceCountNode = globalThis.document.querySelector<HTMLDivElement>("#player-trace-count");
  if (playerTraceCountNode === null) throw new Error("Expected #player-trace-count element");

  // fin page

  const setupResult = config.setup ? await config.setup() : {};

  // --- Studio ---
  // Instanciation de CodPlay : regroupe le player, le builder et le telco.
  // Le hook setup() permet aux démos complexes (ex. Three.js, TalkingHead) d'injecter
  // des composants ou des adaptateurs de rendu avant la construction.

  const studio = new CodPlay({
    renderAdapters: [...(config.renderAdapters ?? []), ...(setupResult.renderAdapters ?? [])],
    components: { ...config.components, ...setupResult.components },
    bindings: config.bindings,
    createElementOptions: {
      emitRuntimeEvent: (event) => {
        void studio.player.emit({
          name: event.name,
          data: event.data,
          scopeStoryId: event.scopeStoryId,
          source: event.source,
          ms: event.ms,
          cascade: event.cascade,
        });
      },
    },
  });

  // --- Contrôles ---
  // Panneau de trace et télécommande (transport, seek, actions scène).

  const traceLogPanel = createTraceLogPanel(playerTraceNode, { compact: config.compactTrace ?? false });
  let traceEventCount = 0;
  let traceCountFlushScheduled = false;
  studio.player.onTrace((row) => {
    // Les erreurs runtime (ex. AUTHOR_LAYOUT_MARKUP_INVALID) n'apparaissent que
    // dans le panneau de trace — miroir console pour qu'elles alertent aussi
    // pendant le développement d'une démo.
    if (row.status === "error") {
      console.warn(`[codplay] ${row.eventName}`, row.payload ?? "");
    }
    traceEventCount += 1;
    // Same reasoning as trace-log-panel.ts's own flush: a seek replay burst can fire
    // hundreds of traces synchronously — coalesce into one DOM write per frame instead
    // of one per trace, so this debug counter never competes with the scene's own work.
    if (!traceCountFlushScheduled) {
      traceCountFlushScheduled = true;
      globalThis.requestAnimationFrame(() => {
        traceCountFlushScheduled = false;
        playerTraceCountNode.textContent = `${traceEventCount} events`;
      });
    }
    traceLogPanel.push(row);
  });

  const remote = createDemoRemote({
    telco: studio.telco,
    seekMaxMsFromScene: resolveSceneSeekMaxMs(config.scene),
    actions: config.actions,
    emit:
      (config.actions?.length ?? 0) > 0 ?
        async (event) => {
          await studio.player.emit({
            name: event.name,
            payload: event.payload,
            cascade: event.cascade,
            scopeStoryId: event.scopeStoryId,
          });
        }
      : undefined,
  });
  remoteSlotNode.appendChild(remote.element);

  // --- Scène ---
  // studio.load() est l'étape indispensable : elle compile le SceneDoc en CompiledScene
  // et initialise le runtime en montant les nœuds dans le conteneur.
  // Un échec est toujours une erreur de configuration : on lève immédiatement.

  // enableInteractionLock bloque les interactions utilisateur quand le player n'est pas en lecture ;
  // activé systématiquement en démo pour éviter toute interaction parasite pendant stop/seek.

  const loadResult = await studio.load({
    scene: config.scene,
    mountTarget: demoContainerNode,
    strapCollection: config.strapCollection,
    extraResources: config.extraResources,
    enableInteractionLock: true,
    mode: config.mode,
  });
  if (!loadResult.ok) {
    throw new Error(`[demo] load failed: ${loadResult.error.code}`);
  }

  config.onReady?.({ player: studio.player, telco: studio.telco });
  config.onControlsReady?.({ player: studio.player, telco: studio.telco, container: remoteSlotNode, sceneContainer: demoContainerNode });
  // Synchronise l'état initial de la télécommande avec celui du player après init.
  remote.sync();
}
