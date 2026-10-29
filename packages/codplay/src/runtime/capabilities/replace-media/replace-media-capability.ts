import type {
  ComponentActionOccurrence,
  ComponentAnimation,
  ReplaceComponentSurface,
  ReplaceMediaPresentationProfile,
  ReplaceMotionProfile,
  ReplacePresentationSession,
  ReplaceTransition,
  SlotReplaceProfile,
} from '../../components'
import type {
  RuntimeComponentUpdateContext,
  RuntimeModuleServiceContext,
  RuntimeModuleServiceInstance,
} from '../../engine'
import type { RuntimeModuleServiceDefinition } from '../../catalog'
import { MOVE_OPERATION_UNMOUNT } from '../../config/move'
import type { MoveStateDelta } from '../../move'
import {
  computeReplaceStaggerTiming,
  normalizeReplacePresetCommand,
  isReplaceSlotTransition,
} from '../replace-presets'
import {
  isFiniteNonNegativeNumber,
  isPlainRecord,
} from '../replace-presets/replace-value-validation'
import { normalizeReplaceSlotCommand } from '../replace-slot'

/** Player-scoped runtime identifier for image and video replacement presentations. */
export const REPLACE_MEDIA_MODULE_SERVICE_ID = 'replace-media' as const

/** Default duration retained from the V1 `fade` transition definition. */
export const DEFAULT_REPLACE_DURATION_MS = 300

/** Compatibility command shape retained for callers of the original image helper. */
export type ReplaceSimpleCommand = Readonly<{
  transition: ReplaceTransition
  duration: number
}>

type ReplaceMediaProfile = SlotReplaceProfile | ReplaceMediaPresentationProfile | ReplaceMotionProfile

export type ReplaceMediaCommand = Readonly<{
  profile: ReplaceMediaProfile
  duration: number
}>

type ReplaceOccurrence = Readonly<{
  key: string
  action: ComponentActionOccurrence
  command: ReplaceMediaCommand
}>

type ActiveReplaceSession = {
  key: string
  sessionId: number
  session: ReplacePresentationSession
  animation?: ComponentAnimation
  frameState?: 'ready' | 'error'
  waitingCancel?: () => void
  started?: boolean
}

const MEDIA_FRAME_EVENT_NAME = 'incoming-frame-state'

/** Creates the player-scoped image/video replacement module declaration. */
export function createReplaceMediaModuleServiceDefinition(): RuntimeModuleServiceDefinition {
  return {
    id: REPLACE_MEDIA_MODULE_SERVICE_ID,
    create: (context) => createReplaceMediaModuleService(context),
  }
}

