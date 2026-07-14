import { createContainerQueryPlacementScene } from '../scenes/container-query-placement-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'
import type { DemoEntry } from '../shared/demo-registry'

export async function runContainerQueryPlacementDemo(demoLinks?: DemoEntry[]): Promise<void> {
  await runCodPlaySceneDemo({
    title: 'Container query placement',
    subtitle: 'Un perso placé/dimensionné en cqw/cqh dans son conteneur de scène — repos et transition.',
    scene: createContainerQueryPlacementScene(),
    activeDemo: 'container-query-placement',
    demoLinks,
  })
}
