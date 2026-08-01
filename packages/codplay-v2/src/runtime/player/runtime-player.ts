import type { DiagnosticReport } from '../../diagnostics'
import { DiagnosticCollector } from '../../diagnostics'
import type { CompiledScene } from '../../scene/compiled'
import type { EngineFrame } from '../engine'
import { RuntimeEngine } from '../engine'
import {
  PLAYER_LIFECYCLE_DESTROYED,
  PLAYER_LIFECYCLE_IDLE,
  PLAYER_LIFECYCLE_PAUSED,
  PLAYER_LIFECYCLE_PLAYING,
  PLAYER_LIFECYCLE_READY,
  type PlayerLifecycleState,
} from '../config/player-lifecycle'
import { createTemporaryRenderSnapshot, type TemporaryRenderSink } from './temporary-render-sink'
import { RenderSync } from './render-sync'
import { validateStrapCollections, type StrapCollections } from './pipeline'
import type { RuntimeTrackJournal } from './pipeline'

export type { PlayerLifecycleState } from '../config/player-lifecycle'

/** Result returned by player initialization. */
export type PlayerInitResult = Readonly<
  | { ok: true; diagnostics: DiagnosticReport }
  | { ok: false; diagnostics: DiagnosticReport }
>

/** One compiled-scene runtime instance without render or component behavior. */
export class RuntimePlayer {
  readonly id: string
  readonly engine: RuntimeEngine
  readonly compiledScene: CompiledScene
  readonly renderSink: TemporaryRenderSink | undefined
  readonly renderSync: RenderSync
  readonly strapCollections: StrapCollections | undefined
  readonly trackJournal: RuntimeTrackJournal | undefined
  private state: PlayerLifecycleState = PLAYER_LIFECYCLE_IDLE
  private currentTimeMs = 0
  private skipNextDelta = false

  /** Creates one player bound to one engine and one immutable compiled scene. */
  constructor(
    id: string,
    engine: RuntimeEngine,
    compiledScene: CompiledScene,
    renderSink?: TemporaryRenderSink,
    renderSync: RenderSync = new RenderSync([]),
    strapCollections?: StrapCollections,
    trackJournal?: RuntimeTrackJournal,
  ) {
    this.id = id
    this.engine = engine
    this.compiledScene = compiledScene
    this.renderSink = renderSink
    this.renderSync = renderSync
    this.strapCollections = strapCollections
    this.trackJournal = trackJournal
  }

  /** Returns the current lifecycle state. */
  getLifecycleState(): PlayerLifecycleState {
    return this.state
  }

  /** Returns the logical time advanced by the engine or set by seek. */
  getCurrentTimeMs(): number {
    return this.currentTimeMs
  }

  /** Validates capabilities and attaches this player to the shared engine. */
  init(): PlayerInitResult {
    const diagnostics = new DiagnosticCollector()
    if (this.state !== PLAYER_LIFECYCLE_IDLE) {
      diagnostics.error('RUNTIME_PLAYER_STATE_INVALID', 'Player can only be initialized from idle state.', {
        context: { state: this.state },
      })
      return { ok: false, diagnostics: diagnostics.report() }
    }
    for (const issue of this.strapCollections === undefined
      ? []
      : validateStrapCollections(this.compiledScene, this.strapCollections)) {
      diagnostics.warning(issue.code, issue.message, {
        context: { scope: issue.scope, storyId: issue.storyId, strapName: issue.strapName },
      })
    }
    this.engine.validateRequirements(this.compiledScene.requirements, diagnostics)
    if (diagnostics.hasErrors()) return { ok: false, diagnostics: diagnostics.report() }
    this.engine.registerInstance(this.id, (frame) => this.onEngineFrame(frame))
    this.state = PLAYER_LIFECYCLE_READY
    this.presentTemporarySnapshot()
    return { ok: true, diagnostics: diagnostics.report() }
  }

  /** Starts logical playback without creating a clock or rendering anything. */
  play(): void {
    this.requireState(PLAYER_LIFECYCLE_READY, PLAYER_LIFECYCLE_PAUSED)
    if (this.state === PLAYER_LIFECYCLE_PAUSED) {
      this.skipNextDelta = true
      this.renderSync.resume()
    }
    this.state = PLAYER_LIFECYCLE_PLAYING
  }

  /** Pauses logical playback at the current engine-provided time. */
  pause(): void {
    this.requireState(PLAYER_LIFECYCLE_PLAYING)
    this.renderSync.pause()
    this.state = PLAYER_LIFECYCLE_PAUSED
  }

  /** Positions logical time without replaying events or effects. */
  seek(timeMs: number): void {
    if (this.state === PLAYER_LIFECYCLE_IDLE || this.state === PLAYER_LIFECYCLE_DESTROYED) {
      throw new Error(`Player cannot seek from ${this.state} state.`)
    }
    if (!Number.isFinite(timeMs) || timeMs < 0) {
      throw new Error('Player seek time must be a finite positive number.')
    }
    this.renderSync.prepareSeek()
    this.currentTimeMs = timeMs
    this.skipNextDelta = true
    this.renderSync.seek(this.engine.getCurrentNowMs(), this.currentTimeMs)
    this.presentTemporarySnapshot()
  }

  /** Detaches the player from the engine and closes its lifecycle. */
  destroy(): void {
    if (this.state === PLAYER_LIFECYCLE_DESTROYED) return
    this.engine.unregisterInstance(this.id)
    this.renderSync.stop()
    this.state = PLAYER_LIFECYCLE_DESTROYED
  }

  /** Applies one engine frame to the logical clock while playing. */
  private onEngineFrame(frame: EngineFrame): void {
    if (this.state !== PLAYER_LIFECYCLE_PLAYING) return
    if (this.skipNextDelta) {
      this.skipNextDelta = false
      this.renderSync.tick(frame.nowMs, this.currentTimeMs, 1)
      this.presentTemporarySnapshot()
      return
    }
    this.currentTimeMs += frame.deltaMs
    this.renderSync.tick(frame.nowMs, this.currentTimeMs, 1)
    this.presentTemporarySnapshot()
  }

  /** Presents initial compiled perso data through the temporary render probe. */
  private presentTemporarySnapshot(): void {
    this.renderSink?.present(createTemporaryRenderSnapshot(this.id, this.compiledScene, this.currentTimeMs, this.trackJournal))
  }

  /** Enforces one valid lifecycle transition. */
  private requireState(...allowed: PlayerLifecycleState[]): void {
    if (!allowed.includes(this.state)) {
      throw new Error(`Player cannot perform this operation from ${this.state} state.`)
    }
  }
}
