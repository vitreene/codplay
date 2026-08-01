import type { DiagnosticCollector } from '../../diagnostics'
import type { CompiledRequirements } from '../../scene/compiled'
import { TimeTicker, type TickPayload, type Ticker } from '../time'
import { reportMissingCapabilities } from './capability-diagnostics'

/** Capabilities available to every player attached to one engine. */
export type EngineCapabilities = Readonly<CompiledRequirements>

/** One externally supplied engine frame. */
export type EngineFrame = Readonly<{
  prevMs: number
  nowMs: number
  deltaMs: number
  marginMs: number
}>

type InstanceTick = (frame: EngineFrame) => void

/** Shared capability and clock boundary for V2 player instances. */
export class RuntimeEngine {
  private readonly capabilities: {
    components: ReadonlySet<string>
    services: ReadonlySet<string>
    modules: ReadonlySet<string>
    resources: ReadonlySet<string>
  }
  private readonly instances = new Map<string, InstanceTick>()
  private lastNowMs: number | undefined
  private ticker: Ticker | null = null
  private running = false

  /** Creates one engine without starting an internal clock. */
  constructor(capabilities: EngineCapabilities) {
    this.capabilities = {
      components: new Set(capabilities.components),
      services: new Set(capabilities.services),
      modules: new Set(capabilities.modules),
      resources: new Set(capabilities.resources),
    }
  }

  /** Reports compiled requirements unavailable from this engine. */
  validateRequirements(requirements: CompiledRequirements, diagnostics: DiagnosticCollector): void {
    reportMissingCapabilities('component', requirements.components, this.capabilities.components, diagnostics)
    reportMissingCapabilities('service', requirements.services, this.capabilities.services, diagnostics)
    reportMissingCapabilities('module', requirements.modules, this.capabilities.modules, diagnostics)
    reportMissingCapabilities('resource', requirements.resources, this.capabilities.resources, diagnostics)
  }

  /** Registers one player callback in deterministic registration order. */
  registerInstance(id: string, onFrame: InstanceTick): void {
    if (this.instances.has(id)) {
      throw new Error(`Runtime instance already registered: ${id}`)
    }
    this.instances.set(id, onFrame)
  }

  /** Removes one player callback from the engine. */
  unregisterInstance(id: string): void {
    this.instances.delete(id)
  }

  /** Advances all registered instances from one externally supplied timestamp. */
  advance(nowMs: number, marginMs = 0): void {
    if (!Number.isFinite(nowMs)) {
      throw new Error('Engine time must be finite.')
    }
    const deltaMs = this.lastNowMs === undefined ? 0 : nowMs - this.lastNowMs
    if (deltaMs < 0) {
      throw new Error('Engine time must be monotonic.')
    }
    const prevMs = this.lastNowMs ?? nowMs
    this.dispatchFrame({ prevMs, nowMs, deltaMs, marginMs })
  }

  /** Starts the shared ticker and routes accepted frames to all players. */
  start(ticker: Ticker = new TimeTicker()): void {
    if (this.running) return
    this.ticker = ticker
    this.running = true
    ticker.start((payload) => this.advanceTick(payload))
  }

  /** Stops the shared ticker and resets the next engine frame baseline. */
  stop(): void {
    if (!this.running) return
    this.running = false
    this.ticker?.stop()
    this.ticker = null
    this.lastNowMs = undefined
  }

  /** Returns whether this engine currently owns a running ticker. */
  isRunning(): boolean {
    return this.running
  }

  /** Returns the last accepted engine timestamp for seek baselines. */
  getCurrentNowMs(): number {
    return this.lastNowMs ?? 0
  }

  /** Accepts one ticker payload without recomputing its measured delta. */
  private advanceTick(payload: TickPayload): void {
    if (!Number.isFinite(payload.prevMs) || !Number.isFinite(payload.nowMs) || !Number.isFinite(payload.deltaMs)) {
      throw new Error('Ticker frame time must be finite.')
    }
    if (payload.nowMs < payload.prevMs || payload.deltaMs < 0) {
      throw new Error('Ticker frame time must be monotonic.')
    }
    if (this.lastNowMs !== undefined && payload.nowMs < this.lastNowMs) {
      throw new Error('Engine time must be monotonic.')
    }
    this.dispatchFrame(payload)
  }

  /** Stores one accepted timestamp and dispatches it in registration order. */
  private dispatchFrame(frame: EngineFrame): void {
    this.lastNowMs = frame.nowMs
    for (const onFrame of this.instances.values()) {
      onFrame(frame)
    }
  }
}
