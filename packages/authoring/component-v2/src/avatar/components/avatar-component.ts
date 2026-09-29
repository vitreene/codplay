import {
  type ComponentAnimation,
  type ComponentInput,
  type ComponentUpdateInput,
} from 'codplay'
import { Group } from 'three'
import type { Object3D, Scene } from 'three'
import { createAvatarEngine } from '../runtime/avatar-engine'
import {
  BaseThreeComponent,
  getThreeFbxResource,
  getThreeGlbResource,
} from '../../threejs/core'
import type { PreparedThreeGlbResource } from '../../threejs/core'
import type { ThreeSceneTarget } from '../../threejs/core'
import { AvatarCoordinator } from '../runtime/avatar-coordinator'
import type { AvatarInitial, AvatarTarget } from '../avatar-types'
import {
  prepareAvatarAnimation,
  resolveAvatarAnimationFormat,
} from '../model/animation-loader'

/** Loads one prepared 3D avatar and attaches it to an existing Three host. */
export class AvatarComponent extends BaseThreeComponent<AvatarInitial> {
  static readonly declaredServices = [] as const

  private readonly initial: AvatarInitial
  private readonly coordinator: AvatarCoordinator
  private readonly target: AvatarTarget
  private presentation: Group | undefined
  private motionRoot: Group | undefined
  private attachedScene: Scene | undefined
  private sceneTarget: ThreeSceneTarget | undefined
  private modelRevision = 0

  /** Creates the central Avatar capability without owning a canvas or renderer. */
  constructor(input: ComponentInput<AvatarInitial>) {
    super(input)
    this.initial = this.perso.initial
    this.coordinator = new AvatarCoordinator(
      this.initial.mood,
      this.initial.baseline,
      this.initial.body,
      this.initial.view,
    )
    this.target = this.coordinator
  }

  /** Builds the private model synchronously from the decoded preload source. */
  initialize(): void {
    this.loadModel(getThreeGlbResource(this.initial.src))
  }

  /** Attaches the model and registers the coordinator's absolute-time stream. */
  update(input: ComponentUpdateInput<AvatarInitial>): void {
    this.sceneTarget = input.target as ThreeSceneTarget | undefined
    this.syncGazeCamera()
    this.attachModel()
    input.registerAnimation?.(this.createAnimation())
  }

  /** Publishes the stable capability consumed by mood, lip-sync and gesture. */
  getTarget(): AvatarTarget {
    return this.target
  }

  /** Removes the model and releases the coordinator-owned native state. */
  destroy(): void {
    this.detachModel()
    if (this.presentation !== undefined) disposeAvatarPresentation(this.presentation)
    this.presentation = undefined
    this.motionRoot = undefined
    this.coordinator.detachEngine()
  }

  /** Registers one content stream for the Avatar's absolute-time composition. */
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

  /** Builds one independent model instance and its presentation hierarchy. */
  private loadModel(resource: PreparedThreeGlbResource): void {
    const engine = createAvatarEngine({
      mood: this.initial.mood,
      baseline: this.initial.baseline,
      modelMovementFactor: this.initial.modelMovementFactor,
      dynamicBones: this.initial.dynamicBones,
      dynamicBoneOptions: this.initial.dynamicBoneOptions,
    })
    const result = engine.loadModel(resource, {
      morphPrefix: this.initial.morphPrefix,
      modelRoot: this.initial.modelRoot,
      retarget: this.initial.retarget,
    })
    this.registerEmbeddedAnimations(engine, result.animations)
    this.loadAnimations(engine)
    const presentation = new Group()
    const motionRoot = new Group()
    const position = this.initial.position ?? [0, 0, 0]
    presentation.position.set(position[0], position[1], position[2])
    presentation.rotation.y = this.initial.modelRotationY ?? 0
    presentation.add(motionRoot)
    motionRoot.add(result.scene)
    presentation.updateMatrixWorld(true)

    this.presentation = presentation
    this.motionRoot = motionRoot
    this.modelRevision += 1
    this.coordinator.attachEngine(engine)
    this.attachModel()
  }

  /** Registers animations decoded before this Avatar was initialized. */
  private loadAnimations(engine: ReturnType<typeof createAvatarEngine>): void {
    for (const [name, source] of Object.entries(this.initial.animations ?? {})) {
      const format = resolveAvatarAnimationFormat(source)
      const clips = format === 'fbx'
        ? getThreeFbxResource(source.src).animations
        : getThreeGlbResource(source.src).animations
      const clip = prepareAvatarAnimation(
        clips,
        source,
        name,
      )
      engine.registerAnimation(
        name,
        clip,
        source.mode ?? 'animation',
        source.rootMotion,
        source.entryTransitionMs,
      )
    }
  }

  /** Registers clips embedded in the model before external resources override names. */
  private registerEmbeddedAnimations(
    engine: ReturnType<typeof createAvatarEngine>,
    animations: readonly import('three').AnimationClip[],
  ): void {
    animations.forEach((clip, index) => {
      const name = clip.name || 'clip-' + index
      if (engine.getAnimation(name) !== undefined) return
      engine.registerAnimation(name, clip, 'animation')
    })
  }

  /** Adds the model to the current host scene without resolving any target. */
  private attachModel(): void {
    const scene = this.sceneTarget?.scene
    if (scene !== this.attachedScene) {
      this.detachModel()
      this.attachedScene = scene
    }
    if (scene !== undefined && this.presentation !== undefined && this.presentation.parent !== scene) {
      scene.add(this.presentation)
    }
  }

  /** Forwards the host's current camera without exposing it to feature components. */
  private syncGazeCamera(): void {
    this.coordinator.setGazeCamera(this.sceneTarget?.getCamera() ?? null)
  }

  /** Applies the Avatar layers after refreshing the host camera reference. */
  private applyAt(timeMs: number): void {
    this.syncGazeCamera()
    this.coordinator.applyAt(timeMs, (rootMotion) => {
      this.motionRoot?.position.set(rootMotion.x, rootMotion.y, rootMotion.z)
    })
  }

  /** Detaches the model while keeping the host scene alive. */
  private detachModel(): void {
    if (this.presentation !== undefined && this.attachedScene !== undefined) {
      this.attachedScene.remove(this.presentation)
    }
    this.attachedScene = undefined
  }
}

/** Releases geometries and materials owned by one Avatar model instance. */
function disposeAvatarPresentation(root: Object3D): void {
  const geometries = new Set<{ dispose: () => void }>()
  const materials = new Set<{ dispose: () => void }>()
  root.traverse((node) => {
    const renderable = node as Object3D & {
      geometry?: { dispose: () => void }
      material?: { dispose: () => void } | readonly { dispose: () => void }[]
    }
    if (renderable.geometry !== undefined) geometries.add(renderable.geometry)
    const material = renderable.material
    if (material === undefined) return
    if (Array.isArray(material)) {
      for (const item of material) materials.add(item)
      return
    }
    const singleMaterial = material as { dispose: () => void }
    materials.add(singleMaterial)
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
}
