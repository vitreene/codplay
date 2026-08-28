/**
 * Avatar3DBaseComponent — autonomous avatar3d RuntimeComponent.
 *
 * Owns its own canvas/WebGLRenderer/Scene/PerspectiveCamera, built in init()
 * from declarative perso.initial (Avatar3DInitial) — no shared 3D viewport
 * with other personas (see docs/formalisation/2026-06-23-avatar3d-component-
 * integration-plan.md §7). Mirrors RiveBaseComponent's split: render() builds
 * the DOM node, init() does the heavy one-time setup reading from a preload
 * cache, _tick/_prepareSeek/_seek/_stop are called by the hub's renderAdapter
 * (see create-avatar3d-binding.ts).
 */
import {
  AmbientLight,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  SRGBColorSpace,
  ACESFilmicToneMapping,
} from 'three'
import { BaseComponent } from 'codplay-v1/runtime/components/lib/base-component'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from 'codplay-v1/runtime/components/types'
import type { RenderTickInfo, RenderSeekInfo } from 'codplay-v1/player/render-adapter-types'
import { createAvatarEngine, GazeService, getModelEntry } from '@codplay/avatar-engine'
import type { AvatarEngine } from '@codplay/avatar-engine'
import { buildActionHandlers, type ActionHandler } from './avatar3d-component.js'
import type { Avatar3DInitial } from './avatar3d-types.js'
import { Avatar3DSemanticRuntime } from './semantic-runtime/avatar3d-semantic-runtime.js'

const DEFAULT_SIZE = 600
const DEFAULT_FOV = 10
const DEFAULT_CAMERA_Y = 1.5
const DEFAULT_CAMERA_Z = 3

type AvatarCameraPose = {
  fov: number
  position: { x: number; y: number; z: number }
  lookAt: { x: number; y: number; z: number }
}

type AvatarCameraTransition = {
  from: AvatarCameraPose
  to: AvatarCameraPose
  startMs: number
  endMs: number
} | null

/** Smoothstep interpolation for authored camera event transitions. */
function easeCameraProgress(progress: number): number {
  const t = Math.max(0, Math.min(1, progress))
  return t * t * (3 - 2 * t)
}

/** Interpolates one camera pose. */
function interpolateCameraPose(from: AvatarCameraPose, to: AvatarCameraPose, alpha: number): AvatarCameraPose {
  return {
    fov: from.fov + (to.fov - from.fov) * alpha,
    position: {
      x: from.position.x + (to.position.x - from.position.x) * alpha,
      y: from.position.y + (to.position.y - from.position.y) * alpha,
      z: from.position.z + (to.position.z - from.position.z) * alpha,
    },
    lookAt: {
      x: from.lookAt.x + (to.lookAt.x - from.lookAt.x) * alpha,
      y: from.lookAt.y + (to.lookAt.y - from.lookAt.y) * alpha,
      z: from.lookAt.z + (to.lookAt.z - from.lookAt.z) * alpha,
    },
  }
}

export class Avatar3DBaseComponent extends BaseComponent {
  private engine: AvatarEngine | null = null
  private gaze: GazeService | null = null
  private renderer: WebGLRenderer | null = null
  private threeScene: Scene | null = null
  private camera: PerspectiveCamera | null = null
  private actionHandlers: [string, ActionHandler][] = []
  private semanticRuntime: Avatar3DSemanticRuntime | null = null
  private pendingUpdates: RuntimeComponentUpdateInput[] = []
  private visemeWeight = 1
  private initStarted = false
  private initialCameraPose: AvatarCameraPose | null = null
  private currentCameraPose: AvatarCameraPose | null = null
  private cameraTransition: AvatarCameraTransition = null

  render(): ComponentRenderResult {
    // The orchestrator re-renders an already-mounted component on every
    // "refresh" (seek, rewind — see init()'s comment). buildNode() always
    // calls resetComponentRoot(), which removes every DOM attribute from a
    // reused node — including the canvas's width/height (they are reflected
    // IDL attributes, not just JS properties: setting canvas.width also sets
    // attribute "width"). On a live WebGL canvas this corrupts the drawing
    // buffer the existing WebGLRenderer is still rendering into. The previous
    // (pre-migration) implementation never hit this because its render()
    // returned a closure-captured canvas without ever going through
    // buildNode(). Returning this.node directly on refresh reproduces that
    // same immunity — no attribute reset, no WebGL surface disruption.
    if (this.node !== null) return this.node as ComponentRenderResult

    const initial = this.perso.initial as Avatar3DInitial
    const canvas = this.buildNode('canvas') as HTMLCanvasElement
    canvas.width = initial.width ?? DEFAULT_SIZE
    canvas.height = initial.height ?? DEFAULT_SIZE
    canvas.style.cssText = 'width:100%;height:100%;display:block;'
    return canvas
  }

