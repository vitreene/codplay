import { Sighty } from '@codplay/sighty'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'
import { createQuizHuntGameData } from './game-data'
import { QUIZ_HUNT_EVENTS } from './messages'
import {
  createInitialQuizHuntContext,
  createQuizHuntScenario,
  type QuizHuntSceneKey,
  type QuizHuntSlotName,
} from './scenario'

type QuizHuntCompositionOptions = Readonly<{
  stage: HTMLElement
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>

type QuizHuntSighty = Sighty<QuizHuntSceneKey, QuizHuntSlotName>

/** Owns Quiz Hunt's Sighty runtime, eager catalog generation, and scene lifecycle. */
export class QuizHuntComposition {
  private readonly sighty: QuizHuntSighty
  private readonly options: QuizHuntCompositionOptions
  readonly runtime: QuizHuntSighty['runtime']

  /** Creates the full trial and final catalog before Sighty compiles and preloads the scenario. */
  constructor(options: QuizHuntCompositionOptions) {
    this.options = options
    const gameData = createQuizHuntGameData()
    const scenario = createQuizHuntScenario(gameData)
    const instanceIds = Object.fromEntries(Object.keys(scenario.scenes ?? {}).map((sceneKey) => [
      sceneKey,
      `quiz-hunt-${sceneKey}-instance`,
    ])) as Record<QuizHuntSceneKey, string>
    this.sighty = new Sighty({
      scenario,
      runtime: {
        root: options.stage,
        instanceIds,
        context: createInitialQuizHuntContext(gameData),
        styles: [{ slot: 'sighty-quiz-hunt-scene-root', cssText: SIGHTY_SCENE_ROOT_STYLE_SHEET }],
        codplay: {
          engine: {
            idle: false,
            diagnosticOutput: (diagnostic) => {
              options.onLog(diagnostic.message, diagnostic.severity === 'warning' ? 'warn' : 'error')
            },
          },
          pauseOnDocumentHidden: false,
        },
      },
    })
    this.runtime = this.sighty.runtime
  }

  /** Initializes all direct scenes, starts the visible composition, and projects state. */
  async initialize(): Promise<void> {
    await this.runtime.initialize()
    await this.runtime.play('scene-layout')
    const refreshed = await this.runtime.dispatch({ name: QUIZ_HUNT_EVENTS.refresh })
    if (!refreshed) this.options.onLog('La présentation initiale de Quiz Hunt n’a pas été traitée.', 'warn')
    this.options.onLog('Quiz Hunt initialisé : menu, questions, panier et minuteur orchestrés par Sighty.')
  }

  /** Destroys the game runtime and releases every owned scene occurrence. */
  destroy(): void {
    this.runtime.destroy()
  }
}
