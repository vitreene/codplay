import type { AnimationAdapter } from "../animation/types";
import type { TimelineEvent } from "../core/events/types";
import { TimeTicker } from "../core/time/ticker";
import { DirectorCore } from "../director/create-director";
import { RendererFacade } from "../renderer/create-renderer";
import { createMediaSyncModule } from "../runtime/modules/media-sync";
import type { MediaSyncRuntimeComponent } from "../runtime/modules/media-sync";
import {
  createRuntimeTraceStore,
  type RuntimeTraceRow,
  type RuntimeTraceStatus,
} from "../runtime/trace-store";
import type { CreateElementOptions } from "../runtime/create-element";
import type { RuntimePersos } from "../runtime/types";
import { RUNTIME_EVENT_SOURCE } from "../core/events/constants";
import { RUNTIME_TRACE_STATUS } from "../runtime/trace-constants";
import { TrackManager } from "../track-manager/create-track-manager";
import { normalizeSceneDef } from "../builder/scene-normalization";
import {
  consolidateSceneTracks,
  createSceneLifecycleOptions,
  isTrackControlEventName,
  PlayerRuntimePlanner,
  PLAYER_TRACK_CONTROL_EVENTS,
  readTrackControlIds,
  resolveDefaultStoryTrackId,
} from "./create-player-utils";
import { PLAYER_RUNTIME_EVENT, PLAYER_SEQUENCE_EVENT, PLAYER_STATUS } from "./player-constants";
import { resolveSeekEndMsFromPolicy, shouldReplayEventForSeek } from "./seek-runtime";
import type {
  PlayerApi,
  PlayerCommandResult,
  PlayerPublicEventInput,
  PlayerRuntimePolicy,
  PlayerSceneLifecycleOptions,
  PlayerSceneInput,
  PlayerStateListener,
  PlayerStateSnapshot,
  PlayerStatus,
  PlayerTraceListener,
  RebuildMode,
  SceneStoryDoc,
  StrictSceneDoc,
} from "./types";

export type CreatePlayerOptions = {
  runtimePolicy?: Partial<PlayerRuntimePolicy>;
  createElementOptions?: CreateElementOptions;
  animationAdapter?: AnimationAdapter;
  onRuntimeEmit?: (event: PlayerPublicEventInput) => void;
  onTimelineEvent?: (event: PlayerPublicEventInput) => Promise<PlayerCommandResult>;
};

const DEFAULT_RUNTIME_POLICY: PlayerRuntimePolicy = {
  allowedRebuildModes: ["state", "full"],
  seekPolicy: "author-unrestricted",
};

const NOOP_ANIMATION_ADAPTER: AnimationAdapter = {
  run: () => [],
  stop: () => {
    return;
  },
};

const PLAYER_TRACE_EVENT = {
  mountFailed: "player:mount:failed",
  trackControl: "player:track-control",
  trackControlWarning: "player:track-control:warning",
  trackAppendGenerated: "player:track:append-generated",
  horizonSync: "player:horizon:sync",
  seekReplayEvent: "player:seek:replay:event",
  initStarted: "player:init:started",
  initDone: "player:init:done",
} as const;

const PLAYER_TRACK = {
  global: "global",
} as const;

const PLAYER_RUNTIME_ERROR_MESSAGE = {
  mountedStoryRequired: "Scene must provide at least one mounted story",
} as const;

/**
 * Checks whether one runtime component exposes the media sync bridge contract.
 */
function isMediaSyncRuntimeComponent(value: unknown): value is MediaSyncRuntimeComponent {
  return (
    typeof value === "object" &&
    value !== null &&
    "seekTo" in value &&
    typeof value.seekTo === "function" &&
    "play" in value &&
    typeof value.play === "function" &&
    "pause" in value &&
    typeof value.pause === "function" &&
    "stopAt" in value &&
    typeof value.stopAt === "function" &&
    "getCurrentTimeMs" in value &&
    typeof value.getCurrentTimeMs === "function" &&
    "getDurationMs" in value &&
    typeof value.getDurationMs === "function" &&
    "isPaused" in value &&
    typeof value.isPaused === "function"
  );
}

/**
 * Implements one player facade with lifecycle commands and subscriptions.
 */
export class PlayerFacade implements PlayerApi {
  private readonly runtimePolicy: PlayerRuntimePolicy;
  private readonly runtimePlanner = new PlayerRuntimePlanner();
  private readonly director = new DirectorCore();
  private readonly renderer: RendererFacade;
  private readonly trackManager = new TrackManager();
  private readonly mediaSync = createMediaSyncModule({
    getComponentById: (runtimeItemId) => {
      const component = this.renderer.getRuntimeRegistry().getComponentById(runtimeItemId);
      if (isMediaSyncRuntimeComponent(component)) {
        return component;
      }

      return null;
    },
  });

  private status: PlayerStatus = PLAYER_STATUS.idle;
  private scene: StrictSceneDoc | null = null;
  private timelineMs = 0;
  private timelineEndMs = 0;
  private projectedMasterEndMs = 0;
  private authorEndMs = 0;
  private seekEndMs = 0;
  private playedEndMs = 0;
  private playbackStartMs: number | null = null;
  private sequenceEnded = false;
  private readonly ticker = new TimeTicker();
  private nextPublicEventIndex = 0;
  private readonly mountedStoryIds = new Set<string>();
  private readonly scheduledStoryIds = new Set<string>();
  private timelineReplayInProgress = false;

  private readonly traceStore = createRuntimeTraceStore({ maxEntries: 2000 });
  private readonly traceListeners = new Set<PlayerTraceListener>();
  private readonly stateListeners = new Set<PlayerStateListener>();
  private readonly onTimelineEvent?: (event: PlayerPublicEventInput) => Promise<PlayerCommandResult>;
  private playbackTickPromise: Promise<void> = Promise.resolve();

  /**
   * Returns one loaded runtime track meta when available.
   */
  getTrackMeta(trackId: string): import("../track-manager/types").TrackRuntimeMeta | null {
    return this.trackManager.getTrackMeta(trackId);
  }

  /**
   * Appends generated helper events into one runtime track.
   */
  appendGeneratedEvents(input: { trackId: string; events: TimelineEvent[] }): PlayerCommandResult {
    const appendResult = this.trackManager.appendLiveEvents({
      trackId: input.trackId,
      events: input.events,
    });
    if (!appendResult.ok) {
      return this.reject(
        appendResult.error.code,
        appendResult.error.message,
        "player:track:append-generated",
      );
    }

    this.emitTrace(PLAYER_TRACE_EVENT.trackAppendGenerated, RUNTIME_TRACE_STATUS.applied, {
      trackId: input.trackId,
      appendedCount: input.events.length,
      firstEventMs: input.events[0]?.ms,
      lastEventMs: input.events[input.events.length - 1]?.ms,
      role: this.trackManager.getTrackMeta(input.trackId)?.role,
    });

    return this.refreshTimelineEndFromMountedPlan();
  }

  /**
   * Persists one event into the track for seek replay without applying it to the live runtime.
   * Advances the cursor past the event so the playback loop never executes it.
   */
  persistTrackEvent(event: PlayerPublicEventInput): PlayerCommandResult {
    if (!this.isInitialized()) {
      return this.reject(
        "PLAYER_NOT_INITIALIZED",
        "init must be called before persistTrackEvent",
        "player:persist-track-event",
      );
    }

    const timelineEvent = this.createTimelineEvent(event);
    const shouldPersistEvent =
      timelineEvent.source === RUNTIME_EVENT_SOURCE.user ||
      (timelineEvent.source === RUNTIME_EVENT_SOURCE.system &&
        timelineEvent.name !== "scene:ready" &&
        timelineEvent.name !== "scene:start" &&
        timelineEvent.name !== "scene:end");

    if (!shouldPersistEvent) {
      return { ok: true };
    }

    const appendResult = this.trackManager.appendLiveEvents({
      trackId: timelineEvent.trackId ?? PLAYER_TRACK.global,
      events: [timelineEvent],
    });
    if (!appendResult.ok) {
      return this.reject(appendResult.error.code, appendResult.error.message, "player:persist-track-event", {
        eventName: timelineEvent.name,
        trackId: timelineEvent.trackId,
      });
    }

    this.trackManager.syncCursor({ nowMs: this.resolveCurrentTimelineMs() });

    return this.refreshTimelineEndFromMountedPlan();
  }

  /**
   * Resolves the current timeline end using both event/action durations and master media tracks.
   */
  private resolveTimelineEndMs(runtimePlan: ReturnType<PlayerRuntimePlanner["createRuntimePlan"]>): number {
    return this.runtimePlanner.resolveTimelineEndMsFromRuntimePlan({
      runtimePlan,
      getTrackMeta: (trackId) => this.trackManager.getTrackMeta(trackId),
      getMediaDurationMs: (runtimeItemId) => {
        const component = this.renderer.getRuntimeRegistry().getComponentById(runtimeItemId);
        return isMediaSyncRuntimeComponent(component) ? component.getDurationMs() : null;
      },
    });
  }

