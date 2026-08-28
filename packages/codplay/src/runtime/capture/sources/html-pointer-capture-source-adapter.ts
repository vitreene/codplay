import type {
  CompiledCaptureDeclaration,
  CompiledEmitRule,
  CompiledScene,
} from '../../../scene/compiled'
import type { RuntimePlayer } from '../../player'
import type { RuntimeCaptureSample, RuntimeCaptureState } from '../capture-types'
import { isFiniteNumber } from '../../../shared'

const DEFAULT_TRACK_EVENT = 'pointermove'
const DEFAULT_END_EVENT = 'pointerup'
const GLOBAL_EVENT_LISTENER_OPTIONS = { capture: true } as const

/** Nodes used to associate a browser event target with its compiled perso. */
export type HtmlPointerCaptureSourceNodes = Readonly<{
  persoNodes: ReadonlyMap<string, unknown>
}>

/** Dependencies of the first, pointer-only HTML capture source. */
export type HtmlPointerCaptureSourceAdapterOptions = Readonly<{
  player: RuntimePlayer
  compiledScene: CompiledScene
  nodes: HtmlPointerCaptureSourceNodes
  eventTarget?: EventTarget
  onError?: (error: unknown) => void
  /** Observes one completed live sample without creating an event or journal entry. */
  onCaptureTrack?: (input: Readonly<{
    captureId: string
    persoKey: string
    sample: RuntimeCaptureSample
    captureState: RuntimeCaptureState
  }>) => void
  /** Enriches the final capture state once at the native end boundary. */
  resolveEndCaptureState?: (input: Readonly<{
    captureId: string
    persoKey: string
    captureState: RuntimeCaptureState
    event: Event
  }>) => RuntimeCaptureState | undefined
  /** Releases source/materializer preview resources after one capture closes. */
  onCaptureClose?: (input: Readonly<{
    captureId: string
    persoKey: string
    completed: boolean
  }>) => void
}>

type CaptureRule = Readonly<{
  storyId: string
  rule: CompiledEmitRule
  declaration: CompiledCaptureDeclaration
}>

type ActiveCapture = Readonly<{
  captureId: string
  persoKey: string
  storyId: string
  declaration: CompiledCaptureDeclaration
  trackOn: ReadonlySet<string>
  endOn: ReadonlySet<string>
  pointerId?: number
  captureState: RuntimeCaptureState
}>

type PendingCaptureStart = {
  captureId: string
  persoKey: string
  storyId: string
  rule: CompiledEmitRule
  declaration: CompiledCaptureDeclaration
  pointerId?: number
  trackOn: ReadonlySet<string>
  endOn: ReadonlySet<string>
  queuedEvents: Event[]
  ended: boolean
}

/**
 * Binds classic pointer capture declarations to the source-agnostic player
 * facade. It owns browser listeners only; capture state and event routing stay
 * in RuntimePlayer.
 */
export class HtmlPointerCaptureSourceAdapter {
  private readonly player: RuntimePlayer
  private readonly compiledScene: CompiledScene
  private readonly nodes: HtmlPointerCaptureSourceNodes
  private readonly eventTarget: EventTarget | undefined
  private readonly onError: ((error: unknown) => void) | undefined
  private readonly onCaptureTrack: HtmlPointerCaptureSourceAdapterOptions['onCaptureTrack']
  private readonly resolveEndCaptureState: HtmlPointerCaptureSourceAdapterOptions['resolveEndCaptureState']
  private readonly onCaptureClose: HtmlPointerCaptureSourceAdapterOptions['onCaptureClose']
  private readonly captureRules = new Map<string, readonly CaptureRule[]>()
  private readonly activeCaptures = new Map<string, ActiveCapture>()
  private readonly pendingCaptureStarts = new Map<string, PendingCaptureStart>()
  private readonly listeners = new Map<string, (event: Event) => void>()
  private destroyed = false
  private nextCaptureId = 0

