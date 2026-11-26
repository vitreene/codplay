import type { SightyActionContext, SightyScenarioDefinition } from '@codplay/sighty'
import type { AuthorRecord, SceneDoc } from 'codplay/scene/types'
import { sceneB } from '../demo1/scenes/scene-b'
import { menuScene } from '../demo4/scenes/menu-scene'
import { telcoScene } from '../demo4/scenes/telco-scene'
import { sceneC } from '../demo4/scenes/scene-c'
import {
  DEMO4_MENU_INTENTS,
  DEMO4_NAVIGATION_INTENTS,
  DEMO4_PLAYBACK_INTENTS,
  DEMO4_PLAYBACK_STATE_EVENTS,
  DEMO4_PROGRESS_INTENTS,
  DEMO4_TELCO_STATE_EVENTS,
} from '../demo4/messages'
import { viewTransitionSceneA } from './scene-a'
import { viewTransitionLayoutScene } from './scenes/layout-scene'
import { viewTransitionIntroScene } from './scenes/intro-scene'

export type SightyViewTransitionSceneKey =
  | 'scene-layout'
  | 'scene-menu'
  | 'scene-intro'
  | 'scene-a'
  | 'scene-b'
  | 'scene-c'
  | 'scene-telco'
export type SightyViewTransitionSlotName = 'slot-menu' | 'slot-scene' | 'slot-telco'

const PAGE_NAVIGATION_ACTIONS = {
  [DEMO4_NAVIGATION_INTENTS.previous]: { go: { direction: 'previous' } },
  [DEMO4_NAVIGATION_INTENTS.next]: { go: { direction: 'next' } },
} as const
const TELCO_STATE_ACTIONS = {
  [DEMO4_TELCO_STATE_EVENTS.on]: { action: 'action:sighty-vt:project-telco-event' },
  [DEMO4_TELCO_STATE_EVENTS.off]: { action: 'action:sighty-vt:project-telco-event' },
  [DEMO4_PLAYBACK_STATE_EVENTS.playing]: { action: 'action:sighty-vt:project-telco-event' },
  [DEMO4_PLAYBACK_STATE_EVENTS.paused]: { action: 'action:sighty-vt:project-telco-event' },
} as const

const viewTransitionSceneB = scaleSceneTimeline(sceneB, 'sighty-view-transition-scene-b')
const viewTransitionSceneC = scaleSceneTimeline(sceneC, 'sighty-view-transition-scene-c')
const viewTransitionTelcoScene = setSceneProgressMaximum(telcoScene, 'sighty-view-transition-telco-scene')

/** Declares one persistent navigation view whose page slot changes on scene events. */
export const sightyViewTransitionScenario: SightyScenarioDefinition<SightyViewTransitionSceneKey, SightyViewTransitionSlotName> = {
  showMode: 'reset',
  views: {
    start: 'view-main',
    views: {
      'view-main': {
        coupling: {
          couplingId: 'sighty-view-transition-scene-telco',
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
          ...TELCO_STATE_ACTIONS,
          [DEMO4_MENU_INTENTS.sceneA]: { go: { path: 'view-main/slot-scene/view-page-a' } },
          [DEMO4_MENU_INTENTS.sceneB]: { go: { path: 'view-main/slot-scene/view-page-b' } },
          [DEMO4_MENU_INTENTS.sceneC]: { go: { path: 'view-main/slot-scene/view-page-c' } },
        },
        view: {
          scene: 'scene-layout',
          slots: {
            'slot-menu': {
              start: 'view-menu',
              views: { 'view-menu': { view: { scene: 'scene-menu' } } },
            },
            'slot-scene': {
              start: 'view-intro',
              views: {
                'view-intro': { view: { scene: 'scene-intro' } },
                'view-page-a': { actions: PAGE_NAVIGATION_ACTIONS, view: { scene: 'scene-a' } },
                'view-page-b': { actions: PAGE_NAVIGATION_ACTIONS, view: { scene: 'scene-b' } },
                'view-page-c': { actions: PAGE_NAVIGATION_ACTIONS, view: { scene: 'scene-c' } },
              },
            },
            'slot-telco': {
              start: 'view-telco',
              views: { 'view-telco': { view: { scene: 'scene-telco' } } },
            },
          },
        },
      },
    },
  },
  scenes: {
    'scene-layout': viewTransitionLayoutScene,
    'scene-menu': menuScene,
    'scene-intro': viewTransitionIntroScene,
    'scene-a': viewTransitionSceneA,
    'scene-b': viewTransitionSceneB,
    'scene-c': viewTransitionSceneC,
    'scene-telco': viewTransitionTelcoScene,
  },
  actions: {
    'action:sighty-vt:project-telco-event': projectTelcoEvent,
  },
}

/** Copies the telco scene with a seek range that matches the shortened page timelines. */
function setSceneProgressMaximum(scene: SceneDoc<string>, sceneId: string): SceneDoc<string> {
  return {
    ...scene,
    id: sceneId,
    stories: Object.fromEntries(Object.entries(scene.stories).map(([storyId, story]) => [
      storyId,
      {
        ...story,
        persos: story.persos?.map((perso) => perso.id === 'demo4-telco-progress'
          ? { ...perso, initial: { ...perso.initial, max: 4_000 } }
          : perso),
      },
    ])),
  }
}

/** Copies an existing scene and scales its event times to a four-second run. */
function scaleSceneTimeline(scene: SceneDoc<string>, sceneId: string): SceneDoc<string> {
  const scaleEventimes = (eventimes: readonly AuthorRecord[] | undefined) => eventimes?.map((eventime) => ({
    ...eventime,
    ...(typeof eventime.startAt === 'number' ? { startAt: Math.round(eventime.startAt * 0.4) } : {}),
  }))

  return {
    ...scene,
    id: sceneId,
    stories: Object.fromEntries(Object.entries(scene.stories).map(([storyId, story]) => [
      storyId,
      { ...story, eventimes: scaleEventimes(story.eventimes) },
    ])),
    eventimes: scaleEventimes(scene.eventimes),
  }
}

/** Forwards one telco state event to its authored scene. */
async function projectTelcoEvent({ event, send }: SightyActionContext<SightyViewTransitionSceneKey>): Promise<void> {
  await send('scene-telco', { name: event.name }, { scope: 'story', storyId: 'main' })
}
