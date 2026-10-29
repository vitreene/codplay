import { Sighty } from '@codplay/sighty'
import { createInitialCourseSignet, getCoursePage } from './course-data'
import { engineCapabilities, sceneRootStyleSheet, sourceAdapterFactories } from './engine-config'
import { COURSE_EVENTS } from './messages'
import { createCourseScenario, type CourseSceneKey, type CourseSlotName } from './scenario'

type CourseCompositionOptions = Readonly<{
  stage: HTMLElement
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>

type CourseSighty = Sighty<CourseSceneKey, CourseSlotName>

/** Owns the real Sighty runtime and all active scene occurrences for Demo 5. */
export class CourseComposition {
  private readonly sighty: CourseSighty
  private readonly options: CourseCompositionOptions
  private unsubscribeRuntimeEvents: (() => void) | null = null
  readonly runtime: CourseSighty['runtime']

  /** Creates the Sighty facade with the real scroll component and HTML adapter. */
  constructor(options: CourseCompositionOptions) {
    this.options = options
    const scenario = createCourseScenario()
    const instanceIds = Object.fromEntries(Object.keys(scenario.scenes ?? {}).map((sceneKey) => [
      sceneKey,
      `demo5-${sceneKey}-instance`,
    ])) as Record<CourseSceneKey, string>
    const signet = createInitialCourseSignet()
    this.sighty = new Sighty({
      scenario,
      runtime: {
        root: options.stage,
        instanceIds,
        context: {
          signet,
        },
        styles: [{ slot: 'sighty-demo5-scene-root', cssText: sceneRootStyleSheet }],
        codplay: {
          engine: {
            ...engineCapabilities,
            idle: false,
            diagnosticOutput: (diagnostic) => {
              options.onLog(diagnostic.message, diagnostic.severity === 'warning' ? 'warn' : 'error')
            },
          },
          htmlHost: { sourceAdapterFactories },
          pauseOnDocumentHidden: false,
        },
      },
    })
    this.runtime = this.sighty.runtime
    /** Logs public quiz results at the host boundary. */
    this.unsubscribeRuntimeEvents = this.runtime.events.onEvent((event) => {
      if (event.name !== COURSE_EVENTS.quizAnswered || typeof event.data?.pageId !== 'string') return
      const page = getCoursePage(event.data.pageId)
      if (page?.kind !== 'quiz' || typeof event.data.isCorrect !== 'boolean') return
      this.options.onLog(`${page.title} : ${event.data.isCorrect ? 'réponse juste' : 'réponse fausse'}`)
    })
  }

  /** Initializes Sighty and starts the visible layout, controls, and page. */
  async initialize(): Promise<void> {
    await this.runtime.initialize()
    await this.runtime.play('scene-layout')
    const refreshed = await this.runtime.dispatch({ name: COURSE_EVENTS.refreshPresentation })
    if (!refreshed) this.options.onLog('La scène active a refusé l’actualisation initiale de la présentation.', 'warn')
    this.options.onLog('Démo 5 initialisée : cours scrollable et évaluation guidée.')
  }

  /** Destroys the Sighty runtime and its active scene occurrences. */
  destroy(): void {
    this.unsubscribeRuntimeEvents?.()
    this.unsubscribeRuntimeEvents = null
    this.runtime.destroy()
  }
}
