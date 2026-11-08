import type {
  SightyActionContext,
  SightyActionHandler,
  SightyGraphView,
  SightyScenarioDefinition,
  SightySceneSourceValue,
  SightyViewAction,
  SightyViewMap,
} from '@codplay/sighty'
import type { CodPlayEventime } from 'codplay'
import type { QuizHuntDocument, QuizHuntPage } from '../document/quiz-hunt-document-types'
import { QUESTION_EVENTS } from '../../../resources/bdcs/question/question-config'
import { PAGE_FINISHED_EVENT } from '../../../resources/pages/page-completion/page-completion-events'
import { createQuizHuntGameCatalog } from './quiz-hunt-game-catalog'
import type { QuizHuntGameCatalog, QuizHuntGameQuestion } from './quiz-hunt-game-catalog'
import {
  buildQuizHuntPageSceneCatalog,
  findQuizHuntClueVideoBdc,
  quizHuntPageSceneStoryId,
  quizHuntQuestionRevealEvent,
  quizHuntVideoStartEvent,
  QUIZ_HUNT_VIDEO_EVENT,
} from './quiz-hunt-page-scene-catalog'
import { buildQuizHuntSummaryScene } from './quiz-hunt-summary-scene'
import { buildQuizHuntBasketScene, QUIZ_HUNT_BASKET_EVENT } from './quiz-hunt-basket-scene'
import {
  buildQuizHuntLayoutScene,
  QUIZ_HUNT_EXTRA_RETRY_HIDE_DURATION_MS,
  QUIZ_HUNT_LAYOUT_EVENT,
  QUIZ_HUNT_SLOT,
} from './quiz-hunt-layout-scene'
import { buildQuizHuntResultScene } from './quiz-hunt-result-scene'
import type { QuizHuntGameState, QuizHuntGameOutcome, QuizHuntTrialStatus } from './quiz-hunt-game-state-types'
import type { QuizHuntSavedGameState } from '../persistence/quiz-hunt-game-state-persistence'

export type QuizHuntSceneKey = 'scene-layout' | 'scene-summary' | 'scene-basket' | 'scene-result' | `scene-page-${string}`
export type QuizHuntSlotName = typeof QUIZ_HUNT_SLOT[keyof typeof QUIZ_HUNT_SLOT]

export type { QuizHuntGameState } from './quiz-hunt-game-state-types'

export interface QuizHuntScenarioModel {
  readonly game: QuizHuntGameCatalog
  readonly initialContext: Readonly<Record<string, unknown>>
  readonly scenario: SightyScenarioDefinition<QuizHuntSceneKey, QuizHuntSlotName>
}

const ROOT_VIEW = 'quiz-hunt'
const ROOT_CONTENT_PATH = `${ROOT_VIEW}/${QUIZ_HUNT_SLOT.CONTENT}`
const SUMMARY_VIEW = 'summary'
const SUMMARY_PATH = `${ROOT_CONTENT_PATH}/${SUMMARY_VIEW}`
export const QUIZ_HUNT_MENU_PROJECT_EVENT = 'quiz-hunt:menu:project'
const QUESTION_REVEAL_DUE_PREFIX = 'quiz-hunt:question:reveal-due:'
const EXTRA_OFFER_DUE_PREFIX = 'quiz-hunt:extra:offer-due:'
const EXTRA_HIDE_DUE_PREFIX = 'quiz-hunt:extra:hide-due:'
const FEEDBACK_FINISHED_PREFIX = 'quiz-hunt:feedback:finished:'
const FEEDBACK_WAIT_EVENT = 'quiz-hunt:feedback:wait'

type QuizHuntVideoPlaybackStatus = 'pending' | 'playing' | 'paused' | 'ended'
type QuizHuntVideoPlaybackState = Readonly<{
  pageIds: ReadonlySet<string>
  statusByPageId: Map<string, QuizHuntVideoPlaybackStatus>
  revealedPageIds: Set<string>
}>

