import { ELCE_EVENTS, ELCE_SCENARIO, ELCE_SCENARIO_HANDLERS } from '../config/document-config'
import { createScrollContainerSourceAdapter } from '@codplay/component-v2/scroll-container'
import type { SightyRuntimeApi, SightyScenarioMutation, SightyViewAction } from '@codplay/sighty'
import type { CodPlayTelco } from 'codplay'
import { scenarioContextFromTestState } from '../builders/scenario/scenario-context'
import type { ElceSceneKey, ElceSlotName } from '../builders/scenario/scenario-builder-types'
import type { ProjectTestState } from '../domain/summary-profile/test-state-types'
import { INITIAL_PROJECT_TEST_STATE } from '../domain/summary-profile/test-state-types'
import {
  ELCE_SCORM_CHAPTER_CONTEXT_KEY,
  ELCE_SCORM_CHAPTER_SCO_IDENTIFIERS_CONTEXT_KEY,
  ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY,
} from './scorm-types'
import type { ScormReaderState } from './scorm-types'
import { ElceScormAdapter } from './elce-scorm-adapter'
import type { ScormVersion } from '@codplay/sighty-scorm'

/** Describes the compact Elcé runtime metadata already embedded in a Sighty package. */
export interface ElceScormPackageScenario {
  readonly id?: string
  readonly data: Readonly<{
    pageIds: readonly string[]
    pagePaths: Readonly<Record<string, string>>
    chapterIds: readonly string[]
    previewStartPageId: string
    questionBdcByPage: Readonly<Record<string, string>>
    chapters: Readonly<Record<string, Readonly<{
      id: string
      name: string
      type: string
      pageIds: readonly string[]
    }>>>
    profile: Readonly<{ fieldPropertyIds: readonly string[] }>
  }>
}

/** Describes the Sighty loader and runtime operations used by an exported SCO. */
type ElceScormPackageRuntime = Pick<
  SightyRuntimeApi<ElceSceneKey, ElceSlotName>,
  'initialize' | 'play' | 'dispatch' | 'mutate'
> & Readonly<{
  getInstance(sceneKey: ElceSceneKey): Readonly<{
    telco: Pick<CodPlayTelco, 'getProgress'>
  }> | undefined
}>

export interface ElceScormPackageLoader {
  (options: Readonly<{
    root: HTMLElement
    codplay: Readonly<{
      htmlHost: Readonly<{
        sourceAdapterFactories: readonly (typeof createScrollContainerSourceAdapter)[]
      }>
    }>
    runtime: Readonly<{ context: Readonly<Record<string, unknown>> }>
  }>): Promise<Readonly<{
    runtime: ElceScormPackageRuntime
    destroy(): void
  }>>
}

/** Configures the exported package session separately from the author preview. */
export interface ElceScormPackageRuntimeOptions {
  readonly root: HTMLElement
  readonly scenario: ElceScormPackageScenario
  readonly loadSightyPackage: ElceScormPackageLoader
  readonly version: ScormVersion
  readonly monoSco: boolean
  readonly chapterId?: string
  readonly initialPageId?: string
  readonly chapterScoIdentifiers?: Readonly<Record<string, string>>
}

/** Owns the live Sighty package and its single SCORM session. */
export interface ElceScormPackageRuntimeHandle {
  readonly session: ElceScormAdapter
  close(): Promise<void>
}

