import type { SceneDoc } from 'codplay/scene/types'
import { REPLACE_HTML_IN_CANVAS_TRANSITIONS } from 'codplay'
import nostromoVideoUrl from '../../../v1/scenes/quiz-hunt/assets/questions/nostromo.mp4?url'

const VIDEO_START_EVENT = 'hic:video-start'
const FIRST_EFFECT_MS = 800
/** Each tile plays its forward effect, a pause, then its return, before the next tile. */
const TILE_SPAN_MS = 3_200
const RETURN_OFFSET_MS = 1_600
const IMAGE_A = '/assets/35c8ec5a07fc.jpg'
const IMAGE_B = '/assets/28970388742_2f75d527d6_z.jpg'
const VIDEO_A = '/assets/LcXkmXyuZQ.mp4'
const VIDEO_B = nostromoVideoUrl
const TRANSITION_DURATION_MS = 1_200
const TILE_IDS = [...REPLACE_HTML_IN_CANVAS_TRANSITIONS, 'video'] as const

/** Total duration owned by the HTML-in-Canvas transition review. */
export const SCENE_DURATION_MS = FIRST_EFFECT_MS + TILE_IDS.length * TILE_SPAN_MS

type ScenePerso = SceneDoc['stories']['main']['persos'][number]
type HtmlInCanvasTransition = (typeof REPLACE_HTML_IN_CANVAS_TRANSITIONS)[number]

/** Creates one image tile per HTML-in-Canvas effect, plus one video tile, on the shared V2 player. */
export function createScene(): SceneDoc {
  return {
    id: 'hic-transitions-v2-scene',
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        persos: [
          createStage(),
          ...REPLACE_HTML_IN_CANVAS_TRANSITIONS.map(createImagePerso),
          createVideoPerso(),
        ],
        eventimes: [
          { name: VIDEO_START_EVENT, startAt: 0 },
          ...TILE_IDS.flatMap((tile, index) => {
            const startAt = FIRST_EFFECT_MS + index * TILE_SPAN_MS
            return [
              { name: forwardEvent(tile), startAt },
              { name: backEvent(tile), startAt: startAt + RETURN_OFFSET_MS },
            ]
          }),
        ],
      },
    },
    eventimes: [{ name: 'sequence:end', startAt: SCENE_DURATION_MS }],
  }
}

/** Creates the grid of labelled tiles, one outlet per effect. */
function createStage(): ScenePerso {
  const tiles = [...REPLACE_HTML_IN_CANVAS_TRANSITIONS.map((transition) => ({
    id: transition,
    label: `image · ${transition}`,
  })), { id: 'video', label: 'vidéo · swirl' }]
  return {
    id: 'hic-stage',
    type: 'layout',
    initial: {
      move: '@root',
      markup: `
        <section id="hic-stage-grid" class="hic-stage">
          ${tiles.map((tile) => `
          <article id="hic-card-${tile.id}" class="hic-card">
            <h2 id="hic-label-${tile.id}" class="hic-card__label">${tile.label}</h2>
            <div id="hic-outlet-${tile.id}" class="hic-card__outlet" data-part="hic-stage:${tile.id}"></div>
          </article>`).join('')}
        </section>
      `,
    },
    actions: {},
  }
}

/** Creates one image swapped forward and back by one HTML-in-Canvas effect. */
function createImagePerso(transition: HtmlInCanvasTransition): ScenePerso {
  const replace = { transition, duration: TRANSITION_DURATION_MS }
  return {
    id: `hic-image-${transition}`,
    type: 'img',
    initial: {
      src: IMAGE_A,
      className: 'hic-media',
      img: { style: { objectFit: 'cover' } },
      move: { target: `hic-stage:${transition}` },
    },
    actions: {
      [forwardEvent(transition)]: { src: IMAGE_B, replace },
      [backEvent(transition)]: { src: IMAGE_A, replace },
    },
  }
}

/** Creates one muted video whose incoming image keeps playing during its swirl. */
function createVideoPerso(): ScenePerso {
  const replace = { transition: 'swirl' as const, duration: TRANSITION_DURATION_MS }
  return {
    id: 'hic-video',
    type: 'media',
    initial: {
      tag: 'video',
      src: VIDEO_A,
      sync: 'auto',
      className: 'hic-media',
      video: { style: { objectFit: 'cover' }, attr: { muted: true, playsInline: true } },
      move: { target: 'hic-stage:video' },
    },
    actions: {
      [VIDEO_START_EVENT]: { broadcast: { type: 'START' } },
      [forwardEvent('video')]: { src: VIDEO_B, replace, broadcast: { type: 'START' } },
      [backEvent('video')]: { src: VIDEO_A, replace, broadcast: { type: 'START' } },
    },
  }
}

/** Names the forward swap of one tile. */
function forwardEvent(tile: string): string {
  return `hic:${tile}:forward`
}

/** Names the return swap of one tile. */
function backEvent(tile: string): string {
  return `hic:${tile}:back`
}
