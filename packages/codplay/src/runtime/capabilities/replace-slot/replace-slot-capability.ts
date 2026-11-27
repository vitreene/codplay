import { prepareTween, resolveTweenProgress } from 'ace'
import { parseSlotReplaceProfile } from './replace-slot-profile'
import type {
  ComponentActionOccurrence,
  ComponentAnimation,
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
import {
  createPlayerReplaceAnimation,
  collectReplaceSeekOccurrences,
  findLatestReplaceCandidate,
  createReplaceSurfaceResolver,
  ReplaceTimelineSessions,
  type ReplaceSeekOccurrence,
} from '../replace-session'

/** Player-scoped runtime identifier for the slot-only replacement module. */
export const REPLACE_SLOT_MODULE_SERVICE_ID = 'replace-slot' as const

/** Interlude-based default durations, with a local default for mask-reveal. */
const DEFAULT_DURATION_BY_TRANSITION: Readonly<Record<SlotReplaceTransition, number>> = {
  fade: 300,
  'fade-in': 300,
  'mask-reveal': 900,
  burn: 900,
  ripple: 900,
  pixelate: 900,
  swirl: 900,
  shatter: 900,
  fold: 900,
  curtain: 1000,
  wipe: 900,
  'slide-over': 1100,
  stack: 2000,
}

type ReplaceSlotCommand = SlotReplaceProfile & Readonly<{
  duration: number
}>

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
  const getReplaceSurface = createReplaceSurfaceResolver(context)
  const sessions = new ReplaceTimelineSessions(collectSlotSeekOccurrences)
  const externalSessions = new Map<string, ActiveExternalSession>()
  const slotContentSignatures = new Map<string, string>()

  /** Cancels one externally clocked presentation if it is still active. */
  function cancelExternalSession(componentId: string): void {
    externalSessions.get(componentId)?.cancel()
  }

  /** Starts or preserves a timeline presentation before one slot state update. */
  function beforeComponentUpdate(update: RuntimeComponentUpdateContext): void {
    if (update.componentType !== 'slot') return
    // Stable signature of the JSON-compatible foreign slot reference.
    const contentSignature = JSON.stringify({ content: update.state.content }) ?? ''
    const contentChanged = slotContentSignatures.has(update.componentId)
      && slotContentSignatures.get(update.componentId) !== contentSignature
    slotContentSignatures.set(update.componentId, contentSignature)
    const occurrence = findLatestReplaceCandidate(update.activeActions, readSlotCommand)
    const isNewOccurrence = occurrence !== undefined
      && sessions.get(update.componentId)?.key !== occurrence.key
      && !sessions.isHandled(update.componentId, occurrence.key)
    if (update.phase === 'normal' && (contentChanged || isNewOccurrence)) {
      cancelExternalSession(update.componentId)
    }
    if (!contentChanged && !isNewOccurrence) {
      externalSessions.get(update.componentId)?.session.reflow?.()
    }
    if (!sessions.needsSession(update, occurrence?.key) || occurrence === undefined) return

    sessions.cancel(update.componentId)
    const session = getReplaceSurface(update.componentId)?.begin(occurrence.command)
    if (session === undefined) return
    sessions.open(update.componentId, { key: occurrence.key, session })
  }

  /** Registers one slot update on the player timeline. */
  function afterComponentUpdate(update: RuntimeComponentUpdateContext): void {
    if (update.componentType !== 'slot') return
    const occurrence = findLatestReplaceCandidate(update.activeActions, readSlotCommand)
    const active = sessions.activeFor(update, occurrence?.key)
    if (active === undefined || occurrence === undefined) return

    if (active.animation === undefined) {
      const { session } = active
      session.start()
      active.animation = createPlayerReplaceAnimation({
        id: `replace-slot:${update.componentId}:${occurrence.key}:${sessions.nextId()}`,
        startAt: occurrence.action.startAt,
        duration: session.getDuration?.() ?? occurrence.command.duration,
        sample: (progress) => session.sample(progress),
        complete: () => {
          session.finish()
          sessions.release(update.componentId, session)
        },
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
      id: `replace-slot:operation:${request.componentId}:${sessions.nextId()}`,
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
    if (update.componentType === 'slot') sessions.cancel(update.componentId)
  }

  /** Releases both authored snapshots and external mount presentations. */
  function destroy(): void {
    sessions.destroy()
    for (const componentId of [...externalSessions.keys()]) cancelExternalSession(componentId)
    externalSessions.clear()
    slotContentSignatures.clear()
  }

  return {
    beforeComponentUpdate,
    afterComponentUpdate,
    prepareExternalPresentation,
    onComponentUpdateError,
    // Authored timeline sessions are reconstructed; external mount sessions remain independent.
    beforeSeek: () => sessions.cancelAll(),
    prepareSeek: (scene) => sessions.prepareSeek(scene),
    onScenePresented: () => sessions.endSeek(),
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

/** Reads the slot profile of one action that changes the opaque slot content, or undefined. */
function readSlotCommand(action: ComponentActionOccurrence): ReplaceSlotCommand | undefined {
  return action.action.content === undefined ? undefined : normalizeReplaceSlotCommand(action.action.replace)
}

/** Lists the slot replace occurrences of one perso with an upper bound of their end. */
function collectSlotSeekOccurrences(
  persoType: string,
  actions: readonly ComponentActionOccurrence[],
): readonly ReplaceSeekOccurrence[] {
  if (persoType !== 'slot') return []
  return collectReplaceSeekOccurrences(actions, readSlotCommand, (command) => ({
    durationMs: command.duration,
    propagates: command.split === 'cells',
    staggerMs: command.stagger,
  }))
}