/** Builds the one Sighty graph from the Quiz Hunt document and its resolved seeded draw. */
export function createQuizHuntScenarioModel(
  document: QuizHuntDocument,
  mediaSources: Readonly<Record<string, string>> = {},
  context: 'authoring' | 'release' = 'authoring',
  startPageId?: string,
  savedRun?: QuizHuntSavedGameState | null,
  persistGameState?: (value: QuizHuntSavedGameState) => Promise<void>,
  loadGameState?: () => Promise<QuizHuntSavedGameState | null>,
  onRestartRequested?: () => void,
): QuizHuntScenarioModel {
  const run = context === 'release' ? savedRun : null
  const game = createQuizHuntGameCatalog(document, context, run?.seed)
  const clueVideoPageIds = new Set(game.trials.flatMap((trial) =>
    findQuizHuntClueVideoBdc(trial.page, document) === undefined ? [] : [trial.page.id],
  ))
  const videoPlayback = {
    pageIds: clueVideoPageIds,
    statusByPageId: new Map<string, 'pending' | 'playing' | 'paused' | 'ended'>(),
    revealedPageIds: new Set<string>(),
  }
  const pageScenes = buildQuizHuntPageSceneCatalog(document, game, mediaSources)
  const summary = buildQuizHuntSummaryScene(document, game)
  const basket = buildQuizHuntBasketScene(document, game)
  const layout = buildQuizHuntLayoutScene()
  const result = buildQuizHuntResultScene(document, mediaSources)
  const summaryPageId = document.pages.find((page) => page.type === 'summary')?.id
  const contentGraph = createContentGraph(
    document,
    game,
    clueVideoPageIds,
    run === null || run === undefined ? startPageId : startPageId ?? summaryPageId,
  )
  const actions = createScenarioActions(document, game, videoPlayback, persistGameState, loadGameState, onRestartRequested)
  const guards = createScenarioGuards(game)

  const scenes: Partial<Record<QuizHuntSceneKey, SightySceneSourceValue>> = {
    'scene-layout': { sceneDoc: layout.sceneDoc, styleSheet: layout.styleSheet },
    'scene-summary': summary,
    'scene-basket': { sceneDoc: basket.sceneDoc, styleSheet: basket.styleSheet },
    'scene-result': { sceneDoc: result.sceneDoc, styleSheet: result.styleSheet },
    ...pageScenes as Readonly<Record<`scene-page-${string}`, SightySceneSourceValue>>,
  }

  return {
    game,
    initialContext: {
      game: run === null || run === undefined
        ? createInitialGameState(document, game)
        : restoreGameState(run.state, document, game),
    },
    scenario: {
      format: 'sighty',
      version: 1,
      id: `${document.id}-quiz-hunt-scenario`,
      views: {
        start: ROOT_VIEW,
        views: {
          [ROOT_VIEW]: {
            entry: { name: 'quiz-hunt:game:initialize' },
            actions: {
              'quiz-hunt:game:initialize': { action: 'action:quiz-hunt:project' },
              ...createRootEventActions(game),
            },
            view: {
              scene: 'scene-layout',
              slots: {
                [QUIZ_HUNT_SLOT.CONTENT]: contentGraph,
                [QUIZ_HUNT_SLOT.BASKET]: {
                  start: 'basket',
                  views: { basket: { showMode: 'maintain', view: { scene: 'scene-basket' } } },
                },
                [QUIZ_HUNT_SLOT.RESULT]: {
                  start: 'result',
                  views: { result: { showMode: 'maintain', view: { scene: 'scene-result' } } },
                },
              },
            },
          },
        },
      },
      scenes,
      actions,
      guards,
    },
  }
}

/** Creates the content map in authored root order and adds only drawn trials as game views. */
function createContentGraph(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
  clueVideoPageIds: ReadonlySet<string>,
  startPageId?: string,
): SightyViewMap<QuizHuntSceneKey, QuizHuntSlotName> {
  const rootPages = document.scenarioEntries.flatMap((entry) => {
    if (entry.kind !== 'page') return []
    const page = document.pages.find((candidate) => candidate.id === entry.pageId)
    return page === undefined ? [] : [page]
  })
  const summary = rootPages.find((page) => page.type === 'summary')
  if (summary === undefined) throw new Error('La page Sommaire doit appartenir aux entrées racine du scénario Quiz Hunt.')

  const rootViews: Record<string, SightyGraphView<QuizHuntSceneKey, QuizHuntSlotName>> = Object.fromEntries(
    rootPages.map((page, index): readonly [string, SightyGraphView<QuizHuntSceneKey, QuizHuntSlotName>] => {
      const viewId = page.type === 'summary' ? SUMMARY_VIEW : pageViewId(page.id)
      const nextPage = rootPages[index + 1]
      const actions: NonNullable<SightyGraphView<QuizHuntSceneKey, QuizHuntSlotName>['actions']> =
        page.type === 'summary' || nextPage === undefined
          ? {}
          : { [PAGE_FINISHED_EVENT]: { go: { path: contentPath(nextPage) } } }
      return [viewId, {
        showMode: 'reset',
        view: { scene: page.type === 'summary' ? 'scene-summary' : `scene-page-${page.id}` },
        actions,
      }]
    }),
  )
  const trialViews = Object.fromEntries(game.trials.flatMap((trial) => [
    [trialViewId(trial.page.id), createTrialView(trial, document, game, clueVideoPageIds)],
    [retryTrialViewId(trial.page.id), createTrialView(trial, document, game, clueVideoPageIds, true)],
  ]))
  const finalQuestion = game.finals.find((candidate) => candidate.page.id === game.finalPageId)
  const finalViews = finalQuestion === undefined
    ? {}
    : { [finalViewId(finalQuestion.page.id)]: createTrialView(finalQuestion, document, game, clueVideoPageIds, false, true) }
  const requestedRootPage = rootPages.find((page) => page.id === startPageId)

  return {
    start: contentViewId(requestedRootPage ?? rootPages[0] ?? summary),
    views: { ...rootViews, ...trialViews, ...finalViews },
  }
}

/** Creates one bank-question route that reveals the shared Question after the clue delay. */
function createTrialView(
  trial: QuizHuntGameQuestion,
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
  clueVideoPageIds: ReadonlySet<string>,
  retry = false,
  isFinal = false,
): SightyGraphView<QuizHuntSceneKey, QuizHuntSlotName> {
  const pageId = trial.page.id
  const videoStartEvents = clueVideoPageIds.has(pageId)
    ? [{ name: quizHuntVideoStartEvent(pageId), startAt: 0, visibility: 'story' as const, data: { pageId } }]
    : []
  const extraEvents = !retry && !isFinal && document.settings.extraEnabled && pageId === game.extraPageId
    ? [
      { name: extraOfferDueEvent(pageId), startAt: game.extraOffsetMs, visibility: 'public' as const, data: { pageId } },
      { name: extraHideDueEvent(pageId), startAt: game.extraOffsetMs + 3_000, visibility: 'public' as const, data: { pageId } },
    ]
    : []
  const entry: CodPlayEventime = {
    name: `${isFinal ? 'quiz-hunt:final' : 'quiz-hunt:trial'}:enter:${pageId}`,
    events: [
      { name: quizHuntQuestionRevealEvent(pageId), startAt: retry ? 0 : document.settings.clueDelayMs, visibility: 'story' },
      { name: questionRevealDueEvent(pageId), startAt: retry ? 0 : document.settings.clueDelayMs, visibility: 'public', data: { pageId } },
      ...videoStartEvents,
      ...extraEvents,
    ],
  }
  return {
    showMode: 'reset',
    accessBy: isFinal
      ? 'guard:quiz-hunt:final-access'
      : retry ? 'guard:quiz-hunt:retry-access' : 'guard:quiz-hunt:trial-access',
    onDenied: { path: SUMMARY_PATH },
    entry,
    view: { scene: `scene-page-${pageId}` },
  }
}

