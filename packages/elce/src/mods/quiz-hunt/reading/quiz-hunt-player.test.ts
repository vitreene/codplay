/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuizHuntDocumentService } from '../document/quiz-hunt-document-service'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { SECTION_BDC_TYPE } from '../../../resources/bdcs/section/section-config'
import { QuizHuntPlayer } from './quiz-hunt-player'
import { createQuizHuntGameCatalog } from './quiz-hunt-game-catalog'
import { QUIZ_HUNT_EXTRA_RETRY_HIDE_DURATION_MS } from './quiz-hunt-layout-scene'
import { createEmptyRichTextDocument } from '../../../resources/bdcs/section/domain/section-service'
import type { QuizHuntSavedGameState } from '../persistence/quiz-hunt-game-state-persistence'

type RuntimeHarness = Readonly<{
  api: Readonly<{
    dispatch: (event: Readonly<{ name: string; sourceSceneKey?: string; data?: Readonly<Record<string, unknown>> }>) => Promise<boolean>
    events: Readonly<{
      onEvent: (listener: (event: Readonly<{ name: string; sourceSceneKey?: string; data?: unknown }>) => void) => () => void
    }>
    scenarioState: Readonly<{
      current: readonly Readonly<{ slotName: string; sceneKey: string }>[]
      context: Readonly<Record<string, unknown>>
    }>
  }>
}>

/** Supplies the browser observer API used by Flux in jsdom. */
class TestIntersectionObserver implements IntersectionObserver {
  public readonly root: Element | Document | null = null
  public readonly rootMargin = '0px'
  public readonly scrollMargin = '0px'
  public readonly thresholds: readonly number[] = []

  public constructor(_callback: IntersectionObserverCallback) {}
  public observe(_target: Element): void {}
  public unobserve(_target: Element): void {}
  public disconnect(): void {}
  public takeRecords(): IntersectionObserverEntry[] { return [] }
}

/** Runs pending CodPlay frames once so the real Sighty event queue can settle. */
function flushPendingFrames(pendingFrames: FrameRequestCallback[], timestamp: number): void {
  const callbacks = pendingFrames.splice(0)
  callbacks.forEach((callback) => callback(timestamp))
}

/** Gives CodPlay and Sighty several real task turns to apply scene events. */
async function flushPlayer(pendingFrames: FrameRequestCallback[]): Promise<void> {
  for (let pass = 0; pass < 4; pass += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    flushPendingFrames(pendingFrames, Date.now())
  }
}

/** Installs missing browser APIs needed by the real CodPlay runtime under jsdom. */
function installBrowserTestAdapters(pendingFrames: FrameRequestCallback[]): void {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pendingFrames.push(callback)
    return pendingFrames.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)
}

/** Replaces pointer coordinates with a stable DOM hit-test result for jsdom. */
function installElementHitTest(target: Element): () => void {
  const original = Object.getOwnPropertyDescriptor(document, 'elementsFromPoint')
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: () => [target],
  })
  return () => {
    if (original === undefined) Reflect.deleteProperty(document, 'elementsFromPoint')
    else Object.defineProperty(document, 'elementsFromPoint', original)
  }
}

/** Dispatches a bubbling pointer event with the coordinates read by Quiz Hunt's drop host. */
function dispatchPointerEvent(target: Element, type: 'pointerdown' | 'pointerup'): void {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: 7 },
    clientX: { value: 12 },
    clientY: { value: 24 },
    movementX: { value: 0 },
    movementY: { value: 0 },
  })
  target.dispatchEvent(event)
}

/** Finds one native answer input inside the page that owns the Question. */
function questionAnswerInput(stage: HTMLElement, pageId: string, answerId: string | undefined) {
  return Array.from(stage.querySelectorAll<HTMLInputElement>(`#${pageId}-article .elce-card--question input`))
    .find((input) => input.value === answerId)
}

/** Finds the validation button inside the page that owns the Question. */
function questionValidationButton(stage: HTMLElement, pageId: string) {
  return stage.querySelector<HTMLButtonElement>(`#${pageId}-article .elce-question-validate`)
}

