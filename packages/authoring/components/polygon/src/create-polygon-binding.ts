import type { ThirdPartyBinding } from 'codplay'
import { PolygonComponent } from './polygon-component.js'

export function createPolygonBinding(): ThirdPartyBinding {
  return {
    components: { polygon: PolygonComponent },
  }
}