/** Creates actions for the root sequence, gameplay loop, timer, and result overlay. */
function createRootEventActions(
  game: QuizHuntGameCatalog,
): Readonly<Record<string, SightyViewAction<QuizHuntSceneKey, QuizHuntSlotName>>> {
  return {
    [QUESTION_EVENTS.ANSWERED]: { action: 'action:quiz-hunt:record-answer' },
    [QUIZ_HUNT_VIDEO_EVENT.PLAY]: { action: 'action:quiz-hunt:video-playback' },
    [QUIZ_HUNT_VIDEO_EVENT.PAUSE]: { action: 'action:quiz-hunt:video-playback' },
    [QUIZ_HUNT_VIDEO_EVENT.ENDED]: { action: 'action:quiz-hunt:video-playback' },
    [QUIZ_HUNT_BASKET_EVENT.TIMER_PAUSED]: { action: 'action:quiz-hunt:record-timer' },
    [QUIZ_HUNT_BASKET_EVENT.TIMER_CHECK]: { action: 'action:quiz-hunt:check-timer' },
    [QUIZ_HUNT_BASKET_EVENT.TIMER_EXPIRED]: {
      go: { path: SUMMARY_PATH },
      action: 'action:quiz-hunt:timer-expired',
    },
    [QUIZ_HUNT_BASKET_EVENT.TIMER_EXPIRED_DURING_FEEDBACK]: { action: 'action:quiz-hunt:defer-expiry' },
    ...Object.fromEntries(game.trials.map((trial) => [questionRevealDueEvent(trial.page.id), {
      action: 'action:quiz-hunt:start-timer',
    }])),
    ...(game.finalPageId === null ? {} : {
      [questionRevealDueEvent(game.finalPageId)]: { action: 'action:quiz-hunt:start-timer' },
      'quiz-hunt:final:open': {
        go: { path: `${ROOT_CONTENT_PATH}/${finalViewId(game.finalPageId)}` },
        action: 'action:quiz-hunt:enter-final',
      },
      [feedbackFinishedEvent(game.finalPageId)]: {
        go: { path: SUMMARY_PATH },
        action: 'action:quiz-hunt:finish-feedback',
      },
    }),
    ...Object.fromEntries(game.trials.map((trial) => [extraOfferDueEvent(trial.page.id), {
      action: 'action:quiz-hunt:offer-extra',
    }])),
    ...Object.fromEntries(game.trials.map((trial) => [extraHideDueEvent(trial.page.id), {
      action: 'action:quiz-hunt:hide-extra',
    }])),
    [QUIZ_HUNT_LAYOUT_EVENT.EXTRA_COLLECT]: { action: 'action:quiz-hunt:collect-extra' },
    [QUIZ_HUNT_LAYOUT_EVENT.EXTRA_DROP_TARGET]: { action: 'action:quiz-hunt:drop-extra-target' },
    ['quiz-hunt:game:restart']: { action: 'action:quiz-hunt:restart' },
    ['quiz-hunt:result:return']: { go: { path: SUMMARY_PATH }, action: 'action:quiz-hunt:return-to-summary' },
    ...Object.fromEntries(game.trials.map((trial) => [openTrialEvent(trial.page.id), {
      go: { path: `${ROOT_CONTENT_PATH}/${trialViewId(trial.page.id)}` },
      action: 'action:quiz-hunt:enter-trial',
    }])),
    ...Object.fromEntries(game.trials.map((trial) => [retryTrialReadyEvent(trial.page.id), {
      go: { path: `${ROOT_CONTENT_PATH}/${retryTrialViewId(trial.page.id)}` },
      action: 'action:quiz-hunt:enter-trial',
    }])),
    ...Object.fromEntries(game.trials.map((trial) => [feedbackFinishedEvent(trial.page.id), {
      go: { path: SUMMARY_PATH },
      action: 'action:quiz-hunt:finish-feedback',
    }])),
    [QUIZ_HUNT_MENU_PROJECT_EVENT]: { action: 'action:quiz-hunt:project' },
  }
}