  /**
   * Resolves the full author horizon from all currently known future events.
   */
  private resolveAuthorEndMs(runtimePlan: ReturnType<PlayerRuntimePlanner["createRuntimePlan"]>): number {
    return Math.max(
      this.runtimePlanner.resolveTimelineEndMsFromPlan(runtimePlan.timelinePlan),
      this.resolveTimelineEndMs(runtimePlan),
    );
  }

  /**
   * Resolves the current seek cap from canonical horizon values.
   */
  private resolveCurrentSeekEndMs(): number {
    return resolveSeekEndMsFromPolicy(this.runtimePolicy.seekPolicy, {
      playedEndMs: this.playedEndMs,
      projectedMasterEndMs: this.projectedMasterEndMs,
      authorEndMs: this.authorEndMs,
    });
  }

  /**
   * Records the furthest position that can contribute to the replayable played horizon.
   */
  private recordPlayedProgress(event: TimelineEvent): void {
    if (this.timelineReplayInProgress) {
      return;
    }

    this.playedEndMs = Math.max(this.playedEndMs, event.ms);
    this.timelineEndMs = Math.max(this.projectedMasterEndMs, this.playedEndMs);
    this.seekEndMs = this.resolveCurrentSeekEndMs();
  }

  /**
   * Updates the current horizon snapshot from one mounted runtime plan.
   */
  private syncHorizonFromRuntimePlan(
    runtimePlan: ReturnType<PlayerRuntimePlanner["createRuntimePlan"]>,
  ): void {
    const previousTimelineEndMs = this.timelineEndMs;
    const previousProjectedMasterEndMs = this.projectedMasterEndMs;
    const previousAuthorEndMs = this.authorEndMs;
    const previousSeekEndMs = this.seekEndMs;
    const projectedMasterEndMs = this.resolveTimelineEndMs(runtimePlan);

    this.projectedMasterEndMs = projectedMasterEndMs;
    this.timelineEndMs = Math.max(projectedMasterEndMs, this.playedEndMs);
    this.authorEndMs = this.resolveAuthorEndMs(runtimePlan);
    this.seekEndMs = this.resolveCurrentSeekEndMs();

    if (
      previousTimelineEndMs !== this.timelineEndMs ||
      previousProjectedMasterEndMs !== this.projectedMasterEndMs ||
      previousAuthorEndMs !== this.authorEndMs ||
      previousSeekEndMs !== this.seekEndMs
    ) {
      this.emitTrace(PLAYER_TRACE_EVENT.horizonSync, RUNTIME_TRACE_STATUS.applied, {
        timelineEndMs: this.timelineEndMs,
        projectedMasterEndMs: this.projectedMasterEndMs,
        authorEndMs: this.authorEndMs,
        seekEndMs: this.seekEndMs,
        playedEndMs: this.playedEndMs,
        loadedTracks: this.trackManager.state.loadedTrackIds.map((trackId) => {
          const meta = this.trackManager.getTrackMeta(trackId);
          return {
            trackId,
            role: meta?.role,
            active: meta?.active,
            order: meta?.order,
            source: meta?.source,
          };
        }),
      });
    }
  }

  /**
   * Resolves the fallback track id for one event context.
   */
  private resolveDefaultTrackId(scopeStoryId?: string): string {
    if (scopeStoryId && this.scene !== null) {
      const story = this.scene.stories[scopeStoryId];
      if (story) {
        return resolveDefaultStoryTrackId(story);
      }
    }

    return PLAYER_TRACK.global;
  }

  /**
   * Applies one replayable state patch event onto scene or story state.
   */
  private applyRuntimeStateUpdate(event: TimelineEvent): boolean {
    if (event.name !== PLAYER_RUNTIME_EVENT.stateUpdate) {
      return false;
    }

    if (typeof event.payload !== "object" || event.payload === null || this.scene === null) {
      return true;
    }

    if (event.scopeStoryId !== undefined) {
      const story = this.scene.stories[event.scopeStoryId];
      if (!story) {
        return true;
      }

      story.state = typeof story.state === "object" && story.state !== null ? story.state : {};
      Object.assign(story.state, event.payload);
      return true;
    }

    this.scene.state =
      typeof this.scene.state === "object" && this.scene.state !== null ? this.scene.state : {};
    Object.assign(this.scene.state, event.payload);
    return true;
  }

  /**
   * Returns true when one runtime event is handled internally by the player core.
   */
  private isInternalRuntimeEvent(event: TimelineEvent): boolean {
    return event.name === PLAYER_RUNTIME_EVENT.stateUpdate;
  }

  /**
   * Applies one scene-level track control event when supported.
   */
  private handleTrackControlEvent(event: TimelineEvent): boolean {
    if (!isTrackControlEventName(event.name)) {
      return false;
    }

    const requestedTrackIds = readTrackControlIds(event.payload);
    const knownTrackIds = new Set(this.trackManager.state.loadedTrackIds);
    const activeTrackIds = new Set(this.trackManager.state.activeTrackIds);
    const appliedTrackIds = requestedTrackIds.filter((trackId) => knownTrackIds.has(trackId));
    const ignoredTrackIds = requestedTrackIds.filter((trackId) => !knownTrackIds.has(trackId));

    if (event.name === PLAYER_TRACK_CONTROL_EVENTS.activate) {
      this.trackManager.setActiveTracks({ activate: appliedTrackIds, reason: event.name });
    } else if (event.name === PLAYER_TRACK_CONTROL_EVENTS.deactivate) {
      this.trackManager.setActiveTracks({ deactivate: appliedTrackIds, reason: event.name });
    } else {
      this.trackManager.setActiveTracks({
        activate: appliedTrackIds.filter((trackId) => !activeTrackIds.has(trackId)),
        deactivate: appliedTrackIds.filter((trackId) => activeTrackIds.has(trackId)),
        reason: event.name,
      });
    }

    this.emitTrace(PLAYER_TRACE_EVENT.trackControl, RUNTIME_TRACE_STATUS.applied, {
      eventId: event.id,
      eventName: event.name,
      appliedTrackIds,
      ignoredTrackIds,
    });

    if (ignoredTrackIds.length > 0) {
      this.emitTrace(PLAYER_TRACE_EVENT.trackControlWarning, RUNTIME_TRACE_STATUS.info, {
        code: "RUNTIME_TRACK_UNKNOWN_IGNORED",
        eventId: event.id,
        eventName: event.name,
        ignoredTrackIds,
      });
    }

    return true;
  }

  /**
   * Configures one player facade from explicit options.
   */
  constructor(options: CreatePlayerOptions = {}) {
    this.runtimePolicy = {
      allowedRebuildModes:
        options.runtimePolicy?.allowedRebuildModes ?? DEFAULT_RUNTIME_POLICY.allowedRebuildModes,
      seekPolicy: options.runtimePolicy?.seekPolicy ?? DEFAULT_RUNTIME_POLICY.seekPolicy,
    };
    this.onTimelineEvent = options.onTimelineEvent;

    const animationAdapter = options.animationAdapter ?? NOOP_ANIMATION_ADAPTER;
    this.renderer = new RendererFacade({
      animationAdapter,
      createElementOptions: options.createElementOptions,
      getCurrentTimelineMs: () => this.resolveCurrentTimelineMs(),
      emitRuntimeEvent: (event) => {
        const runtimeEvent: PlayerPublicEventInput = {
          name: event.name,
          payload: event.data,
          ms: event.ms,
          scopeStoryId: event.cascade === true ? undefined : event.scopeStoryId,
          cascade: event.cascade,
          source: event.source === "system" ? RUNTIME_EVENT_SOURCE.system : RUNTIME_EVENT_SOURCE.user,
          mode: event.mode,
        };

        if (options.onRuntimeEmit) {
          options.onRuntimeEmit(runtimeEvent);
          return;
        }

        void this.emit({
          ...runtimeEvent,
        });
      },
    });

    this.renderer.onError((error) => {
      this.emitTrace("renderer:error", RUNTIME_TRACE_STATUS.error, {
        code: error.code,
        message: error.message,
        ...(error.details ?? {}),
      });
    });
  }

  readonly component: import("../runtime/components").ComponentRegistryApi = {
    register: (input) => {
      if (this.isInitialized()) {
        return {
          ok: false,
          error: {
            code: "PLAYER_COMPONENT_REGISTRY_LOCKED",
            message: "component.register is only allowed before init",
          },
        };
      }
      const result = this.renderer.component.register(input);
      if (result.ok) {
        this.emitTrace("player:register-component", RUNTIME_TRACE_STATUS.applied, {
          type: input.type,
          status: result.status,
        });
      }
      return result;
    },
    override: (input) => {
      if (this.isInitialized()) {
        return {
          ok: false,
          error: {
            code: "PLAYER_COMPONENT_REGISTRY_LOCKED",
            message: "component.override is only allowed before init",
          },
        };
      }
      const result = this.renderer.component.override(input);
      if (result.ok) {
        this.emitTrace("player:override-component", RUNTIME_TRACE_STATUS.applied, {
          type: input.type,
          status: result.status,
        });
      }
      return result;
    },
  };

