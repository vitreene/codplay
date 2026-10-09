import type { PersoDoc, SceneDoc } from 'codplay/scene/types'
import type {
  SightyActionContext,
  SightyGraphView,
  SightyScenarioDefinition,
  SightyScenarioStateApi,
  SightyViewAction,
  SightyViewGraph,
} from '@codplay/sighty'
import type { SightySceneSourceValue } from '@codplay/sighty'
import {
  ELCE_EVENTS,
  ELCE_SCENARIO,
  ELCE_SCENARIO_HANDLERS,
  SCENARIO_ENTRY_KIND,
} from '../../config/document-config'
import type { ElceDocument } from '../../domain/document/document-model'
import type { Chapter, Page } from '../../domain/document/document-types'
import {
  BDC_TYPE,
  CHAPTER_TYPE,
  DEFAULT_EVALUATION_SETTINGS,
  DEFAULT_EVALUATION_THRESHOLD,
} from '../../config/document-config'
import { EvaluationMachine } from '../../domain/evaluation/evaluation-machine'
import type { EvaluationMachineState } from '../../domain/evaluation/evaluation-machine-types'
import { ElceChapterEvaluation } from '../../domain/evaluation/chapter-evaluation'
import type { ScenarioEntry } from '../../domain/scenario/scenario-entry-types'
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
  readonly questionResults?: Readonly<Record<string, boolean>>
  readonly evaluationStates?: Readonly<Record<string, EvaluationMachineState>>
}>

const chapterEvaluation = new ElceChapterEvaluation()

/** Builds the complete Sighty document graph and its persistent presentation scenes. */
export function buildScenario(
  document: ElceDocument,
  scenes: Readonly<Record<string, SightySceneSourceValue>>,
  startPageId?: string,
): SightyScenarioDefinition<ElceSceneKey, ElceSlotName> {
  const pageIds = scenarioPageIds(document)
  const firstPageId = resolveStartPageId(pageIds, startPageId)
  const pagePaths = createPagePaths(document, pageIds)
  const questionBdcByPage = Object.fromEntries(document.pages.flatMap((page) => {
    const question = page.bdcIds.map((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId))
      .find((bdc) => bdc?.type === BDC_TYPE.QUESTION)
    return question === undefined ? [] : [[page.id, question.id]]
  }))
  const evaluationResultPageIds = new Set(document.pages.flatMap((page) => {
    const hasEvaluationResult = page.bdcIds.some((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId)?.type === BDC_TYPE.EVALUATION_RESULT)
    return hasEvaluationResult ? [page.id] : []
  }))
  const sceneCatalog: Record<string, SightySceneSourceValue> = {
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
      questionBdcByPage,
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
      [ELCE_SCENARIO_HANDLERS.OPEN_MENU_DRAWER]: openMenuDrawer,
      [ELCE_SCENARIO_HANDLERS.CLOSE_MENU_DRAWER]: closeMenuDrawer,
      [ELCE_SCENARIO_HANDLERS.MARK_PAGE_FINISHED]: markPageFinished,
      [ELCE_SCENARIO_HANDLERS.RECORD_QUESTION_RESULT]: createRecordQuestionResult(document),
      [ELCE_SCENARIO_HANDLERS.REFRESH_EVALUATION_RESULT]: createRefreshEvaluationResult(document),
    },
    guards: {
      [ELCE_SCENARIO_HANDLERS.PAGE_ACCESS]: createPageAccessGuard(
        pageIds,
        questionBdcByPage,
        firstPageId,
        evaluationResultPageIds,
      ),
      [ELCE_SCENARIO_HANDLERS.PAGE_EXIT]: createPageExitGuard(document, pageIds, questionBdcByPage),
    },
  }
}

/** Returns the document order consumed by the content slot and its navigation. */
function scenarioPageIds(document: ElceDocument): readonly string[] {
  return document.scenarioPageIds
}

