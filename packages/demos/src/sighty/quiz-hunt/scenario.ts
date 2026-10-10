import type {
  SightyActionHandler,
  SightyActionContext,
  SightyGraphView,
  SightyScenarioDefinition,
  SightySceneSourceValue,
  SightyViewAction,
} from '@codplay/sighty'
import type { CodPlayEventime } from 'codplay'
import type { QuizHuntGameData, QuizHuntTrial } from './game-data'
import {
  createInitialQuizHuntProgress,
  readQuizHuntProgress,
  recordQuizHuntAnswer,
  recordQuizHuntFinalAnswer,
  recordQuizHuntTimer,
  QUIZ_HUNT_TIMER_BUDGET_MS,
} from './game-rules'
import {
  enterTrialEvent,
  finalAnsweredEvent,
  finalFeedbackFinishedEvent,
  finalViewPath,
  openFinalEvent,
  openTrialEvent,
  trialFeedbackFinishedEvent,
  trialViewPath,
  QUIZ_HUNT_EVENTS,
} from './messages'
import { createBasketScene } from './scenes/basket-scene'
import { layoutScene } from './scenes/layout-scene'
import { createMenuScene } from './scenes/menu-scene'
import { createQuestionScene } from './scenes/question-scene'
import { createFinalQuestionScene } from './scenes/question-scene'
import { createResultScene } from './scenes/result-scene'

export type QuizHuntSceneKey = 'scene-layout' | 'scene-menu' | 'scene-basket' | 'scene-result' | `scene-question-${string}` | `scene-final-${string}`
export type QuizHuntSlotName = 'slot-content' | 'slot-basket' | 'slot-result'

const MENU_PATH = 'view-game/slot-content/view-menu'

