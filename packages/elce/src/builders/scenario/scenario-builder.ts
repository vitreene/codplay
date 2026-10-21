import type { PersoDoc, SceneDoc } from 'codplay/scene/types'
import type {
  SightyActionContext,
  SightyConditionContext,
  SightyGraphView,
  SightyScenarioDefinition,
  SightyScenarioStateApi,
  SightyViewAction,
  SightyViewGraph,
} from '@codplay/sighty'
import type { SightySceneResetHandler, SightySceneSourceValue } from '@codplay/sighty'
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
import type { ProjectTestState } from '../../domain/summary-profile/test-state-types'
import { INITIAL_PROJECT_TEST_STATE } from '../../domain/summary-profile/test-state-types'
import { ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY } from '../../scorm/scorm-types'
import type { ElceScormProgressSink } from '../../scorm/scorm-types'
import type {
  ProfileConstraint,
  ProfileProperty,
  ProfileValue,
  ReadingConstraint,
  SummarySettings,
} from '../../domain/summary-profile/summary-profile-types'
import {
  pageVisibilityAllowsAccess,
  profileVisibilityForChapter,
  profileVisibilityForPage,
  profileVisibilityMatches,
  validateProfileValues,
} from '../../domain/summary-profile/profile-rules'
import { buildProfileFormScene } from '../summary-profile/profile-form-scene-builder'
import { buildSummaryEntries, buildSummaryScene } from '../summary-profile/summary-scene-builder'
import type { SummaryEntry } from '../summary-profile/summary-scene-builder'
import type { ElceSceneKey, ElceSlotName } from './scenario-builder-types'

type ElcePresentation = Readonly<{
  readonly title: string
  readonly menuClassPatch: Readonly<{ add: string; remove: string }>
  readonly menuPageStates: readonly Readonly<{ id: string; title: string; active: boolean; allowed: boolean }>[]
  readonly previousAttributes: Readonly<{ type: 'button'; disabled: boolean }>
  readonly nextAttributes: Readonly<{ type: 'button'; disabled: boolean }>
  readonly navigationStatus: string
}>

type ElceProgressContext = Readonly<{
  readonly finishedPages?: readonly string[]
  readonly questionResults?: Readonly<Record<string, boolean>>
  readonly evaluationStates?: Readonly<Record<string, EvaluationMachineState>>
}>

type ElceRuntimeChapter = Pick<Chapter,
  'id' | 'type' | 'pageIds' | 'evaluationThreshold' | 'evaluationAttemptLimit' | 'evaluationRetryScope'
>

type ElceRuntimeData = Readonly<{
  pageIds: readonly string[]
  pageNames: Readonly<Record<string, string>>
  pagePaths: Readonly<Record<string, string>>
  questionBdcByPage: Readonly<Record<string, string>>
  previewStartPageId: string
  evaluationResultPageIds: readonly string[]
  chapterIds: readonly string[]
  pages: Readonly<Record<string, Readonly<{ chapterId: string | null; bdcIds: readonly string[] }>>>
  chapters: Readonly<Record<string, ElceRuntimeChapter>>
  bdcTypes: Readonly<Record<string, string>>
  summary: Pick<SummarySettings,
    'title' | 'showAtRoot' | 'endChapterDestination' | 'pageContinuationMode' | 'permanentAccess'
  >
  profile: Readonly<{
    fieldPropertyIds: readonly string[]
    properties: readonly ProfileProperty[]
    pageVisibility: Readonly<Record<string, ProfileConstraint>>
    chapterVisibility: Readonly<Record<string, ProfileConstraint>>
    readingConstraints: readonly ReadingConstraint[]
  }>
  summaryEntries: readonly SummaryEntry[]
}>

const chapterEvaluation = new ElceChapterEvaluation()

export type ScenarioBuildOptions = Readonly<{
  readonly testState?: ProjectTestState
  readonly mediaSources?: Readonly<Record<string, string>>
  readonly onTestStateChange?: (state: ProjectTestState) => void | Promise<void>
}>

/** Builds the complete Sighty document graph and its persistent presentation scenes. */
export function buildScenario(
  document: ElceDocument,
  scenes: Readonly<Record<string, SightySceneSourceValue>>,
  startPageId?: string,
  options: ScenarioBuildOptions = {},
): SightyScenarioDefinition<ElceSceneKey, ElceSlotName> {
  const pageIds = scenarioPageIds(document)
  const requestedPageId = startPageId !== undefined && pageIds.includes(startPageId) ? startPageId : undefined
  const preferredPageId = resolveStartPageId(pageIds, requestedPageId)
  const testState = options.testState ?? INITIAL_PROJECT_TEST_STATE
  const questionBdcByPage = Object.fromEntries(document.pages.flatMap((page) => {
    const question = page.bdcIds.map((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId))
      .find((bdc) => bdc?.type === BDC_TYPE.QUESTION)
    return question === undefined ? [] : [[page.id, question.id]]
  }))
  const testContext = scenarioContextFromTestState(testState)
  const firstPageId = resolveAccessibleStartPageId(document, pageIds, preferredPageId, questionBdcByPage, testContext)
  const activeRequestPageId = requestedPageId !== undefined
    && pageProfileConstraintsAllowAccess(document, requestedPageId, testContext, questionBdcByPage)
    ? requestedPageId
    : undefined
  const pagePaths = createPagePaths(document, pageIds)
  const evaluationResultPageIds = new Set(document.pages.flatMap((page) => {
    const hasEvaluationResult = page.bdcIds.some((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId)?.type === BDC_TYPE.EVALUATION_RESULT)
    return hasEvaluationResult ? [page.id] : []
  }))
  const runtimeData = createScenarioRuntimeData({
    document,
    pageIds,
    pagePaths,
    questionBdcByPage,
    previewStartPageId: firstPageId,
    evaluationResultPageIds: [...evaluationResultPageIds],
  })
  const sceneCatalog: Record<string, SightySceneSourceValue> = {
    [ELCE_SCENARIO.LAYOUT_SCENE]: createLayoutScene(document.id),
    [ELCE_SCENARIO.SUMMARY_SCENE]: buildSummaryScene(document, 'root', options.mediaSources),
    [ELCE_SCENARIO.SUMMARY_MENU_SCENE]: buildSummaryScene(document, 'menu', options.mediaSources),
    [ELCE_SCENARIO.PROFILE_FORM_SCENE]: buildProfileFormScene(
      document.id,
      document.data.profile.properties,
      document.data.profile.fieldPropertyIds,
      options.testState?.profileValues ?? {},
    ),
    [ELCE_SCENARIO.PROFILE_COMPLETE_SCENE]: createProfileCompleteScene(document.id),
    [ELCE_SCENARIO.TITLE_SCENE]: createTitleScene(),
    [ELCE_SCENARIO.NAVIGATION_SCENE]: createNavigationScene(),
    [`scene-${ELCE_SCENARIO.EMPTY_PAGE}`]: createEmptyPageScene(document.id),
    ...scenes,
  }

  return {
    format: 'sighty',
    version: 1,
    id: `${document.id}-scenario`,
    data: runtimeData,
    views: {
      start: ELCE_SCENARIO.ROOT_VIEW,
      views: {
        [ELCE_SCENARIO.ROOT_VIEW]: {
          action: ELCE_SCENARIO_HANDLERS.REFRESH_PRESENTATION,
      actions: createScenarioActions(pageIds, pagePaths),
          view: {
            scene: ELCE_SCENARIO.LAYOUT_SCENE,
            slots: {
              [ELCE_SCENARIO.MENU_SLOT]: createMenuSceneSlot(),
              [ELCE_SCENARIO.TITLE_SLOT]: createPersistentSceneSlot(
                ELCE_SCENARIO.TITLE_SCENE,
                ELCE_SCENARIO.TITLE_SLOT,
              ),
              [ELCE_SCENARIO.NAVIGATION_SLOT]: createPersistentSceneSlot(
                ELCE_SCENARIO.NAVIGATION_SCENE,
                ELCE_SCENARIO.NAVIGATION_SLOT,
              ),
            },
            views: createScenarioViews(document, firstPageId, activeRequestPageId, options),
          },
        },
      },
    },
    scenes: sceneCatalog,
    actions: {
      [ELCE_SCENARIO_HANDLERS.REFRESH_PRESENTATION]: refreshPresentationAction,
      [ELCE_SCENARIO_HANDLERS.OPEN_MENU_DRAWER]: openMenuDrawerAction,
      [ELCE_SCENARIO_HANDLERS.CLOSE_MENU_DRAWER]: closeMenuDrawer,
      [ELCE_SCENARIO_HANDLERS.MARK_PAGE_FINISHED]: options.onTestStateChange === undefined
        ? markPageFinishedAction
        : createMarkPageFinished(options.onTestStateChange),
      [ELCE_SCENARIO_HANDLERS.RECORD_QUESTION_RESULT]: options.onTestStateChange === undefined
        ? recordQuestionResultAction
        : createRecordQuestionResult(options.onTestStateChange),
      [ELCE_SCENARIO_HANDLERS.REFRESH_EVALUATION_RESULT]: options.onTestStateChange === undefined
        ? refreshEvaluationResultAction
        : createRefreshEvaluationResult(options.onTestStateChange),
      [ELCE_SCENARIO_HANDLERS.SAVE_PROFILE_VALUES]: options.onTestStateChange === undefined
        ? saveProfileValuesAction
        : createSaveProfileValues(options.onTestStateChange),
      [ELCE_SCENARIO_HANDLERS.SUBMIT_PROFILE]: options.onTestStateChange === undefined
        ? submitProfileAction
        : createSubmitProfile(options.onTestStateChange),
    },
    guards: {
      [ELCE_SCENARIO_HANDLERS.PAGE_ACCESS]: pageAccessGuard,
      [ELCE_SCENARIO_HANDLERS.PAGE_EXIT]: pageExitGuard,
    },
  }
}

