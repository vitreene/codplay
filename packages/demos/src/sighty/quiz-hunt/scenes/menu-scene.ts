import type { SceneDoc } from 'codplay/scene/types'
import type { QuizHuntTrial } from '../game-data'
import { resolveQuizHuntColorStyle } from '../../../v1/scenes/quiz-hunt/color-palette'
import {
  menuTrialStatusEvent,
  openTrialEvent,
  QUIZ_HUNT_EVENTS,
} from '../messages'
import type { QuizHuntTrialStatus } from '../game-rules'

type MenuScenePerso = SceneDoc<string>['stories'][string]['persos'][number]

/** Builds the independent menu scene in the seed-drawn V1 tile order. */
export function createMenuScene(
  trials: readonly QuizHuntTrial[],
  gridOrder: readonly string[],
): SceneDoc<string> {
  const trialsById = new Map(trials.map((trial) => [trial.id, trial]))
  const orderedTrials = gridOrder.map((trialId) => {
    const trial = trialsById.get(trialId)
    if (trial === undefined) throw new Error(`Le tirage Quiz Hunt référence une épreuve inconnue : ${trialId}.`)
    return trial
  })
  if (orderedTrials.length !== trials.length || new Set(gridOrder).size !== trials.length) {
    throw new Error('Le tirage Quiz Hunt doit contenir chaque épreuve exactement une fois.')
  }
  const persos = [createMenuGrid(), ...orderedTrials.map((trial, index) => createTrialButton(trial, index + 1))]
  return {
    id: 'quiz-hunt-menu',
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        straps: { 'quiz-hunt-menu-project': ({ event }) => projectTrialStatuses(trials, event.data) },
        listen: [{ on: QUIZ_HUNT_EVENTS.menuProject, straps: ['quiz-hunt-menu-project'] }],
        persos,
      },
    },
  }
}

/** Creates the numbered tile grid used by the original Quiz Hunt menu. */
function createMenuGrid(): MenuScenePerso {
  return {
    id: 'quiz-hunt-menu-grid',
    type: 'layout',
    initial: {
      move: '@root',
      className: 'quiz-hunt-main-zone',
      style: { width: '100%', height: '100%', minWidth: 0, minHeight: 0 },
      markup: `<div id="quiz-hunt-menu-main-zone" class="quiz-hunt-main-zone">
        <div id="quiz-hunt-menu-grid-root" class="quiz-hunt-grid" data-part="quiz-hunt:menu:grid"></div>
      </div>`,
    },
    actions: {},
  }
}

/** Creates one route intention button for a generated trial. */
function createTrialButton(trial: QuizHuntTrial, tileNumber: number): MenuScenePerso {
  const colorStyle = resolveQuizHuntColorStyle(trial.color)
  const label = `${trial.label} · ${trial.color}`
  const buttonAttributes = {
    id: `quiz-hunt-menu-trial-${trial.id}-button`,
    type: 'button',
    'aria-label': label,
  }
  return {
    id: `quiz-hunt-menu-trial-${trial.id}`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: String(tileNumber),
      attr: { ...buttonAttributes, disabled: false },
      className: 'quiz-hunt-grid-tile',
      style: {
        '--quiz-hunt-accent': colorStyle.solid,
        '--quiz-hunt-accent-gradient': colorStyle.gradient,
      },
      move: { target: 'quiz-hunt:menu:grid' },
    },
    emit: { click: { event: { name: openTrialEvent(trial.id), visibility: 'public' } } },
    actions: {
      [menuTrialStatusEvent(trial.id, 'available')]: {
        content: String(tileNumber),
        className: { add: 'quiz-hunt-grid-tile', remove: 'is-success is-fail' },
        attr: { ...buttonAttributes, disabled: false },
      },
      [menuTrialStatusEvent(trial.id, 'success')]: {
        content: '✓',
        className: { add: 'is-success', remove: 'is-fail' },
        attr: { ...buttonAttributes, disabled: true },
      },
      [menuTrialStatusEvent(trial.id, 'failed')]: {
        content: '✗',
        className: { add: 'is-fail', remove: 'is-success' },
        attr: { ...buttonAttributes, disabled: true },
      },
    },
  }
}

/** Converts Sighty-owned progress into button actions without adding menu rules. */
function projectTrialStatuses(
  trials: readonly QuizHuntTrial[],
  value: Readonly<Record<string, unknown>> | undefined,
): Readonly<{ events: readonly Readonly<{ name: string }>[] }> {
  const progress = typeof value?.trialStatus === 'object' && value.trialStatus !== null
    ? value.trialStatus as Record<string, unknown>
    : {}
  const events = trials.map((trial) => {
    const status = progress[trial.id]
    const knownStatus: QuizHuntTrialStatus = status === 'success' || status === 'failed' ? status : 'available'
    return { name: menuTrialStatusEvent(trial.id, knownStatus) }
  })
  return { events }
}
