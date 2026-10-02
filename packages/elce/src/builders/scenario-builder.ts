import type { PersoDoc, SceneDoc } from 'codplay/scene/types'
import type {
  SightyActionContext,
  SightyGraphView,
  SightyScenarioDefinition,
  SightyScenarioStateApi,
  SightyViewAction,
  SightyViewGraph,
} from '@codplay/sighty'
import {
  ELCE_EVENTS,
  ELCE_SCENARIO,
  ELCE_SCENARIO_HANDLERS,
} from '../config/document-config'
import type { ElceDocument } from '../domain/document-model'
import type { Chapter, Page } from '../domain/document-types'
import type { ElceSceneKey, ElceSlotName } from './scenario-builder-types'

type ElcePresentation = Readonly<{
  readonly title: string
  readonly menuClassPatch: Readonly<{ add: string; remove: string }>
  readonly menuPageStates: readonly Readonly<{ id: string; active: boolean; allowed: boolean }>[]
  readonly previousAttributes: Readonly<{ type: 'button'; disabled: boolean }>
  readonly nextAttributes: Readonly<{ type: 'button'; disabled: boolean }>
  readonly navigationStatus: string
}>

type ElceProgressContext = Readonly<{
  readonly finishedPages?: readonly string[]
}>

/** Builds the complete Sighty document graph and its persistent presentation scenes. */
export function buildScenario(
  document: ElceDocument,
  scenes: Readonly<Record<string, SceneDoc<string>>>,
  startPageId?: string,
): SightyScenarioDefinition<ElceSceneKey, ElceSlotName> {
  const pageIds = scenarioPageIds(document)
  const firstPageId = resolveStartPageId(pageIds, startPageId)
  const pagePaths = createPagePaths(document, pageIds)
  const sceneCatalog: Record<string, SceneDoc<string>> = {
    [ELCE_SCENARIO.LAYOUT_SCENE]: createLayoutScene(document.id),
    [ELCE_SCENARIO.MENU_SCENE]: createMenuScene(document),
    [ELCE_SCENARIO.TITLE_SCENE]: createTitleScene(),
    [ELCE_SCENARIO.NAVIGATION_SCENE]: createNavigationScene(),
    [`scene-${ELCE_SCENARIO.EMPTY_PAGE}`]: createEmptyPageScene(document.id),
    ...scenes,
  }

  return {
    format: 'sighty',
    version: 1,
    id: `${document.id}-scenario`,
    data: {
      pageIds,
      pageNames: Object.fromEntries(document.pages.map((page) => [page.id, page.name])),
      pagePaths,
    },
    views: {
      start: ELCE_SCENARIO.ROOT_VIEW,
      views: {
        [ELCE_SCENARIO.ROOT_VIEW]: {
          action: ELCE_SCENARIO_HANDLERS.REFRESH_PRESENTATION,
          actions: createScenarioActions(pageIds, pagePaths),
          view: {
            scene: ELCE_SCENARIO.LAYOUT_SCENE,
            slots: {
              [ELCE_SCENARIO.MENU_SLOT]: createPersistentSceneSlot(
                ELCE_SCENARIO.MENU_SCENE,
                ELCE_SCENARIO.MENU_SLOT,
              ),
              [ELCE_SCENARIO.TITLE_SLOT]: createPersistentSceneSlot(
                ELCE_SCENARIO.TITLE_SCENE,
                ELCE_SCENARIO.TITLE_SLOT,
              ),
              [ELCE_SCENARIO.NAVIGATION_SLOT]: createPersistentSceneSlot(
                ELCE_SCENARIO.NAVIGATION_SCENE,
                ELCE_SCENARIO.NAVIGATION_SLOT,
              ),
            },
            views: createScenarioViews(document, firstPageId),
          },
        },
      },
    },
    scenes: sceneCatalog,
    actions: {
      [ELCE_SCENARIO_HANDLERS.REFRESH_PRESENTATION]: refreshPresentation,
      [ELCE_SCENARIO_HANDLERS.MARK_PAGE_FINISHED]: markPageFinished,
    },
    guards: {
      [ELCE_SCENARIO_HANDLERS.PAGE_ACCESS]: createPageAccessGuard(pageIds),
      [ELCE_SCENARIO_HANDLERS.PAGE_EXIT]: createPageExitGuard(pageIds),
    },
  }
}

