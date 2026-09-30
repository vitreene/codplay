import type { SightyScenarioDefinition } from '@codplay/sighty'
import { SCENE_A_EVENTS } from '../demo1/scenes/scene-a'
import { layoutScene } from './scenes/layout-scene'
import { sceneAForDemo3 } from './scenes/scene-a'
import { telcoScene } from './scenes/telco-scene'
import {
  DEMO3_COLOR_INTENTS,
  DEMO3_CONTENT_INTENTS,
} from './messages'

export type SightyDemo3SceneKey = 'layout' | 'sceneA' | 'telco'
export type SightyDemo3SlotName = 'sceneA' | 'telco'

/** Declares the demo 3 views, scenes and event handlers together. */
export function createDemo3Scenario(
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void,
): SightyScenarioDefinition<SightyDemo3SceneKey, SightyDemo3SlotName> {
  return {
    format: 'sighty',
    version: 1,
    id: 'sighty-data-injection',
    views: {
      start: 'main',
      views: {
        main: {
          view: {
            scene: 'layout',
            slots: {
              sceneA: {
                start: 'scene-a',
                views: {
                  'scene-a': { view: { scene: 'sceneA' } },
                },
              },
              telco: {
                start: 'telco',
                views: {
                  telco: {
                    actions: {
                      [DEMO3_CONTENT_INTENTS.first]: { action: 'action:demo3:inject-content' },
                      [DEMO3_CONTENT_INTENTS.second]: { action: 'action:demo3:inject-content' },
                      [DEMO3_COLOR_INTENTS.blue]: { action: 'action:demo3:set-color' },
                      [DEMO3_COLOR_INTENTS.coral]: { action: 'action:demo3:set-color' },
                    },
                    view: { scene: 'telco' },
                  },
                },
              },
            },
          },
        },
      },
    },
    scenes: {
      layout: layoutScene,
      sceneA: sceneAForDemo3,
      telco: telcoScene,
    },
    actions: {
      'action:demo3:inject-content': async ({ event, send }) => {
        const content = event.data?.content
        if (typeof content !== 'string' && typeof content !== 'number') {
          onLog(`Message ${event.name} sans contenu textuel.`, 'warn')
          return
        }
        onLog(`message ${event.name} → sceneA (content)`)
        await send('sceneA', {
          name: SCENE_A_EVENTS.setContent,
          data: { content },
        }, { scope: 'story', storyId: 'main' })
        onLog('Sighty → sceneA : content injecté')
      },
      'action:demo3:set-color': async ({ event, send }) => {
        const color = event.data?.color
        if (typeof color !== 'string') {
          onLog(`Message ${event.name} sans couleur.`, 'warn')
          return
        }
        await send('sceneA', {
          name: SCENE_A_EVENTS.setColor,
          data: { style: { color } },
        }, { scope: 'story', storyId: 'main' })
        onLog(`Sighty → sceneA : couleur ${color}`)
      },
    },
  }
}
