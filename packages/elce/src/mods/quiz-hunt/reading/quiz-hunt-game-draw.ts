import type { QuizHuntDocument, QuizHuntPage } from '../document/quiz-hunt-document-types'

export const QUIZ_HUNT_COLOR_SLOT_COUNT = 4

export interface QuizHuntGameDraw {
  readonly seed: number
  readonly trialSlotsByColor: Readonly<Record<string, readonly (QuizHuntPage | null)[]>>
  readonly finalSlotsByColor: Readonly<Record<string, readonly (QuizHuntPage | null)[]>>
  readonly trialGridOrder: readonly string[]
  readonly activeColorIds: readonly string[]
  readonly extraPageId: string | null
  readonly extraOffsetMs: number
  readonly finalColorId: string | null
  readonly finalPageId: string | null
}

/** Keeps authoring reproducible and renews the seed only for randomized release games. */
export function resolveQuizHuntRunSeed(
  settings: QuizHuntDocument['settings'],
  context: 'authoring' | 'release',
  storedSeed?: number,
): number {
  if (context === 'authoring' || !settings.random) return settings.seed
  if (storedSeed !== undefined) return storedSeed
  const seed = new Uint32Array(1)
  crypto.getRandomValues(seed)
  return seed[0]!
}

/** Resolves all seed-dependent Quiz Hunt selections from the authored banks. */
export function createQuizHuntGameDraw(document: QuizHuntDocument, seed: number): QuizHuntGameDraw {
  const random = createSeededRandom(seed)
  const questionBank = document.chapters.find((chapter) => chapter.type === 'questions')
  const finalBank = document.chapters.find((chapter) => chapter.type === 'finals')
  if (questionBank === undefined || finalBank === undefined) throw new Error('Les deux banques Quiz Hunt sont requises.')

  const trialSlotsByColor = Object.fromEntries(document.settings.groups.map((group) => [
    group.id,
    drawColorSlots(document, questionBank.pageIds, group.id, random),
  ]))
  const finalSlotsByColor = Object.fromEntries(document.settings.groups.map((group) => [
    group.id,
    drawColorSlots(document, finalBank.pageIds, group.id, random),
  ]))
  const activeColorIds = document.settings.groups.flatMap((group) =>
    trialSlotsByColor[group.id]?.some((page) => page !== null) === true
      && finalSlotsByColor[group.id]?.some((page) => page !== null) === true
      ? [group.id]
      : [])
  const activeColorSet = new Set(activeColorIds)
  const drawnTrialIds = Object.entries(trialSlotsByColor).flatMap(([colorId, slots]) =>
    activeColorSet.has(colorId) ? slots.flatMap((page) => page === null ? [] : [page.id]) : [])
  const trialGridOrder = shuffle(drawnTrialIds, random)
  const extraPageId = trialGridOrder.length === 0 ? null : trialGridOrder[Math.floor(random() * trialGridOrder.length)]!
  const extraOffsetMs = Math.round(800 + random() * (2_200 - 800))
  const finalColorId = activeColorIds.length === 0
    ? null
    : activeColorIds[Math.floor(random() * activeColorIds.length)]!
  const finalPages = finalColorId === null
    ? []
    : finalSlotsByColor[finalColorId]?.flatMap((page) => page === null ? [] : [page]) ?? []
  const finalPageId = finalPages.length === 0
    ? null
    : finalPages[Math.floor(random() * finalPages.length)]!.id

  return { seed, trialSlotsByColor, finalSlotsByColor, trialGridOrder, activeColorIds, extraPageId, extraOffsetMs, finalColorId, finalPageId }
}

/** Selects up to four pages, keeping mandatory pages in bank order before filling the slots. */
function drawColorSlots(
  document: QuizHuntDocument,
  bankPageIds: readonly string[],
  colorId: string,
  random: () => number,
): readonly (QuizHuntPage | null)[] {
  const pagesById = new Map(document.pages.map((page) => [page.id, page]))
  const pages = bankPageIds.flatMap((pageId) => {
    const page = pagesById.get(pageId)
    return page?.colorId === colorId ? [page] : []
  })
  const mandatory = pages.filter((page) => page.mandatory).slice(0, QUIZ_HUNT_COLOR_SLOT_COUNT)
  const selectedIds = new Set(mandatory.map((page) => page.id))
  const available = shuffle(pages.filter((page) => !selectedIds.has(page.id)), random)
  const selected = [...mandatory, ...available.slice(0, QUIZ_HUNT_COLOR_SLOT_COUNT - mandatory.length)]
  return [...selected, ...Array.from({ length: QUIZ_HUNT_COLOR_SLOT_COUNT - selected.length }, () => null)]
}

/** Creates the deterministic pseudo-random sequence used by every game draw. */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** Shuffles a copy while preserving the deterministic sequence's consumption order. */
function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex]!, shuffled[index]!]
  }
  return shuffled
}