/** Maps the persisted test state onto the context owned by Sighty. */
export function scenarioContextFromTestState(state: ProjectTestState): Readonly<Record<string, unknown>> {
  return {
    finishedPages: state.finishedPageIds,
    questionAnswers: state.questionAnswers,
    questionResults: Object.fromEntries(Object.entries(state.questionAnswers).map(([pageId, answer]) => [pageId, answer.isCorrect])),
    evaluationStates: state.evaluationStates,
    profileEnabled: state.profileEnabled,
    profileSubmitted: state.profileSubmitted,
    profileValues: state.profileValues,
  }
}

/** Builds the serializable reader configuration consumed by exported callbacks. */
function createScenarioRuntimeData(input: Readonly<{
  document: ElceDocument
  pageIds: readonly string[]
  pagePaths: Readonly<Record<string, string>>
  questionBdcByPage: Readonly<Record<string, string>>
  previewStartPageId: string
  evaluationResultPageIds: readonly string[]
}>): ElceRuntimeData {
  const { document } = input
  return {
    pageIds: input.pageIds,
    pageNames: Object.fromEntries(document.pages.map((page) => [page.id, page.name])),
    pagePaths: input.pagePaths,
    questionBdcByPage: input.questionBdcByPage,
    previewStartPageId: input.previewStartPageId,
    evaluationResultPageIds: input.evaluationResultPageIds,
    chapterIds: document.chapters.map((chapter) => chapter.id),
    pages: Object.fromEntries(document.pages.map((page) => [page.id, {
      chapterId: page.chapterId,
      bdcIds: page.bdcIds,
    }])),
    chapters: Object.fromEntries(document.chapters.map((chapter) => [chapter.id, {
      id: chapter.id,
      type: chapter.type,
      pageIds: chapter.pageIds,
      ...(chapter.evaluationThreshold === undefined ? {} : { evaluationThreshold: chapter.evaluationThreshold }),
      ...(chapter.evaluationAttemptLimit === undefined ? {} : { evaluationAttemptLimit: chapter.evaluationAttemptLimit }),
      ...(chapter.evaluationRetryScope === undefined ? {} : { evaluationRetryScope: chapter.evaluationRetryScope }),
    }])),
    bdcTypes: Object.fromEntries(document.bdcs
      .filter((bdc) => bdc.type === BDC_TYPE.QUESTION || bdc.type === BDC_TYPE.EVALUATION_RESULT)
      .map((bdc) => [bdc.id, bdc.type])),
    summary: {
      title: document.data.summary.title,
      showAtRoot: document.data.summary.showAtRoot,
      endChapterDestination: document.data.summary.endChapterDestination,
      pageContinuationMode: document.data.summary.pageContinuationMode,
      permanentAccess: document.data.summary.permanentAccess,
    },
    profile: {
      fieldPropertyIds: document.data.profile.fieldPropertyIds,
      properties: document.data.profile.properties,
      pageVisibility: Object.fromEntries(document.pages.flatMap((page) => {
        const constraint = profileVisibilityForPage(document, page.id)
        return constraint === undefined ? [] : [[page.id, constraint]]
      })),
      chapterVisibility: Object.fromEntries(document.chapters.flatMap((chapter) => {
        const constraint = profileVisibilityForChapter(document, chapter.id)
        return constraint === undefined ? [] : [[chapter.id, constraint]]
      })),
      readingConstraints: document.data.profile.readingConstraints,
    },
    summaryEntries: buildSummaryEntries(document),
  }
}

/** Returns the document order consumed by the content slot and its navigation. */
function scenarioPageIds(document: ElceDocument): readonly string[] {
  return document.scenarioPageIds
}

