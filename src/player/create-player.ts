import type { AnimationAdapter } from "../animation/types";
import type { TimelineEvent } from "../core/events/types";
import { TimeTicker } from "../core/time/ticker";
import { DirectorCore } from "../director/create-director";
import { RendererFacade } from "../renderer/create-renderer";
import {
  createRuntimeTraceStore,
  type RuntimeTraceRow,
  type RuntimeTraceStatus,
} from "../runtime/trace-store";
import type { CreateElementOptions } from "../runtime/create-element";
import { PlayerRuntimePlanner } from "./create-player-utils";
import type {
  PlayerApi,
  PlayerCommandResult,
  PlayerPublicEventInput,
  PlayerRuntimePolicy,
  PlayerStateListener,
  PlayerStateSnapshot,
  PlayerStatus,
  PlayerTraceListener,
  RebuildMode,
  SceneDoc,
} from "./types";

export type CreatePlayerOptions = {
  runtimePolicy?: Partial<PlayerRuntimePolicy>;
  createElementOptions?: CreateElementOptions;
  animationAdapter?: AnimationAdapter;
};

const DEFAULT_RUNTIME_POLICY: PlayerRuntimePolicy = {
  allowedRebuildModes: ["state", "full"],
};

const NOOP_ANIMATION_ADAPTER: AnimationAdapter = {
  run: () => [],
  stop: () => {
    return;
  },
};

/**
 * Implements one player facade with lifecycle commands and subscriptions.
 */
export class PlayerFacade implements PlayerApi {
  private readonly runtimePolicy: PlayerRuntimePolicy;
  private readonly runtimePlanner = new PlayerRuntimePlanner();
  private readonly director = new DirectorCore();
  private readonly renderer: RendererFacade;

  private status: PlayerStatus = "idle";
  private scene: SceneDoc | null = null;
  private timelineMs = 0;
  private playbackStartMs: number | null = null;
  private readonly ticker = new TimeTicker();
  private nextScheduledEventIndex = 0;
  private nextPublicEventIndex = 0;

  private readonly traceStore = createRuntimeTraceStore({ maxEntries: 2000 });
  private readonly traceListeners = new Set<PlayerTraceListener>();
  private readonly stateListeners = new Set<PlayerStateListener>();

  /**
   * Configures one player facade from explicit options.
   */
  constructor(options: CreatePlayerOptions = {}) {
    this.runtimePolicy = {
      allowedRebuildModes:
        options.runtimePolicy?.allowedRebuildModes ?? DEFAULT_RUNTIME_POLICY.allowedRebuildModes,
    };

    const animationAdapter = options.animationAdapter ?? NOOP_ANIMATION_ADAPTER;
    this.renderer = new RendererFacade({
      animationAdapter,
      createElementOptions: options.createElementOptions,
    });

    this.renderer.onError((error) => {
      this.emitTrace("renderer:error", "error", {
        code: error.code,
        message: error.message,
        ...(error.details ?? {}),
      });
    });
  }

  /**
   * Resolves current timeline cursor using playback clock when active.
   */
  private resolveCurrentTimelineMs(): number {
    if (this.playbackStartMs === null) {
      return this.timelineMs;
    }

    return this.runtimePlanner.clampTimelineMs(this.runtimePlanner.resolveNowMs() - this.playbackStartMs);
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
    this.renderer.destroy();
    this.scene = null;
    this.timelineMs = 0;
    this.playbackStartMs = null;
    this.nextScheduledEventIndex = 0;
    this.nextPublicEventIndex = 0;
  }

  /**
   * Recomputes the next timeline event cursor from one timeline position.
   */
  private syncNextScheduledEventIndex(timelineMs: number): void {
    const sortedEvents = this.director.getSortedEvents();
    let nextIndex = 0;

    while (nextIndex < sortedEvents.length && sortedEvents[nextIndex].ms < timelineMs) {
      nextIndex += 1;
    }

    this.nextScheduledEventIndex = nextIndex;
  }

  /**
   * Applies all timeline events due at or before the provided timeline cursor.
   */
  private runDueTimelineEvents(timelineMs: number): void {
    const sortedEvents = this.director.getSortedEvents();

    while (this.nextScheduledEventIndex < sortedEvents.length) {
      const event = sortedEvents[this.nextScheduledEventIndex];
      if (event.ms > timelineMs) {
        break;
      }

      this.runTimelineEvent(event);
      this.nextScheduledEventIndex += 1;
    }
  }

