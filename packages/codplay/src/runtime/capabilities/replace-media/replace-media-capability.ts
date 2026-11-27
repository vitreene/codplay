import type {
  ComponentActionOccurrence,
  ComponentAnimation,
  ReplaceMediaPresentationProfile,
  ReplaceMotionProfile,
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
  normalizeReplacePresetCommand,
  isReplacePresetName,
  isReplaceSlotTransition,
} from '../replace-presets'
import { ignoreFadeMaskOptions, isPlainRecord } from '../replace-presets/replace-value-validation'
import { normalizeReplaceSlotCommand } from '../replace-slot'
import {
  createPlayerReplaceAnimation,
  collectReplaceSeekOccurrences,
  findLatestReplaceCandidate,
  createReplaceSurfaceResolver,
  ReplaceTimelineSessions,
  type ReplaceSeekOccurrence,
  type ReplaceTimelineSession,
} from '../replace-session'

/** Player-scoped runtime identifier for image and video replacement presentations. */
export const REPLACE_MEDIA_MODULE_SERVICE_ID = 'replace-media' as const

type ReplaceMediaProfile = SlotReplaceProfile | ReplaceMediaPresentationProfile | ReplaceMotionProfile

export type ReplaceMediaCommand = Readonly<{
  profile: ReplaceMediaProfile
  duration: number
}>

type ActiveReplaceSession = ReplaceTimelineSession & {
  sessionId: number
  frameState?: 'ready' | 'error'
  waitingCancel?: () => void
  started?: boolean
}

const MEDIA_FRAME_EVENT_NAME = 'incoming-frame-state'

/** Grid settings without effect when a media replace declares no `split: 'cells'`. */
const INERT_GRID_FIELDS = ['stagger', 'direction', 'staggerPattern', 'cellX', 'cellY', 'cellSize'] as const

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
  const getReplaceSurface = createReplaceSurfaceResolver(context)
  const getMediaTag = (componentId: string): 'audio' | 'video' | undefined => (
    context.componentSurfaces?.getSurface(componentId, 'media')?.getMediaTag?.()
  )
  const sessions = new ReplaceTimelineSessions<ActiveReplaceSession>(collectMediaSeekOccurrences, (active) => {
    active.waitingCancel?.()
    active.waitingCancel = undefined
  })

  /** Starts or preserves the outgoing snapshot before an image/video source update. */
  function beforeComponentUpdate(update: RuntimeComponentUpdateContext): void {
    if (!supportsReplaceMedia(update, getMediaTag(update.componentId))) return
    const occurrence = findLatestReplaceCandidate(update.activeActions, readMediaCommand)
    if (!sessions.needsSession(update, occurrence?.key) || occurrence === undefined) return

    const interruptedSnapshot = sessions.captureInterrupted(update)
    sessions.cancel(update.componentId)
    const session = getReplaceSurface(update.componentId)?.begin(occurrence.command.profile, interruptedSnapshot)
    if (session === undefined) return
    sessions.open(update.componentId, { key: occurrence.key, session, sessionId: sessions.nextId() })
  }

  /** Registers a media transition whose incoming frame is captured on the first player sample. */
  function afterComponentUpdate(update: RuntimeComponentUpdateContext): void {
    if (!supportsReplaceMedia(update, getMediaTag(update.componentId))) return
    const occurrence = findLatestReplaceCandidate(update.activeActions, readMediaCommand)
    const active = sessions.activeFor(update, occurrence?.key)
    if (active === undefined || occurrence === undefined) return

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
    sessions.cancel(update.componentId)
  }

  /** Replays matching frame events after normal presentation and Seek reconstruction. */
  function onScenePresented(scene: Parameters<NonNullable<RuntimeModuleServiceInstance['onScenePresented']>>[0]): void {
    const events = context.getEvents?.(MEDIA_FRAME_EVENT_NAME) ?? []
    for (const [componentId, active] of sessions.entriesByComponent()) {
      const event = events.find((candidate) => candidate.applyAtMs <= scene.timeMs
        && candidate.data?.componentId === componentId
        && candidate.data?.occurrenceKey === active.key
        && candidate.data?.sessionId === active.sessionId)
      const frameState = event?.data?.state
      if (frameState === 'ready' || frameState === 'error') active.frameState = frameState
    }
    sessions.endSeek()
  }

  /** Cancels pending frame listeners before a media component is detached. */
  function onMoveDelta(delta: MoveStateDelta): void {
    if (delta.operation !== MOVE_OPERATION_UNMOUNT) return
    sessions.forget(delta.persoKey)
  }

  return {
    beforeComponentUpdate,
    afterComponentUpdate,
    onComponentUpdateError,
    onScenePresented,
    onMoveDelta,
    beforeSeek: () => sessions.cancelAll(),
    prepareSeek: (scene) => sessions.prepareSeek(scene),
    destroy: () => sessions.destroy(),
  }
}