/** Creates Sighty actions that alone change game-wide state and project it into resource scenes. */
function createScenarioActions(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
  videoPlayback: QuizHuntVideoPlaybackState,
  persistGameState?: (value: QuizHuntSavedGameState) => Promise<void>,
  loadGameState?: () => Promise<QuizHuntSavedGameState | null>,
  onRestartRequested?: () => void,
): NonNullable<SightyScenarioDefinition<QuizHuntSceneKey, QuizHuntSlotName>['actions']> {
  const actions: NonNullable<SightyScenarioDefinition<QuizHuntSceneKey, QuizHuntSlotName>['actions']> = {
    'action:quiz-hunt:project': async ({ context, updateContext, send }) => {
      const savedRun = await loadGameState?.()
      const isResume = savedRun?.seed === game.seed
      const state = isResume
        ? restoreGameState(savedRun.state, document, game)
        : readGameState(context.game, document, game)
      if (isResume) await updateContext({ game: state })
      await projectGame(state, game, send)
      await send('scene-basket', {
        name: QUIZ_HUNT_BASKET_EVENT.TIMER_PROJECT,
        data: { remainingMs: state.timerRemainingMs },
      }, { scope: 'story', storyId: 'main' })
      if (state.screen === 'result' && state.outcome !== null) await showResult(send, state.outcome, state, document)
      if (!isResume) await persistGameState?.({ seed: game.seed, state, savedAt: Date.now() })
    },
    'action:quiz-hunt:enter-trial': createEnterTrialAction(document, game, videoPlayback),
    'action:quiz-hunt:enter-final': createEnterFinalAction(document, game),
    'action:quiz-hunt:record-answer': createRecordAnswerAction(document, game, videoPlayback),
    'action:quiz-hunt:video-playback': createVideoPlaybackAction(document, game, videoPlayback),
    'action:quiz-hunt:start-timer': createStartTimerAction(document, game, videoPlayback),
    'action:quiz-hunt:record-timer': createRecordTimerAction(document, game),
    'action:quiz-hunt:check-timer': createCheckTimerAction(),
    'action:quiz-hunt:finish-feedback': createFinishFeedbackAction(document, game),
    'action:quiz-hunt:timer-expired': createTimerExpiredAction(document, game),
    'action:quiz-hunt:defer-expiry': createDeferExpiryAction(document, game),
    'action:quiz-hunt:offer-extra': createOfferExtraAction(document, game),
    'action:quiz-hunt:hide-extra': createHideExtraAction(document, game),
    'action:quiz-hunt:collect-extra': createCollectExtraAction(document, game),
    'action:quiz-hunt:drop-extra-target': createDropExtraTargetAction(document, game),
    'action:quiz-hunt:restart': async () => onRestartRequested?.(),
    'action:quiz-hunt:return-to-summary': async ({ context, updateContext, send }) => {
      const state = readGameState(context.game, document, game)
      const summaryState = { ...state, screen: 'menu' as const }
      await updateContext({ game: summaryState })
      await projectGame(summaryState, game, send)
      await send('scene-result', { name: 'quiz-hunt:result:hide' }, { scope: 'story', storyId: 'main' })
    },
  }
  if (persistGameState === undefined) return actions
  return Object.fromEntries(Object.entries(actions).map(([name, action]) => [name, async (actionContext) => {
    const updateContext = actionContext.updateContext
    await action({
      ...actionContext,
      updateContext: async (patch) => {
        await updateContext(patch)
        if (patch.game !== undefined) {
          await persistGameState({
            seed: game.seed,
            state: readGameState(patch.game, document, game),
            savedAt: Date.now(),
          })
        }
      },
    })
  }])) as typeof actions
}

/** Restricts question admission to one unresolved drawn bank page. */
function createScenarioGuards(
  game: QuizHuntGameCatalog,
): NonNullable<SightyScenarioDefinition<QuizHuntSceneKey, QuizHuntSlotName>['guards']> {
  return {
    'guard:quiz-hunt:trial-access': ({ event, sceneKey, context }) => {
      if (game.finalPageId === null) return false
      const trial = game.trials.find((candidate) => `scene-page-${candidate.page.id}` === sceneKey)
      if (trial === undefined || event?.sourceSceneKey !== 'scene-summary') return false
      const gameState = readRecord(context.game)
      if (gameState.screen !== 'menu' || gameState.outcome !== null) return false
      const statuses = readRecord(gameState.trialStatus)
      const status = statuses[trial.page.id]
      return status === 'available'
    },
    'guard:quiz-hunt:retry-access': ({ event, sceneKey, context }) => {
      const trial = game.trials.find((candidate) => `scene-page-${candidate.page.id}` === sceneKey)
      if (trial === undefined || event?.sourceSceneKey !== 'scene-layout' || event.name !== retryTrialReadyEvent(trial.page.id)) return false
      const gameState = readRecord(context.game)
      const statuses = readRecord(gameState.trialStatus)
      return gameState.screen === 'menu'
        && gameState.outcome === null
        && statuses[trial.page.id] === 'failed'
        && gameState.extraAvailable === true
    },
    'guard:quiz-hunt:final-access': ({ event, sceneKey, context }) => {
      if (game.finalPageId === null || sceneKey !== `scene-page-${game.finalPageId}`
        || event?.sourceSceneKey !== 'scene-summary' || event.name !== 'quiz-hunt:final:open') return false
      const state = readRecord(context.game)
      const basket = readRecord(state.basket)
      return state.screen === 'menu'
        && state.outcome === null
        && game.activeColorIds.length > 0
        && game.activeColorIds.every((colorId) => typeof basket[colorId] === 'string')
    },
  }
}

/** Records an admitted trial and pauses only the persistent basket timer. */
function createEnterTrialAction(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
  videoPlayback: QuizHuntVideoPlaybackState,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function enterTrial({ event, context, updateContext, send }): Promise<void> {
    const retry = game.trials.some((candidate) => event.name === retryTrialReadyEvent(candidate.page.id))
    const trial = game.trials.find((candidate) => event.name === openTrialEvent(candidate.page.id) || event.name === retryTrialReadyEvent(candidate.page.id))
    if (trial === undefined) return
    const state = readGameState(context.game, document, game)
    if (state.screen !== 'menu' || state.outcome !== null) return
    if (retry) {
      if (event.sourceSceneKey !== 'scene-layout' || state.trialStatus[trial.page.id] !== 'failed' || !state.extraAvailable) return
    } else if (state.trialStatus[trial.page.id] !== 'available') return
    videoPlayback.statusByPageId.clear()
    videoPlayback.revealedPageIds.clear()
    if (videoPlayback.pageIds.has(trial.page.id)) videoPlayback.statusByPageId.set(trial.page.id, 'pending')
    await updateContext({
      game: {
        ...pauseGameTimer(state),
        trialStatus: retry ? { ...state.trialStatus, [trial.page.id]: 'available' } : state.trialStatus,
        extraAvailable: retry ? false : state.extraAvailable,
        extraOfferedOn: retry ? null : state.extraOfferedOn,
        screen: 'trial',
        activeTrialId: trial.page.id,
      },
    })
    await send('scene-basket', { name: QUIZ_HUNT_BASKET_EVENT.TIMER_PAUSE }, { scope: 'story', storyId: 'main' })
  }
}

