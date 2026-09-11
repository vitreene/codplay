import type {
  ComponentActionOccurrence,
  ComponentAnimation,
  ReplaceComponentSurface,
  ReplacePresentationSession,
} from '../../components'
import type {
  RuntimeComponentUpdateContext,
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
  transition: 'fade'
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
    if (update.phase !== 'normal') {
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
    const session = getReplaceSurface(update.componentId)?.begin()
    if (session === undefined) return
    handledOccurrences.set(update.componentId, occurrence.key)
    sessions.set(update.componentId, {
      key: occurrence.key,
      session,
    })
  }

  /** Finishes the hook pair by registering one player-clocked simple fade. */
  function afterComponentUpdate(update: RuntimeComponentUpdateContext): void {
    const occurrence = resolveLatestReplaceOccurrence(update.activeActions)
    const active = sessions.get(update.componentId)
    if (update.phase !== 'normal' || occurrence === undefined || active?.key !== occurrence.key) return

    if (active.animation === undefined) {
      active.session.start()
      active.animation = createReplaceAnimation(
        update.componentId,
        occurrence,
        active.session,
        sessions,
        nextSessionId++,
      )
    }
    update.registerAnimation(active.animation)
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
    onComponentUpdateError,
    beforeSeek,
    destroy,
  }
}

/** Normalizes the supported fade form and deliberately discards `split`. */
export function normalizeReplaceSimpleCommand(rawReplace: unknown): ReplaceSimpleCommand | undefined {
  if (rawReplace === 'fade') return { transition: 'fade', duration: DEFAULT_REPLACE_DURATION_MS }
  if (!isRecord(rawReplace) || rawReplace.transition !== 'fade') return undefined
  const duration = rawReplace.duration
  if (duration === undefined) return { transition: 'fade', duration: DEFAULT_REPLACE_DURATION_MS }
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) return undefined
  return { transition: 'fade', duration }
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

/** Registers a simple fade whose samples mutate only the presentation surface. */
function createReplaceAnimation(
  componentId: string,
  occurrence: ReplaceOccurrence,
  session: ReplacePresentationSession,
  sessions: Map<string, ActiveReplaceSession>,
  sessionId: number,
): ComponentAnimation {
  const startAt = occurrence.action.startAt
  const endAt = startAt + occurrence.command.duration
  const animationId = `replace:${componentId}:${occurrence.key}:${sessionId}`

  return {
    id: animationId,
    startAt,
    endAt,
    sample: (timeMs) => {
      if (timeMs < startAt) return undefined
      if (timeMs >= endAt) {
        return {
          value: 'complete',
          apply: () => {
            session.finish()
            const active = sessions.get(componentId)
            if (active?.session === session) sessions.delete(componentId)
          },
        }
      }
      const progress = endAt === startAt ? 1 : (timeMs - startAt) / (endAt - startAt)
      const normalized = Math.min(1, Math.max(0, progress))
      return {
        value: normalized,
        apply: () => session.sample(normalized),
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