/** Returns the document order consumed by the content slot and its navigation. */
function scenarioPageIds(document: ElceDocument): readonly string[] {
  return [
    ...document.data.scenarioPageIds,
    ...document.chapters.flatMap((chapter) => chapter.pageIds),
  ]
}

/** Builds the scenario-level entries: the root page slot and one slot per chapter. */
function createScenarioViews(
  document: ElceDocument,
  firstPageId: string,
): SightyViewGraph<ElceSceneKey, ElceSlotName> {
  const views: Record<string, SightyGraphView<ElceSceneKey, ElceSlotName>> = {
    [ELCE_SCENARIO.ROOT_PAGES_VIEW]: {
      view: {
        slots: {
          [ELCE_SCENARIO.CONTENT_SLOT]: createPageViews(document, document.data.scenarioPageIds, firstPageId),
        },
      },
    },
  }
  for (const chapter of document.chapters) {
    if (chapter.pageIds.length === 0) continue
    views[chapter.id] = {
      view: {
        slots: {
          [ELCE_SCENARIO.CONTENT_SLOT]: createPageViews(document, chapter.pageIds, firstPageId),
        },
      },
    }
  }
  const start = document.data.scenarioPageIds.length > 0
    && document.data.scenarioPageIds.includes(firstPageId)
    ? ELCE_SCENARIO.ROOT_PAGES_VIEW
    : chapterIdForPage(document, firstPageId) ?? firstNonEmptyChapterId(document) ?? ELCE_SCENARIO.ROOT_PAGES_VIEW
  return {
    start,
    accessBy: ELCE_SCENARIO_HANDLERS.PAGE_ACCESS,
    exitBy: ELCE_SCENARIO_HANDLERS.PAGE_EXIT,
    actions: {
      [ELCE_EVENTS.NAVIGATION_NEXT]: { go: { direction: 'next' } },
      [ELCE_EVENTS.NAVIGATION_PREVIOUS]: { go: { direction: 'previous' } },
      [ELCE_EVENTS.PAGE_BOTTOM]: { action: ELCE_SCENARIO_HANDLERS.MARK_PAGE_FINISHED },
    },
    onDenied: { path: pagePath(document, firstPageId) },
    views,
  }
}

/** Returns the first chapter that contributes pages to the scenario graph. */
function firstNonEmptyChapterId(document: ElceDocument): string | undefined {
  return document.chapters.find((chapter) => chapter.pageIds.length > 0)?.id
}

/** Returns the chapter entry that owns a page, when the page is not at root. */
function chapterIdForPage(document: ElceDocument, pageId: string): string | undefined {
  return document.chapters.find((chapter) => chapter.pageIds.includes(pageId))?.id
}

/** Resolves the requested page while keeping document order as fallback. */
function resolveStartPageId(pageIds: readonly string[], requestedPageId: string | undefined): string {
  if (requestedPageId !== undefined && pageIds.includes(requestedPageId)) return requestedPageId
  return pageIds[0] ?? ELCE_SCENARIO.EMPTY_PAGE
}

/** Builds the route table shared by menu actions and presentation refreshes. */
function createPagePaths(document: ElceDocument, pageIds: readonly string[]): Readonly<Record<string, string>> {
  return Object.fromEntries([
    ...pageIds.map((pageId) => [pageId, pagePath(document, pageId)]),
    [ELCE_SCENARIO.EMPTY_PAGE, pagePath(document, ELCE_SCENARIO.EMPTY_PAGE)],
  ])
}

/** Builds the content graph with one explicit scene view per page. */
function createPageViews(
  document: ElceDocument,
  pageIds: readonly string[],
  requestedPageId?: string,
): SightyViewGraph<ElceSceneKey, ElceSlotName> {
  const entries: Record<string, SightyGraphView<ElceSceneKey, ElceSlotName>> = Object.fromEntries(pageIds.map((pageId) => {
    const page = findPage(document, pageId)
    return [page.id, { view: { scene: `scene-${page.id}` as ElceSceneKey } }]
  }))
  const start = requestedPageId !== undefined && pageIds.includes(requestedPageId)
    ? requestedPageId
    : pageIds[0] ?? ELCE_SCENARIO.EMPTY_PAGE
  if (pageIds.length === 0) entries[ELCE_SCENARIO.EMPTY_PAGE] = { view: { scene: `scene-${ELCE_SCENARIO.EMPTY_PAGE}` } }
  return { start, views: entries }
}

