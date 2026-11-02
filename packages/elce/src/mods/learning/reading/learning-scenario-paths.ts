import { ELCE_EVENTS, ELCE_SCENARIO } from './learning-reading-events'
import { SCENARIO_ENTRY_KIND } from '../organization/learning-organization-config'
import type { LearningDocument } from '../document/learning-document'
import type { ScenarioEntry } from '../organization/learning-scenario-entry-types'
import { findPage } from '../../../core/document/content-placement-service'

/** Returns the graph key assigned to one root-level ScenarioEntry. */
export function scenarioEntryViewId(entry: ScenarioEntry): string {
  switch (entry.kind) {
    case SCENARIO_ENTRY_KIND.PAGE:
      return `${SCENARIO_ENTRY_KIND.PAGE}-${entry.pageId}`
    case SCENARIO_ENTRY_KIND.CHAPTER:
      return `${SCENARIO_ENTRY_KIND.CHAPTER}-${entry.chapterId}`
  }
}

/** Resolves the graph entry that contains one document page. */
export function scenarioEntryViewIdForPage(document: LearningDocument, pageId: string): string {
  const page = findPage(document.pages, pageId)
  switch (page.chapterId) {
    case null:
      return scenarioEntryViewId({ kind: SCENARIO_ENTRY_KIND.PAGE, pageId: page.id })
    default:
      return scenarioEntryViewId({ kind: SCENARIO_ENTRY_KIND.CHAPTER, chapterId: page.chapterId })
  }
}

/** Formats the stable Sighty path of a page in its root or chapter slot. */
export function pagePath(document: LearningDocument, pageId: string): string {
  switch (pageId) {
    case ELCE_SCENARIO.EMPTY_PAGE:
      return `${ELCE_SCENARIO.ROOT_VIEW}/${ELCE_SCENARIO.EMPTY_ENTRY_VIEW}/${ELCE_SCENARIO.CONTENT_SLOT}/${pageId}`
    default:
      return `${ELCE_SCENARIO.ROOT_VIEW}/${scenarioEntryViewIdForPage(document, pageId)}/${ELCE_SCENARIO.CONTENT_SLOT}/${pageId}`
  }
}

/** Formats the stable Sighty path of a scene mounted in the content slot. */
export function contentScenePath(entryViewId: string): string {
  return `${ELCE_SCENARIO.ROOT_VIEW}/${entryViewId}/${ELCE_SCENARIO.CONTENT_SLOT}/${ELCE_SCENARIO.CONTENT_SLOT}-view`
}

/** Reads one page route from the immutable scenario table. */
export function pagePathFromTable(pagePaths: Readonly<Record<string, string>>, pageId: string): string {
  const path = pagePaths[pageId]
  if (path === undefined) throw new Error(`Route Sighty absente pour la page : ${pageId}`)
  return path
}

/** Formats the public menu selection event for one page. */
export function menuEvent(pageId: string): string {
  return `${ELCE_EVENTS.MENU_PREFIX}${pageId}`
}

/** Formats the private presentation event sent to one menu button perso. */
export function menuPresentationEvent(pageId: string): string {
  return `${ELCE_EVENTS.PRESENTATION_MENU_PAGE_PREFIX}${pageId}`
}

/** Reads a page identifier from a generated scene key. */
export function pageIdFromSceneKey(sceneKey: string | undefined): string | undefined {
  if (sceneKey === undefined || !sceneKey.startsWith('scene-')) return undefined
  return sceneKey.slice('scene-'.length)
}
