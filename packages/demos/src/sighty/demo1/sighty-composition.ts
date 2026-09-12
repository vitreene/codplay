import {
  Sighty,
} from '@codplay/sighty'
import { sightyScenario } from './scene-resources'
import type { SightySceneKey, SightySlotName } from './sighty-file'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'

type Demo1LogLevel = 'info' | 'warn' | 'error'

type Demo1CompositionOptions = Readonly<{
  stage: HTMLElement
  onLog: (message: string, level?: Demo1LogLevel) => void
}>

export type Demo1Sighty = Sighty<SightySceneKey, SightySlotName>
export type Demo1Runtime = Demo1Sighty['runtime']

const INSTANCE_IDS: Readonly<Record<SightySceneKey, string>> = {
  layout: 'layout-1',
  sceneA: 'scene-a-1',
  sceneB: 'scene-b-1',
}

/** Builds the demo 1 Sighty facade from its scenario and page runtime options. */
export function createDemo1Composition(options: Demo1CompositionOptions): Demo1Sighty {
  return new Sighty({
    scenario: sightyScenario,
    runtime: {
      root: options.stage,
      instanceIds: INSTANCE_IDS,
      layout: { sceneKey: 'layout', storyId: 'main' },
      styles: [{
        slot: 'sighty-demo-capsule-automation',
        cssText: SIGHTY_SCENE_ROOT_STYLE_SHEET,
      }],
      codplay: {
        pauseOnDocumentHidden: false,
        engine: {
          diagnosticOutput: (diagnostic) => {
            options.onLog(
              `${diagnostic.code}: ${diagnostic.message}`,
              diagnostic.severity === 'warning' ? 'warn' : 'error',
            )
          },
        },
      },
      onTrace: (sceneKey, event) => options.onLog(`${sceneKey}: ${event.name} @${event.timeMs}ms`),
      onPreloadWarning: (warning) => options.onLog(`${warning.code}: ${warning.message}`, 'warn'),
    },
  })
}
