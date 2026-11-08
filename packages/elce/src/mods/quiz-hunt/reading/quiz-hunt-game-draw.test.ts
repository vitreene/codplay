import { describe, expect, it } from 'vitest'
import { QuizHuntDocumentService } from '../document/quiz-hunt-document-service'
import { createQuizHuntGameDraw, resolveQuizHuntRunSeed } from './quiz-hunt-game-draw'

describe('Quiz Hunt game draw', () => {
  it('reproduces a seeded draw for the same authoring seed', () => {
    const documents = new QuizHuntDocumentService()
    const initial = documents.createInitialDocument()
    const questionBank = initial.chapters.find((chapter) => chapter.type === 'questions')!
    const finalBank = initial.chapters.find((chapter) => chapter.type === 'finals')!
    const group = initial.settings.groups[0]!
    const withTrialColor = documents.setPageColor(
      initial,
      initial.pages.find((page) => page.chapterId === questionBank.id)!.id,
      group.id,
    )
    const withFinalPage = documents.createPage(withTrialColor, finalBank.id, 'Finale rouge')
    const authored = documents.setPageColor(withFinalPage, withFinalPage.pages.at(-1)!.id, group.id)

    const firstDraw = createQuizHuntGameDraw(authored, authored.settings.seed)

    expect(createQuizHuntGameDraw(authored, authored.settings.seed)).toEqual(firstDraw)
  })

  it('uses the authored seed in editing and renews randomized release runs', () => {
    const documents = new QuizHuntDocumentService()
    const authored = documents.createInitialDocument()
    const randomized = documents.updateSettings(authored, { random: true, seed: 37 })
    const fixed = documents.updateSettings(randomized, { random: false })

    expect(resolveQuizHuntRunSeed(randomized.settings, 'authoring')).toBe(37)
    expect(resolveQuizHuntRunSeed(randomized.settings, 'release', 123)).toBe(123)
    expect(resolveQuizHuntRunSeed(randomized.settings, 'release')).not.toBe(
      resolveQuizHuntRunSeed(randomized.settings, 'release'),
    )
    expect(resolveQuizHuntRunSeed(fixed.settings, 'release', 123)).toBe(37)
  })

  it('keeps the first four mandatory questions when the author marks more than the slot capacity', () => {
    const documents = new QuizHuntDocumentService()
    const initial = documents.createInitialDocument()
    const questionBank = initial.chapters.find((chapter) => chapter.type === 'questions')!
    const group = initial.settings.groups[0]!
    const authored = Array.from({ length: 6 }).reduce<typeof initial>((document, _, index) => {
      const created = documents.createPage(document, questionBank.id, `Trial ${index + 1}`)
      const colored = documents.setPageColor(created, created.pages.at(-1)!.id, group.id)
      return documents.setMandatory(colored, colored.pages.at(-1)!.id, true)
    }, initial)
    const expectedIds = authored.pages
      .filter((page) => page.chapterId === questionBank.id && page.colorId === group.id && page.mandatory)
      .map((page) => page.id)
      .slice(0, 4)

    const draw = createQuizHuntGameDraw(authored, authored.settings.seed)

    expect(draw.trialSlotsByColor[group.id]?.flatMap((page) => page === null ? [] : [page.id])).toEqual(expectedIds)
  })

  it('keeps the configured extra trigger in the draw across seeds', () => {
    const documents = new QuizHuntDocumentService()
    const initial = documents.createInitialDocument()
    const questionBank = initial.chapters.find((chapter) => chapter.type === 'questions')!
    const finalBank = initial.chapters.find((chapter) => chapter.type === 'finals')!
    const group = initial.settings.groups[0]!
    const firstTrial = initial.pages.find((page) => page.chapterId === questionBank.id)!
    let authored = documents.setPageColor(initial, firstTrial.id, group.id)
    authored = documents.setMandatory(authored, firstTrial.id, true)
    const trials = Array.from({ length: 5 }).reduce<typeof authored>((document, _, index) => {
      const withTrial = documents.createPage(document, questionBank.id, `Trial ${index + 1}`)
      return documents.setPageColor(withTrial, withTrial.pages.at(-1)!.id, group.id)
    }, authored)
    const targetPage = trials.pages.at(-1)!
    const withFinal = documents.createPage(trials, finalBank.id, 'Finale rouge')
    const withFinalColor = documents.setPageColor(withFinal, withFinal.pages.at(-1)!.id, group.id)
    const drawSeeds = Array.from({ length: 20 }, (_, index) => index + 1)

    expect(drawSeeds.some((seed) => !createQuizHuntGameDraw(withFinalColor, seed).trialGridOrder.includes(targetPage.id))).toBe(true)

    const configured = documents.updateSettings(withFinalColor, { extraTriggerPageId: targetPage.id })
    drawSeeds.forEach((seed) => {
      const draw = createQuizHuntGameDraw(configured, seed)
      const trialSlots = draw.trialSlotsByColor[group.id]?.flatMap((page) => page === null ? [] : [page.id]) ?? []
      expect(draw.extraPageId).toBe(targetPage.id)
      expect(trialSlots).toContain(targetPage.id)
      expect(trialSlots).toContain(firstTrial.id)
    })
  })

  it('clears the configured trigger when author edits remove its playable color', () => {
    const documents = new QuizHuntDocumentService()
    const initial = documents.createInitialDocument()
    const questionBank = initial.chapters.find((chapter) => chapter.type === 'questions')!
    const finalBank = initial.chapters.find((chapter) => chapter.type === 'finals')!
    const group = initial.settings.groups[0]!
    const trial = initial.pages.find((page) => page.chapterId === questionBank.id)!
    const withTrial = documents.setPageColor(initial, trial.id, group.id)
    const withFinal = documents.createPage(withTrial, finalBank.id, 'Finale rouge')
    const withFinalColor = documents.setPageColor(withFinal, withFinal.pages.at(-1)!.id, group.id)
    const configured = documents.updateSettings(withFinalColor, { extraTriggerPageId: trial.id })

    expect(documents.removeGroup(configured, group.id).settings.extraTriggerPageId).toBeNull()
  })
})
