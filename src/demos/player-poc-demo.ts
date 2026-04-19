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
 * Creates one demo scene with text/image/list simple animations.
 */
function temp__createDemoScene(): SceneDoc {
  return {
    id: "scene-demo",
    initialStoryId: "story-demo",
    stories: {
      "story-demo": {
        id: "story-demo",
        items: {
          "demo-text": {
            id: "demo-text",
            type: "text",
            initial: {
              id: "demo-text",
              tag: "div",
              className: "demo-card demo-text",
              content: "TEXT",
              style: {
                position: "absolute",
                left: "10%",
                top: "14%",
                backgroundColor: "#1f2b3d",
                color: "#ffffff",
                width: "190px",
                height: "90px",
                display: "grid",
                placeItems: "center",
                borderRadius: "14px",
                boxShadow: "0 10px 24px rgba(16, 38, 67, 0.18)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              },
            },
            actions: {
              "demo:text:color": {
                style: {
                  backgroundColor: {
                    to: "#0b7a75",
                    easing: "easeInOutSine",
                  },
                },
              },
            },
          },
          "demo-image": {
            id: "demo-image",
            type: "img",
            initial: {
              id: "demo-image",
              className: "demo-card demo-image",
              src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 140'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23f2c94c'/><stop offset='100%' stop-color='%23eb5757'/></linearGradient></defs><rect width='240' height='140' fill='url(%23g)'/><circle cx='60' cy='55' r='26' fill='%23ffffff55'/><circle cx='170' cy='85' r='34' fill='%2300000022'/></svg>",
              alt: "Gradient test image",
              fitMode: "wallpaper",
              style: {
                position: "absolute",
                left: "52%",
                top: "16%",
                width: "240px",
                height: "140px",
                borderRadius: "14px",
                overflow: "hidden",
                border: "2px solid #ffffff",
                boxShadow: "0 10px 24px rgba(16, 38, 67, 0.22)",
                rotate: 0,
                transformOrigin: "center",
              },
            },
            actions: {
              "demo:image:rotate": {
                style: {
                  rotate: {
                    from: 0,
                    to: 120,
                    easing: "easeInOutSine",
                    duration: 2000,
                  },
                },
              },
              "demo:image:translate": {
                style: {
                  x: {
                    from: 0,
                    to: -200,
                    easing: "easeInOutSine",
                  },
                  y: {
                    from: 0,
                    to: -200,
                    easing: "easeInOutSine",
                  },
                },
              },
            },
          },
          "demo-list": {
            id: "demo-list",
            type: "list",
            initial: {
              id: "demo-list",
              className: "demo-card demo-list",
              style: {
                position: "absolute",
                left: "28%",
                top: "58%",
                width: "250px",
                height: "110px",
                backgroundColor: "#eef7f6",
                border: "2px dashed #0b7a75",
                borderRadius: "14px",
                scale: 1,
              },
            },
            actions: {
              "demo:list:scale": {
                style: {
                  scale: {
                    from: 1,
                    to: 1.08,
                    easing: "easeInOutSine",
                  },
                },
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
            name: "demo:text:color",
          },
          {
            ms: 240,
            name: "demo:image:rotate",
          },
          {
            ms: 800,
            name: "demo:image:translate",
          },
          {
            ms: 480,
            name: "demo:list:scale",
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

  const textNode = globalThis.document.createElement("div");
  textNode.dataset.demoItemId = "demo-text";

  const imageNode = globalThis.document.createElement("div");
  imageNode.dataset.demoItemId = "demo-image";

  const listNode = globalThis.document.createElement("section");
  listNode.dataset.demoItemId = "demo-list";

  containerNode.append(textNode, imageNode, listNode);

  nodeByItemId.set("demo-text", textNode);
  nodeByItemId.set("demo-image", imageNode);
  nodeByItemId.set("demo-list", listNode);

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
	      <p class="subtitle">Text, image et list avec animations couleur, rotation et scale.</p>
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
