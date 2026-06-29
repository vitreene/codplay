import { createPolygonBinding } from '@codplay/polygon'
import { createPolygonScene } from '../scenes/polygon-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

export async function runPolygonDemo(): Promise<void> {
  await runCodPlaySceneDemo({
    title: 'Polygon',
    subtitle: 'Etoile a 5 branches puis heptagone, via le composant polygon.',
    scene: createPolygonScene(),
    activeDemo: 'polygon',
    bindings: [createPolygonBinding()],
  })
}
