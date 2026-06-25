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
import { BaseComponent } from 'codplay/runtime/components/lib/base-component'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from 'codplay/runtime/components/types'
import type { RenderTickInfo, RenderSeekInfo } from 'codplay/player/render-adapter-types'
import { createAvatarEngine, GazeService, getModelEntry } from '@codplay/avatar-engine'
import type { AvatarEngine } from '@codplay/avatar-engine'
import { buildActionHandlers, type ActionHandler } from './avatar3d-component.js'
import type { Avatar3DInitial } from './avatar3d-types.js'

const DEFAULT_SIZE = 600
const DEFAULT_FOV = 10
const DEFAULT_CAMERA_Y = 1.5
const DEFAULT_CAMERA_Z = 3

export class Avatar3DBaseComponent extends BaseComponent {
  private engine: AvatarEngine | null = null
  private gaze: GazeService | null = null
  private renderer: WebGLRenderer | null = null
  private threeScene: Scene | null = null
  private camera: PerspectiveCamera | null = null
  private actionHandlers: [string, ActionHandler][] = []
  private initStarted = false

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
    threeScene.add(modelScene)

    const leftEye = boneMap.get('LeftEye') ?? null
    const rightEye = boneMap.get('RightEye') ?? null
    const gaze = new GazeService(engine.morphEngine, leftEye, rightEye, camera)

    this.engine = engine
    this.gaze = gaze
    this.actionHandlers = buildActionHandlers(engine, gaze, initial.visemeWeight ?? 0.75)

    // Render one initial frame so the character has a pose (not blank/T-pose).
    // Gaze is enabled by default so it looks at the camera from the first frame.
    gaze.setEnabled(true)
    gaze.computeAndApply()
    this.render3D()
  }

  private render3D(): void {
    if (!this.renderer || !this.threeScene || !this.camera) return
    this.renderer.render(this.threeScene, this.camera)
  }

  /** Called by the hub via RenderAdapter.tick — see create-avatar3d-binding.ts. */
  _tick(info: RenderTickInfo): void {
    if (!this.engine || !this.gaze) return
    this.engine.animate(info.timelineDeltaMs)
    this.gaze.computeAndApply()
    this.render3D()
  }

  /** Called by the hub via RenderAdapter.prepareSeek, once before seek replay. */
  _prepareSeek(): void {
    this.engine?.prepareSeek()
  }

  /** Called by the hub via RenderAdapter.seek, once after seek replay. */
  _seek(info: RenderSeekInfo): void {
    if (!this.engine || !this.gaze) return
    this.engine.commitSeek(info.timelineMs)
    this.gaze.computeAndApply()
    this.render3D()
  }

  /** Called by the hub via RenderAdapter.stop. */
  _stop(): void {
    if (!this.engine || !this.gaze) return
    this.engine.prepareSeek()
    this.gaze.setEnabled(false)
    this.render3D()
  }

  update({ action, eventSeq }: RuntimeComponentUpdateInput): void {
    for (const [key, handler] of this.actionHandlers) {
      if (key in action) {
        handler(action, eventSeq)
        return
      }
    }
  }
}
