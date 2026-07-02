import { createAuthorApi, createLibreAdapter, createSelectionFrame } from '@codplay/selection-frame'
import { createSelectionFrameScene } from '../scenes/selection-frame-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

const EDITED_ITEM_ID = 'edited-item'

export async function runSelectionFrameDemo(): Promise<void> {
  await runCodPlaySceneDemo({
    title: 'Selection Frame',
    subtitle: 'Cadre de sélection sur un élément tourné (20°) — drag pour déplacer, poignées pour redimensionner.',
    scene: createSelectionFrameScene(),
    activeDemo: 'selection-frame',
    mode: 'author',
    onReady: ({ player }) => {
      const sceneRoot = globalThis.document.querySelector('#demo-container')
      if (sceneRoot === null) return

      const authorApi = createAuthorApi(player)
      const adapter = createLibreAdapter({
        authorApi,
        itemId: EDITED_ITEM_ID
      })

      createSelectionFrame({
        itemId: EDITED_ITEM_ID,
        authorApi,
        sceneRoot,
        adapter
      })
    }
  })
}