/** Builds the page graph plus the independent summary and profile destinations. */
function createScenarioViews(
  document: ElceDocument,
  firstPageId: string,
  requestedPageId: string | undefined,
  options: ScenarioBuildOptions,
): SightyViewGraph<ElceSceneKey, ElceSlotName> {
  const pageIds = scenarioPageIds(document)
  const pagePaths = createPagePaths(document, pageIds)
  const views: Record<string, SightyGraphView<ElceSceneKey, ElceSlotName>> = Object.fromEntries(
    document.data.scenarioEntries.flatMap((entry) => scenarioEntryView(document, entry, firstPageId, pageIds)),
  )
  const collectProfile = shouldCollectProfile(document.data.profile.fieldPropertyIds, options.testState ?? INITIAL_PROJECT_TEST_STATE)
  const firstPagePath = pagePathFromTable(pagePaths, firstPageId)
  if (pageIds.length === 0) {
    views[ELCE_SCENARIO.EMPTY_ENTRY_VIEW] = {
      view: { slots: { [ELCE_SCENARIO.CONTENT_SLOT]: createPageViews(document, [], firstPageId, pageIds) } },
      actions: navigationBlockActions(),
    }
  }
  if (document.data.summary.showAtRoot) {
    views[ELCE_SCENARIO.SUMMARY_ENTRY_VIEW] = {
      view: { slots: { [ELCE_SCENARIO.CONTENT_SLOT]: createPersistentSceneSlot(ELCE_SCENARIO.SUMMARY_SCENE, ELCE_SCENARIO.CONTENT_SLOT) } },
      actions: navigationBlockActions(),
    }
  }
  if (document.data.profile.fieldPropertyIds.length > 0) {
    views[ELCE_SCENARIO.PROFILE_ENTRY_VIEW] = {
      view: { slots: { [ELCE_SCENARIO.CONTENT_SLOT]: createPersistentSceneSlot(ELCE_SCENARIO.PROFILE_FORM_SCENE, ELCE_SCENARIO.CONTENT_SLOT) } },
      actions: navigationBlockActions(),
    }
    views[ELCE_SCENARIO.PROFILE_COMPLETE_ENTRY_VIEW] = {
      view: { slots: { [ELCE_SCENARIO.CONTENT_SLOT]: createPersistentSceneSlot(ELCE_SCENARIO.PROFILE_COMPLETE_SCENE, ELCE_SCENARIO.CONTENT_SLOT) } },
      actions: navigationBlockActions(),
    }
  }

  const start = collectProfile
    ? ELCE_SCENARIO.PROFILE_ENTRY_VIEW
    : requestedPageId === undefined && document.data.summary.showAtRoot
      ? ELCE_SCENARIO.SUMMARY_ENTRY_VIEW
      : pageIds.length === 0
        ? ELCE_SCENARIO.EMPTY_ENTRY_VIEW
        : scenarioEntryViewIdForPage(document, firstPageId)
  return {
    start,
    accessBy: ELCE_SCENARIO_HANDLERS.PAGE_ACCESS,
    exitBy: ELCE_SCENARIO_HANDLERS.PAGE_EXIT,
    actions: {
      [ELCE_EVENTS.PAGE_FINISHED]: { action: ELCE_SCENARIO_HANDLERS.MARK_PAGE_FINISHED },
      [ELCE_EVENTS.QUESTION_ANSWERED]: { action: ELCE_SCENARIO_HANDLERS.RECORD_QUESTION_RESULT },
      [ELCE_EVENTS.PROFILE_CHANGED]: { action: ELCE_SCENARIO_HANDLERS.SAVE_PROFILE_VALUES },
      ...(document.data.profile.fieldPropertyIds.length > 0 ? {
        [ELCE_EVENTS.PROFILE_SUBMIT]: {
          go: { path: contentScenePath(ELCE_SCENARIO.PROFILE_COMPLETE_ENTRY_VIEW) },
          action: ELCE_SCENARIO_HANDLERS.SUBMIT_PROFILE,
        },
      } : {}),
      ...(document.data.summary.showAtRoot ? {
        [ELCE_EVENTS.MENU_SUMMARY]: {
          go: { path: contentScenePath(ELCE_SCENARIO.SUMMARY_ENTRY_VIEW) },
          action: ELCE_SCENARIO_HANDLERS.REFRESH_PRESENTATION,
        },
      } : {}),
    },
    showMode: 'reset',
    onDenied: { path: firstPagePath },
    views,
  }
}