/** Opens the seed-selected finale only after every active color has entered the basket. */
function createEnterFinalAction(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function enterFinal({ event, context, updateContext, send }): Promise<void> {
    const pageId = game.finalPageId
    if (pageId === null || event.name !== 'quiz-hunt:final:open' || event.sourceSceneKey !== 'scene-summary') return
    const state = readGameState(context.game, document, game)
    if (state.screen !== 'menu' || state.outcome !== null || !isFinalReady(state, game)) return
    await updateContext({ game: { ...pauseGameTimer(state), screen: 'final', activeFinalId: pageId } })
    await send('scene-basket', { name: QUIZ_HUNT_BASKET_EVENT.TIMER_PAUSE }, { scope: 'story', storyId: 'main' })
  }
}

/** Records one common Question result once, starts feedback and schedules its end. */
function createRecordAnswerAction(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
  videoPlayback: QuizHuntVideoPlaybackState,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function recordAnswer({ event, context, updateContext, send }): Promise<void> {
    const pageId = typeof event.data?.pageId === 'string' ? event.data.pageId : undefined
    if (pageId === undefined || event.sourceSceneKey !== `scene-page-${pageId}` || typeof event.data?.isCorrect !== 'boolean') return
    const trial = game.trials.find((candidate) => candidate.page.id === pageId)
    const isFinal = pageId === game.finalPageId
    if (trial === undefined && !isFinal) return
    const question = trial ?? game.finals.find((candidate) => candidate.page.id === pageId)
    if (question === undefined || question.page.type === 'summary') return
    const state = readGameState(context.game, document, game)
    if (isFinal) {
      if (state.screen !== 'final' || state.activeFinalId !== pageId || state.feedbackPending !== null) return
    } else if (trial === undefined || state.screen !== 'trial' || state.activeTrialId !== trial.page.id
      || state.trialStatus[trial.page.id] !== 'available') return
    const isCorrect = event.data.isCorrect
    const nextState: QuizHuntGameState = {
      ...state,
      ...(trial === undefined ? {} : {
        trialStatus: { ...state.trialStatus, [trial.page.id]: isCorrect ? 'success' : 'failed' },
        basket: isCorrect ? { ...state.basket, [trial.colorId]: trial.page.id } : state.basket,
        extraOfferedOn: state.extraOfferedOn === trial.page.id && !state.extraAvailable ? null : state.extraOfferedOn,
      }),
      feedbackPending: pageId,
      outcome: isFinal ? isCorrect ? 'success' : 'failure' : state.outcome,
    }
    await updateContext({ game: nextState })
    if (videoPlayback.pageIds.has(pageId)) {
      await send(`scene-page-${pageId}`, { name: QUIZ_HUNT_VIDEO_EVENT.STOP }, {
        scope: 'story',
        storyId: quizHuntPageSceneStoryId(pageId, question.page.type),
      })
    }
    await send('scene-basket', { name: QUIZ_HUNT_BASKET_EVENT.TIMER_FEEDBACK_PENDING }, { scope: 'story', storyId: 'main' })
    if (nextState.extraOfferedOn === null) await send('scene-layout', { name: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_HIDE }, { scope: 'story', storyId: 'main' })
    await send(`scene-page-${pageId}`, {
      name: FEEDBACK_WAIT_EVENT,
      events: [{
        name: feedbackFinishedEvent(pageId),
        startAt: document.settings.feedbackDelayMs,
        visibility: 'public',
        data: { pageId },
      }],
    }, { scope: 'story', storyId: quizHuntPageSceneStoryId(pageId, question.page.type) })
  }
}

/** Starts the shared countdown after the active question's clue is revealed. */
function createStartTimerAction(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
  videoPlayback: QuizHuntVideoPlaybackState,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function startTimer({ event, context, updateContext, send }): Promise<void> {
    const pageId = typeof event.data?.pageId === 'string' ? event.data.pageId : undefined
    const state = readGameState(context.game, document, game)
    const isActiveTrial = state.screen === 'trial' && state.activeTrialId === pageId
    const isActiveFinal = state.screen === 'final' && state.activeFinalId === pageId
    if (pageId === undefined || (!isActiveTrial && !isActiveFinal)) return
    videoPlayback.revealedPageIds.add(pageId)
    const videoStatus = videoPlayback.statusByPageId.get(pageId)
    if (videoStatus === 'pending' || videoStatus === 'playing' || state.timerStartedAtMs !== null) return
    await resumeGameTimer(state, { updateContext, send })
  }
}

/** Pauses the shared countdown only for the active Question video's native playback. */
function createVideoPlaybackAction(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
  videoPlayback: QuizHuntVideoPlaybackState,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function handleVideoPlayback({ event, context, updateContext, send }): Promise<void> {
    const pageId = typeof event.data?.pageId === 'string' ? event.data.pageId : undefined
    const status: QuizHuntVideoPlaybackStatus | undefined = event.name === QUIZ_HUNT_VIDEO_EVENT.PLAY
      ? 'playing'
      : event.name === QUIZ_HUNT_VIDEO_EVENT.PAUSE
        ? 'paused'
        : event.name === QUIZ_HUNT_VIDEO_EVENT.ENDED ? 'ended' : undefined
    if (pageId === undefined || status === undefined || !videoPlayback.pageIds.has(pageId)
      || event.sourceSceneKey !== `scene-page-${pageId}`) return
    const state = readGameState(context.game, document, game)
    if (state.screen !== 'trial' || state.activeTrialId !== pageId || state.feedbackPending !== null) return
    videoPlayback.statusByPageId.set(pageId, status)
    if (status === 'playing') {
      if (state.timerStartedAtMs === null) return
      await updateContext({ game: pauseGameTimer(state) })
      await send('scene-basket', { name: QUIZ_HUNT_BASKET_EVENT.TIMER_PAUSE }, { scope: 'story', storyId: 'main' })
      return
    }
    if (!videoPlayback.revealedPageIds.has(pageId) || state.timerStartedAtMs !== null) return
    await resumeGameTimer(state, { updateContext, send })
  }
}

