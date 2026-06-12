import * as THREE from 'three'
import { TalkingHead } from '@met4citizen/talkinghead'

import { createAvatar3DComponentClass } from '@codplay/capsule-automation/avatar3d'
import type { AvatarHeadApi } from '@codplay/capsule-automation/avatar3d'
import { createAvatarPocScene } from '../scenes/avatar-poc-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

const AVATAR_W = 800
const AVATAR_H = 600

export async function runAvatarPoc1Demo(): Promise<void> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.setPixelRatio(globalThis.devicePixelRatio)
  renderer.setSize(AVATAR_W, AVATAR_H)
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;'

  const threeScene = new THREE.Scene()
  const threeCamera = new THREE.PerspectiveCamera(10, AVATAR_W / AVATAR_H, 0.1, 2000)
  threeScene.add(new THREE.AmbientLight(0xffffff, 0.9))
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
  dirLight.position.set(0, 1, 2)
  threeScene.add(dirLight)

  const head = new TalkingHead(null, {
    ttsEndpoint: null,
    lipsyncModules: ['fr'],
    avatarOnly: true,
    avatarOnlyScene: threeScene,
    avatarOnlyCamera: threeCamera,
  })

  await head.showAvatar({
    url: '/avatars/avatarsdk.glb',
    body: 'M',
    avatarMood: 'neutral',
    lipsyncLang: 'fr',
    retarget: {
      Neck: { z: -0.01, rx: -0.15 },
      Neck1: { z: -0.01, rx: -0.15 },
      Neck2: { z: -0.01, rx: -0.15 },
      LeftShoulder: { rz: -0.3 },
      RightShoulder: { rz: 0.3 },
      scaleToEyesLevel: 1.0,
      origin: { y: -0.1 },
    },
  })

  // avatarOnly: TH skips setView() — mirror its 'mid' view formula (FOV=10, cameraY=0, cameraDistance=0)
  // avatarHeight ≈ 1.2 (eyes at scaleToEyesLevel=1.0, +0.2 offset)
  const fovRad = 10 * (Math.PI / 180)
  const camZ = 8
  const avatarHeight = 1.2
  const camY = Math.tan(fovRad / 2) * camZ + avatarHeight / 3
  threeCamera.position.set(0, camY, camZ)
  threeCamera.lookAt(0, camY, 0)

  head.start()

  let prevFrameMs: number | null = null

  await runCodPlaySceneDemo({
    title: 'Avatar POC — CodPlay',
    subtitle: 'Avatar 3D piloté par CodPlay — audio media, visèmes en eventimes, tick Three.js via renderFrame.',
    scene: createAvatarPocScene(),
    rootNodeIds: ['avatar-stage'],
    activeDemo: 'avatar-poc-1',
    components: { 'avatar3d': createAvatar3DComponentClass({ canvas: renderer.domElement, head: head as unknown as AvatarHeadApi }) },
    renderFrame: (nowMs) => {
      const delta = prevFrameMs !== null ? nowMs - prevFrameMs : 0
      head.animate(delta)
      renderer.render(threeScene, threeCamera)
      prevFrameMs = nowMs
    },
  })
}