  init(): void {
    // The orchestrator calls _init() again on every "refresh" of an already-
    // mounted component (e.g. rewind, story remount) — see
    // runtime-component-orchestrator.ts's refreshLoadedRuntimeComponent /
    // tryInitComponent. Unlike a DOM-only component, this one owns a WebGL
    // context: building a second WebGLRenderer on the same canvas silently
    // corrupts rendering instead of throwing. The one-time setup below must
    // run exactly once per component instance. initStarted (not this.renderer)
    // is the guard because the model parse is async — the renderer is set
    // synchronously below, but a refresh could re-enter before then.
    if (this.initStarted) return
    this.initStarted = true

    const initial = this.perso.initial as Avatar3DInitial
    this.visemeWeight = initial.visemeWeight ?? 1
    const entry = getModelEntry(initial.src)
    if (!entry || entry.status !== 'ready' || !entry.buffer) {
      throw new Error(`[avatar3d] resource not ready: ${initial.src} — ensure preload ran before player.init()`)
    }

    const canvas = this.node as HTMLCanvasElement
    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.setPixelRatio(globalThis.devicePixelRatio)
    renderer.setSize(canvas.width, canvas.height, false)

    const threeScene = new Scene()
    threeScene.add(new AmbientLight(0xffffff, 0.9))
    const dirLight = new DirectionalLight(0xffffff, 1.5)
    dirLight.position.set(0, 1, 2)
    threeScene.add(dirLight)

    const camPos = initial.camera?.position ?? {}
    const camY = camPos.y ?? DEFAULT_CAMERA_Y
    const camera = new PerspectiveCamera(initial.camera?.fov ?? DEFAULT_FOV, canvas.width / canvas.height, 0.1, 2000)
    camera.position.set(camPos.x ?? 0, camY, camPos.z ?? DEFAULT_CAMERA_Z)
    const lookAt = initial.camera?.lookAt ?? {}
    camera.lookAt(lookAt.x ?? 0, lookAt.y ?? camY, lookAt.z ?? 0)
    this.initialCameraPose = {
      fov: camera.fov,
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      lookAt: { x: lookAt.x ?? 0, y: lookAt.y ?? camY, z: lookAt.z ?? 0 },
    }
    this.currentCameraPose = this.initialCameraPose

    this.renderer = renderer
    this.threeScene = threeScene
    this.camera = camera

    // The model parse is async (GLTFLoader.parse re-parses the preloaded bytes
    // into a fresh, single-skeleton scene). Until it resolves, _tick/_seek
    // no-op (they guard on this.engine). Renderer/scene/camera are already set
    // above so the canvas is live from the first frame.
    void this.loadModelAsync(entry.buffer, initial, threeScene, camera)
  }

  private async loadModelAsync(
    buffer: ArrayBuffer,
    initial: Avatar3DInitial,
    threeScene: Scene,
    camera: PerspectiveCamera,
  ): Promise<void> {
    const engine = createAvatarEngine({ mood: initial.mood })
    const { scene: modelScene, boneMap } = await engine.loadModel(buffer, {
      morphPrefix: initial.morphPrefix,
      retarget: initial.retarget,
    })
    modelScene.rotation.y = initial.modelRotationY ?? 0
    modelScene.updateMatrixWorld(true)
    threeScene.add(modelScene)

    const leftEye = boneMap.get('LeftEye') ?? null
    const rightEye = boneMap.get('RightEye') ?? null
    const head = boneMap.get('Head') ?? null
    const necks = ['Neck', 'Neck1', 'Neck2']
      .map((name) => boneMap.get(name) ?? null)
      .filter((bone): bone is NonNullable<typeof bone> => bone !== null)
    const gaze = new GazeService(engine.morphEngine, leftEye, rightEye, head, camera, necks)

    this.engine = engine
    this.gaze = gaze
    this.actionHandlers = buildActionHandlers(engine, gaze, this.visemeWeight)
    this.semanticRuntime = new Avatar3DSemanticRuntime({
      engine,
      gaze,
      initialMood: initial.mood,
      localMotions: initial.motions,
      visemeWeight: this.visemeWeight,
      report: (code, message, details) => this.report(code, message, details),
    })
    this.flushPendingUpdates()

    // Render one initial frame so the character has a pose (not blank/T-pose).
    // Gaze is enabled by default so it looks at the camera from the first frame.
    gaze.setEnabled(true)
    this.semanticRuntime.evaluate(this.createElementOptions?.getCurrentTimelineMs?.() ?? 0, 'play')
    gaze.computeAndApply()
    this.render3D()
  }

  /** Replays updates received while the GLB was still loading. */
  private flushPendingUpdates(): void {
    const updates = this.pendingUpdates
    this.pendingUpdates = []
    for (const update of updates) {
      this.applyUpdate(update)
    }
  }

  private render3D(): void {
    if (!this.renderer || !this.threeScene || !this.camera) return
    this.renderer.render(this.threeScene, this.camera)
  }

