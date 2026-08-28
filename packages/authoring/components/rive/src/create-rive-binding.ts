import type { RenderAdapter } from 'codplay-v1'
import type { ThirdPartyBinding } from 'codplay-v1'
import { RiveBaseComponent } from './rive-base-component'
import { CoachRiveComponent } from './coach-rive-component'
import { preloadRiveResource } from './rive-preload'

export function createRiveBinding(): ThirdPartyBinding {
  const instances = new Set<RiveBaseComponent>()

  class RiveComponent extends RiveBaseComponent {
    override _init(): void {
      super._init()
      instances.add(this)
    }
  }

  class CoachComponent extends CoachRiveComponent {
    override _init(): void {
      super._init()
      instances.add(this)
    }
  }

  const renderAdapter: RenderAdapter = {
    tick(info) { instances.forEach((c) => c._tick(info)) },
    prepareSeek() { instances.forEach((c) => c._prepareSeek()) },
    seek(info) { instances.forEach((c) => c._seek(info)) },
    pause() {},
    resume() {},
    rateChange(rate) { instances.forEach((c) => c.setRate(rate)) },
    stop() {
      instances.forEach((c) => c._stop())
      instances.clear()
    },
  }

  return {
    components: { rive: RiveComponent, 'rive-coach': CoachComponent },
    renderAdapter,
    preload: [{ type: 'rive', load: (url, _signal) => preloadRiveResource(url) }],
  }
}
