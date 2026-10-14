import type { SightyRuntimeApi } from '@codplay/sighty'
import type { CodPlayInstance } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import { ELCE_SCENARIO } from '../../config/document-config'
import type { ElceSceneKey, ElceSlotName } from '../../builders/scenario/scenario-builder-types'

const PAGE_MEDIA_STOP_EVENT = 'elce:page-media:stop'

/** Declares one private STOP action on each page media through its existing story. */
export function withPageMediaStop(scene: SceneDoc<string>): SceneDoc<string> {
  return {
    ...scene,
    stories: Object.fromEntries(Object.entries(scene.stories).map(([storyId, story]) => {
      if (!story.persos?.some((perso) => perso.type === 'media')) return [storyId, story]
      return [storyId, {
        ...story,
        listen: [...story.listen ?? [], { on: PAGE_MEDIA_STOP_EVENT }],
        persos: story.persos.map((perso) => perso.type !== 'media' ? perso : {
          ...perso,
          actions: { ...perso.actions, [PAGE_MEDIA_STOP_EVENT]: { broadcast: { type: 'STOP' } } },
        }),
      }]
    })),
  }
}

/** Stops the outgoing page through CodPlay events when Sighty changes the content slot. */
export function bindPageMediaPlayback(
  runtime: SightyRuntimeApi<ElceSceneKey, ElceSlotName>,
  onError: (error: unknown) => void,
): () => void {
  const currentSceneKey = runtime.getMountedSceneKey(ELCE_SCENARIO.CONTENT_SLOT)
  let currentInstance = currentSceneKey === undefined ? undefined : runtime.getInstance(currentSceneKey)
  return runtime.onSlotChange(ELCE_SCENARIO.CONTENT_SLOT, (sceneKey) => {
    const previous = currentInstance
    currentInstance = sceneKey === undefined ? undefined : runtime.getInstance(sceneKey)
    if (previous !== undefined && previous !== currentInstance) {
      void stopPageMedia(previous).catch(onError)
    }
  })
}

/** Addresses only the outgoing instance's media stories, without reading native nodes. */
async function stopPageMedia(instance: CodPlayInstance): Promise<void> {
  const storyIds = new Set(instance.snapshot.get()?.states
    .filter(({ state }) => state.sync === 'independent')
    .map(({ target }) => target.storyId))
  for (const storyId of storyIds) {
    await instance.events.emit({ name: PAGE_MEDIA_STOP_EVENT }, { scope: 'story', storyId })
  }
}