  /** Creates one adapter without registering browser listeners. */
  constructor(options: HtmlPointerCaptureSourceAdapterOptions) {
    this.player = options.player
    this.compiledScene = options.compiledScene
    this.nodes = options.nodes
    this.eventTarget = options.eventTarget
    this.onError = options.onError
    this.onCaptureTrack = options.onCaptureTrack
    this.resolveEndCaptureState = options.resolveEndCaptureState
    this.onCaptureClose = options.onCaptureClose
    this.indexCaptureRules()
  }

  /** Registers the pointer source listeners once the visible player is ready. */
  attach(): void {
    if (this.destroyed || this.eventTarget === undefined || this.listeners.size > 0) return

    const eventNames = new Set<string>(['pointerdown'])
    for (const rules of this.captureRules.values()) {
      for (const rule of rules) {
        for (const eventName of pointerEventNames(rule.declaration.trackOn, DEFAULT_TRACK_EVENT)) eventNames.add(eventName)
        for (const eventName of pointerEventNames(rule.declaration.endOn, DEFAULT_END_EVENT)) eventNames.add(eventName)
      }
    }

    for (const eventName of eventNames) {
      const listener = (event: Event): void => this.handleSourceEvent(event)
      this.listeners.set(eventName, listener)
      this.eventTarget.addEventListener(eventName, listener, GLOBAL_EVENT_LISTENER_OPTIONS)
    }
  }

  /** Cancels open source sessions and removes the global listeners. */
  destroy(): void {
    this.destroyed = true
    if (this.eventTarget !== undefined) {
      for (const [eventName, listener] of this.listeners) {
        this.eventTarget.removeEventListener(eventName, listener, GLOBAL_EVENT_LISTENER_OPTIONS)
      }
    }
    this.listeners.clear()
    this.pendingCaptureStarts.clear()
    for (const capture of [...this.activeCaptures.values()]) {
      this.activeCaptures.delete(capture.captureId)
      try {
        const result = this.player.cancelCapture(capture.captureId)
        if (!result.ok && result.code !== 'RUNTIME_CAPTURE_UNKNOWN') {
          this.reportError(new Error(result.message))
        }
      } catch (error) {
        this.reportError(error)
      } finally {
        this.onCaptureClose?.({
          captureId: capture.captureId,
          persoKey: capture.persoKey,
          completed: false,
        })
      }
    }
  }

  /** Collects only compiled pointerdown capture rules from the scene artifact. */
  private indexCaptureRules(): void {
    for (const [storyId, story] of Object.entries(this.compiledScene.scene.stories)) {
      for (const perso of story.persos) {
        const rules = normalizeRules(perso.emit?.pointerdown)
          .flatMap((rule) => rule.capture === undefined
            ? []
            : [{ storyId, rule, declaration: rule.capture }])
        if (rules.length > 0) this.captureRules.set(`${storyId}:${perso.id}`, rules)
      }
    }
  }

  /** Routes one native pointer event to existing captures and new pointerdown captures. */
  private handleSourceEvent(event: Event): void {
    const existingCaptures = [...this.activeCaptures.values()]
    for (const capture of existingCaptures) this.routeActiveCapture(capture, event)
    const pendingCaptures = [...this.pendingCaptureStarts.values()]
    for (const capture of pendingCaptures) this.routePendingCapture(capture, event)
    if (event.type === 'pointerdown') this.openCaptures(event)
  }

  /** Opens every pointerdown capture owned by the event target's perso. */
  private openCaptures(event: Event): void {
    const persoKey = resolvePersoKey(this.nodes, event.target)
    if (persoKey === undefined) return
    const rules = this.captureRules.get(persoKey) ?? []
    if (rules.length === 0) return
    const storyId = rules[0]?.storyId
    if (storyId === undefined) return
    const pointerId = readPointerId(event)
    for (const { rule, declaration } of rules) {
      const captureId = `${persoKey}:pointer:${this.nextCaptureId++}`
      this.pendingCaptureStarts.set(captureId, {
        captureId,
        persoKey,
        storyId,
        rule,
        declaration,
        ...(pointerId === undefined ? {} : { pointerId }),
        trackOn: pointerEventNames(declaration.trackOn, DEFAULT_TRACK_EVENT),
        endOn: pointerEventNames(declaration.endOn, DEFAULT_END_EVENT),
        queuedEvents: [],
        ended: false,
      })
      void this.openCaptureAfterStart({
        captureId,
        persoKey,
        storyId,
        rule,
        declaration,
        pointerId,
      })
    }
  }

