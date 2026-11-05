import type { SceneDoc } from 'codplay/scene/types'
import type { QuizHuntDocument, QuizHuntGroup, QuizHuntPage } from '../document/quiz-hunt-document-types'
import type { QuizHuntGameCatalog } from './quiz-hunt-game-catalog'

type SummaryPerso = SceneDoc<string>['stories'][string]['persos'][number]
type TrialStatus = 'available' | 'success' | 'failed'
const MENU_TERMINAL_EVENT = 'quiz-hunt:menu:terminal'

/** Builds the authored Sommaire title and one four-slot group per game color. */
export function buildQuizHuntSummaryScene(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
): Readonly<{ sceneDoc: SceneDoc<string>; styleSheet: string }> {
  const summary = document.pages.find((page) => page.type === 'summary')
  if (summary === undefined) throw new Error('La page Sommaire Quiz Hunt est absente.')
  const tileNumbers = new Map(game.trialGridOrder.map((pageId, index) => [pageId, index + 1]))
  const groups = document.settings.groups.map((group, index) => ({
    group,
    index,
    slots: game.trialSlotsByColor[group.id] ?? [],
    active: game.activeColorIds.includes(group.id),
  }))
  const titlePart = 'quiz-hunt:summary:title'
  const persos = [
    createSummaryLayout(groups, titlePart, document.settings.menuPresentation, game.finalPageId !== null),
    createSummaryTitle(summary.name, titlePart),
    ...groups.flatMap(({ group, index, slots, active }) => [
      createGroupHeading(group, index),
      ...slots.map((page, slotIndex) => createTile(
        group, index, page, slotIndex, tileNumbers.get(page?.id ?? ''), active && game.finalPageId !== null,
      )),
    ]),
    ...(game.finalPageId === null ? [] : [createFinalButton()]),
  ]

  return {
    sceneDoc: {
      id: 'quiz-hunt-summary-scene',
      stories: {
        main: {
          id: 'main',
          initial: { move: '@root' },
          listen: [{ on: 'quiz-hunt:menu:project', straps: ['quiz-hunt-menu-project'] }],
          straps: {
            'quiz-hunt-menu-project': ({ event }) => projectTileStatuses(
              groups,
              event.data?.trialStatus,
              event.data?.finalReady,
              event.data?.terminal,
            ),
          },
          persos,
        },
      },
    },
    styleSheet: createSummaryStyleSheet(),
  }
}

/** Creates the fixed summary surface and one anonymous-free outlet for every group. */
function createSummaryLayout(
  groups: readonly Readonly<{ group: QuizHuntGroup; index: number }>[],
  titlePart: string,
  presentation: QuizHuntDocument['settings']['menuPresentation'],
  hasFinal: boolean,
): SummaryPerso {
  const rootClassName = presentation === 'diapo'
    ? 'quiz-hunt-summary quiz-hunt-summary--diapo'
    : 'quiz-hunt-summary'
  const groupMarkup = groups.map(({ index }) => `<section id="quiz-hunt-summary-group-${index + 1}" class="quiz-hunt-summary-group">
    <header id="quiz-hunt-summary-group-${index + 1}-header" class="quiz-hunt-summary-group__header">
      <!-- data-part="quiz-hunt:summary:group-title:${index}" -->
    </header>
    <div id="quiz-hunt-summary-group-${index + 1}-tiles" class="quiz-hunt-summary-group__tiles">
      <!-- data-part="quiz-hunt:summary:group-tiles:${index}" -->
    </div>
  </section>`).join('')
  const finalMarkup = hasFinal
    ? '<div id="quiz-hunt-summary-final-slot" data-part="quiz-hunt:summary:final-slot"></div>'
    : ''
  return {
    id: 'quiz-hunt-summary-layout',
    type: 'layout',
    initial: {
      move: '@root',
      className: rootClassName,
      markup: `<main id="quiz-hunt-summary-root" class="${rootClassName}">
        <h1 id="quiz-hunt-summary-title" class="quiz-hunt-summary__title"><!-- data-part="${titlePart}" --></h1>
        <div id="quiz-hunt-summary-groups" class="quiz-hunt-summary__groups">${groupMarkup}</div>
        ${finalMarkup}
      </main>`,
    },
    actions: {},
  }
}

