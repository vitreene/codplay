import { createPreloadMediaScene } from '../scenes/preload-media-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

/**
 * Validates the preload module through a live scene: audio, video, images and CSS
 * are all loaded before the scene starts.
 */
export async function runPreloadMediaDemo(): Promise<void> {
  await runCodPlaySceneDemo({
    title: 'Preload Media',
    subtitle: 'Audio à 0s, vidéo à 2s, images à 4s et 5s. Son, vidéo, images et CSS chargés via le module preload avant démarrage.',
    scene: createPreloadMediaScene(),
    activeDemo: 'preload-media',
    extraResources: [
      {
        url: '/preload-media-demo.css',
        type: 'css',
        policy: { cache: 'default', priority: 'high' },
      },
    ],
  })
}