/** Starts the shared timer scene with the game's preserved remaining duration. */
async function resumeGameTimer(
  state: QuizHuntGameState,
  actions: Pick<SightyActionContext<QuizHuntSceneKey, QuizHuntSlotName>, 'updateContext' | 'send'>,
): Promise<void> {
  await actions.updateContext({ game: { ...state, timerStartedAtMs: Date.now() } })
  await actions.send('scene-basket', {
    name: QUIZ_HUNT_BASKET_EVENT.TIMER_PLAY,
    data: { remainingMs: state.timerRemainingMs },
  }, { scope: 'story', storyId: 'main' })
}

/** Stores the remaining milliseconds reported by the basket scene at pause. */
function createRecordTimerAction(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function recordTimer({ event, context, updateContext }): Promise<void> {
    if (event.sourceSceneKey !== 'scene-basket' || typeof event.data?.remainingMs !== 'number') return
    const state = readGameState(context.game, document, game)
    await updateContext({
      game: {
        ...state,
        timerRemainingMs: clampTimer(event.data.remainingMs, document.settings.timeBudgetMs),
        timerStartedAtMs: null,
      },
    })
  }
}

/** Returns the reached public timer check to the basket story's timer strap. */
function createCheckTimerAction(): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function checkTimer({ event, send }): Promise<void> {
    if (event.sourceSceneKey !== 'scene-basket') return
    await send('scene-basket', {
      name: QUIZ_HUNT_BASKET_EVENT.TIMER_CHECK,
      data: event.data,
    }, { scope: 'story', storyId: 'main' })
  }
}

/** Returns to the menu when answer feedback finishes, unless expiry was deferred. */
function createFinishFeedbackAction(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function finishFeedback({ event, context, updateContext, send }): Promise<void> {
    const pageId = typeof event.data?.pageId === 'string' ? event.data.pageId : undefined
    const state = readGameState(context.game, document, game)
    if (pageId === undefined || event.sourceSceneKey !== `scene-page-${pageId}` || state.feedbackPending !== pageId) return
    const timedOut = state.pendingTimerExpiry
    const isFinal = state.activeFinalId === pageId
    const outcome = timedOut ? 'failure' : state.outcome
    const nextState = {
      ...state,
      screen: timedOut || isFinal ? 'result' as const : 'menu' as const,
      activeTrialId: null,
      activeFinalId: null,
      timerStartedAtMs: timedOut || isFinal ? null : state.timerStartedAtMs,
      feedbackPending: null,
      pendingTimerExpiry: false,
      outcome,
    }
    await updateContext({ game: nextState })
    await send('scene-basket', { name: QUIZ_HUNT_BASKET_EVENT.TIMER_FEEDBACK_FINISHED }, { scope: 'story', storyId: 'main' })
    await projectGame(nextState, game, send)
    if (outcome !== null && (timedOut || isFinal)) await showResult(send, outcome, nextState, document)
    if (!timedOut && !isFinal && nextState.timerRemainingMs > 0) {
      await send('scene-basket', {
        name: QUIZ_HUNT_BASKET_EVENT.TIMER_PLAY,
        data: { remainingMs: nextState.timerRemainingMs },
      }, { scope: 'story', storyId: 'main' })
    }
  }
}

/** Converts an immediate timeout into the loss presentation above the summary. */
function createTimerExpiredAction(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function timerExpired({ event, context, updateContext, send }): Promise<void> {
    if (event.sourceSceneKey !== 'scene-basket') return
    const state = readGameState(context.game, document, game)
    if (state.feedbackPending !== null) return
    const nextState = {
      ...state,
      screen: 'result' as const,
      timerRemainingMs: 0,
      timerStartedAtMs: null,
      outcome: 'failure' as const,
    }
    await updateContext({ game: nextState })
    await projectGame(nextState, game, send)
    await showResult(send, 'failure', nextState, document)
  }
}

/** Defers the timeout verdict until the Question's required feedback is complete. */
function createDeferExpiryAction(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function deferExpiry({ event, context, updateContext }): Promise<void> {
    if (event.sourceSceneKey !== 'scene-basket' || event.data?.feedbackPending !== true) return
    const state = readGameState(context.game, document, game)
    if (state.feedbackPending === null || (state.screen !== 'trial' && state.screen !== 'final')) return
    await updateContext({ game: { ...state, pendingTimerExpiry: true, timerRemainingMs: 0, timerStartedAtMs: null } })
  }
}

/** Shows the layout-owned token only on the seed-drawn question and only once. */
function createOfferExtraAction(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function offerExtra({ event, context, updateContext, send }): Promise<void> {
    const pageId = typeof event.data?.pageId === 'string' ? event.data.pageId : undefined
    const state = readGameState(context.game, document, game)
    if (!document.settings.extraEnabled || pageId !== game.extraPageId || state.screen !== 'trial' || state.activeTrialId !== pageId || state.extraOfferedOn !== null) return
    await updateContext({ game: { ...state, extraOfferedOn: pageId } })
    await send('scene-layout', { name: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_SHOW }, { scope: 'story', storyId: 'main' })
  }
}