/** Adds the final-question control only when the seed selected a playable final. */
function createFinalButton(): SummaryPerso {
  return {
    id: 'quiz-hunt-summary-final-button',
    type: 'tag',
    initial: {
      tag: 'button',
      content: 'Lancer la finale',
      attr: { type: 'button', disabled: true },
      className: 'quiz-hunt-summary-final',
      move: { target: 'quiz-hunt:summary:final-slot' },
    },
    emit: { click: { event: { name: 'quiz-hunt:final:open', visibility: 'public' } } },
    actions: {
      'quiz-hunt:menu:final:locked': { attr: { type: 'button', disabled: true } },
      'quiz-hunt:menu:final:ready': { attr: { type: 'button', disabled: false } },
    },
  }
}

/** Places the authored summary title into its stable root heading. */
function createSummaryTitle(title: string, target: string): SummaryPerso {
  return {
    id: 'quiz-hunt-summary-title-text',
    type: 'tag',
    initial: { tag: 'span', content: title, move: { target } },
  }
}

/** Places one author-defined color label in its matching game group. */
function createGroupHeading(group: QuizHuntGroup, index: number): SummaryPerso {
  return {
    id: `quiz-hunt-summary-group-${index + 1}-title`,
    type: 'tag',
    initial: {
      tag: 'h2',
      content: group.name,
      className: 'quiz-hunt-summary-group__title',
      style: { '--quiz-hunt-group-color': group.color },
      move: { target: `quiz-hunt:summary:group-title:${index}` },
    },
  }
}

/** Creates one active question tile or one visible disabled bank slot. */
function createTile(
  group: QuizHuntGroup,
  groupIndex: number,
  page: QuizHuntPage | null,
  slotIndex: number,
  tileNumber: number | undefined,
  playable: boolean,
): SummaryPerso {
  const id = `quiz-hunt-summary-group-${groupIndex + 1}-slot-${slotIndex + 1}`
  const target = `quiz-hunt:summary:group-tiles:${groupIndex}`
  const eventName = page === null ? undefined : `quiz-hunt:trial:open:${page.id}`
  const buttonAttributes = {
    type: 'button',
    disabled: page === null || !playable,
    'aria-label': page === null ? `${group.name}, emplacement ${slotIndex + 1}, vide` : `${page.name}, ${group.name}`,
    ...(page === null ? {} : { 'data-quiz-hunt-page-id': page.id }),
  }
  return {
    id,
    type: 'tag',
    initial: {
      tag: 'button',
      content: page === null ? '—' : String(tileNumber ?? slotIndex + 1),
      attr: buttonAttributes,
      className: 'quiz-hunt-summary-tile',
      style: { '--quiz-hunt-group-color': group.color },
      move: { target },
    },
    ...(eventName === undefined || !playable ? {} : { emit: { click: { event: { name: eventName, visibility: 'public' as const } } } }),
    actions: page === null ? {} : {
      [tileStatusEvent(page.id, 'available')]: {
        content: String(tileNumber ?? slotIndex + 1),
        className: { add: 'quiz-hunt-summary-tile', remove: 'is-success is-failed' },
        attr: { ...buttonAttributes, disabled: !playable },
      },
      [tileStatusEvent(page.id, 'success')]: {
        content: '✓',
        className: { add: 'is-success', remove: 'is-failed' },
        attr: { ...buttonAttributes, disabled: true },
      },
      [tileStatusEvent(page.id, 'failed')]: {
        content: '✕',
        className: { add: 'is-failed', remove: 'is-success' },
        attr: { ...buttonAttributes, disabled: true },
      },
      [MENU_TERMINAL_EVENT]: { attr: { ...buttonAttributes, disabled: true } },
    },
  }
}

