import { createChronoScene } from '../scenes/chrono-story'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

export async function runChronoDemo(): Promise<void> {
  await runCodPlaySceneDemo({
    title: 'Chronomètre',
    subtitle: 'TweenAction : aiguille + compteur centième — seek-compatible.',
    scene: createChronoScene(),
    activeDemo: 'chrono',
  })
}
