import type { SceneDoc } from 'codplay/scene/types'
import { resolveReplacePresetChoice } from 'codplay'
import nostromoVideoUrl from '../../../v1/scenes/quiz-hunt/assets/questions/nostromo.mp4?url'

/** Total duration owned by the replacement acceptance scene. */
export const SCENE_DURATION_MS = 7_000

const REPLACE_FORWARD_EVENT = 'replace:forward'
const REPLACE_BACK_EVENT = 'replace:back'
const VIDEO_START_EVENT = 'replace:video-start'
const TEXT_A = 'La lumière du matin'
const TEXT_B = 'Le silence du soir'
const IMAGE_A = '/assets/35c8ec5a07fc.jpg'
const IMAGE_B = '/assets/28970388742_2f75d527d6_z.jpg'
const VIDEO_A = '/assets/LcXkmXyuZQ.mp4'
const VIDEO_B = nostromoVideoUrl

type ScenePerso = SceneDoc['stories']['main']['persos'][number]

/** Creates the V2 replacement fixture through the shared demo layout/player. */
export function createScene(): SceneDoc {
  const mediaPersos = [
    createImagePerso('whole'),
    createImagePerso('cells'),
    createVideoPerso('whole'),
    createVideoPerso('cells'),
  ]
  const textPersos = [createTagPerso(), createTextPerso('letter'), createTextPerso('word'), createTextPerso('line')]

  return {
    id: 'replace-carousel-v2-scene',
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        persos: [
          createStage(),
          ...textPersos,
          ...mediaPersos,
        ],
        eventimes: [
          { name: VIDEO_START_EVENT, startAt: 0 },
          { name: REPLACE_FORWARD_EVENT, startAt: 1_500 },
          { name: REPLACE_BACK_EVENT, startAt: 4_000 },
        ],
      },
    },
    eventimes: [{ name: 'sequence:end', startAt: SCENE_DURATION_MS }],
  }
}

/** Creates the full text, image, and video replacement acceptance grid. */
function createStage(): ScenePerso {
  return {
    id: 'replace-carousel-stage',
    type: 'layout',
    initial: {
      move: '@root',
      markup: `
        <section id="replace-stage" class="replace-stage">
          <article id="replace-card-tag" class="replace-card">
            <h2 id="replace-label-tag" class="replace-card__label">tag · entier</h2>
            <div id="replace-outlet-tag" class="replace-card__outlet" data-part="replace-carousel-stage:tag"></div>
          </article>
          <article id="replace-card-letter" class="replace-card">
            <h2 id="replace-label-letter" class="replace-card__label">text · letter</h2>
            <div id="replace-outlet-letter" class="replace-card__outlet" data-part="replace-carousel-stage:letter"></div>
          </article>
          <article id="replace-card-word" class="replace-card">
            <h2 id="replace-label-word" class="replace-card__label">text · word</h2>
            <div id="replace-outlet-word" class="replace-card__outlet" data-part="replace-carousel-stage:word"></div>
          </article>
          <article id="replace-card-line" class="replace-card">
            <h2 id="replace-label-line" class="replace-card__label">text · line</h2>
            <div id="replace-outlet-line" class="replace-card__outlet" data-part="replace-carousel-stage:line"></div>
          </article>
          <article id="replace-card-image" class="replace-card">
            <h2 id="replace-label-image" class="replace-card__label">image · entier</h2>
            <div id="replace-outlet-image" class="replace-card__outlet" data-part="replace-carousel-stage:image"></div>
          </article>
          <article id="replace-card-image-cells" class="replace-card">
            <h2 id="replace-label-image-cells" class="replace-card__label">image · cells · cercle SVG · 8%</h2>
            <div id="replace-outlet-image-cells" class="replace-card__outlet" data-part="replace-carousel-stage:image-cells"></div>
          </article>
          <article id="replace-card-video" class="replace-card">
            <h2 id="replace-label-video" class="replace-card__label">video · entier</h2>
            <div id="replace-outlet-video" class="replace-card__outlet" data-part="replace-carousel-stage:video"></div>
          </article>
          <article id="replace-card-video-cells" class="replace-card">
            <h2 id="replace-label-video-cells" class="replace-card__label">video · cells · chemin SVG · 8%</h2>
            <div id="replace-outlet-video-cells" class="replace-card__outlet" data-part="replace-carousel-stage:video-cells"></div>
          </article>
        </section>
      `,
    },
    actions: {},
  }
}