/** Declares generated trial/final scenes, the shared layout, trial routes, and game actions. */
export function createQuizHuntScenario(
  gameData: QuizHuntGameData,
): SightyScenarioDefinition<QuizHuntSceneKey, QuizHuntSlotName> {
  const trials = gameData.trials
  const finals = gameData.finals
  const trialScenes = Object.fromEntries(trials.map((trial) => [questionSceneKey(trial.id), {
    sceneDoc: createQuestionScene(trial, tileNumberFor(gameData.draw.gridOrder, trial.id)),
  }])) as Record<`scene-question-${string}`, SightySceneSourceValue>
  const finalScenes = Object.fromEntries(finals.map((final) => [finalSceneKey(final.id), {
    sceneDoc: createFinalQuestionScene(final, tileNumberFor(gameData.draw.gridOrder, final.id)),
  }])) as Record<`scene-final-${string}`, SightySceneSourceValue>
  const contentViews = {
    ...createTrialViews(gameData),
    ...createFinalViews(gameData),
  } satisfies Readonly<Record<string, SightyGraphView<QuizHuntSceneKey, QuizHuntSlotName>>>
  const eventActions = createGameEventActions(gameData)

  return {
    format: 'sighty',
    version: 1,
    id: 'quiz-hunt-sighty',
    views: {
      start: 'view-game',
      views: {
        'view-game': {
          actions: {
            [QUIZ_HUNT_EVENTS.refresh]: { action: 'action:quiz-hunt:project' },
            [QUIZ_HUNT_EVENTS.timerPause]: { action: 'action:quiz-hunt:timer-pause' },
            [QUIZ_HUNT_EVENTS.timerPlay]: { action: 'action:quiz-hunt:timer-play' },
            [QUIZ_HUNT_EVENTS.timerPaused]: { action: 'action:quiz-hunt:record-timer' },
            [QUIZ_HUNT_EVENTS.questionRevealDue]: { action: 'action:quiz-hunt:reveal-question' },
            [QUIZ_HUNT_EVENTS.timerExpired]: {
              go: { path: MENU_PATH },
              action: 'action:quiz-hunt:record-timer-expiry',
            },
            [QUIZ_HUNT_EVENTS.timerExpiredDuringFeedback]: { action: 'action:quiz-hunt:defer-timer-expiry' },
            ...eventActions,
          },
          view: {
            scene: 'scene-layout',
            slots: {
              'slot-content': {
                start: 'view-menu',
                views: {
                  'view-menu': { view: { scene: 'scene-menu' } },
                  ...contentViews,
                },
              },
              'slot-basket': {
                start: 'view-basket',
                views: {
                  'view-basket': { showMode: 'maintain', view: { scene: 'scene-basket' } },
                },
              },
              'slot-result': {
                start: 'view-result',
                views: {
                  'view-result': { showMode: 'maintain', view: { scene: 'scene-result' } },
                },
              },
            },
          },
        },
      },
    },
    scenes: {
      'scene-layout': layoutScene,
      'scene-menu': createMenuScene(trials, gameData.draw.gridOrder),
      'scene-basket': createBasketScene(gameData.colors, finals),
      'scene-result': createResultScene(),
      ...trialScenes,
      ...finalScenes,
    },
    actions: {
      'action:quiz-hunt:project': createProjectAction(gameData),
      'action:quiz-hunt:timer-pause': createTimerPauseAction(),
      'action:quiz-hunt:timer-play': createTimerPlayAction(gameData),
      'action:quiz-hunt:record-timer': createRecordTimerAction(gameData),
      'action:quiz-hunt:reveal-question': createRevealQuestionAction(trials),
      'action:quiz-hunt:record-answer': createRecordAnswerAction(gameData),
      'action:quiz-hunt:project-menu': createProjectAction(gameData),
      'action:quiz-hunt:record-timer-expiry': createRecordTimerExpiryAction(gameData),
      'action:quiz-hunt:defer-timer-expiry': createDeferTimerExpiryAction(gameData),
      'action:quiz-hunt:record-final-answer': createRecordFinalAnswerAction(gameData),
      'action:quiz-hunt:enter-trial': createEnterTrialAction(gameData),
      'action:quiz-hunt:enter-final': createEnterFinalAction(gameData),
      'action:quiz-hunt:finish-trial-feedback': createFinishTrialFeedbackAction(gameData),
      'action:quiz-hunt:finish-final-feedback': createFinishFinalFeedbackAction(gameData),
    },
    guards: {
      'guard:quiz-hunt:trial-access': ({ sceneKey, context }) => {
        const trial = trials.find((candidate) => questionSceneKey(candidate.id) === sceneKey)
        if (trial === undefined) return false
        const progress = readQuizHuntProgress(context.game, trials, gameData.colors)
        return progress.trialStatus[trial.id] === 'available'
      },
      'guard:quiz-hunt:final-access': ({ event, sceneKey, context }) => {
        const final = finals.find((candidate) => finalSceneKey(candidate.id) === sceneKey)
        if (final === undefined || event?.sourceSceneKey !== 'scene-basket') return false
        const progress = readQuizHuntProgress(context.game, trials, gameData.colors)
        return progress.screen === 'menu'
          && isBasketComplete(progress, gameData.colors)
          && progress.basket[gameData.draw.finalColor] === final.id
          && !progress.finalAttemptedWordIds.includes(final.id)
      },
    },
  }
}

/** Builds every authored trial question view. */
function createTrialViews(
  gameData: QuizHuntGameData,
): Readonly<Record<string, SightyGraphView<QuizHuntSceneKey, QuizHuntSlotName>>> {
  const views: Record<string, SightyGraphView<QuizHuntSceneKey, QuizHuntSlotName>> = {}
  for (const trial of gameData.trials) {
    views[`view-trial-${trial.id}`] = {
      showMode: 'reset',
      accessBy: 'guard:quiz-hunt:trial-access',
      onDenied: { path: MENU_PATH },
      entry: createTrialEntryEventime(trial),
      actions: {
        [trialFeedbackFinishedEvent(trial.id)]: {
          go: { path: MENU_PATH },
          action: 'action:quiz-hunt:finish-trial-feedback',
        },
        [trialAnsweredEventName(trial.id)]: { action: 'action:quiz-hunt:record-answer' },
      },
      view: { scene: questionSceneKey(trial.id) },
    }
  }
  return views
}

