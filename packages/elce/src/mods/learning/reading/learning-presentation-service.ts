import type { SightyScenarioStateApi } from '@codplay/sighty'
import { ELCE_EVENTS, ELCE_SCENARIO } from './learning-reading-events'
import type { ElcePresentation, ElceRuntimeChapter, ElceRuntimeData, ElceSceneKey, ElceSlotName } from './learning-scenario-types'
import { ELCE_SCORM_CHAPTER_CONTEXT_KEY, ELCE_SCORM_CHAPTER_SCO_IDENTIFIERS_CONTEXT_KEY, ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY } from '../../../scorm/scorm-types'
import type { ProfileValue } from '../profile/domain/learning-profile-types'
import { learningProgressionService } from './learning-progression-service'
import { learningTestStateService } from './learning-test-state-service'
import { menuEvent, pageIdFromSceneKey, pagePathFromTable } from './learning-scenario-paths'

/** Calculates the values and access states displayed by the reader chrome. */
export class LearningPresentationService {
  /** Projects current Sighty state into title, navigation, and menu presentation. */
  public async createPresentation(
    scenarioState: SightyScenarioStateApi<ElceSceneKey, ElceSlotName>,
    runtime: ElceRuntimeData,
    readerContext: Readonly<Record<string, unknown>>,
  ): Promise<ElcePresentation> {
    const scormChapter = this.scopedScormChapter(runtime, readerContext)
    const presentationPageIds = scormChapter?.pageIds ?? runtime.pageIds
    const activeContentSelection = scenarioState.current.find((selection) => selection.slotName === ELCE_SCENARIO.CONTENT_SLOT)
    const activeSceneKey = activeContentSelection?.sceneKey ?? scenarioState.active?.sceneKey
    const activePageId = pageIdFromSceneKey(activeSceneKey)
    const pageIndex = activePageId === undefined ? -1 : presentationPageIds.indexOf(activePageId)
    const page = activePageId === undefined ? undefined : presentationPageIds[pageIndex]
    const nextPageId = pageIndex < 0 ? undefined : presentationPageIds[pageIndex + 1]
    const activePage = activePageId === undefined ? undefined : runtime.pages[activePageId]
    const activeChapter = activePage?.chapterId === null || activePage?.chapterId === undefined
      ? undefined
      : runtime.chapters[activePage.chapterId]
    const nextDestination = scormChapter === undefined && activeChapter?.pageIds.at(-1) === activePageId
      && runtime.summary.endChapterDestination === 'summary'
      && runtime.summary.showAtRoot
      ? { path: `${ELCE_SCENARIO.ROOT_VIEW}/${ELCE_SCENARIO.SUMMARY_ENTRY_VIEW}` }
      : nextPageId === undefined ? undefined : { path: pagePathFromTable(runtime.pagePaths, nextPageId) }
    const previousScormChapter = scormChapter !== undefined && pageIndex === 0
      ? this.adjacentChapterId(runtime, scormChapter.id, -1)
      : undefined
    const nextScormChapter = scormChapter !== undefined && pageIndex === presentationPageIds.length - 1
      ? this.adjacentChapterId(runtime, scormChapter.id, 1)
      : undefined
    const previousScormChapterAllowed = previousScormChapter !== undefined
      && this.hasScormChapterSco(readerContext, previousScormChapter)
    const nextScormChapterAllowed = nextScormChapter !== undefined
      && this.hasScormChapterSco(readerContext, nextScormChapter)
    const previousPageAllowed = pageIndex > 0
    const nextExitAllowed = page === undefined
      ? false
      : await scenarioState.canExit(
          { path: pagePathFromTable(runtime.pagePaths, page) },
          { name: ELCE_EVENTS.NAVIGATION_NEXT, sourceSceneKey: ELCE_SCENARIO.NAVIGATION_SCENE },
        )
    const nextDestinationAllowed = nextDestination === undefined
      ? nextScormChapterAllowed
      : await scenarioState.canAccess(nextDestination, {
          name: ELCE_EVENTS.NAVIGATION_NEXT,
          sourceSceneKey: ELCE_SCENARIO.NAVIGATION_SCENE,
        })
    const menu = await this.createMenuClassPatch(
      activePageId,
      runtime,
      readerContext.profileEnabled !== false,
      learningTestStateService.readProfileValues(readerContext.profileValues),
      scenarioState,
      scormChapter?.id,
    )
    return {
      title: activeSceneKey === ELCE_SCENARIO.SUMMARY_SCENE
        ? runtime.summary.title
        : activeSceneKey === ELCE_SCENARIO.PROFILE_FORM_SCENE || activeSceneKey === ELCE_SCENARIO.PROFILE_COMPLETE_SCENE
          ? 'Profil'
          : page === undefined || page === ELCE_SCENARIO.EMPTY_PAGE ? 'Aucune page' : runtime.pageNames[page] ?? page,
      menuClassPatch: menu.patch,
      menuPageStates: menu.states,
      previousAttributes: { type: 'button', disabled: !previousPageAllowed && !previousScormChapterAllowed },
      nextAttributes: { type: 'button', disabled: !nextExitAllowed || !nextDestinationAllowed },
      navigationStatus: pageIndex < 0 || page === ELCE_SCENARIO.EMPTY_PAGE
        ? ''
        : `Page ${pageIndex + 1} sur ${presentationPageIds.length}`,
    }
  }

