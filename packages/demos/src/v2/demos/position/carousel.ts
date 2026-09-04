import { AutoCapsule, CAPSULE_TYPE, type AutoCapsuleResult } from '@codplay/capsule-automation'
import { CapsuleDistribution, CapsulePreset } from '@codplay/scene-factory'
import type { PersoDoc } from 'codplay'
import {
  CAROUSEL_AUTHORING_HORIZON_MS,
  CAROUSEL_SLIDE_DURATION_MS,
  CAROUSEL_SLIDE_OFFSET_PX,
  POSITION_CAROUSEL_ID,
  POSITION_KEYBOARD_NAVIGATION_EVENT,
  POSITION_KEYBOARD_TARGET,
  POSITION_KEYBOARD_TOGGLE_EVENT,
  POSITION_NAMESPACE,
  POSITION_NOTICE_TARGET,
  POSITION_STATUS_TARGET,
  POSITION_VIEWPORT_TARGET,
  VIEW_COUNT,
  VIEW_IDS,
} from './constants'
import type { CarouselEventNames, ViewIndex } from './types'

/** Builds the capsule artifact that owns the six exclusive carousel ranges. */
function createPositionCapsule(): AutoCapsuleResult {
  const preset = CapsulePreset.resolve({
    capsuleType: CAPSULE_TYPE.carousel,
    distribution: { mode: 'sequential' },
  })
  const distribution = CapsuleDistribution.compute({
    clipDurationMs: CAROUSEL_AUTHORING_HORIZON_MS,
    mode: preset.mode,
    children: VIEW_IDS.map((trackId) => ({ trackId })),
  })

  const capsule = new AutoCapsule({
    capsule: {
      id: POSITION_CAROUSEL_ID,
      type: CAPSULE_TYPE.carousel,
      className: 'position-carousel',
      grid: { className: 'position-carousel__grid' },
      defaults: {
        introTransitionRef: 'swipe-left',
        outroTransitionRef: 'cut',
      },
    },
    children: distribution.children.map((child, index) => ({
      id: child.trackId,
      order: index,
      timeRange: { startMs: child.introMs, endMs: child.outroMs },
      className: 'position-view',
      events: {
        intro: {
          name: `${POSITION_NAMESPACE}:view:${index + 1}:intro`,
          action: 'intro',
          ref: 'swipe-left',
        },
        outro: {
          name: `${POSITION_NAMESPACE}:view:${index + 1}:outro`,
          action: 'outro',
          ref: 'cut',
        },
      },
    })),
    eventDefinitions: {
      cut: {
        label: 'cut',
        durationMs: 0,
        style: { intro: {}, outro: {} },
      },
    },
  })
  return capsule.resolve()
}

/** Resolved capsule metadata shared by the view roots and navigation circuit. */
export const POSITION_CAPSULE = createPositionCapsule()

/** Resolves the generated entry/exit event names for each carousel child. */
function resolveCarouselEventNames(): readonly CarouselEventNames[] {
  return POSITION_CAPSULE.children.map((child) => ({
    intro: child.events.intro!.name,
    outro: child.events.outro!.name,
  }))
}

/** Generated intro/outro events used by the story-local carousel circuit. */
export const CAROUSEL_EVENTS = resolveCarouselEventNames()

