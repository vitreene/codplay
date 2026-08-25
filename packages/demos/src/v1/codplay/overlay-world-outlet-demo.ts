import { createOverlayWorldOutletReproScene } from '../scenes/overlay-world-outlet-repro-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

export async function runOverlayWorldOutletDemo(): Promise<void> {
  await runCodPlaySceneDemo({
    title: 'Overlay-world outlet repro',
    subtitle: 'Deux cas dans la meme demo : cas 1 = outlet non-list sans deplacement ; cas 2 = cible list avec trajectoire potentiellement erronee.',
    scene: createOverlayWorldOutletReproScene(),
    activeDemo: 'overlay-world-outlet',
  })
}
