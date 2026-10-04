import { Sighty, type SightyScenarioDefinition } from '@codplay/sighty'
import type { CodPlayEngineOptions } from 'codplay'
import type { SightySceneSourceValue } from '@codplay/sighty'
import {
  SCROLL_CONTAINER_COMPONENT_DEFINITION,
  SCROLL_CONTAINER_MODULE_DEFINITION,
  createScrollContainerSourceAdapter,
} from '@codplay/component-v2'
import { ELCE_EVENTS, ELCE_SCENARIO } from '../config/document-config'
import { buildFluxScene } from '../builders/flux-scene-builder'
import { buildScenario } from '../builders/scenario-builder'
import type { ElceSceneKey, ElceSlotName } from '../builders/scenario-builder-types'
import type { ElceDocument } from '../domain/document-model'
import { ELCE_PLAYER_STYLE_SHEET } from './elce-player-style'
import type { ElcePlayerCompositionOptions } from './player-composition-types'

type ElceSighty = Sighty<ElceSceneKey, ElceSlotName>

const ELCE_ENGINE_CAPABILITIES: Pick<CodPlayEngineOptions, 'components' | 'modules'> = {
  components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
  modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
}

/** Owns the real Sighty/CodPlay player used to preview the current document. */
export class ElcePlayerComposition {
  private readonly sighty: ElceSighty
  private readonly options: ElcePlayerCompositionOptions
  private destroyed = false

  /** Builds one player composition from the current métier document. */
  public constructor(options: ElcePlayerCompositionOptions) {
    this.options = options
    const scenario = buildScenario(options.document, createPageSceneCatalog(options.document, options.mediaSources), options.startPageId)
    const instanceIds = createInstanceIds(scenario)
    this.sighty = new Sighty({
      scenario,
      runtime: {
        root: options.stage,
        instanceIds,
        codplay: {
          engine: {
          ...ELCE_ENGINE_CAPABILITIES,
            idle: false,
            diagnosticOutput: (diagnostic) => {
              options.onLog?.(diagnostic.message, diagnostic.severity === 'warning' ? 'warn' : 'error')
            },
          },
          htmlHost: { sourceAdapterFactories: [createScrollContainerSourceAdapter] },
          pauseOnDocumentHidden: false,
        },
        styles: [{ slot: 'elce-player-layout', cssText: ELCE_PLAYER_STYLE_SHEET }],
      },
    })
  }

  /** Initializes Sighty and starts the persistent layout and current page. */
  public async initialize(): Promise<void> {
    await this.sighty.runtime.initialize()
    await this.sighty.runtime.play(ELCE_SCENARIO.LAYOUT_SCENE)
    const refreshed = await this.sighty.runtime.dispatch({ name: ELCE_EVENTS.PRESENTATION_REFRESH })
    if (!refreshed) this.options.onLog?.('La présentation Elcé n’a pas pu être actualisée.', 'warn')
    this.options.onLog?.('Prévisualisation Elcé initialisée.', 'info')
  }

  /** Destroys all player resources owned by this composition. */
  public destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.sighty.runtime.destroy()
  }
}

/** Builds the scene catalogue for pages that belong to the player scenario. */
function createPageSceneCatalog(
  document: ElceDocument,
  mediaSources: ElcePlayerCompositionOptions['mediaSources'],
): Readonly<Record<string, SightySceneSourceValue>> {
  return Object.fromEntries(scenarioPageIds(document).map((pageId) => {
    const page = document.pages.find((candidate) => candidate.id === pageId)
    if (page === undefined) throw new Error(`Page absente du document : ${pageId}`)
    const scene = buildFluxScene(page, document.bdcs, {
      mediaSources,
      mediaTypes: Object.fromEntries(document.medias.map((media) => [media.id, media.type])),
    })
    const questionReset = scene.questionReset
    if (questionReset === undefined) return [`scene-${page.id}`, scene.sceneDoc]
    return [`scene-${page.id}`, {
      sceneDoc: scene.sceneDoc,
      onReset: (keys: readonly string[]) => keys.includes('all') || keys.includes('quiz')
        ? { name: questionReset.eventName, data: { keys: [...keys] } }
        : undefined,
    }]
  }))
}

/** Reads the same page order used by the Sighty scenario builder. */
function scenarioPageIds(document: ElceDocument): readonly string[] {
  return document.scenarioPageIds
}

/** Assigns one stable CodPlay instance identity to every authored scene. */
function createInstanceIds(
  scenario: SightyScenarioDefinition<ElceSceneKey, ElceSlotName>,
): Record<ElceSceneKey, string> {
  return Object.fromEntries(Object.keys(scenario.scenes ?? {}).map((sceneKey) => [
    sceneKey,
    `elce-${sceneKey}-instance`,
  ])) as Record<ElceSceneKey, string>
}