  /** Applies one camera pose to the Three.js camera. */
  private applyCameraPose(pose: AvatarCameraPose): void {
    if (!this.camera) return
    this.camera.fov = pose.fov
    this.camera.position.set(pose.position.x, pose.position.y, pose.position.z)
    this.camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z)
    this.camera.updateProjectionMatrix()
    this.currentCameraPose = pose
  }

  /** Evaluates active camera transition at a timeline position. */
  private evaluateCamera(timelineMs: number): void {
    const transition = this.cameraTransition
    if (!transition) return
    if (timelineMs >= transition.endMs) {
      this.applyCameraPose(transition.to)
      this.cameraTransition = null
      return
    }
    if (timelineMs <= transition.startMs) {
      this.applyCameraPose(transition.from)
      return
    }
    const progress = (timelineMs - transition.startMs) / (transition.endMs - transition.startMs)
    this.applyCameraPose(interpolateCameraPose(transition.from, transition.to, easeCameraProgress(progress)))
  }

  /** Handles authored camera events. */
  private handleCameraUpdate(input: RuntimeComponentUpdateInput): boolean {
    const cameraAction = input.action['camera']
    if (cameraAction === undefined || !this.camera || !this.currentCameraPose || !this.initialCameraPose) return false

    const payload = cameraAction === null ? null : cameraAction as {
      fov?: unknown
      position?: { x?: unknown; y?: unknown; z?: unknown }
      lookAt?: { x?: unknown; y?: unknown; z?: unknown }
      durationMs?: unknown
      endMs?: unknown
    }
    const base = payload === null ? this.initialCameraPose : this.currentCameraPose
    const target = payload === null ? this.initialCameraPose : {
      fov: typeof payload.fov === 'number' && Number.isFinite(payload.fov) ? payload.fov : base.fov,
      position: {
        x: typeof payload.position?.x === 'number' && Number.isFinite(payload.position.x) ? payload.position.x : base.position.x,
        y: typeof payload.position?.y === 'number' && Number.isFinite(payload.position.y) ? payload.position.y : base.position.y,
        z: typeof payload.position?.z === 'number' && Number.isFinite(payload.position.z) ? payload.position.z : base.position.z,
      },
      lookAt: {
        x: typeof payload.lookAt?.x === 'number' && Number.isFinite(payload.lookAt.x) ? payload.lookAt.x : base.lookAt.x,
        y: typeof payload.lookAt?.y === 'number' && Number.isFinite(payload.lookAt.y) ? payload.lookAt.y : base.lookAt.y,
        z: typeof payload.lookAt?.z === 'number' && Number.isFinite(payload.lookAt.z) ? payload.lookAt.z : base.lookAt.z,
      },
    }
    const endMs = payload === null ? input.eventMs : typeof payload.endMs === 'number' && Number.isFinite(payload.endMs) ? payload.endMs
      : typeof payload.durationMs === 'number' && Number.isFinite(payload.durationMs) ? input.eventMs + payload.durationMs
      : input.eventMs
    if (endMs <= input.eventMs) {
      this.cameraTransition = null
      this.applyCameraPose(target)
      return true
    }
    this.cameraTransition = { from: this.currentCameraPose, to: target, startMs: input.eventMs, endMs }
    this.evaluateCamera(input.eventMs)
    return true
  }

  /** Called by the hub via RenderAdapter.tick — see create-avatar3d-binding.ts. */
  _tick(info: RenderTickInfo): void {
    if (!this.engine || !this.gaze) return
    this.engine.animate(info.timelineDeltaMs)
    this.evaluateCamera(info.timelineMs)
    this.semanticRuntime?.evaluate(info.timelineMs, 'play')
    this.gaze.computeAndApply()
    this.render3D()
  }

  /** Called by the hub via RenderAdapter.prepareSeek, once before seek replay. */
  _prepareSeek(): void {
    if (this.initialCameraPose) this.applyCameraPose(this.initialCameraPose)
    this.cameraTransition = null
    this.semanticRuntime?.prepareSeek()
    this.engine?.prepareSeek()
  }

  /** Called by the hub via RenderAdapter.seek, once after seek replay. */
  _seek(info: RenderSeekInfo): void {
    if (!this.engine || !this.gaze) return
    this.engine.commitSeek(info.timelineMs)
    this.evaluateCamera(info.timelineMs)
    this.semanticRuntime?.evaluate(info.timelineMs, 'seek')
    this.gaze.computeAndApply()
    this.render3D()
  }

  /** Called by the hub via RenderAdapter.stop. */
  _stop(): void {
    if (!this.engine || !this.gaze) return
    this.semanticRuntime?.stop()
    this.engine.prepareSeek()
    this.gaze.setEnabled(false)
    if (this.initialCameraPose) this.applyCameraPose(this.initialCameraPose)
    this.cameraTransition = null
    this.render3D()
  }

  update(input: RuntimeComponentUpdateInput): void {
    if (!this.semanticRuntime || this.actionHandlers.length === 0) {
      this.pendingUpdates.push(input)
      return
    }

    this.applyUpdate(input)
  }

  /** Applies one update once semantic runtime and legacy handlers are ready. */
  private applyUpdate(input: RuntimeComponentUpdateInput): void {
    const { action, eventSeq } = input
    if (this.handleCameraUpdate(input)) return
    if (this.semanticRuntime?.handleUpdate(input)) return

    for (const [key, handler] of this.actionHandlers) {
      if (key in action) {
        handler(action, eventSeq)
        return
      }
    }
  }
}