/** Creates one persistent scene slot under the document layout. */
function createPersistentSceneSlot(
  sceneKey: ElceSceneKey,
  slotName: ElceSlotName,
): SightyViewGraph<ElceSceneKey, ElceSlotName> {
  const viewId = `${slotName}-view`
  return {
    start: viewId,
    views: {
      [viewId]: { view: { scene: sceneKey } },
    },
  }
}

/** Declares all page routes and presentation events at the document root. */
function createScenarioActions(
  pageIds: readonly string[],
  pagePaths: Readonly<Record<string, string>>,
): Readonly<Record<string, SightyViewAction<ElceSceneKey, ElceSlotName>>> {
  const actions: Record<string, SightyViewAction<ElceSceneKey, ElceSlotName>> = {
    [ELCE_EVENTS.PRESENTATION_REFRESH]: {},
  }
  for (const pageId of pageIds) {
    actions[menuEvent(pageId)] = { go: { path: pagePathFromTable(pagePaths, pageId) } }
  }
  return actions
}

/** Creates the page access condition used by the menu and the content slot. */
function createPageAccessGuard(pageIds: readonly string[]) {
  return ({ sceneKey, event, context }: { sceneKey: ElceSceneKey; event?: { name: string }; context: Readonly<Record<string, unknown>> }): boolean => {
    const pageId = pageIdFromSceneKey(sceneKey)
    if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return true
    if (event?.name === ELCE_EVENTS.RUNTIME_INITIALIZE) return true
    const pageIndex = pageIds.indexOf(pageId)
    if (pageIndex <= 0) return pageIndex === 0
    const finishedPages = readFinishedPages(context)
    return pageIds.slice(0, pageIndex).every((candidate) => finishedPages.includes(candidate))
  }
}

/** Creates the page exit condition that follows Demo 5's scroll-end navigation. */
function createPageExitGuard(pageIds: readonly string[]) {
  return ({ sceneKey, event, context }: { sceneKey: ElceSceneKey; event?: { name: string }; context: Readonly<Record<string, unknown>> }): boolean => {
    const pageId = pageIdFromSceneKey(sceneKey)
    if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return true
    switch (event?.name) {
      case ELCE_EVENTS.NAVIGATION_PREVIOUS:
        return pageIds.indexOf(pageId) > 0
      case ELCE_EVENTS.NAVIGATION_NEXT:
        return readFinishedPages(context).includes(pageId)
      default:
        return event?.name?.startsWith(ELCE_EVENTS.MENU_PREFIX) === true
    }
  }
}

/** Records the current page's bottom marker and refreshes the fixed controls. */
async function markPageFinished(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  const pageId = pageIdFromSceneKey(context.event.sourceSceneKey)
  if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return
  const finishedPages = readFinishedPages(context.context)
  if (!finishedPages.includes(pageId)) {
    await context.updateContext({ finishedPages: [...finishedPages, pageId] })
  }
  await refreshPresentation(context)
}

/** Refreshes menu, title, and navigation from the active Sighty page. */
async function refreshPresentation(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  const pageIds = readPageIds(context)
  const pageNames = readPageNames(context)
  const pagePaths = readPagePaths(context)
  const presentation = await createPresentation(context.scenarioState, pageIds, pageNames, pagePaths)
  await context.send(ELCE_SCENARIO.TITLE_SCENE, {
    name: ELCE_EVENTS.PRESENTATION_TITLE,
    data: { content: presentation.title },
  }, { scope: 'story', storyId: 'main' })
  await context.send(ELCE_SCENARIO.MENU_SCENE, {
    name: ELCE_EVENTS.PRESENTATION_MENU,
    data: { className: presentation.menuClassPatch },
  }, { scope: 'story', storyId: 'main' })
  for (const page of presentation.menuPageStates) {
    await context.send(ELCE_SCENARIO.MENU_SCENE, {
      name: menuPresentationEvent(page.id),
      data: {
        attr: {
          'data-active': String(page.active),
          'data-locked': String(!page.allowed),
        },
      },
    }, { scope: 'story', storyId: 'main' })
  }
  await context.send(ELCE_SCENARIO.NAVIGATION_SCENE, {
    name: ELCE_EVENTS.PRESENTATION_NAVIGATION_PREVIOUS,
    data: { attr: presentation.previousAttributes },
  }, { scope: 'story', storyId: 'main' })
  await context.send(ELCE_SCENARIO.NAVIGATION_SCENE, {
    name: ELCE_EVENTS.PRESENTATION_NAVIGATION_STATUS,
    data: { content: presentation.navigationStatus },
  }, { scope: 'story', storyId: 'main' })
  await context.send(ELCE_SCENARIO.NAVIGATION_SCENE, {
    name: ELCE_EVENTS.PRESENTATION_NAVIGATION_NEXT,
    data: { attr: presentation.nextAttributes },
  }, { scope: 'story', storyId: 'main' })
}