  readonly service: import("../runtime/components").ServiceRegistryApi = {
    register: (input) => {
      if (this.isInitialized()) {
        return {
          ok: false,
          error: {
            code: "PLAYER_SERVICE_REGISTRY_LOCKED",
            message: "service.register is only allowed before init",
          },
        };
      }
      const result = this.renderer.service.register(input);
      if (result.ok) {
        this.emitTrace("player:register-service", RUNTIME_TRACE_STATUS.applied, {
          name: input.name,
          status: result.status,
        });
      }
      return result;
    },
    override: (input) => {
      if (this.isInitialized()) {
        return {
          ok: false,
          error: {
            code: "PLAYER_SERVICE_REGISTRY_LOCKED",
            message: "service.override is only allowed before init",
          },
        };
      }
      const result = this.renderer.service.override(input);
      if (result.ok) {
        this.emitTrace("player:override-service", RUNTIME_TRACE_STATUS.applied, {
          name: input.name,
          status: result.status,
        });
      }
      return result;
    },
  };

  readonly module: import("../runtime/components").ModuleRegistryApi = {
    register: (input) => {
      if (this.isInitialized()) {
        return {
          ok: false,
          error: {
            code: "PLAYER_MODULE_REGISTRY_LOCKED",
            message: "module.register is only allowed before init",
          },
        };
      }
      const result = this.renderer.module.register(input);
      if (result.ok) {
        this.emitTrace("player:register-module", RUNTIME_TRACE_STATUS.applied, {
          name: input.name,
          status: result.status,
        });
      }
      return result;
    },
    override: (input) => {
      if (this.isInitialized()) {
        return {
          ok: false,
          error: {
            code: "PLAYER_MODULE_REGISTRY_LOCKED",
            message: "module.override is only allowed before init",
          },
        };
      }
      const result = this.renderer.module.override(input);
      if (result.ok) {
        this.emitTrace("player:override-module", RUNTIME_TRACE_STATUS.applied, {
          name: input.name,
          status: result.status,
        });
      }
      return result;
    },
  };

  /**
   * Exposes one stable runtime registry for integration/editing flows.
   */
  getRuntimeRegistry(): import("../runtime/components").RuntimeRegistrySnapshot {
    return this.renderer.getRuntimeRegistry();
  }

  /**
   * Resolves current timeline cursor using playback clock when active.
   */
  private resolveCurrentTimelineMs(): number {
    const fallbackTimelineMs =
      this.playbackStartMs === null ?
        this.runtimePlanner.clampTimelineMs(this.timelineMs)
      : this.runtimePlanner.clampTimelineMs(this.runtimePlanner.resolveNowMs() - this.playbackStartMs);

    if (this.status !== PLAYER_STATUS.playing) {
      return this.sequenceEnded ? Math.min(fallbackTimelineMs, this.timelineEndMs) : fallbackTimelineMs;
    }

    const resolvedTimelineMs = this.mediaSync.resolveTimelineMsFromActiveMaster(fallbackTimelineMs);
    return this.sequenceEnded ? Math.min(resolvedTimelineMs, this.timelineEndMs) : resolvedTimelineMs;
  }

  /**
   * Synchronizes all registered media components to one target timeline.
   */
  private syncMediaTimeline(timelineMs: number): void {
    this.mediaSync.syncTimeline(timelineMs, this.status === PLAYER_STATUS.playing ? "playing" : "paused");
  }

  /**
   * Loads one runtime media registry from mounted runtime persos.
   */
  private loadMediaRuntime(runtimePersos: RuntimePersos): void {
    this.mediaSync.loadRuntimePersos(runtimePersos);
  }

  /**
   * Traces one renderer lifecycle command around the current player state.
   */
  private traceRendererCommand(
    commandName: "start" | "resume" | "pause",
    phase: "requested" | "result",
    source: string,
    result?: { ok: boolean; error?: { code: string; message: string; details?: unknown } },
  ): void {
    const rendererState = this.renderer.getState();

    this.emitTrace(
      `player:renderer:${commandName}:${phase}`,
      result?.ok === false ? RUNTIME_TRACE_STATUS.error : RUNTIME_TRACE_STATUS.applied,
      {
        source,
        playerStatus: this.status,
        timelineMs: this.timelineMs,
        playbackActive: this.playbackStartMs !== null,
        rendererStatus: rendererState.status,
        runtimeRevision: rendererState.runtimeRevision,
        code: result?.ok === false ? result.error?.code : undefined,
        message: result?.ok === false ? result.error?.message : undefined,
        details: result?.ok === false ? result.error?.details : undefined,
      },
    );
  }

  /**
   * Starts the renderer while tracing the transition source.
   */
  private startRenderer(source: string): ReturnType<RendererFacade["start"]> {
    this.traceRendererCommand("start", "requested", source);
    const result = this.renderer.start();
    this.traceRendererCommand("start", "result", source, result);
    return result;
  }

  /**
   * Resumes the renderer while tracing the transition source.
   */
  private resumeRenderer(source: string): ReturnType<RendererFacade["resume"]> {
    this.traceRendererCommand("resume", "requested", source);
    const result = this.renderer.resume();
    this.traceRendererCommand("resume", "result", source, result);
    return result;
  }

  /**
   * Pauses the renderer while tracing the transition source.
   */
  private pauseRenderer(source: string): ReturnType<RendererFacade["pause"]> {
    this.traceRendererCommand("pause", "requested", source);
    const result = this.renderer.pause();
    this.traceRendererCommand("pause", "result", source, result);
    return result;
  }

  /**
   * Stops frame-driven playback scheduling when currently active.
   */
  private stopPlaybackLoop(): void {
    if (!this.ticker.isRunning()) {
      return;
    }

    this.ticker.stop();
  }

  /**
   * Returns true when player has one initialized scene.
   */
  private isInitialized(): boolean {
    return this.scene !== null;
  }

  /**
   * Clears runtime references while preserving policy and subscribers.
   */
  private resetRuntime(): void {
    this.stopPlaybackLoop();
    this.director.destroy();
    this.mediaSync.resetPlayback();
    this.renderer.destroy();
    this.mediaSync.reset();
    this.trackManager.load({ tracks: {} });
    this.scene = null;
    this.timelineMs = 0;
    this.timelineEndMs = 0;
    this.projectedMasterEndMs = 0;
    this.authorEndMs = 0;
    this.seekEndMs = 0;
    this.playedEndMs = 0;
    this.playbackStartMs = null;
    this.sequenceEnded = false;
    this.nextPublicEventIndex = 0;
    this.mountedStoryIds.clear();
    this.scheduledStoryIds.clear();
  }

  /**
   * Marks all authored stories as active for the current runtime cycle.
   */
  private activateAllSceneStories(): void {
    if (this.scene === null) {
      return;
    }

    this.mountedStoryIds.clear();
    this.scheduledStoryIds.clear();

    for (const storyId of Object.keys(this.scene.stories)) {
      this.mountedStoryIds.add(storyId);
      this.scheduledStoryIds.add(storyId);
    }
  }

  /**
   * Seeds all story eventimes into the track manager from scene start.
   */
  private seedAllStoryEventimes(): void {
    if (this.scene === null) {
      return;
    }

    for (const story of Object.values(this.scene.stories)) {
      if (!Array.isArray(story.eventimes) || story.eventimes.length === 0) {
        continue;
      }

      this.trackManager.appendAnchoredEventimes({
        trackId: this.resolveStoryTrackId(story.id),
        anchorMs: 0,
        storyId: story.id,
        eventimes: story.eventimes,
      });
    }
  }

  /**
   * Returns mounted story ids in deterministic insertion order.
   */
  private getMountedStoryIds(): string[] {
    return [...this.mountedStoryIds];
  }

  /**
   * Builds one runtime plan from all currently mounted stories.
   */
  private createMountedRuntimePlan() {
    if (this.scene === null || this.mountedStoryIds.size === 0) {
      return null;
    }

    return this.runtimePlanner.createRuntimePlan(
      this.scene,
      this.getMountedStoryIds(),
      this.trackManager.getAllEvents({ activeOnly: true }),
    );
  }

  /**
   * Rebuilds the runtime plan from all mounted stories and current track state.
   */
  private syncMountedRuntimePlan(): PlayerCommandResult {
    const runtimePlan = this.createMountedRuntimePlan();
    if (runtimePlan === null) {
      return this.reject(
        "SCENE_STORY_NOT_FOUND",
        PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
        "player:sync-runtime",
      );
    }

    this.applyMountedRuntimePlan(runtimePlan);
    return { ok: true };
  }

