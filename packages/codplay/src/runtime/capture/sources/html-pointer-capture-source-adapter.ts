import type { RuntimeCaptureSourcePort, RuntimeCaptureSourceSession } from '../capture-source-circuit'
import type { RuntimeCaptureSample, RuntimeCaptureState } from '../capture-types'
import { isFiniteNumber } from '../../../shared'

const GLOBAL_EVENT_LISTENER_OPTIONS = { capture: true } as const

/** Nodes used to associate a browser event target with its compiled perso. */
export type HtmlPointerCaptureSourceNodes = Readonly<{
  persoNodes: ReadonlyMap<string, unknown>
}>

/** Dependencies of the pointer event adapter after capture orchestration moved to core. */
export type HtmlPointerCaptureSourceAdapterOptions = Readonly<{
  captureSources: RuntimeCaptureSourcePort
  nodes: HtmlPointerCaptureSourceNodes
  eventTarget?: EventTarget
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

type PointerCaptureGroup = {
  id: number
  persoKey: string
  pointerId?: number
  sessions: RuntimeCaptureSourceSession[]
}

/**
 * Converts native pointer events into samples for the shared capture circuit.
 * It owns DOM listeners and pointer identity only.
 */
export class HtmlPointerCaptureSourceAdapter {
  private readonly captureSources: RuntimeCaptureSourcePort
  private readonly nodes: HtmlPointerCaptureSourceNodes
  private readonly eventTarget: EventTarget | undefined
  private readonly onCaptureTrack: HtmlPointerCaptureSourceAdapterOptions['onCaptureTrack']
  private readonly resolveEndCaptureState: HtmlPointerCaptureSourceAdapterOptions['resolveEndCaptureState']
  private readonly onCaptureClose: HtmlPointerCaptureSourceAdapterOptions['onCaptureClose']
  private readonly groups = new Map<number, PointerCaptureGroup>()
  private readonly listeners = new Map<string, (event: Event) => void>()
  private destroyed = false
  private nextGroupId = 0

  /** Creates one adapter without registering browser listeners. */
  constructor(options: HtmlPointerCaptureSourceAdapterOptions) {
    this.captureSources = options.captureSources
    this.nodes = options.nodes
    this.eventTarget = options.eventTarget
    this.onCaptureTrack = options.onCaptureTrack
    this.resolveEndCaptureState = options.resolveEndCaptureState
    this.onCaptureClose = options.onCaptureClose
  }

  /** Registers the compiled pointer event types once the visible player is ready. */
  attach(): void {
    if (this.destroyed || this.eventTarget === undefined || this.listeners.size > 0) return
    const eventTypes = new Set(this.captureSources.getEventTypes('pointerdown'))
    for (const eventType of eventTypes) {
      const listener = (event: Event): void => this.handleSourceEvent(event)
      this.listeners.set(eventType, listener)
      this.eventTarget.addEventListener(eventType, listener, GLOBAL_EVENT_LISTENER_OPTIONS)
    }
  }

  /** Cancels open source sessions and removes the global listeners. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.eventTarget !== undefined) {
      for (const [eventType, listener] of this.listeners) {
        this.eventTarget.removeEventListener(eventType, listener, GLOBAL_EVENT_LISTENER_OPTIONS)
      }
    }
    this.listeners.clear()
    for (const group of this.groups.values()) {
      for (const session of group.sessions) session.cancel()
    }
    this.groups.clear()
  }

  /** Routes each native event to matching pointers, then opens on pointerdown. */
  private handleSourceEvent(event: Event): void {
    if (this.destroyed) return
    for (const group of [...this.groups.values()]) {
      if (!matchesPointer(group.pointerId, readPointerId(event))) continue
      const sample = readPointerSample(event)
      for (const session of [...group.sessions]) {
        session.route({
          eventType: event.type,
          ...(sample === undefined ? {} : { sample }),
          meta: { source: 'html-pointer', eventType: event.type },
          resolveCaptureState: (captureState) => this.resolveEndState(
            session,
            group,
            captureState,
            event,
          ),
        })
      }
    }
    if (event.type === 'pointerdown') this.openCaptures(event)
  }

  /** Starts all compiled pointerdown rules carried by the perso under the event target. */
  private openCaptures(event: Event): void {
    const persoKey = resolvePersoKey(this.nodes, event.target)
    if (persoKey === undefined) return
    const identity = this.captureSources.resolveIdentity(persoKey)
    if (identity === undefined) return
    const group: PointerCaptureGroup = {
      id: this.nextGroupId++,
      persoKey,
      pointerId: readPointerId(event),
      sessions: [],
    }
    const closedDuringOpen = new Set<string>()
    const sessions = this.captureSources.open(identitySource(identity, 'pointerdown'), {
      onTrack: (input) => {
        try {
          this.onCaptureTrack?.({
            captureId: input.captureId,
            persoKey,
            sample: input.sample,
            captureState: input.captureState,
          })
        } catch (error) {
          throw error
        }
      },
      onClose: (input) => {
        closedDuringOpen.add(input.captureId)
        const currentGroup = this.groups.get(group.id) ?? group
        currentGroup.sessions = currentGroup.sessions.filter((session) => session.captureId !== input.captureId)
        try {
          this.onCaptureClose?.({
            captureId: input.captureId,
            persoKey,
            completed: input.completed,
          })
        } finally {
          if (currentGroup.sessions.length === 0) this.groups.delete(currentGroup.id)
        }
      },
    })
    group.sessions.push(...sessions.filter((session) => !closedDuringOpen.has(session.captureId)))
    if (group.sessions.length > 0) this.groups.set(group.id, group)
  }

  /** Resolves the final pointer state while keeping the native event at this boundary. */
  private resolveEndState(
    session: RuntimeCaptureSourceSession,
    group: PointerCaptureGroup,
    captureState: RuntimeCaptureState,
    event: Event,
  ): RuntimeCaptureState | undefined {
    return this.resolveEndCaptureState?.({
      captureId: session.captureId,
      persoKey: group.persoKey,
      captureState,
      event,
    })
  }
}

/** Combines one known story and perso identity with its source key. */
function identitySource(
  identity: Readonly<{ storyId: string; persoId: string }>,
  source: string,
): Readonly<{ storyId: string; persoId: string; source: string }> {
  return { ...identity, source }
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
