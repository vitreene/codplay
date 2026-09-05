import { prepareSvgPath } from 'ace'
import type { StoryDoc } from 'codplay'
import {
  CAROUSEL_SLIDE_DURATION_MS,
  CAROUSEL_SLIDE_OFFSET_PX,
  POSITION_MOVE_DURATION_MS,
  POSITION_PATH_CAPTURE_EVENT,
  POSITION_PATH_COMMIT_STRAP,
  POSITION_PATH_CONTROL_LIVE_EVENT,
  POSITION_PATH_CONTROL_SETTLED_EVENT,
  POSITION_PATH_ITEM_MOVE_EVENT,
  POSITION_STORY_THREE_ID,
  POSITION_VIEWPORT_TARGET,
  VIEW_IDS,
} from './constants'
import { CAROUSEL_EVENTS, POSITION_CAPSULE } from './carousel'
import { clamp, preparePositionPath, readFinite, readRecord } from './shared'
import type { StoryAnimationOccurrence } from './types'

const SOURCE_CONTAINER = 'position:view-three:source'
const TARGET_CONTAINER = 'position:view-three:target'
const CONTROL_TARGET = 'position:view-three:control'
const STORY_THREE_PATH = prepareSvgPath('M 0 0 A 0.5 0.5 0 0 1 1 0', { precision: 2 })

/** Story 3: the captured midpoint is sent as a prepared path in the item move. */
export const POSITION_STORY_THREE: StoryDoc = {
  id: POSITION_STORY_THREE_ID,
  state: {
    pathControlX: 0.5,
    pathControlY: -0.48,
  },
  straps: {
    [POSITION_PATH_COMMIT_STRAP]: ({ event }) => {
      const captureState = readRecord(readRecord(event.data)?.captureState)
      if (captureState === undefined) return undefined
      return {
        update: {
          pathControlX: clamp(readFinite(captureState.controlX, 0.5), 0.12, 0.88),
          pathControlY: clamp(readFinite(captureState.controlY, -0.48), -0.9, 0.9),
        },
      }
    },
  },
  listen: [{
    on: POSITION_PATH_CAPTURE_EVENT,
    transform: [(event) => {
      const captureState = readRecord(readRecord(event.data)?.captureState)
      if (captureState === undefined) return undefined
      const controlX = clamp(readFinite(captureState.controlX, 0.5), 0.12, 0.88)
      const controlY = clamp(readFinite(captureState.controlY, -0.48), -0.9, 0.9)
      const path = preparePositionPath(controlX, controlY)
      return [
        {
          name: POSITION_PATH_ITEM_MOVE_EVENT,
          data: {
            move: {
              target: TARGET_CONTAINER,
              flipMode: 'overlay-world',
              transition: {
                duration: POSITION_MOVE_DURATION_MS,
                ease: 'inOutCubic',
                path,
              },
            },
          },
        },
        {
          name: POSITION_PATH_CONTROL_SETTLED_EVENT,
          data: {
            style: {
              x: (controlX - 0.5) * 260,
              y: controlY * 120,
            },
          },
        },
      ]
    }],
    straps: [POSITION_PATH_COMMIT_STRAP],
  }],
  persos: [
    {
      id: VIEW_IDS[2],
      type: 'layout',
      initial: {
        move: { target: POSITION_VIEWPORT_TARGET },
        className: `${POSITION_CAPSULE.children[2]!.className} position-story-cell position-view--hidden`,
        markup: `
          <section class="position-view__frame position-view__frame--lesson">
            <div class="position-path-stage">
              <article class="position-node position-node--source">
                <strong>source</strong>
                <div class="position-node__outlet" data-part="${SOURCE_CONTAINER}"></div>
              </article>
              <div class="position-path-visual">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M 8 55 A 42 42 0 0 0 92 55" pathLength="1"></path>
                  <path class="position-path-visual__ghost" d="M 8 55 L 92 55" pathLength="1"></path>
                </svg>
                <div class="position-path-control-zone" data-part="${CONTROL_TARGET}"></div>
              </div>
              <article class="position-node position-node--target">
                <strong>cible</strong>
                <div class="position-node__outlet" data-part="${TARGET_CONTAINER}"></div>
              </article>
            </div>
            <div class="position-story-caption">
              <span class="position-story-caption__number">03</span>
              <p>Déplacez le point médian. La capture prépare un path, puis le transmet au move de l’item.</p>
            </div>
          </section>
        `,
      },
      actions: {
        [CAROUSEL_EVENTS[2].intro]: {
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
        [CAROUSEL_EVENTS[2].outro]: {
          className: {
            add: 'position-view--hidden',
            remove: 'position-view--visible',
          },
        },
      },
    },
    {
      id: 'position-view-three-path-control',
      type: 'tag',
      initial: {
        tag: 'button',
        content: '·',
        className: 'position-path-control',
        attr: { type: 'button', 'aria-label': 'Déplacer le point médian du path' },
        style: {
          x: 0,
          y: -57.6,
        },
        move: { target: CONTROL_TARGET },
      },
      emit: {
        pointerdown: {
          preventDefault: true,
          event: { name: `${POSITION_PATH_CAPTURE_EVENT}:grabbed` },
          capture: {
            trackOn: ['pointermove'],
            endOn: ['pointerup', 'pointercancel'],
            stateScope: 'story',
            initCaptureState: ({ state }) => ({
              controlX: clamp(readFinite(state.pathControlX, 0.5), 0.12, 0.88),
              controlY: clamp(readFinite(state.pathControlY, -0.48), -0.9, 0.9),
            }),
            trackCommand: ({ sample, captureState }) => {
              const previousX = clamp(readFinite(captureState.controlX, 0.5), 0.12, 0.88)
              const previousY = clamp(readFinite(captureState.controlY, -0.48), -0.9, 0.9)
              const controlX = clamp(previousX + readFinite(sample.movementX, 0) / 260, 0.12, 0.88)
              const controlY = clamp(previousY + readFinite(sample.movementY, 0) / 150, -0.9, 0.9)
              return {
                action: {
                  actionName: POSITION_PATH_CONTROL_LIVE_EVENT,
                  data: {
                    style: {
                      x: (controlX - 0.5) * 260,
                      y: controlY * 120,
                    },
                  },
                },
                captureState: { controlX, controlY },
                updateState: { pathControlX: controlX, pathControlY: controlY },
              }
            },
            endEmit: { name: POSITION_PATH_CAPTURE_EVENT },
          },
        },
      },
      actions: {
        [POSITION_PATH_CONTROL_LIVE_EVENT]: true,
        [POSITION_PATH_CONTROL_SETTLED_EVENT]: true,
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
  ],
}

/** Eventime appended when navigation activates story 3. */
export const POSITION_STORY_THREE_ANIMATION_PLAN: readonly StoryAnimationOccurrence[] = [{
  name: POSITION_PATH_ITEM_MOVE_EVENT,
  offsetMs: 1_050,
  data: {
    move: {
      target: TARGET_CONTAINER,
      flipMode: 'overlay-world',
      transition: {
        duration: POSITION_MOVE_DURATION_MS,
        ease: 'inOutCubic',
        path: STORY_THREE_PATH,
      },
    },
  },
}]
