import type {
  SightyActionContext,
  SightyScenarioDefinition,
  SightyViewList,
  SightyViewListEntry,
} from '@codplay/sighty'
import type { SceneDoc } from 'codplay/scene/types'
import {
  DEMO4_NAVIGATION_INTENTS,
  DEMO4_PLAYBACK_INTENTS,
  DEMO4_PLAYBACK_STATE_EVENTS,
  DEMO4_PROGRESS_INTENTS,
  DEMO4_TELCO_STATE_EVENTS,
} from '../demo4/messages'
import { telcoScene } from '../demo4/scenes/telco-scene'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../scene-root-capsule'

const TRANSITION_DURATION_MS = 1_200

/** Lists one slot page per HTML-in-Canvas effect. */
const HIC_STEPS = [
  { id: 'view-hic-burn', sceneKey: 'hic-burn', transition: 'burn', background: 'a', title: 'Braises' },
  { id: 'view-hic-ripple', sceneKey: 'hic-ripple', transition: 'ripple', background: 'b', title: 'Onde' },
  { id: 'view-hic-pixelate', sceneKey: 'hic-pixelate', transition: 'pixelate', background: 'c', title: 'Pixels' },
  { id: 'view-hic-swirl', sceneKey: 'hic-swirl', transition: 'swirl', background: 'd', title: 'Tourbillon' },
  { id: 'view-hic-shatter', sceneKey: 'hic-shatter', transition: 'shatter', background: 'e', title: 'Éclats' },
  { id: 'view-hic-fold', sceneKey: 'hic-fold', transition: 'fold', background: 'f', title: 'Page' },
] as const

type HicStep = (typeof HIC_STEPS)[number]

const PAGE_PATH_PREFIX = 'view-main/view-chapter/slot-scene'
const FIRST_PAGE_PATH = `${PAGE_PATH_PREFIX}/${HIC_STEPS[0].id}`
const LAST_PAGE_PATH = `${PAGE_PATH_PREFIX}/${HIC_STEPS[HIC_STEPS.length - 1].id}`

export type HicSlotSceneKey = 'layout' | 'scene-telco' | HicStep['sceneKey']
export type HicSlotName = 'slot-scene' | 'slot-telco'
export const HIC_SLOT_CONTENT_SCENE_KEYS: readonly HicStep['sceneKey'][] = HIC_STEPS.map((step) => step.sceneKey)

