import type {
  ComponentAnimation,
  ComponentUpdateInput,
} from 'codplay'
import type {
  BufferGeometry,
  InstancedMesh,
  Material,
  Object3D,
  Scene,
} from 'three'
import { BaseThreeComponent } from '../core/threejs-component'
import type { ThreeSceneTarget } from '../core/threejs-core-types'
import type { ThreeInstancedGridInitial } from './three-instanced-grid-types'

type GridPoint = Readonly<{ x: number; y: number; z: number }>

type GridLayout = Readonly<{
  positions: readonly GridPoint[]
  delaysMs: readonly number[]
  spread: number
}>

type GridState = ThreeInstancedGridInitial & Readonly<{
  animate?: boolean
}>

/** Owns one procedural instanced grid attached to a related Three.js scene. */
export class ThreeInstancedGridComponent extends BaseThreeComponent<ThreeInstancedGridInitial> {
  static readonly declaredServices = [] as const

  private mesh: InstancedMesh | undefined
  private geometry: BufferGeometry | undefined
  private material: Material | undefined
  private scratch: Object3D | undefined
  private layout: GridLayout | undefined
  private signature: string | undefined
  private attachedScene: Scene | undefined

  /** Creates or updates the grid and registers its CodPlay-time animation. */
  update(input: ComponentUpdateInput<ThreeInstancedGridInitial>): void {
    const target = input.target as ThreeSceneTarget
    if (this.attachedScene !== undefined && this.attachedScene !== target.scene) this.detach()

    const state = input.state as GridState
    const nextSignature = createGridSignature(state)
    if (this.mesh === undefined || this.signature !== nextSignature) {
      this.disposeMesh()
      this.createMesh(state)
      this.signature = nextSignature
    }
    if (this.mesh === undefined || this.layout === undefined || this.scratch === undefined) return
    if (this.mesh.parent !== target.scene) target.scene.add(this.mesh)
    this.attachedScene = target.scene

    const animationAction = resolveAnimationAction(input)
    const startAt = animationAction?.startAt ?? input.timeMs
    if (animationAction === undefined) {
      applyGridPose(this.mesh, this.layout, 0, state, this.scratch)
      return
    }

    const animation: ComponentAnimation = {
      id: 'three-instanced-grid-animation',
      startAt,
      endAt: Number.MAX_SAFE_INTEGER,
      sample: (timeMs) => ({
        value: timeMs,
        apply: () => {
          if (this.mesh !== undefined && this.layout !== undefined && this.scratch !== undefined) {
            applyGridPose(this.mesh, this.layout, Math.max(0, timeMs - startAt), state, this.scratch)
          }
        },
      }),
    }
    input.registerAnimation?.(animation)
  }

  /** Releases the geometry and material created by this grid component. */
  destroy(): void {
    this.detach()
    this.disposeMesh()
    this.layout = undefined
    this.scratch = undefined
  }

  /** Removes the grid from its current scene without disposing it. */
  private detach(): void {
    if (this.mesh !== undefined && this.attachedScene !== undefined) this.attachedScene.remove(this.mesh)
    this.attachedScene = undefined
  }

  /** Builds the native instanced mesh from validated serializable data. */
  private createMesh(state: GridState): void {
    const gridSize = resolveGridSize(state.gridSize)
    const cellSize = resolvePositive(state.cellSize, 0.5)
    const geometry = new this.runtime.BoxGeometry(cellSize, cellSize, cellSize)
    const material = new this.runtime.MeshLambertMaterial({
      color: state.color ?? '#64748b',
      transparent: true,
      opacity: resolveOpacity(state.opacity),
    })
    const mesh = new this.runtime.InstancedMesh(geometry, material, gridSize ** 3)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.geometry = geometry
    this.material = material
    this.mesh = mesh
    this.layout = createGridLayout(gridSize, resolvePositive(state.delayMaxMs, 500))
    this.scratch = new this.runtime.Object3D()
    applyGridPose(mesh, this.layout, 0, state, this.scratch)
  }

  /** Disposes the component-owned native resources and clears references. */
  private disposeMesh(): void {
    this.mesh?.parent?.remove(this.mesh)
    this.geometry?.dispose()
    this.material?.dispose()
    this.mesh = undefined
    this.geometry = undefined
    this.material = undefined
    this.signature = undefined
  }
}