/** Creates one media service that coordinates image and video snapshots on the player clock. */
export function createReplaceMediaModuleService(
  context: RuntimeModuleServiceContext,
): RuntimeModuleServiceInstance {
  const getReplaceSurface = context.componentSurfaces === undefined
    ? (_componentId: string): ReplaceComponentSurface | undefined => undefined
    : (componentId: string) => context.componentSurfaces?.getReplaceSurface?.(componentId)
  const getMediaTag = context.componentSurfaces === undefined
    ? (_componentId: string): 'audio' | 'video' | undefined => undefined
    : (componentId: string) => context.componentSurfaces?.getSurface(componentId, 'media')?.getMediaTag?.()
  const sessions = new Map<string, ActiveReplaceSession>()
  const handledOccurrences = new Map<string, string>()
  let nextSessionId = 1

  /** Cancels one presentation session and removes its runtime bookkeeping. */
  function cancelSession(componentId: string): void {
    const active = sessions.get(componentId)
    if (active === undefined) return
    active.waitingCancel?.()
    active.waitingCancel = undefined
    active.session.cancel()
    sessions.delete(componentId)
  }

  /** Starts or preserves the outgoing snapshot before an image/video source update. */
  function beforeComponentUpdate(update: RuntimeComponentUpdateContext): void {
    if (!supportsReplaceMedia(update, getMediaTag(update.componentId))) return
    const occurrence = resolveLatestReplaceOccurrence(update.activeActions)
    if (update.phase === 'geometry-capture') {
      cancelSession(update.componentId)
      if (occurrence !== undefined) handledOccurrences.set(update.componentId, occurrence.key)
      else handledOccurrences.delete(update.componentId)
      return
    }

    const active = sessions.get(update.componentId)
    if (active !== undefined && occurrence !== undefined && active.key === occurrence.key) {
      active.session.reflow?.()
      return
    }
    if (occurrence === undefined) {
      cancelSession(update.componentId)
      handledOccurrences.delete(update.componentId)
      return
    }
    if (handledOccurrences.get(update.componentId) === occurrence.key) return

    const interruptedSnapshot = active?.session.captureCurrent?.()
    cancelSession(update.componentId)
    const session = getReplaceSurface(update.componentId)?.begin(occurrence.command.profile, interruptedSnapshot)
    if (session === undefined) return
    handledOccurrences.set(update.componentId, occurrence.key)
    sessions.set(update.componentId, { key: occurrence.key, session, sessionId: nextSessionId++ })
  }

  /** Registers a media transition whose incoming frame is captured on the first player sample. */
  function afterComponentUpdate(update: RuntimeComponentUpdateContext): void {
    if (!supportsReplaceMedia(update, getMediaTag(update.componentId))) return
    const occurrence = resolveLatestReplaceOccurrence(update.activeActions)
    const active = sessions.get(update.componentId)
    if (update.phase === 'geometry-capture' || occurrence === undefined || active?.key !== occurrence.key) return

    if (active.animation === undefined) {
      active.animation = createReplaceAnimation({
        componentId: update.componentId,
        startAt: occurrence.action.startAt,
        duration: active.session.getDuration?.() ?? occurrence.command.duration,
        active,
        sessions,
        emitFrameState: (session, state) => {
          context.emitEvent?.({
            name: MEDIA_FRAME_EVENT_NAME,
            data: {
              componentId: update.componentId,
              occurrenceKey: session.key,
              sessionId: session.sessionId,
              state,
            },
          })
        },
      })
    }
    update.registerAnimation(active.animation)
  }

  /** Removes a prepared snapshot when the component update throws. */
  function onComponentUpdateError(update: RuntimeComponentUpdateContext): void {
    cancelSession(update.componentId)
  }

  /** Replays matching frame events after normal presentation and Seek reconstruction. */
  function onScenePresented(scene: Parameters<NonNullable<RuntimeModuleServiceInstance['onScenePresented']>>[0]): void {
    const events = context.getEvents?.(MEDIA_FRAME_EVENT_NAME) ?? []
    for (const [componentId, active] of sessions) {
      const event = events.find((candidate) => candidate.applyAtMs <= scene.timeMs
        && candidate.data?.componentId === componentId
        && candidate.data?.occurrenceKey === active.key
        && candidate.data?.sessionId === active.sessionId)
      const frameState = event?.data?.state
      if (frameState === 'ready' || frameState === 'error') active.frameState = frameState
    }
  }

  /** Cancels pending frame listeners before a media component is detached. */
  function onMoveDelta(delta: MoveStateDelta): void {
    if (delta.operation !== MOVE_OPERATION_UNMOUNT) return
    cancelSession(delta.persoKey)
    handledOccurrences.delete(delta.persoKey)
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
  }

  return {
    beforeComponentUpdate,
    afterComponentUpdate,
    onComponentUpdateError,
    onScenePresented,
    onMoveDelta,
    beforeSeek,
    destroy,
  }
}