/** Creates one playable trial and finale while leaving other colors as empty slots. */
function createPlayableDocument(): QuizHuntDocument {
  const documents = new QuizHuntDocumentService()
  const initial = documents.createInitialDocument('quiz-hunt-runtime-test')
  const questionBank = initial.chapters.find((chapter) => chapter.type === 'questions')!
  const finalBank = initial.chapters.find((chapter) => chapter.type === 'finals')!
  const group = initial.settings.groups[0]!
  const trialPage = initial.pages.find((page) => page.chapterId === questionBank.id)!
  const finale = documents.createPage(initial, finalBank.id, 'Finale rouge')
  const finalPage = finale.pages.find((page) => page.chapterId === finalBank.id)!
  const playable = documents.setPageColor(
    documents.setPageColor(finale, trialPage.id, group.id),
    finalPage.id,
    group.id,
  )
  return documents.updateSettings(playable, {
    seed: 1,
    random: false,
    timeBudgetMs: 60_000,
    clueDelayMs: 0,
    feedbackDelayMs: 250,
    extraEnabled: false,
    extraTriggerPageId: null,
    authoringGridDebug: false,
  })
}

describe('Quiz Hunt real reading runtime', () => {
  let player: QuizHuntPlayer | undefined
  let pendingFrames: FrameRequestCallback[] = []
  let restoreElementHitTest: (() => void) | undefined

  afterEach(async () => {
    restoreElementHitTest?.()
    restoreElementHitTest = undefined
    player?.destroy()
    player = undefined
    pendingFrames = []
    document.body.replaceChildren()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('plays a trial, updates the basket, runs the finale, and resets from the result scene', async () => {
    installBrowserTestAdapters(pendingFrames)
    const authored = createPlayableDocument()
    const game = createQuizHuntGameCatalog(authored, 'authoring')
    const trial = game.trials[0]
    const final = game.finals.find((candidate) => candidate.page.id === game.finalPageId)
    if (trial === undefined || final === undefined) throw new Error('Playable Quiz Hunt fixture is incomplete.')
    const stage = document.createElement('div')
    document.body.append(stage)
    const playerLogs: string[] = []
    player = new QuizHuntPlayer({ stage, document: authored, context: 'authoring', onLog: (message) => playerLogs.push(message) })

    await player.initialize()
    await flushPlayer(pendingFrames)
    const runtime = (player as unknown as { runtime: RuntimeHarness }).runtime.api
    const observedEvents: { name: string; sourceSceneKey?: string; data?: unknown }[] = []
    runtime.events.onEvent((event) => observedEvents.push(event))

    expect(stage.querySelector('.quiz-hunt-layout')).not.toBeNull()
    expect(stage.querySelectorAll('.quiz-hunt-grid-tile')).toHaveLength(16)
    expect(stage.querySelectorAll('.quiz-hunt-grid-tile:disabled')).toHaveLength(15)
    expect(stage.querySelector('.quiz-hunt-final-button')?.hasAttribute('disabled')).toBe(true)

    stage.querySelector<HTMLButtonElement>(`[data-quiz-hunt-page-id="${trial.page.id}"]`)?.click()
    await flushPlayer(pendingFrames)
    const trialQuestion = trial.questionBdc.question
    const correctTrialAnswer = trialQuestion?.answers.find((answer) => answer.correct)
    const trialAnswer = questionAnswerInput(stage, trial.page.id, correctTrialAnswer?.id)
    const trialValidate = questionValidationButton(stage, trial.page.id)
    expect(trialAnswer).not.toBeNull()
    expect(trialValidate).not.toBeNull()
    trialAnswer?.click()
    await flushPlayer(pendingFrames)
    trialValidate?.click()
    await flushPlayer(pendingFrames)
    expect(stage.querySelector('.elce-question-feedback')?.textContent).toContain('Bonne réponse')
    expect(observedEvents).toContainEqual(expect.objectContaining({
      name: 'elce:question:answered',
      sourceSceneKey: `scene-page-${trial.page.id}`,
      data: expect.objectContaining({ pageId: trial.page.id, isCorrect: true }),
    }))

    await new Promise<void>((resolve) => setTimeout(resolve, 275))
    await flushPlayer(pendingFrames)
    expect(runtime.scenarioState.context.game).toMatchObject({ screen: 'menu', trialStatus: { [trial.page.id]: 'success' } })
    expect(player.getCurrentPageId()).toBe(authored.pages.find((page) => page.type === 'summary')?.id)
    expect(stage.querySelector('.quiz-hunt-basket-slot')?.textContent).toContain(trial.page.name)
    expect(playerLogs).toEqual(['Joueur Quiz Hunt initialisé.'])
    const finalButton = stage.querySelector<HTMLButtonElement>('.quiz-hunt-final-button')
    expect(finalButton?.disabled).toBe(false)
    finalButton?.click()
    await flushPlayer(pendingFrames)
    expect(observedEvents).toContainEqual(expect.objectContaining({
      name: 'quiz-hunt:final:open',
      sourceSceneKey: 'scene-basket',
    }))
    expect(player.getCurrentPageId()).toBe(final.page.id)

    const finalQuestion = final.questionBdc.question
    const incorrectFinalAnswer = finalQuestion?.answers.find((answer) => !answer.correct)
    const finalAnswer = questionAnswerInput(stage, final.page.id, incorrectFinalAnswer?.id)
    const finalValidate = questionValidationButton(stage, final.page.id)
    expect(finalAnswer).not.toBeNull()
    expect(finalValidate).not.toBeNull()
    finalAnswer?.click()
    await flushPlayer(pendingFrames)
    finalValidate?.click()
    await flushPlayer(pendingFrames)
    expect(stage.querySelector('.elce-question-feedback')?.textContent).toContain('Réponse incorrecte')

    await new Promise<void>((resolve) => setTimeout(resolve, 275))
    await flushPlayer(pendingFrames)
    expect(stage.querySelector('#quiz-hunt-result-failure-root')?.hasAttribute('hidden')).toBe(false)
    expect(player.getCurrentPageId()).toBe(authored.pages.find((page) => page.type === 'summary')?.id)

    stage.querySelector<HTMLButtonElement>('#quiz-hunt-result-failure-restart-host .quiz-hunt-result-restart')?.click()
    await new Promise<void>((resolve) => setTimeout(resolve, 75))
    await flushPlayer(pendingFrames)
    const resetRuntime = (player as unknown as { runtime: RuntimeHarness }).runtime.api
    expect(resetRuntime.scenarioState.context.game).toMatchObject({ screen: 'menu', basket: { [trial.colorId]: null } })
    expect(stage.querySelector('.quiz-hunt-basket-slot')?.textContent).toBe('—')
    expect(stage.querySelector('.quiz-hunt-final-button')?.hasAttribute('disabled')).toBe(true)
    expect(player.getCurrentPageId()).toBe(authored.pages.find((page) => page.type === 'summary')?.id)
  })

  it('renders a shared Section in a bank page through the real Quiz Hunt reader', async () => {
    installBrowserTestAdapters(pendingFrames)
    const documents = new QuizHuntDocumentService()
    const initial = createPlayableDocument()
    const page = initial.pages.find((candidate) => candidate.type === 'flux')
    if (page === undefined) throw new Error('The Quiz Hunt reader fixture has no bank page.')
    const withSection = documents.addSection(initial, page.id, page.bdcIds.length)
    const sectionBdc = withSection.bdcs.find((bdc) => bdc.type === SECTION_BDC_TYPE)
    if (sectionBdc?.section == null) throw new Error('The Quiz Hunt Section fixture has no content.')
    const authored = documents.updateSection(withSection, sectionBdc.id, {
      ...sectionBdc.section,
      title: 'Indice partagé',
      markup: '<p id="quiz-hunt-section-text">Texte du bloc partagé</p>',
      content: {
        ...createEmptyRichTextDocument(),
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texte du bloc partagé' }] }],
      },
    })
    const trial = createQuizHuntGameCatalog(authored, 'authoring').trials[0]
    if (trial === undefined) throw new Error('The Quiz Hunt reader fixture has no playable Question.')
    const stage = document.createElement('div')
    document.body.append(stage)
    player = new QuizHuntPlayer({ stage, document: authored, context: 'authoring' })

    await player.initialize()
    await flushPlayer(pendingFrames)
    stage.querySelector<HTMLButtonElement>(`[data-quiz-hunt-page-id="${trial.page.id}"]`)?.click()
    await flushPlayer(pendingFrames)

    expect(stage.querySelector('.elce-card--section')?.textContent).toContain('Texte du bloc partagé')
  })

  it('defers an actual scenario timeout until the required answer feedback finishes', async () => {
    installBrowserTestAdapters(pendingFrames)
    const documents = new QuizHuntDocumentService()
    const authored = documents.updateSettings(createPlayableDocument(), {
      timeBudgetMs: 1_200,
      feedbackDelayMs: 600,
    })
    const trial = createQuizHuntGameCatalog(authored, 'authoring').trials[0]
    if (trial === undefined) throw new Error('Playable Quiz Hunt fixture is incomplete.')
    const stage = document.createElement('div')
    document.body.append(stage)
    player = new QuizHuntPlayer({ stage, document: authored, context: 'authoring' })

    await player.initialize()
    await flushPlayer(pendingFrames)
    const runtime = (player as unknown as { runtime: RuntimeHarness }).runtime.api
    const observedEvents: { name: string; sourceSceneKey?: string; data?: unknown }[] = []
    runtime.events.onEvent((event) => observedEvents.push(event))
    stage.querySelector<HTMLButtonElement>(`[data-quiz-hunt-page-id="${trial.page.id}"]`)?.click()
    await flushPlayer(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 650))
    await flushPlayer(pendingFrames)
    expect(runtime.scenarioState.context.game).toMatchObject({ screen: 'trial', outcome: null })

    const incorrectAnswer = trial.questionBdc.question?.answers.find((answer) => !answer.correct)
    const answerInput = questionAnswerInput(stage, trial.page.id, incorrectAnswer?.id)
    const validate = questionValidationButton(stage, trial.page.id)
    answerInput?.click()
    await flushPlayer(pendingFrames)
    validate?.click()
    await flushPlayer(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 250))
    await flushPlayer(pendingFrames)
    expect(runtime.scenarioState.context.game).toMatchObject({ pendingTimerExpiry: true, outcome: null })
    expect(observedEvents).toContainEqual(expect.objectContaining({
      name: 'quiz-hunt:timer:expired-during-feedback',
      sourceSceneKey: 'scene-basket',
      data: expect.objectContaining({ feedbackPending: true }),
    }))

    await new Promise<void>((resolve) => setTimeout(resolve, 300))
    await flushPlayer(pendingFrames)
    expect(runtime.scenarioState.context.game).toMatchObject({ screen: 'result', outcome: 'failure', pendingTimerExpiry: false })
    expect(stage.querySelector('#quiz-hunt-result-failure-root')?.hasAttribute('hidden')).toBe(false)
  })

  it('collects the offered extra and retries a failed trial through the layout drop path', async () => {
    installBrowserTestAdapters(pendingFrames)
    const documents = new QuizHuntDocumentService()
    const base = createPlayableDocument()
    const triggerPageId = base.pages.find((page) => page.chapterId !== null)!.id
    const authored = Array.from({ length: 128 }, (_unused, index) => documents.updateSettings(base, {
      seed: index + 1,
      extraEnabled: true,
      extraTriggerPageId: triggerPageId,
      feedbackDelayMs: 100,
    })).find((candidate) => createQuizHuntGameCatalog(candidate, 'authoring').extraOffsetMs < 900)
    if (authored === undefined) throw new Error('No bounded Quiz Hunt seed was available for the extra acceptance fixture.')
    const game = createQuizHuntGameCatalog(authored, 'authoring')
    const trial = game.trials.find((candidate) => candidate.page.id === game.extraPageId)
    if (trial === undefined) throw new Error('The extra acceptance fixture must draw its trial page.')
    const stage = document.createElement('div')
    document.body.append(stage)
    player = new QuizHuntPlayer({ stage, document: authored, context: 'authoring' })

    await player.initialize()
    await flushPlayer(pendingFrames)
    const runtime = (player as unknown as { runtime: RuntimeHarness }).runtime.api
    const observedEvents: { name: string; sourceSceneKey?: string; data?: unknown }[] = []
    runtime.events.onEvent((event) => observedEvents.push(event))
    stage.querySelector<HTMLButtonElement>(`[data-quiz-hunt-page-id="${trial.page.id}"]`)?.click()
    await flushPlayer(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, game.extraOffsetMs + 100))
    await flushPlayer(pendingFrames)

    const extraToken = stage.querySelector<HTMLButtonElement>('.quiz-hunt-extra-token')
    expect(extraToken?.classList.contains('is-visible')).toBe(true)
    extraToken?.click()
    await flushPlayer(pendingFrames)
    expect(runtime.scenarioState.context.game).toMatchObject({ extraAvailable: true, extraOfferedOn: trial.page.id })
    expect(observedEvents).toContainEqual(expect.objectContaining({ name: 'quiz-hunt:extra:collect' }))

    const incorrectAnswer = trial.questionBdc.question?.answers.find((answer) => !answer.correct)
    const answerInput = questionAnswerInput(stage, trial.page.id, incorrectAnswer?.id)
    const validate = questionValidationButton(stage, trial.page.id)
    answerInput?.click()
    await flushPlayer(pendingFrames)
    validate?.click()
    await flushPlayer(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 150))
    await flushPlayer(pendingFrames)
    expect(runtime.scenarioState.context.game).toMatchObject({ screen: 'menu', trialStatus: { [trial.page.id]: 'failed' }, extraAvailable: true })

    const failedTile = stage.querySelector<HTMLButtonElement>(`[data-quiz-hunt-page-id="${trial.page.id}"]`)
    expect(failedTile).not.toBeNull()
    if (failedTile === null || extraToken === null) throw new Error('The failed trial or collected token is missing from the extra retry fixture.')
    restoreElementHitTest = installElementHitTest(failedTile)
    dispatchPointerEvent(extraToken, 'pointerdown')
    await flushPlayer(pendingFrames)
    dispatchPointerEvent(failedTile, 'pointerup')
    await flushPlayer(pendingFrames)
    expect(extraToken.classList.contains('is-hiding')).toBe(true)

    await new Promise<void>((resolve) => setTimeout(resolve, QUIZ_HUNT_EXTRA_RETRY_HIDE_DURATION_MS + 100))
    await flushPlayer(pendingFrames)
    expect(player.getCurrentPageId()).toBe(trial.page.id)
    expect(runtime.scenarioState.context.game).toMatchObject({
      screen: 'trial',
      activeTrialId: trial.page.id,
      trialStatus: { [trial.page.id]: 'available' },
      extraAvailable: false,
    })

    const correctAnswer = trial.questionBdc.question?.answers.find((answer) => answer.correct)
    const retryAnswer = questionAnswerInput(stage, trial.page.id, correctAnswer?.id)
    const retryValidate = questionValidationButton(stage, trial.page.id)
    expect(retryAnswer).not.toBeNull()
    expect(retryValidate).not.toBeNull()
    retryAnswer?.click()
    await flushPlayer(pendingFrames)
    expect(retryValidate?.disabled).toBe(false)
    retryValidate?.click()
    await flushPlayer(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 150))
    await flushPlayer(pendingFrames)
    expect(runtime.scenarioState.context.game).toMatchObject({ screen: 'menu', trialStatus: { [trial.page.id]: 'success' } })
  })

  it('resumes a release game without replaying a resolved trial and resets the persisted run', async () => {
    installBrowserTestAdapters(pendingFrames)
    const documents = new QuizHuntDocumentService()
    const authored = documents.updateSettings(createPlayableDocument(), { random: true, feedbackDelayMs: 100 })
    const savedRuns = new Map<string, QuizHuntSavedGameState>()
    const persistence = {
      readGameState: async (projectId: string) => savedRuns.get(projectId) ?? null,
      saveGameState: async (projectId: string, value: QuizHuntSavedGameState) => {
        savedRuns.set(projectId, value)
        return true
      },
      clearGameState: async (projectId: string) => savedRuns.delete(projectId),
    }

    const firstStage = document.createElement('div')
    document.body.append(firstStage)
    player = new QuizHuntPlayer({
      stage: firstStage,
      document: authored,
      context: 'release',
      gameStatePersistence: persistence,
    })
    await player.initialize()
    await flushPlayer(pendingFrames)
    const firstTrialButton = Array.from(firstStage.querySelectorAll<HTMLButtonElement>('.quiz-hunt-grid-tile'))
      .find((button) => !button.disabled)
    expect(firstTrialButton).toBeDefined()
    firstTrialButton?.click()
    await flushPlayer(pendingFrames)
    const firstRuntime = (player as unknown as { runtime: RuntimeHarness }).runtime.api
    const firstRun = await persistence.readGameState(authored.id)
    expect(firstRun).not.toBeNull()
    if (firstRun === null) throw new Error('The release player did not save its run after trial entry.')
    const game = createQuizHuntGameCatalog(authored, 'release', firstRun.seed)
    const trial = game.trials[0]
    if (trial === undefined) throw new Error('The release fixture must draw a trial.')
    expect(firstTrialButton?.dataset.quizHuntPageId).toBe(trial.page.id)

    firstStage.querySelector<HTMLButtonElement>(`[data-quiz-hunt-page-id="${trial.page.id}"]`)?.click()
    await flushPlayer(pendingFrames)
    const correctTrialAnswer = trial.questionBdc.question?.answers.find((answer) => answer.correct)
    const trialAnswer = questionAnswerInput(firstStage, trial.page.id, correctTrialAnswer?.id)
    const trialValidate = questionValidationButton(firstStage, trial.page.id)
    expect(trialAnswer).not.toBeNull()
    expect(trialValidate).not.toBeNull()
    trialAnswer?.click()
    await flushPlayer(pendingFrames)
    expect(trialValidate?.disabled).toBe(false)
    trialValidate?.click()
    await flushPlayer(pendingFrames)
    await new Promise<void>((resolve) => setTimeout(resolve, 150))
    await flushPlayer(pendingFrames)
    expect(firstRuntime.scenarioState.context.game).toMatchObject({
      screen: 'menu',
      trialStatus: { [trial.page.id]: 'success' },
      basket: { [trial.colorId]: trial.page.id },
    })

    const savedRun = await persistence.readGameState(authored.id)
    if (savedRun === null) throw new Error('The release answer was not saved.')
    const savedState = savedRun.state as Readonly<{
      trialStatus: Readonly<Record<string, string>>
      basket: Readonly<Record<string, string | null>>
      timerRemainingMs: number
      timerStartedAtMs: number | null
    }>
    expect(savedState.timerStartedAtMs).not.toBeNull()
    player.destroy()
    player = undefined
    document.body.replaceChildren()

    const resumedStage = document.createElement('div')
    document.body.append(resumedStage)
    player = new QuizHuntPlayer({
      stage: resumedStage,
      document: authored,
      context: 'release',
      gameStatePersistence: persistence,
    })
    await player.initialize()
    await flushPlayer(pendingFrames)
    const resumedRuntime = (player as unknown as { runtime: RuntimeHarness }).runtime.api
    expect(resumedRuntime.scenarioState.context.game).toMatchObject({
      screen: 'menu',
      trialStatus: { [trial.page.id]: 'success' },
      basket: { [trial.colorId]: trial.page.id },
    })
    const resumedState = resumedRuntime.scenarioState.context.game as Readonly<{
      timerRemainingMs: number
      trialStatus: Readonly<Record<string, string>>
      basket: Readonly<Record<string, string | null>>
    }>
    const expectedRemainingMs = Math.max(
      0,
      savedState.timerRemainingMs - Math.max(0, Date.now() - savedState.timerStartedAtMs!),
    )
    expect(Math.abs(resumedState.timerRemainingMs - expectedRemainingMs)).toBeLessThan(300)

    await resumedRuntime.dispatch({
      name: `quiz-hunt:trial:open:${trial.page.id}`,
      sourceSceneKey: 'scene-summary',
      data: { pageId: trial.page.id },
    })
    await flushPlayer(pendingFrames)
    expect(player.getCurrentPageId()).toBe(authored.pages.find((page) => page.type === 'summary')?.id)
    expect(resumedRuntime.scenarioState.context.game).toMatchObject({
      trialStatus: { [trial.page.id]: 'success' },
      basket: { [trial.colorId]: trial.page.id },
    })

    await player.restartGame()
    await flushPlayer(pendingFrames)
    const resetRuntime = (player as unknown as { runtime: RuntimeHarness }).runtime.api
    expect(resetRuntime.scenarioState.context.game).toMatchObject({ screen: 'menu', basket: { [trial.colorId]: null } })
    const resetTrialButton = Array.from(resumedStage.querySelectorAll<HTMLButtonElement>('.quiz-hunt-grid-tile'))
      .find((button) => !button.disabled)
    expect(resetTrialButton).toBeDefined()
    resetTrialButton?.click()
    await flushPlayer(pendingFrames)
    const resetRun = await persistence.readGameState(authored.id)
    expect(resetRun).not.toBeNull()
    expect(resetRun?.seed).not.toBe(savedRun.seed)
    expect(resetRun?.state).toMatchObject({ screen: 'trial', basket: { [trial.colorId]: null }, timerRemainingMs: 60_000 })
  })

  it('resumes a terminal release game at the summary while keeping its outcome', async () => {
    installBrowserTestAdapters(pendingFrames)
    const authored = createPlayableDocument()
    const game = createQuizHuntGameCatalog(authored, 'release', authored.settings.seed)
    const trial = game.trials[0]
    if (trial === undefined) throw new Error('The terminal resume fixture must draw a trial.')
    const savedRuns = new Map<string, QuizHuntSavedGameState>()
    const persistence = {
      readGameState: async (projectId: string) => savedRuns.get(projectId) ?? null,
      saveGameState: async (projectId: string, value: QuizHuntSavedGameState) => {
        savedRuns.set(projectId, value)
        return true
      },
      clearGameState: async (projectId: string) => savedRuns.delete(projectId),
    }
    for (const outcome of ['success', 'failure'] as const) {
      const succeeded = outcome === 'success'
      savedRuns.set(authored.id, {
        seed: game.seed,
        savedAt: Date.now(),
        state: {
          trialStatus: Object.fromEntries(game.trials.map((candidate) => [candidate.page.id, succeeded ? 'success' : 'available'])),
          basket: Object.fromEntries(authored.settings.groups.map((group) => [
            group.id,
            succeeded && group.id === trial.colorId ? trial.page.id : null,
          ])),
          timerRemainingMs: 60_000,
          timerStartedAtMs: null,
          screen: 'result',
          activeTrialId: null,
          activeFinalId: null,
          feedbackPending: null,
          pendingTimerExpiry: false,
          outcome,
          extraOfferedOn: null,
          extraAvailable: false,
        },
      })

      const resumedStage = document.createElement('div')
      document.body.append(resumedStage)
      player = new QuizHuntPlayer({
        stage: resumedStage,
        document: authored,
        context: 'release',
        gameStatePersistence: persistence,
      })
      await player.initialize()
      await flushPlayer(pendingFrames)

      const resumedRuntime = (player as unknown as { runtime: RuntimeHarness }).runtime.api
      expect(player.getCurrentPageId()).toBe(authored.pages.find((page) => page.type === 'summary')?.id)
      expect(resumedRuntime.scenarioState.context.game).toMatchObject({ screen: 'menu', outcome })
      const restoredTrial = resumedStage.querySelector<HTMLButtonElement>(`[data-quiz-hunt-page-id="${trial.page.id}"]`)
      expect(restoredTrial?.textContent).toBe(succeeded ? '✓' : '1')
      expect(restoredTrial?.disabled).toBe(true)
      expect(resumedStage.querySelector<HTMLButtonElement>('.quiz-hunt-final-button')?.disabled).toBe(true)

      player.destroy()
      player = undefined
      document.body.replaceChildren()
    }
  })

  it('keeps an incomplete draw in the authored summary without enabling a game action', async () => {
    installBrowserTestAdapters(pendingFrames)
    const documents = new QuizHuntDocumentService()
    const authored = documents.createInitialDocument('quiz-hunt-incomplete-test')
    const stage = document.createElement('div')
    document.body.append(stage)
    player = new QuizHuntPlayer({ stage, document: authored, context: 'authoring' })

    await player.initialize()
    await flushPlayer(pendingFrames)

    expect(createQuizHuntGameCatalog(authored, 'authoring').activeColorIds).toEqual([])
    expect(stage.querySelector('#quiz-hunt-menu-grid-root')).not.toBeNull()
    expect(stage.querySelector('.quiz-hunt-final-button')).toBeNull()
    expect(Array.from(stage.querySelectorAll<HTMLButtonElement>('.quiz-hunt-grid-tile')).every((tile) => tile.disabled)).toBe(true)
    expect(stage.querySelector('.quiz-hunt-result-page')).toBeNull()
  })
})
