import { createQuizSeriesFameScene, quizSeriesFameStraps, QUIZ_SERIES_AUTO_TRACK_ID } from '../scenes'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'
import type { DemoEntry } from '../shared/demo-registry'

/**
 * Mounts the quiz series demo with an "Auto" debug button: same model as
 * quiz-hunt's "Debug" toggle — a dedicated, inactive-by-default track
 * (quiz-series-auto-track) holding the whole series' events (answer →
 * validate → next per question, 2s apart). The button rewinds, activates
 * the track, then plays — the normal interactive mode is untouched when
 * the track stays inactive. Duplicated from quiz-series-demo.ts rather than
 * added to it (see quiz-series-fame-scene.ts for why).
 */
export async function runQuizSeriesFameDemo(demoLinks?: DemoEntry[]): Promise<void> {
  await runCodPlaySceneDemo({
    title: 'Quiz — Série de 3 questions',
    subtitle: 'Vrai/Faux, réponse unique, réponses multiples. Bouton Auto : rejoue toute la série (2s/étape).',
    scene: createQuizSeriesFameScene(),
    strapCollection: quizSeriesFameStraps,
    activeDemo: 'quiz-series',
    demoLinks,
    onControlsReady: ({ player, telco, container }) => {
      const autoButton = globalThis.document.createElement('button')
      autoButton.type = 'button'
      autoButton.className = 'demo-button demo-button-secondary'
      autoButton.textContent = 'Auto'
      autoButton.addEventListener('click', () => {
        void (async () => {
          await telco.rewind()
          await player.emit({ name: 'track:activate', payload: { trackIds: [QUIZ_SERIES_AUTO_TRACK_ID] } })
          await telco.play()
        })()
      })
      container.appendChild(autoButton)
    }
  })
}
