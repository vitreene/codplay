import '../scenes/mashup-rive-three-quiz.css'

import { createRiveBinding } from '@codplay/rive'
import { createThreejsBinding } from '@codplay/threejs'
import { mashupRiveThreeQuizScene, mashupRiveThreeQuizStraps } from '../scenes/mashup-rive-three-quiz-scene'
import { RIVE_COACH_SRC } from '../scenes/rive-coach-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'
import type { DemoEntry } from '../shared/demo-registry'

export function runMashupRiveThreeQuizDemo(demoLinks?: DemoEntry[]): Promise<void> {
  return runCodPlaySceneDemo({
    title: 'Mashup Rive + 3D + Quiz',
    subtitle: 'Rive lip-sync en aside, animation 3D en fond et compteur quiz centré, assemblés à partir des briques existantes.',
    scene: mashupRiveThreeQuizScene,
    strapCollection: mashupRiveThreeQuizStraps,
    activeDemo: 'mashup-rive-three-quiz',
    demoLinks,
    bindings: [createRiveBinding(), createThreejsBinding()],
    extraResources: [
      { url: RIVE_COACH_SRC, type: 'rive', policy: { cache: 'default' } },
    ],
  })
}
