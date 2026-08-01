import { isPlainRecord } from '../../../shared'
import { TRACK_GLOBAL_ID } from '../../config/track'
import type { CompiledScene, CompiledStory, CompiledValue } from '../../../scene/compiled'

/** Static metadata used to select events during materialization. */
export type MaterializedTrack = Readonly<{
  id: string
  order: number
  active: boolean
  role?: string
}>

/** Scene-level registry of tracks available to one compiled scene. */
export type MaterializedTrackRegistry = Readonly<{
  order: readonly string[]
  tracks: Readonly<Record<string, MaterializedTrack>>
}>

/** Consolidates scene and story track declarations without creating runtime tracks. */
export function buildTrackRegistry(scene: CompiledScene): MaterializedTrackRegistry {
  const tracks: Record<string, MaterializedTrack> = {}
  const order: string[] = []

  registerTrack(TRACK_GLOBAL_ID, undefined, tracks, order)
  for (const story of Object.values(scene.scene.stories)) {
    registerTrack(story.id, undefined, tracks, order)
    if (story.trackId !== undefined) registerTrack(story.trackId, undefined, tracks, order)
  }
  for (const [trackId, declaration] of Object.entries(scene.scene.tracks)) {
    registerTrack(trackId, declaration, tracks, order)
  }
  for (const story of Object.values(scene.scene.stories)) {
    for (const [trackId, declaration] of Object.entries(story.tracks ?? {})) {
      registerTrack(trackId, declaration, tracks, order)
    }
  }

  return { order, tracks }
}

/** Resolves the default track used by events declared inside one story. */
export function resolveStoryTrackId(story: Pick<CompiledStory, 'id' | 'trackId'>): string {
  return story.trackId ?? story.id
}

/** Registers one track or merges a later declaration onto its metadata. */
function registerTrack(
  trackId: string,
  declaration: CompiledValue | undefined,
  tracks: Record<string, MaterializedTrack>,
  order: string[],
): void {
  const previous = tracks[trackId]
  const next = isPlainRecord(declaration) ? declaration as Record<string, unknown> : null
  if (previous === undefined) {
    order.push(trackId)
    tracks[trackId] = {
      id: trackId,
      order: order.length - 1,
      active: typeof next?.active === 'boolean' ? next.active : true,
      role: typeof next?.role === 'string' ? next.role : undefined,
    }
    return
  }

  tracks[trackId] = {
    ...previous,
    active: typeof next?.active === 'boolean' ? next.active : previous.active,
    role: typeof next?.role === 'string' ? next.role : previous.role,
  }
}
