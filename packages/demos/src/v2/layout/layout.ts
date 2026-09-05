import {
  CodPlay,
  type CodPlayInstance,
  type CodPlayPublicEvent,
  type CodPlayTraceEvent,
  type CompiledResourceManifest,
  type RuntimePreloadManifestInput,
} from "codplay";
import { createV2DemoTelco } from "./telco";

import type { V2DemoDefinition } from "../registry";
import type { V2DemoLogLevel, V2DemoModule, V2DemoPlayback } from "./types";

import "./layout.css";

type V2DemoLayoutOptions = Readonly<{
  app: HTMLElement;
  active: V2DemoDefinition;
  demos: readonly V2DemoDefinition[];
}>;

const V2_DEMO_LOG_OPEN_STORAGE_KEY = "codplay-v2-demo-log-open";
const V2_DEMO_LOG_ENABLED = new URLSearchParams(globalThis.location.search).get("v2-log") !== "off";

/** Mounts the responsive V2 frame and owns every control shared by its demos. */
export function createV2DemoLayout(options: V2DemoLayoutOptions): {
  mount: (module: V2DemoModule) => Promise<void>;
  destroy: () => void;
} {
  const layoutRoot = options.app.querySelector<HTMLElement>("[data-v2-demo-layout]");
  if (layoutRoot === null) throw new Error("Expected the V2 demo layout in index.html.");

  const title = layoutRoot.querySelector<HTMLElement>(".v2-demo-title")!;
  const description = layoutRoot.querySelector<HTMLElement>(".v2-demo-description")!;
  const selector = layoutRoot.querySelector<HTMLSelectElement>(".v2-demo-selector__input")!;
  const sceneSlot = layoutRoot.querySelector<HTMLElement>("[data-v2-demo-scene]")!;
  const telcoSlot = layoutRoot.querySelector<HTMLElement>("[data-v2-demo-telco]")!;
  const logsToggle = layoutRoot.querySelector<HTMLButtonElement>(".v2-demo-logs-toggle")!;
  const logPanel = layoutRoot.querySelector<HTMLElement>(".v2-demo-log-panel")!;
  const logOutput = layoutRoot.querySelector<HTMLPreElement>(".v2-demo-log-output")!;
  const logCopy = layoutRoot.querySelector<HTMLButtonElement>(".v2-demo-log-copy")!;
  const logClose = layoutRoot.querySelector<HTMLButtonElement>(".v2-demo-log-close")!;

  function readLogPanelOpen(): boolean {
    try {
      return globalThis.localStorage.getItem(V2_DEMO_LOG_OPEN_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  function writeLogPanelOpen(open: boolean): void {
    try {
      globalThis.localStorage.setItem(V2_DEMO_LOG_OPEN_STORAGE_KEY, String(open));
    } catch {
      // Private browsing and restricted storage must not block the demo.
    }
  }

  function setLogPanelOpen(open: boolean): void {
    logPanel.hidden = !open;
    logsToggle.setAttribute("aria-expanded", String(open));
    const label = open ? "Masquer les logs" : "Afficher les logs";
    logsToggle.setAttribute("aria-label", label);
    logsToggle.title = label;
    writeLogPanelOpen(open);
  }

  title.textContent = options.active.title;
  description.textContent = options.active.description;
  for (const demo of options.demos) {
    const option = document.createElement("option");
    option.value = demo.path;
    option.textContent = demo.title;
    option.selected = demo.id === options.active.id;
    selector.append(option);
  }
  selector.addEventListener("change", () => {
    const target = new URL(selector.value, globalThis.location.href);
    globalThis.location.assign(target.href);
  });

  const logLines: string[] = [];
  let logFlushScheduled = false;
  let telcoControls: ReturnType<typeof createV2DemoTelco> | null = null;
  let telcoPlaybackCleanup: (() => void) | null = null;
  let traceCleanup: (() => void) | null = null;
  let publicEventCleanup: (() => void) | null = null;
  let sceneCleanup: (() => void) | null = null;
  const loggedEventIds = new Set<string>();

  function flushLogs(): void {
    logFlushScheduled = false;
    logOutput.textContent = logLines.join("\n");
    logOutput.scrollTop = logOutput.scrollHeight;
  }

  function log(message: string, level: V2DemoLogLevel = "info"): void {
    if (!V2_DEMO_LOG_ENABLED) return;
    const time = new Date().toLocaleTimeString("fr-FR", { hour12: false });
    logLines.push(`[${time}] ${level.toUpperCase()} ${message}`);
    if (logLines.length > 500) logLines.shift();
    if (!logFlushScheduled) {
      logFlushScheduled = true;
      globalThis.requestAnimationFrame(flushLogs);
    }
  }

  /** Formats one runtime event context for the optional layout journal. */
  function formatTraceEvent(event: CodPlayTraceEvent): string {
    const data = event.data === undefined ? "" : ` data=${JSON.stringify(event.data)}`;
    return `event ${event.name} @${event.timeMs}ms${data}`;
  }

  /** Formats one public event that has no preceding runtime trace row. */
  function formatPublicEvent(event: CodPlayPublicEvent): string {
    const data = event.data === undefined ? "" : ` data=${JSON.stringify(event.data)}`;
    return `event ${event.name} @${event.timeMs}ms${data}`;
  }

  /** Copies the current non-blocking journal without changing its contents. */
  async function copyLogs(): Promise<void> {
    const text = logLines.join("\n");
    try {
      await globalThis.navigator.clipboard.writeText(text);
    } catch {
      log("Copie du journal indisponible dans ce contexte.", "warn");
    }
  }

  /** Installs the common remote and any declared external playback control. */
  function installTelco(
    telco: CodPlayInstance["telco"],
    instance: CodPlayInstance,
    playback: V2DemoPlayback | undefined,
    onReload: () => void | Promise<void>,
  ): void {
    telcoPlaybackCleanup?.();
    telcoPlaybackCleanup = null;
    telcoControls?.destroy();
    telcoControls = createV2DemoTelco(telco, { onLog: log, onReload });
    const playbackControl = playback;
    if (playbackControl !== undefined) {
      const playbackLabel = playbackControl.label;
      const playbackInjections = playbackControl.injections;
      const playbackRow = document.createElement("div");
      playbackRow.className = "v2-demo-telco__playback";
      const playbackButton = document.createElement("button");
      playbackButton.type = "button";
      playbackButton.className = "telco-button telco-button--secondary";
      playbackButton.textContent = playbackLabel;
      playbackButton.setAttribute("aria-label", playbackLabel);
      playbackButton.title = playbackLabel;
      let disposed = false;
      let inFlight = false;

      /** Injects one declared playback sequence through the public events facade. */
      async function runPlayback(): Promise<void> {
        if (disposed || inFlight) return;
        inFlight = true;
        playbackButton.disabled = true;
        try {
          await telco.rewind();
          for (const injection of playbackInjections) {
            if (disposed) return;
            await instance.events.emit(injection.eventime, injection.target);
          }
          if (!disposed) await telco.play();
        } finally {
          inFlight = false;
          if (!disposed) playbackButton.disabled = false;
        }
      }

      playbackButton.addEventListener("click", () => {
        void runPlayback();
      });
      playbackRow.append(playbackButton);
      telcoControls.element.append(playbackRow);
      telcoPlaybackCleanup = () => {
        disposed = true;
        playbackButton.remove();
      };
    }
    telcoSlot.replaceChildren(telcoControls.element);
  }

  /** Releases the current runner, telco and scene-specific stage state. */
  const unmountScene = (): void => {
    sceneCleanup?.();
    sceneCleanup = null;
    traceCleanup?.();
    traceCleanup = null;
    publicEventCleanup?.();
    publicEventCleanup = null;
    loggedEventIds.clear();
    telcoPlaybackCleanup?.();
    telcoPlaybackCleanup = null;
    telcoControls?.destroy();
    telcoControls = null;
    telcoSlot.replaceChildren();
    sceneSlot.className = "v2-demo-scene-slot";
    sceneSlot.removeAttribute("aria-label");
    sceneSlot.removeAttribute("data-codplay-scope");
    sceneSlot.replaceChildren();
  };

  setLogPanelOpen(readLogPanelOpen());
  logsToggle.addEventListener("click", () => setLogPanelOpen(logPanel.hidden === true));
  logClose.addEventListener("click", () => setLogPanelOpen(false));
  logCopy.addEventListener("click", () => {
    void copyLogs();
  });

  /** Mounts only the scene supplied by a lazily loaded demo module. */
  async function mount(module: V2DemoModule): Promise<void> {
    unmountScene();
    sceneSlot.className = "v2-demo-scene-slot";
    sceneSlot.setAttribute("aria-label", `Scène : ${options.active.title}`);

    // The factory gives each mount a fresh SceneDoc and fresh closure-owned straps.
    const scene = module.createScene();
    let codplay: CodPlay;
    try {
      codplay = new CodPlay({
        engine: {
          diagnosticOutput: (diagnostic) => {
            if (!V2_DEMO_LOG_ENABLED) return;
            console.log("[CodPlay V2 diagnostic]", diagnostic);
            log(
              `${diagnostic.code}: ${diagnostic.message}`,
              diagnostic.severity === "warning" ? "warn" : "error",
            );
          },
        },
        pauseOnDocumentHidden: false,
      });
    } catch (error) {
      log(`Engine creation failed: ${error instanceof Error ? error.message : String(error)}`, "error");
      return;
    }
    const build = codplay.build({ scene });
    if (!build.ok) {
      if (build.diagnostics.errors.length === 0) log("SceneDoc build failed.", "error");
      codplay.destroy();
      return;
    }

    const preload = codplay.preload;
    const stylesheetManifest: CompiledResourceManifest = {
      entries: [
        {
          url: module.stylesheetUrl,
          type: "css",
          policy: { cache: "default", priority: "high" },
        },
      ],
    };
    const preloadManifest: RuntimePreloadManifestInput =
      module.preloadManifest === undefined ?
        [stylesheetManifest, build.compiledScene.resources]
      : [stylesheetManifest, build.compiledScene.resources, module.preloadManifest];
    const preloadUrls = [
      ...new Set(
        [
          ...stylesheetManifest.entries,
          ...build.compiledScene.resources.entries,
          ...(module.preloadManifest?.entries ?? []),
        ].map((entry) => entry.url),
      ),
    ];
    const releaseResources = (): void => preload.release(preloadUrls);
    const preloadResult = await preload.load({
      manifest: preloadManifest,
      options: { mode: module.preloadMode ?? "author", container: sceneSlot },
    });
    if (!preloadResult.ok) {
      log(`Ressources de démo indisponibles : ${preloadResult.error.message}`, "error");
      releaseResources();
      codplay.destroy();
      return;
    }

    codplay.resources.register(preloadResult.data);
    for (const warning of preloadResult.data.warnings ?? []) {
      log(`${warning.code}: ${warning.message}`, "warn");
    }

    let instance: CodPlayInstance;
    try {
      instance = codplay.instances.create({
        instanceId: scene.id,
        compiledScene: build.compiledScene,
        functions: build.functions,
        root: sceneSlot,
      });
    } catch (error) {
      log(`Instance creation failed: ${error instanceof Error ? error.message : String(error)}`, "error");
      releaseResources();
      codplay.destroy();
      return;
    }

    if (V2_DEMO_LOG_ENABLED) {
      traceCleanup = instance.diagnostic.onTrace((event) => {
        loggedEventIds.add(event.eventId);
        log(formatTraceEvent(event));
      });
      publicEventCleanup = instance.events.onEvent((event) => {
        if (loggedEventIds.has(event.eventId)) return;
        log(formatPublicEvent(event));
      });
    }
    installTelco(instance.telco, instance, module.playback, () => mount(module));
    log(`${options.active.title} initialisée · horizon issu des eventimes compilés`);

    sceneCleanup = () => {
      releaseResources();
      codplay.destroy();
    };
  }

  return {
    mount,
    destroy() {
      unmountScene();
      if (logFlushScheduled) logFlushScheduled = false;
    },
  };
}