/** Restores SCORM state into the existing Sighty package before showing its player. */
export async function startElceScormPackageRuntime(
  options: ElceScormPackageRuntimeOptions,
): Promise<ElceScormPackageRuntimeHandle> {
  const browserWindow = options.root.ownerDocument.defaultView
  if (browserWindow === null) throw new Error('Le package SCORM doit être lancé dans un document navigateur.')

  const packageData = validatePackageData(options.scenario.data)
  const scopedChapter = options.chapterId === undefined ? undefined : packageData.chapters[options.chapterId]
  if (options.chapterId !== undefined && scopedChapter === undefined) {
    throw new Error(`Le chapitre SCORM ${options.chapterId} est absent du scénario Sighty.`)
  }
  if (scopedChapter !== undefined && scopedChapter.pageIds.length === 0) {
    throw new Error(`Le chapitre SCORM ${scopedChapter.id} ne contient aucune page.`)
  }
  const evaluationChapters = Object.values(packageData.chapters).filter((chapter) => chapter.type === 'evaluation')
  let course: Awaited<ReturnType<ElceScormPackageLoader>> | undefined
  const session = new ElceScormAdapter({
    version: options.version,
    monoSco: options.monoSco,
    evaluationChapterIds: evaluationChapters.map((chapter) => chapter.id),
    chapterIds: packageData.chapterIds,
    chapterPageIds: packageData.chapterIds.map((chapterId) => packageData.chapters[chapterId].pageIds),
    questionPageIds: Object.keys(packageData.questionBdcByPage),
    chapterScoIdentifiers: options.chapterScoIdentifiers,
    getSessionTimeMs: () => course?.runtime.getInstance(ELCE_SCENARIO.LAYOUT_SCENE)?.telco.getProgress().timelineMs,
    ...(scopedChapter === undefined ? {} : {
      scoPageIds: scopedChapter.pageIds,
      ...(scopedChapter.type === 'evaluation' ? { scoEvaluationChapterId: scopedChapter.id } : {}),
    }),
    onDiagnostic: (message) => console.warn(message),
  })
  const originalVisibility = options.root.style.visibility
  options.root.style.visibility = 'hidden'

  let closed = false
  /** Saves the last state, destroys Sighty, and closes the LMS session once. */
  const close = async (): Promise<void> => {
    if (closed) return
    closed = true
    browserWindow.removeEventListener('pagehide', handlePageEnd)
    browserWindow.removeEventListener('beforeunload', handlePageEnd)
    try {
      await session.close()
    } finally {
      course?.destroy()
    }
  }
  /** Starts the session shutdown while the LMS is leaving this SCO. */
  const handlePageEnd = (): void => {
    void close().catch((error: unknown) => console.error('Fermeture SCORM impossible.', error))
  }

  try {
    const saved = await session.initialize()
    const initialPageCandidates = scopedChapter?.pageIds ?? packageData.pageIds
    const initialPageId = options.initialPageId !== undefined && initialPageCandidates.includes(options.initialPageId)
      ? options.initialPageId
      : scopedChapter?.pageIds[0] ?? packageData.previewStartPageId
    const restored = reconcilePackagedReaderState(saved, packageData, initialPageId, options.chapterId)
    const currentPageId = restored.currentPageId ?? initialPageId
    if (JSON.stringify(restored) !== JSON.stringify(saved)) {
      await session.saveReaderState(restored.projectTestState, currentPageId)
    }

    course = await options.loadSightyPackage({
      root: options.root,
      codplay: {
        htmlHost: { sourceAdapterFactories: [createScrollContainerSourceAdapter] },
      },
      runtime: {
        context: {
          ...scenarioContextFromTestState(restored.projectTestState),
          ...(options.chapterId === undefined ? {} : { [ELCE_SCORM_CHAPTER_CONTEXT_KEY]: options.chapterId }),
          ...(options.chapterScoIdentifiers === undefined ? {} : {
            [ELCE_SCORM_CHAPTER_SCO_IDENTIFIERS_CONTEXT_KEY]: options.chapterScoIdentifiers,
          }),
          [ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY]: session,
        },
      },
    })
    await course.runtime.initialize()
    if (scopedChapter !== undefined) {
      await configureScormChapterBoundaryNavigation(
        course.runtime,
        packageData,
        scopedChapter,
        options.chapterScoIdentifiers ?? {},
      )
    }
    await course.runtime.play(ELCE_SCENARIO.LAYOUT_SCENE)
    const refreshed = await course.runtime.dispatch({ name: ELCE_EVENTS.PRESENTATION_REFRESH })
    if (!refreshed) throw new Error('La présentation Elcé n’a pas pu être actualisée dans le package SCORM.')
    if (currentPageId !== packageData.previewStartPageId) {
      const restoredRoute = await course.runtime.dispatch({ name: `${ELCE_EVENTS.MENU_PREFIX}${currentPageId}` })
      if (!restoredRoute) throw new Error(`La page de reprise Elcé ${currentPageId} n’a pas pu être ouverte.`)
    }
    await session.saveReaderState(restored.projectTestState, currentPageId)
    options.root.style.visibility = 'visible'
    browserWindow.addEventListener('pagehide', handlePageEnd, { once: true })
    browserWindow.addEventListener('beforeunload', handlePageEnd, { once: true })
    return { session, close }
  } catch (error) {
    options.root.style.visibility = originalVisibility
    closed = true
    try {
      await session.close()
    } finally {
      course?.destroy()
    }
    throw error
  }
}