/** Creates a root view layout with exclusive cut visibility actions. */
export function createViewRoot(index: ViewIndex, markup: string, extraClass = ''): PersoDoc {
  const artifact = POSITION_CAPSULE.children[index]!
  const events = CAROUSEL_EVENTS[index]
  const initialVisibility = index === 0 ? 'position-view--visible' : 'position-view--hidden'
  return {
    id: artifact.id,
    type: 'layout',
    initial: {
      move: { target: POSITION_VIEWPORT_TARGET },
      className: `${artifact.className} position-story-cell ${initialVisibility}${extraClass.length > 0 ? ` ${extraClass}` : ''}`,
      markup,
    },
    actions: {
      [events.intro]: {
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
      [events.outro]: {
        className: {
          add: 'position-view--hidden',
          remove: 'position-view--visible',
        },
      },
    },
  }
}

/** Creates the root layout containing the AutoCapsule viewport and scene controls. */
function createCarouselRoot(): PersoDoc {
  const capsuleClassName = POSITION_CAPSULE.capsule.className
  return {
    id: 'position-carousel-shell',
    type: 'layout',
    initial: {
      move: '@root',
      className: 'position-carousel-shell',
      markup: `
        <main class="position-carousel-shell__surface">
          <div class="${capsuleClassName}" data-part="${POSITION_VIEWPORT_TARGET}"></div>
          <footer class="position-carousel-shell__footer">
            <div class="position-carousel-shell__progress" data-part="${POSITION_STATUS_TARGET}"></div>
            <div class="position-carousel-shell__hint" data-part="${POSITION_NOTICE_TARGET}"></div>
            <div class="position-keyboard-manager-mount" data-part="${POSITION_KEYBOARD_TARGET}"></div>
          </footer>
        </main>
      `,
    },
    actions: {},
  }
}

/** Creates the timeline readout driven by each generated carousel intro event. */
function createCarouselStatus(): PersoDoc {
  const actions: Record<string, Record<string, unknown>> = {}
  for (let index = 0; index < VIEW_COUNT; index += 1) {
    actions[CAROUSEL_EVENTS[index].intro] = {
      content: `${String(index + 1).padStart(2, '0')} / 06`,
    }
  }
  return {
    id: 'position-carousel-status',
    type: 'tag',
    initial: {
      tag: 'strong',
      content: '01 / 06',
      className: 'position-carousel-status',
      move: { target: POSITION_STATUS_TARGET },
    },
    actions,
  }
}

/** Creates the pause marker changed only by the story toggle strap. */
function createPauseNotice(): PersoDoc {
  return {
    id: 'position-carousel-notice',
    type: 'tag',
    initial: {
      tag: 'span',
      content: '',
      className: 'position-carousel-notice',
      attr: { hidden: true, 'aria-live': 'polite' },
      move: { target: POSITION_NOTICE_TARGET },
    },
    actions: {
      [`${POSITION_NAMESPACE}:story:paused`]: {
        content: 'animation de la vue arrêtée',
        attr: { hidden: false },
      },
      [`${POSITION_NAMESPACE}:story:resumed`]: {
        content: '',
        attr: { hidden: true },
      },
    },
  }
}

/** Creates the scene-local keyboard source that emits navigation events. */
function createKeyboardManager(): PersoDoc {
  return {
    id: 'position-keyboard-manager',
    type: 'tag',
    initial: {
      tag: 'span',
      content: '',
      className: 'position-keyboard-manager',
      attr: { 'aria-hidden': 'true' },
      move: { target: POSITION_KEYBOARD_TARGET },
    },
    emit: {
      keydown: [
        {
          keyCode: 'ArrowLeft',
          preventDefault: true,
          event: { name: POSITION_KEYBOARD_NAVIGATION_EVENT, data: { direction: 'previous' } },
        },
        {
          keyCode: 'ArrowRight',
          preventDefault: true,
          event: { name: POSITION_KEYBOARD_NAVIGATION_EVENT, data: { direction: 'next' } },
        },
        {
          keyCode: 'Enter',
          preventDefault: true,
          event: { name: POSITION_KEYBOARD_NAVIGATION_EVENT, data: { direction: 'next' } },
        },
        {
          keyCode: 'Space',
          preventDefault: true,
          event: { name: POSITION_KEYBOARD_TOGGLE_EVENT },
        },
      ],
    },
    actions: {},
  }
}

/** Returns the shared carousel controls mounted before the six lesson views. */
export function createCarouselPersos(): readonly PersoDoc[] {
  return [createCarouselRoot(), createCarouselStatus(), createPauseNotice(), createKeyboardManager()]
}
