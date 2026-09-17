import type {
  ComponentActionOccurrence,
  ComponentAnimation,
  ReplaceComponentSurface,
  ReplacePresentationSession,
  ReplaceTransition,
} from '../../components'
import type {
  RuntimeComponentUpdateContext,
  RuntimeExternalPresentation,
  RuntimeExternalPresentationRequest,
  RuntimeModuleServiceContext,
  RuntimeModuleServiceInstance,
} from '../../engine'
import type { RuntimeModuleServiceDefinition } from '../../catalog'

/** Player-scoped runtime identifier for the shared simple replacement module. */
export const REPLACE_MODULE_SERVICE_ID = 'replace' as const

/** Default duration retained from the V1 `fade` transition definition. */
export const DEFAULT_REPLACE_DURATION_MS = 300

/** Normalized command supported by the first V2 replace profile. */
export type ReplaceSimpleCommand = Readonly<{
  transition: ReplaceTransition
  duration: number
}>

type ReplaceOccurrence = Readonly<{
  key: string
  action: ComponentActionOccurrence
  command: ReplaceSimpleCommand
}>

type ActiveReplaceSession = {
  key: string
  session: ReplacePresentationSession
  animation?: ComponentAnimation
}

/** Creates the shared player-scoped replace module declaration. */
export function createReplaceModuleServiceDefinition(): RuntimeModuleServiceDefinition {
  return {
    id: REPLACE_MODULE_SERVICE_ID,
    create: (context) => createReplaceModuleService(context),
  }
}

/** Creates one replace service that coordinates hooks and presentation sessions. */
export function createReplaceModuleService(
  context: RuntimeModuleServiceContext,
): RuntimeModuleServiceInstance {
  const getReplaceSurface = context.componentSurfaces === undefined
    ? (_componentId: string): ReplaceComponentSurface | undefined => undefined
    : (componentId: string) => context.componentSurfaces?.getReplaceSurface?.(componentId)
  const sessions = new Map<string, ActiveReplaceSession>()
  const handledOccurrences = new Map<string, string>()
  let nextSessionId = 1

  /** Cancels one presentation session and removes its runtime bookkeeping. */
  function cancelSession(componentId: string): void {
    const active = sessions.get(componentId)
    if (active === undefined) return
    active.session.cancel()
    sessions.delete(componentId)
  }

  /** Starts or preserves the presentation session before a logical component update. */
  function beforeComponentUpdate(update: RuntimeComponentUpdateContext): void {
    const occurrence = resolveLatestReplaceOccurrence(update.activeActions)
    if (update.phase === 'geometry-capture') {
      cancelSession(update.componentId)
      if (occurrence !== undefined) handledOccurrences.set(update.componentId, occurrence.key)
      else handledOccurrences.delete(update.componentId)
      return
    }

    const active = sessions.get(update.componentId)
    if (occurrence === undefined) {
      cancelSession(update.componentId)
      handledOccurrences.delete(update.componentId)
      return
    }
    if (active?.key === occurrence.key) return
    if (handledOccurrences.get(update.componentId) === occurrence.key) return

    cancelSession(update.componentId)
    const session = getReplaceSurface(update.componentId)?.begin(occurrence.command.transition)
    if (session === undefined) return
    handledOccurrences.set(update.componentId, occurrence.key)
    sessions.set(update.componentId, {
      key: occurrence.key,
      session,
    })
  }

  /** Finishes the hook pair by registering one player-clocked replacement transition. */
  function afterComponentUpdate(update: RuntimeComponentUpdateContext): void {
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
        session: active.session,
        sessions,
        sessionId: nextSessionId++,
      })
    }
    update.registerAnimation(active.animation)
  }

  /** Prepares the same replacement transition for a foreign mount initiated outside component update. */
  function prepareExternalPresentation(
    request: RuntimeExternalPresentationRequest,
  ): RuntimeExternalPresentation | undefined {
    if (request.kind !== REPLACE_MODULE_SERVICE_ID) return undefined
    const command = normalizeReplaceSimpleCommand(request.options)
    if (command === undefined) return undefined

    cancelSession(request.componentId)
    const session = getReplaceSurface(request.componentId)?.begin(command.transition)
    if (session === undefined) return undefined

    const sessionId = nextSessionId++
    const key = `external:${sessionId}`
    sessions.set(request.componentId, { key, session })
    const animation = createReplaceAnimation({
      componentId: request.componentId,
      key,
      startAt: request.timeMs,
      command,
      session,
      sessions,
      sessionId,
    })
    sessions.get(request.componentId)!.animation = animation

    return {
      start: session.start,
      animation,
      cancel: () => {
        const active = sessions.get(request.componentId)
        if (active?.session === session) cancelSession(request.componentId)
        else session.cancel()
      },
    }
  }

  /** Removes a prepared snapshot when the component update throws. */
  function onComponentUpdateError(update: RuntimeComponentUpdateContext): void {
    cancelSession(update.componentId)
  }

  /** Cancels presentation sessions before a player reconstructs a seek target. */
  function beforeSeek(): void {
    for (const componentId of [...sessions.keys()]) cancelSession(componentId)
    handledOccurrences.clear()
  }

  /** Releases all snapshots and resets the player-scoped replacement state. */
  function destroy(): void {
    beforeSeek()
    sessions.clear()
    handledOccurrences.clear()
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

/** Normalizes the supported replacement forms and deliberately discards `split`. */
export function normalizeReplaceSimpleCommand(rawReplace: unknown): ReplaceSimpleCommand | undefined {
  if (rawReplace === 'fade' || rawReplace === 'fade-in') {
    return { transition: rawReplace, duration: DEFAULT_REPLACE_DURATION_MS }
  }
  if (!isRecord(rawReplace) || !isReplaceTransition(rawReplace.transition)) return undefined
  const duration = rawReplace.duration
  if (duration === undefined) return { transition: rawReplace.transition, duration: DEFAULT_REPLACE_DURATION_MS }
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) return undefined
  return { transition: rawReplace.transition, duration }
}

