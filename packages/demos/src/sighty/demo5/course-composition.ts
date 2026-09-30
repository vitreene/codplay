import { Sighty } from '@codplay/sighty'
import type { CodPlayEngineOptions } from 'codplay'
import {
  SCROLL_CONTAINER_COMPONENT_DEFINITION,
  SCROLL_CONTAINER_MODULE_DEFINITION,
  createScrollContainerSourceAdapter,
} from '@codplay/component-v2'
import { createInitialCourseSignet } from './course-data'
import { COURSE_EVENTS } from './messages'
import { createCourseScenario, type CourseSceneKey, type CourseSlotName } from './scenario'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'

type CourseCompositionOptions = Readonly<{
  stage: HTMLElement
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>

type CourseSighty = Sighty<CourseSceneKey, CourseSlotName>

/** Registers the optional scroll-container component and module with CodPlay. */
const COURSE_ENGINE_CAPABILITIES: Pick<CodPlayEngineOptions, 'components' | 'modules'> = {
  components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
  modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
}

/** Owns the real Sighty runtime and all active scene occurrences for Demo 5. */
export class CourseComposition {
  private readonly sighty: CourseSighty
  private readonly options: CourseCompositionOptions
  readonly runtime: CourseSighty['runtime']

  /** Creates the Sighty facade with the real scroll component and HTML adapter. */
  constructor(options: CourseCompositionOptions) {
    this.options = options
    const scenario = createCourseScenario(options.onLog)
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
        styles: [{ slot: 'sighty-demo5-scene-root', cssText: SIGHTY_SCENE_ROOT_STYLE_SHEET }],
        codplay: {
          engine: {
            ...COURSE_ENGINE_CAPABILITIES,
            idle: false,
            diagnosticOutput: (diagnostic) => {
              options.onLog(diagnostic.message, diagnostic.severity === 'warning' ? 'warn' : 'error')
            },
          },
          htmlHost: { sourceAdapterFactories: [createScrollContainerSourceAdapter] },
          pauseOnDocumentHidden: false,
        },
      },
    })
    this.runtime = this.sighty.runtime
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
    this.runtime.destroy()
  }
}
