import "./player-poc-demo.css";

import { animate } from "animejs";

import { createAnimationAdapter, type AnimeImplementation } from "../animation/adapter";
import { PlayerFacade } from "../player/create-player";
import type { SceneDoc } from "../player/types";
import type { RuntimeTraceRow } from "../runtime/trace-store";

type TracePayload = Record<string, unknown>;

/**
 * Session rule:
 * - temporary step tests are run in this demo file
 * - preserve appNode.innerHTML structure and CSS frame unless user explicitly asks otherwise
 */

/**
 * Builds an animejs wrapper compatible with runtime animation adapter.
 */
function temp__createAnimeImplementation(): AnimeImplementation {
  return (parameters) => {
    const targets = parameters.targets;
    const animationParameters = { ...parameters };
    delete animationParameters.targets;

    const animationTargets = targets as Parameters<typeof animate>[0];
    const typedAnimationParameters = animationParameters as Parameters<typeof animate>[1];
    return animate(animationTargets, typedAnimationParameters);
  };
}

/**
 * Creates one demo scene focused on list add/reorder/remove behavior.
 */
function temp__createDemoScene(): SceneDoc {
  return {
    id: "scene-demo",
    initialStoryId: "story-demo",
    stories: {
      "story-demo": {
        id: "story-demo",
        items: {
          "demo-list": {
            id: "demo-list",
            type: "list",
            initial: {
              id: "demo-list",
              className: "demo-card demo-list-main",
              style: {
                position: "absolute",
                left: "50%",
                top: "50%",
                x: "-50%",
                y: "-50%",
                width: "380px",
                minHeight: "320px",
                padding: "16px",
                backgroundColor: "#eef7f6",
                border: "2px dashed #0b7a75",
                borderRadius: "14px",
                boxShadow: "0 10px 24px rgba(16, 38, 67, 0.18)",
              },
            },
            actions: {},
          },
          "demo-trash-list": {
            id: "demo-trash-list",
            type: "list",
            initial: {
              id: "demo-trash-list",
              style: {
                display: "none",
              },
            },
            actions: {},
          },
          "demo-item-1": {
            id: "demo-item-1",
            type: "text",
            initial: {
              id: "demo-item-1",
              tag: "div",
              className: "demo-list-item",
              content: "ITEM 1",
              style: {
                padding: "0.7rem 0.85rem",
                marginBottom: "0.5rem",
                borderRadius: "0.6rem",
                color: "#ffffff",
                fontWeight: 700,
                letterSpacing: "0.04em",
                backgroundColor: "#f25f5c",
              },
            },
            actions: {
              "demo:item-1:add": {
                move: { parentId: "demo-list", mode: "append" },
              },
              "demo:item-1:remove-second": {
                move: { parentId: "demo-trash-list", mode: "append" },
              },
            },
          },
          "demo-item-2": {
            id: "demo-item-2",
            type: "text",
            initial: {
              id: "demo-item-2",
              tag: "div",
              className: "demo-list-item",
              content: "ITEM 2",
              style: {
                padding: "0.7rem 0.85rem",
                marginBottom: "0.5rem",
                borderRadius: "0.6rem",
                color: "#ffffff",
                fontWeight: 700,
                letterSpacing: "0.04em",
                backgroundColor: "#f7b267",
              },
            },
            actions: {
              "demo:item-2:add": {
                move: { parentId: "demo-list", mode: "append" },
              },
            },
          },
          "demo-item-3": {
            id: "demo-item-3",
            type: "text",
            initial: {
              id: "demo-item-3",
              tag: "div",
              className: "demo-list-item",
              content: "ITEM 3",
              style: {
                padding: "0.7rem 0.85rem",
                marginBottom: "0.5rem",
                borderRadius: "0.6rem",
                color: "#ffffff",
                fontWeight: 700,
                letterSpacing: "0.04em",
                backgroundColor: "#70c1b3",
              },
            },
            actions: {
              "demo:item-3:add": {
                move: { parentId: "demo-list", mode: "append" },
              },
              "demo:item-3:to-first": {
                move: { parentId: "demo-list", mode: "first" },
              },
            },
          },
          "demo-item-4": {
            id: "demo-item-4",
            type: "text",
            initial: {
              id: "demo-item-4",
              tag: "div",
              className: "demo-list-item",
              content: "ITEM 4",
              style: {
                padding: "0.7rem 0.85rem",
                marginBottom: "0.5rem",
                borderRadius: "0.6rem",
                color: "#ffffff",
                fontWeight: 700,
                letterSpacing: "0.04em",
                backgroundColor: "#247ba0",
              },
            },
            actions: {
              "demo:item-4:add": {
                move: { parentId: "demo-list", mode: "append" },
              },
            },
          },
          "demo-item-5": {
            id: "demo-item-5",
            type: "text",
            initial: {
              id: "demo-item-5",
              tag: "div",
              className: "demo-list-item",
              content: "ITEM 5",
              style: {
                padding: "0.7rem 0.85rem",
                marginBottom: "0.5rem",
                borderRadius: "0.6rem",
                color: "#ffffff",
                fontWeight: 700,
                letterSpacing: "0.04em",
                backgroundColor: "#b388eb",
              },
            },
            actions: {
              "demo:item-5:add": {
                move: { parentId: "demo-list", mode: "append" },
              },
            },
          },
        },
      },
    },
    tracks: {
      "track-demo": {
        id: "track-demo",
        source: "story",
        order: 0,
        events: [
          {
            ms: 0,
            name: "demo:item-1:add",
          },
          {
            ms: 1000,
            name: "demo:item-2:add",
          },
          {
            ms: 2000,
            name: "demo:item-3:add",
          },
          {
            ms: 3000,
            name: "demo:item-4:add",
          },
          {
            ms: 4000,
            name: "demo:item-5:add",
          },
          {
            ms: 5200,
            name: "demo:item-3:to-first",
          },
          {
            ms: 6200,
            name: "demo:item-1:remove-second",
          },
        ],
      },
    },
  };
}