/** Hides an uncollected extra after its short availability window. */
function createHideExtraAction(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function hideExtra({ event, context, updateContext, send }): Promise<void> {
    const pageId = typeof event.data?.pageId === 'string' ? event.data.pageId : undefined
    const state = readGameState(context.game, document, game)
    if (pageId !== state.extraOfferedOn || state.extraAvailable) return
    await updateContext({ game: { ...state, extraOfferedOn: null } })
    await send('scene-layout', { name: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_HIDE }, { scope: 'story', storyId: 'main' })
  }
}

/** Collects the single offered token while its matching question is active. */
function createCollectExtraAction(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function collectExtra({ event, context, updateContext, send }): Promise<void> {
    if (event.sourceSceneKey !== 'scene-layout') return
    const state = readGameState(context.game, document, game)
    if (state.screen !== 'trial' || state.extraOfferedOn !== state.activeTrialId || state.extraAvailable) return
    await updateContext({ game: { ...state, extraAvailable: true } })
    await send('scene-layout', { name: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_COLLECTED }, { scope: 'story', storyId: 'main' })
  }
}

/** Validates one DOM-resolved drop and admits a retry only after the token exits. */
function createDropExtraTargetAction(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function dropExtraTarget({ event, context, send }): Promise<void> {
    if (event.sourceSceneKey !== 'scene-layout') return
    const state = readGameState(context.game, document, game)
    const pageId = typeof event.data?.pageId === 'string' ? event.data.pageId : undefined
    const trial = game.trials.find((candidate) => candidate.page.id === pageId)
    if (trial === undefined || !state.extraAvailable || state.screen !== 'menu' || state.outcome !== null
      || state.feedbackPending !== null || state.trialStatus[trial.page.id] !== 'failed') {
      await send('scene-layout', { name: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_DRAG_RETURN }, { scope: 'story', storyId: 'main' })
      return
    }
    await send('scene-layout', {
      name: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_RETRY_HIDE,
      events: [
        {
          name: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_RETRY_HIDE_DONE,
          startAt: QUIZ_HUNT_EXTRA_RETRY_HIDE_DURATION_MS,
          visibility: 'story',
        },
        {
          name: retryTrialReadyEvent(trial.page.id),
          startAt: QUIZ_HUNT_EXTRA_RETRY_HIDE_DURATION_MS,
          visibility: 'public',
          data: { pageId: trial.page.id },
        },
      ],
    }, { scope: 'story', storyId: 'main' })
  }
}

/** Projects the game state to its resource scenes after route changes. */
async function projectGame(
  state: QuizHuntGameState,
  game: QuizHuntGameCatalog,
  send: SightyActionContext<QuizHuntSceneKey, QuizHuntSlotName>['send'],
): Promise<void> {
  await send('scene-summary', {
    name: QUIZ_HUNT_MENU_PROJECT_EVENT,
    data: {
      trialStatus: state.trialStatus,
      finalReady: state.outcome === null && isFinalReady(state, game),
      terminal: state.outcome !== null,
    },
  }, { scope: 'story', storyId: 'main' })
  await send('scene-basket', {
    name: QUIZ_HUNT_BASKET_EVENT.PROJECT,
    data: {
      basket: state.basket,
      finalReady: state.outcome === null && isFinalReady(state, game),
    },
  }, { scope: 'story', storyId: 'main' })
}

/** Sends the result projection to the persistent overlay scene. */
async function showResult(
  send: SightyActionContext<QuizHuntSceneKey, QuizHuntSlotName>['send'],
  outcome: QuizHuntGameOutcome,
  state: QuizHuntGameState,
  document: QuizHuntDocument,
): Promise<void> {
  const foundCount = document.settings.groups.filter((group) => state.basket[group.id] !== null).length
  const usedMs = Math.max(0, document.settings.timeBudgetMs - state.timerRemainingMs)
  const totalSeconds = Math.floor(usedMs / 1_000)
  await send('scene-result', {
    name: 'quiz-hunt:result:project',
    data: {
      outcome,
      summary: `${foundCount} / ${document.settings.groups.length} couleurs trouvées`,
      time: `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`,
    },
  }, { scope: 'story', storyId: 'main' })
}

/** Creates the stable game state used by author preview and a new release run. */
function createInitialGameState(document: QuizHuntDocument, game: QuizHuntGameCatalog): QuizHuntGameState {
  return {
    trialStatus: Object.fromEntries(game.trials.map((trial) => [trial.page.id, 'available' as const])),
    basket: Object.fromEntries(document.settings.groups.map((group) => [group.id, null])),
    timerRemainingMs: document.settings.timeBudgetMs,
    timerStartedAtMs: null,
    screen: 'menu',
    activeTrialId: null,
    activeFinalId: null,
    feedbackPending: null,
    pendingTimerExpiry: false,
    outcome: null,
    extraOfferedOn: null,
    extraAvailable: false,
  }
}

