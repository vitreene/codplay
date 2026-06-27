import { createThreejsBinding } from '@codplay/threejs'
import { createThreejsAnimeGridScene } from '../scenes/threejs-anime-grid-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

export function runThreejsAnimeGridDemo(): Promise<void> {
  return runCodPlaySceneDemo({
    title: 'Three.js + animejs',
    subtitle: 'Composant threejs generique pilote par CodPlay, scene procedurale et animations animejs declarees dans le perso.',
    scene: createThreejsAnimeGridScene(),
    activeDemo: 'threejs-anime-grid',
    bindings: [createThreejsBinding()],
  })
}
