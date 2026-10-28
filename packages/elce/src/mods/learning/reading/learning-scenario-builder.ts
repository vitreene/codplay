import type {
  SightyGraphView,
  SightyScenarioDefinition,
  SightyViewAction,
  SightyViewGraph,
} from '@codplay/sighty'
import type { SightySceneSourceValue } from '@codplay/sighty'
import { ELCE_EVENTS, ELCE_SCENARIO, ELCE_SCENARIO_HANDLERS } from './learning-reading-events'
import { SCENARIO_ENTRY_KIND } from '../organization/learning-organization-config'
import type { LearningDocument } from '../document/learning-document'
import { BDC_TYPE } from '../learning-definition'
import type { ScenarioEntry } from '../organization/learning-scenario-entry-types'
import { INITIAL_PROJECT_TEST_STATE } from './learning-test-state-types'
import { findChapter, findPage } from '../../../core/document/content-placement-service'
import { learningProfileService } from '../profile/domain/learning-profile-service'
import { buildProfileFormScene } from '../profile/reading/learning-profile-form-scene-builder'
import { buildSummaryEntries, buildSummaryScene } from '../organization/reading/learning-summary-scene-builder'
import type { ElceRuntimeData, ElceSceneKey, ElceSlotName, ScenarioBuildOptions } from './learning-scenario-types'
import { learningTestStateService } from './learning-test-state-service'
import { learningProgressionService } from './learning-progression-service'
import { learningLayoutSceneBuilder } from './learning-layout-scene-builder'
import { LearningScenarioActions } from './learning-scenario-actions'
import { ElceEditorSettingsResolver } from '../../../domain/editor-settings/editor-settings-resolver'
import {
  contentScenePath,
  menuEvent,
  pagePath,
  pagePathFromTable,
  scenarioEntryViewId,
  scenarioEntryViewIdForPage,
} from './learning-scenario-paths'

const editorSettingsResolver = new ElceEditorSettingsResolver()

export type { ScenarioBuildOptions } from './learning-scenario-types'
export {
  closeMenuDrawer,
  markPageFinishedAction,
  navigateScormChapterAction,
  openMenuDrawerAction,
  pageAccessGuard,
  pageExitGuard,
  recordQuestionResultAction,
  refreshEvaluationResultAction,
  refreshPresentationAction,
  resetQuestionScene,
  saveProfileValuesAction,
  submitProfileAction,
} from './learning-scenario-actions'