/** Builds a Sighty sequence whose slot pages are entered through each HTML-in-Canvas effect. */
export function createHicSlotScenario(): SightyScenarioDefinition<HicSlotSceneKey, HicSlotName> {
  const sceneViews: SightyViewList<HicSlotSceneKey, HicSlotName> = HIC_STEPS.map(createPageEntry)
  const pageScenes = Object.fromEntries(
    HIC_STEPS.map((step) => [step.sceneKey, createPageScene(step)]),
  ) as Record<HicStep['sceneKey'], SceneDoc<string>>

  return {
    id: 'sighty-hic-slot-sequence',
    format: 'sighty',
    version: 1,
    views: {
      start: 'view-main',
      views: {
        'view-main': {
          actions: {
            [DEMO4_NAVIGATION_INTENTS.previous]: { go: { direction: 'previous' } },
            [DEMO4_NAVIGATION_INTENTS.next]: { go: { direction: 'next' } },
          },
          view: {
            scene: 'layout',
            views: {
              start: 'view-chapter',
              views: {
                'view-chapter': {
                  coupling: {
                    couplingId: 'sighty-hic-slot-telco',
                    controllerSlot: 'slot-telco',
                    controlledSlot: 'slot-scene',
                    commands: {
                      [DEMO4_NAVIGATION_INTENTS.resetCurrent]: 'reset',
                      [DEMO4_PLAYBACK_INTENTS.toggle]: 'togglePlay',
                      [DEMO4_PLAYBACK_INTENTS.rewind]: 'rewind',
                      [DEMO4_PROGRESS_INTENTS.seek]: ['pause', 'seek'],
                    },
                  },
                  actions: {
                    [DEMO4_NAVIGATION_INTENTS.previous]: { go: { path: LAST_PAGE_PATH } },
                    [DEMO4_NAVIGATION_INTENTS.next]: { go: { path: FIRST_PAGE_PATH } },
                    [DEMO4_TELCO_STATE_EVENTS.on]: { action: 'action:hic-slot:project-telco-event' },
                    [DEMO4_TELCO_STATE_EVENTS.off]: { action: 'action:hic-slot:project-telco-event' },
                    [DEMO4_PLAYBACK_STATE_EVENTS.playing]: { action: 'action:hic-slot:project-telco-event' },
                    [DEMO4_PLAYBACK_STATE_EVENTS.paused]: { action: 'action:hic-slot:project-telco-event' },
                  },
                  view: {
                    slots: {
                      'slot-scene': sceneViews,
                      'slot-telco': {
                        start: 'view-telco',
                        views: { 'view-telco': { view: { scene: 'scene-telco' } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    scenes: {
      layout: createLayoutScene(),
      'scene-telco': telcoScene,
      ...pageScenes,
    },
    actions: {
      'action:hic-slot:project-telco-event': projectTelcoEvent,
    },
  }
}

/** Creates one page entry whose incoming transition is its HTML-in-Canvas effect. */
function createPageEntry(step: HicStep, index: number): SightyViewListEntry<HicSlotSceneKey, HicSlotName> {
  const previous = HIC_STEPS[(index + HIC_STEPS.length - 1) % HIC_STEPS.length]
  const next = HIC_STEPS[(index + 1) % HIC_STEPS.length]
  return {
    id: step.id,
    replace: { transition: step.transition, duration: TRANSITION_DURATION_MS },
    actions: {
      [DEMO4_NAVIGATION_INTENTS.previous]: { go: { path: `${PAGE_PATH_PREFIX}/${previous?.id}` } },
      [DEMO4_NAVIGATION_INTENTS.next]: { go: { path: `${PAGE_PATH_PREFIX}/${next?.id}` } },
    },
    view: { scene: step.sceneKey },
  }
}

/** Creates the stage with separate page and Demo 4 telco slots. */
function createLayoutScene(): SceneDoc<string> {
  return {
    id: 'sighty-hic-slot-layout',
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: 'hic-slot-layout-frame',
            type: 'layout',
            initial: {
              move: '@root',
              className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} replace-slot-layout`,
              markup: `
                <main id="hic-slot-layout-root" class="replace-slot-layout" aria-label="Effets HTML-in-Canvas entre scènes">
                  <header id="hic-slot-layout-heading" class="replace-slot-layout__heading">
                    <p id="hic-slot-eyebrow" class="replace-slot-layout__eyebrow">CodPlay · Sighty · slot · HTML-in-Canvas</p>
                    <h1 id="hic-slot-title" class="replace-slot-layout__title">Un effet par scène</h1>
                    <p id="hic-slot-instructions" class="replace-slot-layout__instructions">Suivant et précédent changent de scène ; chaque entrée joue son effet WebGPU, ou le cercle mask-reveal sans HTML-in-Canvas.</p>
                  </header>
                  <section id="hic-slot-scene-outlet" class="replace-slot-layout__scene" data-part="hic-slot-layout:scene" aria-label="Scène active"></section>
                  <section id="hic-slot-telco-outlet" class="replace-slot-layout__telco" data-part="hic-slot-layout:telco" aria-label="Télécommande de la scène"></section>
                </main>
              `,
            },
            actions: {},
          },
          {
            id: 'hic-slot-scene-host',
            name: 'slot-scene',
            type: 'slot',
            initial: {
              className: 'demo2-slot demo2-layout__scene replace-slot-scene-host',
              move: { target: 'hic-slot-layout:scene' },
              replace: { transition: 'burn', duration: TRANSITION_DURATION_MS },
            },
            actions: {},
          },
          {
            id: 'hic-slot-telco-host',
            name: 'slot-telco',
            type: 'slot',
            initial: {
              className: 'demo2-slot demo4-layout__chapter-telco-slot replace-slot-telco-host',
              move: { target: 'hic-slot-layout:telco' },
            },
            actions: {},
          },
        ],
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Creates one page scene announcing the effect that brought it in. */
function createPageScene(step: HicStep): SceneDoc<string> {
  return {
    id: `sighty-hic-slot-${step.id}`,
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: `hic-slot-${step.id}-frame`,
          type: 'layout',
          initial: {
            move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} replace-slot-page-root replace-slot-page-root--page-${step.background}`,
            markup: createTextPageMarkup(step),
          },
          actions: {},
        }],
        eventimes: [],
      },
    },
    eventimes: [],
    listen: [],
    tracks: {},
  }
}

/** Creates a text page announcing the effect that brought it in. */
function createTextPageMarkup(step: HicStep): string {
  return `
    <article id="hic-slot-${step.id}-root" class="replace-slot-page" aria-label="${step.title}">
      <p id="hic-slot-${step.id}-eyebrow" class="replace-slot-page__eyebrow">ENTRÉE PAR ${step.transition.toUpperCase()}</p>
      <div id="hic-slot-${step.id}-copy" class="replace-slot-page__copy">
        <h2 id="hic-slot-${step.id}-title" class="replace-slot-page__title">${step.title}</h2>
        <p id="hic-slot-${step.id}-description" class="replace-slot-page__description">Effet WebGPU « ${step.transition} » entre deux contenus DOM vivants du slot.</p>
      </div>
    </article>
  `
}

/** Sends a telco-state event to the existing authored Demo 4 control scene. */
async function projectTelcoEvent({ event, send }: SightyActionContext<HicSlotSceneKey>): Promise<void> {
  await send('scene-telco', { name: event.name }, { scope: 'story', storyId: 'main' })
}