/** Projects the current page and its guard answers into the fixed controls. */
async function createPresentation(
  scenarioState: SightyScenarioStateApi<ElceSceneKey, ElceSlotName>,
  pageIds: readonly string[],
  pageNames: Readonly<Record<string, string>>,
  pagePaths: Readonly<Record<string, string>>,
): Promise<ElcePresentation> {
  const activePageId = pageIdFromSceneKey(scenarioState.active?.sceneKey)
  const pageIndex = activePageId === undefined ? -1 : pageIds.indexOf(activePageId)
  const page = activePageId === undefined ? undefined : pageIds[pageIndex]
  const previousAllowed = page === undefined
    ? false
    : await scenarioState.canExit(
        { path: pagePathFromTable(pagePaths, page) },
      { name: ELCE_EVENTS.NAVIGATION_PREVIOUS, sourceSceneKey: ELCE_SCENARIO.NAVIGATION_SCENE },
      )
  const nextAllowed = page === undefined
    ? false
    : await scenarioState.canExit(
        { path: pagePathFromTable(pagePaths, page) },
      { name: ELCE_EVENTS.NAVIGATION_NEXT, sourceSceneKey: ELCE_SCENARIO.NAVIGATION_SCENE },
      )

  const menu = await createMenuClassPatch(activePageId, pageIds, pagePaths, scenarioState)
  return {
    title: page === undefined || page === ELCE_SCENARIO.EMPTY_PAGE ? 'Aucune page' : pageNames[page] ?? page,
    menuClassPatch: menu.patch,
    menuPageStates: menu.states,
    previousAttributes: { type: 'button', disabled: pageIndex <= 0 || !previousAllowed },
    nextAttributes: { type: 'button', disabled: pageIndex < 0 || pageIndex >= pageIds.length - 1 || !nextAllowed },
    navigationStatus: pageIndex < 0 || page === ELCE_SCENARIO.EMPTY_PAGE
      ? ''
      : `Page ${pageIndex + 1} sur ${pageIds.length}`,
  }
}

/** Computes menu classes using the same access guard as the content slot. */
async function createMenuClassPatch(
  activePageId: string | undefined,
  pageIds: readonly string[],
  pagePaths: Readonly<Record<string, string>>,
  scenarioState: SightyScenarioStateApi<ElceSceneKey, ElceSlotName>,
): Promise<Readonly<{
  readonly patch: Readonly<{ add: string; remove: string }>
  readonly states: readonly Readonly<{ id: string; active: boolean; allowed: boolean }>[]
}>> {
  const access = await Promise.all(pageIds.map(async (pageId) => ({
    id: pageId,
    allowed: pageId === activePageId
      ? true
      : await scenarioState.canAccess(
          { path: pagePathFromTable(pagePaths, pageId) },
          { name: menuEvent(pageId), sourceSceneKey: ELCE_SCENARIO.MENU_SCENE },
        ),
  })))
  const classes = ['elce-player-menu-state']
  return {
    patch: { add: classes.join(' '), remove: classes.join(' ') },
    states: access.map((page) => ({ id: page.id, active: page.id === activePageId, allowed: page.allowed })),
  }
}

/** Reads the ordered page catalogue from static scenario data. */
function readPageIds(context: SightyActionContext<ElceSceneKey, ElceSlotName>): readonly string[] {
  const pageIds = context.data.pageIds
  return Array.isArray(pageIds) ? pageIds.filter((pageId): pageId is string => typeof pageId === 'string') : []
}

