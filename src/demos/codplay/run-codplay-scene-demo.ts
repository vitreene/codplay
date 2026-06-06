import "../shared/demo-shell.css";

import { animate, engine } from "animejs";

import type { SceneDef } from "../../builder/types";
import { createAnimationAdapter, type AnimeImplementation } from "../../animation/adapter";
import { CodPlay } from "../../creator";
import { createSequenceCommandPanel } from "./codplay-scene-demo/sequence-command-panel";
import { createTraceLogPanel } from "../shared/trace-log-panel";
import { resolveSceneSeekMaxMs } from "../shared/resolve-scene-seek-max-ms";
import { buildDemoLinksMarkup } from "../shared/demo-registry";
import type { PlayerSceneDemoConfig } from "../shared/demo-scene-types";

function createAnimeImplementation(): AnimeImplementation {
  engine.useDefaultMainLoop = false;

  return (parameters) => {
    const targets = parameters.targets;
    const animationParameters = { ...parameters };
    delete animationParameters.targets;

    const animationTargets = targets as Parameters<typeof animate>[0];
    const typedAnimationParameters = animationParameters as Parameters<typeof animate>[1];
    return animate(animationTargets, typedAnimationParameters);
  };
}

function renderAnimeFrameFromPlayerTicker(): void {
  engine.update();
}

function isDomNode(nodeRef: unknown): nodeRef is Node {
  return typeof globalThis.Node !== "undefined" && nodeRef instanceof globalThis.Node;
}

function mountDemoRootNodes(containerNode: HTMLDivElement, studio: CodPlay, rootNodeIds: string[]): void {
  const registry = studio.player.getRuntimeRegistry();
  const rootNodes: Node[] = [];

  for (const rootNodeId of rootNodeIds) {
    const nodeRef = registry.getNodeById(rootNodeId);
    if (!isDomNode(nodeRef)) {
      continue;
    }

    rootNodes.push(nodeRef);
  }

  containerNode.replaceChildren(...rootNodes);
}

function syncInteractionLock(containerNode: HTMLDivElement, status: string): void {
  const locked = status === "paused" || status === "seeking";
  containerNode.style.pointerEvents = locked ? "none" : "auto";
  if (locked) {
    containerNode.setAttribute("inert", "");
    return;
  }

  containerNode.removeAttribute("inert");
}

/**
 * Renders one shared CodPlay demo shell for one scene-based scenario.
 */
