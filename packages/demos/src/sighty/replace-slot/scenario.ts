import type {
  SightyActionContext,
  SightyScenarioDefinition,
  SightyViewList,
  SightyViewListEntry,
} from '@codplay/sighty'
import type { SceneDoc } from 'codplay/scene/types'
import cellDemoVideoBUrl from '../../v1/scenes/quiz-hunt/assets/questions/nostromo.mp4?url'
import {
  DEMO4_NAVIGATION_INTENTS,
  DEMO4_PLAYBACK_INTENTS,
  DEMO4_PLAYBACK_STATE_EVENTS,
  DEMO4_PROGRESS_INTENTS,
  DEMO4_TELCO_STATE_EVENTS,
} from '../demo4/messages'
import { telcoScene } from '../demo4/scenes/telco-scene'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../scene-root-capsule'

/** Lists the seven incoming-page transitions shown by the Sighty sequence. */
const REPLACE_STEPS = [
  {
    id: 'view-page-a', sceneKey: 'page-a', label: 'fade', title: 'Lumière',
    description: 'Une arrivée simple ouvre le parcours.',
    replace: { transition: 'fade', duration: 850 },
  },
  {
    id: 'view-page-b', sceneKey: 'page-b', label: 'fade-in', title: 'Élan',
    description: 'La nouvelle scène apparaît pendant que la précédente reste visible.',
    replace: { transition: 'fade-in', duration: 850 },
  },
  {
    id: 'view-page-c', sceneKey: 'page-c', label: 'mask-reveal · star', title: 'Étoile',
    description: 'Un masque en étoile révèle la scène entrante.',
    replace: { transition: 'mask-reveal', shape: 'star', duration: 850 },
  },
  {
    id: 'view-page-d', sceneKey: 'page-d', label: 'curtain', title: 'Rideau',
    description: 'Les deux scènes se croisent verticalement.',
    replace: { transition: 'curtain', duration: 850 },
  },
  {
    id: 'view-page-e', sceneKey: 'page-e', label: 'wipe', title: 'Balayage',
    description: 'La scène entrante est dévoilée depuis la gauche.',
    replace: { transition: 'wipe', duration: 850 },
  },
  {
    id: 'view-page-f', sceneKey: 'page-f', label: 'mask-reveal · circle · grid', title: 'Cercle en grille',
    description: 'Les cercles se contractent du haut vers le bas dans chaque colonne, puis la vague progresse vers la droite.',
    replace: {
      transition: 'mask-reveal',
      shape: 'circle',
      duration: 850,
      split: 'cells',
      cellSize: 8,
      staggerPattern: 'column-wave',
      stagger: 800,
    },
  },
  {
    id: 'view-page-g', sceneKey: 'page-g', label: 'stack', title: 'Empilement',
    description: 'Un panneau monte puis s’efface sur la scène persistante.',
    replace: { transition: 'stack', duration: 1_100 },
  },
] as const

type ReplaceStep = (typeof REPLACE_STEPS)[number]

const PAGE_PATH_PREFIX = 'view-main/view-chapter/slot-scene'
const FIRST_PAGE_PATH = `${PAGE_PATH_PREFIX}/${REPLACE_STEPS[0].id}`
const LAST_PAGE_PATH = `${PAGE_PATH_PREFIX}/${REPLACE_STEPS[REPLACE_STEPS.length - 1].id}`
const CELL_DEMO_FORWARD_EVENT = 'replace-slot:cells-forward'
const CELL_DEMO_BACK_EVENT = 'replace-slot:cells-back'
const CELL_DEMO_VIDEO_START_EVENT = 'replace-slot:cells-video-start'
const CELL_DEMO_IMAGE_A = '/assets/35c8ec5a07fc.jpg'
const CELL_DEMO_IMAGE_B = '/assets/28970388742_2f75d527d6_z.jpg'
const CELL_DEMO_VIDEO_A = '/assets/LcXkmXyuZQ.mp4'

type ScenePerso = SceneDoc['stories']['main']['persos'][number]