/** Reads the static page names stored beside the ordered scenario catalogue. */
function readPageNames(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Readonly<Record<string, string>> {
  const pageNames = context.data.pageNames
  if (typeof pageNames !== 'object' || pageNames === null) return {}
  return Object.fromEntries(Object.entries(pageNames).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}

/** Reads the stable page routes stored beside the scenario page catalogue. */
function readPagePaths(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Readonly<Record<string, string>> {
  const pagePaths = context.data.pagePaths
  if (typeof pagePaths !== 'object' || pagePaths === null) return {}
  return Object.fromEntries(Object.entries(pagePaths).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}

/** Reads the progress list stored in Sighty context. */
function readFinishedPages(context: Readonly<Record<string, unknown>>): readonly string[] {
  const progress = context as ElceProgressContext
  return progress.finishedPages ?? []
}

/** Returns a page from the métier document or fails at the builder boundary. */
function findPage(document: ElceDocument, pageId: string): Page {
  const page = document.pages.find((candidate) => candidate.id === pageId)
  if (page === undefined) throw new Error(`Page absente du document : ${pageId}`)
  return page
}

/** Creates the fixed layout with the five explicit regions of the complete preview. */
function createLayoutScene(documentId: string): SceneDoc<string> {
  const menuPartId = `${documentId}:layout:menu`
  const titlePartId = `${documentId}:layout:title`
  const contentPartId = `${documentId}:layout:content`
  const navigationPartId = `${documentId}:layout:navigation`
  return {
    id: `${documentId}-layout-scene`,
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        persos: [
          {
            id: `${documentId}-layout`,
            type: 'layout',
            initial: {
              move: '@root',
              className: 'elce-player-layout',
              markup: `<main id="${documentId}-layout-root" class="elce-player-layout">
                <aside id="${documentId}-menu-region" class="elce-player-layout__menu" data-part="${menuPartId}" aria-label="Menu du document"></aside>
                <header id="${documentId}-title-region" class="elce-player-layout__title" data-part="${titlePartId}" aria-label="Page courante"></header>
                <section id="${documentId}-content-region" class="elce-player-layout__content" data-part="${contentPartId}" aria-label="Contenu de la page"></section>
                <nav id="${documentId}-navigation-region" class="elce-player-layout__navigation" aria-label="Navigation des pages">
                  <div id="${documentId}-navigation-host" class="elce-player-layout__navigation-host" data-part="${navigationPartId}"></div>
                </nav>
              </main>`,
            },
            actions: {},
          },
          createLayoutSlot(ELCE_SCENARIO.MENU_SLOT, menuPartId, 'elce-player-layout__menu-slot'),
          createLayoutSlot(ELCE_SCENARIO.TITLE_SLOT, titlePartId, 'elce-player-layout__title-slot'),
          createLayoutSlot(ELCE_SCENARIO.CONTENT_SLOT, contentPartId, 'elce-player-layout__content-slot elce-player-content-slot'),
          createLayoutSlot(ELCE_SCENARIO.NAVIGATION_SLOT, navigationPartId, 'elce-player-layout__navigation-slot'),
        ],
      },
    },
  }
}

/** Creates one named CodPlay slot in its matching layout region. */
function createLayoutSlot(name: string, target: string, className: string): PersoDoc<string> {
  return {
    id: `elce-${name}`,
    name,
    type: 'slot',
    initial: { move: { target }, className },
    actions: {},
  }
}

/** Builds the menu scene from chapters, scenario pages, and the document order. */
function createMenuScene(document: ElceDocument): SceneDoc<string> {
  const chapterMarkup = document.chapters.map((chapter) => createChapterMarkup(document, chapter)).join('')
  const scenarioPages = document.data.scenarioPageIds.map((pageId) => findPage(document, pageId))
  const scenarioMarkup = scenarioPages.length === 0 ? '' : `<ol id="elce-menu-scenario-pages" class="elce-player-menu__pages elce-player-menu__pages--root">${scenarioPages.map((page) => createMenuPageMarkup(page)).join('')}</ol>`
  const pagePersos = scenarioPageIds(document).map((pageId) => createMenuPagePerso(findPage(document, pageId)))
  const chapterPersos = document.chapters.flatMap((chapter) => createChapterPerso(chapter))
  return {
    id: `${document.id}-menu-scene`,
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        persos: [
          {
            id: `${document.id}-menu-root`,
            type: 'layout',
            initial: {
              move: '@root',
              className: 'elce-player-menu',
              markup: `<nav id="${document.id}-menu-root" class="elce-player-menu" aria-label="Chapitres et pages du document">
                <h2 id="${document.id}-menu-title" class="elce-player-menu__title">Sommaire</h2>
                <span id="${document.id}-menu-state-host" class="elce-player-menu__state" data-part="elce:menu:state" aria-hidden="true"></span>
                <div id="${document.id}-menu-scroll" class="elce-player-menu__scroll">${scenarioMarkup}${chapterMarkup}</div>
              </nav>`,
            },
            actions: {},
          },
          {
            id: `${document.id}-menu-state`,
            type: 'tag',
            initial: {
              tag: 'span',
              style: { display: 'none' },
              move: { target: 'elce:menu:state' },
            },
            actions: { [ELCE_EVENTS.PRESENTATION_MENU]: {} },
          },
          ...chapterPersos,
          ...pagePersos,
        ],
      },
    },
  }
}

