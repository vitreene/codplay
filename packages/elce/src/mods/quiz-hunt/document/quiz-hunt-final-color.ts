import type { QuizHuntDocument } from './quiz-hunt-document-types'

/** Fills a missing Finale color from its same-named Question page. */
export function normalizeQuizHuntFinalColors(document: QuizHuntDocument): QuizHuntDocument {
  const questionBank = document.chapters.find((chapter) => chapter.type === 'questions')
  const finalBank = document.chapters.find((chapter) => chapter.type === 'finals')
  if (questionBank === undefined || finalBank === undefined) return document

  const pagesById = new Map(document.pages.map((page) => [page.id, page]))
  const questionColorsByName = new Map(questionBank.pageIds.flatMap((pageId) => {
    const page = pagesById.get(pageId)
    return page === undefined || page.colorId === null
      ? []
      : [[pageTitleKey(page.name), page.colorId] as const]
  }))
  const pages = document.pages.map((page) => {
    if (page.chapterId !== finalBank.id || page.colorId !== null) return page
    const colorId = questionColorsByName.get(pageTitleKey(page.name))
    return colorId === undefined ? page : { ...page, colorId }
  })
  return pages.some((page, index) => page !== document.pages[index])
    ? { ...document, pages }
    : document
}

/** Normalizes page titles for matching the demo's shared Question and Finale labels. */
function pageTitleKey(name: string): string {
  return name.trim().toLocaleLowerCase('fr')
}
