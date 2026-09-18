import {
  BaseHTMLComponent,
  type ComponentAnimation,
  type ComponentInput,
  type ComponentUpdateInput,
} from 'codplay'
import type { Camera, Scene, WebGLRenderer } from 'three'
import type { ThreeRuntimeAccess } from '../threejs-runtime'
import type {
  ThreeSceneHostInitial,
  ThreeSceneTarget,
} from '../threejs-types'

/** Runtime shape exposed by the scene-host factory to its target provider. */
export type ThreeSceneHostComponent = BaseHTMLComponent<Record<string, unknown>> & Readonly<{
  getSceneTarget: () => ThreeSceneTarget | undefined
}>

/** Constructor shape used by the external component definition. */
export type ThreeSceneHostComponentClass = {
  new (input: ComponentInput<Record<string, unknown>>): ThreeSceneHostComponent
  readonly declaredServices: readonly []
}

/** Creates the HTML host class bound to one integration-local runtime holder. */
export function createThreeSceneHostComponent(
  runtimeAccess: ThreeRuntimeAccess,
): ThreeSceneHostComponentClass {
  return class ThreeSceneHostComponentImpl extends BaseHTMLComponent<Record<string, unknown>> {
    static readonly declaredServices = [] as const

    private renderer: WebGLRenderer | undefined
    private scene: Scene | undefined
    private camera: Camera | null = null
    private target: ThreeSceneTarget | undefined
    private resizeObserver: ResizeObserver | undefined

    /** Returns the canvas root used by the HTML materializer. */
    render(): string {
      return '<canvas data-codplay-threejs="scene"></canvas>'
    }

    /** Creates the renderer and scene after the engine has prepared Three.js. */
    initialize(): void {
      if (this.node === null) throw new Error(`Three.js scene host is not materialized: ${this.perso.id}`)
      const runtime = runtimeAccess.require()
      const initial = this.perso.initial as ThreeSceneHostInitial
      const canvas = this.node as HTMLCanvasElement
      const width = resolvePositiveNumber(initial.width, 640)
      const height = resolvePositiveNumber(initial.height, 480)
      canvas.width = width
      canvas.height = height

      const renderer = new runtime.WebGLRenderer({
        canvas,
        alpha: initial.renderer?.alpha ?? true,
        antialias: initial.renderer?.antialias ?? true,
        preserveDrawingBuffer: initial.renderer?.preserveDrawingBuffer ?? false,
      })
      renderer.setPixelRatio(resolvePixelRatio(initial.renderer?.pixelRatio))
      renderer.setSize(width, height, false)

      const scene = new runtime.Scene()
      this.renderer = renderer
      this.scene = scene
      this.target = {
        scene,
        renderer,
        setCamera: (camera) => this.setCamera(camera),
        resize: (nextWidth, nextHeight) => this.resize(nextWidth, nextHeight),
        render: () => this.renderFrame(),
      }
      this.applyBackground(initial.background)
      this.observeResize(canvas)
    }

    /** Returns the opaque scene target published to related Three.js persos. */
    getSceneTarget(): ThreeSceneTarget | undefined {
      return this.target
    }

    /** Applies host state and schedules the final render after all updates. */
    update(input: ComponentUpdateInput<Record<string, unknown>>): void {
      if (this.target === undefined) return
      this.applyBackground(input.state.background)
      const animation: ComponentAnimation = {
        id: 'three-scene-render',
        startAt: 0,
        endAt: Number.MAX_SAFE_INTEGER,
        presentationPhase: 'commit',
        sample: (timeMs) => ({
          value: timeMs,
          apply: () => this.renderFrame(),
        }),
      }
      input.registerAnimation?.(animation)
    }

    /** Releases only the renderer and scene owned by this host. */
    destroy(): void {
      this.target = undefined
      this.camera = null
      this.resizeObserver?.disconnect()
      this.resizeObserver = undefined
      this.scene?.clear()
      this.scene = undefined
      this.renderer?.dispose()
      this.renderer = undefined
    }

    /** Updates the renderer viewport without rebuilding the scene graph. */
    private resize(width: number, height: number): void {
      if (this.renderer === undefined) return
      const nextWidth = resolvePositiveNumber(width, 1)
      const nextHeight = resolvePositiveNumber(height, 1)
      this.renderer.setSize(nextWidth, nextHeight, false)
      if (this.camera !== null) syncCameraAspect(this.camera, nextWidth, nextHeight)
    }

    /** Keeps the native viewport aligned with the host canvas content box. */
    private observeResize(canvas: HTMLCanvasElement): void {
      if (typeof ResizeObserver === 'undefined') return
      this.resizeObserver = new ResizeObserver(([entry]) => {
        const width = entry?.contentRect.width ?? canvas.clientWidth
        const height = entry?.contentRect.height ?? canvas.clientHeight
        if (width > 0 && height > 0) this.resize(width, height)
      })
      this.resizeObserver.observe(canvas)
    }

    /** Changes the camera used by the host's single render commit. */
    private setCamera(camera: Camera | null): void {
      if (this.scene === undefined) return
      if (this.camera !== null && this.camera !== camera) this.scene.remove(this.camera)
      this.camera = camera
      if (camera !== null && camera.parent !== this.scene) this.scene.add(camera)
      if (camera !== null) syncCameraAspect(camera, this.renderer?.domElement.width ?? 1, this.renderer?.domElement.height ?? 1)
    }

    /** Applies the serializable scene background value. */
    private applyBackground(value: unknown): void {
      if (this.scene === undefined || (typeof value !== 'string' && typeof value !== 'number')) return
      const runtime = runtimeAccess.require()
      this.scene.background = new runtime.Color(value)
    }

    /** Commits one final Three.js image for the current CodPlay frame. */
    private renderFrame(): void {
      if (this.renderer === undefined || this.scene === undefined || this.camera === null) return
      this.renderer.render(this.scene, this.camera)
    }
  }
}

/** Returns one positive integer dimension while keeping author data untouched. */
function resolvePositiveNumber(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return fallback
  return Math.max(1, Math.round(value))
}

/** Resolves a safe pixel ratio in browser and test environments. */
function resolvePixelRatio(value: number | undefined): number {
  if (value !== undefined && Number.isFinite(value) && value > 0) return value
  return typeof window === 'undefined' ? 1 : Math.max(1, window.devicePixelRatio || 1)
}

/** Updates an authored camera aspect ratio when the native camera supports it. */
function syncCameraAspect(camera: Camera, width: number, height: number): void {
  const candidate = camera as Camera & { aspect?: number; updateProjectionMatrix?: () => void }
  if (typeof candidate.aspect !== 'number') return
  candidate.aspect = width / Math.max(1, height)
  candidate.updateProjectionMatrix?.()
}