/** Creates the static chapter and page hosts in the menu markup. */
function createChapterMarkup(document: ElceDocument, chapter: Chapter): string {
  const pages = chapter.pageIds.map((pageId) => findPage(document, pageId))
  return `<section id="elce-menu-chapter-${chapter.id}" class="elce-player-menu__group">
    <h2 id="elce-menu-chapter-heading-${chapter.id}" class="elce-player-menu__group-title"><span id="elce-menu-chapter-heading-host-${chapter.id}" data-part="elce:menu:chapter:${chapter.id}"></span></h2>
    <ol id="elce-menu-chapter-pages-${chapter.id}" class="elce-player-menu__pages">${pages.map((page) => createMenuPageMarkup(page)).join('')}</ol>
  </section>`
}

/** Creates one menu page row with an explicit CodPlay insertion host. */
function createMenuPageMarkup(page: Page): string {
  return `<li id="elce-menu-page-row-${page.id}" class="elce-player-menu__page-row">
    <div id="elce-menu-page-host-${page.id}" data-part="elce:menu:page:${page.id}"></div>
  </li>`
}

/** Creates one chapter heading perso. */
function createChapterPerso(chapter: Chapter): readonly PersoDoc<string>[] {
  if (chapter.pageIds.length === 0) return []
  const firstPageId = chapter.pageIds[0]
  if (firstPageId === undefined) return []
  return [{
    id: `elce-menu-chapter-button-${chapter.id}`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: chapter.name,
      attr: { type: 'button' },
      className: `elce-player-menu__chapter-button elce-player-menu__chapter-button--${pageClassToken(chapter.id)}`,
      move: { target: `elce:menu:chapter:${chapter.id}` },
    },
    emit: { click: { event: { name: menuEvent(firstPageId), visibility: 'public' } } },
  }]
}

/** Creates one page button routed through the Sighty page guard. */
function createMenuPagePerso(page: Page): PersoDoc<string> {
  return {
    id: `elce-menu-page-button-${page.id}`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: page.name,
      attr: { type: 'button', 'data-page-id': page.id },
      className: `elce-player-menu__page-button elce-player-menu__page-button--${pageClassToken(page.id)}`,
      move: { target: `elce:menu:page:${page.id}` },
    },
    emit: { click: { event: { name: menuEvent(page.id), visibility: 'public' } } },
    actions: {
      [menuPresentationEvent(page.id)]: {
        attr: { 'data-active': 'false', 'data-locked': 'false' },
      },
    },
  }
}

/** Builds the title scene updated by the Sighty presentation action. */
function createTitleScene(): SceneDoc<string> {
  return {
    id: `${ELCE_SCENARIO.TITLE_SCENE}-document`,
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        persos: [{
          id: 'elce-current-title',
          type: 'tag',
          initial: { tag: 'h1', content: 'Titre en attente', className: 'elce-player-title', move: '@root' },
          actions: { [ELCE_EVENTS.PRESENTATION_TITLE]: {} },
        }],
      },
    },
  }
}