/** Normalizes media profiles, using the slot normalizer for its established CSS transitions. */
export function normalizeReplaceMediaCommand(rawReplace: unknown): ReplaceMediaCommand | undefined {
  const options = typeof rawReplace === 'string' ? {} : isPlainRecord(rawReplace) ? rawReplace : undefined
  const transition = typeof rawReplace === 'string' ? rawReplace : options?.transition
  if (typeof transition !== 'string') return undefined

  if (isReplaceSlotTransition(transition)) {
    const slotProfile = normalizeReplaceSlotCommand(rawReplace)
    if (slotProfile === undefined) return undefined
    const split = slotProfile.split
    if (split !== undefined && split !== 'cells') return undefined

    const profile: ReplaceMediaPresentationProfile = {
      transition: slotProfile.transition,
      duration: slotProfile.duration,
      ...(slotProfile.shape === undefined ? {} : { shape: slotProfile.shape }),
      freezeMedia: true,
      ...(split === undefined ? {} : { split }),
      ...(slotProfile.stagger === undefined ? {} : { stagger: slotProfile.stagger }),
      ...(slotProfile.staggerPattern === undefined ? {} : { staggerPattern: slotProfile.staggerPattern }),
      ...(slotProfile.direction === undefined ? {} : { direction: slotProfile.direction }),
      ...(slotProfile.cellSize === undefined ? {} : { cellSize: slotProfile.cellSize }),
      ...(slotProfile.cellX === undefined ? {} : { cellX: slotProfile.cellX }),
      ...(slotProfile.cellY === undefined ? {} : { cellY: slotProfile.cellY }),
    }
    return { profile, duration: getGridDuration(profile) }
  }

  const preset = normalizeReplacePresetCommand(rawReplace, 'replace', ['cells'])
  if (preset === undefined) return undefined
  const profile: ReplaceMotionProfile = {
    ...preset.profile,
    freezeMedia: true,
    ...(preset.shape === undefined ? {} : { shape: preset.shape }),
    ...(preset.split === undefined ? {} : { split: preset.split }),
    ...(preset.stagger === undefined ? {} : { stagger: preset.stagger }),
    ...(preset.staggerPattern === undefined ? {} : { staggerPattern: preset.staggerPattern }),
    ...(preset.direction === undefined ? {} : { direction: preset.direction }),
    ...(preset.cellSize === undefined ? {} : { cellSize: preset.cellSize }),
    ...(preset.cellX === undefined ? {} : { cellX: preset.cellX }),
    ...(preset.cellY === undefined ? {} : { cellY: preset.cellY }),
  }
  return { profile, duration: getGridDuration(profile) }
}

/** Normalizes the original image-only shorthand for compatibility with existing callers. */
export function normalizeReplaceSimpleCommand(rawReplace: unknown): ReplaceSimpleCommand | undefined {
  if (rawReplace === 'fade' || rawReplace === 'fade-in') {
    return { transition: rawReplace, duration: DEFAULT_REPLACE_DURATION_MS }
  }
  if (!isPlainRecord(rawReplace) || !isReplaceTransition(rawReplace.transition)) return undefined
  const duration = rawReplace.duration
  if (duration === undefined) return { transition: rawReplace.transition, duration: DEFAULT_REPLACE_DURATION_MS }
  if (!isFiniteNonNegativeNumber(duration)) return undefined
  return { transition: rawReplace.transition, duration }
}

/** Selects the latest source-changing action that carries one valid media profile. */
function resolveLatestReplaceOccurrence(
  actions: readonly ComponentActionOccurrence[],
): ReplaceOccurrence | undefined {
  let latest: ReplaceOccurrence | undefined
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index]
    if (action === undefined || !hasReplaceTarget(action.action)) continue
    const command = normalizeReplaceMediaCommand(action.action.replace)
    if (command === undefined) continue
    latest = {
      key: createOccurrenceKey(action, index),
      action,
      command,
    }
  }
  return latest
}

/** Creates one stable occurrence key for transition replacement and replay guards. */
function createOccurrenceKey(action: ComponentActionOccurrence, index: number): string {
  return `${action.eventId ?? action.name}:${action.startAt}:${index}`
}