/** Builds one statically addressable final view for every generated final question. */
function createFinalViews(
  gameData: QuizHuntGameData,
): Readonly<Record<string, SightyGraphView<QuizHuntSceneKey, QuizHuntSlotName>>> {
  const views: Record<string, SightyGraphView<QuizHuntSceneKey, QuizHuntSlotName>> = {}
  for (const final of gameData.finals) {
    views[`view-final-${final.id}`] = {
      showMode: 'reset',
      accessBy: 'guard:quiz-hunt:final-access',
      onDenied: { path: MENU_PATH },
      actions: {
        [finalAnsweredEvent(final.id)]: { action: 'action:quiz-hunt:record-final-answer' },
        [finalFeedbackFinishedEvent(final.id)]: {
          go: { path: MENU_PATH },
          action: 'action:quiz-hunt:finish-final-feedback',
        },
      },
      view: { scene: finalSceneKey(final.id) },
    }
  }
  return views
}

/** Sends question timer commands through public timeline events in the entry. */
function createTrialEntryEventime(trial: QuizHuntTrial): CodPlayEventime {
  const timerData = { trialId: trial.id }
  return {
    name: enterTrialEvent(trial.id),
    events: [
      { name: QUIZ_HUNT_EVENTS.timerPause, startAt: 0, visibility: 'public', data: timerData },
      {
        name: QUIZ_HUNT_EVENTS.timerPlay,
        startAt: trial.revealDelayMs,
        visibility: 'public',
        data: timerData,
      },
      {
        name: QUIZ_HUNT_EVENTS.questionRevealDue,
        startAt: trial.revealDelayMs,
        visibility: 'public',
        data: timerData,
      },
    ],
  }
}

/** Binds one public menu intention and each resolved trial to its declared route. */
function createGameEventActions(
  gameData: QuizHuntGameData,
): Readonly<Record<string, SightyViewAction<QuizHuntSceneKey, QuizHuntSlotName>>> {
  const actions: Record<string, SightyViewAction<QuizHuntSceneKey, QuizHuntSlotName>> = {}
  for (const trial of gameData.trials) {
    actions[openTrialEvent(trial.id)] = {
      go: { path: trialViewPath(trial.id) },
      action: 'action:quiz-hunt:enter-trial',
    }
  }
  for (const final of gameData.finals) {
    actions[openFinalEvent(final.id)] = {
      go: { path: finalViewPath(final.id) },
      action: 'action:quiz-hunt:enter-final',
    }
  }
  return actions
}

/** Projects durable progress to the active menu and persistent basket scenes. */
function createProjectAction(
  gameData: QuizHuntGameData,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function projectGame({ context, send }): Promise<void> {
    const progress = readQuizHuntProgress(context.game, gameData.trials, gameData.colors)
    await projectMenuAndBasket(gameData, progress, send)
  }
}

/** Projects current durable game values to the active menu and persistent basket. */
async function projectMenuAndBasket(
  gameData: QuizHuntGameData,
  progress: ReturnType<typeof readQuizHuntProgress>,
  send: SightyActionContext<QuizHuntSceneKey, QuizHuntSlotName>['send'],
): Promise<void> {
  await send('scene-menu', {
    name: QUIZ_HUNT_EVENTS.menuProject,
    data: { trialStatus: progress.trialStatus },
  }, { scope: 'story', storyId: 'main' })
  await projectBasketScene(gameData, progress, send)
}

/** Projects basket contents and the one valid menu-only final button. */
async function projectBasketScene(
  gameData: QuizHuntGameData,
  progress: ReturnType<typeof readQuizHuntProgress>,
  send: SightyActionContext<QuizHuntSceneKey, QuizHuntSlotName>['send'],
): Promise<void> {
  const finalWordId = progress.basket[gameData.draw.finalColor] ?? undefined
  const finalAvailable = progress.screen === 'menu'
    && progress.outcome === null
    && !progress.pendingTimerExpiry
    && isBasketComplete(progress, gameData.colors)
    && finalWordId !== undefined
    && !progress.finalAttemptedWordIds.includes(finalWordId)
  await send('scene-basket', {
    name: QUIZ_HUNT_EVENTS.basketProject,
    data: {
      basket: progress.basket,
      ...(finalWordId === undefined ? {} : { finalWordId }),
      finalAvailable,
    },
  }, { scope: 'story', storyId: 'main' })
}

