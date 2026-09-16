import { AutoCapsule, CAPSULE_TYPE, type AutoCapsuleResult } from '@codplay/capsule-automation'
import { CapsuleDistribution, CapsulePreset } from '@codplay/scene-factory'
import type { PersoDoc } from 'codplay'

/** Identifies the two layout items displayed by the Demo 4 carousel. */
export const DEMO4_LAYOUT_ITEM_IDS = {
  menu: 'layout-menu',
  chapter: 'layout-chapter',
} as const

export type Demo4LayoutItemId = typeof DEMO4_LAYOUT_ITEM_IDS[keyof typeof DEMO4_LAYOUT_ITEM_IDS]

/** Identifies the layout part receiving the two carousel items. */
export const DEMO4_LAYOUT_CAROUSEL_VIEWPORT_TARGET = 'demo4:layout:carousel-viewport'

const DEMO4_LAYOUT_CAROUSEL_ID = 'demo4-layout-carousel'
const DEMO4_LAYOUT_CAROUSEL_NAMESPACE = 'sighty-demo4:layout:carousel'
const CAROUSEL_SLIDE_DURATION_MS = 300
const CAROUSEL_AUTHORING_HORIZON_MS = CAROUSEL_SLIDE_DURATION_MS * 2

const CAROUSEL_EVENT_NAMES = {
  menuEnter: `${DEMO4_LAYOUT_CAROUSEL_NAMESPACE}:menu:intro`,
  menuLeave: `${DEMO4_LAYOUT_CAROUSEL_NAMESPACE}:menu:outro`,
  chapterEnter: `${DEMO4_LAYOUT_CAROUSEL_NAMESPACE}:chapter:intro`,
  chapterLeave: `${DEMO4_LAYOUT_CAROUSEL_NAMESPACE}:chapter:outro`,
} as const

/** Builds the authoring artifact for the two-item layout carousel. */
function createLayoutCarousel(): AutoCapsuleResult {
  const preset = CapsulePreset.resolve({
    capsuleType: CAPSULE_TYPE.carousel,
    distribution: { mode: 'sequential' },
  })
  const distribution = CapsuleDistribution.compute({
    clipDurationMs: CAROUSEL_AUTHORING_HORIZON_MS,
    mode: preset.mode,
    children: [
      { trackId: DEMO4_LAYOUT_ITEM_IDS.menu },
      { trackId: DEMO4_LAYOUT_ITEM_IDS.chapter },
    ],
  })

  return new AutoCapsule({
    capsule: {
      id: DEMO4_LAYOUT_CAROUSEL_ID,
      type: CAPSULE_TYPE.carousel,
      className: 'demo4-layout-carousel',
      grid: { className: 'demo4-layout-carousel__grid' },
      defaults: {
        introTransitionRef: 'swipe-left',
        outroTransitionRef: 'swipe-right',
      },
    },
    children: distribution.children.map((child, index) => {
      const itemId = index === 0 ? DEMO4_LAYOUT_ITEM_IDS.menu : DEMO4_LAYOUT_ITEM_IDS.chapter
      const events = itemId === DEMO4_LAYOUT_ITEM_IDS.menu
        ? { intro: CAROUSEL_EVENT_NAMES.menuEnter, outro: CAROUSEL_EVENT_NAMES.menuLeave }
        : { intro: CAROUSEL_EVENT_NAMES.chapterEnter, outro: CAROUSEL_EVENT_NAMES.chapterLeave }
      const refs = itemId === DEMO4_LAYOUT_ITEM_IDS.menu
        ? { intro: 'swipe-down', outro: 'swipe-left' }
        : { intro: 'swipe-left', outro: 'swipe-right' }
      return {
        id: child.trackId,
        order: index,
        timeRange: { startMs: child.introMs, endMs: child.outroMs },
        className: 'demo4-layout__carousel-item',
        events: {
          intro: { name: events.intro, action: 'intro', ref: refs.intro },
          outro: { name: events.outro, action: 'outro', ref: refs.outro },
        },
      }
    }),
  }, { autoResolveOnWrite: false }).resolve()
}

