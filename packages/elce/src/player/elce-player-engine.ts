import type { CodPlayEngineOptions } from 'codplay'
import { RIVE_ENGINE } from '@codplay/component-v2'
import { SCROLL_CONTAINER_COMPONENT_DEFINITION } from '@codplay/component-v2/scroll-container/scroll-container-component'
import { SCROLL_CONTAINER_MODULE_DEFINITION } from '@codplay/component-v2/scroll-container/scroll-container-module'

/** Holds the CodPlay capabilities required to compile every Elcé scene. */
export const ELCE_ENGINE_CAPABILITIES: Pick<CodPlayEngineOptions, 'components' | 'modules' | 'libraries'> = {
  ...RIVE_ENGINE,
  libraries: {
    register: (RIVE_ENGINE.libraries?.register ?? []).map((library) => ({
      ...library,
      module: '@rive-app/canvas-advanced-single',
      delivery: { mode: 'package' },
    })),
  },
  components: {
    register: [
      ...(RIVE_ENGINE.components?.register ?? []),
      SCROLL_CONTAINER_COMPONENT_DEFINITION,
    ],
  },
  modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
}

/** Exposes the same capabilities to the Sighty scene-package exporter. */
export const engineCapabilities = ELCE_ENGINE_CAPABILITIES