/** Routes a question's timer-only pause instruction to the active basket scene. */
function createTimerPauseAction(): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function pauseBasketTimer({ send }): Promise<void> {
    await send('scene-basket', { name: QUIZ_HUNT_EVENTS.timerPause }, { scope: 'story', storyId: 'main' })
  }
}

/** Routes a question's timer-only play instruction with the durable remaining budget. */
function createTimerPlayAction(
  gameData: QuizHuntGameData,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function playBasketTimer({ context, send }): Promise<void> {
    const progress = readQuizHuntProgress(context.game, gameData.trials, gameData.colors)
    await send('scene-basket', {
      name: QUIZ_HUNT_EVENTS.timerPlay,
      data: { remainingMs: progress.timerRemainingMs },
    }, { scope: 'story', storyId: 'main' })
  }
}

/** Records the exact remaining time captured by the basket timer on pause. */
function createRecordTimerAction(
  gameData: QuizHuntGameData,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function recordTimer({ event, context, updateContext }): Promise<void> {
    const progress = readQuizHuntProgress(context.game, gameData.trials, gameData.colors)
    const nextProgress = recordQuizHuntTimer(progress, event.data?.remainingMs)
    await updateContext({ game: nextProgress })
  }
}

/** Reveals the active question and relays its paired timer-play instruction. */
function createRevealQuestionAction(
  trials: readonly QuizHuntTrial[],
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function revealQuestion({ event, send }): Promise<void> {
    const trialId = readTrialId(event.data)
    if (trialId === undefined || !trials.some((trial) => trial.id === trialId)) return
    await send(questionSceneKey(trialId), {
      name: `${questionPrefix(trialId)}:reveal`,
    }, { scope: 'story', storyId: 'main' })
  }
}

/** Applies one public answer result to Sighty's progress and basket projection. */
function createRecordAnswerAction(
  gameData: QuizHuntGameData,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function recordAnswer({ event, context, updateContext, send }): Promise<void> {
    const trialId = readTrialId(event.data)
    const trial = gameData.trials.find((candidate) => candidate.id === trialId)
    if (
      trial === undefined
      || event.sourceSceneKey !== questionSceneKey(trial.id)
      || typeof event.data?.isCorrect !== 'boolean'
    ) return
    const progress = readQuizHuntProgress(context.game, gameData.trials, gameData.colors)
    const nextProgress = recordQuizHuntAnswer(progress, trial, event.data.isCorrect)
    if (nextProgress === progress) return
    await updateContext({ game: nextProgress })
    await send('scene-basket', { name: QUIZ_HUNT_EVENTS.timerFeedbackPending }, { scope: 'story', storyId: 'main' })
  }
}

/** Records a timeout that arrived while a trial's two-second feedback is visible. */
function createDeferTimerExpiryAction(
  gameData: QuizHuntGameData,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function deferTimerExpiry({ event, context, updateContext }): Promise<void> {
    if (event.sourceSceneKey !== 'scene-basket' || event.data?.feedbackPending !== true) return
    const progress = readQuizHuntProgress(context.game, gameData.trials, gameData.colors)
    if (progress.feedbackPending === null || progress.screen !== 'trial') return
    await updateContext({
      game: { ...progress, pendingTimerExpiry: true, timerRemainingMs: 0 },
    })
  }
}

/** Completes an immediate timer expiry by returning to the menu and showing the loss. */
function createRecordTimerExpiryAction(
  gameData: QuizHuntGameData,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function recordTimerExpiry({ event, context, updateContext, send }): Promise<void> {
    if (event.sourceSceneKey !== 'scene-basket') return
    const progress = readQuizHuntProgress(context.game, gameData.trials, gameData.colors)
    const nextProgress = {
      ...progress,
      timerRemainingMs: 0,
      feedbackPending: null,
      pendingTimerExpiry: false,
      resumeTimerAfterFinal: false,
      outcome: 'lost' as const,
      screen: 'result' as const,
    }
    await updateContext({ game: nextProgress })
    await send('scene-basket', {
      name: QUIZ_HUNT_EVENTS.timerFeedbackFinished,
    }, { scope: 'story', storyId: 'main' })
    await projectMenuAndBasket(gameData, nextProgress, send)
    await projectResultScene(gameData, nextProgress, send)
  }
}

