import { createQuizSeriesScene, quizSeriesStraps } from '../scenes'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

/**
 * Mounts the quiz series demo: three questions with slide transitions and a result modal.
 */
export async function runQuizSeriesDemo(): Promise<void> {
  await runCodPlaySceneDemo({
    title: 'Quiz — Série de 3 questions',
    subtitle: 'Vrai/Faux, réponse unique, réponses multiples. Résultat final : 2/3 pour réussir.',
    scene: createQuizSeriesScene(),
    strapCollection: quizSeriesStraps,
    activeDemo: 'quiz-series'
  })
}
