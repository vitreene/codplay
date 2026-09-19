import type { CompiledResourceManifest, SceneDoc } from 'codplay'
import {
  AVATAR_ENGINE,
  AVATAR_PRELOAD_STRATEGIES,
} from '@codplay/component-v2'
import { MOUTH_CUES, phraseWordsFR, PRESTON_TO_TH } from '../rive/avatar-data/phrase-fr'

const AVATAR_SCENE_ID = 'avatar-v2'
const AVATAR_STAGE_ID = 'avatar-stage'
const AVATAR_HOST_ID = 'avatar-three-host'
const AVATAR_ID = 'avatar'
const SCENE_END_MS = 18_500

export const AVATAR_SRC = '/avatars/avatarsdk.glb'
const AVATAR_RESOURCE_TYPE = 'avatar-glb'

/** Builds the Avatar V2 scene from data-only author declarations. */
export function createScene(): SceneDoc<string> {
  return {
    id: AVATAR_SCENE_ID,
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: AVATAR_STAGE_ID,
            type: 'tag',
            initial: {
              tag: 'div',
              move: '@root',
              attr: { id: AVATAR_STAGE_ID },
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
            id: AVATAR_HOST_ID,
            type: 'three-scene-host',
            initial: {
              move: { target: AVATAR_STAGE_ID },
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
              rel: { host: AVATAR_HOST_ID },
              kind: 'perspective',
              position: [0, 1.45, 4.15],
              lookAt: [0, 1.35, 0],
              fov: 16,
              near: 0.1,
              far: 100,
            },
            actions: {},
          },
          {
            id: 'ambient-light',
            type: 'three-light',
            initial: {
              rel: { host: AVATAR_HOST_ID },
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
              rel: { host: AVATAR_HOST_ID },
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
              rel: { host: AVATAR_HOST_ID },
              src: AVATAR_SRC,
              morphPrefix: 'Wolf3D_Head_',
              retarget: {
                Neck: { z: -0.01, rx: -0.15 },
                Neck1: { z: -0.01, rx: -0.15 },
                Neck2: { z: -0.01, rx: -0.15 },
                LeftShoulder: { rz: -0.3 },
                RightShoulder: { rz: 0.3 },
                scaleToEyesLevel: 1.0,
                origin: { y: -0.1 },
              },
              mood: 'neutral',
              modelRotationY: 0.22,
            },
            actions: {},
          },
          {
            id: 'avatar-mood',
            type: 'avatar-mood',
            initial: {
              rel: { host: AVATAR_HOST_ID, target: AVATAR_ID },
              mood: 'neutral',
            },
            actions: { 'avatar:mood': {} },
          },
          {
            id: 'avatar-idle',
            type: 'avatar-idle',
            initial: {
              rel: { host: AVATAR_HOST_ID, target: AVATAR_ID },
              blink: true,
            },
            actions: {},
          },
          {
            id: 'avatar-lip-sync',
            type: 'avatar-lip-sync',
            initial: {
              rel: { host: AVATAR_HOST_ID, target: AVATAR_ID },
              viseme: null,
              weight: 1,
            },
            actions: { 'avatar:viseme': {} },
          },
          {
            id: 'avatar-gesture',
            type: 'avatar-gesture',
            initial: {
              rel: { host: AVATAR_HOST_ID, target: AVATAR_ID },
              gesture: null,
            },
            actions: { 'avatar:gesture': {} },
          },
          {
            id: 'audio',
            type: 'media',
            initial: {
              tag: 'audio',
              src: '/assets/1_7b_e.mp3',
              master: true,
              move: { target: AVATAR_STAGE_ID },
              video: { style: { display: 'none' } },
            },
            actions: { 'audio:start': { broadcast: { type: 'START' } } },
          },
          {
            id: 'caption',
            type: 'tag',
            initial: {
              tag: 'p',
              content: '',
              move: '@root',
              attr: { id: 'avatar-caption' },
              style: {
                position: 'absolute',
                bottom: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: '2',
                margin: '0',
                padding: '4px 10px',
                color: '#fff',
                fontSize: '15px',
                background: 'rgba(0,0,0,0.55)',
                borderRadius: '4px',
                minHeight: '1.6em',
                textAlign: 'center',
                pointerEvents: 'none',
              },
            },
            actions: { 'subtitle:word': {} },
          },
        ],
        eventimes: [
          { name: 'scene:start', startAt: 0 },
          { name: 'audio:start', startAt: 0 },
          { name: 'avatar:mood', startAt: 4_600, data: { mood: 'happy' } },
          { name: 'avatar:mood', startAt: 8_800, data: { mood: 'neutral' } },
          { name: 'avatar:gesture', startAt: 6_400, data: { gesture: 'wave_right' } },
          { name: 'avatar:gesture', startAt: 9_200, data: { gesture: null } },
          { name: 'avatar:gesture', startAt: 12_000, data: { gesture: 'thumbup_right' } },
          { name: 'avatar:gesture', startAt: 15_000, data: { gesture: null } },
          ...buildVisemeEventimes(),
          ...buildWordEventimes(),
          { name: 'sequence:end', startAt: SCENE_END_MS },
        ],
      },
    },
  }
}

/** Converts the prepared speech alignment into Avatar lip-sync actions. */
function buildVisemeEventimes() {
  return MOUTH_CUES.map((cue) => ({
    name: 'avatar:viseme',
    startAt: Math.round(cue.start * 1000),
    data: {
      viseme: PRESTON_TO_TH[cue.value] ?? null,
      durationMs: Math.round((cue.end - cue.start) * 1000),
    },
  }))
}

/** Converts the prepared word alignment into the demo caption stream. */
function buildWordEventimes() {
  return phraseWordsFR.map((word) => ({
    name: 'subtitle:word',
    startAt: word.startMs,
    data: { content: word.word },
  }))
}

/** Adds the Avatar component set to the shared Three engine. */
export const engineCapabilities = AVATAR_ENGINE

/** Prepares the model through the same V2 preload boundary as other modules. */
export const preloadStrategies = AVATAR_PRELOAD_STRATEGIES

/** Declares the GLB because the generic scene builder does not infer .glb types. */
export const preloadManifest: CompiledResourceManifest = {
  entries: [{
    url: AVATAR_SRC,
    type: AVATAR_RESOURCE_TYPE,
    policy: { cache: 'default', priority: 'high' },
  }],
}