/** Enters a trial after Sighty admits the menu route and hides final controls. */
function createEnterTrialAction(
  gameData: QuizHuntGameData,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function enterTrial({ event, context, updateContext, send }): Promise<void> {
    const trial = gameData.trials.find((candidate) => event.name === openTrialEvent(candidate.id))
    if (trial === undefined) return
    const progress = readQuizHuntProgress(context.game, gameData.trials, gameData.colors)
    if (progress.trialStatus[trial.id] !== 'available') return
    const nextProgress = { ...progress, screen: 'trial' as const }
    await updateContext({ game: nextProgress })
    await projectBasketScene(gameData, nextProgress, send)
  }
}

/** Enters a final from the menu, stops the countdown, and hides menu-only controls. */
function createEnterFinalAction(
  gameData: QuizHuntGameData,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function enterFinal({ event, context, updateContext, send }): Promise<void> {
    const final = gameData.finals.find((candidate) => event.name === openFinalEvent(candidate.id))
    if (final === undefined) return
    const progress = readQuizHuntProgress(context.game, gameData.trials, gameData.colors)
    if (
      progress.screen !== 'menu'
      || !isBasketComplete(progress, gameData.colors)
      || progress.basket[gameData.draw.finalColor] !== final.id
    ) return
    const nextProgress = { ...progress, screen: 'final' as const }
    await updateContext({ game: nextProgress })
    await send('scene-basket', { name: QUIZ_HUNT_EVENTS.timerStop }, { scope: 'story', storyId: 'main' })
    await projectBasketScene(gameData, nextProgress, send)
  }
}

/** Records one final answer and computes the matching V1 failure branch. */
function createRecordFinalAnswerAction(
  gameData: QuizHuntGameData,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function recordFinalAnswer({ event, context, updateContext, send }): Promise<void> {
    const final = gameData.finals.find((candidate) => candidate.id === event.data?.finalId)
    if (
      final === undefined
      || event.sourceSceneKey !== finalSceneKey(final.id)
      || typeof event.data?.isCorrect !== 'boolean'
    ) return
    const progress = readQuizHuntProgress(context.game, gameData.trials, gameData.colors)
    const nextProgress = recordQuizHuntFinalAnswer(
      progress,
      final,
      gameData.trials,
      gameData.draw.finalColor,
      event.data.isCorrect,
    )
    if (nextProgress === progress) return
    await updateContext({ game: nextProgress })
    await send('scene-basket', { name: QUIZ_HUNT_EVENTS.timerFeedbackPending }, { scope: 'story', storyId: 'main' })
  }
}

/** Resolves trial feedback into the menu or deferred timeout result. */
function createFinishTrialFeedbackAction(
  gameData: QuizHuntGameData,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function finishTrialFeedback({ event, context, updateContext, send }): Promise<void> {
    const trialId = readTrialId(event.data)
    if (trialId === undefined) return
    const progress = readQuizHuntProgress(context.game, gameData.trials, gameData.colors)
    if (progress.feedbackPending !== `trial:${trialId}`) return
    const showResult = progress.pendingTimerExpiry || progress.outcome !== null
    const nextProgress = {
      ...progress,
      feedbackPending: null,
      pendingTimerExpiry: false,
      resumeTimerAfterFinal: false,
      outcome: progress.pendingTimerExpiry ? 'lost' as const : progress.outcome,
      screen: showResult ? 'result' as const : 'menu' as const,
    }
    await updateContext({ game: nextProgress })
    await send('scene-basket', {
      name: QUIZ_HUNT_EVENTS.timerFeedbackFinished,
    }, { scope: 'story', storyId: 'main' })
    await projectMenuAndBasket(gameData, nextProgress, send)
    if (showResult) await projectResultScene(gameData, nextProgress, send)
  }
}

