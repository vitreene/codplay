import { QUESTION_BDC_TYPE } from '../../../resources/bdcs/question/question-config'
import type { ResourceBdc } from '../../../resources/document/resource-document-types'
import type { QuizHuntDocument, QuizHuntPage } from '../document/quiz-hunt-document-types'
import { createQuizHuntGameDraw, resolveQuizHuntRunSeed } from './quiz-hunt-game-draw'

export interface QuizHuntGameQuestion {
  readonly page: QuizHuntPage
  readonly colorId: string
  readonly colorName: string
  readonly color: string
  readonly questionBdc: ResourceBdc
}

export interface QuizHuntGameCatalog {
  readonly seed: number
  readonly trials: readonly QuizHuntGameQuestion[]
  readonly finals: readonly QuizHuntGameQuestion[]
  readonly trialSlotsByColor: ReturnType<typeof createQuizHuntGameDraw>['trialSlotsByColor']
  readonly finalSlotsByColor: ReturnType<typeof createQuizHuntGameDraw>['finalSlotsByColor']
  readonly trialGridOrder: readonly string[]
  readonly activeColorIds: readonly string[]
  readonly extraPageId: string | null
  readonly extraOffsetMs: number
  readonly finalColorId: string | null
  readonly finalPageId: string | null
}

/** Resolves the seed draw to the selected common Question BDCs for one game. */
export function createQuizHuntGameCatalog(
  document: QuizHuntDocument,
  context: 'authoring' | 'release',
  storedSeed?: number,
): QuizHuntGameCatalog {
  const seed = resolveQuizHuntRunSeed(document.settings, context, storedSeed)
  const draw = createQuizHuntGameDraw(document, seed)
  const groupsById = new Map(document.settings.groups.map((group) => [group.id, group]))
  const bdcsByPageId = new Map<string, ResourceBdc>()

  const readQuestion = (page: QuizHuntPage | null): QuizHuntGameQuestion | null => {
    if (page === null) return null
    const group = page.colorId === null ? undefined : groupsById.get(page.colorId)
    if (group === undefined) throw new Error(`La question « ${page.name} » n’a pas de couleur du sommaire.`)
    const questionBdc = bdcsByPageId.get(page.id) ?? document.bdcs
      .filter((bdc) => bdc.pageId === page.id)
      .find((bdc) => bdc.type === QUESTION_BDC_TYPE && bdc.question !== null)
    if (questionBdc === undefined) throw new Error(`La page « ${page.name} » ne contient pas de BDC Question.`)
    bdcsByPageId.set(page.id, questionBdc)
    return { page, colorId: group.id, colorName: group.name, color: group.color, questionBdc }
  }

  const trialsById = new Map(Object.values(draw.trialSlotsByColor).flatMap((slots) => slots.flatMap((page) => {
    const question = readQuestion(page)
    return question === null ? [] : [[question.page.id, question] as const]
  })))
  const finalsById = new Map(Object.values(draw.finalSlotsByColor).flatMap((slots) => slots.flatMap((page) => {
    const question = readQuestion(page)
    return question === null ? [] : [[question.page.id, question] as const]
  })))

  return {
    seed,
    trials: draw.trialGridOrder.flatMap((pageId) => {
      const question = trialsById.get(pageId)
      return question === undefined ? [] : [question]
    }),
    finals: [...finalsById.values()],
    trialSlotsByColor: draw.trialSlotsByColor,
    finalSlotsByColor: draw.finalSlotsByColor,
    trialGridOrder: draw.trialGridOrder,
    activeColorIds: draw.activeColorIds,
    extraPageId: draw.extraPageId,
    extraOffsetMs: draw.extraOffsetMs,
    finalColorId: draw.finalColorId,
    finalPageId: draw.finalPageId,
  }
}
