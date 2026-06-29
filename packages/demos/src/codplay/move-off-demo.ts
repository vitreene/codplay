import { createMoveOffScene } from '../scenes/move-off-story'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

export async function runMoveOffDemo(): Promise<void> {
  await runCodPlaySceneDemo({
    title: 'Détachement DOM',
    subtitle: 'move:"@off" — fondu (TweenAction) puis détachement réel, via ActionSequence — seek-compatible.',
    scene: createMoveOffScene(),
    activeDemo: 'move-off',
  })
}