  /** Computes menu access with the same route guard used by the content slot. */
  public async createMenuClassPatch(
    activePageId: string | undefined,
    runtime: ElceRuntimeData,
    profileEnabled: boolean,
    profileValues: Readonly<Record<string, ProfileValue>>,
    scenarioState: SightyScenarioStateApi<ElceSceneKey, ElceSlotName>,
    scormChapterId?: string,
  ): Promise<Readonly<{
    readonly patch: Readonly<{ add: string; remove: string }>
    readonly states: readonly Readonly<{ id: string; title: string; active: boolean; allowed: boolean }>[]
  }>> {
    const scormChapter = scormChapterId === undefined ? undefined : runtime.chapters[scormChapterId]
    const entries = scormChapter === undefined
      ? runtime.summaryEntries
      : runtime.summaryEntries.filter((entry) => scormChapter.pageIds.includes(entry.pageId))
    const access = await Promise.all(entries.map(async (entry) => {
      const pageAllowed = entry.pageId === activePageId
        ? true
        : await scenarioState.canAccess(
            { path: pagePathFromTable(runtime.pagePaths, entry.pageId) },
            { name: menuEvent(entry.pageId), sourceSceneKey: ELCE_SCENARIO.SUMMARY_MENU_SCENE },
          )
      const chapterAllowed = !profileEnabled || entry.kind !== 'chapter'
        || learningProgressionService.runtimeChapterVisibilityAllowsAccess(runtime, entry.id, profileValues)
      return { id: entry.pageId, title: entry.title, allowed: pageAllowed && chapterAllowed }
    }))
    const classes = ['elce-player-menu-state']
    return {
      patch: { add: classes.join(' '), remove: classes.join(' ') },
      states: access.map((page) => ({ ...page, active: page.id === activePageId })),
    }
  }

  /** Reads the current chapter scope used by a chapter-level SCORM launch. */
  public scopedScormChapter(
    runtime: ElceRuntimeData,
    context: Readonly<Record<string, unknown>>,
  ): ElceRuntimeChapter | undefined {
    const chapterId = context[ELCE_SCORM_CHAPTER_CONTEXT_KEY]
    return typeof chapterId === 'string' ? runtime.chapters[chapterId] : undefined
  }

  /** Resolves the neighboring chapter in authored order. */
  public adjacentChapterId(runtime: ElceRuntimeData, chapterId: string, direction: -1 | 1): string | undefined {
    const index = runtime.chapterIds.indexOf(chapterId)
    return index < 0 ? undefined : runtime.chapterIds[index + direction]
  }

  /** Checks that the manifest and adapter provide a route to a neighboring SCO. */
  public hasAdjacentScormChapter(
    runtime: ElceRuntimeData,
    context: Readonly<Record<string, unknown>>,
    chapterId: string,
    direction: -1 | 1,
  ): boolean {
    const targetChapterId = this.adjacentChapterId(runtime, chapterId, direction)
    return targetChapterId !== undefined && this.hasScormChapterSco(context, targetChapterId)
  }

  /** Checks the stable manifest item identifier and navigation operation. */
  public hasScormChapterSco(context: Readonly<Record<string, unknown>>, chapterId: string): boolean {
    const identifiers = context[ELCE_SCORM_CHAPTER_SCO_IDENTIFIERS_CONTEXT_KEY]
    const sink = context[ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY]
    return this.isRecord(identifiers)
      && typeof identifiers[chapterId] === 'string'
      && this.isRecord(sink)
      && typeof sink.navigateToChapter === 'function'
  }

  /** Checks whether an unknown context value is a non-array record. */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}

export const learningPresentationService = new LearningPresentationService()