  /**
   * Recomputes only the current deterministic timeline end.
   */
  private refreshTimelineEndFromMountedPlan(): PlayerCommandResult {
    const runtimePlan = this.createMountedRuntimePlan();
    if (runtimePlan === null) {
      return this.reject(
        "SCENE_STORY_NOT_FOUND",
        PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
        "player:refresh-timeline-end",
      );
    }

    this.syncHorizonFromRuntimePlan(runtimePlan);
    return { ok: true };
  }

  /**
   * Rebuilds one fresh scene runtime state for replay, optionally rescheduling initial eventimes.
   */
  private resetSceneForReplay(scheduleInitialStories: boolean): PlayerCommandResult {
    if (this.scene === null) {
      return this.reject(
        "PLAYER_NOT_INITIALIZED",
        "init must be called before replay reset",
        "player:reset-replay",
      );
    }

    void scheduleInitialStories;

    this.timelineMs = 0;
    this.playbackStartMs = null;
    this.sequenceEnded = false;
    this.nextPublicEventIndex = 0;
    this.playedEndMs = 0;
    this.mediaSync.resetPlayback();

    this.scene.tracks = consolidateSceneTracks(this.scene);
    this.trackManager.load({ tracks: this.scene.tracks });
    this.initializeSceneStories(this.scene);
    this.activateAllSceneStories();
    this.scene.init?.(this.scene, this.createLifecycleOptions());
    this.seedAllStoryEventimes();

    const runtimePlan = this.createMountedRuntimePlan();
    if (runtimePlan === null) {
      return this.reject(
        "SCENE_STORY_NOT_FOUND",
        PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
        "player:reset-replay",
      );
    }

    this.applyMountedRuntimePlan(runtimePlan);

    return { ok: true };
  }

  /**
   * Loads one mounted runtime plan into director state.
   */
  private applyMountedRuntimePlan(runtimePlan: ReturnType<PlayerRuntimePlanner["createRuntimePlan"]>): void {
    this.director.load(runtimePlan.timelinePlan);
    this.loadMediaRuntime(runtimePlan.runtimePersos);
    this.syncHorizonFromRuntimePlan(runtimePlan);
  }

  /**
   * Loads one mounted runtime perso graph into the renderer.
   */
  private loadMountedRuntimePersos(
    runtimePlan: ReturnType<PlayerRuntimePlanner["createRuntimePlan"]>,
  ): ReturnType<RendererFacade["load"]> {
    return this.renderer.load({ runtimePersos: runtimePlan.runtimePersos });
  }

  /**
   * Resolves one existing scene story from id or direct reference.
   */
  private resolveSceneStory(story: string | SceneStoryDoc): SceneStoryDoc | null {
    if (this.scene === null) {
      return null;
    }

    return this.runtimePlanner.resolveStory(this.scene, story);
  }

  /**
   * Resolves one target track id for anchored eventimes of a started story.
   */
  private resolveStoryTrackId(storyId: string): string {
    if (this.scene !== null) {
      const story = this.scene.stories[storyId];
      if (story?.trackId) {
        return story.trackId;
      }

      if (storyId in this.scene.tracks) {
        return storyId;
      }
    }

    return PLAYER_TRACK.global;
  }

  /**
   * Mounts one story into renderer/director without starting its portable eventimes.
   */
  private mountStory(story: string | SceneStoryDoc): void {
    const nextStory = this.resolveSceneStory(story);
    if (nextStory === null) {
      return;
    }

    if (this.mountedStoryIds.has(nextStory.id)) {
      return;
    }

    this.mountedStoryIds.add(nextStory.id);

    const runtimePlan = this.createMountedRuntimePlan();
    if (runtimePlan === null) {
      return;
    }

    this.applyMountedRuntimePlan(runtimePlan);

    const rendererLoadResult = this.loadMountedRuntimePersos(runtimePlan);
    if (!rendererLoadResult.ok) {
      this.emitTrace(PLAYER_TRACE_EVENT.mountFailed, RUNTIME_TRACE_STATUS.error, {
        storyId: nextStory.id,
        mountedStoryIds: this.getMountedStoryIds(),
        code: rendererLoadResult.error.code,
        message: rendererLoadResult.error.message,
      });
      return;
    }

    this.syncHorizonFromRuntimePlan(runtimePlan);
  }

  /**
   * Schedules one mounted story eventime tree once per player cycle.
   */
  private scheduleStoryEventimes(story: string | SceneStoryDoc): void {
    const nextStory = this.resolveSceneStory(story);
    if (nextStory === null) {
      return;
    }

    if (this.scheduledStoryIds.has(nextStory.id)) {
      return;
    }

    const storyStartTimelineMs = this.resolveCurrentTimelineMs();

    this.scheduledStoryIds.add(nextStory.id);

    if (Array.isArray(nextStory.eventimes) && nextStory.eventimes.length > 0) {
      this.trackManager.appendAnchoredEventimes({
        trackId: this.resolveStoryTrackId(nextStory.id),
        anchorMs: this.resolveCurrentTimelineMs(),
        storyId: nextStory.id,
        eventimes: nextStory.eventimes,
      });
    }

    this.syncMountedRuntimePlan();

    // During the first play bootstrap, zero-offset eventimes must be consumed by the
    // normal play path so visual playback starts from the visible frame 0.
    if (this.status === PLAYER_STATUS.playing || this.status === PLAYER_STATUS.paused) {
      void this.runDueTimelineEvents(storyStartTimelineMs);
    }
  }

  /**
   * Builds lifecycle runtime options exposed to scene hooks.
   */
  private createLifecycleOptions(): PlayerSceneLifecycleOptions {
    return createSceneLifecycleOptions({
      mount: (story) => {
        this.mountStory(story);
      },
      schedule: (story) => {
        this.scheduleStoryEventimes(story);
      },
    });
  }

  /**
   * Runs the scene-level sequence-end hook after implicit runtime cleanup.
   */
  private runSequenceEndHook(): void {
    if (this.scene === null) {
      return;
    }

    this.scene.onSequenceEnd?.(this.scene, this.createLifecycleOptions());
  }

  /**
   * Routes one due timeline event through the optional author-layer interceptor.
   */
  private async dispatchTimelineEvent(event: TimelineEvent): Promise<void> {
    if (this.onTimelineEvent && !this.isInternalRuntimeEvent(event)) {
      const result = await this.onTimelineEvent({
        id: event.id,
        name: event.name,
        ms: event.ms,
        payload: event.payload,
        scopeStoryId: event.scopeStoryId,
        source: event.source,
        trackId: event.trackId,
      });

      if (!result.ok) {
        this.emitTrace("player:event:route-failed", RUNTIME_TRACE_STATUS.rejected, {
          eventId: event.id,
          eventName: event.name,
          code: result.error.code,
          message: result.error.message,
        });
      }
      return;
    }

    this.runTimelineEvent(event);
  }

  /**
   * Applies all due timeline events synchronously when no author interceptor is active.
   */
  private runDueTimelineEventsSync(timelineMs: number): void {
    let guard = 0;
    while (guard < 1000) {
      guard += 1;
      const dueEvents = this.trackManager.collectDueEvents({ nowMs: timelineMs }).events;

      if (dueEvents.length === 0) {
        return;
      }

      for (const event of dueEvents) {
        this.runTimelineEvent(event);
      }
    }
  }

  /**
   * Locks the current sequence after one terminal sequence:end event.
   */
  private finalizeSequenceEnd(sequenceEndMs: number): void {
    this.sequenceEnded = true;
    this.timelineMs = Math.min(sequenceEndMs, this.seekEndMs);
    this.playbackStartMs = null;
    this.stopPlaybackLoop();
    this.director.pause();

    const rendererPauseResult =
      this.renderer.getState().status === "running" ?
        this.pauseRenderer("sequence-end")
      : { ok: true as const };

    if (!rendererPauseResult.ok) {
      this.emitTrace("player:sequence:end", RUNTIME_TRACE_STATUS.error, {
        timelineMs: this.timelineMs,
        code: rendererPauseResult.error.code,
        message: rendererPauseResult.error.message,
      });
      this.setStatus(PLAYER_STATUS.paused);
      return;
    }

    this.setStatus(PLAYER_STATUS.paused);
    this.mediaSync.handleSequenceEnd(this.timelineMs);
    this.runSequenceEndHook();
    this.emitTrace("player:sequence:end", RUNTIME_TRACE_STATUS.applied, {
      timelineMs: this.timelineMs,
    });
  }

