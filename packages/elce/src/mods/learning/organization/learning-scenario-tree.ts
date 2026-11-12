import type { ChapterId, PageId } from '../../../core/document/content-document-types'
import type { LearningChapter, LearningDocumentData } from '../document/learning-document-types'
import { SCENARIO_ENTRY_KIND } from './learning-organization-config'
import type { ScenarioEntry } from './learning-scenario-entry-types'

type LearningScenarioTree = Pick<LearningDocumentData, 'chapters' | 'scenarioEntries'>

/** Returns the ordered entries directly owned by the root or a chapter. */
export function scenarioEntriesForParent(
  document: LearningScenarioTree,
  parentChapterId: ChapterId | null,
): readonly ScenarioEntry[] {
  if (parentChapterId === null) return document.scenarioEntries
  return document.chapters.find((chapter) => chapter.id === parentChapterId)?.entries ?? []
}

/** Finds the parent chapter that contains one chapter entry. */
export function scenarioParentChapterId(document: LearningScenarioTree, chapterId: ChapterId): ChapterId | null {
  if (document.scenarioEntries.some((entry) => entry.kind === SCENARIO_ENTRY_KIND.CHAPTER && entry.chapterId === chapterId)) return null
  return document.chapters.find((chapter) => chapter.entries.some(
    (entry) => entry.kind === SCENARIO_ENTRY_KIND.CHAPTER && entry.chapterId === chapterId,
  ))?.id ?? null
}

/** Returns a chapter's ancestors from the root down to its direct parent. */
export function scenarioChapterAncestors(document: LearningScenarioTree, chapterId: ChapterId): readonly LearningChapter[] {
  const ancestors: LearningChapter[] = []
  const visitedChapterIds = new Set<ChapterId>([chapterId])
  let parentChapterId = scenarioParentChapterId(document, chapterId)
  while (parentChapterId !== null) {
    if (visitedChapterIds.has(parentChapterId)) break
    visitedChapterIds.add(parentChapterId)
    const parent = document.chapters.find((chapter) => chapter.id === parentChapterId)
    if (parent === undefined) break
    ancestors.unshift(parent)
    parentChapterId = scenarioParentChapterId(document, parent.id)
  }
  return ancestors
}

/** Returns the number of chapter levels from the root to one chapter. */
export function scenarioChapterDepth(document: LearningScenarioTree, chapterId: ChapterId): number {
  return scenarioChapterAncestors(document, chapterId).length + 1
}

/** Flattens chapter identifiers in the scenario's depth-first reading order. */
export function scenarioChapterIdsInOrder(document: LearningScenarioTree): readonly ChapterId[] {
  const chapters = new Map(document.chapters.map((chapter) => [chapter.id, chapter]))
  const chapterIds: ChapterId[] = []
  const visitedChapterIds = new Set<ChapterId>()
  const visit = (entries: readonly ScenarioEntry[]): void => {
    for (const entry of entries) {
      if (entry.kind !== SCENARIO_ENTRY_KIND.CHAPTER) continue
      const chapter = chapters.get(entry.chapterId)
      if (chapter === undefined || visitedChapterIds.has(chapter.id)) continue
      visitedChapterIds.add(chapter.id)
      chapterIds.push(chapter.id)
      visit(chapter.entries)
    }
  }
  visit(document.scenarioEntries)
  return chapterIds
}

/** Flattens page identifiers in the scenario's depth-first reading order. */
export function scenarioPageIdsInOrder(document: LearningScenarioTree): readonly PageId[] {
  const chapters = new Map(document.chapters.map((chapter) => [chapter.id, chapter]))
  const pageIds: PageId[] = []
  const visitedChapterIds = new Set<ChapterId>()
  const visit = (entries: readonly ScenarioEntry[]): void => {
    for (const entry of entries) {
      switch (entry.kind) {
        case SCENARIO_ENTRY_KIND.PAGE:
          pageIds.push(entry.pageId)
          break
        case SCENARIO_ENTRY_KIND.CHAPTER:
          if (!visitedChapterIds.has(entry.chapterId)) {
            visitedChapterIds.add(entry.chapterId)
            visit(chapters.get(entry.chapterId)?.entries ?? [])
          }
          break
      }
    }
  }
  visit(document.scenarioEntries)
  return pageIds
}

/** Returns all pages in one chapter subtree using their mixed entry order. */
export function scenarioChapterPageIds(document: LearningScenarioTree, chapterId: ChapterId): readonly PageId[] {
  const chapters = new Map(document.chapters.map((chapter) => [chapter.id, chapter]))
  const pageIds: PageId[] = []
  const visitedChapterIds = new Set<ChapterId>([chapterId])
  const visit = (entries: readonly ScenarioEntry[]): void => {
    for (const entry of entries) {
      switch (entry.kind) {
        case SCENARIO_ENTRY_KIND.PAGE:
          pageIds.push(entry.pageId)
          break
        case SCENARIO_ENTRY_KIND.CHAPTER:
          if (!visitedChapterIds.has(entry.chapterId)) {
            visitedChapterIds.add(entry.chapterId)
            visit(chapters.get(entry.chapterId)?.entries ?? [])
          }
          break
      }
    }
  }
  visit(chapters.get(chapterId)?.entries ?? [])
  return pageIds
}

/** Resolves the root chapter that owns the route slot for one page. */
export function scenarioRootChapterIdForPage(document: LearningScenarioTree, page: { readonly chapterId: ChapterId | null }): ChapterId | null {
  if (page.chapterId === null) return null
  let chapterId = page.chapterId
  const visitedChapterIds = new Set<ChapterId>([chapterId])
  while (true) {
    const parentChapterId = scenarioParentChapterId(document, chapterId)
    if (parentChapterId === null || visitedChapterIds.has(parentChapterId)) break
    visitedChapterIds.add(parentChapterId)
    chapterId = parentChapterId
  }
  return chapterId
}