/** Registers one player-clocked snapshot transition without starting native media clones. */
function createReplaceAnimation(options: Readonly<{
  componentId: string
  startAt: number
  duration: number
  active: ActiveReplaceSession
  sessions: Map<string, ActiveReplaceSession>
  emitFrameState: (session: ActiveReplaceSession, state: 'ready' | 'error') => void
}>): ComponentAnimation {
  const endAt = options.startAt + options.duration
  const active = options.active
  const animationId = `replace-media:${options.componentId}:${active.key}:${active.sessionId}`

  /** Starts when the current source frame is ready, or subscribes for a module event. */
  const startAtSample = (): void => {
    if (active.started === true) return
    if (active.frameState === 'error') {
      active.session.finish()
      active.started = true
      return
    }
    const didStart = active.session.tryStart === undefined
      ? (active.session.start(), true)
      : active.session.tryStart()
    if (didStart) {
      active.waitingCancel?.()
      active.waitingCancel = undefined
      active.started = true
      return
    }
    if (active.frameState === 'ready') {
      active.session.finish()
      active.started = true
      return
    }
    if (active.waitingCancel !== undefined) return
    const cancelWait = active.session.waitForIncomingFrame?.((state) => {
      if (options.sessions.get(options.componentId) !== active) return
      active.waitingCancel?.()
      active.waitingCancel = undefined
      options.emitFrameState(active, state)
    })
    if (cancelWait === undefined) {
      active.session.finish()
      active.started = true
      return
    }
    active.waitingCancel = cancelWait
  }

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
            active.waitingCancel?.()
            active.waitingCancel = undefined
            if (active.started === true) active.session.sample(1)
            active.session.finish()
            const current = options.sessions.get(options.componentId)
            if (current?.session === active.session) options.sessions.delete(options.componentId)
          },
        }
      }
      const progress = endAt === options.startAt
        ? 1
        : (timeMs - options.startAt) / (endAt - options.startAt)
      const normalized = Math.min(1, Math.max(0, progress))
      return {
        value: {
          progress: normalized,
          frameState: active.frameState ?? 'pending',
        },
        apply: () => {
          startAtSample()
          if (active.started === true) active.session.sample(normalized)
        },
      }
    },
  }
}

/** Resolves the effective duration for a fixed media-cell grid. */
function getGridDuration(profile: ReplaceMediaProfile): number {
  const duration = profile.duration ?? 0
  if (!('split' in profile) || profile.split !== 'cells') return duration
  const columns = profile.cellX ?? 4
  const rows = profile.cellY ?? 3
  const timing = computeReplaceStaggerTiming({
    cols: columns,
    rows,
    durationMs: duration,
    totalStaggerMs: profile.stagger ?? Math.round(duration * 0.5),
    staggerPattern: profile.staggerPattern,
    direction: profile.direction,
  })
  return timing.totalDurationMs
}

/** Reports whether this component update belongs to a supported image or video owner. */
function supportsReplaceMedia(
  update: RuntimeComponentUpdateContext,
  activeMediaTag: 'audio' | 'video' | undefined,
): boolean {
  if (update.componentType === 'img') return true
  if (update.componentType !== 'media') return false
  if (activeMediaTag !== undefined) return activeMediaTag === 'video'
  const initialTag = update.initialState?.tag
  if (initialTag === 'audio') return false
  if (initialTag === 'video') return true
  const source = update.initialState?.src
  return typeof source === 'string' && !isAudioSource(source)
}

/** Checks whether the active source-changing action contains an explicit source value. */
function hasReplaceTarget(action: Readonly<Record<string, unknown>>): boolean {
  return Object.prototype.hasOwnProperty.call(action, 'src') && action.src !== undefined
}

/** Checks whether one command names the two legacy image transitions. */
function isReplaceTransition(value: unknown): value is ReplaceTransition {
  return value === 'fade' || value === 'fade-in'
}

/** Checks whether a source suffix identifies audio under the media component defaults. */
function isAudioSource(source: string): boolean {
  return /\.(?:aac|flac|m4a|mp3|oga|ogg|wav)(?:$|[?#])/i.test(source)
}