/** Replaces the edges of a chapter SCO with LMS choice actions and retains local routes. */
async function configureScormChapterBoundaryNavigation(
  runtime: Awaited<ReturnType<ElceScormPackageLoader>>['runtime'],
  data: ElceScormPackageScenario['data'],
  chapter: ElceScormPackageScenario['data']['chapters'][string],
  chapterScoIdentifiers: Readonly<Record<string, string>>,
): Promise<void> {
  const pageIds = [...new Set([chapter.pageIds[0], chapter.pageIds.at(-1)].filter((pageId): pageId is string => pageId !== undefined))]
  for (const pageId of pageIds) {
    const globalIndex = data.pageIds.indexOf(pageId)
    const chapterIndex = data.chapterIds.indexOf(chapter.id)
    const previousChapterId = data.chapterIds[chapterIndex - 1]
    const nextChapterId = data.chapterIds[chapterIndex + 1]
    const previousPageId = chapter.pageIds[0] === pageId ? undefined : data.pageIds[globalIndex - 1]
    const nextPageId = chapter.pageIds.at(-1) === pageId ? undefined : data.pageIds[globalIndex + 1]
    const previousAction: SightyViewAction<ElceSceneKey, ElceSlotName> = chapter.pageIds[0] === pageId
      ? previousChapterId !== undefined && chapterScoIdentifiers[previousChapterId] !== undefined
        ? { action: ELCE_SCENARIO_HANDLERS.NAVIGATE_SCORM_CHAPTER }
        : {}
      : previousPageId === undefined
        ? {}
        : { go: { path: data.pagePaths[previousPageId]! }, action: ELCE_SCENARIO_HANDLERS.REFRESH_EVALUATION_RESULT }
    const nextAction: SightyViewAction<ElceSceneKey, ElceSlotName> = chapter.pageIds.at(-1) === pageId
      ? nextChapterId !== undefined && chapterScoIdentifiers[nextChapterId] !== undefined
        ? { action: ELCE_SCENARIO_HANDLERS.NAVIGATE_SCORM_CHAPTER }
        : {}
      : nextPageId === undefined
        ? {}
        : { go: { path: data.pagePaths[nextPageId]! }, action: ELCE_SCENARIO_HANDLERS.REFRESH_EVALUATION_RESULT }
    const path = data.pagePaths[pageId]
    if (path === undefined) throw new Error(`Route Sighty absente pour la limite de chapitre : ${pageId}`)
    const mutation: SightyScenarioMutation<ElceSceneKey, ElceSlotName> = {
      kind: 'update-view',
      target: { path },
      patch: {
        actions: {
          [ELCE_EVENTS.NAVIGATION_PREVIOUS]: previousAction,
          [ELCE_EVENTS.NAVIGATION_NEXT]: nextAction,
        },
      },
    }
    const updated = await runtime.mutate(mutation, 'preserve')
    if (!updated) throw new Error(`Les commandes de navigation SCORM du chapitre ${chapter.id} n’ont pas pu être installées.`)
  }
}

/** Keeps only saved page and chapter identities that exist in this exported package. */
export function reconcilePackagedReaderState(
  saved: ScormReaderState,
  data: ElceScormPackageScenario['data'],
  initialPageId = data.previewStartPageId,
  chapterId?: string,
): ScormReaderState {
  const scopedChapter = chapterId === undefined ? undefined : data.chapters[chapterId]
  if (chapterId !== undefined && scopedChapter === undefined) {
    throw new Error(`Le chapitre SCORM ${chapterId} est absent du scénario Sighty.`)
  }
  const pageIds = new Set(scopedChapter?.pageIds ?? data.pageIds)
  const evaluationChapterIds = new Set(Object.values(data.chapters)
    .filter((chapter) => chapter.type === 'evaluation' && (chapterId === undefined || chapter.id === chapterId))
    .map((chapter) => chapter.id))
  const allowedQuestionPages = new Set(Object.keys(data.questionBdcByPage).filter((pageId) => pageIds.has(pageId)))
  const allowedProfileProperties = new Set(data.profile.fieldPropertyIds)
  const fallbackPageId = pageIds.has(initialPageId)
    ? initialPageId
    : pageIds.has(data.previewStartPageId)
      ? data.previewStartPageId
    : data.pageIds[0] ?? null
  const currentPageId = saved.currentPageId !== null && pageIds.has(saved.currentPageId)
    ? saved.currentPageId
    : fallbackPageId
  const projectTestState: ProjectTestState = {
    ...INITIAL_PROJECT_TEST_STATE,
    ...saved.projectTestState,
    finishedPageIds: saved.projectTestState.finishedPageIds.filter((pageId) => pageIds.has(pageId)),
    questionAnswers: Object.fromEntries(Object.entries(saved.projectTestState.questionAnswers)
      .filter(([pageId]) => allowedQuestionPages.has(pageId))),
    evaluationStates: Object.fromEntries(Object.entries(saved.projectTestState.evaluationStates)
      .filter(([chapterId]) => evaluationChapterIds.has(chapterId))),
    profileValues: Object.fromEntries(Object.entries(saved.projectTestState.profileValues)
      .filter(([propertyId]) => allowedProfileProperties.has(propertyId))),
  }
  return {
    schemaVersion: 1,
    currentPageId,
    projectTestState,
  }
}

/** Rejects an archive whose runtime metadata is not sufficient for Elcé actions. */
function validatePackageData(value: ElceScormPackageScenario['data']): ElceScormPackageScenario['data'] {
  if (!Array.isArray(value.pageIds)
    || typeof value.pagePaths !== 'object'
    || value.pagePaths === null
    || !Array.isArray(value.chapterIds)
    || typeof value.previewStartPageId !== 'string'
    || typeof value.questionBdcByPage !== 'object'
    || value.questionBdcByPage === null
    || typeof value.chapters !== 'object'
    || value.chapters === null
    || typeof value.profile !== 'object'
    || value.profile === null
    || !Array.isArray(value.profile.fieldPropertyIds)) {
    throw new Error('Le paquet Sighty ne contient pas les données runtime Elcé attendues.')
  }
  return value
}