const IMAGE_CELLS_REPLACE = {
  transition: 'mask-reveal',
  duration: 1_100,
  split: 'cells',
  shape: 'star',
  cellSize: 8,
  direction: 'center',
  stagger: 22,
} as const

const VIDEO_CELLS_REPLACE = {
  transition: 'wipe',
  duration: 1_100,
  split: 'cells',
  shape: {
    path: 'M50 0 C60 20 80 20 100 50 C80 60 80 80 50 100 C40 80 20 80 0 50 C20 40 20 20 50 0 Z',
    viewBox: '0 0 100 100',
  },
  cellSize: 8,
  direction: 'edges',
  stagger: 24,
} as const

export type ReplaceSlotSceneKey = 'layout' | 'scene-telco' | ReplaceStep['sceneKey']
export type ReplaceSlotName = 'slot-scene' | 'slot-telco'
export const REPLACE_SLOT_CONTENT_SCENE_KEYS: readonly ReplaceStep['sceneKey'][] = REPLACE_STEPS.map((step) => step.sceneKey)

/** Builds a Sighty sequence that uses Demo 4's authored scene telco. */
export function createReplaceSlotScenario(): SightyScenarioDefinition<ReplaceSlotSceneKey, ReplaceSlotName> {
  const sceneViews: SightyViewList<ReplaceSlotSceneKey, ReplaceSlotName> = REPLACE_STEPS.map(createPageEntry)
  const pageScenes = Object.fromEntries(
    REPLACE_STEPS.map((step) => [step.sceneKey, createPageScene(step)]),
  ) as Record<ReplaceStep['sceneKey'], SceneDoc<string>>
  const scenes: Record<ReplaceSlotSceneKey, SceneDoc<string>> = {
    layout: createLayoutScene(),
    'scene-telco': telcoScene,
    ...pageScenes,
  }

  return {
    id: 'sighty-replace-slot-sequence',
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
                    couplingId: 'sighty-replace-slot-telco',
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
                    [DEMO4_TELCO_STATE_EVENTS.on]: { action: 'action:replace-slot:project-telco-event' },
                    [DEMO4_TELCO_STATE_EVENTS.off]: { action: 'action:replace-slot:project-telco-event' },
                    [DEMO4_PLAYBACK_STATE_EVENTS.playing]: { action: 'action:replace-slot:project-telco-event' },
                    [DEMO4_PLAYBACK_STATE_EVENTS.paused]: { action: 'action:replace-slot:project-telco-event' },
                  },
                  view: {
                    slots: {
                      'slot-scene': sceneViews,
                      'slot-telco': {
                        start: 'view-telco',
                        views: {
                          'view-telco': { view: { scene: 'scene-telco' } },
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
    },
    scenes,
    actions: {
      'action:replace-slot:project-telco-event': projectTelcoEvent,
    },
  }
}

/** Creates one profile-bearing page entry for Demo 4's previous/next buttons. */
function createPageEntry(step: ReplaceStep, index: number): SightyViewListEntry<ReplaceSlotSceneKey, ReplaceSlotName> {
  const previousIndex = (index + REPLACE_STEPS.length - 1) % REPLACE_STEPS.length
  const nextIndex = (index + 1) % REPLACE_STEPS.length
  return {
    id: step.id,
    replace: step.replace,
    actions: {
      [DEMO4_NAVIGATION_INTENTS.previous]: {
        go: { path: `${PAGE_PATH_PREFIX}/${REPLACE_STEPS[previousIndex].id}` },
      },
      [DEMO4_NAVIGATION_INTENTS.next]: {
        go: { path: `${PAGE_PATH_PREFIX}/${REPLACE_STEPS[nextIndex].id}` },
      },
    },
    view: { scene: step.sceneKey },
  }
}

/** Creates the shared stage with separate scene and Demo 4 telco hosts. */
function createLayoutScene(): SceneDoc<string> {
  return {
    id: 'sighty-replace-slot-layout',
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: 'replace-slot-layout-frame',
            type: 'layout',
            initial: {
              move: '@root',
              className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} replace-slot-layout`,
              markup: `
                <main id="replace-slot-layout-root" class="replace-slot-layout" aria-label="Parcours des remplacements de scènes">
                  <header id="replace-slot-layout-heading" class="replace-slot-layout__heading">
                    <p id="replace-slot-eyebrow" class="replace-slot-layout__eyebrow">CodPlay · Sighty · replace-slot</p>
                    <h1 id="replace-slot-title" class="replace-slot-layout__title">Six effets, sept scènes</h1>
                    <p id="replace-slot-instructions" class="replace-slot-layout__instructions">Les scènes se remplacent dans l’ordre. La télécommande Demo 4 pilote lecture, navigation et progression.</p>
                  </header>
                  <section id="replace-slot-scene-outlet" class="replace-slot-layout__scene" data-part="replace-slot-layout:scene" aria-label="Scène active"></section>
                  <section id="replace-slot-telco-outlet" class="replace-slot-layout__telco" data-part="replace-slot-layout:telco" aria-label="Télécommande de la scène"></section>
                </main>
              `,
            },
            actions: {},
          },
          {
            id: 'replace-slot-scene-host',
            name: 'slot-scene',
            type: 'slot',
            initial: {
              className: 'demo2-slot demo2-layout__scene replace-slot-scene-host',
              move: { target: 'replace-slot-layout:scene' },
              replace: { transition: 'fade-in', duration: 850 },
            },
            actions: {},
          },
          {
            id: 'replace-slot-telco-host',
            name: 'slot-telco',
            type: 'slot',
            initial: {
              className: 'demo2-slot demo4-layout__chapter-telco-slot replace-slot-telco-host',
              move: { target: 'replace-slot-layout:telco' },
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

/** Creates a content scene; page C also demonstrates CodPlay media-cell masks. */
function createPageScene(step: ReplaceStep): SceneDoc<string> {
  const hasMediaCellsDemo = step.sceneKey === 'page-c'
  const pagePersos: ScenePerso[] = [{
    id: `replace-slot-${step.id}-frame`,
    type: 'layout',
    initial: {
      move: '@root',
      className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} replace-slot-page-root replace-slot-page-root--${step.sceneKey}`,
      markup: hasMediaCellsDemo ? createMediaCellsPageMarkup(step) : createTextPageMarkup(step),
    },
    actions: {},
  }]

  if (hasMediaCellsDemo) pagePersos.push(createCellsImage(), createCellsVideo())

  return {
    id: `sighty-replace-slot-${step.id}`,
    stories: {
      main: {
        id: 'main',
        persos: pagePersos,
        eventimes: hasMediaCellsDemo
          ? [
              { name: CELL_DEMO_VIDEO_START_EVENT, startAt: 0 },
              { name: CELL_DEMO_FORWARD_EVENT, startAt: 1_000 },
              { name: CELL_DEMO_BACK_EVENT, startAt: 3_500 },
            ]
          : [],
      },
    },
    eventimes: [],
    listen: [],
    tracks: {},
  }
}

