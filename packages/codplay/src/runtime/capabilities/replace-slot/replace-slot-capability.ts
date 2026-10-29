import { prepareTween, resolveTweenProgress } from 'ace'
import { parseSlotReplaceProfile } from './replace-slot-profile'
import type {
  ComponentActionOccurrence,
  ComponentAnimation,
  ReplaceComponentSurface,
  ReplacePresentationSession,
  SlotReplaceProfile,
  SlotReplaceShape,
  SlotReplaceTransition,
} from '../../components'
import type {
  RuntimeComponentUpdateContext,
  RuntimeExternalPresentation,
  RuntimeExternalPresentationRequest,
  RuntimeModuleServiceContext,
  RuntimeModuleServiceInstance,
} from '../../engine'
import type { RuntimeModuleServiceDefinition } from '../../catalog'

/** Player-scoped runtime identifier for the slot-only replacement module. */
export const REPLACE_SLOT_MODULE_SERVICE_ID = 'replace-slot' as const

/** Interlude-based default durations, with a local default for mask-reveal. */
const DEFAULT_DURATION_BY_TRANSITION: Readonly<Record<SlotReplaceTransition, number>> = {
  fade: 300,
  'fade-in': 300,
  'mask-reveal': 900,
  curtain: 1000,
  wipe: 900,
  'slide-over': 1100,
  stack: 2000,
}

type ReplaceSlotCommand = SlotReplaceProfile & Readonly<{
  duration: number
}>

type ReplaceOccurrence = Readonly<{
  key: string
  action: ComponentActionOccurrence
  command: ReplaceSlotCommand
}>

type ActiveReplaceSession = {
  key: string
  session: ReplacePresentationSession
  animation?: ComponentAnimation
}

type ActiveExternalSession = {
  session: ReplacePresentationSession
  cancel: () => void
  complete?: () => void
}

/** Creates the player-scoped slot replacement module declaration. */
export function createReplaceSlotModuleServiceDefinition(): RuntimeModuleServiceDefinition {
  return {
    id: REPLACE_SLOT_MODULE_SERVICE_ID,
    create: (context) => createReplaceSlotModuleService(context),
  }
}

