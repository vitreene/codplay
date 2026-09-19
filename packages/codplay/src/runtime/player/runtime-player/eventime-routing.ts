import type { CompiledEventime, CompiledScene } from '../../../scene/compiled'
import { cloneRecord } from '../../../shared'
import { TRACK_EVENT_ACTIVATE, TRACK_EVENT_DEACTIVATE, TRACK_EVENT_TOGGLE } from '../../config/track-events'
import { TRACK_GLOBAL_ID } from '../../config/track'
import type {
  RuntimePlayerEventime,
  RuntimePlayerEventimeTarget,
} from '../eventime'

/** Resolves the declared story or scene target for one eventime insertion. */
export function resolveEventimeTarget(
  scene: CompiledScene,
  target: RuntimePlayerEventimeTarget,
): Readonly<{ trackId: string; storyId?: string }> {
  if (target.scope === 'scene') {
    if (target.storyId !== undefined) throw new Error('Scene eventime target must not contain storyId.')
    return { trackId: target.trackId ?? TRACK_GLOBAL_ID }
  }
  if (target.storyId === undefined) throw new Error('Story eventime target requires storyId.')
  const story = scene.scene.stories[target.storyId]
  if (story === undefined) throw new Error(`Eventime story is not declared: ${target.storyId}`)
  return {
    trackId: target.trackId ?? story.trackId ?? story.id,
    storyId: story.id,
  }
}

/** Sends an immediate targeted event through listen so it can wake its story. */
export function shouldDispatchImmediateStoryEventime(
  scene: CompiledScene,
  eventime: RuntimePlayerEventime,
  target: RuntimePlayerEventimeTarget,
): boolean {
  if (target.scope !== 'story' || target.storyId === undefined) return false
  if (eventime.startAt !== undefined && eventime.startAt !== 0) return false
  if (eventime.events !== undefined && eventime.events.length > 0) return false
  if (eventime.visibility === 'scene' || eventime.visibility === 'public') return false
  return scene.scene.stories[target.storyId]?.listen.some((rule) => rule.on === eventime.name) === true
}

/** Normalizes one external eventime tree without mutating the caller's value. */
export function normalizeRuntimeEventime(
  eventime: RuntimePlayerEventime,
  root: boolean,
): Readonly<{ eventime: CompiledEventime; mode?: RuntimePlayerEventime['mode'] }> {
  if (eventime.name.trim().length === 0) throw new Error('Eventime name must not be empty.')
  const startAt = eventime.startAt ?? (root ? 0 : undefined)
  if (startAt === undefined || !Number.isFinite(startAt) || startAt < 0) {
    throw new Error('Eventime startAt must be finite and non-negative; only the root may omit it.')
  }
  if (eventime.visibility !== undefined
    && eventime.visibility !== 'story'
    && eventime.visibility !== 'scene'
    && eventime.visibility !== 'public') {
    throw new Error(`Eventime visibility is invalid: ${eventime.visibility}`)
  }
  const children = eventime.events?.map((child) => normalizeRuntimeEventime(child, false).eventime)
  return {
    eventime: {
      name: eventime.name,
      startAt,
      visibility: eventime.visibility,
      data: eventime.data === undefined ? undefined : cloneRecord(eventime.data),
      events: children,
    },
    mode: eventime.mode,
  }
}

/** Identifies an immediate public command that must change track activity now. */
export function isImmediateTrackControlEvent(eventime: RuntimePlayerEventime): boolean {
  return eventime.startAt === undefined
    && (eventime.events === undefined || eventime.events.length === 0)
    && (eventime.name === TRACK_EVENT_ACTIVATE
      || eventime.name === TRACK_EVENT_DEACTIVATE
      || eventime.name === TRACK_EVENT_TOGGLE)
}