/** Creates the unchanged text-only page used by the other transition profiles. */
function createTextPageMarkup(step: ReplaceStep): string {
  return `
    <article id="replace-slot-${step.id}-root" class="replace-slot-page" aria-label="${step.title}">
      <p id="replace-slot-${step.id}-eyebrow" class="replace-slot-page__eyebrow">SCÈNE ${step.id.slice(-1).toUpperCase()} · ENTRÉE PAR ${step.label.toUpperCase()}</p>
      <div id="replace-slot-${step.id}-copy" class="replace-slot-page__copy">
        <h2 id="replace-slot-${step.id}-title" class="replace-slot-page__title">${step.title}</h2>
        <p id="replace-slot-${step.id}-description" class="replace-slot-page__description">${step.description}</p>
      </div>
    </article>
  `
}

/** Separates Sighty's page-entry effect from CodPlay's image and video masks. */
function createMediaCellsPageMarkup(step: ReplaceStep): string {
  return `
    <article id="replace-slot-${step.id}-root" class="replace-slot-page replace-slot-page--media-demo" aria-label="${step.title}">
      <p id="replace-slot-${step.id}-eyebrow" class="replace-slot-page__eyebrow">SCÈNE ${step.id.slice(-1).toUpperCase()} · ENTRÉE PAR ${step.label.toUpperCase()}</p>
      <header id="replace-slot-${step.id}-copy" class="replace-slot-page__copy replace-slot-page__copy--media-demo">
        <h2 id="replace-slot-${step.id}-title" class="replace-slot-page__title">${step.title}</h2>
        <p id="replace-slot-${step.id}-description" class="replace-slot-page__description">Sighty anime l’entrée de la page. La timeline CodPlay anime les masques SVG des deux médias ; utilise la télécommande pour la relancer.</p>
      </header>
      <section id="replace-slot-${step.id}-media-stage" class="replace-slot-page__media-stage" aria-label="Démonstration CodPlay des masques média">
        <figure id="replace-slot-${step.id}-image-card" class="replace-slot-media-card">
          <figcaption id="replace-slot-${step.id}-image-label" class="replace-slot-media-card__label">CodPlay · image · étoiles SVG · 8%</figcaption>
          <div id="replace-slot-${step.id}-image-outlet" class="replace-slot-media-card__outlet" data-part="replace-slot-${step.id}-frame:image"></div>
        </figure>
        <figure id="replace-slot-${step.id}-video-card" class="replace-slot-media-card">
          <figcaption id="replace-slot-${step.id}-video-label" class="replace-slot-media-card__label">CodPlay · vidéo · forme SVG auteur · 8%</figcaption>
          <div id="replace-slot-${step.id}-video-outlet" class="replace-slot-media-card__outlet" data-part="replace-slot-${step.id}-frame:video"></div>
        </figure>
      </section>
    </article>
  `
}

