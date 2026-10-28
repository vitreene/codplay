import type { SightyScenarioDefinition } from '@codplay/sighty'
import { createScrollContainerSourceAdapter } from '@codplay/component-v2/scroll-container'
import { ELCE_EVENTS, ELCE_SCENARIO } from './learning-reading-events'
import { learningScenarioBuilder } from './learning-scenario-builder'
import { validateHtmlElementMethodActions } from '../../../core/reading/markup-validation/html-element-method-validation'
import type { ElceSceneKey, ElceSlotName } from './learning-scenario-types'
import { createLearningPlayerStyleSheet } from './learning-player-style'
import { LearningPageSceneCatalog } from './learning-page-scene-catalog'
import { createViewportExpansionStyleSheet } from '../../../resources/viewport-expansion/viewport-expansion-style'
import {
  appearanceThemeCssAssetPathsForDocument,
  createDocumentAppearanceStyleSheet,
} from '../../../player/appearance-scene-style-sheet'
import { loadAppearanceThemeCssLinks } from '../../../player/appearance/appearance-theme-css-links'
import type { AppearanceThemeCssLinks } from '../../../player/appearance/appearance-theme-css-links'
import type { LearningPlayerOptions } from './learning-player-types'
import { bindPageMediaPlayback } from '../../../core/reading/media-playback/page-media-playback'
import { ReadingRuntime } from '../../../core/reading/reading-runtime'
import { bindLearningMenuDrawer } from './learning-menu-drawer'
import { INITIAL_PROJECT_TEST_STATE } from './learning-test-state-types'
import { learningTestStateService } from './learning-test-state-service'
import { ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY } from '../../../scorm/scorm-types'
import { ELCE_ENGINE_CAPABILITIES } from '../../../player/elce-player-engine'
import { ElceEditorSettingsResolver } from '../../../domain/editor-settings/editor-settings-resolver'
import { learningProfileService } from '../profile/domain/learning-profile-service'
import { learningReaderProjectionService } from '../profile/reading/learning-reader-projection-service'

const editorSettingsResolver = new ElceEditorSettingsResolver()

/** Owns the real Sighty/CodPlay player used to preview the current document. */
export class LearningPlayer {
  private readonly runtime: ReadingRuntime<ElceSceneKey, ElceSlotName>
  private readonly options: LearningPlayerOptions
  private destroyed = false
  private removeMenuDrawerListeners: (() => void) | undefined
  private removePageMediaPlayback: (() => void) | undefined
  private readonly appearanceThemeCssLinks: AppearanceThemeCssLinks
  private readonly document: LearningPlayerOptions['document']

  /** Builds one player composition from the current métier document. */
  public constructor(options: LearningPlayerOptions) {
    const testState = options.testState ?? INITIAL_PROJECT_TEST_STATE
    const prepared = createLearningPlayerScenarioModel({ ...options, testState })
    this.options = {
      ...options,
      document: prepared.document,
      startPageId: prepared.startPageId,
    }
    this.document = prepared.document
    this.appearanceThemeCssLinks = loadAppearanceThemeCssLinks(
      options.stage.ownerDocument,
      appearanceThemeCssAssetPathsForDocument(prepared.document),
    )
    void this.appearanceThemeCssLinks.loaded.catch((error: unknown) => {
      options.onLog?.(`Feuilles CSS d’apparence indisponibles : ${String(error)}`, 'error')
    })
    const scenario = prepared.scenario
    for (const warning of validateHtmlElementMethodActions(scenario.scenes ?? {})) {
      options.onLog?.(warning, 'warn')
    }
    const instanceIds = createInstanceIds(scenario)
    this.runtime = new ReadingRuntime(scenario, {
        root: options.stage,
        context: {
          ...learningTestStateService.scenarioContextFromTestState(testState),
          ...(options.scormSession === undefined
            ? {}
            : { [ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY]: options.scormSession }),
        },
        instanceIds,
        codplay: {
          engine: {
            ...ELCE_ENGINE_CAPABILITIES,
            idle: false,
            diagnosticOutput: (diagnostic) => {
              options.onLog?.(diagnostic.message, diagnostic.severity === 'warning' ? 'warn' : 'error')
            },
          },
          htmlHost: { sourceAdapterFactories: [createScrollContainerSourceAdapter] },
          ...(options.frameScheduler === undefined ? {} : { frameScheduler: options.frameScheduler }),
          pauseOnDocumentHidden: false,
        },
    })
  }

