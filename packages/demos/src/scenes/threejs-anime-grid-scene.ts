declare module 'three'

import 'animejs/adapters/three'

import { utils } from 'animejs'
import { getInstances } from 'animejs/adapters/three'
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  InstancedMesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
} from 'three'
import type { SceneDoc } from 'codplay/player/types'
import type { ThreejsBuildContext, ThreejsBuildResult, ThreejsSetDescriptor, ThreejsSimulationFn } from '@codplay/threejs'

const STAGE_SIZE = 720
const GRID_SIZE = 4
const CUBE_EXPANSION = 10
const DEMO_DURATION_MS = 30000
const POINT_LIGHT_DURATION_MS = 2500
const POINT_LIGHT_HOLD_MS = 500
const INSTANCES_DURATION_MS = 2000
const INSTANCES_HOLD_MS = 500
const INSTANCES_DELAY_MAX_MS = 500

type GridPoint = { x: number; y: number; z: number }

/** Clamps one value in the [0, 1] interval. */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** Builds the authored base grid positions and the center-out delay per instance. */
function createGridLayoutData(): { positions: GridPoint[]; delaysMs: number[]; spread: number } {
  const positions: GridPoint[] = []
  const delaysMs: number[] = []
  const cellSize = 2 / GRID_SIZE
  const spread = ((GRID_SIZE - 1) / 2) * cellSize
  const center = (GRID_SIZE - 1) / 2
  const maxDistance = Math.sqrt(center * center * 3)

  for (let z = 0; z < GRID_SIZE; z += 1) {
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        positions.push({
          x: -spread + x * cellSize,
          y: -spread + y * cellSize,
          z: -spread + z * cellSize,
        })
        const dx = x - center
        const dy = y - center
        const dz = z - center
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
        const normalized = maxDistance === 0 ? 0 : clamp01(distance / maxDistance)
        const reversedCenterEase = Math.pow(1 - normalized, 3)
        delaysMs.push(reversedCenterEase * INSTANCES_DELAY_MAX_MS)
      }
    }
  }

  return { positions, delaysMs, spread }
}

/** Evaluates one ping-pong factor with hold phases at both extremes. */
function evaluatePingPongFactor(elapsedMs: number, durationMs: number, holdMs: number): number {
  const cycleMs = durationMs * 2 + holdMs * 2
  const localMs = ((elapsedMs % cycleMs) + cycleMs) % cycleMs

  if (localMs < durationMs) return localMs / durationMs
  if (localMs < durationMs + holdMs) return 1
  if (localMs < durationMs + holdMs + durationMs) {
    return 1 - (localMs - durationMs - holdMs) / durationMs
  }
  return 0
}

/** Resolves the point light intensity at one absolute scene time. */
function resolvePointLightIntensity(elapsedMs: number): number {
  const factor = evaluatePingPongFactor(elapsedMs, POINT_LIGHT_DURATION_MS, POINT_LIGHT_HOLD_MS)
  return 30 * (1 - factor)
}

/** Resolves the current expansion factor of one cube instance at one absolute scene time. */
function resolveInstanceFactor(elapsedMs: number, delayMs: number): number {
  const localMs = elapsedMs - delayMs
  if (localMs <= 0) return 0
  return evaluatePingPongFactor(localMs, INSTANCES_DURATION_MS, INSTANCES_HOLD_MS)
}

