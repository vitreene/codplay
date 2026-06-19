import "../shared/demo-shell.css";

import type { ResourceManifest, SceneDef } from "codplay/builder/types";
import { CodPlay } from "codplay/creator";
import { createDemoRemote } from "@codplay/demo-remote";
import { createTraceLogPanel } from "../shared/trace-log-panel";
import { resolveSceneSeekMaxMs } from "../shared/resolve-scene-seek-max-ms";
import { buildDemoLinksMarkup } from "../shared/demo-registry";
import type { PlayerSceneDemoConfig } from "../shared/demo-scene-types";
import type { Player } from "codplay/player/player";
import type { TelcoApi } from "codplay/telco/types";

type CodPlaySceneDemoConfig = PlayerSceneDemoConfig & {
  onReady?: (context: { player: Player; telco: TelcoApi }) => void
  /** Async hook for demos that need async initialization (e.g. Three.js + TalkingHead).
   *  Runs once before CodPlay is constructed. Returns components and/or renderFrame
   *  to inject into the player. Overrides any same-key values from the top-level config. */
  setup?: () => Promise<Pick<PlayerSceneDemoConfig, 'components' | 'renderAdapters'>>
};

function syncInteractionLock(containerNode: HTMLDivElement, status: string): void {
  const locked = status !== "playing";
  containerNode.style.pointerEvents = locked ? "none" : "auto";
  if (locked) {
    containerNode.setAttribute("inert", "");
    return;
  }

  containerNode.removeAttribute("inert");
}

/**
 * Renders one shared CodPlay demo layout for one scene-based scenario.
 */
export async function runCodPlaySceneDemo(config: CodPlaySceneDemoConfig): Promise<void> {
  const appNode = globalThis.document.querySelector<HTMLDivElement>("#app");
  if (appNode === null) {
    throw new Error("Expected #app root element");
  }

  const seekMaxMsFromScene = resolveSceneSeekMaxMs(config.scene);
  const demoLinksMarkup = buildDemoLinksMarkup(config.activeDemo);

  appNode.innerHTML = `
    <main class="demo-shell">
      <aside>
        <p class="eyebrow">CodPlay V1</p>
        ${demoLinksMarkup.length > 0 ? `<nav class="demo-links">${demoLinksMarkup}</nav>` : ""}
        <h1>${config.title}</h1>
        <p class="subtitle">${config.subtitle}</p>
        <div id="demo-remote-slot"></div>
        <div id="player-trace" class="player-state player-trace"></div>
      </aside>
      <div class="container" id="demo-container"></div>
    </main>
  `;

  const containerNode = globalThis.document.querySelector<HTMLDivElement>("#demo-container");
  if (containerNode === null) {
    throw new Error("Expected #demo-container element");
  }
  const demoContainerNode = containerNode;
  demoContainerNode.style.position = "relative";

  const remoteSlotNode = globalThis.document.querySelector<HTMLDivElement>("#demo-remote-slot");
  if (remoteSlotNode === null) {
    throw new Error("Expected #demo-remote-slot element");
  }

  const playerTraceNode = globalThis.document.querySelector<HTMLDivElement>("#player-trace");
  if (playerTraceNode === null) {
    throw new Error("Expected #player-trace element");
  }

  const setupResult = config.setup ? await config.setup() : {}
  const studio = new CodPlay({
    renderAdapters: [...(config.renderAdapters ?? []), ...(setupResult.renderAdapters ?? [])],
    components: { ...config.components, ...setupResult.components },
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

  const traceLogPanel = createTraceLogPanel(playerTraceNode, { compact: config.compactTrace ?? false });
  const compileResult = studio.builder.compile({ scene: config.scene as unknown as SceneDef });
  if (!compileResult.ok) {
    throw new Error(`[demo] compile failed: ${compileResult.error.code}`);
  }
  const compiledScene = compileResult.data.compiledScene;
  const resourceManifest: ResourceManifest = config.extraResources?.length
    ? { entries: [...compileResult.data.resourceManifest.entries, ...config.extraResources] }
    : compileResult.data.resourceManifest;

  const remote = createDemoRemote({
    telco: studio.telco,
    seekMaxMsFromScene,
    actions: config.actions,
    emit: (config.actions?.length ?? 0) > 0
      ? async (event) => {
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

  async function resetDemoRuntime(): Promise<void> {
    const destroyResult = await studio.player.destroy();
    if (!destroyResult.ok) {
      throw new Error(`[demo] destroy failed: ${destroyResult.error.code}`);
    }

    const replayInitResult = await studio.player.init({
      mountTarget: demoContainerNode,
      compiledScene,
      resourceManifest,
      strapCollection: config.strapCollection,
    });
    if (!replayInitResult.ok) {
      throw new Error(`[demo] init failed: ${replayInitResult.error.code}`);
    }

    syncInteractionLock(demoContainerNode, studio.player.getState().status);
  }

  studio.telco.configure({ onRewind: resetDemoRuntime });

  studio.player.onChange((state) => {
    syncInteractionLock(demoContainerNode, state.status);
  });

  studio.player.onTrace((row) => {
    traceLogPanel.push(row);
  });

  config.onReady?.({ player: studio.player, telco: studio.telco });

  const initResult = await studio.player.init({
    mountTarget: demoContainerNode,
    compiledScene,
    resourceManifest,
    strapCollection: config.strapCollection,
  });
  if (!initResult.ok) {
    throw new Error(`[demo] init failed: ${initResult.error.code}`);
  }

  syncInteractionLock(demoContainerNode, studio.player.getState().status);
  remote.sync();
}