/** Builds one ordered root view for each page or chapter entry. */
function createScenarioViews(
  document: ElceDocument,
  firstPageId: string,
): SightyViewGraph<ElceSceneKey, ElceSlotName> {
  const views: Record<string, SightyGraphView<ElceSceneKey, ElceSlotName>> = Object.fromEntries(
    document.data.scenarioEntries.flatMap((entry) => scenarioEntryView(document, entry, firstPageId)),
  )
  const start = document.scenarioPageIds.length === 0
    ? ELCE_SCENARIO.EMPTY_ENTRY_VIEW
    : scenarioEntryViewIdForPage(document, firstPageId)
  if (document.scenarioPageIds.length === 0) {
    views[ELCE_SCENARIO.EMPTY_ENTRY_VIEW] = {
      view: {
        slots: {
          [ELCE_SCENARIO.CONTENT_SLOT]: createPageViews(document, [], firstPageId),
        },
      },
    }
  }
  return {
    start,
    accessBy: ELCE_SCENARIO_HANDLERS.PAGE_ACCESS,
    exitBy: ELCE_SCENARIO_HANDLERS.PAGE_EXIT,
    actions: {
      [ELCE_EVENTS.NAVIGATION_NEXT]: {
        go: { direction: 'next' },
        action: ELCE_SCENARIO_HANDLERS.REFRESH_EVALUATION_RESULT,
      },
      [ELCE_EVENTS.NAVIGATION_PREVIOUS]: {
        go: { direction: 'previous' },
        action: ELCE_SCENARIO_HANDLERS.REFRESH_EVALUATION_RESULT,
      },
      [ELCE_EVENTS.PAGE_FINISHED]: { action: ELCE_SCENARIO_HANDLERS.MARK_PAGE_FINISHED },
    [ELCE_EVENTS.QUESTION_ANSWERED]: { action: ELCE_SCENARIO_HANDLERS.RECORD_QUESTION_RESULT },
  },
  showMode: 'reset',
    onDenied: { path: pagePath(document, firstPageId) },
    views,
  }
}

/** Creates the Sighty view for one root page or non-empty chapter. */
function scenarioEntryView(
  document: ElceDocument,
  entry: ScenarioEntry,
  firstPageId: string,
): readonly [string, SightyGraphView<ElceSceneKey, ElceSlotName>][] {
  switch (entry.kind) {
    case SCENARIO_ENTRY_KIND.PAGE:
      return [[scenarioEntryViewId(entry), {
        view: {
          slots: {
            [ELCE_SCENARIO.CONTENT_SLOT]: createPageViews(document, [entry.pageId], firstPageId),
          },
        },
      }]]
    case SCENARIO_ENTRY_KIND.CHAPTER: {
      const chapter = findChapter(document, entry.chapterId)
      if (chapter.pageIds.length === 0) return []
      return [[scenarioEntryViewId(entry), {
        view: {
          slots: {
            [ELCE_SCENARIO.CONTENT_SLOT]: createPageViews(document, chapter.pageIds, firstPageId),
          },
        },
      }]]
    }
  }
}

/** Returns a collision-safe graph key for one root entry. */
function scenarioEntryViewId(entry: ScenarioEntry): string {
  switch (entry.kind) {
    case SCENARIO_ENTRY_KIND.PAGE:
      return `${SCENARIO_ENTRY_KIND.PAGE}-${entry.pageId}`
    case SCENARIO_ENTRY_KIND.CHAPTER:
      return `${SCENARIO_ENTRY_KIND.CHAPTER}-${entry.chapterId}`
  }
}