  /**
   * Applies all timeline events due at or before the provided timeline cursor.
   */
  private async runDueTimelineEvents(timelineMs: number): Promise<void> {
    if (!this.onTimelineEvent) {
      this.runDueTimelineEventsSync(timelineMs);
      return;
    }

    let guard = 0;
    while (guard < 1000) {
      guard += 1;
      const dueEvents = this.trackManager.collectDueEvents({ nowMs: timelineMs }).events;
      if (dueEvents.length === 0) {
        return;
      }

      for (const event of dueEvents) {
        await this.dispatchTimelineEvent(event);
      }
    }
  }

  /**
   * Replays due events for seek while deferring terminal sequence:end activation.
   */
  private async replayDueTimelineEventsForSeek(
    timelineMs: number,
    eventMsByEventId: ReadonlyMap<string, number>,
    playedReplayEndMs: number,
  ): Promise<number | null> {
    this.timelineReplayInProgress = true;
    try {
      let guard = 0;
      while (guard < 1000) {
        guard += 1;
        const dueEvents = this.trackManager.collectDueEvents({ nowMs: timelineMs }).events;

        if (dueEvents.length === 0) {
          return null;
        }

        for (const event of dueEvents) {
          if (event.name === PLAYER_SEQUENCE_EVENT.sequenceEnd) {
            return event.ms;
          }

          if (
            !shouldReplayEventForSeek(
              event,
              playedReplayEndMs,
              this.trackManager.state.loadedTrackIds,
              (trackId) => this.trackManager.getTrackMeta(trackId),
            )
          ) {
            continue;
          }

          this.emitTrace(PLAYER_TRACE_EVENT.seekReplayEvent, RUNTIME_TRACE_STATUS.info, {
            eventId: event.id,
            eventName: event.name,
            eventMs: event.ms,
            trackId: event.trackId,
            authorInterceptorConfigured: this.onTimelineEvent !== undefined,
            dispatchedThroughAuthor: false,
          });

          this.renderer.syncAnimationsToTimeline(event.ms, eventMsByEventId);
          this.runTimelineEvent(event);
        }
      }
    } finally {
      this.timelineReplayInProgress = false;
      // Sync all animations created during replay to the target position before any async boundary,
      // preventing the browser from painting with `from` values still applied.
      this.renderer.syncAnimationsToTimeline(timelineMs, eventMsByEventId);
    }

    return null;
  }

  /**
   * Runs one frame tick when player is in playing state.
   */
  private runPlaybackTick(frameNowMs?: number): void {
    if (this.status !== PLAYER_STATUS.playing) {
      return;
    }

    if (!this.onTimelineEvent) {
      const timelineMs = this.resolveCurrentTimelineMs();
      this.timelineMs = timelineMs;
      this.runDueTimelineEventsSync(timelineMs);
      this.syncMediaTimeline(timelineMs);
      this.renderer.renderFrame(frameNowMs ?? this.runtimePlanner.resolveNowMs());
      this.completePlaybackIfReachedEnd();
      return;
    }

    this.playbackTickPromise = this.playbackTickPromise.then(async () => {
      if (this.status !== PLAYER_STATUS.playing) {
        return;
      }

      const timelineMs = this.resolveCurrentTimelineMs();
      this.timelineMs = timelineMs;
      await this.runDueTimelineEvents(timelineMs);
      this.syncMediaTimeline(timelineMs);
      this.renderer.renderFrame(frameNowMs ?? this.runtimePlanner.resolveNowMs());
      this.completePlaybackIfReachedEnd();
    });
  }

  /**
   * Stops frame playback when timeline reaches its deterministic end.
   */
  private completePlaybackIfReachedEnd(): void {
    if (this.status !== PLAYER_STATUS.playing) {
      return;
    }

    if (this.timelineMs < this.timelineEndMs) {
      return;
    }
  }

  /**
   * Starts frame-driven playback scheduling through the shared ticker.
   */
  private startPlaybackLoop(): void {
    if (this.ticker.isRunning()) {
      return;
    }

    this.ticker.start((tickPayload) => {
      this.runPlaybackTick(tickPayload.nowMs);
    });
  }

  /**
   * Builds one normalized timeline event from public event input.
   */
  private createTimelineEvent(input: PlayerPublicEventInput): TimelineEvent {
    const eventMs = input.ms ?? this.resolveCurrentTimelineMs();
    const eventId = input.id ?? `evt-public-${Math.round(eventMs)}-${this.nextPublicEventIndex}`;
    const scopeStoryId = input.cascade === true ? undefined : input.scopeStoryId;
    const trackId = input.trackId ?? this.resolveDefaultTrackId(scopeStoryId);

    const event: TimelineEvent = {
      id: eventId,
      ms: eventMs,
      name: input.name,
      payload: input.payload,
      scopeStoryId,
      index: this.nextPublicEventIndex,
      source: input.source ?? RUNTIME_EVENT_SOURCE.user,
      trackId,
    };

    this.nextPublicEventIndex += 1;
    return event;
  }

  /**
   * Executes one timeline event against runtime listeners and actions.
   */
  private runTimelineEvent(event: TimelineEvent): void {
    if (this.applyRuntimeStateUpdate(event)) {
      this.recordPlayedProgress(event);
      return;
    }

    if (this.handleTrackControlEvent(event)) {
      this.recordPlayedProgress(event);
      return;
    }

    const directorResult = this.director.runTimelineEvent(event);
    if (directorResult.commits.length === 0) {
      this.mediaSync.applyResolvedActions(event.ms, directorResult.resolvedActions);
      this.recordPlayedProgress(event);
      return;
    }

    let enqueuedCommitCount = 0;

    for (const commit of directorResult.commits) {
      const enqueueResult = this.renderer.enqueueCommit(commit);
      if (enqueueResult.ok) {
        enqueuedCommitCount += 1;
      }
    }

    const tickResult = this.renderer.tick(event.ms);
    this.mediaSync.applyResolvedActions(event.ms, directorResult.resolvedActions);
    this.emitTrace("player:event:applied", RUNTIME_TRACE_STATUS.applied, {
      eventId: event.id,
      eventName: event.name,
      enqueuedCommitCount,
      appliedCommitCount: tickResult.appliedCommitCount,
      appliedActionsCount: tickResult.appliedActionCount,
      animationAppliedCount: tickResult.animationAppliedCount,
      conflictCount: tickResult.conflictCount,
    });

    this.recordPlayedProgress(event);
    this.seekEndMs = this.resolveCurrentSeekEndMs();
  }

  /**
   * Initializes all scene stories before scene-level init logic runs.
   */
  private initializeSceneStories(scene: StrictSceneDoc): void {
    for (const story of Object.values(scene.stories)) {
      const baseState =
        typeof story.state === "object" && story.state !== null ? { ...story.state }
        : typeof story.initial === "object" && story.initial !== null ? { ...story.initial }
        : undefined;

      story.state = story.init?.(baseState) ?? baseState;
    }
  }

  /**
   * Initializes player runtime with one scene document.
   */
  async init(nextScene: PlayerSceneInput): Promise<PlayerCommandResult> {
    this.emitTrace(PLAYER_TRACE_EVENT.initStarted, RUNTIME_TRACE_STATUS.applied, {
      sceneId: nextScene.id,
    });

    this.resetRuntime();

    const runtimeScene = normalizeSceneDef(nextScene as any) as StrictSceneDoc;

    this.prepareSceneRuntime(runtimeScene);
    this.setStatus(PLAYER_STATUS.ready);

    const rendererState = this.renderer.getState();
    this.emitTrace(PLAYER_TRACE_EVENT.initDone, RUNTIME_TRACE_STATUS.applied, {
      sceneId: runtimeScene.id,
      mountedStoryCount: this.mountedStoryIds.size,
      initializedStoryCount: Object.keys(runtimeScene.stories).length,
      loadedTrackCount: this.trackManager.state.loadedTrackIds.length,
      activeTrackCount: this.trackManager.state.activeTrackIds.length,
      runtimeElementCount: rendererState.runtimeElementCount,
      runtimeRevision: rendererState.runtimeRevision,
    });

    return { ok: true };
  }

  /**
   * Applies one scene document to runtime state before the player becomes ready.
   */
  private prepareSceneRuntime(runtimeScene: StrictSceneDoc): void {
    this.scene = runtimeScene;
    this.timelineMs = 0;
    this.playbackStartMs = null;
    this.sequenceEnded = false;
    this.nextPublicEventIndex = 0;
    runtimeScene.tracks = consolidateSceneTracks(runtimeScene);
    this.trackManager.load({ tracks: runtimeScene.tracks });

    this.initializeSceneStories(runtimeScene);
    this.activateAllSceneStories();
    runtimeScene.init?.(runtimeScene, this.createLifecycleOptions());
    this.seedAllStoryEventimes();

    const runtimePlan = this.createMountedRuntimePlan();
    if (runtimePlan !== null) {
      this.applyMountedRuntimePlan(runtimePlan);
      const rendererLoadResult = this.loadMountedRuntimePersos(runtimePlan);
      if (!rendererLoadResult.ok) {
        this.emitTrace(PLAYER_TRACE_EVENT.mountFailed, RUNTIME_TRACE_STATUS.error, {
          storyId: runtimeScene.id,
          mountedStoryIds: this.getMountedStoryIds(),
          code: rendererLoadResult.error.code,
          message: rendererLoadResult.error.message,
        });
      } else {
        this.syncHorizonFromRuntimePlan(runtimePlan);
      }
    }
  }

