import * as THREE from 'three'
import { createAvatar3D, createAvatar3DStraps } from '@codplay/avatar3d'
import { createAvatarPocScene } from '../scenes/avatar-poc-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

const AVATAR_W = 600
const AVATAR_H = 600

export function runAvatarPoc1Demo(): Promise<void> {
  return runCodPlaySceneDemo({
    title: 'Avatar POC — CodPlay',
    subtitle:
      'Avatar 3D piloté exclusivement par CodPlay — visèmes, geste, gaze, idle strap, tick Three.js via renderAdapter.',
    scene: createAvatarPocScene(),
    rootNodeIds: ['avatar-stage'],
    activeDemo: 'avatar-poc-1',
    // Idle loops (blink, breathing, head micro-movement) — inline, seek-safe.
    strapCollection: createAvatar3DStraps(),
    async setup() {
      // preserveDrawingBuffer: true ensures the rendered frame stays visible between
      // RAF ticks — without it the canvas shows blank between player.init() and play().
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.setPixelRatio(globalThis.devicePixelRatio)
      renderer.setSize(AVATAR_W, AVATAR_H)
      renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;'

      const threeScene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(10, AVATAR_W / AVATAR_H, 0.1, 2000)

      threeScene.add(new THREE.AmbientLight(0xffffff, 0.9))
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
      dirLight.position.set(0, 1, 2)
      threeScene.add(dirLight)

      // Camera: tight FOV (10°) framing head-to-shoulders.
      // camZ=3, camY=1.5 → visible range [1.24, 1.76] at that depth.
      const camZ = 3
      const camY = 1.5
      camera.position.set(0, camY, camZ)
      camera.lookAt(0, camY, 0)

      const { componentClass, renderAdapter } = await createAvatar3D({
        glbUrl: '/avatars/avatarsdk.glb',
        // avatarsdk.glb is a ReadyPlayerMe model: morph names are prefixed "Wolf3D_Head_" etc.
        morphPrefix: /^Wolf3D_[^_]+_/,
        retarget: {
          Neck:          { z: -0.01, rx: -0.15 },
          Neck1:         { z: -0.01, rx: -0.15 },
          Neck2:         { z: -0.01, rx: -0.15 },
          LeftShoulder:  { rz: -0.3 },
          RightShoulder: { rz: 0.3 },
          scaleToEyesLevel: 1.0,
          origin: { y: -0.1 },
        },
        camera,
        renderer,
        scene: threeScene,
      })

      return {
        components: { avatar3d: componentClass },
        renderAdapters: [renderAdapter],
      }
    },
  })
}