/** Builds the set payload applied by the generic threejs component at one absolute time. */
function buildThreejsSetPayload(elapsedMs: number): ThreejsSetDescriptor[] {
  const layout = createGridLayoutData()
  const rotationY = (elapsedMs / 9000) * 360
  const rotationX = (elapsedMs / 12000) * 360
  const currentPositions = layout.positions.map((position, index) => {
    const factor = resolveInstanceFactor(elapsedMs, layout.delaysMs[index] ?? 0)
    const scale = 1 + factor * (CUBE_EXPANSION - 1)
    return {
      x: position.x * scale,
      y: position.y * scale,
      z: position.z * scale,
    }
  })

  return [
    {
      ref: 'mesh',
      values: {
        rotateY: rotationY,
        rotateX: rotationX,
      },
    },
    {
      ref: 'pointLight',
      values: {
        intensity: resolvePointLightIntensity(elapsedMs),
      },
    },
    {
      ref: 'instances',
      values: {
        x: (_target: unknown, index: number) => currentPositions[index]?.x ?? 0,
        y: (_target: unknown, index: number) => currentPositions[index]?.y ?? 0,
        z: (_target: unknown, index: number) => currentPositions[index]?.z ?? 0,
      },
    },
  ]
}

/** Builds the procedural Three.js scene used by the CodPlay-controlled demo. */
function buildAnimeGridScene(context: ThreejsBuildContext): ThreejsBuildResult {
  const { renderer, width, height } = context
  const layout = createGridLayoutData()

  renderer.shadowMap.enabled = true

  const scene = new Scene()
  scene.background = new Color('#111827')

  const camera = new PerspectiveCamera(50, width / height, 0.1, 100)
  camera.position.z = 6
  scene.add(camera)

  scene.add(new AmbientLight(0xffffff, 0.25))

  const pointLight = new PointLight(0xffffff, 8, 20, 0.4)
  pointLight.castShadow = true
  pointLight.position.set(layout.spread * 4, layout.spread * 4, 6)
  scene.add(pointLight)

  const directionalLight = new DirectionalLight(0xffffff, 2)
  directionalLight.position.set(2, 3, 4)
  scene.add(directionalLight)

  const cellSize = 2 / GRID_SIZE
  const geometry = new BoxGeometry(cellSize, cellSize, cellSize)
  const material = new MeshLambertMaterial({ color: '#93c5fd' })
  const mesh = new InstancedMesh(geometry, material, GRID_SIZE * GRID_SIZE * GRID_SIZE)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)

  const instances = getInstances(mesh)
  utils.set(instances, {
    x: (_target: unknown, index: number) => layout.positions[index]?.x ?? 0,
    y: (_target: unknown, index: number) => layout.positions[index]?.y ?? 0,
    z: (_target: unknown, index: number) => layout.positions[index]?.z ?? 0,
  })

  return {
    scene,
    camera,
    refs: {
      mesh,
      pointLight,
      instances,
    },
  }
}

/** Creates one deterministic 3D simulation driven exclusively by CodPlay time. */
function createAnimeGridSimulation(): ThreejsSimulationFn {
  return ({ timelineMs }) => buildThreejsSetPayload(timelineMs % DEMO_DURATION_MS)
}

export function createThreejsAnimeGridScene(): SceneDoc {
  return {
    id: 'threejs-anime-grid-scene',
    rootStories: ['threejs-anime-grid-story'],
    stories: {
      'threejs-anime-grid-story': {
        id: 'threejs-anime-grid-story',
        entries: ['threejs-stage', 'threejs-grid'],
        persos: [
          {
            id: 'threejs-stage',
            type: 'tag',
            initial: {
              tag: 'div',
              style: {
                position: 'relative',
                width: `${STAGE_SIZE}px`,
                height: `${STAGE_SIZE}px`,
                overflow: 'hidden',
                borderRadius: '24px',
                boxShadow: '0 24px 80px rgba(15, 23, 42, 0.45)',
              },
            },
            actions: {},
          },
          {
            id: 'threejs-grid',
            type: 'threejs',
            initial: {
              move: { parentId: 'threejs-stage' },
              width: STAGE_SIZE,
              height: STAGE_SIZE,
              build: buildAnimeGridScene,
            },
            actions: {
              'scene:start': {
                simulate: createAnimeGridSimulation(),
              },
            },
          },
        ],
        eventimes: [
          { name: 'scene:start', startAt: 0 },
        ],
      },
    },
  } as unknown as SceneDoc
}
