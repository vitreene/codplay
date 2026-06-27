import { BaseComponent } from 'codplay/runtime/components/lib/base-component'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from 'codplay/runtime/components/types'
import type { RenderSeekInfo, RenderTickInfo } from 'codplay/player/render-adapter-types'
import {
  WebGLRenderer,
  type BufferGeometry,
  type Camera,
  type Material,
  type Object3D,
  type Scene,
} from 'three'
import { normalizeThreejsSetDescriptors } from './threejs-animation-utils.js'
import { applyThreejsValues } from './threejs-value-applier.js'
import type { ThreejsAction, ThreejsBuildResult, ThreejsInitial, ThreejsSimulationFn } from './threejs-types.js'

const DEFAULT_SIZE = 600

type ThreejsRuntimeState = {
  scene: Scene
  camera: Camera
  refs: Map<string, unknown>
  dispose?: () => void
}

/** Disposes one material instance when present. */
function disposeMaterial(material: Material | undefined): void {
  material?.dispose()
}

/** Disposes the disposable resources reachable from one Three.js scene graph. */
function disposeSceneGraph(scene: Scene): void {
  scene.traverse((object) => {
    const candidate = object as Object3D & {
      geometry?: BufferGeometry
      material?: Material | Material[]
    }
    candidate.geometry?.dispose()
    if (Array.isArray(candidate.material)) {
      candidate.material.forEach(disposeMaterial)
      return
    }
    disposeMaterial(candidate.material)
  })
}

/** Syncs a camera aspect ratio when the camera exposes one. */
function syncCameraAspect(camera: Camera, width: number, height: number): void {
  const aspectCamera = camera as Camera & { aspect?: number; updateProjectionMatrix?: () => void }
  if (typeof aspectCamera.aspect !== 'number') return
  aspectCamera.aspect = width / Math.max(1, height)
  aspectCamera.updateProjectionMatrix?.()
}

export class ThreejsBaseComponent extends BaseComponent {
  private renderer: WebGLRenderer | null = null
  private runtimeState: ThreejsRuntimeState | null = null
  private initStarted = false
  private simulationFn: ThreejsSimulationFn | null = null

  /** Renders one persistent canvas root for the WebGL surface. */
  render(): ComponentRenderResult {
    if (this.node !== null) return this.node as ComponentRenderResult

    const initial = this.perso.initial as ThreejsInitial
    const canvas = this.buildNode('canvas') as HTMLCanvasElement
    canvas.width = initial.width ?? DEFAULT_SIZE
    canvas.height = initial.height ?? DEFAULT_SIZE
    canvas.style.cssText = 'width:100%;height:100%;display:block;'
    return canvas
  }

  /** Initializes the WebGL renderer once, then builds the authored runtime scene. */
  init(): void {
    if (this.initStarted) return
    this.initStarted = true

    const initial = this.perso.initial as ThreejsInitial
    const canvas = this.node as HTMLCanvasElement
    const renderer = new WebGLRenderer({
      canvas,
      alpha: initial.renderer?.alpha ?? true,
      antialias: initial.renderer?.antialias ?? true,
      preserveDrawingBuffer: initial.renderer?.preserveDrawingBuffer ?? true,
    })
    renderer.setPixelRatio(initial.renderer?.pixelRatio ?? globalThis.devicePixelRatio)
    renderer.setSize(canvas.width, canvas.height, false)

    this.renderer = renderer
    this.rebuildRuntimeScene()
  }

  /** Rebuilds the authored Three.js scene from scratch. */
  private rebuildRuntimeScene(): void {
    if (this.renderer === null) return

    this.destroyRuntimeScene()

    const initial = this.perso.initial as ThreejsInitial
    const canvas = this.node as HTMLCanvasElement
    const buildResult = initial.build({
      canvas,
      renderer: this.renderer,
      width: canvas.width,
      height: canvas.height,
    })
    const runtimeState = this.createRuntimeState(buildResult, canvas.width, canvas.height)
    this.runtimeState = runtimeState
    this.render3D()
  }

