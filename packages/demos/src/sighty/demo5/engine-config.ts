import type { CodPlayOptions } from 'codplay'
import type { SightyOwnerOptions } from '@codplay/sighty'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'

/** Declares the engine capabilities of Demo 5: scroll-container is a core type, nothing to register. */
export const engineCapabilities = {}

/** Supplies the scene-root fill style used by the existing Sighty compositions. */
export const sceneRootStyleSheet = SIGHTY_SCENE_ROOT_STYLE_SHEET

/** Supplies the existing host integrations consumed by the standalone package loader. */
export const codplayOptions: Omit<CodPlayOptions, 'engine'> = {
  pauseOnDocumentHidden: false,
}

/** Supplies the existing scene-root style to the standalone package loader. */
export const runtimeOptions: NonNullable<SightyOwnerOptions['runtime']> = {
  styles: [{ slot: 'sighty-demo5-scene-root', cssText: sceneRootStyleSheet }],
}
