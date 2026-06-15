/**
 * Avatar3D render adapter — couples AvatarEngine + GazeService to CodPlay's ticker.
 *
 * tick()      → engine.animate(dt) → gaze.computeAndApply() → renderer.render()
 * seekStart() → engine.prepareSeek()  (reset morphs + gesture bones to baselines)
 * seek()      → engine.commitSeek() → gaze.computeAndApply() → renderer.render()
 *              (one frame at seek position, gaze re-computed from restored state)
 * pause()     → no-op (CodPlay stops calling tick())
 * resume()    → no-op (CodPlay resumes tick())
 * stop()      → engine.prepareSeek() + gaze disabled + render blank frame
 */
import type { WebGLRenderer, PerspectiveCamera, Scene } from 'three'
import type { AvatarEngine } from '@codplay/avatar-engine'
import type { GazeService } from '@codplay/avatar-engine'

type RenderAdapter = {
  tick(info: { deltaMs: number }): void
  seekStart(): void
  seek(info: { nowMs: number; timelineMs: number }): void
  pause(): void
  resume(): void
  stop(): void
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
    tick({ deltaMs }) {
      engine.animate(deltaMs)
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