  /**
   * Destroys player runtime resources and returns to idle state.
   */
  async destroy(): Promise<PlayerCommandResult> {
    this.emitTrace("player:destroy:started", RUNTIME_TRACE_STATUS.applied);

    this.resetRuntime();
    this.setStatus(PLAYER_STATUS.idle);

    const rendererState = this.renderer.getState();
    this.emitTrace("player:destroy:done", RUNTIME_TRACE_STATUS.applied, {
      runtimeRevision: rendererState.runtimeRevision,
    });

    return { ok: true };
  }

  /**
   * Starts playback when player is ready or paused.
   */
  async play(): Promise<PlayerCommandResult> {
    if (!this.isInitialized() || this.scene === null) {
      return this.reject("PLAYER_NOT_INITIALIZED", "init must be called before play", "player:play");
    }

    if (this.sequenceEnded) {
      const resetResult = this.resetSceneForReplay(false);
      if (!resetResult.ok) {
        return resetResult;
      }

      const runtimePlan = this.createMountedRuntimePlan();
      if (runtimePlan === null) {
        return this.reject(
          "SCENE_STORY_NOT_FOUND",
          PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
          "player:play",
        );
      }

      this.applyMountedRuntimePlan(runtimePlan);

      const rendererLoadResult = this.loadMountedRuntimePersos(runtimePlan);
      if (!rendererLoadResult.ok) {
        return this.reject(
          "RENDERER_LOAD_FAILED",
          "Renderer failed to restart scene after sequence:end",
          "player:play",
          {
            sceneId: this.scene.id,
            code: rendererLoadResult.error.code,
          },
        );
      }

      this.syncHorizonFromRuntimePlan(runtimePlan);

      this.timelineMs = 0;
      this.playbackStartMs = null;
      this.setStatus(PLAYER_STATUS.ready);
    }

    if (this.status !== PLAYER_STATUS.ready && this.status !== PLAYER_STATUS.paused) {
      return this.reject("INVALID_PLAYER_STATE", "play is only allowed from ready or paused", "player:play", {
        currentState: this.status,
      });
    }

    if (this.status === PLAYER_STATUS.ready) {
      this.scene.onStart?.(this.scene, this.createLifecycleOptions());
      if (this.mountedStoryIds.size === 0) {
        return this.reject(
          "SCENE_STORY_NOT_FOUND",
          PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
          "player:play",
        );
      }

      const syncResult = this.syncMountedRuntimePlan();
      if (!syncResult.ok) {
        return syncResult;
      }

      this.director.start();
    } else {
      this.director.resume();
    }

    const rendererResult =
      this.status === PLAYER_STATUS.ready ? this.startRenderer("play") : this.resumeRenderer("play");
    if (!rendererResult.ok) {
      return this.reject("RENDERER_INVALID_STATE", "Renderer rejected play transition", "player:play", {
        currentState: this.status,
        code: rendererResult.error.code,
      });
    }

    this.playbackStartMs = this.runtimePlanner.resolveNowMs() - this.timelineMs;
    this.setStatus(PLAYER_STATUS.playing);
    const currentTimelineMs = this.resolveCurrentTimelineMs();
    this.timelineMs = currentTimelineMs;
    await this.runDueTimelineEvents(currentTimelineMs);
    this.renderer.renderFrame(this.runtimePlanner.resolveNowMs());
    this.syncMediaTimeline(currentTimelineMs);
    this.completePlaybackIfReachedEnd();
    if (this.playbackStartMs !== null) {
      this.startPlaybackLoop();
    }
    this.emitTrace("player:play", RUNTIME_TRACE_STATUS.applied, {
      startTimelineMs: this.timelineMs,
    });
    return { ok: true };
  }

  /**
   * Pauses playback when player is currently playing.
   */
  async pause(): Promise<PlayerCommandResult> {
    if (!this.isInitialized()) {
      return this.reject("PLAYER_NOT_INITIALIZED", "init must be called before pause", "player:pause");
    }

    if (this.sequenceEnded) {
      return this.reject("PLAYER_SEQUENCE_ENDED", "pause is not allowed after sequence:end", "player:pause");
    }

    if (this.status !== PLAYER_STATUS.playing) {
      return this.reject("INVALID_PLAYER_STATE", "pause is only allowed from playing", "player:pause", {
        currentState: this.status,
      });
    }

    this.director.pause();

    const rendererResult = this.pauseRenderer("pause-command");
    if (!rendererResult.ok) {
      return this.reject("RENDERER_INVALID_STATE", "Renderer rejected pause transition", "player:pause", {
        currentState: this.status,
        code: rendererResult.error.code,
      });
    }

    this.timelineMs = this.resolveCurrentTimelineMs();
    this.playbackStartMs = null;
    this.stopPlaybackLoop();
    this.setStatus(PLAYER_STATUS.paused);
    this.syncMediaTimeline(this.timelineMs);
    this.emitTrace("player:pause", RUNTIME_TRACE_STATUS.applied);
    return { ok: true };
  }

  /**
   * Injects one public event into runtime processing.
   */
  async emit(event: PlayerPublicEventInput): Promise<PlayerCommandResult> {
    if (!this.isInitialized()) {
      return this.reject("PLAYER_NOT_INITIALIZED", "init must be called before emit", "player:emit");
    }

    if (this.sequenceEnded) {
      return this.reject("PLAYER_SEQUENCE_ENDED", "emit is not allowed after sequence:end", "player:emit");
    }

    if (event.mode === "persist-only") {
      return this.persistTrackEvent(event);
    }

    const eventSource = event.source ?? RUNTIME_EVENT_SOURCE.user;
    if (
      eventSource === RUNTIME_EVENT_SOURCE.user &&
      (this.status === PLAYER_STATUS.paused || this.status === PLAYER_STATUS.seeking)
    ) {
      return this.reject(
        "PLAYER_USER_EVENTS_PAUSED",
        "user events are disabled while player is paused or seeking",
        "player:emit",
        {
          eventName: event.name,
        },
      );
    }

    const timelineEvent = this.createTimelineEvent(event);
    const shouldPersistEvent =
      timelineEvent.source === RUNTIME_EVENT_SOURCE.user ||
      (timelineEvent.source === RUNTIME_EVENT_SOURCE.system &&
        timelineEvent.name !== "scene:ready" &&
        timelineEvent.name !== "scene:start" &&
        timelineEvent.name !== "scene:end");
    const previousTimelineEndMs = this.timelineEndMs;

    if (shouldPersistEvent) {
      const appendResult = this.trackManager.appendLiveEvents({
        trackId: timelineEvent.trackId ?? PLAYER_TRACK.global,
        events: [timelineEvent],
      });
      if (!appendResult.ok) {
        return this.reject(appendResult.error.code, appendResult.error.message, "player:emit", {
          eventName: timelineEvent.name,
          trackId: timelineEvent.trackId,
          details: appendResult.error.details,
        });
      }
    }

    const currentMs = this.resolveCurrentTimelineMs();
    const isFutureEvent = timelineEvent.ms > currentMs;
    const isRetroactiveEvent = timelineEvent.ms < currentMs;
    if (!isFutureEvent) {
      this.runTimelineEvent(timelineEvent);
    }

    if (shouldPersistEvent) {
      if (!isFutureEvent) {
        this.trackManager.syncCursor({ nowMs: isRetroactiveEvent ? currentMs : timelineEvent.ms });
      } else if (!this.timelineReplayInProgress) {
        this.recordPlayedProgress(timelineEvent);
      }
      const refreshResult = this.refreshTimelineEndFromMountedPlan();
      if (!refreshResult.ok) {
        return refreshResult;
      }
    }

    if (
      !isFutureEvent &&
      !this.timelineReplayInProgress &&
      (this.status !== PLAYER_STATUS.playing || this.playbackStartMs === null)
    ) {
      const runtimePlan = this.createMountedRuntimePlan();
      if (runtimePlan !== null) {
        const eventDurationMs = this.runtimePlanner.resolveEventDurationMsFromTimelinePlan(
          runtimePlan.timelinePlan,
          timelineEvent.name,
        );
        this.renderer.syncAnimationsToTimeline(
          timelineEvent.ms + eventDurationMs,
          new Map([[timelineEvent.id, timelineEvent.ms]]),
        );
      }

      this.renderer.renderFrame(this.runtimePlanner.resolveNowMs());
    }

    if (!isFutureEvent) {
      this.syncMediaTimeline(timelineEvent.ms);
    }

    if (
      !this.timelineReplayInProgress &&
      (!shouldPersistEvent ||
        this.timelineEndMs !== previousTimelineEndMs ||
        this.status !== PLAYER_STATUS.playing ||
        this.playbackStartMs === null)
    ) {
      this.emitStateSnapshot();
    }

    if (
      !isFutureEvent &&
      timelineEvent.name === PLAYER_SEQUENCE_EVENT.sequenceEnd &&
      this.status === PLAYER_STATUS.playing
    ) {
      this.finalizeSequenceEnd(timelineEvent.ms);
    }

    this.emitTrace("player:emit", RUNTIME_TRACE_STATUS.applied, {
      eventId: timelineEvent.id,
      eventName: timelineEvent.name,
      eventMs: timelineEvent.ms,
      trackId: timelineEvent.trackId,
      payload: timelineEvent.payload,
      source: timelineEvent.source,
      cascade: event.cascade,
    });

    return { ok: true };
  }

