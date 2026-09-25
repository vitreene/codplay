import type { CodPlayEngineOptions } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import { prepareTween, resolveTween } from 'ace'
import chapterImageUrl from '../components/component-demo-image.svg?url'
import {
  SCROLL_CONTAINER_COMPONENT_DEFINITION,
  SCROLL_CONTAINER_MODULE_DEFINITION,
  createScrollContainerSourceAdapter,
} from '@codplay/component-v2'

const SCENE_ID = 'scroll-container-scene-v2'
const STORY_ID = 'scroll-container-story'
const SCROLL_ID = 'chapter-scrollport'
const PROGRESS_TRACK_ID = 'chapter-progress-track'
const PROGRESS_METER_ID = 'chapter-progress-meter'
const PROGRESS_ACTION = 'chapter:scroll:progress:live'
const SCROLL_PROGRESS_EVENT = 'chapter:scroll:progress'
const IMAGE_ENTER_EVENT = 'chapter:image:enter'
const IMAGE_LEAVE_EVENT = 'chapter:image:leave'
const IMAGE_HIDDEN_OFFSET = '-112%'
const CHAPTER_TITLE_LIGHTNESS = 42
const CHAPTER_TITLE_CHROMA = 0.12
const CHAPTER_TITLE_HUE_ROTATION = 90

type ScrollPerso = SceneDoc<string>['stories'][string]['persos'][number]

const CHAPTER_PASSAGES = [
  'Le chemin commence au bord d’une vallée encore froide. Au matin, la lumière glisse lentement sur les pentes et révèle les lignes du relief. On avance sans chercher à atteindre le sommet trop vite : chaque détour permet de voir un peu plus loin, tandis que le paysage change avec la hauteur.',
  'Au début, la montée suit un sentier large, bordé d’herbes et de pierres claires. Le bruit de la ville s’éloigne derrière nous. Il reste le vent dans les arbres, le pas régulier sur le sol et les repères laissés par ceux qui sont passés avant. La route paraît longue, mais elle devient plus simple dès qu’on la découpe en petites étapes.',
  'Après le premier replat, les arbres s’espacent et le ciel prend davantage de place. Une crête apparaît entre deux versants. Elle semblait proche depuis la vallée ; il faut pourtant continuer à marcher pour la rejoindre. À mesure que l’on avance, les détails changent : les couleurs s’adoucissent, les ombres se déplacent et le sentier tourne vers la lumière.',
  'On s’arrête quelques instants avant de reprendre la montée. Derrière nous, le chemin parcouru dessine une ligne fine dans la pente. Devant, les collines se superposent jusqu’à l’horizon. Cette pause ne marque pas la fin du voyage ; elle donne simplement le temps de regarder ce qui était caché depuis le départ.',
  'La dernière partie demande un pas plus attentif. Le terrain devient irrégulier, mais le sommet n’est plus très loin. On suit les courbes du sentier plutôt que de couper à travers la pente. Quand la crête s’ouvre enfin, la vallée réapparaît sous un autre angle : le même paysage, vu depuis un point que l’on ne pouvait pas atteindre en restant immobile.',
  'La descente reprend le même chemin en sens inverse. Certains repères que l’on n’avait pas remarqués à l’aller deviennent évidents. En revenant, on voit aussi la pente autrement : ce qui paraissait lointain s’approche, puis disparaît derrière nous. Le parcours reste le même, mais le point de vue change à chaque pas.',
]

/** Registers the optional source, module, and browser adapter for this scene. */
export const engineCapabilities: Pick<CodPlayEngineOptions, 'components' | 'modules'> = {
  components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
  modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
}

/** Returns the scroll source factory consumed by the shared HTML host. */
export const sourceAdapterFactories = [createScrollContainerSourceAdapter]

