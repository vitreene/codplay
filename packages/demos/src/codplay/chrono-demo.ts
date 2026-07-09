import { createChronoScene } from '../scenes/chrono-story'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'
import type { DemoEntry } from '../shared/demo-registry'

export async function runChronoDemo(demoLinks?: DemoEntry[]): Promise<void> {
  await runCodPlaySceneDemo({
    title: 'Chronomètre',
    subtitle: 'TweenAction : aiguille + compteur centième — seek-compatible.',
    scene: createChronoScene(),
    activeDemo: 'chrono',
    demoLinks,
  })
}
