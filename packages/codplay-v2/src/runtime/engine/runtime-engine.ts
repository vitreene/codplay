import type { DiagnosticCollector, DiagnosticReport } from '../../diagnostics'
import type { CompiledRequirements, CompiledScene } from '../../scene/compiled'
import { TimeTicker, type TickPayload, type Ticker } from '../time'
import { reportMissingCapabilities } from './capability-diagnostics'
import { RuntimeCapabilityCatalog } from '../catalog'
import type {
  RuntimeModuleServiceContext,
  RuntimeModuleServiceInstance,
} from './module-service-types'

/** Optional engine resources supplied beside the unified capability catalog. */
export type RuntimeEngineOptions = Readonly<{
  resources?: readonly string[]
}>

/** One externally supplied engine frame. */
export type EngineFrame = Readonly<{
  prevMs: number
  nowMs: number
  deltaMs: number
  marginMs: number
}>

/** One local seek target supplied by an external orchestrator. */
export type EngineSeekTarget = Readonly<{
  instanceId: string
  timeMs: number
}>

/** Seek phases exposed by one registered runtime instance. */
export type InstanceSeekParticipant = Readonly<{
  validateSeek: (timeMs: number) => void
  getSeekDiagnostics?: () => DiagnosticReport
  abortSeek?: () => void
  prepareSeek: () => void
  commitSeek: (timeMs: number) => void
  presentSeek: () => void
}>

/** Reports returned for each instance after one grouped seek. */
export type EngineSeekResult = Readonly<{
  ok: true
  diagnostics: Readonly<Record<string, DiagnosticReport>>
}>

type InstanceTick = (frame: EngineFrame) => void

type RuntimeInstance = Readonly<{
  onFrame: InstanceTick
  seekParticipant?: InstanceSeekParticipant
}>

/** Shared capability and clock boundary for V2 player instances. */
export class RuntimeEngine {
  private readonly catalog: RuntimeCapabilityCatalog
  private readonly resources = new Set<string>()
  private readonly instances = new Map<string, RuntimeInstance>()
  private lastNowMs: number | undefined
  private ticker: Ticker | null = null
  private running = false

  /** Creates one engine around the CodPlay-owned capability catalog. */
  constructor(catalog: RuntimeCapabilityCatalog, options: RuntimeEngineOptions = {}) {
    this.catalog = catalog
    this.registerResources(options.resources ?? [])
  }

  /** Marks resources as available after an external preload operation completes. */
  registerResources(resources: readonly string[]): void {
    for (const resource of resources) this.resources.add(resource)
  }

  /** Reports compiled requirements unavailable from this engine. */
  validateRequirements(requirements: CompiledRequirements, diagnostics: DiagnosticCollector): void {
    reportMissingCapabilities('component', requirements.components, new Set(this.catalog.getComponents().map((definition) => definition.type)), diagnostics)
    reportMissingCapabilities('service', requirements.services, new Set(this.catalog.getServices().map((definition) => definition.name)), diagnostics)
    reportMissingCapabilities('module', requirements.modules, new Set(this.catalog.getModules().map((definition) => definition.id)), diagnostics)
    reportMissingCapabilities('resource', requirements.resources, this.resources, diagnostics)
  }

  /** Registers one player callback in deterministic registration order. */
  registerInstance(id: string, onFrame: InstanceTick, seekParticipant?: InstanceSeekParticipant): void {
    if (this.instances.has(id)) {
      throw new Error(`Runtime instance already registered: ${id}`)
    }
    this.instances.set(id, { onFrame, seekParticipant })
  }

  /** Removes one player callback from the engine. */
  unregisterInstance(id: string): void {
    this.instances.delete(id)
  }

  /** Creates player-scoped module-service instances for one compiled requirement set. */
  createModuleServiceInstances(
    playerId: string,
    compiledScene: CompiledScene,
    moduleIds: readonly string[],
    context: Pick<RuntimeModuleServiceContext, 'componentSurfaces'> = {},
  ): ReadonlyMap<string, RuntimeModuleServiceInstance> {
    const instances = new Map<string, RuntimeModuleServiceInstance>()
    for (const id of moduleIds) {
      const definition = this.catalog.getModule(id)
      if (definition === undefined) throw new Error(`Runtime module service capability is unavailable: ${id}`)
      instances.set(id, definition.create({ playerId, compiledScene, ...context }))
    }
    return instances
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

  /** Reconstructs a selected group and presents all local seek targets once. */
  seek(targets: readonly EngineSeekTarget[]): EngineSeekResult {
    if (targets.length === 0) {
      throw new Error('Engine seek requires at least one target.')
    }

    const participants = targets.map((target) => {
      if (!Number.isFinite(target.timeMs) || target.timeMs < 0) {
        throw new Error(`Engine seek time must be a finite positive number: ${target.instanceId}.`)
      }
      if (targets.filter((candidate) => candidate.instanceId === target.instanceId).length > 1) {
        throw new Error(`Engine seek target is duplicated: ${target.instanceId}`)
      }
      const instance = this.instances.get(target.instanceId)
      if (instance === undefined || instance.seekParticipant === undefined) {
        throw new Error(`Engine instance cannot seek: ${target.instanceId}`)
      }
      return { target, participant: instance.seekParticipant }
    })

    const validated: Array<{ participant: InstanceSeekParticipant }> = []
    try {
      for (const { target, participant } of participants) {
        participant.validateSeek(target.timeMs)
        validated.push({ participant })
      }
    } catch (error) {
      for (const { participant } of validated.reverse()) participant.abortSeek?.()
      throw error
    }
    const diagnostics = Object.fromEntries(
      participants.map(({ target, participant }) => [
        target.instanceId,
        participant.getSeekDiagnostics?.() ?? emptyDiagnosticReport(),
      ]),
    )
    for (const { participant } of participants) participant.prepareSeek()
    for (const { target, participant } of participants) participant.commitSeek(target.timeMs)
    for (const { participant } of participants) participant.presentSeek()
    return { ok: true, diagnostics }
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
    for (const instance of this.instances.values()) {
      instance.onFrame(frame)
    }
  }
}

/** Provides a stable empty report for participants without diagnostic output. */
function emptyDiagnosticReport(): DiagnosticReport {
  return { all: [], warnings: [], errors: [] }
}
