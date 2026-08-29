import type { Diagnostic } from '../../diagnostics'
import type {
  CompiledEmitRule,
  CompiledScene,
  CompiledRecord,
} from '../../scene/compiled'
import type { RuntimePlayer } from '../player'
import { PLAYER_LIFECYCLE_PLAYING } from '../config/player-lifecycle'
import type { MaterializedPart } from '../components'

// Ordinary Perso.emit follows V1's default bubble-phase DOM listener.
// Pointer capture keeps its own capture-phase adapter and is not changed here.
const GLOBAL_EVENT_LISTENER_OPTIONS = false

/** Stable materialized nodes read by the generic HTML emit source. */
export type HtmlPersoEmitSourceNodes = Readonly<{
  persoNodes: ReadonlyMap<string, unknown>
  persoParts: ReadonlyMap<string, readonly MaterializedPart[]>
}>

/** Dependencies of the generic V2 HTML source for `Perso.emit`. */
export type HtmlPersoEmitSourceAdapterOptions = Readonly<{
  player: RuntimePlayer
  compiledScene: CompiledScene
  nodes: HtmlPersoEmitSourceNodes
  eventTarget?: EventTarget
  onDiagnostic?: (diagnostic: Diagnostic) => void
}>

type IndexedEmitRule = Readonly<{
  storyId: string
  persoId: string
  persoName?: string
  persoKey: string
  trigger: string
  rule: CompiledEmitRule
}>

/**
 * Connects native HTML events to the single RuntimePlayer event circuit.
 * It only reads materialized nodes and never creates or mutates presentation.
 */
export class HtmlPersoEmitSourceAdapter {
  private readonly player: RuntimePlayer
  private readonly compiledScene: CompiledScene
  private readonly nodes: HtmlPersoEmitSourceNodes
  private readonly eventTarget: EventTarget | undefined
  private readonly onDiagnostic: ((diagnostic: Diagnostic) => void) | undefined
  private readonly rulesByTrigger = new Map<string, readonly IndexedEmitRule[]>()
  private readonly listeners = new Map<string, (event: Event) => void>()
  private readonly reportedUnknownRefs = new Set<string>()
  private pendingDispatch: Promise<void> = Promise.resolve()
  private destroyed = false

  /** Creates one adapter without registering browser listeners. */
  constructor(options: HtmlPersoEmitSourceAdapterOptions) {
    this.player = options.player
    this.compiledScene = options.compiledScene
    this.nodes = options.nodes
    this.eventTarget = options.eventTarget
    this.onDiagnostic = options.onDiagnostic
    this.indexEmitRules()
  }

  /** Registers one delegated listener for every declared native trigger. */
  attach(): void {
    if (this.destroyed || this.eventTarget === undefined || this.listeners.size > 0) return
    this.validateRefs()
    for (const trigger of this.rulesByTrigger.keys()) {
      const listener = (event: Event): void => this.handleNativeEvent(event)
      this.listeners.set(trigger, listener)
      this.eventTarget.addEventListener(trigger, listener, GLOBAL_EVENT_LISTENER_OPTIONS)
    }
  }

  /** Removes every delegated listener and prevents queued work from emitting. */
  destroy(): void {
    this.destroyed = true
    if (this.eventTarget !== undefined) {
      for (const [trigger, listener] of this.listeners) {
        this.eventTarget.removeEventListener(trigger, listener, GLOBAL_EVENT_LISTENER_OPTIONS)
      }
    }
    this.listeners.clear()
  }

  /** Indexes ordinary emit rules while leaving capture rules to their own source. */
  private indexEmitRules(): void {
    for (const [storyId, story] of Object.entries(this.compiledScene.scene.stories)) {
      for (const perso of story.persos) {
        const persoKey = `${storyId}:${perso.id}`
        for (const [trigger, value] of Object.entries(perso.emit ?? {})) {
          for (const rule of normalizeRules(value)) {
            if (rule.capture !== undefined) continue
            const indexed: IndexedEmitRule = {
              storyId,
              persoId: perso.id,
              persoName: perso.name,
              persoKey,
              trigger,
              rule,
            }
            const existing = this.rulesByTrigger.get(trigger) ?? []
            this.rulesByTrigger.set(trigger, [...existing, indexed])
          }
        }
      }
    }
  }

