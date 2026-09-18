import type { SceneDoc } from 'codplay'

const THREE_GRID_SCENE_ID = 'threejs-grid'
const THREE_GRID_TARGET = { scene: THREE_GRID_SCENE_ID }

/** Creates the first V2 Three.js vertical with separate scene, camera, lights and grid persos. */
export function createScene(): SceneDoc<string> {
  return {
    id: THREE_GRID_SCENE_ID,
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: 'scene',
            type: 'three-scene-host',
            initial: {
              move: '@root',
              width: 720,
              height: 540,
              background: '#0f172a',
            },
          },
          {
            id: 'camera',
            type: 'three-camera',
            initial: {
              move: '@root',
              rel: { target: THREE_GRID_TARGET },
              kind: 'perspective',
              position: [0, 0, 6],
              fov: 50,
              near: 0.1,
              far: 100,
            },
          },
          {
            id: 'ambient-light',
            type: 'three-light',
            initial: {
              move: '@root',
              rel: { target: THREE_GRID_TARGET },
              kind: 'ambient',
              color: '#ffffff',
              intensity: 0.12,
            },
          },
          {
            id: 'point-light',
            type: 'three-light',
            initial: {
              move: '@root',
              rel: { target: THREE_GRID_TARGET },
              kind: 'point',
              color: '#dbeafe',
              intensity: 2.5,
              distance: 20,
              decay: 0.4,
              position: [3, 3, 6],
            },
          },
          {
            id: 'grid',
            type: 'three-instanced-grid',
            initial: {
              move: '@root',
              rel: { target: THREE_GRID_TARGET },
              gridSize: 4,
              cellSize: 0.5,
              expansion: 4,
              delayMaxMs: 500,
              durationMs: 2_000,
              holdMs: 500,
              rotationPeriodMs: 9_000,
              rotationXPeriodMs: 12_000,
              color: '#64748b',
              opacity: 0.35,
            },
            actions: {
              'grid:start': { animate: true },
            },
          },
        ],
        eventimes: [{ name: 'grid:start', startAt: 0 }],
      },
    },
  }
}
