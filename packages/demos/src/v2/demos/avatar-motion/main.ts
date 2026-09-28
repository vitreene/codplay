import type { CompiledResourceManifest, SceneDoc } from 'codplay'
import { AVATAR_ENGINE, THREE_PRELOAD_STRATEGIES } from '@codplay/component-v2'

const SCENE_ID = 'avatar-motion-v2'
const STAGE_ID = 'avatar-motion-stage'
const HOST_ID = 'avatar-motion-three-host'
const AVATAR_ID = 'avatar-motion-model'
const AVATAR_SRC = '/avatars/avatarsdk.glb'
const WALK_SRC = '/avatars/hero-walk.fbx'

/** Builds the dedicated Avatar motion acceptance scene through the shared V2 layout. */
export function createScene(): SceneDoc<string> {
  return {
    id: SCENE_ID,
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: STAGE_ID,
            type: 'tag',
            initial: {
              tag: 'div',
              move: '@root',
              attr: { id: STAGE_ID },
              style: {
                position: 'relative',
                width: 'min(720px, 100%)',
                height: '100%',
                minHeight: '0',
                overflow: 'hidden',
                background: '#111827',
                borderRadius: '14px',
              },
            },
            actions: {},
          },
          {
            id: HOST_ID,
            type: 'three-scene-host',
            initial: {
              move: { target: STAGE_ID },
              width: 720,
              height: 720,
              background: '#111827',
              renderer: { alpha: true, antialias: true, preserveDrawingBuffer: true },
            },
            actions: {},
          },
          {
            id: 'camera',
            type: 'three-camera',
            initial: {
              rel: { host: HOST_ID },
              kind: 'perspective',
              position: [0, 1.1, 4.5],
              lookAt: [0, 1.0, 0],
              fov: 30,
              near: 0.1,
              far: 100,
            },
            actions: {},
          },
          {
            id: 'ambient-light',
            type: 'three-light',
            initial: {
              rel: { host: HOST_ID },
              kind: 'ambient',
              color: '#ffffff',
              intensity: 1.8,
            },
            actions: {},
          },
          {
            id: 'key-light',
            type: 'three-light',
            initial: {
              rel: { host: HOST_ID },
              kind: 'directional',
              color: '#dbeafe',
              intensity: 2.2,
              position: [1.5, 3, 3],
            },
            actions: {},
          },
          {
            id: AVATAR_ID,
            type: 'avatar',
            initial: {
              rel: { host: HOST_ID },
              src: AVATAR_SRC,
              morphPrefix: 'Wolf3D_Head_',
              retarget: {
                Neck: { z: -0.01, rx: -0.15 },
                Neck1: { z: -0.01, rx: -0.15 },
                Neck2: { z: -0.01, rx: -0.15 },
                LeftShoulder: { rz: -0.3 },
                RightShoulder: { rz: 0.3 },
                scaleToEyesLevel: 1,
                origin: { y: -0.1 },
              },
              mood: 'neutral',
              modelRotationY: 0.22,
              animations: {
                walk: {
                  src: WALK_SRC,
                  format: 'fbx',
                  mode: 'animation',
                  rootMotion: { type: 'arrival', transitionMs: 800 },
                  entryTransitionMs: 0,
                },
              },
            },
            actions: {},
          },
          {
            id: 'avatar-mood',
            type: 'avatar-mood',
            initial: {
              rel: { host: HOST_ID, target: AVATAR_ID },
              mood: 'neutral',
              pose: 'neutral',
              blink: true,
              breathe: false,
              headDrift: false,
            },
            actions: {},
          },
          {
            id: 'avatar-gaze',
            type: 'avatar-gaze',
            initial: {
              rel: { host: HOST_ID, target: AVATAR_ID },
              enabled: true,
              contact: 1,
            },
            actions: {},
          },
          {
            id: 'avatar-motion',
            type: 'avatar-motion',
            initial: {
              rel: { host: HOST_ID, target: AVATAR_ID },
              motion: 'walk',
              speed: 0.5,
            },
            actions: { 'avatar:motion:walk': {}, 'avatar:motion:release': {} },
          },
        ],
        eventimes: [
          { name: 'avatar:motion:walk', startAt: 0 },
          { name: 'sequence:end', startAt: 6_500 },
        ],
      },
    },
  }
}

/** Reuses the Avatar component set within the shared V2 engine lifecycle. */
export const engineCapabilities = AVATAR_ENGINE

/** Parses the model and motion through the existing Three.js preload strategies. */
export const preloadStrategies = THREE_PRELOAD_STRATEGIES

/** Declares both binary assets consumed by the Avatar's model loader. */
export const preloadManifest: CompiledResourceManifest = {
  entries: [
    { url: AVATAR_SRC, type: 'three-glb', policy: { cache: 'default', priority: 'high' } },
    { url: WALK_SRC, type: 'three-fbx', policy: { cache: 'default', priority: 'high' } },
  ],
}