  /** Initializes Sighty and starts the persistent layout and current page. */
  public async initialize(): Promise<void> {
    await this.runtime.initialize()
    this.removePageMediaPlayback = bindPageMediaPlayback(
      this.runtime.api,
      ELCE_SCENARIO.CONTENT_SLOT,
      (error) => this.options.onLog?.(`Arrêt des médias de la page impossible : ${String(error)}`, 'error'),
    )
    await this.runtime.api.play(ELCE_SCENARIO.LAYOUT_SCENE)
    this.removeMenuDrawerListeners = bindLearningMenuDrawer(this.options.stage, this.runtime.api)
    const refreshed = await this.runtime.api.dispatch({ name: ELCE_EVENTS.PRESENTATION_REFRESH })
    if (!refreshed) this.options.onLog?.('La présentation Elcé n’a pas pu être actualisée.', 'warn')
    this.options.onLog?.('Prévisualisation Elcé initialisée.', 'info')
  }

  /** Reads the current page from Sighty before a preview composition is rebuilt. */
  public getCurrentPageId(): string | undefined {
    const sceneKey = this.runtime.api.scenarioState.active?.sceneKey
    return this.document.pages.find((page) => `scene-${page.id}` === sceneKey)?.id
  }

  /** Destroys all player resources owned by this composition. */
  public destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.removeMenuDrawerListeners?.()
    this.removeMenuDrawerListeners = undefined
    this.removePageMediaPlayback?.()
    this.removePageMediaPlayback = undefined
    this.runtime.destroy()
    this.appearanceThemeCssLinks.remove()
  }


}

export type LearningPlayerScenarioOptions = Omit<LearningPlayerOptions, 'stage' | 'onLog'>

/** Builds the shared, DOM-free Sighty definition used by preview and export. */
export function createElcePlayerScenario(
  options: LearningPlayerScenarioOptions,
  fontSourcePrefix: '/' | './' = '/',
): SightyScenarioDefinition<ElceSceneKey, ElceSlotName> {
  return createLearningPlayerScenarioModel(options, fontSourcePrefix).scenario
}

/** Prepares the same projected document, start page, and Sighty scenario for each reader. */
function createLearningPlayerScenarioModel(
  options: LearningPlayerScenarioOptions,
  fontSourcePrefix: '/' | './' = '/',
): Readonly<{
  document: LearningPlayerOptions['document']
  startPageId?: LearningPlayerOptions['startPageId']
  scenario: SightyScenarioDefinition<ElceSceneKey, ElceSlotName>
}> {
  const testState = options.testState ?? INITIAL_PROJECT_TEST_STATE
  const collectsProfile = learningProfileService.shouldCollectProfile(
    options.document.data.profile.fieldPropertyIds,
    testState,
  )
  const document = collectsProfile
    ? options.document
    : learningReaderProjectionService.projectReaderDocument(
      options.document,
      testState.profileValues,
      testState.profileEnabled,
    )
  const selectedPageId = !collectsProfile
    && options.startPageId !== undefined
    && document.pages.some((page) => page.id === options.startPageId)
    && !document.data.catalogPageIds.includes(options.startPageId)
    ? options.startPageId
    : undefined
  const pageSceneCatalog = new LearningPageSceneCatalog().build(
    document,
    options.mediaSources,
    options.sceneCache,
  )
  const scenario = learningScenarioBuilder.build(document, pageSceneCatalog.scenes, selectedPageId, {
    testState,
    mediaSources: options.mediaSources,
    onTestStateChange: options.onTestStateChange,
  })
  const layoutSource = scenario.scenes?.[ELCE_SCENARIO.LAYOUT_SCENE]
  if (layoutSource === undefined || typeof layoutSource === 'function') {
    throw new Error('La scène layout Elcé est absente du scénario construit.')
  }
  const layoutSceneDoc = 'sceneDoc' in layoutSource ? layoutSource.sceneDoc : layoutSource
  const playerSettings = editorSettingsResolver.resolvePlayer()
  const layoutStyleSheet = [
    createDocumentAppearanceStyleSheet(document, fontSourcePrefix),
    createLearningPlayerStyleSheet(),
    createViewportExpansionStyleSheet(playerSettings.interactions.viewportExpansion),
  ].join('\n')
  return {
    document,
    ...(selectedPageId === undefined ? {} : { startPageId: selectedPageId }),
    scenario: {
      ...scenario,
      scenes: {
        ...scenario.scenes,
        [ELCE_SCENARIO.LAYOUT_SCENE]: {
          sceneDoc: layoutSceneDoc,
          styleSheet: layoutStyleSheet,
        },
      },
    },
  }
}

/** Assigns one stable CodPlay instance identity to every authored scene. */
function createInstanceIds(
  scenario: SightyScenarioDefinition<ElceSceneKey, ElceSlotName>,
): Record<ElceSceneKey, string> {
  return Object.fromEntries(Object.keys(scenario.scenes ?? {}).map((sceneKey) => [
    sceneKey,
    `elce-${sceneKey}-instance`,
  ])) as Record<ElceSceneKey, string>
}
