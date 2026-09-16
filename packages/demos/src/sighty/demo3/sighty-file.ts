import type { SightyFile as SightyFileDefinition } from '@codplay/sighty'
import {
  DEMO3_COLOR_INTENTS,
  DEMO3_CONTENT_INTENTS,
} from './messages'

export type SightyDemo3SceneKey = 'layout' | 'sceneA' | 'telco'
export type SightyDemo3SlotName = 'sceneA' | 'telco'

/** Declarative composition file for the demo 3 data-injection scenario. */
export type SightyDemo3File = SightyFileDefinition<SightyDemo3SceneKey, SightyDemo3SlotName>

/** Places the reusable scene A above the command scene. */
export const sightyFile: SightyDemo3File = {
  format: 'sighty',
  version: 1,
  id: 'sighty-data-injection',
  resources: {
    scenes: {
      layout: './scenes/layout-scene',
      sceneA: './scenes/scene-a',
      telco: './scenes/telco-scene',
    },
  },
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
                    [DEMO3_CONTENT_INTENTS.first]: { action: 'demo3:inject-content' },
                    [DEMO3_CONTENT_INTENTS.second]: { action: 'demo3:inject-content' },
                    [DEMO3_COLOR_INTENTS.blue]: { action: 'demo3:set-color' },
                    [DEMO3_COLOR_INTENTS.coral]: { action: 'demo3:set-color' },
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
}
