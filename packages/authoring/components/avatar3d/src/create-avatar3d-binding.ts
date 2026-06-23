/**
 * createAvatar3DBinding — ThirdPartyBinding factory for the 'avatar3d' perso type.
 *
 * Usage:
 *   new CodPlay({ bindings: [createAvatar3DBinding()] })
 *
 * The GLB is fetched once per URL via the preload strategy below (registered
 * automatically by the player before init() mounts components) — no async
 * setup() hook needed. Each persona instance clones the cached scene and
 * builds its own renderer/camera/engine in init() — see avatar3d-base-
 * component.ts and docs/formalisation/2026-06-23-avatar3d-component-
 * integration-plan.md §6-7.
 *
 * Idle animations (blink, breath, head drift) are wired in the scene's perso
 * actions using createHeadDriftFn / createBlinkScheduleFn / createBreathTriggerFn.
 */
import type { RenderAdapter, ThirdPartyBinding } from 'codplay'
import { preloadAvatar3DModel } from '@codplay/avatar-engine'
import { Avatar3DBaseComponent } from './avatar3d-base-component.js'

export function createAvatar3DBinding(): ThirdPartyBinding {
  const instances = new Set<Avatar3DBaseComponent>()

  class Avatar3DComponent extends Avatar3DBaseComponent {
    override _init(): void {
      super._init()
      instances.add(this)
    }
  }

  const renderAdapter: RenderAdapter = {
    tick(info) { instances.forEach((c) => c._tick(info)) },
    prepareSeek() { instances.forEach((c) => c._prepareSeek()) },
    seek(info) { instances.forEach((c) => c._seek(info)) },
    stop() {
      instances.forEach((c) => c._stop())
      instances.clear()
    },
  }

  return {
    components: { avatar3d: Avatar3DComponent },
    renderAdapter,
    preload: [{ type: 'avatar3d-glb', load: (url) => preloadAvatar3DModel(url) }],
  }
}