/** Creates the shared scroll demo scene with a long passage and an observed image. */
export function createScene(): SceneDoc<string> {
  return {
    id: SCENE_ID,
    stories: {
      [STORY_ID]: {
        id: STORY_ID,
        initial: { move: '@root' },
        persos: [
          {
            id: SCROLL_ID,
            type: 'scroll-container',
            initial: {
              tag: 'section',
              attr: { id: SCROLL_ID },
              className: 'scroll-container',
              style: {
                width: '100%',
                height: '100%',
                overflowY: 'auto',
              },
              values: { progress: { axis: 'block', range: 'scrollport' } },
              move: { target: '@root' },
            },
            emit: {
              scroll: {
                event: { name: 'chapter:scroll:start' },
                capture: {
                  trackOn: ['scroll'],
                  endOn: ['scrollend'],
                  trackCommand: ({ sample }) => ({
                    actions: [{
                      name: PROGRESS_ACTION,
                      data: { style: { scaleX: sample.progress } },
                    }],
                    captureState: { progress: sample.progress },
                  }),
                  endEmit: { name: SCROLL_PROGRESS_EVENT },
                  endCapture: ({ samples }) => ({
                    events: [{
                      name: 'chapter:scroll:end',
                      data: { sampleCount: samples.length },
                      mode: 'persist-only',
                    }],
                  }),
                },
              },
            },
          },
          ...createProgressIndicator(),
          {
            id: 'chapter-title',
            type: 'tag',
            initial: {
              tag: 'h2',
              content: 'La route apparaît en avançant',
              className: 'scroll-container__title',
              move: { target: SCROLL_ID },
            },
          },
          ...createChapterSection({
            id: 'chapter-one',
            title: 'La première étape',
            firstPassageIndex: 0,
            thresholdCount: 20,
            startHue: 24,
            once: true,
          }),
          ...createChapterSection({
            id: 'chapter-two',
            title: 'Une étape au milieu',
            firstPassageIndex: 2,
            thresholdCount: 25,
            startHue: 144,
            betweenPassages: createObservedImage('chapter-two'),
          }),
          ...createChapterSection({
            id: 'chapter-three',
            title: 'La dernière étape',
            firstPassageIndex: 4,
            thresholdCount: 40,
            startHue: 264,
          }),
        ],
      },
    },
  }
}

/** Restores the last scroll progress through the meter's ACE transform channel. */
function retainCapturedScrollProgress(input: { data: Record<string, unknown> }): Record<string, unknown> {
  const captureState = input.data.captureState as { progress: number }
  return { style: { scaleX: captureState.progress } }
}

/** Creates the sticky track and its ACE-driven progress meter as child tag persos. */
function createProgressIndicator(): readonly ScrollPerso[] {
  return [
    {
      id: PROGRESS_TRACK_ID,
      type: 'tag',
      initial: {
        tag: 'div',
        attr: { id: PROGRESS_TRACK_ID },
        className: 'scroll-container__progress-track',
        move: { target: SCROLL_ID },
      },
    },
    {
      id: PROGRESS_METER_ID,
      type: 'tag',
      initial: {
        tag: 'div',
        attr: { id: PROGRESS_METER_ID },
        className: 'scroll-container__progress-meter',
        style: { scaleX: 0 },
        move: { target: PROGRESS_TRACK_ID },
      },
      actions: {
        [PROGRESS_ACTION]: { style: { scaleX: 0 } },
        [SCROLL_PROGRESS_EVENT]: {
          duration: 1,
          fn: retainCapturedScrollProgress,
        },
      },
    },
  ]
}

/** Creates one chapter parent, its sticky step title, and its unchanged passages. */
function createChapterSection(input: {
  id: string
  title: string
  firstPassageIndex: number
  thresholdCount: number
  startHue: number
  once?: boolean
  betweenPassages?: readonly ScrollPerso[]
}): readonly ScrollPerso[] {
  return [
    {
      id: input.id,
      type: 'tag',
      initial: {
        tag: 'section',
        attr: { id: input.id },
        className: 'scroll-container__chapter',
        move: { target: SCROLL_ID },
      },
    },
    createObservedChapterTitle({
      id: `${input.id}-title`,
      parentId: input.id,
      content: input.title,
      thresholdCount: input.thresholdCount,
      startHue: input.startHue,
      once: input.once,
    }),
    ...createChapterPassages(input.firstPassageIndex, input.id, input.betweenPassages),
  ]
}

/** Creates a chapter's two unchanged passages with any added content between them. */
function createChapterPassages(
  firstPassageIndex: number,
  chapterId: string,
  betweenPassages: readonly ScrollPerso[] = [],
): readonly ScrollPerso[] {
  const passages = CHAPTER_PASSAGES.slice(firstPassageIndex, firstPassageIndex + 2)
    .map((content, offset) => ({
      id: `chapter-passage-${firstPassageIndex + offset + 1}`,
      type: 'tag',
      initial: {
        tag: 'p',
        content,
        className: 'scroll-container__passage',
        move: { target: chapterId },
      },
    }))
  return [...passages.slice(0, 1), ...betweenPassages, ...passages.slice(1)]
}