/** Creates one slot service for authored updates and external mount replacement. */
export function createReplaceSlotModuleService(
  context: RuntimeModuleServiceContext,
): RuntimeModuleServiceInstance {
  const getReplaceSurface = context.componentSurfaces === undefined
    ? (_componentId: string): ReplaceComponentSurface | undefined => undefined
    : (componentId: string) => context.componentSurfaces?.getReplaceSurface?.(componentId)
  const sessions = new Map<string, ActiveReplaceSession>()
  const externalSessions = new Map<string, ActiveExternalSession>()
  const handledOccurrences = new Map<string, string>()
  const slotContentSignatures = new Map<string, string>()
  let nextSessionId = 1

  /** Cancels one timeline session and removes its runtime bookkeeping. */
  function cancelSession(componentId: string): void {
    const active = sessions.get(componentId)
    if (active === undefined) return
    active.session.cancel()
    sessions.delete(componentId)
  }

  /** Cancels one externally clocked presentation if it is still active. */
  function cancelExternalSession(componentId: string): void {
    externalSessions.get(componentId)?.cancel()
  }

  /** Starts or preserves a timeline presentation before one slot state update. */
  function beforeComponentUpdate(update: RuntimeComponentUpdateContext): void {
    if (update.componentType !== 'slot') return
    const contentSignature = createSlotContentSignature(update.state.content)
    const contentChanged = slotContentSignatures.has(update.componentId)
      && slotContentSignatures.get(update.componentId) !== contentSignature
    slotContentSignatures.set(update.componentId, contentSignature)
    const occurrence = resolveLatestReplaceOccurrence(update.activeActions)
    const active = sessions.get(update.componentId)
    const isNewOccurrence = occurrence !== undefined
      && active?.key !== occurrence.key
      && handledOccurrences.get(update.componentId) !== occurrence.key
    if (update.phase === 'normal' && (contentChanged || isNewOccurrence)) {
      cancelExternalSession(update.componentId)
    }
    if (!contentChanged && !isNewOccurrence) {
      externalSessions.get(update.componentId)?.session.reflow?.()
    }
    if (update.phase === 'geometry-capture') {
      cancelSession(update.componentId)
      if (occurrence !== undefined) handledOccurrences.set(update.componentId, occurrence.key)
      else handledOccurrences.delete(update.componentId)
      return
    }

    if (occurrence === undefined) {
      cancelSession(update.componentId)
      handledOccurrences.delete(update.componentId)
      return
    }
    if (active?.key === occurrence.key) {
      active.session.reflow?.()
      return
    }
    if (handledOccurrences.get(update.componentId) === occurrence.key) return

    cancelSession(update.componentId)
    const session = getReplaceSurface(update.componentId)?.begin(occurrence.command)
    if (session === undefined) return
    handledOccurrences.set(update.componentId, occurrence.key)
    sessions.set(update.componentId, { key: occurrence.key, session })
  }

  /** Registers one slot update on the player timeline. */
  function afterComponentUpdate(update: RuntimeComponentUpdateContext): void {
    if (update.componentType !== 'slot') return
    const occurrence = resolveLatestReplaceOccurrence(update.activeActions)
    const active = sessions.get(update.componentId)
    if (update.phase === 'geometry-capture' || occurrence === undefined || active?.key !== occurrence.key) return

    if (active.animation === undefined) {
      active.session.start()
      active.animation = createReplaceAnimation({
        componentId: update.componentId,
        key: occurrence.key,
        startAt: occurrence.action.startAt,
        command: occurrence.command,
        duration: active.session.getDuration?.() ?? occurrence.command.duration,
        session: active.session,
        sessions,
        sessionId: nextSessionId++,
      })
    }
    update.registerAnimation(active.animation)
  }

  /** Prepares one slot replacement with a clock independent of player seek and replay. */
  function prepareExternalPresentation(
    request: RuntimeExternalPresentationRequest,
  ): RuntimeExternalPresentation | undefined {
    if (request.kind !== REPLACE_SLOT_MODULE_SERVICE_ID) return undefined
    const command = normalizeReplaceSlotCommand(request.options)
    if (command === undefined) return undefined

    cancelExternalSession(request.componentId)
    const session = getReplaceSurface(request.componentId)?.begin(command)
    if (session === undefined) return undefined

    let completed = false
    let started = false
    const duration = session.getDuration?.() ?? command.duration
    const timing = prepareTween({
      from: 0,
      to: 1,
      duration: Math.max(1, duration),
      ease: 'linear',
    })
    const active: ActiveExternalSession = {
      session,
      cancel: () => {
        if (completed) return
        completed = true
        if (externalSessions.get(request.componentId) === active) {
          externalSessions.delete(request.componentId)
        }
        session.cancel()
        const complete = active.complete
        active.complete = undefined
        complete?.()
      },
    }
    const complete = (): void => {
      if (completed) return
      completed = true
      if (externalSessions.get(request.componentId) === active) {
        externalSessions.delete(request.componentId)
      }
      session.finish()
      const onComplete = active.complete
      active.complete = undefined
      onComplete?.()
    }
    const animation: ComponentAnimation = {
      id: `replace-slot:operation:${request.componentId}:${nextSessionId++}`,
      startAt: 0,
      endAt: duration,
      sample: (timeMs) => {
        if (!started || completed) return undefined
        const progress = duration === 0 ? 1 : resolveTweenProgress(timing, timeMs)
        return {
          value: progress,
          apply: () => {
            session.sample(progress)
            if (progress >= 1) complete()
          },
        }
      },
    }
    externalSessions.set(request.componentId, active)

    return {
      clock: 'operation',
      animation,
      start: (onComplete) => {
        if (started || completed) return
        started = true
        active.complete = onComplete
        session.start()
        session.sample(0)
      },
      cancel: active.cancel,
    }
  }

  /** Cancels timeline snapshots when an authored component update fails. */
  function onComponentUpdateError(update: RuntimeComponentUpdateContext): void {
    if (update.componentType === 'slot') cancelSession(update.componentId)
  }

  /** Reconstructs authored timeline sessions; external mount sessions remain independent. */
  function beforeSeek(): void {
    for (const componentId of [...sessions.keys()]) cancelSession(componentId)
    handledOccurrences.clear()
  }

  /** Releases both authored snapshots and external mount presentations. */
  function destroy(): void {
    beforeSeek()
    for (const componentId of [...externalSessions.keys()]) cancelExternalSession(componentId)
    sessions.clear()
    externalSessions.clear()
    handledOccurrences.clear()
    slotContentSignatures.clear()
    nextSessionId = 1
  }

  return {
    beforeComponentUpdate,
    afterComponentUpdate,
    prepareExternalPresentation,
    onComponentUpdateError,
    beforeSeek,
    destroy,
  }
}