/** Resolves the graph entry that contains a page. */
function scenarioEntryViewIdForPage(document: ElceDocument, pageId: string): string {
  const page = findPage(document, pageId)
  switch (page.chapterId) {
    case null:
      return scenarioEntryViewId({ kind: SCENARIO_ENTRY_KIND.PAGE, pageId: page.id })
    default:
      return scenarioEntryViewId({ kind: SCENARIO_ENTRY_KIND.CHAPTER, chapterId: page.chapterId })
  }
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

/** Sends the drawer-open event to the existing persistent menu scene. */
async function openMenuDrawer(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  await context.send(ELCE_SCENARIO.MENU_SCENE, {
    name: ELCE_EVENTS.MENU_DRAWER_OPEN,
  }, { scope: 'story', storyId: 'main' })
}

/** Sends a responsive close request through the persistent menu scene. */
async function closeMenuDrawer(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  await context.send(ELCE_SCENARIO.MENU_SCENE, {
    name: ELCE_EVENTS.MENU_DRAWER_CLOSE,
  }, { scope: 'story', storyId: 'main' })
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
    [ELCE_EVENTS.MENU_DRAWER_OPEN]: { action: ELCE_SCENARIO_HANDLERS.OPEN_MENU_DRAWER },
    [ELCE_EVENTS.MENU_DRAWER_CLOSE_REQUEST]: { action: ELCE_SCENARIO_HANDLERS.CLOSE_MENU_DRAWER },
  }
  for (const pageId of pageIds) {
    actions[menuEvent(pageId)] = {
      go: { path: pagePathFromTable(pagePaths, pageId) },
      action: ELCE_SCENARIO_HANDLERS.REFRESH_EVALUATION_RESULT,
    }
  }
  return actions
}

/** Creates the page access condition used by the menu and the content slot. */
function createPageAccessGuard(
  pageIds: readonly string[],
  questionBdcByPage: Readonly<Record<string, string>>,
  previewStartPageId: string,
  evaluationResultPageIds: ReadonlySet<string>,
) {
  return ({ sceneKey, event, context }: { sceneKey: ElceSceneKey; event?: { name: string }; context: Readonly<Record<string, unknown>> }): boolean => {
    const pageId = pageIdFromSceneKey(sceneKey)
    if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return true
    if (event?.name === ELCE_EVENTS.RUNTIME_INITIALIZE) return true
    const pageIndex = pageIds.indexOf(pageId)
    if (pageIndex <= 0) return pageIndex === 0
    if (pageId === previewStartPageId) return true
    const previewStartIndex = pageIds.indexOf(previewStartPageId)
    const prefixStartIndex = pageIndex > previewStartIndex && !evaluationResultPageIds.has(pageId)
      ? previewStartIndex
      : 0
    return pageIds.slice(prefixStartIndex, pageIndex)
      .every((candidate) => isPageComplete(candidate, context, questionBdcByPage))
  }
}

/** Creates the page exit condition that follows Demo 5's scroll-end navigation. */
function createPageExitGuard(document: ElceDocument, pageIds: readonly string[], questionBdcByPage: Readonly<Record<string, string>>) {
  return ({ sceneKey, event, context }: { sceneKey: ElceSceneKey; event?: { name: string }; context: Readonly<Record<string, unknown>> }): boolean => {
    const pageId = pageIdFromSceneKey(sceneKey)
    if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return true
    switch (event?.name) {
      case ELCE_EVENTS.NAVIGATION_PREVIOUS:
        return pageIds.indexOf(pageId) > 0
      case ELCE_EVENTS.NAVIGATION_NEXT:
          return canLeavePage(document, pageId, questionBdcByPage, context)
      default:
        return event?.name?.startsWith(ELCE_EVENTS.MENU_PREFIX) === true
    }
  }
}

/** Records a functional page end and refreshes the fixed controls. */
async function markPageFinished(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  const pageId = pageIdFromSceneKey(context.event.sourceSceneKey)
  if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return
  const finishedPages = readFinishedPages(context.context)
  if (!finishedPages.includes(pageId)) {
    await context.updateContext({ finishedPages: [...finishedPages, pageId] })
  }
  await refreshPresentation(context)
}

