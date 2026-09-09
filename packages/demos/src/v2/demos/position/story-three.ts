import type { Path } from 'ace'
import type { PersoDoc, StoryDoc } from 'codplay'
import type { PlannedStrapHelpers, PlannedStrapOccurrence, StrapFunction } from 'codplay/runtime/player'
import {
  CAROUSEL_SLIDE_DURATION_MS,
  CAROUSEL_SLIDE_OFFSET_PX,
  POSITION_MOVE_DURATION_MS,
  POSITION_PATH_BROKEN_SELECT_EVENT,
  POSITION_PATH_INITIALIZE_EVENT,
  POSITION_PATH_ITEM_MOVE_EVENT,
  POSITION_PATH_LOOP_SELECT_EVENT,
  POSITION_NAMESPACE,
  POSITION_PATH_QUADRATIC_SELECT_EVENT,
  POSITION_PATH_SELECT_STRAP,
  POSITION_PATH_STRAIGHT_SELECT_EVENT,
  POSITION_STORY_END_EVENT,
  POSITION_STORY_THREE_ID,
  POSITION_STORY_VIEW_IDS,
  POSITION_VIEWPORT_TARGET,
} from './constants'
import {
  CAROUSEL_EVENTS_BY_STORY_ID,
  isInitialPositionStory,
} from './carousel'
import {
  createPositionMoveData,
  prepareAuthoredPositionPath,
  prepareQuadraticPositionPath,
} from './shared'
import type { StoryAnimationOccurrence } from './types'

const SOURCE_CONTAINER = 'position:view-three:source'
const TARGET_CONTAINER = 'position:view-three:target'
const PATH_BUTTONS_TARGET = 'position:view-three:path-buttons'
const INITIAL_PATH_ITEM_POSITION = 'source' as const
const STORY_THREE_START_STRAP = `${POSITION_NAMESPACE}:path:start`

type PathItemPosition = typeof INITIAL_PATH_ITEM_POSITION | 'target'

type PathSelection = Readonly<{
  id: string
  label: string
  eventName: string
  visualClass: string
  path: Path
}>

export const POSITION_STORY_THREE_STRAIGHT_PATH_D = 'M 0 0 L 1 0'
export const POSITION_STORY_THREE_QUADRATIC_PATH_D = 'M 0 0 Q 0.5 -0.82 1 0'
export const POSITION_STORY_THREE_BROKEN_PATH_D = 'M 0 0 L 0.2 -0.18 L 0.4 0.14 L 0.6 -0.09 L 0.8 0.12 L 1 0'
export const POSITION_STORY_THREE_LOOP_PATH_D = 'M 0 0 L 0.24 0 A 0.24 0.24 0 0 1 0.72 0 A 0.24 0.24 0 0 1 0.24 0 L 1 0'
const POSITION_STORY_THREE_PATH_VISUAL_TRANSFORM = 'translate(8 55) scale(84)'

const PATH_SELECTIONS: readonly PathSelection[] = [
  {
    id: 'position-view-three-path-straight',
    label: 'droit',
    eventName: POSITION_PATH_STRAIGHT_SELECT_EVENT,
    visualClass: 'position-path-view--straight',
    path: prepareAuthoredPositionPath(POSITION_STORY_THREE_STRAIGHT_PATH_D),
  },
  {
    id: 'position-view-three-path-quadratic',
    label: 'quadratique',
    eventName: POSITION_PATH_QUADRATIC_SELECT_EVENT,
    visualClass: 'position-path-view--quadratic',
    path: prepareQuadraticPositionPath(0.5, -0.82),
  },
  {
    id: 'position-view-three-path-broken',
    label: 'brisée',
    eventName: POSITION_PATH_BROKEN_SELECT_EVENT,
    visualClass: 'position-path-view--broken',
    path: prepareAuthoredPositionPath(POSITION_STORY_THREE_BROKEN_PATH_D),
  },
  {
    id: 'position-view-three-path-loop',
    label: 'boucle',
    eventName: POSITION_PATH_LOOP_SELECT_EVENT,
    visualClass: 'position-path-view--loop',
    path: prepareAuthoredPositionPath(POSITION_STORY_THREE_LOOP_PATH_D),
  },
]

const PATH_VISUAL_CLASSES = PATH_SELECTIONS.map((selection) => selection.visualClass)
const STORY_THREE_PATH = PATH_SELECTIONS[0]!.path
const STORY_THREE_END_OFFSET_MS = 1_050 + POSITION_MOVE_DURATION_MS
const STORY_EVENTS = CAROUSEL_EVENTS_BY_STORY_ID[POSITION_STORY_THREE_ID]

