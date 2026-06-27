import { createQuizHuntScene, createQuizHuntStraps } from '../scenes'
import type { GameConfig, QuizHuntContent } from '../scenes/quiz-hunt/types'
import quizHuntContent from '../scenes/quiz-hunt/assets/questions/quiz-hunt.json'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

const config: GameConfig = {
  content: quizHuntContent as QuizHuntContent,
  seed: 1,
  timerTotalMs: 5 * 60 * 1000,
  extraDurationMs: 6000,
  showCorrection: true,
  labels: {
    validate: 'Valider',
    next: 'Suivant',
    correct: 'Gagné !',
    incorrect: 'Perdu',
    multipleHint: 'Plusieurs réponses possibles',
    gridTitle: 'Choisis une épreuve',
    basketTitle: 'Panier',
    basketEmptySlot: '—',
    finalButton: 'Épreuve finale',
    resultPassedTitle: 'Partie réussie !',
    resultFailedTitle: 'Partie échouée',
    extraLabel: 'Jeton de rattrapage'
  }
}

/**
 * Mounts the quiz-hunt demo: a 16-tile grid hunt across 4 colors, each tile a
 * reading+quiz trial, ending on a final question once the basket is full.
 */
export async function runQuizHuntDemo(): Promise<void> {
  await runCodPlaySceneDemo({
    title: 'Quiz Hunt — Chasse aux mots',
    subtitle: '16 épreuves de lecture, 4 couleurs à compléter, une question finale contre le temps.',
    scene: createQuizHuntScene(config),
    strapCollection: createQuizHuntStraps(config),
    activeDemo: 'quiz-hunt'
  })
}
