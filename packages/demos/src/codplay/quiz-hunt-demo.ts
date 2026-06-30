import { createQuizHuntScene, createQuizHuntStraps } from '../scenes'
import type { GameConfig, QuizHuntContent } from '../scenes/quiz-hunt/types'
import quizHuntContent from '../scenes/quiz-hunt/assets/questions/quiz-hunt-sf-spatiale.json'
import nostromoVideoUrl from '../scenes/quiz-hunt/assets/questions/nostromo.mp4'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

const content: QuizHuntContent = structuredClone(quizHuntContent as QuizHuntContent)
const nostromoWord = content.words.find((word) => word.id === 'nostromo')
if (nostromoWord?.trial.clueMedia?.type === 'video') {
  nostromoWord.trial.clueMedia.src = nostromoVideoUrl
}

const config: GameConfig = {
  content,
  seed: 1,
  timerTotalMs: 5 * 60 * 1000,
  extraDurationMs: 3000,
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
  const scene = createQuizHuntScene(config)

  await runCodPlaySceneDemo({
    title: 'Quiz Hunt — SF spatiale',
    subtitle: '16 epreuves autour des films de science-fiction spatiale, 4 couleurs a completer, une question finale contre le temps.',
    scene,
    strapCollection: createQuizHuntStraps(config, scene),
    activeDemo: 'quiz-hunt'
  })
}
