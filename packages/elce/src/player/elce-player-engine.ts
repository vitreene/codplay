import type { CodPlayEngineOptions } from 'codplay'
import { RIVE_ENGINE } from '@codplay/component-v2'

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
}

/** Exposes the same capabilities to the Sighty scene-package exporter. */
export const engineCapabilities = ELCE_ENGINE_CAPABILITIES
