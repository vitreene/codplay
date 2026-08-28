import type { RenderAdapter, ThirdPartyBinding } from 'codplay-v1'
import { ThreejsBaseComponent } from './threejs-base-component.js'

/** Creates the canonical ThirdPartyBinding for the generic `threejs` perso type. */
export function createThreejsBinding(): ThirdPartyBinding {
  const instances = new Set<ThreejsBaseComponent>()

  class ThreejsComponent extends ThreejsBaseComponent {
    override _init(): void {
      super._init()
      instances.add(this)
    }
  }

  const renderAdapter: RenderAdapter = {
    tick(info) { instances.forEach((component) => component._tick(info)) },
    prepareSeek() { instances.forEach((component) => component._prepareSeek()) },
    seek(info) { instances.forEach((component) => component._seek(info)) },
    stop() {
      instances.forEach((component) => component._stop())
      instances.clear()
    },
  }

  return {
    components: { threejs: ThreejsComponent },
    renderAdapter,
  }
}