  /** Queues one native event so multiple authored actions keep declaration order. */
  private handleNativeEvent(event: Event): void {
    if (this.destroyed || this.player.getLifecycleState() !== PLAYER_LIFECYCLE_PLAYING) return
    const matches = this.resolveMatches(event)
    if (matches.length === 0) return

    for (const match of matches) {
      if (match.rule.preventDefault === true) event.preventDefault()
    }
    const applyAtMs = this.player.getCurrentTimeMs()
    this.pendingDispatch = this.pendingDispatch
      .then(async () => {
        if (this.destroyed) return
        for (const match of matches) await this.emitMatch(match, event, applyAtMs)
      })
      .catch((error: unknown) => {
        this.publishDiagnostic({
          severity: 'error',
          code: 'RUNTIME_EMIT_FAILED',
          message: error instanceof Error ? error.message : String(error),
          details: { context: { trigger: event.type } },
        })
      })
  }

  /** Resolves root, internal-part, and keyboard rules against one native event. */
  private resolveMatches(event: Event): readonly IndexedEmitRule[] {
    const indexed = this.rulesByTrigger.get(event.type) ?? []
    return indexed.filter((entry) => {
      if (entry.rule.keyCode !== undefined) {
        return readKeyboardCode(event) === entry.rule.keyCode
      }
      const targets = this.resolveActionTargets(entry)
      return targets.some((target) => isEventWithinNode(event, target))
    })
  }

  /** Emits one matched author action through RuntimePlayer without a parallel path. */
  private async emitMatch(
    match: IndexedEmitRule,
    nativeEvent: Event,
    applyAtMs: number,
  ): Promise<void> {
    const visibility = resolveVisibility(match.rule)
    const result = await this.player.emit({
      name: match.rule.event.name,
      applyAtMs,
      storyId: visibility === 'story' ? match.storyId : undefined,
      visibility,
      data: createEmitData(match, nativeEvent),
      context: {
        source: 'dom',
        userEvent: match.trigger,
        persoId: match.persoId,
      },
      mode: match.rule.event.mode,
    })
    if (result.ok && result.issues.length === 0) return
    if (result.issues.length === 0) {
      this.publishDiagnostic({
        severity: 'error',
        code: 'RUNTIME_EMIT_REJECTED',
        message: `Runtime event was rejected: ${match.rule.event.name}`,
        details: {
          refs: { storyId: match.storyId, persoId: match.persoId },
          context: { trigger: match.trigger },
        },
      })
      return
    }
    for (const issue of result.issues) {
      this.publishDiagnostic({
        severity: 'error',
        code: issue.code,
        message: issue.message,
        details: {
          refs: { storyId: match.storyId, persoId: match.persoId },
          context: {
            trigger: match.trigger,
            eventName: match.rule.event.name,
            depth: issue.depth,
          },
        },
      })
    }
  }

  /** Resolves a V1-compatible action ref against the materializer-published parts. */
  private resolveActionTargets(entry: IndexedEmitRule): readonly unknown[] {
    const root = this.nodes.persoNodes.get(entry.persoKey)
    if (entry.rule.ref === undefined || entry.rule.ref === 'root') return materializedNodes(root)

    const part = this.nodes.persoParts.get(entry.persoKey)?.find((candidate) => candidate.partId === entry.rule.ref)
    if (part !== undefined) return [part.nodeRef]
    this.reportUnknownRef(entry)
    return []
  }

  /** Reports invalid part references once when the materialized host is ready. */
  private validateRefs(): void {
    for (const entries of this.rulesByTrigger.values()) {
      for (const entry of entries) {
        if (entry.rule.keyCode !== undefined || entry.rule.ref === undefined || entry.rule.ref === 'root') continue
        const part = this.nodes.persoParts.get(entry.persoKey)?.some((candidate) => candidate.partId === entry.rule.ref)
        if (part !== true) this.reportUnknownRef(entry)
      }
    }
  }