  /** Completes one capture opening only after its ordinary start event settles. */
  private async openCaptureAfterStart(input: Readonly<{
    captureId: string
    persoKey: string
    storyId: string
    rule: CompiledEmitRule
    declaration: CompiledCaptureDeclaration
    pointerId: number | undefined
  }>): Promise<void> {
    try {
      await this.emitStartEvent(input.rule, input.storyId)
      const pending = this.pendingCaptureStarts.get(input.captureId)
      if (this.destroyed || pending === undefined) return
      const opened = this.player.beginCompiledCapture({
        captureId: input.captureId,
        storyId: input.storyId,
        declaration: input.declaration,
      })
      if (!opened.ok) {
        this.reportError(new Error(opened.message))
        return
      }
      this.pendingCaptureStarts.delete(input.captureId)
      this.activeCaptures.set(input.captureId, {
        captureId: input.captureId,
        persoKey: input.persoKey,
        storyId: input.storyId,
        declaration: input.declaration,
        trackOn: pointerEventNames(input.declaration.trackOn, DEFAULT_TRACK_EVENT),
        endOn: pointerEventNames(input.declaration.endOn, DEFAULT_END_EVENT),
        ...(input.pointerId === undefined ? {} : { pointerId: input.pointerId }),
        captureState: opened.captureState,
      })

      for (const event of pending.queuedEvents) {
        const capture = this.activeCaptures.get(input.captureId)
        if (capture === undefined) break
        this.routeActiveCapture(capture, event)
      }
    } catch (error) {
      this.reportError(error)
    } finally {
      this.pendingCaptureStarts.delete(input.captureId)
    }
  }

  /** Queues native tracking and end events until the ordinary start event opens the capture. */
  private routePendingCapture(capture: PendingCaptureStart, event: Event): void {
    if (capture.ended || !matchesPointer(capture.pointerId, readPointerId(event))) return
    if (capture.endOn.has(event.type)) {
      capture.queuedEvents.push(event)
      capture.ended = true
      return
    }
    if (capture.trackOn.has(event.type)) {
      capture.queuedEvents.push(event)
    }
  }

  /** Emits the ordinary start event through RuntimePlayer's single event circuit. */
  private async emitStartEvent(rule: CompiledEmitRule, storyId: string): Promise<void> {
    const event = rule.event
    try {
      const result = await this.player.emit({
        name: event.name,
        applyAtMs: this.player.getCurrentTimeMs(),
        storyId: event.cascade === true ? undefined : storyId,
        cascade: event.cascade,
        data: event.data,
        mode: event.mode,
      })
      if (!result.ok) this.reportError(new Error(`Capture start event was rejected: ${event.name}`))
    } catch (error: unknown) {
      this.reportError(error)
    }
  }