export class LearningScenarioBuilder {
  /** Builds the complete Sighty document graph and its persistent presentation scenes. */
  public build(
    document: LearningDocument,
    scenes: Readonly<Record<string, SightySceneSourceValue>>,
    startPageId?: string,
    options: ScenarioBuildOptions = {},
  ): SightyScenarioDefinition<ElceSceneKey, ElceSlotName> {
    const pageIds = this.scenarioPageIds(document)
    const requestedPageId = startPageId !== undefined && pageIds.includes(startPageId) ? startPageId : undefined
    const preferredPageId = this.resolveStartPageId(pageIds, requestedPageId)
    const testState = options.testState ?? INITIAL_PROJECT_TEST_STATE
    const questionBdcByPage = Object.fromEntries(document.pages.flatMap((page) => {
      const question = page.bdcIds.map((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId))
        .find((bdc) => bdc?.type === BDC_TYPE.QUESTION)
      return question === undefined ? [] : [[page.id, question.id]]
    }))
    const testContext = learningTestStateService.scenarioContextFromTestState(testState)
    const firstPageId = this.resolveAccessibleStartPageId(document, pageIds, preferredPageId, questionBdcByPage, testContext)
    const activeRequestPageId = requestedPageId !== undefined
      && learningProgressionService.pageProfileConstraintsAllowAccess(document, requestedPageId, testContext, questionBdcByPage)
      ? requestedPageId
      : undefined
    const pagePaths = this.createPagePaths(document, pageIds)
    const evaluationResultPageIds = new Set(document.pages.flatMap((page) => {
      const hasEvaluationResult = page.bdcIds.some((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId)?.type === BDC_TYPE.EVALUATION_RESULT)
      return hasEvaluationResult ? [page.id] : []
    }))
    const runtimeData = this.createScenarioRuntimeData({
      document,
      pageIds,
      pagePaths,
      questionBdcByPage,
      previewStartPageId: firstPageId,
      evaluationResultPageIds: [...evaluationResultPageIds],
    })
    const playerSettings = editorSettingsResolver.resolvePlayer()
    const sceneCatalog: Record<string, SightySceneSourceValue> = {
      [ELCE_SCENARIO.LAYOUT_SCENE]: learningLayoutSceneBuilder.buildLayoutScene(document),
      [ELCE_SCENARIO.SUMMARY_SCENE]: buildSummaryScene(
        document,
        'root',
        playerSettings.navigation.summaryDrawerMotion,
        options.mediaSources,
      ),
      [ELCE_SCENARIO.SUMMARY_MENU_SCENE]: buildSummaryScene(
        document,
        'menu',
        playerSettings.navigation.summaryDrawerMotion,
        options.mediaSources,
      ),
      [ELCE_SCENARIO.PROFILE_FORM_SCENE]: buildProfileFormScene(
        document.id,
        document.data.profile.properties,
        document.data.profile.fieldPropertyIds,
        options.testState?.profileValues ?? {},
      ),
      [ELCE_SCENARIO.PROFILE_COMPLETE_SCENE]: learningLayoutSceneBuilder.createProfileCompleteScene(document.id),
      [ELCE_SCENARIO.TITLE_SCENE]: learningLayoutSceneBuilder.createTitleScene(),
      [ELCE_SCENARIO.NAVIGATION_SCENE]: learningLayoutSceneBuilder.createNavigationScene(),
      [`scene-${ELCE_SCENARIO.EMPTY_PAGE}`]: learningLayoutSceneBuilder.createEmptyPageScene(document.id),
      ...scenes,
    }
    const scenarioActions = new LearningScenarioActions(options)

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
        actions: this.createScenarioActions(pageIds, pagePaths),
            view: {
              scene: ELCE_SCENARIO.LAYOUT_SCENE,
              slots: {
                [ELCE_SCENARIO.MENU_SLOT]: this.createMenuSceneSlot(),
                [ELCE_SCENARIO.TITLE_SLOT]: this.createPersistentSceneSlot(
                  ELCE_SCENARIO.TITLE_SCENE,
                  ELCE_SCENARIO.TITLE_SLOT,
                ),
                [ELCE_SCENARIO.NAVIGATION_SLOT]: this.createPersistentSceneSlot(
                  ELCE_SCENARIO.NAVIGATION_SCENE,
                  ELCE_SCENARIO.NAVIGATION_SLOT,
                ),
              },
              views: this.createScenarioViews(document, firstPageId, activeRequestPageId, options),
            },
          },
        },
      },
      scenes: sceneCatalog,
      actions: scenarioActions.actionHandlers(),
      guards: scenarioActions.guardHandlers(),
    }
  }

  /** Builds the serializable reader configuration consumed by exported callbacks. */
  private createScenarioRuntimeData(input: Readonly<{
    document: LearningDocument
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
        name: chapter.name,
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
          const constraint = learningProfileService.profileVisibilityForPage(document, page.id)
          return constraint === undefined ? [] : [[page.id, constraint]]
        })),
        chapterVisibility: Object.fromEntries(document.chapters.flatMap((chapter) => {
          const constraint = learningProfileService.profileVisibilityForChapter(document, chapter.id)
          return constraint === undefined ? [] : [[chapter.id, constraint]]
        })),
        readingConstraints: document.data.profile.readingConstraints,
      },
      summaryEntries: buildSummaryEntries(document),
    }
  }

  /** Returns the document order consumed by the content slot and its navigation. */
  private scenarioPageIds(document: LearningDocument): readonly string[] {
    return document.scenarioPageIds
  }

  /** Builds the page graph plus the independent summary and profile destinations. */
  private createScenarioViews(
    document: LearningDocument,
    firstPageId: string,
    requestedPageId: string | undefined,
    options: ScenarioBuildOptions,
  ): SightyViewGraph<ElceSceneKey, ElceSlotName> {
    const pageIds = this.scenarioPageIds(document)
    const pagePaths = this.createPagePaths(document, pageIds)
    const views: Record<string, SightyGraphView<ElceSceneKey, ElceSlotName>> = Object.fromEntries(
      document.data.scenarioEntries.flatMap((entry) => this.scenarioEntryView(document, entry, firstPageId, pageIds)),
    )
    const collectProfile = learningProfileService.shouldCollectProfile(document.data.profile.fieldPropertyIds, options.testState ?? INITIAL_PROJECT_TEST_STATE)
    const firstPagePath = pagePathFromTable(pagePaths, firstPageId)
    if (pageIds.length === 0) {
      views[ELCE_SCENARIO.EMPTY_ENTRY_VIEW] = {
        view: { slots: { [ELCE_SCENARIO.CONTENT_SLOT]: this.createPageViews(document, [], firstPageId, pageIds) } },
        actions: this.navigationBlockActions(),
      }
    }
    if (document.data.summary.showAtRoot) {
      views[ELCE_SCENARIO.SUMMARY_ENTRY_VIEW] = {
        view: { slots: { [ELCE_SCENARIO.CONTENT_SLOT]: this.createPersistentSceneSlot(ELCE_SCENARIO.SUMMARY_SCENE, ELCE_SCENARIO.CONTENT_SLOT) } },
        actions: this.navigationBlockActions(),
      }
    }
    if (document.data.profile.fieldPropertyIds.length > 0) {
      views[ELCE_SCENARIO.PROFILE_ENTRY_VIEW] = {
        view: { slots: { [ELCE_SCENARIO.CONTENT_SLOT]: this.createPersistentSceneSlot(ELCE_SCENARIO.PROFILE_FORM_SCENE, ELCE_SCENARIO.CONTENT_SLOT) } },
        actions: this.navigationBlockActions(),
      }
      views[ELCE_SCENARIO.PROFILE_COMPLETE_ENTRY_VIEW] = {
        view: { slots: { [ELCE_SCENARIO.CONTENT_SLOT]: this.createPersistentSceneSlot(ELCE_SCENARIO.PROFILE_COMPLETE_SCENE, ELCE_SCENARIO.CONTENT_SLOT) } },
        actions: this.navigationBlockActions(),
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
  private scenarioEntryView(
    document: LearningDocument,
    entry: ScenarioEntry,
    firstPageId: string,
    pageIds: readonly string[],
  ): readonly [string, SightyGraphView<ElceSceneKey, ElceSlotName>][] {
    switch (entry.kind) {
      case SCENARIO_ENTRY_KIND.PAGE:
        return [[scenarioEntryViewId(entry), {
          view: {
            slots: {
              [ELCE_SCENARIO.CONTENT_SLOT]: this.createPageViews(document, [entry.pageId], firstPageId, pageIds),
            },
          },
        }]]
      case SCENARIO_ENTRY_KIND.CHAPTER: {
        const chapter = findChapter(document.chapters, entry.chapterId)
        if (chapter.pageIds.length === 0) return []
        return [[scenarioEntryViewId(entry), {
          view: {
            slots: {
              [ELCE_SCENARIO.CONTENT_SLOT]: this.createPageViews(document, chapter.pageIds, firstPageId, pageIds),
            },
          },
        }]]
      }
    }
  }

  /** Resolves the requested page while keeping document order as fallback. */
  private resolveStartPageId(pageIds: readonly string[], requestedPageId: string | undefined): string {
    if (requestedPageId !== undefined && pageIds.includes(requestedPageId)) return requestedPageId
    return pageIds[0] ?? ELCE_SCENARIO.EMPTY_PAGE
  }

  /** Selects the requested or first profile-unlocked page as a safe route fallback. */
  private resolveAccessibleStartPageId(
    document: LearningDocument,
    pageIds: readonly string[],
    preferredPageId: string,
    questionBdcByPage: Readonly<Record<string, string>>,
    testContext: Readonly<Record<string, unknown>>,
  ): string {
    if (learningProgressionService.pageProfileConstraintsAllowAccess(document, preferredPageId, testContext, questionBdcByPage)) return preferredPageId
    return pageIds.find((pageId) => learningProgressionService.pageProfileConstraintsAllowAccess(document, pageId, testContext, questionBdcByPage)) ?? preferredPageId
  }

  /** Builds the route table shared by menu actions and presentation refreshes. */
  private createPagePaths(document: LearningDocument, pageIds: readonly string[]): Readonly<Record<string, string>> {
    return Object.fromEntries([
      ...pageIds.map((pageId) => [pageId, pagePath(document, pageId)]),
      [ELCE_SCENARIO.EMPTY_PAGE, pagePath(document, ELCE_SCENARIO.EMPTY_PAGE)],
    ])
  }

  /** Builds the content graph with one explicit scene view per page. */
  private createPageViews(
    document: LearningDocument,
    pageIds: readonly string[],
    requestedPageId?: string,
    scenarioPageIds: readonly string[] = pageIds,
  ): SightyViewGraph<ElceSceneKey, ElceSlotName> {
    const entries: Record<string, SightyGraphView<ElceSceneKey, ElceSlotName>> = Object.fromEntries(pageIds.map((pageId) => {
      const page = findPage(document.pages, pageId)
      return [page.id, {
        view: { scene: `scene-${page.id}` as ElceSceneKey },
        actions: this.createPageNavigationActions(document, page.id, scenarioPageIds),
      }]
    }))
    const start = requestedPageId !== undefined && pageIds.includes(requestedPageId)
      ? requestedPageId
      : pageIds[0] ?? ELCE_SCENARIO.EMPTY_PAGE
    if (pageIds.length === 0) entries[ELCE_SCENARIO.EMPTY_PAGE] = { view: { scene: `scene-${ELCE_SCENARIO.EMPTY_PAGE}` } }
    return { start, views: entries }
  }

  /** Computes explicit page routes so summary destinations stay outside page order. */
  private createPageNavigationActions(
    document: LearningDocument,
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
  private navigationBlockActions(): Readonly<Record<string, SightyViewAction<ElceSceneKey, ElceSlotName>>> {
    return { [ELCE_EVENTS.NAVIGATION_NEXT]: {}, [ELCE_EVENTS.NAVIGATION_PREVIOUS]: {} }
  }

  /** Creates one persistent scene slot under the document layout. */
  private createPersistentSceneSlot(
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
  private createMenuSceneSlot(): SightyViewGraph<ElceSceneKey, ElceSlotName> {
    return this.createPersistentSceneSlot(ELCE_SCENARIO.SUMMARY_MENU_SCENE, ELCE_SCENARIO.MENU_SLOT)
  }

  /** Declares all page routes and presentation events at the document root. */
  private createScenarioActions(
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

  /** Keeps generated identifiers valid as CSS class suffixes. */

}

export const learningScenarioBuilder = new LearningScenarioBuilder()
