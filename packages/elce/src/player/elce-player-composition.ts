import { Sighty, type SightyScenarioDefinition } from '@codplay/sighty'
import type { SightySceneSourceValue } from '@codplay/sighty'
import { createScrollContainerSourceAdapter } from '@codplay/component-v2/scroll-container'
import { BDC_TYPE, CHAPTER_TYPE, ELCE_EVENTS, ELCE_SCENARIO, PAGE_TYPE } from '../config/document-config'
import type { ChapterType } from '../config/document-config-types'
import { buildFluxScene } from '../builders/flux/flux-scene-builder'
import type { FluxSceneBuildOptions } from '../builders/flux/flux-scene-builder-types'
import { buildDiapoScene } from '../builders/diapo/diapo-scene-builder'
import { buildScenario, resetQuestionScene, scenarioContextFromTestState } from '../builders/scenario/scenario-builder'
import { validateHtmlElementMethodActions } from '../builders/markup-validation/html-element-method-validation'
import type { ElceSceneKey, ElceSlotName } from '../builders/scenario/scenario-builder-types'
import type { ElceDocument } from '../domain/document/document-model'
import { ELCE_PLAYER_STYLE_SHEET } from './elce-player-style'
import { createViewportExpansionStyleSheet } from '../builders/viewport-expansion/viewport-expansion-style.ts'
import {
  appearanceThemeCssAssetPathsForDocument,
  createDocumentAppearanceStyleSheet,
} from './appearance-scene-style-sheet'
import { loadAppearanceThemeCssLinks } from './appearance/appearance-theme-css-links.ts'
import type { AppearanceThemeCssLinks } from './appearance/appearance-theme-css-links.ts'
import { pageAppearanceClassNames } from '../builders/scene-style/appearance-class-names.ts'
import { mediaTypeFromMimeType } from '../domain/media/media-resource-service'
import type { ElcePageSceneCache, ElcePlayerCompositionOptions } from './player-composition-types'
import { bindPageMediaPlayback, withPageMediaStop } from './media-playback/page-media-playback'
import { INITIAL_PROJECT_TEST_STATE } from '../domain/summary-profile/test-state-types'
import { ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY } from '../scorm/scorm-types'
import { ELCE_ENGINE_CAPABILITIES } from './elce-player-engine'
import { ElceEditorSettingsResolver } from '../domain/editor-settings/editor-settings-resolver'

type ElceSighty = Sighty<ElceSceneKey, ElceSlotName>
const editorSettingsResolver = new ElceEditorSettingsResolver()

/** Owns the real Sighty/CodPlay player used to preview the current document. */
export class ElcePlayerComposition {
  private readonly sighty: ElceSighty
  private readonly options: ElcePlayerCompositionOptions
  private destroyed = false
  private removeMenuDrawerListeners: (() => void) | undefined
  private removePageMediaPlayback: (() => void) | undefined
  private readonly appearanceThemeCssLinks: AppearanceThemeCssLinks

  /** Builds one player composition from the current métier document. */
  public constructor(options: ElcePlayerCompositionOptions) {
    this.options = options
    this.appearanceThemeCssLinks = loadAppearanceThemeCssLinks(
      options.stage.ownerDocument,
      appearanceThemeCssAssetPathsForDocument(options.document),
    )
    void this.appearanceThemeCssLinks.loaded.catch((error: unknown) => {
      options.onLog?.(`Feuilles CSS d’apparence indisponibles : ${String(error)}`, 'error')
    })
    const testState = options.testState ?? INITIAL_PROJECT_TEST_STATE
    const scenario = createElcePlayerScenario({ ...options, testState })
    for (const warning of validateHtmlElementMethodActions(scenario.scenes ?? {})) {
      options.onLog?.(warning, 'warn')
    }
    const instanceIds = createInstanceIds(scenario)
    this.sighty = new Sighty({
      scenario,
      runtime: {
        root: options.stage,
        context: {
          ...scenarioContextFromTestState(testState),
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
          pauseOnDocumentHidden: false,
        },
      },
    })
  }