/** Creates the plain tag case retained from the V1 replacement carousel. */
function createTagPerso(): ScenePerso {
  return {
    id: 'replace-tag',
    type: 'tag',
    initial: {
      tag: 'p',
      content: TEXT_A,
      className: 'replace-copy',
      move: { target: 'replace-carousel-stage:tag' },
    },
    actions: {
      [REPLACE_FORWARD_EVENT]: {
        content: TEXT_B,
        replace: { transition: resolveReplacePresetChoice('swipe', 'left'), duration: 700 },
      },
      [REPLACE_BACK_EVENT]: {
        content: TEXT_A,
        replace: { transition: resolveReplacePresetChoice('swipe', 'left'), duration: 700 },
      },
    },
  }
}

/** Creates one rich text case for letter, word, or displayed-line segmentation. */
function createTextPerso(split: 'letter' | 'word' | 'line'): ScenePerso {
  const contentA = split === 'line' ? 'La largeur du cadre décide des lignes' : `<strong>${TEXT_A}</strong>`
  const contentB = split === 'line' ? 'Le texte suit le nouvel affichage' : `<em>${TEXT_B}</em>`
  const transition = split === 'letter'
    ? resolveReplacePresetChoice('glyph-roll', 'up')
    : resolveReplacePresetChoice('swipe', split === 'line' ? 'up' : 'left')

  return {
    id: `replace-text-${split}`,
    type: 'text',
    initial: {
      tag: 'p',
      content: contentA,
      className: 'replace-copy',
      move: { target: `replace-carousel-stage:${split}` },
    },
    actions: {
      [REPLACE_FORWARD_EVENT]: {
        content: contentB,
        replace: { transition, duration: 700, split },
      },
      [REPLACE_BACK_EVENT]: {
        content: contentA,
        replace: { transition, duration: 700, split },
      },
    },
  }
}

/** Creates an image replacement with either one view or two staggered cell grids. */
function createImagePerso(mode: 'whole' | 'cells'): ScenePerso {
  const splitOptions = mode === 'cells'
    ? { split: 'cells' as const, cellSize: 8, direction: 'center' as const, stagger: 18 }
    : undefined
  const replace = mode === 'cells'
    ? { transition: 'mask-reveal' as const, duration: 900, ...splitOptions }
    : { transition: resolveReplacePresetChoice('tilt', 'right'), duration: 700 }
  const target = mode === 'whole' ? 'image' : 'image-cells'

  return {
    id: `replace-image-${mode}`,
    type: 'img',
    initial: {
      src: IMAGE_A,
      className: 'replace-image',
      img: { style: { objectFit: 'cover' } },
      move: { target: `replace-carousel-stage:${target}` },
    },
    actions: {
      [REPLACE_FORWARD_EVENT]: { src: IMAGE_B, replace },
      [REPLACE_BACK_EVENT]: { src: IMAGE_A, replace },
    },
  }
}

/** Creates a muted video replacement with fixed-frame whole or cell presentation. */
function createVideoPerso(mode: 'whole' | 'cells'): ScenePerso {
  const splitOptions = mode === 'cells'
    ? { split: 'cells' as const, cellSize: 8, direction: 'edges' as const, stagger: 24 }
    : undefined
  const replace = mode === 'cells'
    ? {
        transition: 'wipe' as const,
        duration: 900,
        shape: {
          path: 'M50 0 C60 20 80 20 100 50 C80 60 80 80 50 100 C40 80 20 80 0 50 C20 40 20 20 50 0 Z',
          viewBox: '0 0 100 100',
        },
        ...splitOptions,
      }
    : { transition: 'slide-over' as const, duration: 700 }
  const target = mode === 'whole' ? 'video' : 'video-cells'

  return {
    id: `replace-video-${mode}`,
    type: 'media',
    initial: {
      tag: 'video',
      src: VIDEO_A,
      sync: 'auto',
      className: 'replace-video',
      video: {
        style: { objectFit: 'cover' },
        attr: { muted: true, playsInline: true },
      },
      move: { target: `replace-carousel-stage:${target}` },
    },
    actions: {
      [VIDEO_START_EVENT]: { broadcast: { type: 'START' } },
      [REPLACE_FORWARD_EVENT]: { src: VIDEO_B, replace, broadcast: { type: 'START' } },
      [REPLACE_BACK_EVENT]: { src: VIDEO_A, replace, broadcast: { type: 'START' } },
    },
  }
}