/** Resolves one active animation occurrence from the component update. */
function resolveAnimationAction(
  input: ComponentUpdateInput<Record<string, unknown>>,
): { startAt: number } | undefined {
  const occurrence = input.activeActions?.find((candidate) => candidate.action.animate === true)
  return occurrence === undefined ? undefined : { startAt: occurrence.startAt }
}

/** Creates the static positions and center-out delays of the reference grid. */
function createGridLayout(gridSize: number, delayMaxMs: number): GridLayout {
  const positions: GridPoint[] = []
  const delaysMs: number[] = []
  const cellSize = 2 / gridSize
  const spread = ((gridSize - 1) / 2) * cellSize
  const center = (gridSize - 1) / 2
  const maxDistance = Math.sqrt(center * center * 3)

  for (let z = 0; z < gridSize; z += 1) {
    for (let y = 0; y < gridSize; y += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        positions.push({
          x: -spread + x * cellSize,
          y: -spread + y * cellSize,
          z: -spread + z * cellSize,
        })
        const dx = x - center
        const dy = y - center
        const dz = z - center
        const normalized = maxDistance === 0
          ? 0
          : Math.max(0, Math.min(1, Math.sqrt(dx * dx + dy * dy + dz * dz) / maxDistance))
        delaysMs.push(Math.pow(1 - normalized, 3) * delayMaxMs)
      }
    }
  }

  return { positions, delaysMs, spread }
}

/** Applies one absolute grid pose to the instanced mesh. */
function applyGridPose(
  mesh: InstancedMesh,
  layout: GridLayout,
  elapsedMs: number,
  state: GridState,
  scratch: Object3D,
): void {
  const durationMs = resolvePositive(state.durationMs, 2_000)
  const holdMs = resolvePositive(state.holdMs, 500)
  const expansion = resolvePositive(state.expansion, 4)
  const rotationPeriodMs = resolvePositive(state.rotationPeriodMs, 9_000)
  const rotationXPeriodMs = resolvePositive(state.rotationXPeriodMs, 12_000)
  mesh.rotation.y = ((elapsedMs / rotationPeriodMs) * Math.PI * 2) % (Math.PI * 2)
  mesh.rotation.x = ((elapsedMs / rotationXPeriodMs) * Math.PI * 2) % (Math.PI * 2)
  scratch.rotation.set(0, 0, 0)
  scratch.scale.set(1, 1, 1)

  for (let index = 0; index < layout.positions.length; index += 1) {
    const position = layout.positions[index]!
    const delay = layout.delaysMs[index] ?? 0
    const factor = resolveInstanceFactor(elapsedMs, delay, durationMs, holdMs)
    const scale = 1 + factor * (expansion - 1)
    scratch.position.set(position.x * scale, position.y * scale, position.z * scale)
    scratch.updateMatrix()
    mesh.setMatrixAt(index, scratch.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
}

/** Evaluates the delayed ping-pong factor of one cube instance. */
function resolveInstanceFactor(
  elapsedMs: number,
  delayMs: number,
  durationMs: number,
  holdMs: number,
): number {
  const localMs = elapsedMs - delayMs
  if (localMs <= 0) return 0
  const cycleMs = durationMs * 2 + holdMs * 2
  const cyclePosition = ((localMs % cycleMs) + cycleMs) % cycleMs
  if (cyclePosition < durationMs) return cyclePosition / durationMs
  if (cyclePosition < durationMs + holdMs) return 1
  if (cyclePosition < durationMs * 2 + holdMs) {
    return 1 - (cyclePosition - durationMs - holdMs) / durationMs
  }
  return 0
}

/** Produces an immutable signature for geometry-owning fields. */
function createGridSignature(state: GridState): string {
  return JSON.stringify([
    resolveGridSize(state.gridSize),
    resolvePositive(state.cellSize, 0.5),
    resolvePositive(state.delayMaxMs, 500),
    state.color ?? '#64748b',
    resolveOpacity(state.opacity),
  ])
}

/** Resolves a positive grid size accepted by the native instanced mesh. */
function resolveGridSize(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 4
  return Math.max(1, Math.min(32, Math.round(value)))
}

/** Resolves one positive timing or dimensional value. */
function resolvePositive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback
}

/** Resolves one material opacity in the native range. */
function resolveOpacity(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0.35
  return Math.max(0, Math.min(1, value))
}
