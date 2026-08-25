import '../scenes/mashup-back-and-fore.css'

import { createRiveBinding } from '@codplay/rive'
import { createThreejsBinding } from '@codplay/threejs'
import { mashupBackAndForeScene, mashupBackAndForeStraps } from '../scenes/mashup-back-and-fore-scene'
import { RIVE_COACH_SRC } from '../scenes/rive-coach-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'
import type { DemoEntry } from '../shared/demo-registry'

export function runMashupBackAndForeDemo(demoLinks?: DemoEntry[]): Promise<void> {
  return runCodPlaySceneDemo({
    title: 'Mashup Back & Fore',
    subtitle: 'POC : illusion de lecture inversée en dur (visème, sous-titres, audio, fond 3D, barre de progression) déclenchée par un event, sans manipulation de la timeline.',
    scene: mashupBackAndForeScene,
    strapCollection: mashupBackAndForeStraps,
    activeDemo: 'mashup-back-and-fore',
    demoLinks,
    bindings: [createRiveBinding(), createThreejsBinding()],
    extraResources: [
      { url: RIVE_COACH_SRC, type: 'rive', policy: { cache: 'default' } },
    ],
  })
}
