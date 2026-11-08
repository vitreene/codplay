import type { SceneDoc } from 'codplay/scene/types'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import type { QuizHuntGameCatalog, QuizHuntGameQuestion } from './quiz-hunt-game-catalog'
import { resolveQuizHuntColorStyle } from './quiz-hunt-color-style.ts'

type SummaryPerso = SceneDoc<string>['stories'][string]['persos'][number]
type TrialStatus = 'available' | 'success' | 'failed'
const MENU_TERMINAL_EVENT = 'quiz-hunt:menu:terminal'

/** Builds the original single grid from the globally seeded order of trials. */
export function buildQuizHuntSummaryScene(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
): SceneDoc<string> {
  const summary = document.pages.find((page) => page.type === 'summary')
  if (summary === undefined) throw new Error('La page Sommaire Quiz Hunt est absente.')
  const groups = new Map(document.settings.groups.map((group) => [group.id, group]))
  const playableColorIds = new Set(game.activeColorIds)
  const tiles = game.trials.flatMap((trial, index) => {
    const group = groups.get(trial.colorId)
    if (group === undefined) return []
    return [createTile(
      trial,
      group.name,
      group.color,
      index + 1,
      game.finalPageId !== null && playableColorIds.has(trial.colorId),
    )]
  })

  return {
    id: 'quiz-hunt-summary-scene',
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        listen: [{ on: 'quiz-hunt:menu:project', straps: ['quiz-hunt-menu-project'] }],
        straps: {
          'quiz-hunt-menu-project': ({ event }) => projectTileStatuses(
            game.trials,
            event.data?.trialStatus,
            event.data?.terminal,
          ),
        },
        persos: [createSummaryLayout(), ...tiles],
      },
    },
  }
}

/** Creates the original menu host and its single 4 × 4 tile grid. */
function createSummaryLayout(): SummaryPerso {
  return {
    id: 'quiz-hunt-summary-layout',
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

/** Creates one original tile with its authored color, draw number, and status. */
function createTile(
  trial: QuizHuntGameQuestion,
  colorName: string,
  color: string,
  tileNumber: number,
  playable: boolean,
): SummaryPerso {
  const colorStyle = resolveQuizHuntColorStyle(colorName, color)
  const buttonAttributes = {
    id: `quiz-hunt-menu-trial-${trial.page.id}-button`,
    type: 'button',
    disabled: !playable,
    'aria-label': trial.page.name,
    'data-quiz-hunt-page-id': trial.page.id,
  }
  return {
    id: `quiz-hunt-menu-trial-${trial.page.id}`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: String(tileNumber),
      attr: buttonAttributes,
      className: 'quiz-hunt-grid-tile',
      style: {
        '--quiz-hunt-accent': colorStyle.solid,
        '--quiz-hunt-accent-gradient': colorStyle.gradient,
      },
      move: { target: 'quiz-hunt:menu:grid' },
    },
    ...(playable ? {
      emit: { click: { event: { name: `quiz-hunt:trial:open:${trial.page.id}`, visibility: 'public' as const } } },
    } : {}),
    actions: {
      [tileStatusEvent(trial.page.id, 'available')]: {
        content: String(tileNumber),
        className: { add: 'quiz-hunt-grid-tile', remove: 'is-success is-fail' },
        attr: { ...buttonAttributes, disabled: !playable },
      },
      [tileStatusEvent(trial.page.id, 'success')]: {
        content: '✓',
        className: { add: 'is-success', remove: 'is-fail' },
        attr: { ...buttonAttributes, disabled: true },
      },
      [tileStatusEvent(trial.page.id, 'failed')]: {
        content: '✗',
        className: { add: 'is-fail', remove: 'is-success' },
        attr: { ...buttonAttributes, disabled: true },
      },
      [MENU_TERMINAL_EVENT]: { attr: { ...buttonAttributes, disabled: true } },
    },
  }
}

/** Projects Sighty-owned trial progress onto the original numbered tiles. */
function projectTileStatuses(
  trials: readonly QuizHuntGameQuestion[],
  value: unknown,
  terminal: unknown,
): Readonly<{ events: readonly Readonly<{ name: string }>[] }> {
  const statuses = readRecord(value)
  return {
    events: [
      ...trials.map((trial) => ({ name: tileStatusEvent(trial.page.id, readTrialStatus(statuses[trial.page.id])) })),
      ...(terminal === true ? [{ name: MENU_TERMINAL_EVENT }] : []),
    ],
  }
}

/** Names the menu projection event for one question's status. */
function tileStatusEvent(pageId: string, status: TrialStatus): string {
  return `quiz-hunt:menu:tile:${pageId}:${status}`
}

/** Reads a known game status and defaults a fresh question to available. */
function readTrialStatus(value: unknown): TrialStatus {
  if (value === 'success' || value === 'failed') return value
  return 'available'
}

/** Reads one untyped event value as a record. */
function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}