/** Reads the last physical side recorded for the story-three item. */
function readPathItemPosition(value: unknown): PathItemPosition | undefined {
  return value === 'source' || value === 'target' ? value : undefined
}

/** Returns the opposite physical side for the next path move. */
function oppositePathItemPosition(position: PathItemPosition): PathItemPosition {
  return position === 'source' ? 'target' : 'source'
}

/** Returns the outlet that receives the item at one recorded physical side. */
function containerForPathItemPosition(position: PathItemPosition): string {
  return position === 'source' ? SOURCE_CONTAINER : TARGET_CONTAINER
}

/** Creates one path move and records its destination for the next button click. */
function createStoryThreeMoveData(position: PathItemPosition, path: Path): ReturnType<typeof createPositionMoveData> {
  return {
    ...createPositionMoveData(containerForPathItemPosition(position), path, 'overlay'),
    pathItemPosition: position,
  }
}

/** Starts the story-local automatic move and records its destination in story state. */
function createStoryThreeStartStrap(): StrapFunction {
  return ({ context }) => planStoryThreeAnimation(context.planned)
}

/** Schedules only the authored first move for one story-three activation. */
function planStoryThreeAnimation(
  planned: Pick<PlannedStrapHelpers, 'wait'>,
): readonly PlannedStrapOccurrence[] {
  return POSITION_STORY_THREE_ANIMATION_PLAN.flatMap((occurrence) => planned.wait(occurrence.offsetMs, {
    event: {
      name: occurrence.name,
      visibility: 'story',
      ...(occurrence.data === undefined ? {} : { data: occurrence.data }),
    },
    ...(occurrence.update === undefined ? {} : { update: occurrence.update }),
  }))
}

/** Builds the class and accessibility actions for one path preset button. */
function createPathButtonActions(buttonSelection: PathSelection): Record<string, Record<string, unknown>> {
  return Object.fromEntries(PATH_SELECTIONS.map((selection) => {
    const selected = selection.eventName === buttonSelection.eventName
    return [selection.eventName, {
      className: selected
        ? { add: 'position-path-button--active' }
        : { remove: 'position-path-button--active' },
      attr: {
        id: buttonSelection.id,
        type: 'button',
        'aria-label': `Appliquer un trajet ${buttonSelection.label}`,
        'aria-pressed': String(selected),
      },
    }]
  }))
}

/** Creates one declarative button that selects a prepared trajectory preset. */
function createPathButton(selection: PathSelection): PersoDoc<'tag'> {
  const selected = selection === PATH_SELECTIONS[0]
  return {
    id: selection.id,
    type: 'tag',
    initial: {
      tag: 'button',
      content: selection.label,
      className: `position-path-button${selected ? ' position-path-button--active' : ''}`,
      attr: {
        id: selection.id,
        type: 'button',
        'aria-label': `Appliquer un trajet ${selection.label}`,
        'aria-pressed': String(selected),
      },
      move: { target: PATH_BUTTONS_TARGET },
    },
    emit: {
      click: { event: { name: selection.eventName } },
    },
    actions: createPathButtonActions(selection),
  }
}

/** Builds the root class actions that switch the path drawing with the preset. */
function createPathVisualActions(): Record<string, Record<string, unknown>> {
  return Object.fromEntries(PATH_SELECTIONS.map((selection) => [selection.eventName, {
    className: {
      add: selection.visualClass,
      remove: PATH_VISUAL_CLASSES.filter((visualClass) => visualClass !== selection.visualClass).join(' '),
    },
  }]))
}