/**
 * Creates a fixed runtime node map reused by nodeFactory.
 */
function temp__createDemoNodeMap(containerNode: HTMLDivElement): Map<string, HTMLElement> {
  const nodeByItemId = new Map<string, HTMLElement>();

  const itemIds = [
    "demo-list",
    "demo-trash-list",
    "demo-item-1",
    "demo-item-2",
    "demo-item-3",
    "demo-item-4",
    "demo-item-5",
  ];

  for (const itemId of itemIds) {
    const node = itemId.includes("list")
      ? globalThis.document.createElement("section")
      : globalThis.document.createElement("div");

    node.dataset.demoItemId = itemId;
    nodeByItemId.set(itemId, node);
    containerNode.append(node);
  }

  return nodeByItemId;
}

/**
 * Reads one payload value as string when available.
 */
function readString(payload: TracePayload, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Reads one payload value as number when available.
 */
function readNumber(payload: TracePayload, key: string): number | undefined {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Builds one compact payload summary for fallback trace messages.
 */
function formatCompactPayload(payload: TracePayload): string {
  const entries = Object.entries(payload);
  if (entries.length === 0) {
    return "";
  }

  const summary = entries
    .slice(0, 4)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  const suffix = entries.length > 4 ? " ..." : "";
  return ` ${summary}${suffix}`;
}

/**
 * Builds one human-readable trace message according to event type.
 */
function formatTraceMessage(row: RuntimeTraceRow): string {
  const payload = (row.payload ?? {}) as TracePayload;

  if (row.status === "rejected" || row.status === "error") {
    const code = readString(payload, "code");
    const message = readString(payload, "message");
    return `${row.eventName}${code ? ` code=${code}` : ""}${message ? ` message=${message}` : ""}`;
  }

  switch (row.eventName) {
    case "player:init:started": {
      const sceneId = readString(payload, "sceneId");
      return `init start scene=${sceneId ?? "?"}`;
    }

    case "player:init:done": {
      const activeStoryId = readString(payload, "activeStoryId");
      const runtimeElementCount = readNumber(payload, "runtimeElementCount");
      const runtimeRevision = readNumber(payload, "runtimeRevision");
      return `init done story=${activeStoryId ?? "?"} nodes=${runtimeElementCount ?? "?"} rev=${runtimeRevision ?? "?"}`;
    }

    case "player:play": {
      const startTimelineMs = readNumber(payload, "startTimelineMs");
      return `play start timeline=${startTimelineMs ?? "?"}ms`;
    }

    case "player:schedule:events": {
      const fromTimelineMs = readNumber(payload, "fromTimelineMs");
      const scheduledEventCount = readNumber(payload, "scheduledEventCount");
      const skippedPastEventCount = readNumber(payload, "skippedPastEventCount");
      return `schedule from=${fromTimelineMs ?? "?"}ms scheduled=${scheduledEventCount ?? "?"} skipped=${skippedPastEventCount ?? "?"}`;
    }

    case "player:event:triggered": {
      const eventName = readString(payload, "eventName");
      const eventId = readString(payload, "eventId");
      const eventMs = readNumber(payload, "eventMs");
      const runtimeTimelineMs = readNumber(payload, "runtimeTimelineMs");
      return `trigger ${eventName ?? "?"} id=${eventId ?? "?"} eventMs=${eventMs ?? "?"} now=${runtimeTimelineMs ?? "?"}ms`;
    }

    case "player:event:applied": {
      const eventName = readString(payload, "eventName");
      const appliedCommitCount = readNumber(payload, "appliedCommitCount");
      const appliedActionsCount = readNumber(payload, "appliedActionsCount");
      const animationAppliedCount = readNumber(payload, "animationAppliedCount");
      const conflictCount = readNumber(payload, "conflictCount");
      return `apply ${eventName ?? "?"} commits=${appliedCommitCount ?? "?"} actions=${appliedActionsCount ?? "?"} anim=${animationAppliedCount ?? "?"} conflicts=${conflictCount ?? "?"}`;
    }

    default:
      return `${row.eventName}${formatCompactPayload(payload)}`;
  }
}

/**
 * Formats one trace row into one compact readable line.
 */
function formatTraceRow(row: RuntimeTraceRow, firstTraceMs: number): string {
  const deltaMs = Math.max(0, Math.round(row.traceMs - firstTraceMs));
  const status = row.status.toUpperCase().padEnd(8, " ");
  const message = formatTraceMessage(row);
  return `+${String(deltaMs).padStart(4, " ")}ms ${status} ${message}`;
}

/**
 * Mounts the runtime player proof-of-concept demo in the root app node.
 */
export async function runPlayerPocDemo(): Promise<void> {
  const appNode = globalThis.document.querySelector<HTMLDivElement>("#app");
  if (appNode === null) {
    throw new Error("Expected #app root element");
  }

  appNode.innerHTML = `
    <main class="demo-shell">
    <aside>
      <p class="eyebrow">Runtime V1</p>
      <h1>Player POC</h1>
	      <p class="subtitle">List: 5 ajouts (1s), puis #3 passe #1, puis suppression de #2.</p>
      <div class="demo-controls">
        <button id="demo-play-button" class="demo-button" type="button">Play</button>
        <button id="demo-rewind-button" class="demo-button demo-button-secondary" type="button">Rewind</button>
      </div>
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

  containerNode.style.position = "relative";
  const demoNodeByItemId = temp__createDemoNodeMap(containerNode);

  const animationAdapter = createAnimationAdapter(temp__createAnimeImplementation());
  const player = new PlayerFacade({
    animationAdapter,
    createElementOptions: {
      nodeFactory: (item) => {
        return demoNodeByItemId.get(item.id);
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

  const playButton = globalThis.document.querySelector<HTMLButtonElement>("#demo-play-button");
  if (playButton === null) {
    throw new Error("Expected #demo-play-button element");
  }
  const playButtonNode = playButton;

  const rewindButton = globalThis.document.querySelector<HTMLButtonElement>("#demo-rewind-button");
  if (rewindButton === null) {
    throw new Error("Expected #demo-rewind-button element");
  }
  const rewindButtonNode = rewindButton;

  const traceLines: string[] = [];
  let firstTraceMs: number | null = null;
  let commandInFlight = false;

  function syncControlState(): void {
    const state = player.getState();
    const canPlay = state.status === "ready" || state.status === "paused";
    const canRewind =
      state.initialized &&
      (state.status === "ready" || state.status === "paused" || state.status === "playing");

    playButtonNode.disabled = commandInFlight || !canPlay;
    rewindButtonNode.disabled = commandInFlight || !canRewind;
  }

  async function runControlCommand(
    commandName: string,
    command: () => Promise<{ ok: boolean; error?: { code: string } }>,
  ): Promise<void> {
    if (commandInFlight) {
      return;
    }

    commandInFlight = true;
    syncControlState();

    try {
      const result = await command();
      if (!result.ok) {
        throw new Error(`[demo] ${commandName} failed: ${result.error?.code ?? "UNKNOWN_ERROR"}`);
      }
    } finally {
      commandInFlight = false;
      syncControlState();
    }
  }

  playButtonNode.addEventListener("click", () => {
    void runControlCommand("play", () => player.play());
  });

  async function runRewindFlow(): Promise<void> {
    const stateBefore = player.getState();
    if (stateBefore.status === "playing") {
      await runControlCommand("pause", () => player.pause());
    }

    await runControlCommand("rewind", () => player.rewind());
  }

  rewindButtonNode.addEventListener("click", () => {
    void runRewindFlow();
  });

  player.onStateChange((state) => {
    playerStateNode.textContent = `status=${state.status} timelineMs=${Math.round(state.timelineMs)} revision=${state.runtimeRevision}`;
    syncControlState();
  });

  player.onTrace((row) => {
    if (firstTraceMs === null) {
      firstTraceMs = row.traceMs;
    }

    traceLines.push(formatTraceRow(row, firstTraceMs));
    if (traceLines.length > 14) {
      traceLines.shift();
    }

    playerTraceNode.textContent = traceLines.join("\n");
  });

  const initResult = await player.init(temp__createDemoScene());
  if (!initResult.ok) {
    throw new Error(`[demo] init failed: ${initResult.error.code}`);
  }

  syncControlState();
}
