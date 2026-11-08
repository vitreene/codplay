import { QUIZ_HUNT_COLOR_SLOT_COUNT } from './quiz-hunt-document-types'
import type { QuizHuntDocument, QuizHuntPage } from './quiz-hunt-document-types'

/** Lists Question pages that can trigger the extra without displacing required trials. */
export function getQuizHuntExtraTriggerCandidates(document: QuizHuntDocument): readonly QuizHuntPage[] {
  const questionBank = document.chapters.find((chapter) => chapter.type === 'questions')
  const finalBank = document.chapters.find((chapter) => chapter.type === 'finals')
  if (questionBank === undefined || finalBank === undefined) return []

  const pagesById = new Map(document.pages.map((page) => [page.id, page]))
  const questionPages = questionBank.pageIds.flatMap((pageId) => {
    const page = pagesById.get(pageId)
    return page === undefined ? [] : [page]
  })
  const finalColorIds = new Set(finalBank.pageIds.flatMap((pageId) => {
    const page = pagesById.get(pageId)
    return page?.colorId === null || page?.colorId === undefined ? [] : [page.colorId]
  }))

  return questionPages.filter((page) => {
    const colorId = page.colorId
    if (colorId === null || !finalColorIds.has(colorId)
      || !document.settings.groups.some((group) => group.id === colorId)) return false
    const mandatoryPages = questionPages.filter((candidate) => candidate.colorId === colorId && candidate.mandatory)
    return page.mandatory
      ? mandatoryPages.slice(0, QUIZ_HUNT_COLOR_SLOT_COUNT).some((candidate) => candidate.id === page.id)
      : mandatoryPages.length < QUIZ_HUNT_COLOR_SLOT_COUNT
  })
}

/** Drops a configured trigger when document edits make it impossible to include. */
export function normalizeQuizHuntExtraTrigger(document: QuizHuntDocument): QuizHuntDocument {
  const triggerPageId = document.settings.extraTriggerPageId
  if (triggerPageId === null || getQuizHuntExtraTriggerCandidates(document).some((page) => page.id === triggerPageId)) {
    return document
  }
  return { ...document, settings: { ...document.settings, extraTriggerPageId: null } }
}