  /** Creates one runtime state wrapper with built-in refs. */
  private createRuntimeState(buildResult: ThreejsBuildResult, width: number, height: number): ThreejsRuntimeState {
    syncCameraAspect(buildResult.camera, width, height)
    const refs = new Map<string, unknown>()
    refs.set('root', buildResult.scene)
    refs.set('scene', buildResult.scene)
    refs.set('camera', buildResult.camera)
    for (const [ref, value] of Object.entries(buildResult.refs ?? {})) {
      refs.set(ref, value)
    }
    return {
      scene: buildResult.scene,
      camera: buildResult.camera,
      refs,
      dispose: buildResult.dispose,
    }
  }

  /** Resolves one internal Three.js ref declared by the authored build callback. */
  private resolveThreeRef(ref: string): unknown | null {
    return this.runtimeState?.refs.get(ref) ?? null
  }

  /** Applies one immediate set payload on the authored Three.js refs. */
  private applySetPayload(action: Pick<ThreejsAction, 'set'>): void {
    const descriptors = Array.isArray(action.set) ? normalizeThreejsSetDescriptors(action.set) : []
    for (const descriptor of descriptors) {
      const target = this.resolveThreeRef(descriptor.ref)
      if (target === null) {
        this.report('AUTHOR_THREEJS_REF_NOT_FOUND', `Unknown threejs ref \"${descriptor.ref}\"`, { ref: descriptor.ref })
        continue
      }
      applyThreejsValues(target, descriptor.values)
    }
  }

  /** Re-evaluates the current simulation from CodPlay time, then applies the resulting set payload. */
  private applySimulationFrame(input: { timelineMs: number; timelineDeltaMs: number; phase: 'tick' | 'seek' }): void {
    if (this.simulationFn === null || this.runtimeState === null) return
    this.simulationFn({
      timelineMs: input.timelineMs,
      timelineDeltaMs: input.timelineDeltaMs,
      phase: input.phase,
      refs: this.runtimeState.refs,
    })
  }

  /** Destroys the current runtime scene and releases Three.js resources. */
  private destroyRuntimeScene(): void {
    const runtimeState = this.runtimeState
    if (runtimeState === null) return
    runtimeState.dispose?.()
    disposeSceneGraph(runtimeState.scene)
    this.runtimeState = null
  }

  /** Renders one frame when the renderer and authored scene are both ready. */
  private render3D(): void {
    if (this.renderer === null || this.runtimeState === null) return
    this.renderer.render(this.runtimeState.scene, this.runtimeState.camera)
  }

  /** Called by the binding render adapter on every player tick. */
  _tick(info: RenderTickInfo): void {
    this.applySimulationFrame({
      timelineMs: info.timelineMs,
      timelineDeltaMs: info.timelineDeltaMs,
      phase: 'tick',
    })
    this.render3D()
  }

  /** Called by the binding render adapter once before seek replay. */
  _prepareSeek(): void {
    this.simulationFn = null
    this.rebuildRuntimeScene()
  }

  /** Called by the binding render adapter once after seek replay. */
  _seek(info: RenderSeekInfo): void {
    this.applySimulationFrame({
      timelineMs: info.timelineMs,
      timelineDeltaMs: 0,
      phase: 'seek',
    })
    this.render3D()
  }

  /** Called by the binding render adapter on stop/destroy. */
  _stop(): void {
    this.simulationFn = null
    this.destroyRuntimeScene()
    this.renderer?.dispose()
    this.renderer = null
    this.initStarted = false
  }

  /** Applies authored immediate set payloads received from the player. */
  update(input: RuntimeComponentUpdateInput): void {
    const action = input.action as ThreejsAction
    if (typeof action.simulate === 'function') {
      this.simulationFn = action.simulate
    } else if (action.simulate === null) {
      this.simulationFn = null
    }
    this.applySetPayload(action)
  }
}