/** Creates the Sighty view for one root page or non-empty chapter. */
function scenarioEntryView(
  document: ElceDocument,
  entry: ScenarioEntry,
  firstPageId: string,
  pageIds: readonly string[],
): readonly [string, SightyGraphView<ElceSceneKey, ElceSlotName>][] {
  switch (entry.kind) {
    case SCENARIO_ENTRY_KIND.PAGE:
      return [[scenarioEntryViewId(entry), {
        view: {
          slots: {
            [ELCE_SCENARIO.CONTENT_SLOT]: createPageViews(document, [entry.pageId], firstPageId, pageIds),
          },
        },
      }]]
    case SCENARIO_ENTRY_KIND.CHAPTER: {
      const chapter = findChapter(document, entry.chapterId)
      if (chapter.pageIds.length === 0) return []
      return [[scenarioEntryViewId(entry), {
        view: {
          slots: {
            [ELCE_SCENARIO.CONTENT_SLOT]: createPageViews(document, chapter.pageIds, firstPageId, pageIds),
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

/** Selects the requested or first profile-unlocked page as a safe route fallback. */
function resolveAccessibleStartPageId(
  document: ElceDocument,
  pageIds: readonly string[],
  preferredPageId: string,
  questionBdcByPage: Readonly<Record<string, string>>,
  testContext: Readonly<Record<string, unknown>>,
): string {
  if (pageProfileConstraintsAllowAccess(document, preferredPageId, testContext, questionBdcByPage)) return preferredPageId
  return pageIds.find((pageId) => pageProfileConstraintsAllowAccess(document, pageId, testContext, questionBdcByPage)) ?? preferredPageId
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
  scenarioPageIds: readonly string[] = pageIds,
): SightyViewGraph<ElceSceneKey, ElceSlotName> {
  const entries: Record<string, SightyGraphView<ElceSceneKey, ElceSlotName>> = Object.fromEntries(pageIds.map((pageId) => {
    const page = findPage(document, pageId)
    return [page.id, {
      view: { scene: `scene-${page.id}` as ElceSceneKey },
      actions: createPageNavigationActions(document, page.id, scenarioPageIds),
    }]
  }))
  const start = requestedPageId !== undefined && pageIds.includes(requestedPageId)
    ? requestedPageId
    : pageIds[0] ?? ELCE_SCENARIO.EMPTY_PAGE
  if (pageIds.length === 0) entries[ELCE_SCENARIO.EMPTY_PAGE] = { view: { scene: `scene-${ELCE_SCENARIO.EMPTY_PAGE}` } }
  return { start, views: entries }
}

/** Computes explicit page routes so summary destinations stay outside page order. */
function createPageNavigationActions(
  document: ElceDocument,
  pageId: string,
  pageIds: readonly string[],
): Readonly<Record<string, SightyViewAction<ElceSceneKey, ElceSlotName>>> {
  const index = pageIds.indexOf(pageId)
  const previousPageId = index > 0 ? pageIds[index - 1] : undefined
  const nextPageId = index >= 0 ? pageIds[index + 1] : undefined
  const page = document.pages.find((candidate) => candidate.id === pageId)
  const chapter = page?.chapterId === null || page?.chapterId === undefined
    ? undefined
    : document.chapters.find((candidate) => candidate.id === page.chapterId)
  const goesToSummary = chapter?.pageIds.at(-1) === pageId
    && document.data.summary.endChapterDestination === 'summary'
    && document.data.summary.showAtRoot
  const nextPath = goesToSummary
    ? `${ELCE_SCENARIO.ROOT_VIEW}/${ELCE_SCENARIO.SUMMARY_ENTRY_VIEW}`
    : nextPageId === undefined
      ? undefined
      : pagePath(document, nextPageId)
  return {
    [ELCE_EVENTS.NAVIGATION_NEXT]: nextPath === undefined ? {} : {
      go: { path: nextPath },
      action: ELCE_SCENARIO_HANDLERS.REFRESH_EVALUATION_RESULT,
    },
    [ELCE_EVENTS.NAVIGATION_PREVIOUS]: previousPageId === undefined ? {} : {
      go: { path: pagePath(document, previousPageId) },
      action: ELCE_SCENARIO_HANDLERS.REFRESH_EVALUATION_RESULT,
    },
  }
}

/** Blocks Previous/Next while a non-page destination owns the content slot. */
function navigationBlockActions(): Readonly<Record<string, SightyViewAction<ElceSceneKey, ElceSlotName>>> {
  return { [ELCE_EVENTS.NAVIGATION_NEXT]: {}, [ELCE_EVENTS.NAVIGATION_PREVIOUS]: {} }
}

/** Requires profile submission only when the author configured form fields. */
function shouldCollectProfile(fieldPropertyIds: readonly string[], state: ProjectTestState): boolean {
  return state.profileEnabled && fieldPropertyIds.length > 0 && !state.profileSubmitted
}

/** Sends the drawer-open event to the existing persistent menu scene. */
async function openMenuDrawer(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  await context.send(ELCE_SCENARIO.SUMMARY_MENU_SCENE, {
    name: ELCE_EVENTS.MENU_DRAWER_OPEN,
  }, { scope: 'story', storyId: 'main' })
}

/** Refreshes the page chrome through the scenario data and the existing Sighty operations. */
export async function refreshPresentationAction(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  await refreshPresentation(context)
}

/** Opens the persistent menu drawer and refreshes its accessible page states. */
export async function openMenuDrawerAction(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  await openMenuDrawer(context)
  await refreshPresentation(context)
}

/** Sends the scene-level Question reset event for supported reset keys. */
export function resetQuestionScene(keys: readonly string[]): ReturnType<SightySceneResetHandler> {
  return keys.includes('all') || keys.includes('quiz')
    ? { name: ELCE_EVENTS.QUESTION_RESET, data: { keys: [...keys] } }
    : undefined
}

/** Sends a responsive close request through the persistent menu scene. */
export async function closeMenuDrawer(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  await context.send(ELCE_SCENARIO.SUMMARY_MENU_SCENE, {
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

/** Mounts the summary menu scene in the layout's persistent menu slot. */
function createMenuSceneSlot(): SightyViewGraph<ElceSceneKey, ElceSlotName> {
  return createPersistentSceneSlot(ELCE_SCENARIO.SUMMARY_MENU_SCENE, ELCE_SCENARIO.MENU_SLOT)
}

/** Declares all page routes and presentation events at the document root. */
function createScenarioActions(
  pageIds: readonly string[],
  pagePaths: Readonly<Record<string, string>>,
): Readonly<Record<string, SightyViewAction<ElceSceneKey, ElceSlotName>>> {
  const actions: Record<string, SightyViewAction<ElceSceneKey, ElceSlotName>> = {
    [ELCE_EVENTS.PRESENTATION_REFRESH]: { action: ELCE_SCENARIO_HANDLERS.REFRESH_PRESENTATION },
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

/** Evaluates the page access condition from compact scenario data and call parameters. */
export function pageAccessGuard(input: SightyConditionContext<ElceSceneKey>): boolean {
  const { sceneKey, event, context } = input
  const runtime = readScenarioRuntimeData(input.data)
  if (sceneKey === ELCE_SCENARIO.PROFILE_FORM_SCENE) {
    return shouldCollectProfile(runtime.profile.fieldPropertyIds, testStateFromScenarioContext(context))
  }
  if (sceneKey === ELCE_SCENARIO.PROFILE_COMPLETE_SCENE) {
    return event?.name === ELCE_EVENTS.PROFILE_SUBMIT
        && isValidProfileSubmission(runtime.profile.properties, runtime.profile.fieldPropertyIds, event.data)
      || context.profileSubmitted === true
  }
  if (sceneKey === ELCE_SCENARIO.SUMMARY_SCENE) {
    return runtime.summary.showAtRoot
      && (!shouldCollectProfile(runtime.profile.fieldPropertyIds, testStateFromScenarioContext(context)) || context.profileSubmitted === true)
  }
  const pageId = pageIdFromSceneKey(sceneKey)
  if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return true
  if (!runtime.pageIds.includes(pageId)) return false
  if (!runtimePageProfileConstraintsAllowAccess(runtime, pageId, context)) return false
  if (event?.name === ELCE_EVENTS.RUNTIME_INITIALIZE) return true
  const submitsProfile = event?.name === ELCE_EVENTS.PROFILE_SUBMIT
    && isValidProfileSubmission(runtime.profile.properties, runtime.profile.fieldPropertyIds, event.data)
  if (shouldCollectProfile(runtime.profile.fieldPropertyIds, testStateFromScenarioContext(context)) && !submitsProfile) return false
  const pageIndex = runtime.pageIds.indexOf(pageId)
  if (pageIndex <= 0) return pageIndex === 0
  if (pageId === runtime.previewStartPageId) return true
  if (runtime.summary.pageContinuationMode === 'free' && !runtime.evaluationResultPageIds.includes(pageId)) return true
  const previewStartIndex = runtime.pageIds.indexOf(runtime.previewStartPageId)
  const prefixStartIndex = pageIndex > previewStartIndex && !runtime.evaluationResultPageIds.includes(pageId)
    ? previewStartIndex
    : 0
  return runtime.pageIds.slice(prefixStartIndex, pageIndex)
    .every((candidate) => isPageComplete(candidate, context, runtime.questionBdcByPage))
}

/** Keeps page visibility and chapter prerequisites active in either continuation mode. */
function pageProfileConstraintsAllowAccess(
  document: ElceDocument,
  pageId: string,
  context: Readonly<Record<string, unknown>>,
  questionBdcByPage: Readonly<Record<string, string>>,
): boolean {
  if (context.profileEnabled === false) return true
  return pageVisibilityAllowsAccess(document, pageId, readProfileValues(context.profileValues))
    && chapterReadingRequirementMet(document, pageId, context, questionBdcByPage)
}

/** Validates a form event before Sighty admits its completion destination. */
function isValidProfileSubmission(
  properties: readonly ProfileProperty[],
  fieldPropertyIds: readonly string[],
  data: unknown,
): boolean {
  if (!isRecord(data) || !isRecord(data.profileValues)) return false
  const values = readProfileValues(data.profileValues)
  return validateProfileValues(properties, fieldPropertyIds, values).length === 0
}

/** Applies the configured chapter prerequisite against retained reader progress. */
function chapterReadingRequirementMet(
  document: ElceDocument,
  pageId: string,
  context: Readonly<Record<string, unknown>>,
  questionBdcByPage: Readonly<Record<string, string>>,
): boolean {
  const page = document.pages.find((candidate) => candidate.id === pageId)
  if (page?.chapterId === null || page?.chapterId === undefined) return true
  const chapterIndex = document.chapters.findIndex((candidate) => candidate.id === page.chapterId)
  const constraint = document.data.profile.readingConstraints.find((candidate) => candidate.target.id === page.chapterId)
  if (constraint === undefined) return true
  const requiredChapterIds = constraint.requirement.kind === 'chapters'
    ? constraint.requirement.chapterIds
    : document.chapters[chapterIndex - 1] === undefined
      ? []
      : [document.chapters[chapterIndex - 1]!.id]
  return requiredChapterIds.every((requiredChapterId) => {
    const requiredChapter = document.chapters.find((candidate) => candidate.id === requiredChapterId)
    return requiredChapter !== undefined
      && requiredChapter.pageIds.every((requiredPageId) => isPageComplete(requiredPageId, context, questionBdcByPage))
  })
}

/** Creates the page exit condition that follows Demo 5's scroll-end navigation. */
/** Evaluates the page exit condition from compact scenario data and call parameters. */
export function pageExitGuard(input: SightyConditionContext<ElceSceneKey>): boolean {
  const { sceneKey, event, context } = input
  const runtime = readScenarioRuntimeData(input.data)
  if (sceneKey === ELCE_SCENARIO.PROFILE_FORM_SCENE) return event?.name === ELCE_EVENTS.PROFILE_SUBMIT
  if (sceneKey === ELCE_SCENARIO.PROFILE_COMPLETE_SCENE || sceneKey === ELCE_SCENARIO.SUMMARY_SCENE) return true
  const pageId = pageIdFromSceneKey(sceneKey)
  if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return true
  switch (event?.name) {
    case ELCE_EVENTS.NAVIGATION_PREVIOUS:
      return runtime.pageIds.indexOf(pageId) > 0
    case ELCE_EVENTS.NAVIGATION_NEXT:
      return canLeavePage(runtime, pageId, context)
    case ELCE_EVENTS.MENU_SUMMARY:
      return runtime.summary.permanentAccess || isPageComplete(pageId, context, runtime.questionBdcByPage)
    default:
      return event?.name?.startsWith(ELCE_EVENTS.MENU_PREFIX) === true
  }
}

/** Records a functional page end and refreshes the fixed controls. */
export async function markPageFinishedAction(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  await runMarkPageFinished(context)
}

/** Keeps the authoring preview's host persistence callback outside the exported runtime function. */
function createMarkPageFinished(onTestStateChange: NonNullable<ScenarioBuildOptions['onTestStateChange']>) {
  return (context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> => runMarkPageFinished(context, onTestStateChange)
}

/** Updates reader progress, optionally reports it to the preview host, and refreshes presentation. */
async function runMarkPageFinished(
  context: SightyActionContext<ElceSceneKey, ElceSlotName>,
  onTestStateChange?: ScenarioBuildOptions['onTestStateChange'],
): Promise<void> {
  const pageId = pageIdFromSceneKey(context.event.sourceSceneKey)
  if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return
  const finishedPages = readFinishedPages(context.context)
  const nextFinishedPages = finishedPages.includes(pageId) ? finishedPages : [...finishedPages, pageId]
  if (nextFinishedPages !== finishedPages) {
    await context.updateContext({ finishedPages: nextFinishedPages })
    onTestStateChange?.(testStateFromScenarioContext(context.context, { finishedPages: nextFinishedPages }))
  }
  await saveScormReaderState(
    context,
    pageId,
    testStateFromScenarioContext(context.context, { finishedPages: nextFinishedPages }),
  )
  await refreshPresentation(context)
}

/** Updates profile values in the shared Sighty context. */
export async function saveProfileValuesAction(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  await runSaveProfileValues(context)
}

/** Keeps authoring-preview persistence outside the exported profile handler. */
function createSaveProfileValues(onTestStateChange: NonNullable<ScenarioBuildOptions['onTestStateChange']>) {
  return (context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> => runSaveProfileValues(context, onTestStateChange)
}

/** Applies a profile edit and optionally reports it to the authoring host. */
async function runSaveProfileValues(
  context: SightyActionContext<ElceSceneKey, ElceSlotName>,
  onTestStateChange?: ScenarioBuildOptions['onTestStateChange'],
): Promise<void> {
  const data = context.event.data
  if (data === undefined || !isRecord(data.profileValues)) return
  const profileValues = readProfileValues(data.profileValues)
  await context.updateContext({ profileValues })
  const state = testStateFromScenarioContext(context.context, { profileValues })
  onTestStateChange?.(state)
  await saveScormReaderState(context, undefined, state)
}

/** Commits a valid initial profile using the compact scenario definition. */
export async function submitProfileAction(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  await runSubmitProfile(context)
}

/** Keeps authoring-preview persistence outside the exported profile handler. */
function createSubmitProfile(onTestStateChange: NonNullable<ScenarioBuildOptions['onTestStateChange']>) {
  return (context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> => runSubmitProfile(context, onTestStateChange)
}

/** Validates profile values, updates Sighty state, and optionally reports the change to the host. */
async function runSubmitProfile(
  context: SightyActionContext<ElceSceneKey, ElceSlotName>,
  onTestStateChange?: ScenarioBuildOptions['onTestStateChange'],
): Promise<void> {
  const runtime = readScenarioRuntimeData(context.data)
  const data = context.event.data
  if (!isValidProfileSubmission(runtime.profile.properties, runtime.profile.fieldPropertyIds, data)) return
  const profileValues = readProfileValues(isRecord(data) ? data.profileValues : undefined)
  await context.updateContext({ profileValues, profileSubmitted: true })
  const state = testStateFromScenarioContext(context.context, { profileValues, profileSubmitted: true })
  onTestStateChange?.(state)
  await saveScormReaderState(context, undefined, state)
}

/** Stores a validated answer in Sighty progress and its existing Evaluation state. */
export async function recordQuestionResultAction(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  await runRecordQuestionResult(context)
}

/** Keeps authoring-preview persistence outside the exported question handler. */
function createRecordQuestionResult(onTestStateChange: NonNullable<ScenarioBuildOptions['onTestStateChange']>) {
  return (context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> => runRecordQuestionResult(context, onTestStateChange)
}

/** Validates a Question result, updates Sighty state, and refreshes presentation. */
async function runRecordQuestionResult(
  context: SightyActionContext<ElceSceneKey, ElceSlotName>,
  onTestStateChange?: ScenarioBuildOptions['onTestStateChange'],
): Promise<void> {
    const runtime = readScenarioRuntimeData(context.data)
    const pageId = pageIdFromSceneKey(context.event.sourceSceneKey)
    if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return
    const payload = context.event.data as {
      pageId?: unknown
      bdcId?: unknown
      isCorrect?: unknown
      answerIds?: unknown
      selectedAnswerIds?: unknown
      expectedAnswerIds?: unknown
    } | undefined
    const expectedBdcId = runtime.questionBdcByPage[pageId]
    if (payload?.pageId !== pageId || payload.bdcId !== expectedBdcId || typeof payload.isCorrect !== 'boolean') return

    const questionResults = readQuestionResults(context.context)
    const page = runtime.pages[pageId]
    const chapter = page?.chapterId === null || page?.chapterId === undefined
      ? undefined
      : runtime.chapters[page.chapterId]
    const evaluationChapter = chapter?.type === CHAPTER_TYPE.EVALUATION ? chapter : undefined
    const evaluationStates = readEvaluationStates(context.context)
    const state = evaluationChapter === undefined
      ? undefined
      : recordEvaluationAnswer(runtime, evaluationChapter, pageId, payload, evaluationStates[evaluationChapter.id])
    const answerIds = readStringIds(payload.answerIds)
    const selectedAnswerIds = readStringIds(payload.selectedAnswerIds)
    const expectedAnswerIds = readStringIds(payload.expectedAnswerIds)
    const questionAnswers = answerIds === undefined || selectedAnswerIds === undefined || expectedAnswerIds === undefined
      ? readQuestionAnswers(context.context)
      : {
        ...readQuestionAnswers(context.context),
        [pageId]: { answerIds, selectedAnswerIds, expectedAnswerIds, isCorrect: payload.isCorrect },
      }
    const nextEvaluationStates = evaluationChapter === undefined || state === undefined
      ? evaluationStates
      : { ...evaluationStates, [evaluationChapter.id]: state }
    await context.updateContext({
      questionResults: { ...questionResults, [pageId]: payload.isCorrect },
      questionAnswers,
      evaluationStates: nextEvaluationStates,
    })
    const nextTestState = testStateFromScenarioContext(context.context, {
      questionAnswers,
      questionResults: { ...questionResults, [pageId]: payload.isCorrect },
      evaluationStates: nextEvaluationStates,
    })
    onTestStateChange?.(nextTestState)
    await saveScormReaderState(context, pageId, nextTestState)
    await refreshPresentation(context)
}

/** Records the validated answer in its chapter's existing portable machine. */
function recordEvaluationAnswer(
  runtime: ElceRuntimeData,
  chapter: ElceRuntimeChapter,
  pageId: string,
  payload: Readonly<{ answerIds?: unknown; selectedAnswerIds?: unknown; expectedAnswerIds?: unknown }>,
  previousState: EvaluationMachineState | undefined,
): EvaluationMachineState | undefined {
  const answerIds = readStringIds(payload.answerIds)
  const selectedAnswerIds = readStringIds(payload.selectedAnswerIds)
  const expectedAnswerIds = readStringIds(payload.expectedAnswerIds)
  if (answerIds === undefined || selectedAnswerIds === undefined || expectedAnswerIds === undefined) return previousState
  const questionIds = evaluationQuestionPageIds(runtime, chapter)
  if (questionIds.length === 0) return previousState
  const machine = createEvaluationMachine(chapter, questionIds)
  let state = previousState ?? machine.initialState()
  if (state.value === 'ready') state = machine.transition(state, { type: 'START' })
  return machine.transition(state, {
    type: 'QUESTION.ANSWERED',
    answer: { questionId: pageId, answerIds, selectedAnswerIds, expectedAnswerIds },
  })
}

/** Reads Sighty's result state on page entry and sends it to the Result story. */
export async function refreshEvaluationResultAction(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  await runRefreshEvaluationResult(context)
}

/** Keeps authoring-preview persistence outside the exported result handler. */
function createRefreshEvaluationResult(onTestStateChange: NonNullable<ScenarioBuildOptions['onTestStateChange']>) {
  return (context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> => runRefreshEvaluationResult(context, onTestStateChange)
}

/** Refreshes the page chrome and sends a completed Evaluation result to its compiled scene. */
async function runRefreshEvaluationResult(
  context: SightyActionContext<ElceSceneKey, ElceSlotName>,
  onTestStateChange?: ScenarioBuildOptions['onTestStateChange'],
): Promise<void> {
    const runtime = readScenarioRuntimeData(context.data)
    await refreshPresentation(context)
    const pageId = pageIdFromSceneKey(context.scenarioState.active?.sceneKey)
    if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return
    const page = runtime.pages[pageId]
  if (page?.chapterId === null || page?.chapterId === undefined) {
    await saveScormReaderState(context, pageId)
    return
  }
    const sourceChapter = runtime.chapters[page.chapterId]
    const chapter = sourceChapter?.type === CHAPTER_TYPE.EVALUATION ? sourceChapter : undefined
    const resultBdcId = page.bdcIds.find((bdcId) => runtime.bdcTypes[bdcId] === BDC_TYPE.EVALUATION_RESULT)
  if (chapter === undefined || resultBdcId === undefined) {
    await saveScormReaderState(context, pageId)
    return
  }

    const questionIds = evaluationQuestionPageIds(runtime, chapter)
  if (questionIds.length === 0) {
    await saveScormReaderState(context, pageId)
    return
  }
    const evaluationStates = readEvaluationStates(context.context)
    let state = evaluationStates[chapter.id]
  if (state === undefined || !questionIds.every((questionId) => state?.context.answers[questionId] !== undefined)) {
    await saveScormReaderState(context, pageId)
    return
  }
    const machine = createEvaluationMachine(chapter, questionIds)
    if (state.value === 'attempting') state = machine.transition(state, { type: 'COMPLETE' })
    const passed = state.context.result?.passed
  if (passed === null || passed === undefined) {
    await saveScormReaderState(context, pageId)
    return
  }
  let persistedEvaluationStates = evaluationStates
    if (state !== evaluationStates[chapter.id]) {
    persistedEvaluationStates = { ...evaluationStates, [chapter.id]: state }
    await context.updateContext({ evaluationStates: persistedEvaluationStates })
    onTestStateChange?.(testStateFromScenarioContext(context.context, { evaluationStates: persistedEvaluationStates }))
    }
  await readScormProgressSink(context.context)?.recordEvaluationResult(
    testStateFromScenarioContext(context.context, { evaluationStates: persistedEvaluationStates }),
    pageId,
    { chapterId: chapter.id, evaluationState: state },
  )
    await context.send(`scene-${pageId}` as ElceSceneKey, {
      name: passed ? ELCE_EVENTS.EVALUATION_RESULT_SUCCESS : ELCE_EVENTS.EVALUATION_RESULT_FAILURE,
    }, { scope: 'scene' })
}

/** Saves the current Elcé test state when the host supplied the SCORM adapter. */
async function saveScormReaderState(
  context: SightyActionContext<ElceSceneKey, ElceSlotName>,
  currentPageId?: string,
  state = testStateFromScenarioContext(context.context),
): Promise<void> {
  await readScormProgressSink(context.context)?.saveReaderState(state, currentPageId)
}

/** Reads the optional Elcé adapter from the application-owned Sighty runtime context. */
function readScormProgressSink(
  context: Readonly<Record<string, unknown>>,
): ElceScormProgressSink | undefined {
  const candidate = context[ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY]
  if (typeof candidate !== 'object' || candidate === null) return undefined
  const sink = candidate as Partial<ElceScormProgressSink>
  return typeof sink.saveReaderState === 'function' && typeof sink.recordEvaluationResult === 'function'
    ? sink as ElceScormProgressSink
    : undefined
}

/** Refreshes menu, title, and navigation from the active Sighty page. */
async function refreshPresentation(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  const runtime = readScenarioRuntimeData(context.data)
  const presentation = await createPresentation(context.scenarioState, runtime, context.context)
  await context.send(ELCE_SCENARIO.TITLE_SCENE, {
    name: ELCE_EVENTS.PRESENTATION_TITLE,
    data: { content: presentation.title },
  }, { scope: 'story', storyId: 'main' })
  const activeSceneKeys = new Set(context.scenarioState.current.map((selection) => selection.sceneKey))
  if (activeSceneKeys.has(ELCE_SCENARIO.SUMMARY_MENU_SCENE)) {
    await context.send(ELCE_SCENARIO.SUMMARY_MENU_SCENE, {
      name: ELCE_EVENTS.PRESENTATION_MENU,
      data: { className: presentation.menuClassPatch },
    }, { scope: 'story', storyId: 'main' })
  }
  const summaryScenes: ElceSceneKey[] = activeSceneKeys.has(ELCE_SCENARIO.SUMMARY_MENU_SCENE)
    ? [ELCE_SCENARIO.SUMMARY_MENU_SCENE]
    : []
  if (context.scenarioState.current.some((selection) => selection.sceneKey === ELCE_SCENARIO.SUMMARY_SCENE)) {
    summaryScenes.push(ELCE_SCENARIO.SUMMARY_SCENE)
  }
  for (const sceneKey of summaryScenes) {
    for (const page of presentation.menuPageStates) {
      await context.send(sceneKey, {
        name: menuPresentationEvent(page.id),
        data: { attr: {
          'data-page-id': page.id,
          'data-active': String(page.active),
          'data-locked': String(!page.allowed),
          'aria-label': page.allowed ? page.title : `${page.title}, verrouillé`,
          disabled: !page.allowed,
        } },
      }, { scope: 'story', storyId: 'main' })
    }
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
  if (context.event.name === ELCE_EVENTS.MENU_SUMMARY || context.event.name.startsWith(ELCE_EVENTS.MENU_PREFIX)) {
    await closeMenuDrawer(context)
  }
}

/** Projects the current page and its guard answers into the fixed controls. */
async function createPresentation(
  scenarioState: SightyScenarioStateApi<ElceSceneKey, ElceSlotName>,
  runtime: ElceRuntimeData,
  readerContext: Readonly<Record<string, unknown>>,
): Promise<ElcePresentation> {
  const activeContentSelection = scenarioState.current.find((selection) => selection.slotName === ELCE_SCENARIO.CONTENT_SLOT)
  const activeSceneKey = activeContentSelection?.sceneKey ?? scenarioState.active?.sceneKey
  const activePageId = pageIdFromSceneKey(activeSceneKey)
  const pageIndex = activePageId === undefined ? -1 : runtime.pageIds.indexOf(activePageId)
  const page = activePageId === undefined ? undefined : runtime.pageIds[pageIndex]
  const nextPageId = pageIndex < 0 ? undefined : runtime.pageIds[pageIndex + 1]
  const activePage = activePageId === undefined ? undefined : runtime.pages[activePageId]
  const activeChapter = activePage?.chapterId === null || activePage?.chapterId === undefined
    ? undefined
    : runtime.chapters[activePage.chapterId]
  const nextDestination = activeChapter?.pageIds.at(-1) === activePageId
    && runtime.summary.endChapterDestination === 'summary'
    && runtime.summary.showAtRoot
    ? { path: `${ELCE_SCENARIO.ROOT_VIEW}/${ELCE_SCENARIO.SUMMARY_ENTRY_VIEW}` }
    : nextPageId === undefined ? undefined : { path: pagePathFromTable(runtime.pagePaths, nextPageId) }
  const previousAllowed = page === undefined
    ? false
    : await scenarioState.canExit(
        { path: pagePathFromTable(runtime.pagePaths, page) },
      { name: ELCE_EVENTS.NAVIGATION_PREVIOUS, sourceSceneKey: ELCE_SCENARIO.NAVIGATION_SCENE },
      )
  const nextExitAllowed = page === undefined
    ? false
    : await scenarioState.canExit(
        { path: pagePathFromTable(runtime.pagePaths, page) },
      { name: ELCE_EVENTS.NAVIGATION_NEXT, sourceSceneKey: ELCE_SCENARIO.NAVIGATION_SCENE },
      )
  const nextPageAllowed = nextDestination === undefined
    ? false
    : await scenarioState.canAccess(
        nextDestination,
        { name: ELCE_EVENTS.NAVIGATION_NEXT, sourceSceneKey: ELCE_SCENARIO.NAVIGATION_SCENE },
      )

  const menu = await createMenuClassPatch(
    activePageId,
    runtime,
    readerContext.profileEnabled !== false,
    readProfileValues(readerContext.profileValues),
    scenarioState,
  )
  return {
    title: activeSceneKey === ELCE_SCENARIO.SUMMARY_SCENE
      ? runtime.summary.title
      : activeSceneKey === ELCE_SCENARIO.PROFILE_FORM_SCENE || activeSceneKey === ELCE_SCENARIO.PROFILE_COMPLETE_SCENE
        ? 'Profil'
        : page === undefined || page === ELCE_SCENARIO.EMPTY_PAGE ? 'Aucune page' : runtime.pageNames[page] ?? page,
    menuClassPatch: menu.patch,
    menuPageStates: menu.states,
    previousAttributes: { type: 'button', disabled: pageIndex <= 0 || !previousAllowed },
    nextAttributes: { type: 'button', disabled: !nextExitAllowed || !nextPageAllowed },
    navigationStatus: pageIndex < 0 || page === ELCE_SCENARIO.EMPTY_PAGE
      ? ''
      : `Page ${pageIndex + 1} sur ${runtime.pageIds.length}`,
  }
}

/** Computes menu classes using the same access guard as the content slot. */
async function createMenuClassPatch(
  activePageId: string | undefined,
  runtime: ElceRuntimeData,
  profileEnabled: boolean,
  profileValues: Readonly<Record<string, ProfileValue>>,
  scenarioState: SightyScenarioStateApi<ElceSceneKey, ElceSlotName>,
): Promise<Readonly<{
  readonly patch: Readonly<{ add: string; remove: string }>
  readonly states: readonly Readonly<{ id: string; title: string; active: boolean; allowed: boolean }>[]
}>> {
  const access = await Promise.all(runtime.summaryEntries.map(async (entry) => {
    const pageAllowed = entry.pageId === activePageId
      ? true
      : await scenarioState.canAccess(
          { path: pagePathFromTable(runtime.pagePaths, entry.pageId) },
          { name: menuEvent(entry.pageId), sourceSceneKey: ELCE_SCENARIO.SUMMARY_MENU_SCENE },
        )
    const chapterAllowed = !profileEnabled || entry.kind !== 'chapter'
      || runtimeChapterVisibilityAllowsAccess(runtime, entry.id, profileValues)
    return { id: entry.pageId, title: entry.title, allowed: pageAllowed && chapterAllowed }
  }))
  const classes = ['elce-player-menu-state']
  return {
    patch: { add: classes.join(' '), remove: classes.join(' ') },
    states: access.map((page) => ({ ...page, active: page.id === activePageId })),
  }
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

/** Reads submitted reader answers from the current Sighty context. */
function readQuestionAnswers(context: Readonly<Record<string, unknown>>): ProjectTestState['questionAnswers'] {
  const answers = context.questionAnswers
  if (typeof answers !== 'object' || answers === null) return {}
  return answers as ProjectTestState['questionAnswers']
}

/** Combines a Sighty context snapshot and one committed patch into persisted state. */
function testStateFromScenarioContext(
  context: Readonly<Record<string, unknown>>,
  patch: Readonly<Record<string, unknown>> = {},
): ProjectTestState {
  const read = (key: string): unknown => Object.hasOwn(patch, key) ? patch[key] : context[key]
  const defaults = INITIAL_PROJECT_TEST_STATE
  return {
    ...defaults,
    profileEnabled: typeof read('profileEnabled') === 'boolean' ? read('profileEnabled') as boolean : defaults.profileEnabled,
    profileSubmitted: typeof read('profileSubmitted') === 'boolean' ? read('profileSubmitted') as boolean : defaults.profileSubmitted,
    profileValues: isRecord(read('profileValues')) ? read('profileValues') as ProjectTestState['profileValues'] : defaults.profileValues,
    finishedPageIds: readStringIds(read('finishedPages')) ?? defaults.finishedPageIds,
    questionAnswers: isRecord(read('questionAnswers')) ? read('questionAnswers') as ProjectTestState['questionAnswers'] : defaults.questionAnswers,
    evaluationStates: isRecord(read('evaluationStates')) ? read('evaluationStates') as ProjectTestState['evaluationStates'] : defaults.evaluationStates,
  }
}

/** Reads the runtime configuration embedded in the compact scenario data. */
function readScenarioRuntimeData(value: Readonly<Record<string, unknown>>): ElceRuntimeData {
  if (!Array.isArray(value.pageIds)
    || !isRecord(value.pageNames)
    || !isRecord(value.pagePaths)
    || !isRecord(value.pages)
    || !isRecord(value.chapters)
    || !isRecord(value.profile)) {
    throw new Error('Les données runtime du scénario Elcé sont absentes ou invalides.')
  }
  return value as unknown as ElceRuntimeData
}

/** Checks whether a scenario context field is a non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Applies compact page visibility and chapter-prerequisite data to one access check. */
function runtimePageProfileConstraintsAllowAccess(
  runtime: ElceRuntimeData,
  pageId: string,
  context: Readonly<Record<string, unknown>>,
): boolean {
  if (context.profileEnabled === false) return true
  const visibility = runtime.profile.pageVisibility[pageId]
  if (visibility?.unmetBehavior === 'lock'
    && !profileVisibilityMatches(visibility.conditions, new Map(runtime.profile.properties.map((property) => [property.id, property])), readProfileValues(context.profileValues))) {
    return false
  }
  const page = runtime.pages[pageId]
  if (page?.chapterId === null || page?.chapterId === undefined) return true
  const constraint = runtime.profile.readingConstraints.find((candidate) => candidate.target.id === page.chapterId)
  if (constraint === undefined) return true
  const chapterIndex = runtime.chapterIds.indexOf(page.chapterId)
  const requiredChapterIds = constraint.requirement.kind === 'chapters'
    ? constraint.requirement.chapterIds
    : runtime.chapterIds[chapterIndex - 1] === undefined
      ? []
      : [runtime.chapterIds[chapterIndex - 1]!]
  return requiredChapterIds.every((requiredChapterId) => {
    const requiredChapter = runtime.chapters[requiredChapterId]
    return requiredChapter !== undefined
      && requiredChapter.pageIds.every((requiredPageId) => isPageComplete(requiredPageId, context, runtime.questionBdcByPage))
  })
}

/** Checks one chapter's compact visibility rule using the shared profile evaluator. */
function runtimeChapterVisibilityAllowsAccess(
  runtime: ElceRuntimeData,
  chapterId: string,
  profileValues: Readonly<Record<string, ProfileValue>>,
): boolean {
  const visibility = runtime.profile.chapterVisibility[chapterId]
  return visibility === undefined
    || visibility.unmetBehavior !== 'lock'
    || profileVisibilityMatches(visibility.conditions, new Map(runtime.profile.properties.map((property) => [property.id, property])), profileValues)
}

/** Accepts only the serializable profile values supported by the test-state API. */
function readProfileValues(value: unknown): Readonly<Record<string, ProfileValue>> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap<[string, ProfileValue]>(([key, candidate]) => {
    if (typeof candidate === 'string' || typeof candidate === 'number' && Number.isFinite(candidate)) return [[key, candidate]]
    if (Array.isArray(candidate) && candidate.every((entry) => typeof entry === 'string')) return [[key, candidate as readonly string[]]]
    return []
  }))
}

/** Returns the string identifiers carried by a validated Question event. */
function readStringIds(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || !value.every((candidate): candidate is string => typeof candidate === 'string')) return undefined
  return value
}

/** Resolves the chapter's ordered Question pages from the compact scene index. */
function evaluationQuestionPageIds(runtime: ElceRuntimeData, chapter: ElceRuntimeChapter): readonly string[] {
  return chapter.pageIds.filter((pageId) => runtime.questionBdcByPage[pageId] !== undefined)
}

/** Creates the chapter machine with its authored settings and shared score threshold. */
function createEvaluationMachine(
  chapter: ElceRuntimeChapter,
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

/** Requires scroll-end and a submitted Question answer when the page owns one. */
function isPageComplete(pageId: string, context: Readonly<Record<string, unknown>>, questionBdcByPage: Readonly<Record<string, string>>): boolean {
  if (!readFinishedPages(context).includes(pageId)) return false
  return questionBdcByPage[pageId] === undefined || Object.hasOwn(readQuestionResults(context), pageId)
}

/** Applies page completion and any final Evaluation chapter threshold before navigation. */
function canLeavePage(
  runtime: ElceRuntimeData,
  pageId: string,
  context: Readonly<Record<string, unknown>>,
): boolean {
  if (runtime.summary.pageContinuationMode !== 'free' && !isPageComplete(pageId, context, runtime.questionBdcByPage)) return false
  const page = runtime.pages[pageId]
  if (page === undefined || page.chapterId === null) return true
  const chapter = runtime.chapters[page.chapterId]
  switch (chapter?.type) {
    case CHAPTER_TYPE.EVALUATION: {
      if (chapter.pageIds.at(-1) !== pageId) return true
      const questionPageIds = evaluationQuestionPageIds(runtime, chapter)
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

/** Builds the title scene updated by the Sighty presentation action. */
function createTitleScene(): SceneDoc<string> {
  return {
    id: `${ELCE_SCENARIO.TITLE_SCENE}-document`,
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        listen: [{ on: ELCE_EVENTS.PRESENTATION_TITLE }],
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
        listen: [
          { on: ELCE_EVENTS.PRESENTATION_NAVIGATION_PREVIOUS },
          { on: ELCE_EVENTS.PRESENTATION_NAVIGATION_STATUS },
          { on: ELCE_EVENTS.PRESENTATION_NAVIGATION_NEXT },
        ],
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

/** Holds the reader briefly while the submitted profile rebuilds its projection. */
function createProfileCompleteScene(documentId: string): SceneDoc<string> {
  return {
    id: `${documentId}-profile-complete-scene`,
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        persos: [{
          id: `${documentId}-profile-complete-message`,
          type: 'tag',
          initial: {
            tag: 'p',
            content: 'Ouverture du parcours…',
            className: 'elce-player-profile-complete',
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

/** Formats the stable Sighty path of a scene mounted in the content slot. */
function contentScenePath(entryViewId: string): string {
  return `${ELCE_SCENARIO.ROOT_VIEW}/${entryViewId}/${ELCE_SCENARIO.CONTENT_SLOT}/${ELCE_SCENARIO.CONTENT_SLOT}-view`
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