  /** Initializes Sighty and starts the persistent layout and current page. */
  public async initialize(): Promise<void> {
    await this.sighty.runtime.initialize()
    this.removePageMediaPlayback = bindPageMediaPlayback(this.sighty.runtime, (error) => {
      this.options.onLog?.(`Arrêt des médias de la page impossible : ${String(error)}`, 'error')
    })
    await this.sighty.runtime.play(ELCE_SCENARIO.LAYOUT_SCENE)
    this.bindMenuDrawer()
    const refreshed = await this.sighty.runtime.dispatch({ name: ELCE_EVENTS.PRESENTATION_REFRESH })
    if (!refreshed) this.options.onLog?.('La présentation Elcé n’a pas pu être actualisée.', 'warn')
    this.options.onLog?.('Prévisualisation Elcé initialisée.', 'info')
  }

  /** Reads the current page from Sighty before a preview composition is rebuilt. */
  public getCurrentPageId(): string | undefined {
    const sceneKey = this.sighty.runtime.scenarioState.active?.sceneKey
    return this.options.document.pages.find((page) => `scene-${page.id}` === sceneKey)?.id
  }

  /** Destroys all player resources owned by this composition. */
  public destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.removeMenuDrawerListeners?.()
    this.removeMenuDrawerListeners = undefined
    this.removePageMediaPlayback?.()
    this.removePageMediaPlayback = undefined
    this.sighty.runtime.destroy()
    this.appearanceThemeCssLinks.remove()
  }

  /** Connects accessible focus behavior to the CodPlay-driven menu drawer. */
  private bindMenuDrawer(): void {
    const stage = this.options.stage
    const toggle = stage.querySelector<HTMLButtonElement>('.elce-player-menu-toggle')
    const close = stage.querySelector<HTMLButtonElement>('.elce-player-menu-close')
    const drawer = stage.querySelector<HTMLElement>('.elce-player-menu-drawer')
    const view = stage.ownerDocument.defaultView
    if (toggle === null || close === null || drawer === null || view === null) {
      throw new Error('Les commandes du sommaire Elcé sont absentes du player.')
    }

    const mobileViewport = typeof view.matchMedia === 'function'
      ? view.matchMedia('(max-width: 800px)')
      : undefined
    /** Reads the player breakpoint using the browser media-query circuit. */
    const isMobileViewport = (): boolean => mobileViewport?.matches ?? view.innerWidth <= 800

    /** Synchronizes dialog semantics without owning the animated state. */
    const setAccessibleState = (open: boolean, restoreFocus = false): void => {
      const mobile = isMobileViewport()
      toggle.setAttribute('aria-expanded', String(open && mobile))
      if (mobile) {
        drawer.setAttribute('role', 'dialog')
        drawer.setAttribute('aria-modal', 'true')
        drawer.setAttribute('aria-hidden', String(!open))
        if (open) drawer.removeAttribute('inert')
        else drawer.setAttribute('inert', '')
        if (open) view.requestAnimationFrame(() => close.focus())
        else if (restoreFocus) toggle.focus()
        return
      }
      drawer.removeAttribute('role')
      drawer.removeAttribute('aria-modal')
      drawer.setAttribute('aria-hidden', 'false')
      drawer.removeAttribute('inert')
    }

    /** Observes scene events only for focus and accessible state. */
    const handlePublicEvent = (event: Readonly<{ name: string }>): void => {
      if (event.name === ELCE_EVENTS.MENU_DRAWER_OPEN) {
        setAccessibleState(true)
        return
      }
      if (event.name === ELCE_EVENTS.MENU_DRAWER_CLOSE || event.name.startsWith(ELCE_EVENTS.MENU_PREFIX)) {
        view.requestAnimationFrame(() => setAccessibleState(false, true))
      }
    }

    /** Keeps keyboard focus inside the open mobile drawer. */
    const trapDrawerFocus = (event: KeyboardEvent): void => {
      if (!isMobileViewport() || drawer.getAttribute('aria-hidden') === 'true' || event.key !== 'Tab') return
      const focusable = Array.from(drawer.querySelectorAll<HTMLButtonElement>(
        '.elce-player-menu-close, .elce-player-menu__chapter-button, .elce-player-menu__page-button',
      )).filter((button) => !button.disabled)
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (first === undefined || last === undefined) return
      const active = stage.ownerDocument.activeElement
      if (event.shiftKey && (active === first || !drawer.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    let wasMobileViewport = isMobileViewport()
    /** Reconciles the responsive accessible state when crossing the breakpoint. */
    const handleViewportChange = (): void => {
      const mobile = isMobileViewport()
      if (mobile === wasMobileViewport) return
      wasMobileViewport = mobile
      if (mobile) {
        setAccessibleState(false)
        drawer.setAttribute('data-open', 'false')
        return
      }
      void this.sighty.runtime.dispatch({ name: ELCE_EVENTS.MENU_DRAWER_CLOSE_REQUEST }).then(() => {
        setAccessibleState(false)
      })
    }

    setAccessibleState(false)
    const removePublicEventListener = this.sighty.runtime.events.onEvent(handlePublicEvent)
    drawer.addEventListener('keydown', trapDrawerFocus)
    if (mobileViewport === undefined) {
      view.addEventListener('resize', handleViewportChange)
    } else {
      mobileViewport.addEventListener('change', handleViewportChange)
    }
    /** Releases event and focus listeners during player teardown. */
    this.removeMenuDrawerListeners = () => {
      removePublicEventListener()
      drawer.removeEventListener('keydown', trapDrawerFocus)
      if (mobileViewport === undefined) {
        view.removeEventListener('resize', handleViewportChange)
      } else {
        mobileViewport.removeEventListener('change', handleViewportChange)
      }
      setAccessibleState(false)
    }
  }
}

export type ElcePlayerScenarioOptions = Omit<ElcePlayerCompositionOptions, 'stage' | 'onLog'>

/** Builds the shared, DOM-free Sighty definition used by preview and export. */
export function createElcePlayerScenario(
  options: ElcePlayerScenarioOptions,
  fontSourcePrefix: '/' | './' = '/',
): SightyScenarioDefinition<ElceSceneKey, ElceSlotName> {
  const testState = options.testState ?? INITIAL_PROJECT_TEST_STATE
  const pageSceneCatalog = createPageSceneCatalog(
    options.document,
    options.mediaSources,
    options.sceneCache,
  )
  const scenario = buildScenario(options.document, pageSceneCatalog.scenes, options.startPageId, {
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
    createDocumentAppearanceStyleSheet(options.document, fontSourcePrefix),
    ELCE_PLAYER_STYLE_SHEET,
    createViewportExpansionStyleSheet(playerSettings.interactions.viewportExpansion),
  ].join('\n')
  return {
    ...scenario,
    scenes: {
      ...scenario.scenes,
      [ELCE_SCENARIO.LAYOUT_SCENE]: {
        sceneDoc: layoutSceneDoc,
        styleSheet: layoutStyleSheet,
      },
    },
  }
}

/** Builds the scene catalogue for pages that belong to the player scenario. */
export function createPageSceneCatalog(
  document: ElceDocument,
  mediaSources: ElcePlayerCompositionOptions['mediaSources'],
  cache?: ElcePageSceneCache,
): Readonly<{ scenes: Readonly<Record<string, SightySceneSourceValue>> }> {
  const pageIds = scenarioPageIds(document)
  const activePageIds = new Set(pageIds)
  for (const cachedPageId of cache?.keys() ?? []) {
    if (!activePageIds.has(cachedPageId)) cache?.delete(cachedPageId)
  }
  const scenes = Object.fromEntries(pageIds.map((pageId) => {
    const page = document.pages.find((candidate) => candidate.id === pageId)
    if (page === undefined) throw new Error(`Page absente du document : ${pageId}`)
    const pageBdcs = page.bdcIds.map((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId))
    const chapterType = page.chapterId === null
      ? undefined
      : document.chapters.find((chapter) => chapter.id === page.chapterId)?.type
    const sceneChapterType = chapterType === CHAPTER_TYPE.EVALUATION ? CHAPTER_TYPE.EVALUATION : undefined
    const pageBdcIds = new Set(pageBdcs.flatMap((bdc) => bdc === undefined ? [] : [bdc.id]))
    const childBdcs = document.bdcs.filter((bdc) => bdc.parentBdcId !== null && pageBdcIds.has(bdc.parentBdcId))
    const sceneBdcs = pageBdcs.flatMap((bdc) => bdc === undefined ? [] : [bdc]).concat(childBdcs)
    const mediaIds = new Set(sceneBdcs.flatMap((bdc) => {
      switch (bdc.type) {
        case BDC_TYPE.CARD:
          return bdc.card?.mediaId == null ? [] : [bdc.card.mediaId]
        case BDC_TYPE.QUESTION:
          return bdc.question?.mediaId == null ? [] : [bdc.question.mediaId]
        default:
          return []
      }
    }))
    const pageMediaSources = Object.fromEntries([...mediaIds].flatMap((mediaId) => {
      const source = mediaSources?.[mediaId]
      return source === undefined ? [] : [[mediaId, source]]
    }))
    const pageMediaTypes = Object.fromEntries([...mediaIds].flatMap((mediaId) => {
      const media = document.medias.find((candidate) => candidate.id === mediaId)
      if (media === undefined) return []
      const type = mediaTypeFromMimeType(media.mimeType)
      return type === null ? [] : [[mediaId, type]]
    }))
    const editorSettings = editorSettingsResolver.resolvePage(page, document.bdcs, document.data.revelationDefaults)
    const scenePage = {
      id: page.id,
      type: page.type,
      bdcIds: page.bdcIds,
      appearance: page.appearance,
      chapterType: sceneChapterType,
    }
    const signature = JSON.stringify([scenePage, sceneBdcs, document.data.appearance, pageMediaSources, pageMediaTypes, editorSettings])
    const cached = cache?.get(pageId)
    if (cached?.signature === signature) {
      return [`scene-${page.id}`, cached.source]
    }
    const scene = buildPageScene(page, document.bdcs, {
      mediaSources: pageMediaSources,
      mediaTypes: pageMediaTypes,
      editorSettings,
      appearanceClassNamesByTarget: pageAppearanceClassNames(document, page, sceneBdcs),
    }, sceneChapterType)
    const questionReset = scene.questionReset
    const sceneDoc = withPageMediaStop(scene.sceneDoc)
    const styleSheets = [...scene.styleSheets]
    const styleSheet = styleSheets.join('\n')
    const source: SightySceneSourceValue = questionReset === undefined && styleSheet.length === 0 ? sceneDoc : {
      sceneDoc,
      ...(styleSheet.length === 0 ? {} : { styleSheet }),
      ...(questionReset === undefined ? {} : { onReset: resetQuestionScene }),
    }
    cache?.set(pageId, { signature, source, styleSheets })
    return [`scene-${page.id}`, source]
  }))
  return { scenes }
}

/** Dispatches each page type to the scene builder that owns its presentation. */
function buildPageScene(
  page: ElceDocument['pages'][number],
  bdcs: ElceDocument['bdcs'],
  options: FluxSceneBuildOptions,
  chapterType: ChapterType | undefined,
) {
  switch (page.type) {
    case PAGE_TYPE.FLUX:
      return buildFluxScene(page, bdcs, options)
      case PAGE_TYPE.DIAPO:
        return buildDiapoScene(page, bdcs, {
          ...options,
        ...(chapterType === undefined ? {} : { chapterType }),
      })
  }
}

/** Reads the same page order used by the Sighty scenario builder. */
function scenarioPageIds(document: ElceDocument): readonly string[] {
  return document.scenarioPageIds
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
