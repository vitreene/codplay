import type { ThirdPartyBinding } from 'codplay-v1'
import { SketchingComponent } from './sketching-component'

/**
 * Aucun `renderAdapter` (un `<path>` posé une fois est statique, pas de
 * boucle de rendu par frame) ni `preload` (aucune ressource externe) —
 * les deux optionnels sur `ThirdPartyBinding`.
 */
export function createSketchBinding(): ThirdPartyBinding {
  return {
    components: { sketch: SketchingComponent }
  }
}
