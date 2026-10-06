import { Sighty, type SightyScenarioDefinition } from '@codplay/sighty'
import type { CodPlayEngineOptions } from 'codplay'
import type { SightySceneSourceValue } from '@codplay/sighty'
import {
  SCROLL_CONTAINER_COMPONENT_DEFINITION,
  SCROLL_CONTAINER_MODULE_DEFINITION,
  createScrollContainerSourceAdapter,
} from '@codplay/component-v2'
import { ELCE_EVENTS, ELCE_SCENARIO } from '../config/document-config'
import { buildFluxScene } from '../builders/flux-scene-builder'
import { buildScenario } from '../builders/scenario-builder'
import { validateHtmlElementMethodActions } from '../builders/html-element-method-validation'
import type { ElceSceneKey, ElceSlotName } from '../builders/scenario-builder-types'
import type { ElceDocument } from '../domain/document-model'
import { ELCE_PLAYER_STYLE_SHEET } from './elce-player-style'
import type { ElcePageSceneCache, ElcePlayerCompositionOptions } from './player-composition-types'

type ElceSighty = Sighty<ElceSceneKey, ElceSlotName>

const ELCE_ENGINE_CAPABILITIES: Pick<CodPlayEngineOptions, 'components' | 'modules'> = {
  components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
  modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
}

/** Owns the real Sighty/CodPlay player used to preview the current document. */
export class ElcePlayerComposition {
  private readonly sighty: ElceSighty
  private readonly options: ElcePlayerCompositionOptions
  private destroyed = false
  private removeMenuDrawerListeners: (() => void) | undefined

  /** Builds one player composition from the current métier document. */
  public constructor(options: ElcePlayerCompositionOptions) {
    this.options = options
    const pageSceneCatalog = createPageSceneCatalog(options.document, options.mediaSources, options.sceneCache)
    const scenario = buildScenario(options.document, pageSceneCatalog.scenes, options.startPageId)
    for (const warning of validateHtmlElementMethodActions(scenario.scenes ?? {})) {
      options.onLog?.(warning, 'warn')
    }
    const instanceIds = createInstanceIds(scenario)
    this.sighty = new Sighty({
      scenario,
      runtime: {
        root: options.stage,
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
        styles: [{ slot: 'elce-player-layout', cssText: [ELCE_PLAYER_STYLE_SHEET, ...pageSceneCatalog.styleSheets].join('\n') }],
      },
    })
  }

  /** Initializes Sighty and starts the persistent layout and current page. */
  public async initialize(): Promise<void> {
    await this.sighty.runtime.initialize()
    await this.sighty.runtime.play(ELCE_SCENARIO.LAYOUT_SCENE)
    this.bindMenuDrawer()
    const refreshed = await this.sighty.runtime.dispatch({ name: ELCE_EVENTS.PRESENTATION_REFRESH })
    if (!refreshed) this.options.onLog?.('La présentation Elcé n’a pas pu être actualisée.', 'warn')
    this.options.onLog?.('Prévisualisation Elcé initialisée.', 'info')
  }

  /** Destroys all player resources owned by this composition. */
  public destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.removeMenuDrawerListeners?.()
    this.removeMenuDrawerListeners = undefined
    this.sighty.runtime.destroy()
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

/** Builds the scene catalogue for pages that belong to the player scenario. */
export function createPageSceneCatalog(
  document: ElceDocument,
  mediaSources: ElcePlayerCompositionOptions['mediaSources'],
  cache?: ElcePageSceneCache,
): Readonly<{ scenes: Readonly<Record<string, SightySceneSourceValue>>; styleSheets: readonly string[] }> {
  const pageStyleSheets: string[] = []
  const pageIds = scenarioPageIds(document)
  const activePageIds = new Set(pageIds)
  for (const cachedPageId of cache?.keys() ?? []) {
    if (!activePageIds.has(cachedPageId)) cache?.delete(cachedPageId)
  }
  const scenes = Object.fromEntries(pageIds.map((pageId) => {
    const page = document.pages.find((candidate) => candidate.id === pageId)
    if (page === undefined) throw new Error(`Page absente du document : ${pageId}`)
    const pageBdcs = page.bdcIds.map((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId))
    const carouselCardBdcIds = new Set(pageBdcs.flatMap((bdc) => bdc?.carousel?.cards.map((entry) => entry.bdcId) ?? []))
    const carouselCardBdcs = document.bdcs.filter((bdc) => carouselCardBdcIds.has(bdc.id))
    const mediaIds = new Set(pageBdcs.flatMap((bdc) => [
      ...(bdc?.mediaId === null || bdc?.mediaId === undefined ? [] : [bdc.mediaId]),
    ]).concat(carouselCardBdcs.flatMap((bdc) => bdc.mediaId === null ? [] : [bdc.mediaId])))
    const pageMediaSources = Object.fromEntries([...mediaIds].flatMap((mediaId) => {
      const source = mediaSources?.[mediaId]
      return source === undefined ? [] : [[mediaId, source]]
    }))
    const pageMediaTypes = Object.fromEntries([...mediaIds].flatMap((mediaId) => {
      const type = document.medias.find((media) => media.id === mediaId)?.type
      return type === undefined ? [] : [[mediaId, type]]
    }))
    const scenePage = {
      id: page.id,
      type: page.type,
      bdcIds: page.bdcIds,
      chapterId: pageBdcs.some((bdc) => bdc?.evaluationResult != null) ? page.chapterId : undefined,
    }
    const signature = JSON.stringify([scenePage, pageBdcs, pageMediaSources, pageMediaTypes])
    const cached = cache?.get(pageId)
    if (cached?.signature === signature) {
      pageStyleSheets.push(...cached.styleSheets)
      return [`scene-${page.id}`, cached.source]
    }
    const scene = buildFluxScene(page, document.bdcs, {
      mediaSources: pageMediaSources,
      mediaTypes: pageMediaTypes,
    })
    pageStyleSheets.push(...scene.styleSheets)
    const questionReset = scene.questionReset
    const source: SightySceneSourceValue = questionReset === undefined ? scene.sceneDoc : {
      sceneDoc: scene.sceneDoc,
      onReset: (keys: readonly string[]) => keys.includes('all') || keys.includes('quiz')
        ? { name: questionReset.eventName, data: { keys: [...keys] } }
        : undefined,
    }
    cache?.set(pageId, { signature, source, styleSheets: scene.styleSheets })
    return [`scene-${page.id}`, source]
  }))
  return { scenes, styleSheets: [...new Set(pageStyleSheets)] }
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