  /** Publishes one unknown-reference diagnostic without duplicating it per trigger. */
  private reportUnknownRef(entry: IndexedEmitRule): void {
    const refKey = `${entry.persoKey}:${entry.rule.ref}`
    if (!this.reportedUnknownRefs.has(refKey)) {
      this.reportedUnknownRefs.add(refKey)
      this.publishDiagnostic({
        severity: 'error',
        code: 'AUTHOR_COMPONENT_REF_UNKNOWN',
        message: `Component ref is unknown: ${entry.rule.ref}`,
        details: {
          refs: { storyId: entry.storyId, persoId: entry.persoId },
          context: { trigger: entry.trigger, ref: entry.rule.ref },
        },
      })
    }
  }

  /** Publishes one structured diagnostic without allowing an observer to break DOM input. */
  private publishDiagnostic(diagnostic: Diagnostic): void {
    try {
      this.onDiagnostic?.(diagnostic)
    } catch {
      // Diagnostics are observational and must not interrupt native event delivery.
    }
  }
}

/** Normalizes one compiled declaration entry to a rule list. */
function normalizeRules(
  value: CompiledEmitRule | readonly CompiledEmitRule[],
): readonly CompiledEmitRule[] {
  if (Array.isArray(value)) return value.map((entry) => entry as CompiledEmitRule)
  return [value as CompiledEmitRule]
}

/** Resolves V2 named visibility for one ordinary emit rule. */
function resolveVisibility(rule: CompiledEmitRule): 'story' | 'scene' | 'public' {
  return rule.event.visibility ?? 'story'
}

/** Builds the V1-compatible event payload, including self and native input values. */
function createEmitData(entry: IndexedEmitRule, nativeEvent: Event): CompiledRecord {
  const self = {
    id: entry.persoId,
    storyId: entry.storyId,
  } as Record<string, unknown>
  if (entry.persoName !== undefined) self.name = entry.persoName
  const data = {
    ...(entry.rule.event.data ?? {}),
    ...(entry.rule.data ?? {}),
    self,
  } as Record<string, unknown>
  const input = readInputData(nativeEvent.target)
  return (input === undefined ? data : { ...data, ...input }) as CompiledRecord
}

/** Reads the native input payload required by V1 straps and transforms. */
function readInputData(target: EventTarget | null): CompiledRecord | undefined {
  if (!isInputLike(target)) return undefined
  return {
    value: target.value,
    valueAsNumber: target.valueAsNumber,
  }
}

/** Checks the minimal native input surface used by the event contract. */
function isInputLike(value: unknown): value is { value: string; valueAsNumber: number } {
  return typeof value === 'object'
    && value !== null
    && 'value' in value
    && typeof (value as { value?: unknown }).value === 'string'
    && 'valueAsNumber' in value
    && typeof (value as { valueAsNumber?: unknown }).valueAsNumber === 'number'
}

/** Reads KeyboardEvent.code without relying on a realm-specific constructor. */
function readKeyboardCode(event: Event): string | undefined {
  if (!('code' in event)) return undefined
  const code = (event as Event & { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

/** Tests whether one event target is the node itself or one of its descendants. */
function isEventWithinNode(event: Event, node: unknown): boolean {
  if (node === undefined || node === null) return false
  const composedPath = typeof event.composedPath === 'function' ? event.composedPath() : []
  if (composedPath.some((candidate) => candidate === node)) return true
  let current: unknown = event.target
  const visited = new Set<unknown>()
  while (current !== null && current !== undefined && !visited.has(current)) {
    if (current === node) return true
    visited.add(current)
    if (!isParentNode(current)) break
    current = current.parentNode
  }
  return false
}

/** Expands one materialized root or fragment roots for event matching. */
function materializedNodes(root: unknown): readonly unknown[] {
  if (root === undefined || root === null) return []
  return Array.isArray(root) ? root : [root]
}

/** Narrows one event target to the parent relationship used by DOM traversal. */
function isParentNode(value: unknown): value is Readonly<{ parentNode: unknown | null }> {
  return typeof value === 'object' && value !== null && 'parentNode' in value
}
