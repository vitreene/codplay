import { createPolygonScene } from '../scenes/polygon-scene'
import '../scenes/polygon.css'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'
import type { DemoEntry } from '../shared/demo-registry'

export async function runPolygonDemo(demoLinks?: DemoEntry[]): Promise<void> {
  await runCodPlaySceneDemo({
    title: 'Polygon',
    subtitle: 'Polygone interactif — cliquer un label remet sa valeur par défaut.',
    scene: createPolygonScene(),
    activeDemo: 'polygon',
    demoLinks,
  })
}