/** Normalizes author or facade input and applies the selected profile defaults. */
export function normalizeReplaceSlotCommand(rawReplace: unknown): ReplaceSlotCommand | undefined {
  const profile = parseSlotReplaceProfile(rawReplace)
  if (profile === undefined) return undefined
  if (typeof profile === 'string') return createReplaceSlotCommand(profile)
  const { transition, ...settings } = profile
  return createReplaceSlotCommand(transition, settings)
}

/** Builds a stable signature for the JSON-compatible foreign slot reference. */
function createSlotContentSignature(content: unknown): string {
  return JSON.stringify({ content }) ?? ''
}

/** Applies the profile defaults and retains its shared SVG grid settings. */
function createReplaceSlotCommand(
  transition: SlotReplaceTransition,
  settings: Readonly<{
    duration?: number
    shape?: SlotReplaceShape
    split?: SlotReplaceProfile['split']
    stagger?: number
    staggerPattern?: SlotReplaceProfile['staggerPattern']
    direction?: SlotReplaceProfile['direction']
    cellX?: number
    cellY?: number
    cellSize?: number
  }> = {},
): ReplaceSlotCommand {
  return {
    transition,
    duration: settings.duration ?? DEFAULT_DURATION_BY_TRANSITION[transition],
    ...(settings.shape === undefined
      ? transition === 'mask-reveal' ? { shape: 'circle' as const } : {}
      : { shape: settings.shape }),
    ...(settings.split === undefined ? {} : { split: settings.split }),
    ...(settings.stagger === undefined ? {} : { stagger: settings.stagger }),
    ...(settings.staggerPattern === undefined ? {} : { staggerPattern: settings.staggerPattern }),
    ...(settings.direction === undefined ? {} : { direction: settings.direction }),
    ...(settings.cellX === undefined ? {} : { cellX: settings.cellX }),
    ...(settings.cellY === undefined ? {} : { cellY: settings.cellY }),
    ...(settings.cellSize === undefined ? {} : { cellSize: settings.cellSize }),
  }
}

/** Selects the latest slot replace occurrence that changes opaque slot content. */
function resolveLatestReplaceOccurrence(
  actions: readonly ComponentActionOccurrence[],
): ReplaceOccurrence | undefined {
  let latest: ReplaceOccurrence | undefined
  for (const action of actions) {
    if (action.action.content === undefined) continue
    const command = normalizeReplaceSlotCommand(action.action.replace)
    if (command === undefined) continue
    latest = { key: createOccurrenceKey(action), action, command }
  }
  return latest
}

/** Creates one stable occurrence key for timeline reconstruction. */
function createOccurrenceKey(action: ComponentActionOccurrence): string {
  return `${action.eventId ?? action.name}:${action.startAt}`
}

/** Registers a timeline animation that samples only the presentation snapshots. */
function createReplaceAnimation(options: Readonly<{
  componentId: string
  key: string
  startAt: number
  command: ReplaceSlotCommand
  duration: number
  session: ReplacePresentationSession
  sessions: Map<string, ActiveReplaceSession>
  sessionId: number
}>): ComponentAnimation {
  const endAt = options.startAt + options.duration
  return {
    id: `replace-slot:${options.componentId}:${options.key}:${options.sessionId}`,
    startAt: options.startAt,
    endAt,
    sample: (timeMs) => {
      if (timeMs < options.startAt) return undefined
      if (timeMs >= endAt) {
        return {
          value: 'complete',
          apply: () => {
            options.session.finish()
            const active = options.sessions.get(options.componentId)
            if (active?.session === options.session) options.sessions.delete(options.componentId)
          },
        }
      }
      const progress = endAt === options.startAt
        ? 1
        : (timeMs - options.startAt) / (endAt - options.startAt)
      const normalized = Math.min(1, Math.max(0, progress))
      return { value: normalized, apply: () => options.session.sample(normalized) }
    },
  }
}

