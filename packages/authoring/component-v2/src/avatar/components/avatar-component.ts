import {
  type ComponentAnimation,
  type ComponentInput,
  type ComponentUpdateInput,
} from 'codplay'
import type { Group, Object3D, Scene } from 'three'
import { createAvatarEngine } from '../runtime/avatar-engine'
import { BaseThreeComponent, getThreeBinaryResource } from '../../threejs/core'
import type { ThreeSceneTarget } from '../../threejs/core'
import { AvatarCoordinator } from '../runtime/avatar-coordinator'
import type { AvatarTarget } from '../runtime/avatar-target'
import type { AvatarInitial } from './avatar-types'
import { parseAvatarAnimation } from '../model/animation-loader'

/** Loads one prepared 3D avatar and attaches it to an existing Three host. */
export class AvatarComponent extends BaseThreeComponent<AvatarInitial> {
  static readonly declaredServices = [] as const

  private readonly initial: AvatarInitial
  private readonly coordinator: AvatarCoordinator
  private readonly target: AvatarTarget
  private model: Group | undefined
  private attachedScene: Scene | undefined
  private sceneTarget: ThreeSceneTarget | undefined
  private modelRevision = 0
  private destroyed = false

  /** Creates the central Avatar capability without owning a canvas or renderer. */
  constructor(input: ComponentInput<AvatarInitial>) {
    super(input)
    this.initial = this.perso.initial
    this.coordinator = new AvatarCoordinator(this.initial.mood)
    this.target = this.coordinator
  }

  /** Starts parsing the bytes prepared by the Three.js preload strategy. */
  initialize(): void {
    void this.loadModel(getThreeBinaryResource(this.initial.src))
  }

  /** Attaches the model and registers the coordinator's absolute-time stream. */
  update(input: ComponentUpdateInput<AvatarInitial>): void {
    this.sceneTarget = input.target as ThreeSceneTarget | undefined
    this.syncGazeCamera()
    this.attachModel()

    if (input.registerAnimation !== undefined) {
      input.registerAnimation(this.createAnimation())
      return
    }
    this.coordinator.applyAt(input.timeMs)
  }

  /** Publishes the stable capability consumed by mood, lip-sync and gesture. */
  getTarget(): AvatarTarget {
    return this.target
  }

  /** Removes the model and releases the coordinator-owned native state. */
  destroy(): void {
    this.destroyed = true
    this.detachModel()
    if (this.model !== undefined) disposeModel(this.model)
    this.model = undefined
    this.coordinator.detachEngine()
  }

  /** Registers one content stream so the host commits after Avatar contributions. */
  private createAnimation(): ComponentAnimation {
    return {
      id: 'avatar-coordinate',
      startAt: 0,
      endAt: Number.POSITIVE_INFINITY,
      sample: (timeMs) => ({
        value: `${timeMs}:${this.modelRevision}:${this.coordinator.getRevision()}`,
        apply: () => this.applyAt(timeMs),
      }),
    }
  }

  /** Parses one independent model instance from the preloaded bytes. */
  private async loadModel(buffer: ArrayBuffer): Promise<void> {
    const engine = createAvatarEngine({ mood: this.initial.mood })
    const result = await engine.loadModel(buffer, {
      morphPrefix: this.initial.morphPrefix,
      retarget: this.initial.retarget,
    })
    await this.loadAnimations(engine)
    result.scene.rotation.y = this.initial.modelRotationY ?? 0
    const position = this.initial.position ?? [0, 0, 0]
    result.scene.position.set(position[0], position[1], position[2])
    result.scene.updateMatrixWorld(true)

    if (this.destroyed) {
      disposeModel(result.scene)
      return
    }

    this.model = result.scene
    this.modelRevision += 1
    this.coordinator.attachEngine(engine)
    this.attachModel()
  }

  /** Parses and registers the animation resources associated with this Avatar. */
  private async loadAnimations(engine: ReturnType<typeof createAvatarEngine>): Promise<void> {
    for (const [name, source] of Object.entries(this.initial.animations ?? {})) {
      const clip = await parseAvatarAnimation(
        getThreeBinaryResource(source.src),
        source,
        name,
      )
      engine.registerAnimation(name, clip, source.mode ?? 'animation')
    }
  }

  /** Adds the model to the current host scene without resolving any target. */
  private attachModel(): void {
    const scene = this.sceneTarget?.scene
    if (scene !== this.attachedScene) {
      this.detachModel()
      this.attachedScene = scene
    }
    if (scene !== undefined && this.model !== undefined && this.model.parent !== scene) {
      scene.add(this.model)
    }
  }

  /** Forwards the host's current camera without exposing it to feature components. */
  private syncGazeCamera(): void {
    this.coordinator.setGazeCamera(this.sceneTarget?.getCamera() ?? null)
  }

  /** Applies the Avatar layers after refreshing the host camera reference. */
  private applyAt(timeMs: number): void {
    this.syncGazeCamera()
    this.coordinator.applyAt(timeMs)
  }

  /** Detaches the model while keeping the host scene alive. */
  private detachModel(): void {
    if (this.model !== undefined && this.attachedScene !== undefined) {
      this.attachedScene.remove(this.model)
    }
    this.attachedScene = undefined
  }
}

/** Releases geometries and materials owned by one parsed Avatar model. */
function disposeModel(root: Object3D): void {
  root.traverse((node) => {
    const renderable = node as Object3D & {
      geometry?: { dispose: () => void }
      material?: { dispose: () => void } | readonly { dispose: () => void }[]
    }
    renderable.geometry?.dispose()
    const material = renderable.material
    if (material === undefined) return
    if (Array.isArray(material)) {
      for (const item of material) item.dispose()
      return
    }
    const singleMaterial = material as { dispose: () => void }
    singleMaterial.dispose()
  })
}
