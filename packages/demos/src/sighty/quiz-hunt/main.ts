import { createSightyTransport } from '../layout/transport'
import type { SightyDemoDefinition } from '../layout/types'
import { QuizHuntComposition } from './game-composition'

import '../scenes.css'
import '../../v1/scenes/quiz-hunt/quiz-hunt.css'
import './responsive.css'

/** Registers the first autonomous Quiz Hunt vertical in the shared Sighty page. */
export const quizHunt: SightyDemoDefinition = {
  id: 'quiz-hunt',
  title: 'Quiz Hunt · chasse spatiale',
  create: ({ stage, onLog }) => {
    const composition = new QuizHuntComposition({ stage, onLog })
    return {
      transport: createSightyTransport(composition.runtime),
      initialize: () => composition.initialize(),
      destroy: () => composition.destroy(),
    }
  },
}