  /**
   * Runs one frame tick when player is in playing state.
   */
  private runPlaybackTick(): void {
    if (this.status !== "playing") {
      return;
    }

    const timelineMs = this.resolveCurrentTimelineMs();
    this.timelineMs = timelineMs;
    this.runDueTimelineEvents(timelineMs);
  }

  /**
   * Starts frame-driven playback scheduling through the shared ticker.
   */
  private startPlaybackLoop(): void {
    if (this.ticker.isRunning()) {
      return;
    }

    this.ticker.start(() => {
      this.runPlaybackTick();
    });
  }

  /**
   * Builds one normalized timeline event from public event input.
   */
  private createTimelineEvent(input: PlayerPublicEventInput): TimelineEvent {
    const eventMs = input.ms ?? this.resolveCurrentTimelineMs();
    const eventId = input.id ?? `evt-public-${Math.round(eventMs)}-${this.nextPublicEventIndex}`;

    const event: TimelineEvent = {
      id: eventId,
      ms: eventMs,
      name: input.name,
      payload: input.payload,
      index: this.nextPublicEventIndex,
      source: input.source ?? "user",
      trackId: input.trackId,
    };

    this.nextPublicEventIndex += 1;
    return event;
  }

  /**
   * Executes one timeline event against runtime listeners and actions.
   */
  private runTimelineEvent(event: TimelineEvent): void {
    const directorResult = this.director.runTimelineEvent(event);
    if (directorResult.commits.length === 0) {
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
    this.emitTrace("player:event:applied", "applied", {
      eventId: event.id,
      eventName: event.name,
      enqueuedCommitCount,
      appliedCommitCount: tickResult.appliedCommitCount,
      appliedActionsCount: tickResult.appliedActionCount,
      animationAppliedCount: tickResult.animationAppliedCount,
      conflictCount: tickResult.conflictCount,
    });
  }

  /**
   * Initializes player runtime with one scene document.
   */
  async init(nextScene: SceneDoc): Promise<PlayerCommandResult> {
    this.emitTrace("player:init:started", "applied", {
      sceneId: nextScene.id,
    });

    const nextActiveStory = this.runtimePlanner.resolveActiveStory(nextScene);
    if (nextActiveStory === null) {
      return this.reject(
        "SCENE_STORY_NOT_FOUND",
        "Scene must provide at least one story",
        "player:init:failed",
        {
          sceneId: nextScene.id,
        },
      );
    }

    this.scene = nextScene;
    this.timelineMs = 0;
    this.playbackStartMs = null;
    this.nextPublicEventIndex = 0;
    const runtimePlan = this.runtimePlanner.createRuntimePlan(nextScene, nextActiveStory);
    this.director.load(runtimePlan);
    this.syncNextScheduledEventIndex(this.timelineMs);

    const rendererLoadResult = this.renderer.load({ story: runtimePlan.story });
    if (!rendererLoadResult.ok) {
      return this.reject("RENDERER_LOAD_FAILED", "Renderer failed to load story", "player:init:failed", {
        sceneId: nextScene.id,
        code: rendererLoadResult.error.code,
      });
    }

    this.setStatus("ready");

    const rendererState = this.renderer.getState();

    this.emitTrace("player:init:done", "applied", {
      sceneId: nextScene.id,
      activeStoryId: runtimePlan.story.id,
      runtimeElementCount: rendererState.runtimeElementCount,
      runtimeRevision: rendererState.runtimeRevision,
    });

    return { ok: true };
  }

  /**
   * Destroys player runtime resources and returns to idle state.
   */
  async destroy(): Promise<PlayerCommandResult> {
    this.emitTrace("player:destroy:started", "applied");

    this.resetRuntime();
    this.setStatus("idle");

    const rendererState = this.renderer.getState();

    this.emitTrace("player:destroy:done", "applied", {
      runtimeRevision: rendererState.runtimeRevision,
    });

    return { ok: true };
  }

  /**
   * Starts playback when player is ready or paused.
   */
  async play(): Promise<PlayerCommandResult> {
    if (!this.isInitialized()) {
      return this.reject("PLAYER_NOT_INITIALIZED", "init must be called before play", "player:play");
    }

    if (this.status !== "ready" && this.status !== "paused") {
      return this.reject("INVALID_PLAYER_STATE", "play is only allowed from ready or paused", "player:play", {
        currentState: this.status,
      });
    }

    if (this.status === "ready") {
      this.director.start();
    } else {
      this.director.resume();
    }

    const rendererResult = this.status === "ready" ? this.renderer.start() : this.renderer.resume();
    if (!rendererResult.ok) {
      return this.reject("RENDERER_INVALID_STATE", "Renderer rejected play transition", "player:play", {
        currentState: this.status,
        code: rendererResult.error.code,
      });
    }

    this.playbackStartMs = this.runtimePlanner.resolveNowMs() - this.timelineMs;
    this.setStatus("playing");
    const currentTimelineMs = this.resolveCurrentTimelineMs();
    this.timelineMs = currentTimelineMs;
    this.runDueTimelineEvents(currentTimelineMs);
    this.startPlaybackLoop();
    this.emitTrace("player:play", "applied", {
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

    if (this.status !== "playing") {
      return this.reject("INVALID_PLAYER_STATE", "pause is only allowed from playing", "player:pause", {
        currentState: this.status,
      });
    }

    this.director.pause();

    const rendererResult = this.renderer.pause();
    if (!rendererResult.ok) {
      return this.reject("RENDERER_INVALID_STATE", "Renderer rejected pause transition", "player:pause", {
        currentState: this.status,
        code: rendererResult.error.code,
      });
    }

    this.timelineMs = this.resolveCurrentTimelineMs();
    this.playbackStartMs = null;
    this.stopPlaybackLoop();
    this.setStatus("paused");
    this.emitTrace("player:pause", "applied");
    return { ok: true };
  }

  /**
   * Injects one public event into runtime processing.
   */
  async emit(event: PlayerPublicEventInput): Promise<PlayerCommandResult> {
    if (!this.isInitialized()) {
      return this.reject("PLAYER_NOT_INITIALIZED", "init must be called before emit", "player:emit");
    }

    const timelineEvent = this.createTimelineEvent(event);
    this.runTimelineEvent(timelineEvent);
    this.emitTrace("player:emit", "applied", {
      eventId: timelineEvent.id,
      eventName: timelineEvent.name,
      eventMs: timelineEvent.ms,
    });

    return { ok: true };
  }

  /**
   * Seeks timeline to target position without forcing autoplay.
   */
  async seek(targetTimelineMs: number): Promise<PlayerCommandResult> {
    if (!this.isInitialized()) {
      return this.reject("PLAYER_NOT_INITIALIZED", "init must be called before seek", "player:seek");
    }

    if (this.status !== "ready" && this.status !== "paused" && this.status !== "playing") {
      return this.reject(
        "INVALID_PLAYER_STATE",
        "seek is only allowed from ready, paused, or playing",
        "player:seek",
        {
          currentState: this.status,
        },
      );
    }

    const previousStatus = this.status;
    this.setStatus("seeking");
    this.emitTrace("player:seek:started", "applied", {
      targetTimelineMs,
    });

    this.timelineMs = this.runtimePlanner.clampTimelineMs(targetTimelineMs);
    this.syncNextScheduledEventIndex(this.timelineMs);

    if (previousStatus === "playing") {
      this.playbackStartMs = this.runtimePlanner.resolveNowMs() - this.timelineMs;
      this.runDueTimelineEvents(this.timelineMs);
    }

    this.setStatus(previousStatus);
    this.emitTrace("player:seek:done", "applied", {
      targetTimelineMs: this.timelineMs,
    });

    return { ok: true };
  }

  /**
   * Rewinds timeline to zero while preserving playback intent.
   */
  async rewind(): Promise<PlayerCommandResult> {
    if (!this.isInitialized()) {
      return this.reject("PLAYER_NOT_INITIALIZED", "init must be called before rewind", "player:rewind");
    }

    if (this.status !== "ready" && this.status !== "paused" && this.status !== "playing") {
      return this.reject(
        "INVALID_PLAYER_STATE",
        "rewind is only allowed from ready, paused, or playing",
        "player:rewind",
        {
          currentState: this.status,
        },
      );
    }

    if (this.scene === null) {
      return this.reject("PLAYER_NOT_INITIALIZED", "init must be called before rewind", "player:rewind");
    }

    const previousStatus = this.status;
    this.setStatus("rewinding");
    this.emitTrace("player:rewind:started", "applied");

    this.timelineMs = 0;
    this.playbackStartMs = null;
    this.stopPlaybackLoop();

    const nextActiveStory = this.runtimePlanner.resolveActiveStory(this.scene);
    if (nextActiveStory === null) {
      return this.reject(
        "SCENE_STORY_NOT_FOUND",
        "Scene must provide at least one story",
        "player:rewind:failed",
        {
          sceneId: this.scene.id,
        },
      );
    }

    const runtimePlan = this.runtimePlanner.createRuntimePlan(this.scene, nextActiveStory);
    this.director.load(runtimePlan);

    const rendererLoadResult = this.renderer.load({ story: runtimePlan.story });
    if (!rendererLoadResult.ok) {
      return this.reject("RENDERER_LOAD_FAILED", "Renderer failed to rewind story", "player:rewind:failed", {
        sceneId: this.scene.id,
        code: rendererLoadResult.error.code,
      });
    }

    if (previousStatus === "playing" || previousStatus === "paused") {
      this.director.start();

      const rendererStartResult = this.renderer.start();
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

      if (previousStatus === "paused") {
        this.director.pause();

        const rendererPauseResult = this.renderer.pause();
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

    this.syncNextScheduledEventIndex(this.timelineMs);

    if (previousStatus === "playing") {
      this.playbackStartMs = this.runtimePlanner.resolveNowMs();
      this.runDueTimelineEvents(this.timelineMs);
      this.startPlaybackLoop();
    }

    this.setStatus(previousStatus);
    const rendererState = this.renderer.getState();
    this.emitTrace("player:rewind:done", "applied", {
      targetTimelineMs: 0,
      runtimeRevision: rendererState.runtimeRevision,
    });

    return { ok: true };
  }

  /**
   * Rebuilds runtime according to runtime policy constraints.
   */
  async rebuild(mode: RebuildMode = "state"): Promise<PlayerCommandResult> {
    if (!this.isInitialized() || this.scene === null) {
      return this.reject("PLAYER_NOT_INITIALIZED", "init must be called before rebuild", "player:rebuild");
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
    this.setStatus("seeking");
    this.emitTrace("player:rebuild:started", "applied", {
      mode,
    });

    if (mode === "full") {
      const nextActiveStory = this.runtimePlanner.resolveActiveStory(this.scene);
      if (nextActiveStory === null) {
        return this.reject(
          "SCENE_STORY_NOT_FOUND",
          "Scene must provide at least one story",
          "player:rebuild:failed",
          {
            sceneId: this.scene.id,
            mode,
          },
        );
      }

      const runtimePlan = this.runtimePlanner.createRuntimePlan(this.scene, nextActiveStory);
      this.director.load(runtimePlan);
      this.syncNextScheduledEventIndex(this.timelineMs);

      const rendererLoadResult = this.renderer.load({ story: runtimePlan.story });
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

      if (previousStatus === "playing" || previousStatus === "paused") {
        this.director.start();

        const rendererStartResult = this.renderer.start();
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

        if (previousStatus === "paused") {
          this.director.pause();

          const rendererPauseResult = this.renderer.pause();
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

        if (previousStatus === "playing") {
          this.runDueTimelineEvents(this.timelineMs);
          this.startPlaybackLoop();
        }
      }
    }

    this.setStatus(previousStatus);
    const rendererState = this.renderer.getState();

    this.emitTrace("player:rebuild:done", "applied", {
      mode,
      runtimeRevision: rendererState.runtimeRevision,
    });

    return { ok: true };
  }

  /**
   * Returns one immutable snapshot of current player state.
   */
  getState(): PlayerStateSnapshot {
    const directorState = this.director.getState();
    const rendererState = this.renderer.getState();

    return {
      status: this.status,
      initialized: this.isInitialized(),
      sceneId: this.scene?.id,
      activeStoryId: directorState.activeStoryId,
      timelineMs: this.resolveCurrentTimelineMs(),
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
    this.emitTrace(eventName, "rejected", {
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