/** Stores a validated answer in the existing Sighty progress and Evaluation state. */
function createRecordQuestionResult(document: ElceDocument) {
  return async (context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> => {
    const pageId = pageIdFromSceneKey(context.event.sourceSceneKey)
    if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return
    const payload = context.event.data as {
      pageId?: unknown
      bdcId?: unknown
      isCorrect?: unknown
      selectedAnswerIds?: unknown
      expectedAnswerIds?: unknown
    } | undefined
    const expectedBdcId = readQuestionBdcIds(context).find((candidate) => candidate.pageId === pageId)?.bdcId
    if (payload?.pageId !== pageId || payload.bdcId !== expectedBdcId || typeof payload.isCorrect !== 'boolean') return

    const questionResults = readQuestionResults(context.context)
    const page = document.pages.find((candidate) => candidate.id === pageId)
    const chapter = page?.chapterId === null || page?.chapterId === undefined
      ? undefined
      : document.chapters.find((candidate) => candidate.id === page.chapterId && candidate.type === CHAPTER_TYPE.EVALUATION)
    const evaluationStates = readEvaluationStates(context.context)
    const state = chapter === undefined
      ? undefined
      : recordEvaluationAnswer(document, chapter, pageId, payload, evaluationStates[chapter.id])
    await context.updateContext({
      questionResults: { ...questionResults, [pageId]: payload.isCorrect },
      ...(chapter === undefined || state === undefined
        ? {}
        : { evaluationStates: { ...evaluationStates, [chapter.id]: state } }),
    })
    await refreshPresentation(context)
  }
}

/** Records the validated answer in its chapter's existing portable machine. */
function recordEvaluationAnswer(
  document: ElceDocument,
  chapter: Chapter,
  pageId: string,
  payload: Readonly<{ selectedAnswerIds?: unknown; expectedAnswerIds?: unknown }>,
  previousState: EvaluationMachineState | undefined,
): EvaluationMachineState | undefined {
  const selectedAnswerIds = readStringIds(payload.selectedAnswerIds)
  const expectedAnswerIds = readStringIds(payload.expectedAnswerIds)
  if (selectedAnswerIds === undefined || expectedAnswerIds === undefined) return previousState
  const questionIds = evaluationQuestionPageIds(document, chapter)
  if (questionIds.length === 0) return previousState
  const machine = createEvaluationMachine(chapter, questionIds)
  let state = previousState ?? machine.initialState()
  if (state.value === 'ready') state = machine.transition(state, { type: 'START' })
  return machine.transition(state, {
    type: 'QUESTION.ANSWERED',
    answer: { questionId: pageId, selectedAnswerIds, expectedAnswerIds },
  })
}

/** Reads Sighty's result state on page entry and sends it to the Result story. */
function createRefreshEvaluationResult(document: ElceDocument) {
  return async (context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> => {
    await refreshPresentation(context)
    const pageId = pageIdFromSceneKey(context.scenarioState.active?.sceneKey)
    if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return
    const page = document.pages.find((candidate) => candidate.id === pageId)
    if (page?.chapterId === null || page?.chapterId === undefined) return
    const chapter = document.chapters.find((candidate) => candidate.id === page.chapterId && candidate.type === CHAPTER_TYPE.EVALUATION)
    const resultBdcId = page.bdcIds.find((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId)?.type === BDC_TYPE.EVALUATION_RESULT)
    if (chapter === undefined || resultBdcId === undefined) return

    const questionIds = evaluationQuestionPageIds(document, chapter)
    if (questionIds.length === 0) return
    const evaluationStates = readEvaluationStates(context.context)
    let state = evaluationStates[chapter.id]
    if (state === undefined || !questionIds.every((questionId) => state?.context.answers[questionId] !== undefined)) return
    const machine = createEvaluationMachine(chapter, questionIds)
    if (state.value === 'attempting') state = machine.transition(state, { type: 'COMPLETE' })
    const passed = state.context.result?.passed
    if (passed === null || passed === undefined) return
    if (state !== evaluationStates[chapter.id]) {
      await context.updateContext({ evaluationStates: { ...evaluationStates, [chapter.id]: state } })
    }
    await context.send(`scene-${pageId}` as ElceSceneKey, {
      name: passed ? ELCE_EVENTS.EVALUATION_RESULT_SUCCESS : ELCE_EVENTS.EVALUATION_RESULT_FAILURE,
    }, { scope: 'scene' })
  }
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
  const nextPageId = pageIndex < 0 ? undefined : pageIds[pageIndex + 1]
  const previousAllowed = page === undefined
    ? false
    : await scenarioState.canExit(
        { path: pagePathFromTable(pagePaths, page) },
      { name: ELCE_EVENTS.NAVIGATION_PREVIOUS, sourceSceneKey: ELCE_SCENARIO.NAVIGATION_SCENE },
      )
  const nextExitAllowed = page === undefined
    ? false
    : await scenarioState.canExit(
        { path: pagePathFromTable(pagePaths, page) },
      { name: ELCE_EVENTS.NAVIGATION_NEXT, sourceSceneKey: ELCE_SCENARIO.NAVIGATION_SCENE },
      )
  const nextPageAllowed = nextPageId === undefined
    ? false
    : await scenarioState.canAccess(
        { path: pagePathFromTable(pagePaths, nextPageId) },
        { name: ELCE_EVENTS.NAVIGATION_NEXT, sourceSceneKey: ELCE_SCENARIO.NAVIGATION_SCENE },
      )

  const menu = await createMenuClassPatch(activePageId, pageIds, pagePaths, scenarioState)
  return {
    title: page === undefined || page === ELCE_SCENARIO.EMPTY_PAGE ? 'Aucune page' : pageNames[page] ?? page,
    menuClassPatch: menu.patch,
    menuPageStates: menu.states,
    previousAttributes: { type: 'button', disabled: pageIndex <= 0 || !previousAllowed },
    nextAttributes: { type: 'button', disabled: !nextExitAllowed || !nextPageAllowed },
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

/** Reads the Sighty question-result signet without inventing a parallel state copy. */
function readQuestionResults(context: Readonly<Record<string, unknown>>): Readonly<Record<string, boolean>> {
  const results = (context as ElceProgressContext).questionResults
  if (typeof results !== 'object' || results === null) return {}
  return Object.fromEntries(Object.entries(results).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'))
}

/** Reads the serialized Evaluation states stored in the existing Sighty context. */
function readEvaluationStates(context: Readonly<Record<string, unknown>>): Readonly<Record<string, EvaluationMachineState>> {
  const states = (context as ElceProgressContext).evaluationStates
  if (typeof states !== 'object' || states === null) return {}
  return states
}

/** Returns the string identifiers carried by a validated Question event. */
function readStringIds(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || !value.every((candidate): candidate is string => typeof candidate === 'string')) return undefined
  return value
}

/** Resolves the chapter's ordered Question pages for its Evaluation machine. */
function evaluationQuestionPageIds(document: ElceDocument, chapter: Chapter): readonly string[] {
  return chapter.pageIds.filter((pageId) => {
    const page = document.pages.find((candidate) => candidate.id === pageId)
    return page?.bdcIds.some((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId)?.type === BDC_TYPE.QUESTION) === true
  })
}

/** Creates the chapter machine with its authored settings and shared score threshold. */
function createEvaluationMachine(
  chapter: Chapter,
  questionIds: readonly string[],
): EvaluationMachine {
  return new EvaluationMachine({
    questionIds,
    settings: {
      threshold: chapter.evaluationThreshold ?? DEFAULT_EVALUATION_THRESHOLD,
      attemptLimit: chapter.evaluationAttemptLimit ?? DEFAULT_EVALUATION_SETTINGS.attemptLimit,
      retryScope: chapter.evaluationRetryScope ?? DEFAULT_EVALUATION_SETTINGS.retryScope,
    },
  })
}

/** Reads the static Question-to-page index stored in the scenario definition. */
function readQuestionBdcIds(context: SightyActionContext<ElceSceneKey, ElceSlotName>): readonly Readonly<{ pageId: string; bdcId: string }>[] {
  const questionBdcByPage = context.data.questionBdcByPage
  if (typeof questionBdcByPage !== 'object' || questionBdcByPage === null) return []
  return Object.entries(questionBdcByPage)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([pageId, bdcId]) => ({ pageId, bdcId }))
}

/** Requires scroll-end and a submitted Question answer when the page owns one. */
function isPageComplete(pageId: string, context: Readonly<Record<string, unknown>>, questionBdcByPage: Readonly<Record<string, string>>): boolean {
  if (!readFinishedPages(context).includes(pageId)) return false
  return questionBdcByPage[pageId] === undefined || Object.hasOwn(readQuestionResults(context), pageId)
}

/** Applies page completion and any final Evaluation chapter threshold before navigation. */
function canLeavePage(
  document: ElceDocument,
  pageId: string,
  questionBdcByPage: Readonly<Record<string, string>>,
  context: Readonly<Record<string, unknown>>,
): boolean {
  if (!isPageComplete(pageId, context, questionBdcByPage)) return false
  const page = findPage(document, pageId)
  if (page.chapterId === null) return true
  const chapter = document.chapters.find((candidate) => candidate.id === page.chapterId)
  switch (chapter?.type) {
    case CHAPTER_TYPE.EVALUATION: {
      if (chapter.pageIds.at(-1) !== pageId) return true
      const questionPageIds = chapter.pageIds.filter((candidate) => questionBdcByPage[candidate] !== undefined)
      const evaluation = chapterEvaluation.evaluate(
        questionPageIds,
        readQuestionResults(context),
        chapter.evaluationThreshold ?? DEFAULT_EVALUATION_THRESHOLD,
      )
      return evaluation.passed !== false
    }
    case CHAPTER_TYPE.STANDARD:
    case undefined:
      return true
  }
}

/** Returns a page from the métier document or fails at the builder boundary. */
function findPage(document: ElceDocument, pageId: string): Page {
  const page = document.pages.find((candidate) => candidate.id === pageId)
  if (page === undefined) throw new Error(`Page absente du document : ${pageId}`)
  return page
}

/** Returns a chapter from the document or fails at the scenario boundary. */
function findChapter(document: ElceDocument, chapterId: string): Chapter {
  const chapter = document.chapters.find((candidate) => candidate.id === chapterId)
  if (chapter === undefined) throw new Error(`Chapitre absent du document : ${chapterId}`)
  return chapter
}

/** Creates the fixed layout with the five explicit regions of the complete preview. */
function createLayoutScene(documentId: string): SceneDoc<string> {
  const menuPartId = `${documentId}:layout:menu`
  const menuTogglePartId = `${documentId}:layout:menu-toggle`
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
                <aside id="${documentId}-menu-region" class="elce-player-layout__menu" aria-label="Menu du document"><!-- data-part="${menuPartId}" --></aside>
                <header id="${documentId}-title-region" class="elce-player-layout__title" aria-label="Page courante">
                  <!-- data-part="${menuTogglePartId}" -->
                  <!-- data-part="${titlePartId}" -->
                </header>
                <!-- data-part="${contentPartId}" -->
                <nav id="${documentId}-navigation-region" class="elce-player-layout__navigation" aria-label="Navigation des pages">
                  <!-- data-part="${navigationPartId}" -->
                </nav>
              </main>`,
            },
            actions: {},
          },
          createMenuTogglePerso(documentId, menuTogglePartId),
          createLayoutSlot(ELCE_SCENARIO.MENU_SLOT, menuPartId, 'elce-player-layout__menu-slot'),
          createLayoutSlot(ELCE_SCENARIO.TITLE_SLOT, titlePartId, 'elce-player-layout__title-slot'),
          createLayoutSlot(ELCE_SCENARIO.CONTENT_SLOT, contentPartId, 'elce-player-layout__content elce-player-layout__content-slot', {
            tag: 'section',
            attr: { id: `${documentId}-content-region`, 'aria-label': 'Contenu de la page' },
          }),
          createLayoutSlot(ELCE_SCENARIO.NAVIGATION_SLOT, navigationPartId, 'elce-player-layout__navigation-slot'),
        ],
      },
    },
  }
}

/** Creates one named CodPlay slot in its matching layout region. */
function createLayoutSlot(
  name: string,
  target: string,
  className: string,
  element: Readonly<{ tag?: string; attr?: Readonly<Record<string, string>> }> = {},
): PersoDoc<string> {
  return {
    id: `elce-${name}`,
    name,
    type: 'slot',
    initial: { ...element, move: { target }, className },
    actions: {},
  }
}

/** Builds the menu scene from chapters, scenario pages, and the document order. */
function createMenuScene(document: ElceDocument): SceneDoc<string> {
  const pageIds = scenarioPageIds(document)
  const drawerBackdropPartId = 'elce:menu:drawer:backdrop'
  const drawerPanelPartId = 'elce:menu:drawer:panel'
  const drawerClosePartId = 'elce:menu:drawer:close'
  const scenarioMarkup = document.data.scenarioEntries.map((entry) => {
    switch (entry.kind) {
      case SCENARIO_ENTRY_KIND.PAGE:
        return createMenuPageMarkup(findPage(document, entry.pageId))
      case SCENARIO_ENTRY_KIND.CHAPTER:
        return createChapterMarkup(document, findChapter(document, entry.chapterId))
    }
  }).join('')
  const pagePersos = pageIds.map((pageId) => createMenuPagePerso(findPage(document, pageId)))
  const chapterPersos = document.chapters.flatMap((chapter) => createChapterPerso(chapter))
  const openDrawerAction = {
    attr: { 'data-open': 'true', 'aria-hidden': 'false', inert: false },
    style: { opacity: { from: 0, to: 1, duration: 260, ease: 'outCubic' } },
  }
  const closeDrawerAction = {
    attr: { 'data-open': 'false', 'aria-hidden': 'true', inert: true },
    style: { opacity: { from: 1, to: 0, duration: 260, ease: 'inCubic' } },
  }
  const openPanelAction = {
    style: { translateX: { from: '-100%', to: '0%', duration: 260, ease: 'outCubic' } },
  }
  const closePanelAction = {
    style: { translateX: { from: '0%', to: '-100%', duration: 260, ease: 'inCubic' } },
  }
  return {
    id: `${document.id}-menu-scene`,
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        persos: [
          {
            id: `${document.id}-menu-drawer`,
            type: 'layout',
            initial: {
              move: '@root',
              className: 'elce-player-menu-drawer',
              attr: { 'data-open': 'false', 'aria-hidden': 'true', inert: true },
              markup: `<div id="${document.id}-menu-drawer-root" class="elce-player-menu-drawer" role="dialog" aria-label="Sommaire du document" aria-modal="true" aria-hidden="true" inert tabindex="-1">
                <!-- data-part="${drawerBackdropPartId}" -->
                <!-- data-part="${drawerPanelPartId}" -->
              </div>`,
            },
            actions: createMenuDrawerActions(pageIds, openDrawerAction, closeDrawerAction),
            emit: {
              keydown: {
                keyCode: 'Escape',
                preventDefault: true,
                event: { name: ELCE_EVENTS.MENU_DRAWER_CLOSE, visibility: 'public' },
              },
            },
          },
          {
            id: `${document.id}-menu-backdrop`,
            type: 'layout',
            initial: {
              move: { target: drawerBackdropPartId },
              className: 'elce-player-menu-backdrop-host',
              markup: `<button id="${document.id}-menu-backdrop" class="elce-player-menu-backdrop" type="button" tabindex="-1" aria-label="Fermer le sommaire"></button>`,
            },
            emit: { click: { event: { name: ELCE_EVENTS.MENU_DRAWER_CLOSE, visibility: 'public' } } },
          },
          {
            id: `${document.id}-menu-panel`,
            type: 'layout',
            initial: {
              move: { target: drawerPanelPartId },
              className: 'elce-player-menu-panel',
              markup: `<aside id="${document.id}-menu-panel-root" class="elce-player-menu-panel">
                <!-- data-part="${drawerClosePartId}" -->
                <nav id="${document.id}-menu-root" class="elce-player-menu" aria-label="Chapitres et pages du document">
                  <h2 id="${document.id}-menu-title" class="elce-player-menu__title">Sommaire</h2>
                  <!-- data-part="elce:menu:state" -->
                  <div id="${document.id}-menu-scroll" class="elce-player-menu__scroll"><ol id="elce-menu-scenario-entries" class="elce-player-menu__entries">${scenarioMarkup}</ol></div>
                </nav>
              </aside>`,
            },
            actions: createMenuDrawerActions(pageIds, openPanelAction, closePanelAction),
          },
          createMenuClosePerso(document.id, drawerClosePartId),
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

/** Maps drawer events and page selection to the same CodPlay close transition. */
function createMenuDrawerActions(
  pageIds: readonly string[],
  openAction: Readonly<Record<string, unknown>>,
  closeAction: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return {
    [ELCE_EVENTS.MENU_DRAWER_OPEN]: openAction,
    [ELCE_EVENTS.MENU_DRAWER_CLOSE]: closeAction,
    ...Object.fromEntries(pageIds.map((pageId) => [menuEvent(pageId), closeAction])),
  }
}

/** Creates the layout-owned menu trigger with its accessible state actions. */
function createMenuTogglePerso(documentId: string, target: string): PersoDoc<string> {
  return {
    id: `${documentId}-menu-toggle`,
    type: 'layout',
    initial: {
      move: { target },
      markup: `<button id="${documentId}-menu-toggle" class="elce-player-menu-toggle" type="button" aria-label="Ouvrir le sommaire" aria-controls="${documentId}-menu-drawer-root" aria-expanded="false">
        <svg id="${documentId}-menu-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path id="${documentId}-menu-toggle-icon-path" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>`,
    },
    emit: { click: { event: { name: ELCE_EVENTS.MENU_DRAWER_OPEN, visibility: 'public' } } },
    actions: {
      [ELCE_EVENTS.MENU_DRAWER_OPEN]: { attr: { 'aria-expanded': 'true' } },
      [ELCE_EVENTS.MENU_DRAWER_CLOSE]: { attr: { 'aria-expanded': 'false' } },
    },
  }
}

/** Creates the close button owned by the persistent CodPlay menu scene. */
function createMenuClosePerso(documentId: string, target: string): PersoDoc<string> {
  return {
    id: `${documentId}-menu-close`,
    type: 'layout',
    initial: {
      move: { target },
      markup: `<button id="${documentId}-menu-close" class="elce-player-menu-close" type="button" aria-label="Fermer le sommaire">
        <svg id="${documentId}-menu-close-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path id="${documentId}-menu-close-icon-path" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>`,
    },
    emit: { click: { event: { name: ELCE_EVENTS.MENU_DRAWER_CLOSE, visibility: 'public' } } },
  }
}

/** Creates the static chapter and page structure with CodPlay comment anchors. */
function createChapterMarkup(document: ElceDocument, chapter: Chapter): string {
  const pages = chapter.pageIds.map((pageId) => findPage(document, pageId))
  return `<li id="elce-menu-chapter-${chapter.id}" class="elce-player-menu__group">
    <h2 id="elce-menu-chapter-heading-${chapter.id}" class="elce-player-menu__group-title"><!-- data-part="elce:menu:chapter:${chapter.id}" --></h2>
    <ol id="elce-menu-chapter-pages-${chapter.id}" class="elce-player-menu__pages">${pages.map((page) => createMenuPageMarkup(page)).join('')}</ol>
  </li>`
}

/** Creates one menu page row with a CodPlay comment anchor. */
function createMenuPageMarkup(page: Page): string {
  return `<li id="elce-menu-page-row-${page.id}" class="elce-player-menu__page-row">
    <!-- data-part="elce:menu:page:${page.id}" -->
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

/** Builds the navigation scene with comment anchors for previous, status, and next. */
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
                <!-- data-part="elce:navigation:previous" -->
                <!-- data-part="elce:navigation:status" -->
                <!-- data-part="elce:navigation:next" -->
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
  switch (pageId) {
    case ELCE_SCENARIO.EMPTY_PAGE:
      return `${ELCE_SCENARIO.ROOT_VIEW}/${ELCE_SCENARIO.EMPTY_ENTRY_VIEW}/${ELCE_SCENARIO.CONTENT_SLOT}/${pageId}`
    default:
      return `${ELCE_SCENARIO.ROOT_VIEW}/${scenarioEntryViewIdForPage(document, pageId)}/${ELCE_SCENARIO.CONTENT_SLOT}/${pageId}`
  }
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
