import type { DiagnosticReport } from '../../diagnostics'
import { DiagnosticCollector } from '../../diagnostics'
import type { CompiledScene } from '../../scene/compiled'
import type { EngineFrame } from '../engine'
import { RuntimeEngine } from '../engine'
import { createTemporaryRenderSnapshot, type TemporaryRenderSink } from './temporary-render-sink'
import { RenderSync } from './render-sync'

/** Lifecycle states owned by one V2 player instance. */
export type PlayerLifecycleState = 'idle' | 'ready' | 'playing' | 'paused' | 'destroyed'

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
  private state: PlayerLifecycleState = 'idle'
  private currentTimeMs = 0
  private skipNextDelta = false

  /** Creates one player bound to one engine and one immutable compiled scene. */
  constructor(
    id: string,
    engine: RuntimeEngine,
    compiledScene: CompiledScene,
    renderSink?: TemporaryRenderSink,
    renderSync: RenderSync = new RenderSync([]),
  ) {
    this.id = id
    this.engine = engine
    this.compiledScene = compiledScene
    this.renderSink = renderSink
    this.renderSync = renderSync
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
    if (this.state !== 'idle') {
      diagnostics.error('RUNTIME_PLAYER_STATE_INVALID', 'Player can only be initialized from idle state.', {
        context: { state: this.state },
      })
      return { ok: false, diagnostics: diagnostics.report() }
    }
    this.engine.validateRequirements(this.compiledScene.requirements, diagnostics)
    if (diagnostics.hasErrors()) return { ok: false, diagnostics: diagnostics.report() }
    this.engine.registerInstance(this.id, (frame) => this.onEngineFrame(frame))
    this.state = 'ready'
    this.presentTemporarySnapshot()
    return { ok: true, diagnostics: diagnostics.report() }
  }

  /** Starts logical playback without creating a clock or rendering anything. */
  play(): void {
    this.requireState('ready', 'paused')
    if (this.state === 'paused') {
      this.skipNextDelta = true
      this.renderSync.resume()
    }
    this.state = 'playing'
  }

  /** Pauses logical playback at the current engine-provided time. */
  pause(): void {
    this.requireState('playing')
    this.renderSync.pause()
    this.state = 'paused'
  }

  /** Positions logical time without replaying events or effects. */
  seek(timeMs: number): void {
    if (this.state === 'idle' || this.state === 'destroyed') {
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
    if (this.state === 'destroyed') return
    this.engine.unregisterInstance(this.id)
    this.renderSync.stop()
    this.state = 'destroyed'
  }

  /** Applies one engine frame to the logical clock while playing. */
  private onEngineFrame(frame: EngineFrame): void {
    if (this.state !== 'playing') return
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
    this.renderSink?.present(createTemporaryRenderSnapshot(this.id, this.compiledScene, this.currentTimeMs))
  }

  /** Enforces one valid lifecycle transition. */
  private requireState(...allowed: PlayerLifecycleState[]): void {
    if (!allowed.includes(this.state)) {
      throw new Error(`Player cannot perform this operation from ${this.state} state.`)
    }
  }
}