/** Story 3: each path button emits one prepared move from the current side. */
export const POSITION_STORY_THREE: StoryDoc = {
  id: POSITION_STORY_THREE_ID,
  state: {
    pathItemPosition: INITIAL_PATH_ITEM_POSITION,
  },
  straps: {
    [STORY_THREE_START_STRAP]: createStoryThreeStartStrap(),
    [POSITION_PATH_SELECT_STRAP]: ({ event, state }) => {
      const selection = PATH_SELECTIONS.find((candidate) => candidate.eventName === event.name)
      if (selection === undefined) return undefined
      const currentPosition = readPathItemPosition(state.pathItemPosition) ?? INITIAL_PATH_ITEM_POSITION
      const destination = oppositePathItemPosition(currentPosition)
      return {
        update: { pathItemPosition: destination },
        events: [{
          name: POSITION_PATH_ITEM_MOVE_EVENT,
          data: createStoryThreeMoveData(destination, selection.path),
        }],
      }
    },
  },
  listen: [{
    on: STORY_EVENTS.enter,
    active: true,
    reset: true,
  }, {
    on: STORY_EVENTS.leave,
    active: false,
  }, {
    on: STORY_EVENTS.reset,
    reset: true,
  }, {
    on: POSITION_PATH_INITIALIZE_EVENT,
    straps: [STORY_THREE_START_STRAP],
  }, ...PATH_SELECTIONS.map((selection) => ({
    on: selection.eventName,
    straps: [POSITION_PATH_SELECT_STRAP],
  }))],
  persos: [
    {
      id: POSITION_STORY_VIEW_IDS[POSITION_STORY_THREE_ID],
      type: 'layout',
      initial: {
        move: { target: POSITION_VIEWPORT_TARGET },
        className: `position-view position-story-cell position-path-view--straight ${isInitialPositionStory(POSITION_STORY_THREE_ID) ? 'position-view--visible' : 'position-view--hidden'}`,
        markup: `
          <section class="position-view__frame position-view__frame--lesson">
            <div class="position-path-stage">
              <article class="position-node position-node--source">
                <strong>source</strong>
                <div class="position-node__outlet" data-part="${SOURCE_CONTAINER}"></div>
              </article>
              <div class="position-path-visual">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <path class="position-path-visual__path position-path-visual__path--straight" d="${POSITION_STORY_THREE_STRAIGHT_PATH_D}" transform="${POSITION_STORY_THREE_PATH_VISUAL_TRANSFORM}" pathLength="1"></path>
                  <path class="position-path-visual__path position-path-visual__path--quadratic" d="${POSITION_STORY_THREE_QUADRATIC_PATH_D}" transform="${POSITION_STORY_THREE_PATH_VISUAL_TRANSFORM}" pathLength="1"></path>
                  <path class="position-path-visual__path position-path-visual__path--broken" d="${POSITION_STORY_THREE_BROKEN_PATH_D}" transform="${POSITION_STORY_THREE_PATH_VISUAL_TRANSFORM}" pathLength="1"></path>
                  <path class="position-path-visual__path position-path-visual__path--loop" d="${POSITION_STORY_THREE_LOOP_PATH_D}" transform="${POSITION_STORY_THREE_PATH_VISUAL_TRANSFORM}" pathLength="1"></path>
                </svg>
              </div>
              <article class="position-node position-node--target">
                <strong>cible</strong>
                <div class="position-node__outlet" data-part="${TARGET_CONTAINER}"></div>
              </article>
              <div class="position-path-picker" data-part="${PATH_BUTTONS_TARGET}" role="group" aria-label="Choisir une trajectoire"></div>
            </div>
            <div class="position-story-caption">
              <span class="position-story-caption__number">03</span>
              <p>Choisissez un path. Chaque choix prépare la trajectoire puis projette l’item de sa position courante vers l’autre position.</p>
            </div>
          </section>
        `,
      },
      actions: {
        [STORY_EVENTS.intro]: {
          className: {
            add: 'position-view--visible',
            remove: 'position-view--hidden',
          },
          style: {
            x: {
              from: CAROUSEL_SLIDE_OFFSET_PX,
              to: 0,
              duration: CAROUSEL_SLIDE_DURATION_MS,
              ease: 'out(2)',
            },
          },
        },
        [STORY_EVENTS.outro]: {
          className: {
            add: 'position-view--hidden',
            remove: 'position-view--visible',
          },
        },
        ...createPathVisualActions(),
      },
    },
    {
      id: 'position-view-three-item',
      type: 'tag',
      initial: {
        tag: 'span',
        content: 'item',
        className: 'position-item position-item--cyan',
        move: { target: SOURCE_CONTAINER },
      },
      actions: {
        [POSITION_PATH_ITEM_MOVE_EVENT]: true,
      },
    },
    ...PATH_SELECTIONS.map(createPathButton),
  ],
}

/** Eventime appended when navigation activates story 3. */
export const POSITION_STORY_THREE_ANIMATION_PLAN: readonly StoryAnimationOccurrence[] = [{
  name: POSITION_PATH_ITEM_MOVE_EVENT,
  offsetMs: 1_050,
  data: createStoryThreeMoveData('target', STORY_THREE_PATH),
  update: { pathItemPosition: 'target' },
}, {
  name: POSITION_STORY_END_EVENT,
  offsetMs: STORY_THREE_END_OFFSET_MS,
}]
