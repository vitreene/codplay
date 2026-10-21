import type { CodPlayEngineOptions } from 'codplay'
import {
  SCROLL_CONTAINER_COMPONENT_DEFINITION,
  SCROLL_CONTAINER_MODULE_DEFINITION,
} from '@codplay/component-v2/scroll-container'

/** Holds the CodPlay capabilities required to compile every Elcé scene. */
export const ELCE_ENGINE_CAPABILITIES: Pick<CodPlayEngineOptions, 'components' | 'modules'> = {
  components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
  modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
}

/** Exposes the same capabilities to the Sighty scene-package exporter. */
export const engineCapabilities = ELCE_ENGINE_CAPABILITIES