/** Creates a fixed observation target and the image it animates through CodPlay actions. */
function createObservedImage(chapterId: string): readonly ScrollPerso[] {
  const imageFrameId = 'chapter-image-frame'
  return [
    {
      id: imageFrameId,
      type: 'tag',
      initial: {
        tag: 'figure',
        attr: { id: imageFrameId },
        className: 'scroll-container__image-frame',
        move: { target: chapterId },
      },
      emit: {
        observe: {
          zone: { rootMargin: '0px 0px -40% 0px', threshold: 0 },
          enter: [{ name: IMAGE_ENTER_EVENT }],
          leave: [{ name: IMAGE_LEAVE_EVENT }],
        },
      },
    },
    {
      id: 'chapter-slide-image',
      type: 'img',
      initial: {
        src: chapterImageUrl,
        alt: 'Soleil corail au-dessus de collines bleues',
        className: 'scroll-container__image-slide',
        style: { translateX: IMAGE_HIDDEN_OFFSET },
        img: {
          className: 'scroll-container__image-native',
          style: { display: 'block', width: '100%', height: 'auto' },
          attr: { draggable: 'false' },
        },
        move: { target: imageFrameId },
      },
      actions: {
        [IMAGE_ENTER_EVENT]: {
          style: {
            translateX: {
              from: IMAGE_HIDDEN_OFFSET,
              to: '0%',
              duration: 520,
              ease: 'outCubic',
            },
          },
        },
        [IMAGE_LEAVE_EVENT]: {
          style: {
            translateX: {
              from: '0%',
              to: IMAGE_HIDDEN_OFFSET,
              duration: 420,
              ease: 'inCubic',
            },
          },
        },
      },
    },
  ]
}

/** Formats one authored OKLCH color while keeping title lightness and chroma fixed. */
function createChapterTitleColor(hue: number): string {
  return `oklch(${CHAPTER_TITLE_LIGHTNESS}% ${CHAPTER_TITLE_CHROMA} ${hue}deg)`
}

/** Prepares a 90-degree hue rotation for one title using ACE's OKLCH interpolation. */
function createChapterTitleTween(startHue: number): ReturnType<typeof prepareTween> {
  return prepareTween({
    from: createChapterTitleColor(startHue),
    to: createChapterTitleColor((startHue + CHAPTER_TITLE_HUE_ROTATION) % 360),
    duration: 1,
    ease: 'linear',
  })
}

/** Resolves one title's prepared color from its visible ratio. */
function createChapterTitleAction(tween: ReturnType<typeof prepareTween>) {
  return (input: { data: Readonly<Record<string, unknown>> }): Record<string, unknown> => ({
    style: { backgroundColor: resolveTween(tween, input.data.ratio as number) },
  })
}

/** Creates evenly spaced visibility notifications for one observed title. */
function createVisibilityThresholds(count: number): readonly number[] {
  return Array.from({ length: count + 1 }, (_, index) => index / count)
}

/** Creates a sticky chapter heading whose visibility rotates its OKLCH hue. */
function createObservedChapterTitle(input: {
  id: string
  parentId: string
  content: string
  thresholdCount: number
  startHue: number
  once?: boolean
}): ScrollPerso {
  const { id, parentId, content, thresholdCount, startHue, once = false } = input
  const liveAction = `${id}:visibility`
  const backgroundTween = createChapterTitleTween(startHue)
  return {
    id,
    type: 'tag',
    initial: {
      tag: 'h3',
      attr: { id },
      content,
      className: 'scroll-container__chapter-title',
      style: { backgroundColor: createChapterTitleColor(startHue) },
      move: { target: parentId },
    },
    emit: {
      observe: {
        liveAction,
        zone: { threshold: createVisibilityThresholds(thresholdCount) },
        enter: [{ name: `chapter:${id}:enter`, ...(once ? { once: true as const } : {}) }],
        leave: [{ name: `chapter:${id}:leave` }],
      },
    },
    actions: {
      [liveAction]: { duration: 1, fn: createChapterTitleAction(backgroundTween) },
    },
  }
}