  /**
   * Applies one event already materialized in tracks without persisting it again.
   */
  async applyMaterializedEvent(event: PlayerPublicEventInput): Promise<PlayerCommandResult> {
    if (!this.isInitialized()) {
      return this.reject(
        "PLAYER_NOT_INITIALIZED",
        "init must be called before applyMaterializedEvent",
        "player:apply-materialized-event",
      );
    }

    const timelineEvent = this.createTimelineEvent(event);

    this.runTimelineEvent(timelineEvent);

    if (
      !this.timelineReplayInProgress &&
      (this.status !== PLAYER_STATUS.playing || this.playbackStartMs === null)
    ) {
      const runtimePlan = this.createMountedRuntimePlan();
      if (runtimePlan !== null) {
        const eventDurationMs = this.runtimePlanner.resolveEventDurationMsFromTimelinePlan(
          runtimePlan.timelinePlan,
          timelineEvent.name,
        );
        this.renderer.syncAnimationsToTimeline(
          timelineEvent.ms + eventDurationMs,
          new Map([[timelineEvent.id, timelineEvent.ms]]),
        );
      }

      this.renderer.renderFrame(this.runtimePlanner.resolveNowMs());
    }

    this.syncMediaTimeline(timelineEvent.ms);

    if (
      !this.timelineReplayInProgress &&
      (this.status !== PLAYER_STATUS.playing || this.playbackStartMs === null)
    ) {
      this.emitStateSnapshot();
    }

    if (timelineEvent.name === PLAYER_SEQUENCE_EVENT.sequenceEnd && this.status === PLAYER_STATUS.playing) {
      this.finalizeSequenceEnd(timelineEvent.ms);
    }

    this.emitTrace("player:apply-materialized-event", RUNTIME_TRACE_STATUS.applied, {
      eventId: timelineEvent.id,
      eventName: timelineEvent.name,
      eventMs: timelineEvent.ms,
      trackId: timelineEvent.trackId,
      payload: timelineEvent.payload,
      source: timelineEvent.source,
      cascade: event.cascade,
    });

    return { ok: true };
  }

  /**
   * Seeks timeline to target position without forcing autoplay.
   */
  async seek(targetTimelineMs: number): Promise<PlayerCommandResult> {
    if (!this.isInitialized() || this.scene === null) {
      return this.reject("PLAYER_NOT_INITIALIZED", "init must be called before seek", "player:seek");
    }

    if (this.sequenceEnded) {
      return this.reject("PLAYER_SEQUENCE_ENDED", "seek is not allowed after sequence:end", "player:seek");
    }

    if (
      this.status !== PLAYER_STATUS.ready &&
      this.status !== PLAYER_STATUS.paused &&
      this.status !== PLAYER_STATUS.playing
    ) {
      return this.reject(
        "INVALID_PLAYER_STATE",
        "seek is only allowed from ready, paused, or playing",
        "player:seek",
        {
          currentState: this.status,
        },
      );
    }

    if (this.mountedStoryIds.size === 0) {
      return this.reject(
        "SCENE_STORY_NOT_FOUND",
        PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
        "player:seek",
      );
    }

    if (this.runtimePolicy.seekPolicy === "disabled") {
      return this.reject("HOST_INVALID_PLAYER_STATE", "seek is disabled by policy", "player:seek", {
        currentState: this.status,
      });
    }

    this.setStatus(PLAYER_STATUS.seeking);
    this.emitTrace("player:seek:started", RUNTIME_TRACE_STATUS.applied, {
      targetTimelineMs,
    });

    this.mediaSync.pauseActivePlayback(this.resolveCurrentTimelineMs());
    this.playbackStartMs = null;
    this.stopPlaybackLoop();

    const runtimePlan = this.createMountedRuntimePlan();
    if (runtimePlan === null) {
      return this.reject(
        "SCENE_STORY_NOT_FOUND",
        PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
        "player:seek:failed",
        {
          sceneId: this.scene.id,
          targetTimelineMs,
        },
      );
    }

    this.applyMountedRuntimePlan(runtimePlan);

    const rendererLoadResult = this.loadMountedRuntimePersos(runtimePlan);
    if (!rendererLoadResult.ok) {
      return this.reject("RENDERER_LOAD_FAILED", "Renderer failed to seek story", "player:seek:failed", {
        sceneId: this.scene.id,
        targetTimelineMs,
        code: rendererLoadResult.error.code,
      });
    }

    this.syncHorizonFromRuntimePlan(runtimePlan);

    const boundedTargetTimelineMs = this.runtimePlanner.clampTimelineMs(targetTimelineMs);

    this.emitStateSnapshot();

    this.timelineMs = Math.min(boundedTargetTimelineMs, this.resolveCurrentSeekEndMs());

    this.director.start();
    const rendererStartResult = this.startRenderer("seek-replay");
    if (!rendererStartResult.ok) {
      return this.reject(
        "RENDERER_INVALID_STATE",
        "Renderer could not start for seek replay",
        "player:seek:failed",
        {
          sceneId: this.scene.id,
          targetTimelineMs,
          code: rendererStartResult.error.code,
        },
      );
    }

    const eventMsByEventId = new Map<string, number>(
      this.trackManager.getAllEvents().map((event) => [event.id, event.ms]),
    );
    const playedReplayEndMs = this.playedEndMs;

    this.trackManager.resetActiveTracks();
    this.trackManager.resetCursor();
    const deferredSequenceEndMs = await this.replayDueTimelineEventsForSeek(
      this.timelineMs,
      eventMsByEventId,
      playedReplayEndMs,
    );
    if (deferredSequenceEndMs !== null) {
      this.timelineMs = Math.min(this.timelineMs, Math.max(0, deferredSequenceEndMs - 1));
    }

    this.trackManager.syncCursor({ nowMs: this.timelineMs });
    this.renderer.syncAnimationsToTimeline(this.timelineMs, eventMsByEventId);
    this.syncMediaTimeline(this.timelineMs);

    if (!this.sequenceEnded) {
      this.director.pause();
      const rendererPauseResult =
        this.renderer.getState().status === "running" ?
          this.pauseRenderer("seek-replay")
        : { ok: true as const };
      if (!rendererPauseResult.ok) {
        return this.reject(
          "RENDERER_INVALID_STATE",
          "Renderer could not pause after seek replay",
          "player:seek:failed",
          {
            sceneId: this.scene.id,
            targetTimelineMs,
            code: rendererPauseResult.error.code,
          },
        );
      }
    }

    this.setStatus(PLAYER_STATUS.paused);
    this.emitTrace("player:seek:done", RUNTIME_TRACE_STATUS.applied, {
      targetTimelineMs: this.timelineMs,
    });

    return { ok: true };
  }