/** Projects Sighty-owned statuses into the summary tiles after a view transition. */
function projectTileStatuses(
  groups: readonly Readonly<{ group: QuizHuntGroup; index: number; slots: readonly (QuizHuntPage | null)[] }>[],
  value: unknown,
  finalReady: unknown,
  terminal: unknown,
): Readonly<{ events: readonly Readonly<{ name: string }>[] }> {
  const statuses = readRecord(value)
  const events = groups.flatMap(({ slots }) => slots.flatMap((page) => {
    if (page === null) return []
    const status = readTrialStatus(statuses[page.id])
    return [{ name: tileStatusEvent(page.id, status) }]
  }))
  return {
    events: [
      ...events,
      ...(terminal === true ? [{ name: MENU_TERMINAL_EVENT }] : []),
      { name: finalReady === true ? 'quiz-hunt:menu:final:ready' : 'quiz-hunt:menu:final:locked' },
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

/** Styles the Sommaire as either a responsive board or color-group slides. */
function createSummaryStyleSheet(): string {
  return `
.quiz-hunt-summary {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: clamp(0.75rem, 2vw, 1.5rem);
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: clamp(0.75rem, 2vw, 1.5rem);
  color: #f8fafc;
  background: #152238;
  overflow: hidden;
}

.quiz-hunt-summary__title {
  margin: 0;
  font-size: clamp(1.25rem, 3vw, 2rem);
  text-align: center;
}

.quiz-hunt-summary__groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: clamp(0.5rem, 1.5vw, 1rem);
  min-height: 0;
  overflow: auto;
}

.quiz-hunt-summary-group {
  display: grid;
  align-content: start;
  gap: 0.75rem;
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid rgb(226 232 240 / 20%);
  border-top: 0.35rem solid var(--quiz-hunt-group-color, #94a3b8);
  border-radius: 0.75rem;
  background: rgb(255 255 255 / 5%);
  scroll-snap-align: start;
}

.quiz-hunt-summary-group__header { min-width: 0; }
.quiz-hunt-summary-group__title { margin: 0; font-size: 1.05rem; }
.quiz-hunt-summary-group__tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }

.quiz-hunt-summary-tile {
  display: grid;
  place-items: center;
  min-width: 2.75rem;
  min-height: 2.75rem;
  border: 2px solid var(--quiz-hunt-group-color, #94a3b8);
  border-radius: 0.6rem;
  background: linear-gradient(145deg, color-mix(in srgb, var(--quiz-hunt-group-color) 82%, white), var(--quiz-hunt-group-color));
  color: white;
  font: inherit;
  font-size: 1.2rem;
  font-weight: 800;
  cursor: pointer;
}

.quiz-hunt-summary-tile:disabled { opacity: 0.35; cursor: not-allowed; }
.quiz-hunt-summary-tile.is-success { border-color: #6ee7b7; background: #176044; }
.quiz-hunt-summary-tile.is-failed { border-color: #fca5a5; background: #7f1d1d; }
.quiz-hunt-summary-final { justify-self: center; min-height: 2.75rem; padding: 0.65rem 1.25rem; border: 0; border-radius: 0.4rem; background: #fffdf8; color: #263b3a; font: inherit; font-weight: 700; cursor: pointer; }
.quiz-hunt-summary-final:disabled { opacity: 0.45; cursor: not-allowed; }

.quiz-hunt-summary--diapo .quiz-hunt-summary__groups {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
}

.quiz-hunt-summary--diapo .quiz-hunt-summary-group {
  flex: 0 0 min(100%, 34rem);
  align-content: center;
}

.quiz-hunt-summary--diapo .quiz-hunt-summary-group__tiles {
  grid-template-columns: repeat(2, minmax(3.5rem, 1fr));
  max-width: 18rem;
  width: 100%;
  margin-inline: auto;
}

@media (max-width: 40em) {
  .quiz-hunt-summary { overflow-y: auto; }
  .quiz-hunt-summary__groups { grid-template-columns: 1fr; }
  .quiz-hunt-summary--diapo .quiz-hunt-summary-group { flex-basis: 100%; }
}
`
}

