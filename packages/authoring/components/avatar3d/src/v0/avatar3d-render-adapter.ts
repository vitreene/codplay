/**
 * Avatar3D render adapter — couples AvatarEngine + GazeService to CodPlay's ticker.
 *
 * tick()      → engine.animate(timelineDeltaMs) → gaze.computeAndApply() → renderer.render()
 *              CodPlay is the single source of rate scaling: `timelineDeltaMs` is
 *              already `deltaMs × rate`, computed once by RenderSync. AvatarEngine
 *              has no rate concept of its own — it just integrates whatever delta
 *              it is given, exactly like the engine ticker has one clock, not one
 *              per consumer.
 * seekStart() → engine.prepareSeek()  (reset morphs + gesture bones to baselines)
 * seek()      → engine.commitSeek() → gaze.computeAndApply() → renderer.render()
 *              (one frame at seek position, gaze re-computed from restored state)
 * pause()     → no-op (CodPlay stops calling tick())
 * resume()    → no-op (CodPlay resumes tick())
 * stop()      → engine.prepareSeek() + gaze disabled + render blank frame
 *
 * Imports the canonical `RenderAdapter` contract from `codplay` rather than
 * redeclaring a local subset — this is what previously let the rate scaling
 * silently drift out of sync with the real contract. `seekStart` is a local-only
 * extension pending upstream adoption (see docs/formalisation/v1-rate-spec.md).
 */
import type { WebGLRenderer, PerspectiveCamera, Scene } from 'three'
import type { AvatarEngine } from '@codplay/avatar-engine'
import type { GazeService } from '@codplay/avatar-engine'
import type { RenderAdapter as CodplayRenderAdapter } from 'codplay'

type RenderAdapter = CodplayRenderAdapter & {
  seekStart(): void
}

export type Avatar3DRenderAdapterDeps = {
  engine: AvatarEngine
  gaze: GazeService
  renderer: WebGLRenderer
  threeScene: Scene
  camera: PerspectiveCamera
}

export function createAvatar3DRenderAdapter(deps: Avatar3DRenderAdapterDeps): RenderAdapter {
  const { engine, gaze, renderer, threeScene, camera } = deps

  function render(): void {
    renderer.render(threeScene, camera)
  }

  return {
    tick({ timelineDeltaMs }) {
      engine.animate(timelineDeltaMs)
      gaze.computeAndApply()
      render()
    },

    seekStart() {
      engine.prepareSeek()
    },

    seek() {
      engine.commitSeek()
      gaze.computeAndApply()
      render()
    },

    pause() {},

    resume() {},

    stop() {
      engine.prepareSeek()
      gaze.setEnabled(false)
      render()
    },
  }
}
