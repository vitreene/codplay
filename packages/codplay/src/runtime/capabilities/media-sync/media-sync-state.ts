import type { CompiledScene } from '../../../scene/compiled'
import { buildTrackRegistry, resolveStoryTrackId } from '../../player/pipeline'
import type { SolvedPerso, SolvedScene } from '../../player/pipeline'
import type { MediaRuntimeState } from './media-sync-types'

/** Registers the media states visible in one solved scene without touching playback. */
export function initializeMediaStates(
  scene: SolvedScene,
  mediaById: Map<string, MediaRuntimeState>,
): void {
  const activeIds = new Set<string>()
  const tracks = buildTrackRegistry(scene.scene)
  for (const perso of Object.values(scene.persos)) {
    if (perso.type !== 'media') continue
    activeIds.add(perso.key)
    const initialMaster = readInitialMaster(scene.scene, perso)
    const trackId = resolveStoryTrackId({ id: perso.storyId })
    const trackActive = tracks.tracks[trackId]?.active ?? true
    const previous = mediaById.get(perso.key)
    if (previous === undefined) {
      mediaById.set(perso.key, {
        runtimeItemId: perso.key,
        storyId: perso.storyId,
        trackId,
        trackActive,
        isMaster: initialMaster,
        logicalState: 'idle',
        sequenceStartMs: null,
        sourceStartMs: 0,
        sourceEndMs: null,
        frozenMediaMs: 0,
        activationOrder: 0,
        needsResync: false,
        transition: null,
      })
    } else {
      previous.storyId = perso.storyId
      previous.trackId = trackId
      previous.trackActive = trackActive
      previous.isMaster = initialMaster
    }
  }
  for (const runtimeItemId of mediaById.keys()) {
    if (!activeIds.has(runtimeItemId)) mediaById.delete(runtimeItemId)
  }
}

/** Reads the media master flag from the immutable compiled perso declaration. */
export function readInitialMaster(scene: CompiledScene, perso: SolvedPerso): boolean {
  const compiledPerso = scene.scene.stories[perso.storyId]?.persos.find((candidate) => candidate.id === perso.persoId)
  return compiledPerso?.initial.master === true
}