  /** Applies one pointer sample or closes one active capture at its declared boundary. */
  private routeActiveCapture(capture: ActiveCapture, event: Event): void {
    const eventPointerId = readPointerId(event)
    if (!matchesPointer(capture.pointerId, eventPointerId)) return
    if (capture.endOn.has(event.type)) {
      this.activeCaptures.delete(capture.captureId)
      let captureState = capture.captureState
      try {
        captureState = this.resolveEndCaptureState?.({
          captureId: capture.captureId,
          persoKey: capture.persoKey,
          captureState,
          event,
        }) ?? captureState
      } catch (error) {
        this.player.cancelCapture(capture.captureId)
        this.reportError(error)
        this.onCaptureClose?.({
          captureId: capture.captureId,
          persoKey: capture.persoKey,
          completed: false,
        })
        return
      }
      void this.player.endCapture(capture.captureId, {
        source: 'html-pointer',
        eventType: event.type,
      }, captureState).then((result) => {
        if (!result.ok) this.reportError(new Error(result.message))
        this.onCaptureClose?.({
          captureId: capture.captureId,
          persoKey: capture.persoKey,
          completed: result.ok,
        })
      }).catch((error: unknown) => {
        this.reportError(error)
        this.onCaptureClose?.({
          captureId: capture.captureId,
          persoKey: capture.persoKey,
          completed: false,
        })
      })
      return
    }
    if (!capture.trackOn.has(event.type)) return

    const sample = readPointerSample(event)
    if (sample === undefined) {
      this.reportError(new Error(`Pointer capture event has no numeric pointer sample: ${event.type}`))
      return
    }
    const tracked = this.player.trackCapture(capture.captureId, sample)
    if (!tracked.ok) this.reportError(new Error(tracked.message))
    else {
      this.activeCaptures.set(capture.captureId, { ...capture, captureState: tracked.captureState })
      try {
        this.onCaptureTrack?.({
          captureId: capture.captureId,
          persoKey: capture.persoKey,
          sample,
          captureState: tracked.captureState,
        })
      } catch (error) {
        this.reportError(error)
      }
    }
  }

  /** Sends source failures to the host without throwing from a native listener. */
  private reportError(error: unknown): void {
    this.onError?.(error)
  }
}

/** Normalizes one compiled declaration entry to a rule list. */
function normalizeRules(
  value: CompiledEmitRule | readonly CompiledEmitRule[] | undefined,
): readonly CompiledEmitRule[] {
  if (value === undefined) return []
  if (Array.isArray(value)) return [...(value as readonly CompiledEmitRule[])]
  return [value as CompiledEmitRule]
}

/** Selects only native pointer events understood by this first HTML adapter. */
function pointerEventNames(values: readonly string[] | undefined, fallback: string): ReadonlySet<string> {
  return new Set((values ?? [fallback]).filter((value) => value.startsWith('pointer')))
}

/** Finds the nearest materialized perso root in an event target's ancestor chain. */
function resolvePersoKey(
  nodes: HtmlPointerCaptureSourceNodes,
  target: EventTarget | null,
): string | undefined {
  let current: unknown = target
  const visited = new Set<unknown>()
  while (current !== null && current !== undefined && !visited.has(current)) {
    visited.add(current)
    for (const [persoKey, root] of nodes.persoNodes) {
      for (const node of materializedRootNodes(root)) {
        if (node === current) return persoKey
      }
    }
    if (!isParentNode(current)) break
    current = current.parentNode
  }
  return undefined
}

/** Expands one persistent HTML root or fragment roots for event hit resolution. */
function materializedRootNodes(root: unknown): readonly unknown[] {
  if (root === undefined || root === null) return []
  return Array.isArray(root) ? root : [root]
}

/** Narrows one event target to the parent relationship needed by the adapter. */
function isParentNode(value: unknown): value is Readonly<{ parentNode: unknown | null }> {
  return typeof value === 'object' && value !== null && 'parentNode' in value
}

/** Extracts the documented pointer sample without calculating or changing values. */
function readPointerSample(event: Event): RuntimeCaptureSample | undefined {
  const pointer = event as Partial<PointerEvent>
  if (!isFiniteNumber(pointer.clientX)
    || !isFiniteNumber(pointer.clientY)
    || !isFiniteNumber(pointer.movementX)
    || !isFiniteNumber(pointer.movementY)) return undefined
  return {
    clientX: pointer.clientX,
    clientY: pointer.clientY,
    movementX: pointer.movementX,
    movementY: pointer.movementY,
  }
}

/** Reads the native pointer identity used to keep concurrent pointers isolated. */
function readPointerId(event: Event): number | undefined {
  const value = (event as Partial<PointerEvent>).pointerId
  return isFiniteNumber(value) ? value : undefined
}

/** Keeps one active capture bound to the pointer that opened it. */
function matchesPointer(activePointerId: number | undefined, eventPointerId: number | undefined): boolean {
  return activePointerId === undefined || eventPointerId === undefined || activePointerId === eventPointerId
}
