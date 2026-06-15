/**
 * createAvatar3D — async factory for the avatar3d CodPlay component.
 *
 * Usage in a demo's setup():
 *
 *   const av3d = await createAvatar3D({ glbUrl, retarget, camera, renderer, scene })
 *   return {
 *     components: { avatar3d: av3d.componentClass },
 *     renderAdapters: [av3d.renderAdapter],
 *   }
 *
 * The idle strap collection is returned separately (createAvatar3DStraps) and must be
 * passed as strapCollection at the top level of runCodPlaySceneDemo.
 */
import type { PerspectiveCamera, WebGLRenderer, Scene } from 'three'
import { createAvatarEngine, GazeService } from '@codplay/avatar-engine'
import type { MoodName, RetargetConfig } from '@codplay/avatar-engine'
import type { RuntimeComponentClass } from 'codplay/runtime/components'
import { createAvatar3DComponentClass } from './avatar3d-component.js'
import { createAvatar3DRenderAdapter } from './avatar3d-render-adapter.js'

export type Avatar3DConfig = {
  /** URL of the GLB model (Mixamo rig + ARKit blend shapes). */
  glbUrl: string
  /** Mixamo retarget config — bone adjustments, scale, origin. */
  retarget?: RetargetConfig
  /**
   * Prefix to strip from raw morph target names in the GLB.
   * ReadyPlayerMe / avatarsdk.glb: /^Wolf3D_[^_]+_/
   * Pure ARKit models: leave undefined.
   */
  morphPrefix?: string | RegExp
  /** Three.js perspective camera — used for gaze computation. */
  camera: PerspectiveCamera
  /** Three.js WebGL renderer — its domElement becomes the component's DOM node. */
  renderer: WebGLRenderer
  /** Three.js scene — the loaded model group is added here automatically. */
  scene: Scene
  /** Max viseme morph weight. Default: 0.75 */
  visemeWeight?: number
  /** Initial mood (expression baselines). Default: 'neutral' */
  mood?: MoodName
}

export type Avatar3DSetup = {
  /** Pass as components.avatar3d in setup() return. */
  componentClass: RuntimeComponentClass
  /** Pass in renderAdapters in setup() return. */
  renderAdapter: {
    tick(info: { deltaMs: number }): void
    seekStart(): void
    seek(info: { nowMs: number; timelineMs: number }): void
    pause(): void
    resume(): void
    stop(): void
  }
}

export async function createAvatar3D(config: Avatar3DConfig): Promise<Avatar3DSetup> {
  const engine = createAvatarEngine({ mood: config.mood })

  const { scene: modelScene, boneMap } = await engine.loadModel(config.glbUrl, {
    retarget: config.retarget,
    morphPrefix: config.morphPrefix,
  })
  config.scene.add(modelScene)

  const leftEye  = boneMap.get('LeftEye')  ?? null
  const rightEye = boneMap.get('RightEye') ?? null
  const gaze = new GazeService(engine.morphEngine, leftEye, rightEye, config.camera)

  const componentClass = createAvatar3DComponentClass({
    canvas: config.renderer.domElement,
    engine,
    gaze,
    visemeWeight: config.visemeWeight,
  })

  const renderAdapter = createAvatar3DRenderAdapter({
    engine,
    gaze,
    renderer: config.renderer,
    threeScene: config.scene,
    camera: config.camera,
  })

  // Render one initial frame so the character has a pose (not blank/T-pose)
  // before the player's play() is called. Gaze is enabled by default so the
  // character looks at the camera from the first frame.
  gaze.setEnabled(true)
  gaze.computeAndApply()
  config.renderer.render(config.scene, config.camera)

  return { componentClass, renderAdapter }
}