/** Resolved AutoCapsule artifact reused by the layout markup and CSS channel. */
export const DEMO4_LAYOUT_CAROUSEL = createLayoutCarousel()

/** Resolves one generated carousel item by its layout identifier. */
function getCarouselItem(itemId: Demo4LayoutItemId): AutoCapsuleResult['children'][number] {
  const item = DEMO4_LAYOUT_CAROUSEL.children.find((candidate) => candidate.id === itemId)
  if (item === undefined) throw new Error(`Le carrousel Demo 4 ne contient pas l'élément ${itemId}.`)
  return item
}

/** Resolves one named event emitted by a generated carousel item. */
function getCarouselEvent(itemId: Demo4LayoutItemId, action: 'intro' | 'outro'): string {
  const event = getCarouselItem(itemId).events[action]
  if (event?.name === undefined) throw new Error(`L'événement ${action} de l'élément ${itemId} est absent.`)
  return event.name
}

/** Exposes the generated enter/leave events to the layout action catalogue. */
export const DEMO4_LAYOUT_CAROUSEL_EVENTS = {
  [DEMO4_LAYOUT_ITEM_IDS.menu]: {
    enter: getCarouselEvent(DEMO4_LAYOUT_ITEM_IDS.menu, 'intro'),
    leave: getCarouselEvent(DEMO4_LAYOUT_ITEM_IDS.menu, 'outro'),
  },
  [DEMO4_LAYOUT_ITEM_IDS.chapter]: {
    enter: getCarouselEvent(DEMO4_LAYOUT_ITEM_IDS.chapter, 'intro'),
    leave: getCarouselEvent(DEMO4_LAYOUT_ITEM_IDS.chapter, 'outro'),
  },
} as const

/** Creates one layout perso with direction-aware carousel actions. */
export function createLayoutCarouselItem(itemId: Demo4LayoutItemId, markup: string): PersoDoc {
  const item = getCarouselItem(itemId)
  const events = DEMO4_LAYOUT_CAROUSEL_EVENTS[itemId]
  const initialOffset = itemId === DEMO4_LAYOUT_ITEM_IDS.menu ? '0%' : '100%'
  const leaveOffset = itemId === DEMO4_LAYOUT_ITEM_IDS.menu ? '-100%' : '100%'
  const initialState = itemId === DEMO4_LAYOUT_ITEM_IDS.menu
    ? 'demo4-layout__carousel-item--active demo4-layout__carousel-item--front'
    : 'demo4-layout__carousel-item--inactive'

  return {
    id: `demo4-layout-${itemId}`,
    type: 'layout',
    initial: {
      move: { target: DEMO4_LAYOUT_CAROUSEL_VIEWPORT_TARGET },
      className: `${item.className} ${initialState}`,
      style: { x: initialOffset, y: '0%' },
      markup,
    },
    actions: {
      [events.enter]: {
        className: {
          add: 'demo4-layout__carousel-item--active demo4-layout__carousel-item--front',
          remove: 'demo4-layout__carousel-item--inactive demo4-layout__carousel-item--leaving',
        },
        style: {
          ...(itemId === DEMO4_LAYOUT_ITEM_IDS.menu
            ? {
                x: '0%',
                y: {
                  from: '100%',
                  to: '0%',
                  duration: CAROUSEL_SLIDE_DURATION_MS,
                  ease: 'inOutCubic',
                },
              }
            : {
                x: {
                  from: initialOffset,
                  to: '0%',
                  duration: CAROUSEL_SLIDE_DURATION_MS,
                  ease: 'inOutCubic',
                },
              }),
        },
      },
      [events.leave]: {
        className: {
          add: 'demo4-layout__carousel-item--leaving',
          remove: 'demo4-layout__carousel-item--active demo4-layout__carousel-item--front',
        },
        style: {
          x: {
            to: leaveOffset,
            duration: CAROUSEL_SLIDE_DURATION_MS,
            ease: 'inOutCubic',
          },
        },
      },
    },
  }
}