/** Selects the latest replace occurrence that also declares a target content change. */
function resolveLatestReplaceOccurrence(
  actions: readonly ComponentActionOccurrence[],
): ReplaceOccurrence | undefined {
  let latest: ReplaceOccurrence | undefined
  for (const action of actions) {
    if (!hasReplaceTarget(action.action)) continue
    const command = normalizeReplaceSimpleCommand(action.action.replace)
    if (command === undefined) continue
    latest = {
      key: createOccurrenceKey(action),
      action,
      command,
    }
  }
  return latest
}

/** Creates one stable occurrence key for transition replacement and replay guards. */
function createOccurrenceKey(action: ComponentActionOccurrence): string {
  return `${action.eventId ?? action.name}:${action.startAt}`
}

/** Registers a replacement transition whose samples mutate only the presentation surface. */
function createReplaceAnimation(options: Readonly<{
  componentId: string
  key: string
  startAt: number
  command: ReplaceSimpleCommand
  session: ReplacePresentationSession
  sessions: Map<string, ActiveReplaceSession>
  sessionId: number
}>): ComponentAnimation {
  const endAt = options.startAt + options.command.duration
  const animationId = `replace:${options.componentId}:${options.key}:${options.sessionId}`

  return {
    id: animationId,
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
      return {
        value: normalized,
        apply: () => options.session.sample(normalized),
      }
    },
  }
}

/** Checks whether one action has a replacement target understood by the shared module. */
function hasReplaceTarget(action: Readonly<Record<string, unknown>>): boolean {
  return action.content !== undefined || action.src !== undefined
}

/** Narrows one value to the open record shape used by compiled action payloads. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Checks whether an author payload names one supported replacement profile. */
function isReplaceTransition(value: unknown): value is ReplaceTransition {
  return value === 'fade' || value === 'fade-in'
}