export async function runCodPlaySceneDemo(config: PlayerSceneDemoConfig): Promise<void> {
  const appNode = globalThis.document.querySelector<HTMLDivElement>("#app");
  if (appNode === null) {
    throw new Error("Expected #app root element");
  }

  const seekMaxMsFromScene = resolveSceneSeekMaxMs(config.scene);
  const demoLinksMarkup = buildDemoLinksMarkup(config.activeDemo);
  const actionButtonsMarkup = (config.actions ?? [])
    .map(
      (action) =>
        `<button id="${action.id}" class="demo-button ${action.className ?? "demo-button-secondary"}" type="button">${action.label}</button>`,
    )
    .join("");

  appNode.innerHTML = `
    <main class="demo-shell">
      <aside>
        <p class="eyebrow">CodPlay V1</p>
        ${demoLinksMarkup.length > 0 ? `<nav class="demo-links">${demoLinksMarkup}</nav>` : ""}
        <h1>${config.title}</h1>
        <p class="subtitle">${config.subtitle}</p>
        <div class="demo-controls">
          <button id="demo-play-button" class="demo-button" type="button">Play</button>
          <button id="demo-rewind-button" class="demo-button demo-button-secondary" type="button">Rewind</button>
          <label class="demo-progress-control" for="demo-seek-range">
            <span>Seek</span>
            <input id="demo-seek-range" class="demo-progress-range" type="range" min="0" max="${seekMaxMsFromScene}" step="10" value="0" />
            <span id="demo-seek-label" class="demo-progress-label">0ms / ${Math.max(0, Math.round(seekMaxMsFromScene))}ms</span>
          </label>
        </div>
        ${actionButtonsMarkup.length > 0 ? `<div class="demo-controls demo-actions">${actionButtonsMarkup}</div>` : ""}
        <div id="player-state" class="player-state"></div>
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

  const animationAdapter = createAnimationAdapter(createAnimeImplementation(), {
    renderFrame: () => {
      renderAnimeFrameFromPlayerTicker();
    },
  });
  const studio = new CodPlay({
    animationAdapter,
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

  const playerStateNode = globalThis.document.querySelector<HTMLDivElement>("#player-state");
  if (playerStateNode === null) {
    throw new Error("Expected #player-state element");
  }
  const playerTraceNode = globalThis.document.querySelector<HTMLDivElement>("#player-trace");
  if (playerTraceNode === null) {
    throw new Error("Expected #player-trace element");
  }
  const playButtonNode = globalThis.document.querySelector<HTMLButtonElement>("#demo-play-button");
  if (playButtonNode === null) {
    throw new Error("Expected #demo-play-button element");
  }
  const rewindButtonNode = globalThis.document.querySelector<HTMLButtonElement>("#demo-rewind-button");
  if (rewindButtonNode === null) {
    throw new Error("Expected #demo-rewind-button element");
  }
  const seekRangeNode = globalThis.document.querySelector<HTMLInputElement>("#demo-seek-range");
  if (seekRangeNode === null) {
    throw new Error("Expected #demo-seek-range element");
  }
  const seekLabelNode = globalThis.document.querySelector<HTMLSpanElement>("#demo-seek-label");
  if (seekLabelNode === null) {
    throw new Error("Expected #demo-seek-label element");
  }

  const actionButtonNodes = new Map<string, HTMLButtonElement>();
  for (const action of config.actions ?? []) {
    const actionButtonNode = globalThis.document.querySelector<HTMLButtonElement>(`#${action.id}`);
    if (actionButtonNode === null) {
      throw new Error(`Expected #${action.id} element`);
    }
    actionButtonNodes.set(action.id, actionButtonNode);
  }

  const traceLogPanel = createTraceLogPanel(playerTraceNode);
  const compileResult = studio.builder.compile({ scene: config.scene as unknown as SceneDef });
  if (!compileResult.ok) {
    throw new Error(`[demo] compile failed: ${compileResult.error.code}`);
  }
  const compiledScene = compileResult.data.compiledScene;
  const resourceManifest = compileResult.data.resourceManifest;

  async function resetDemoRuntime(): Promise<void> {
    mountedRuntimeRevision = -1;
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

    mountDemoRootNodes(demoContainerNode, studio, config.rootNodeIds);
    const nextState = studio.player.getState();
    mountedRuntimeRevision = nextState.runtimeRevision;
    syncInteractionLock(demoContainerNode, nextState.status);
    commandPanel.syncFromState(nextState);
  }

  const commandPanel = createSequenceCommandPanel({
    player: studio.player,
    seekMaxMsFromScene,
    playButtonNode,
    rewindButtonNode,
    seekRangeNode,
    seekLabelNode,
    playerStateNode,
    rewindAction: resetDemoRuntime,
    actions: config.actions,
    actionButtonNodes,
  });

  let mountedRuntimeRevision = -1;

  studio.player.onChange((state) => {
    if (state.runtimeRevision !== mountedRuntimeRevision) {
      mountDemoRootNodes(containerNode, studio, config.rootNodeIds);
      mountedRuntimeRevision = state.runtimeRevision;
    }
    syncInteractionLock(demoContainerNode, state.status);
    commandPanel.syncFromState(state);
  });

  studio.player.onTrace((row) => {
    traceLogPanel.push(row);
  });

  const initResult = await studio.player.init({
    mountTarget: demoContainerNode,
    compiledScene,
    resourceManifest,
    strapCollection: config.strapCollection,
  });
  if (!initResult.ok) {
    throw new Error(`[demo] init failed: ${initResult.error.code}`);
  }

  mountDemoRootNodes(demoContainerNode, studio, config.rootNodeIds);
  const initialState = studio.player.getState();
  mountedRuntimeRevision = initialState.runtimeRevision;
  syncInteractionLock(demoContainerNode, initialState.status);
  commandPanel.syncFromState(initialState);
}
