import {
  SCROLL_CONTAINER_COMPONENT_DEFINITION,
  SCROLL_CONTAINER_MODULE_DEFINITION,
  createScrollContainerSourceAdapter,
} from '@codplay/component-v2'
import type { CodPlayOptions } from 'codplay'
import type { SightyOwnerOptions } from '@codplay/sighty'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'

/** Declares the scroll capability used by Demo 5 for both authoring and export. */
export const engineCapabilities = {
  components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
  modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
}

/** Exposes the existing HTML source adapter required by the course scenes. */
export const sourceAdapterFactories = [createScrollContainerSourceAdapter]

/** Supplies the scene-root fill style used by the existing Sighty compositions. */
export const sceneRootStyleSheet = SIGHTY_SCENE_ROOT_STYLE_SHEET

/** Supplies the existing host integrations consumed by the standalone package loader. */
export const codplayOptions: Omit<CodPlayOptions, 'engine'> = {
  htmlHost: { sourceAdapterFactories },
  pauseOnDocumentHidden: false,
}

/** Supplies the existing scene-root style to the standalone package loader. */
export const runtimeOptions: NonNullable<SightyOwnerOptions['runtime']> = {
  styles: [{ slot: 'sighty-demo5-scene-root', cssText: sceneRootStyleSheet }],
}