/** Builds the navigation scene with explicit previous, status, and next hosts. */
function createNavigationScene(): SceneDoc<string> {
  return {
    id: `${ELCE_SCENARIO.NAVIGATION_SCENE}-document`,
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        persos: [
          {
            id: 'elce-navigation-controls',
            type: 'layout',
            initial: {
              move: '@root',
              className: 'elce-player-navigation',
              markup: `<div id="elce-navigation-controls-root" class="elce-player-navigation">
                <div id="elce-navigation-previous-host" data-part="elce:navigation:previous"></div>
                <div id="elce-navigation-status-host" data-part="elce:navigation:status"></div>
                <div id="elce-navigation-next-host" data-part="elce:navigation:next"></div>
              </div>`,
            },
            actions: {},
          },
          {
            id: 'elce-navigation-previous',
            type: 'tag',
            initial: {
              tag: 'button',
              content: 'Précédent',
              attr: { type: 'button', disabled: true },
              className: 'elce-player-navigation__button',
              move: { target: 'elce:navigation:previous' },
            },
            emit: { click: { event: { name: ELCE_EVENTS.NAVIGATION_PREVIOUS, visibility: 'public' } } },
            actions: { [ELCE_EVENTS.PRESENTATION_NAVIGATION_PREVIOUS]: {} },
          },
          {
            id: 'elce-navigation-status',
            type: 'tag',
            initial: {
              tag: 'p',
              content: '',
              className: 'elce-player-navigation__status',
              move: { target: 'elce:navigation:status' },
            },
            actions: { [ELCE_EVENTS.PRESENTATION_NAVIGATION_STATUS]: {} },
          },
          {
            id: 'elce-navigation-next',
            type: 'tag',
            initial: {
              tag: 'button',
              content: 'Suivant',
              attr: { type: 'button', disabled: true },
              className: 'elce-player-navigation__button elce-player-navigation__button--next',
              move: { target: 'elce:navigation:next' },
            },
            emit: { click: { event: { name: ELCE_EVENTS.NAVIGATION_NEXT, visibility: 'public' } } },
            actions: { [ELCE_EVENTS.PRESENTATION_NAVIGATION_NEXT]: {} },
          },
        ],
      },
    },
  }
}

/** Creates the visible placeholder page used when a document has no placed page. */
function createEmptyPageScene(documentId: string): SceneDoc<string> {
  return {
    id: `${documentId}-empty-page-scene`,
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        persos: [{
          id: `${documentId}-empty-page-message`,
          type: 'tag',
          initial: {
            tag: 'p',
            content: 'Aucune page à afficher.',
            className: 'elce-player-empty-page',
            move: '@root',
          },
        }],
      },
    },
  }
}

/** Formats the stable Sighty path of a document page in its root or chapter slot. */
function pagePath(document: ElceDocument, pageId: string): string {
  if (pageId === ELCE_SCENARIO.EMPTY_PAGE || document.data.scenarioPageIds.includes(pageId)) {
    return `${ELCE_SCENARIO.ROOT_VIEW}/${ELCE_SCENARIO.ROOT_PAGES_VIEW}/${ELCE_SCENARIO.CONTENT_SLOT}/${pageId}`
  }
  const chapter = document.chapters.find((candidate) => candidate.pageIds.includes(pageId))
  if (chapter === undefined) throw new Error(`Page absente du scénario : ${pageId}`)
  return `${ELCE_SCENARIO.ROOT_VIEW}/${chapter.id}/${ELCE_SCENARIO.CONTENT_SLOT}/${pageId}`
}

/** Resolves a page path from the immutable scenario data table. */
function pagePathFromTable(pagePaths: Readonly<Record<string, string>>, pageId: string): string {
  const path = pagePaths[pageId]
  if (path === undefined) throw new Error(`Route Sighty absente pour la page : ${pageId}`)
  return path
}

/** Formats the public menu selection event for one page. */
function menuEvent(pageId: string): string {
  return `${ELCE_EVENTS.MENU_PREFIX}${pageId}`
}

/** Formats the private presentation event sent to one menu button perso. */
function menuPresentationEvent(pageId: string): string {
  return `${ELCE_EVENTS.PRESENTATION_MENU_PAGE_PREFIX}${pageId}`
}

/** Reads a page identifier from a generated page scene key. */
function pageIdFromSceneKey(sceneKey: string | undefined): string | undefined {
  if (sceneKey === undefined || !sceneKey.startsWith('scene-')) return undefined
  return sceneKey.slice('scene-'.length)
}

/** Keeps generated identifiers valid as CSS class suffixes. */
function pageClassToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}