/** Creates the image case with one star-shaped SVG mask per grid cell. */
function createCellsImage(): ScenePerso {
  return {
    id: 'replace-slot-page-c-image',
    type: 'img',
    initial: {
      src: CELL_DEMO_IMAGE_A,
      className: 'replace-slot-media-image',
      img: { style: { objectFit: 'cover' } },
      move: { target: 'replace-slot-view-page-c-frame:image' },
    },
    actions: {
      [CELL_DEMO_FORWARD_EVENT]: { src: CELL_DEMO_IMAGE_B, replace: IMAGE_CELLS_REPLACE },
      [CELL_DEMO_BACK_EVENT]: { src: CELL_DEMO_IMAGE_A, replace: IMAGE_CELLS_REPLACE },
    },
  }
}

/** Creates the video case with an author SVG path repeated across its cell grid. */
function createCellsVideo(): ScenePerso {
  return {
    id: 'replace-slot-page-c-video',
    type: 'media',
    initial: {
      tag: 'video',
      src: CELL_DEMO_VIDEO_A,
      sync: 'auto',
      className: 'replace-slot-media-video',
      video: { style: { objectFit: 'cover' }, attr: { muted: true, playsInline: true } },
      move: { target: 'replace-slot-view-page-c-frame:video' },
    },
    actions: {
      [CELL_DEMO_VIDEO_START_EVENT]: { broadcast: { type: 'START' } },
      [CELL_DEMO_FORWARD_EVENT]: {
        src: cellDemoVideoBUrl,
        replace: VIDEO_CELLS_REPLACE,
        broadcast: { type: 'START' },
      },
      [CELL_DEMO_BACK_EVENT]: {
        src: CELL_DEMO_VIDEO_A,
        replace: VIDEO_CELLS_REPLACE,
        broadcast: { type: 'START' },
      },
    },
  }
}

/** Sends a telco-state event to the existing authored Demo 4 control scene. */
async function projectTelcoEvent({ event, send }: SightyActionContext<ReplaceSlotSceneKey>): Promise<void> {
  await send(
    'scene-telco',
    { name: event.name },
    { scope: 'story', storyId: 'main' },
  )
}