/** Resolves final feedback into a result or returns to the menu and resumes hunting. */
function createFinishFinalFeedbackAction(
  gameData: QuizHuntGameData,
): SightyActionHandler<QuizHuntSceneKey, QuizHuntSlotName> {
  return async function finishFinalFeedback({ event, context, updateContext, send }): Promise<void> {
    const finalId = typeof event.data?.finalId === 'string' ? event.data.finalId : undefined
    if (finalId === undefined || !gameData.finals.some((final) => final.id === finalId)) return
    const progress = readQuizHuntProgress(context.game, gameData.trials, gameData.colors)
    if (progress.feedbackPending !== `final:${finalId}`) return
    const showResult = progress.outcome !== null
    const resumeTimer = !showResult && progress.resumeTimerAfterFinal
    const nextProgress = {
      ...progress,
      feedbackPending: null,
      pendingTimerExpiry: false,
      resumeTimerAfterFinal: false,
      screen: showResult ? 'result' as const : 'menu' as const,
    }
    await updateContext({ game: nextProgress })
    await send('scene-basket', {
      name: QUIZ_HUNT_EVENTS.timerFeedbackFinished,
    }, { scope: 'story', storyId: 'main' })
    await projectMenuAndBasket(gameData, nextProgress, send)
    if (showResult) {
      await projectResultScene(gameData, nextProgress, send)
      return
    }
    if (resumeTimer) {
      await send('scene-basket', {
        name: QUIZ_HUNT_EVENTS.timerPlay,
        data: { remainingMs: nextProgress.timerRemainingMs },
      }, { scope: 'story', storyId: 'main' })
    }
  }
}

/** Renders the original verdict, color count, and elapsed-time values. */
async function projectResultScene(
  gameData: QuizHuntGameData,
  progress: ReturnType<typeof readQuizHuntProgress>,
  send: SightyActionContext<QuizHuntSceneKey, QuizHuntSlotName>['send'],
): Promise<void> {
  const foundCount = gameData.colors.filter((color) => progress.basket[color] !== null).length
  const usedMs = Math.max(0, QUIZ_HUNT_TIMER_BUDGET_MS - progress.timerRemainingMs)
  const totalSeconds = Math.floor(usedMs / 1_000)
  await send('scene-result', {
    name: QUIZ_HUNT_EVENTS.resultProject,
    data: {
      outcome: progress.outcome,
      summary: `${foundCount} / ${gameData.colors.length} couleurs trouvées`,
      time: `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`,
    },
  }, { scope: 'story', storyId: 'main' })
}

/** Checks whether every color slot in the basket contains a word id. */
function isBasketComplete(
  progress: ReturnType<typeof readQuizHuntProgress>,
  colors: readonly string[],
): boolean {
  return colors.every((color) => progress.basket[color] !== null)
}

/** Creates the stable authored scene key for one generated trial. */
function questionSceneKey(trialId: string): `scene-question-${string}` {
  return `scene-question-${trialId}`
}

/** Creates the stable authored scene key for one generated final question. */
function finalSceneKey(finalId: string): `scene-final-${string}` {
  return `scene-final-${finalId}`
}

/** Reads the V1 seed-drawn 1-based grid position shared by each word's questions. */
function tileNumberFor(gridOrder: readonly string[], wordId: string): number {
  const tileIndex = gridOrder.indexOf(wordId)
  if (tileIndex < 0) throw new Error(`Le tirage Quiz Hunt ne contient pas l’épreuve ${wordId}.`)
  return tileIndex + 1
}

/** Creates the stable local event prefix for one generated question scene. */
function questionPrefix(trialId: string): string {
  return `quiz-hunt:question:${trialId}`
}

/** Reads a word id from one public game event. */
function readTrialId(value: Readonly<Record<string, unknown>> | undefined): string | undefined {
  return typeof value?.trialId === 'string' ? value.trialId : undefined
}

/** Creates the public answer-result event name for one trial. */
function trialAnsweredEventName(trialId: string): string {
  return `${QUIZ_HUNT_EVENTS.trialAnswered}:${trialId}`
}

/** Creates a complete Sighty context value for one game initialization. */
export function createInitialQuizHuntContext(gameData: QuizHuntGameData): Readonly<Record<string, unknown>> {
  return { game: createInitialQuizHuntProgress(gameData.trials, gameData.colors) }
}