  /**
   * Rewinds timeline to zero while preserving playback intent.
   */
  async rewind(): Promise<PlayerCommandResult> {
    if (!this.isInitialized() || this.scene === null) {
      return this.reject("PLAYER_NOT_INITIALIZED", "init must be called before rewind", "player:rewind");
    }

    if (this.sequenceEnded) {
      return this.reject(
        "PLAYER_SEQUENCE_ENDED",
        "rewind is not allowed after sequence:end",
        "player:rewind",
      );
    }

    if (
      this.status !== PLAYER_STATUS.ready &&
      this.status !== PLAYER_STATUS.paused &&
      this.status !== PLAYER_STATUS.playing
    ) {
      return this.reject(
        "INVALID_PLAYER_STATE",
        "rewind is only allowed from ready, paused, or playing",
        "player:rewind",
        {
          currentState: this.status,
        },
      );
    }

    if (this.mountedStoryIds.size === 0) {
      return this.reject(
        "SCENE_STORY_NOT_FOUND",
        PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
        "player:rewind",
      );
    }

    const previousStatus = this.status;
    this.setStatus(PLAYER_STATUS.rewinding);
    this.emitTrace("player:rewind:started", RUNTIME_TRACE_STATUS.applied);

    this.stopPlaybackLoop();

    const resetResult = this.resetSceneForReplay(
      previousStatus === PLAYER_STATUS.playing || previousStatus === PLAYER_STATUS.paused,
    );
    if (!resetResult.ok) {
      return resetResult;
    }

    const runtimePlan = this.createMountedRuntimePlan();
    if (runtimePlan === null) {
      return this.reject(
        "SCENE_STORY_NOT_FOUND",
        PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
        "player:rewind:failed",
      );
    }

    this.applyMountedRuntimePlan(runtimePlan);

    const rendererLoadResult = this.loadMountedRuntimePersos(runtimePlan);
    if (!rendererLoadResult.ok) {
      return this.reject("RENDERER_LOAD_FAILED", "Renderer failed to rewind story", "player:rewind:failed", {
        sceneId: this.scene.id,
        code: rendererLoadResult.error.code,
      });
    }

    if (previousStatus === PLAYER_STATUS.playing || previousStatus === PLAYER_STATUS.paused) {
      this.director.start();

      const rendererStartResult = this.startRenderer("rewind-restore");
      if (!rendererStartResult.ok) {
        return this.reject(
          "RENDERER_INVALID_STATE",
          "Renderer could not restore state after rewind",
          "player:rewind:failed",
          {
            sceneId: this.scene.id,
            code: rendererStartResult.error.code,
            previousStatus,
          },
        );
      }

      if (previousStatus === PLAYER_STATUS.paused) {
        this.director.pause();

        const rendererPauseResult = this.pauseRenderer("rewind-restore");
        if (!rendererPauseResult.ok) {
          return this.reject(
            "RENDERER_INVALID_STATE",
            "Renderer could not restore paused state after rewind",
            "player:rewind:failed",
            {
              sceneId: this.scene.id,
              code: rendererPauseResult.error.code,
            },
          );
        }
      }
    }

    this.trackManager.syncCursor({ nowMs: this.timelineMs });

    if (previousStatus === PLAYER_STATUS.playing) {
      this.playbackStartMs = this.runtimePlanner.resolveNowMs();
      await this.runDueTimelineEvents(this.timelineMs);
      this.startPlaybackLoop();
    }

    this.setStatus(previousStatus);
    this.syncMediaTimeline(this.timelineMs);
    const rendererState = this.renderer.getState();
    this.emitTrace("player:rewind:done", RUNTIME_TRACE_STATUS.applied, {
      targetTimelineMs: 0,
      runtimeRevision: rendererState.runtimeRevision,
    });

    return { ok: true };
  }

  /**
   * Rebuilds runtime according to runtime policy constraints.
   */
  async rebuild(mode: RebuildMode = "state"): Promise<PlayerCommandResult> {
    if (!this.isInitialized() || this.scene === null || this.mountedStoryIds.size === 0) {
      return this.reject("PLAYER_NOT_INITIALIZED", "init must be called before rebuild", "player:rebuild");
    }

    if (this.sequenceEnded) {
      return this.reject(
        "PLAYER_SEQUENCE_ENDED",
        "rebuild is not allowed after sequence:end",
        "player:rebuild",
      );
    }

    if (!this.runtimePolicy.allowedRebuildModes.includes(mode)) {
      return this.reject(
        "MODE_NOT_ALLOWED_BY_POLICY",
        "Requested rebuild mode is not allowed by policy",
        "player:rebuild",
        {
          mode,
          allowedModes: this.runtimePolicy.allowedRebuildModes,
        },
      );
    }

    const previousStatus = this.status;
    this.setStatus(PLAYER_STATUS.seeking);
    this.emitTrace("player:rebuild:started", RUNTIME_TRACE_STATUS.applied, {
      mode,
    });

    this.mediaSync.pauseActivePlayback(this.resolveCurrentTimelineMs());

    if (mode === "full") {
      const runtimePlan = this.createMountedRuntimePlan();
      if (runtimePlan === null) {
        return this.reject(
          "SCENE_STORY_NOT_FOUND",
          PLAYER_RUNTIME_ERROR_MESSAGE.mountedStoryRequired,
          "player:rebuild:failed",
          {
            sceneId: this.scene.id,
            mode,
          },
        );
      }

      this.applyMountedRuntimePlan(runtimePlan);

      const rendererLoadResult = this.loadMountedRuntimePersos(runtimePlan);
      if (!rendererLoadResult.ok) {
        return this.reject(
          "RENDERER_LOAD_FAILED",
          "Renderer failed to rebuild story",
          "player:rebuild:failed",
          {
            sceneId: this.scene.id,
            mode,
            code: rendererLoadResult.error.code,
          },
        );
      }

      this.syncHorizonFromRuntimePlan(runtimePlan);

      if (previousStatus === PLAYER_STATUS.playing || previousStatus === PLAYER_STATUS.paused) {
        this.director.start();

        const rendererStartResult = this.startRenderer("rebuild-restore");
        if (!rendererStartResult.ok) {
          return this.reject(
            "RENDERER_INVALID_STATE",
            "Renderer could not resume after full rebuild",
            "player:rebuild:failed",
            {
              sceneId: this.scene.id,
              mode,
              code: rendererStartResult.error.code,
            },
          );
        }

        if (previousStatus === PLAYER_STATUS.paused) {
          this.director.pause();

          const rendererPauseResult = this.pauseRenderer("rebuild-restore");
          if (!rendererPauseResult.ok) {
            return this.reject(
              "RENDERER_INVALID_STATE",
              "Renderer could not restore paused state after full rebuild",
              "player:rebuild:failed",
              {
                sceneId: this.scene.id,
                mode,
                code: rendererPauseResult.error.code,
              },
            );
          }
        }

        if (previousStatus === PLAYER_STATUS.playing) {
          await this.runDueTimelineEvents(this.timelineMs);
          this.startPlaybackLoop();
        }
      }
    }

    this.trackManager.syncCursor({ nowMs: this.timelineMs });
    this.setStatus(previousStatus);
    this.syncMediaTimeline(this.timelineMs);
    const rendererState = this.renderer.getState();

    this.emitTrace("player:rebuild:done", RUNTIME_TRACE_STATUS.applied, {
      mode,
      runtimeRevision: rendererState.runtimeRevision,
    });

    return { ok: true };
  }

  /**
   * Returns one immutable snapshot of current player state.
   */
  getState(): PlayerStateSnapshot {
    const rendererState = this.renderer.getState();

    return {
      status: this.status,
      initialized: this.isInitialized(),
      sequenceEnded: this.sequenceEnded,
      sceneId: this.scene?.id,
      timelineMs: this.resolveCurrentTimelineMs(),
      horizon: {
        playedEndMs: this.playedEndMs,
        projectedMasterEndMs: this.projectedMasterEndMs,
        authorEndMs: this.authorEndMs,
        progressEndMs: this.timelineEndMs,
        seekEndMs: this.resolveCurrentSeekEndMs(),
      },
      runtimeRevision: rendererState.runtimeRevision,
    };
  }

  /**
   * Updates internal player status and notifies state subscribers.
   */
  private setStatus(nextStatus: PlayerStatus): void {
    if (this.status === nextStatus) {
      return;
    }

    this.status = nextStatus;
    this.emitStateSnapshot();
  }

  /**
   * Emits one state snapshot to all state subscribers.
   */
  private emitStateSnapshot(): void {
    const snapshot = this.getState();
    for (const listener of this.stateListeners) {
      listener(snapshot);
    }
  }

  /**
   * Emits one runtime trace row and forwards it to trace subscribers.
   */
  private emitTrace(
    eventName: string,
    statusValue: RuntimeTraceStatus,
    payload?: Record<string, unknown>,
  ): RuntimeTraceRow {
    const row = this.traceStore.append({
      scope: "player",
      eventName,
      status: statusValue,
      payload,
    });

    for (const listener of this.traceListeners) {
      listener(row);
    }

    return row;
  }

  /**
   * Builds one rejected command result and emits associated trace.
   */
  private reject(
    code: string,
    message: string,
    eventName: string,
    details?: Record<string, unknown>,
  ): PlayerCommandResult {
    this.emitTrace(eventName, RUNTIME_TRACE_STATUS.rejected, {
      code,
      message,
      ...details,
    });

    return {
      ok: false,
      error: {
        code,
        message,
        details,
      },
    };
  }

  /**
   * Subscribes to trace rows emitted by player commands.
   */
  onTrace(listener: PlayerTraceListener): () => void {
    this.traceListeners.add(listener);
    return () => {
      this.traceListeners.delete(listener);
    };
  }

  /**
   * Subscribes to player state changes.
   */
  onStateChange(listener: PlayerStateListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }
}