/** Normalizes media profiles, using the slot normalizer for its established CSS transitions. */
export function normalizeReplaceMediaCommand(authoredReplace: unknown): ReplaceMediaCommand | undefined {
  const rawReplace = ignoreFadeMaskOptions(authoredReplace)
  const options = typeof rawReplace === 'string' ? {} : isPlainRecord(rawReplace) ? rawReplace : undefined
  const transition = typeof rawReplace === 'string' ? rawReplace : options?.transition
  if (typeof transition !== 'string') return undefined

  // A name shared by the JSON catalogue and the slot profiles (`fade`) takes the JSON preset.
  if (isReplaceSlotTransition(transition) && !isReplacePresetName(transition)) {
    const slotProfile = normalizeReplaceSlotCommand(ignoreInertMediaGridSettings(options, rawReplace))
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
    return { profile, duration: profile.duration ?? 0 }
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
  return { profile, duration: profile.duration ?? 0 }
}

/**
 * Grid settings only apply to a mask grid: without `split: 'cells'`, a slot
 * transition on media accepts and ignores them, and stays a whole-view transition.
 */
function ignoreInertMediaGridSettings(
  options: Readonly<Record<string, unknown>> | undefined,
  rawReplace: unknown,
): unknown {
  if (options === undefined || options.split !== undefined) return rawReplace
  return Object.fromEntries(Object.entries(options)
    .filter(([key]) => !(INERT_GRID_FIELDS as readonly string[]).includes(key)))
}

/** Reads the media profile of one source-changing action, or undefined. */
function readMediaCommand(action: ComponentActionOccurrence): ReplaceMediaCommand | undefined {
  return hasReplaceTarget(action.action) ? normalizeReplaceMediaCommand(action.action.replace) : undefined
}

/** Lists the image/video replace occurrences of one perso with an upper bound of their end. */
function collectMediaSeekOccurrences(
  persoType: string,
  actions: readonly ComponentActionOccurrence[],
): readonly ReplaceSeekOccurrence[] {
  if (persoType !== 'img' && persoType !== 'media') return []
  return collectReplaceSeekOccurrences(actions, readMediaCommand, ({ profile }) => ({
    durationMs: profile.duration ?? 0,
    propagates: 'split' in profile && profile.split === 'cells',
    staggerMs: profile.stagger,
  }))
}

/** Registers one player-clocked snapshot transition without starting native media clones. */
function createReplaceAnimation(options: Readonly<{
  componentId: string
  startAt: number
  duration: number
  active: ActiveReplaceSession
  sessions: ReplaceTimelineSessions<ActiveReplaceSession>
  emitFrameState: (session: ActiveReplaceSession, state: 'ready' | 'error') => void
}>): ComponentAnimation {
  const active = options.active

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

  return createPlayerReplaceAnimation({
    id: `replace-media:${options.componentId}:${active.key}:${active.sessionId}`,
    startAt: options.startAt,
    duration: options.duration,
    // The frame readiness belongs to the sample key: a ready frame is captured
    // again even when Seek left the player at the same progress.
    value: (progress) => ({ progress, frameState: active.frameState ?? 'pending' }),
    sample: (progress) => {
      startAtSample()
      if (active.started === true) active.session.sample(progress)
    },
    complete: () => {
      active.waitingCancel?.()
      active.waitingCancel = undefined
      if (active.started === true) active.session.sample(1)
      active.session.finish()
      options.sessions.release(options.componentId, active.session)
    },
  })
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

/** Checks whether a source suffix identifies audio under the media component defaults. */
function isAudioSource(source: string): boolean {
  return /\.(?:aac|flac|m4a|mp3|oga|ogg|wav)(?:$|[?#])/i.test(source)
}

