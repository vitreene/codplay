import type { SceneDoc } from 'codplay/player/types'

const SCENE_END_MS = 7800

/** Creates a minimal avatar3d scene focused only on mood transition smoothness. */
export function createAvatarMoodTransitionScene(): SceneDoc {
  return {
    id: 'avatar-mood-transition-scene',
    stories: {
      'avatar-mood-story': {
        id: 'avatar-mood-story',
        initial: { move: '@root' },
        persos: [
          {
            id: 'avatar-stage',
            type: 'tag',
            initial: {
              tag: 'div',
              move: '@root',
              style: {
                position: 'relative',
                width: '600px',
                height: '600px',
                overflow: 'hidden',
                background: '#111',
              },
            },
            actions: {},
          },
          {
            id: 'avatar',
            type: 'avatar3d',
            initial: {
              move: { parentId: 'avatar-stage' },
              src: '/avatars/avatarsdk.glb',
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
              width: 600,
              height: 600,
              mood: 'neutral',
              camera: { fov: 10, position: { y: 1.5, z: 3 } },
            },
            actions: {
              'avatar:mood': true,
              'avatar:morph': true,
            },
          },
          {
            id: 'caption',
            type: 'text',
            initial: {
              tag: 'p',
              content: 'Mood transition isolation demo',
              move: { parentId: 'avatar-stage' },
              style: {
                position: 'absolute',
                bottom: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
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
            actions: {
              'caption:set': {},
            },
          },
        ],
        eventimes: [
          { name: 'scene:start', startAt: 0 },
          { name: 'caption:set', startAt: 0, data: { content: '1/3 Direct morph: jawOpen opens over 600ms' } },
          { name: 'avatar:morph', startAt: 800, data: { name: 'jawOpen', value: 0.75, durationMs: 600 } },
          { name: 'caption:set', startAt: 1600, data: { content: '1/3 Direct morph: jawOpen closes over 600ms' } },
          { name: 'avatar:morph', startAt: 1800, data: { name: 'jawOpen', value: 0, durationMs: 600 } },
          { name: 'caption:set', startAt: 2800, data: { content: '2/3 Direct morph: eyeBlinkLeft/right close over 600ms' } },
          { name: 'avatar:morph', startAt: 3000, data: { name: 'eyeBlinkLeft', value: 0.8, durationMs: 600 } },
          { name: 'avatar:morph', startAt: 3000, data: { name: 'eyeBlinkRight', value: 0.8, durationMs: 600 } },
          { name: 'caption:set', startAt: 3900, data: { content: '2/3 Direct morph: eyeBlinkLeft/right open over 600ms' } },
          { name: 'avatar:morph', startAt: 4100, data: { name: 'eyeBlinkLeft', value: 0, durationMs: 600 } },
          { name: 'avatar:morph', startAt: 4100, data: { name: 'eyeBlinkRight', value: 0, durationMs: 600 } },
          { name: 'caption:set', startAt: 5200, data: { content: '3/3 Mood: sleep over 600ms' } },
          { name: 'avatar:mood', startAt: 5400, data: { mood: 'sleep', durationMs: 600 } },
          { name: 'caption:set', startAt: 6400, data: { content: '3/3 Mood: neutral over 600ms' } },
          { name: 'avatar:mood', startAt: 6600, data: { mood: 'neutral', durationMs: 600 } },
          { name: 'sequence:end', startAt: SCENE_END_MS },
        ],
      },
    },
  } as unknown as SceneDoc
}