/** Reads and bounds a possibly absent runtime state against the current authored game. */
function readGameState(value: unknown, document: QuizHuntDocument, game: QuizHuntGameCatalog): QuizHuntGameState {
  const candidate = readRecord(value)
  const initial = createInitialGameState(document, game)
  const sourceStatuses = readRecord(candidate.trialStatus)
  const trialStatus = Object.fromEntries(game.trials.map((trial) => {
    const value = sourceStatuses[trial.page.id]
    return [trial.page.id, value === 'success' || value === 'failed' ? value : 'available']
  })) as Record<string, QuizHuntTrialStatus>
  const sourceBasket = readRecord(candidate.basket)
  const validTrialPageIds = new Set(game.trials.map((trial) => trial.page.id))
  const validPageIds = new Set([...validTrialPageIds, ...game.finals.map((final) => final.page.id)])
  const basket = Object.fromEntries(document.settings.groups.map((group) => {
    const value = sourceBasket[group.id]
    return [group.id, typeof value === 'string' && validTrialPageIds.has(value) ? value : null]
  })) as Record<string, string | null>
  const screen = candidate.screen === 'trial' || candidate.screen === 'final' || candidate.screen === 'result'
    ? candidate.screen
    : 'menu'
  const activeTrialId = typeof candidate.activeTrialId === 'string' && validTrialPageIds.has(candidate.activeTrialId)
    ? candidate.activeTrialId
    : null
  const activeFinalId = candidate.activeFinalId === game.finalPageId ? game.finalPageId : null
  return {
    ...initial,
    trialStatus,
    basket,
    timerRemainingMs: typeof candidate.timerRemainingMs === 'number' && Number.isFinite(candidate.timerRemainingMs)
      ? clampTimer(candidate.timerRemainingMs, document.settings.timeBudgetMs)
      : initial.timerRemainingMs,
    timerStartedAtMs: typeof candidate.timerStartedAtMs === 'number' && Number.isFinite(candidate.timerStartedAtMs)
      ? Math.max(0, candidate.timerStartedAtMs)
      : null,
    screen,
    activeTrialId,
    activeFinalId,
    feedbackPending: typeof candidate.feedbackPending === 'string' && validPageIds.has(candidate.feedbackPending)
      ? candidate.feedbackPending
      : null,
    pendingTimerExpiry: candidate.pendingTimerExpiry === true,
    outcome: candidate.outcome === 'success' || candidate.outcome === 'failure' ? candidate.outcome : null,
    extraOfferedOn: typeof candidate.extraOfferedOn === 'string' && validPageIds.has(candidate.extraOfferedOn)
      ? candidate.extraOfferedOn
      : null,
    extraAvailable: candidate.extraAvailable === true,
  }
}

/** Accounts for the running interval and records a stable paused game value. */
function pauseGameTimer(state: QuizHuntGameState): QuizHuntGameState {
  if (state.timerStartedAtMs === null) return state
  return {
    ...state,
    timerRemainingMs: Math.max(0, state.timerRemainingMs - Math.max(0, Date.now() - state.timerStartedAtMs)),
    timerStartedAtMs: null,
  }
}

/** Reconciles an interrupted run and resumes it at a safe screen boundary. */
function restoreGameState(
  value: unknown,
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
): QuizHuntGameState {
  const state = readGameState(value, document, game)
  const elapsed = state.timerStartedAtMs === null ? 0 : Math.max(0, Date.now() - state.timerStartedAtMs)
  const timerRemainingMs = clampTimer(state.timerRemainingMs - elapsed, document.settings.timeBudgetMs)
  const expired = timerRemainingMs === 0 && state.timerStartedAtMs !== null
  return {
    ...state,
    timerRemainingMs,
    timerStartedAtMs: null,
    screen: expired ? 'result' : 'menu',
    activeTrialId: null,
    activeFinalId: null,
    feedbackPending: null,
    pendingTimerExpiry: false,
    outcome: expired ? 'failure' : state.outcome,
    extraOfferedOn: null,
  }
}

/** Confirms that every final-eligible color has a collected trial word. */
function isFinalReady(state: QuizHuntGameState, game: QuizHuntGameCatalog): boolean {
  return game.finalPageId !== null
    && game.activeColorIds.length > 0
    && game.activeColorIds.every((colorId) => state.basket[colorId] !== null)
}

/** Selects the view id for an authored root page, using the custom Sommaire view. */
function contentViewId(page: QuizHuntPage): string {
  return page.type === 'summary' ? SUMMARY_VIEW : pageViewId(page.id)
}

/** Creates one view id for an authored content page. */
function pageViewId(pageId: string): string {
  return `page-${pageId}`
}

/** Creates one view id for a seeded trial. */
function trialViewId(pageId: string): string {
  return `trial-${pageId}`
}

/** Creates one view id for a valid extra-token retry. */
function retryTrialViewId(pageId: string): string {
  return `retry-${pageId}`
}

/** Creates one view id for the seed-selected final question. */
function finalViewId(pageId: string): string {
  return `final-${pageId}`
}

/** Resolves the route for an authored root page. */
function contentPath(page: QuizHuntPage): string {
  return `${ROOT_CONTENT_PATH}/${contentViewId(page)}`
}

/** Creates the public click event for one trial tile. */
function openTrialEvent(pageId: string): string {
  return `quiz-hunt:trial:open:${pageId}`
}

/** Creates the delayed public event that admits one question after the token exit. */
function retryTrialReadyEvent(pageId: string): string {
  return `quiz-hunt:trial:retry-ready:${pageId}`
}

/** Creates the page-scoped public event that completes feedback. */
function feedbackFinishedEvent(pageId: string): string {
  return `${FEEDBACK_FINISHED_PREFIX}${pageId}`
}

/** Creates the page-scoped public event that starts the game countdown. */
function questionRevealDueEvent(pageId: string): string {
  return `${QUESTION_REVEAL_DUE_PREFIX}${pageId}`
}

/** Creates the page-scoped extra offer timer event. */
function extraOfferDueEvent(pageId: string): string {
  return `${EXTRA_OFFER_DUE_PREFIX}${pageId}`
}

/** Creates the page-scoped extra hide timer event. */
function extraHideDueEvent(pageId: string): string {
  return `${EXTRA_HIDE_DUE_PREFIX}${pageId}`
}

/** Clamps the captured timer duration to the authored game budget. */
function clampTimer(value: number, budgetMs: number): number {
  return Math.max(0, Math.min(budgetMs, value))
}

/** Reads one untyped runtime value as a record. */
function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}
