import { WEBGPU_BUFFER_USAGE, WEBGPU_SHADER_STAGE, WEBGPU_TEXTURE_USAGE } from '../../../config/webgpu'
import { markHtmlTransientNode } from '../../transient-node'
import { captureHtmlPose, createHtmlPoseCaptureContext } from '../../../motion/html-pose'
import {
  createHtmlInCanvasEffectModule,
  HTML_IN_CANVAS_EFFECT_DEFINITIONS,
  HTML_IN_CANVAS_UNIFORM_BYTES,
  type HtmlInCanvasEffectName,
} from './effects'
import { getCanvasViewGeometry, getDrawableTextureMap, getNativeMediaTextureMap } from './texture-mapping'
import { acquireHtmlInCanvasDevice, watchHtmlInCanvasDeviceLoss } from './webgpu-device'

type HtmlInCanvasCanvas = HTMLCanvasElement & Readonly<{
  requestPaint: () => void
  getElementImageDefaultSize: (element: Element) => Readonly<{ width: number; height: number }>
}>

/** Element-to-texture upload, under the names Chromium builds have used for it. */
type ElementImageQueue = GPUQueue & Readonly<{
  drawElementImageToTexture?: (source: { source: Element }, destination: { texture: GPUTexture }) => void
  copyElementImageToTexture?: (source: { source: Element }, destination: { destination: { texture: GPUTexture } }) => void
}>

type StateTexture = Readonly<{
  texture: GPUTexture
  width: number
  height: number
  /** View coordinates to texture coordinates: offset xy, scale zw. */
  map: readonly [number, number, number, number]
}>

/** Native outgoing frame drawn before the first HTML-in-Canvas paint, with its CSS framing. */
export type HtmlInCanvasInitialMedia = Readonly<{
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  width: number
  height: number
  objectFit: string
}>

/** What the renderer shows until its first frame: a native frame, or a covering DOM copy. */
type HtmlInCanvasMountOptions = Readonly<{
  initialMedia?: HtmlInCanvasInitialMedia
  /** Slot name of an extra outgoing copy shown above the canvas until the first DOM frame. */
  coverSlot?: string
}>

type GpuResources = Readonly<{
  device: GPUDevice
  context: GPUCanvasContext
  pipelines: readonly GPURenderPipeline[]
  bindGroupLayout: GPUBindGroupLayout
  uniformBuffer: GPUBuffer
  sampler: GPUSampler
}>

/** WebGPU resources that draw two slotted DOM states with one HTML-in-Canvas effect. */
type HtmlInCanvasRenderer = Readonly<{
  /** Mounts the states in `parent`; the outgoing state stays visible until the first frame. */
  mount: (parent: ShadowRoot, outgoingSlot: string, options?: HtmlInCanvasMountOptions) => void
  sample: (progress: number) => void
  /** Measures the host again after a layout change, then redraws at the current progress. */
  reflow: () => void
  /** Draws the current frame and copies it, for the next transition after an interruption. */
  capture: () => HTMLCanvasElement | undefined
  onFailure: (callback: (reason: string) => void) => void
  dispose: () => void
}>

/** Premultiplied "over" blending of every effect draw. */
const BLEND_OVER: GPUBlendState = {
  color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
}

/**
 * Checks the HTML-in-Canvas and WebGPU primitives synchronously and returns
 * undefined when one is missing, so the session selects its fallback before
 * any presentation. The GPU device itself is requested on mount, for this
 * transition only.
 */
export function createHtmlInCanvasRenderer(effectName: HtmlInCanvasEffectName): HtmlInCanvasRenderer | undefined {
  const gpu = globalThis.navigator?.gpu
  if (gpu === undefined || typeof GPUQueue === 'undefined') return undefined
  const queuePrototype = GPUQueue.prototype as ElementImageQueue
  if (typeof queuePrototype.drawElementImageToTexture !== 'function'
    && typeof queuePrototype.copyElementImageToTexture !== 'function') return undefined

  const canvas = document.createElement('canvas') as HtmlInCanvasCanvas
  canvas.setAttribute('content', 'drawable')
  canvas.setAttribute('layoutsubtree', '')
  if (typeof canvas.requestPaint !== 'function' || typeof canvas.getElementImageDefaultSize !== 'function') return undefined

  const effect = HTML_IN_CANVAS_EFFECT_DEFINITIONS[effectName]
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    position: 'absolute', left: '0', top: '0', display: 'block',
    width: '100%', height: '100%', pointerEvents: 'none',
  })
  markHtmlTransientNode(canvas)

  let parent: ShadowRoot | undefined
  let host: HTMLElement | undefined
  let resources: GpuResources | undefined
  let outgoingElement: HTMLElement | undefined
  let incomingElement: HTMLElement | undefined
  let outgoingTexture: StateTexture | undefined
  let incomingTexture: StateTexture | undefined
  let bindGroup: GPUBindGroup | undefined
  let viewWidth = 1
  let viewHeight = 1
  let viewGeometry = getCanvasViewGeometry({ left: 0, top: 0, width: 1, height: 1 }, 1, 1, 1)
  let progress = 0
  let initialMedia: HtmlInCanvasInitialMedia | undefined
  let cover: HTMLElement | undefined
  let primed = false
  let disposed = false
  let failure: ((reason: string) => void) | undefined
  let releaseLossWatch: (() => void) | undefined
  const uniforms = new Float32Array(HTML_IN_CANVAS_UNIFORM_BYTES / 4)

  /** Reports one GPU failure once; the session then reveals ordinary DOM. */
  const fail = (reason: string): void => {
    if (!disposed) failure?.(reason)
  }

  /** Uses the shared device and builds every pipeline of the effect for this transition. */
  const initialize = async (): Promise<void> => {
    const device = await acquireHtmlInCanvasDevice(gpu)
    if (disposed) return
    if (device === undefined) {
      fail('no WebGPU device')
      return
    }
    releaseLossWatch = watchHtmlInCanvasDeviceLoss(fail)
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null
    if (context === null) {
      fail('no WebGPU canvas context')
      return
    }
    const format = gpu.getPreferredCanvasFormat()
    context.configure({ device, format, alphaMode: 'premultiplied' })
    device.pushErrorScope('validation')
    const module = device.createShaderModule({ code: createHtmlInCanvasEffectModule(effect) })
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: WEBGPU_SHADER_STAGE.vertex | WEBGPU_SHADER_STAGE.fragment, buffer: { type: 'uniform' } },
        { binding: 1, visibility: WEBGPU_SHADER_STAGE.fragment, sampler: { type: 'filtering' } },
        { binding: 2, visibility: WEBGPU_SHADER_STAGE.fragment, texture: { sampleType: 'float' } },
        { binding: 3, visibility: WEBGPU_SHADER_STAGE.fragment, texture: { sampleType: 'float' } },
      ],
    })
    const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] })
    const pipelines = effect.draws.map((draw) => device.createRenderPipeline({
      layout,
      vertex: { module, entryPoint: draw.vertex },
      fragment: { module, entryPoint: draw.fragment, targets: [{ format, blend: BLEND_OVER }] },
      primitive: { topology: 'triangle-list' },
    }))
    const error = await device.popErrorScope()
    if (disposed) {
      context.unconfigure()
      return
    }
    if (error !== null) {
      context.unconfigure()
      fail(`HTML-in-Canvas ${effectName} shader: ${error.message}`)
      return
    }
    resources = {
      device,
      context,
      pipelines,
      bindGroupLayout,
      uniformBuffer: device.createBuffer({
        size: HTML_IN_CANVAS_UNIFORM_BYTES,
        usage: WEBGPU_BUFFER_USAGE.uniform | WEBGPU_BUFFER_USAGE.copyDestination,
      }),
      sampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }),
    }
    // The canvas replaces the visible outgoing state only now. A native
    // outgoing frame is drawn at once; a DOM copy covers the canvas until the
    // first paint uploads both states. No empty frame is shown in between.
    if (initialMedia !== undefined) prime(initialMedia)
    parent?.replaceChildren(canvas, ...(cover === undefined ? [] : [cover]))
    resize()
    if (primed) draw()
    canvas.requestPaint()
  }

  /** Copies the native outgoing frame into both state textures, framed like its CSS. */
  const prime = (media: HtmlInCanvasInitialMedia): void => {
    if (resources === undefined) return
    const { device } = resources
    const [outgoing, incoming] = [0, 1].map(() => {
      const texture = device.createTexture({
        size: [media.width, media.height],
        format: 'rgba8unorm',
        usage: WEBGPU_TEXTURE_USAGE.copyDestination | WEBGPU_TEXTURE_USAGE.renderAttachment | WEBGPU_TEXTURE_USAGE.textureBinding,
      })
      device.queue.copyExternalImageToTexture(
        { source: media.source },
        { texture, premultipliedAlpha: true },
        [media.width, media.height],
      )
      return { texture, width: media.width, height: media.height, map: [0, 0, 1, 1] as const }
    })
    outgoingTexture = outgoing
    incomingTexture = incoming
    bindGroup = undefined
    primed = true
  }

  /** Uploads one drawable state into its texture, resized to its element image. */
  const upload = (element: HTMLElement, current: StateTexture | undefined): StateTexture | undefined => {
    if (resources === undefined) return undefined
    const size = canvas.getElementImageDefaultSize(element)
    const width = Math.max(1, Math.ceil(size.width))
    const height = Math.max(1, Math.ceil(size.height))
    // A primed texture holds a native frame: the first DOM upload always replaces it.
    const state = !primed && current !== undefined && current.width === width && current.height === height
      ? current
      : {
          texture: resources.device.createTexture({
            size: [width, height],
            format: 'rgba8unorm',
            usage: WEBGPU_TEXTURE_USAGE.copyDestination | WEBGPU_TEXTURE_USAGE.renderAttachment | WEBGPU_TEXTURE_USAGE.textureBinding,
          }),
          width,
          height,
          map: getDrawableTextureMap(size.width, size.height, width, height),
        }
    if (state !== current) {
      current?.texture.destroy()
      bindGroup = undefined
    }
    const queue = resources.device.queue as ElementImageQueue
    if (queue.drawElementImageToTexture !== undefined) {
      queue.drawElementImageToTexture({ source: element }, { texture: state.texture })
    } else {
      queue.copyElementImageToTexture?.({ source: element }, { destination: { texture: state.texture } })
    }
    return state
  }

  /** Draws the cached state textures synchronously at the current progress. */
  const draw = (): void => {
    if (disposed || resources === undefined || outgoingTexture === undefined || incomingTexture === undefined) return
    const { device, context, pipelines, bindGroupLayout, uniformBuffer, sampler } = resources
    bindGroup ??= device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: outgoingTexture.texture.createView() },
        { binding: 3, resource: incomingTexture.texture.createView() },
      ],
    })
    uniforms.set([progress, viewWidth / viewHeight, 0, 0])
    uniforms.set(viewGeometry.mapping, 4)
    uniforms.set(outgoingTexture.map, 8)
    uniforms.set(incomingTexture.map, 12)
    device.queue.writeBuffer(uniformBuffer, 0, uniforms)

    const encoder = device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    })
    pass.setBindGroup(0, bindGroup)
    effect.draws.forEach((call, index) => {
      const pipeline = pipelines[index]
      if (pipeline === undefined) return
      pass.setPipeline(pipeline)
      pass.draw(call.vertexCount)
    })
    pass.end()
    device.queue.submit([encoder.finish()])
  }

  /**
   * Uploads only the states the browser repainted, then draws. A static state,
   * such as the outgoing copy of a slot, is uploaded once.
   */
  const onPaint = (event: Event): void => {
    if (disposed || resources === undefined || outgoingElement === undefined || incomingElement === undefined) return
    const changed = (event as Event & { changedElements?: readonly Element[] }).changedElements
    const needsUpload = (element: HTMLElement, state: StateTexture | undefined): boolean => (
      state === undefined || primed || changed === undefined || changed.includes(element)
    )
    try {
      if (needsUpload(outgoingElement, outgoingTexture)) outgoingTexture = upload(outgoingElement, outgoingTexture)
      if (needsUpload(incomingElement, incomingTexture)) incomingTexture = upload(incomingElement, incomingTexture)
    } catch {
      // A state without a paint record yet is uploaded on the next paint.
      canvas.requestPaint()
      return
    }
    primed = false
    draw()
    // The DOM states are on the canvas: the covering copy is no longer needed.
    cover?.remove()
    cover = undefined
  }

  /**
   * Sizes the canvas support and the drawable states to the host's view. The
   * view is measured by affine composition of layout offsets, computed styles
   * and parent matrices, never by a DOM rectangle, which ignores a transformed
   * parent. It is measured on mount and on reflow only, not on every frame.
   */
  const resize = (): void => {
    if (host === undefined) return
    const pose = captureHtmlPose(host, createHtmlPoseCaptureContext())
    viewWidth = pose.localWidth
    viewHeight = pose.localHeight
    if (viewWidth <= 0 || viewHeight <= 0 || pose.rect.width <= 0 || pose.rect.height <= 0) return
    viewGeometry = getCanvasViewGeometry(pose.rect, viewWidth, viewHeight, globalThis.devicePixelRatio || 1)
    Object.assign(canvas.style, {
      left: `${viewGeometry.left}px`, top: `${viewGeometry.top}px`,
      width: `${viewGeometry.cssWidth}px`, height: `${viewGeometry.cssHeight}px`,
    })
    for (const element of [outgoingElement, incomingElement]) {
      if (element === undefined) continue
      Object.assign(element.style, {
        left: `${-viewGeometry.left}px`, top: `${-viewGeometry.top}px`,
        width: `${viewWidth}px`, height: `${viewHeight}px`,
      })
    }
    if (canvas.width !== viewGeometry.width) canvas.width = viewGeometry.width
    if (canvas.height !== viewGeometry.height) canvas.height = viewGeometry.height
    if (primed && initialMedia !== undefined && outgoingTexture !== undefined && incomingTexture !== undefined) {
      const map = getNativeMediaTextureMap(
        initialMedia.width, initialMedia.height, viewWidth, viewHeight, initialMedia.objectFit,
      )
      outgoingTexture = { ...outgoingTexture, map }
      incomingTexture = { ...incomingTexture, map }
    }
  }

  canvas.addEventListener('paint', onPaint)

  return {
    mount: (shadow, outgoingSlot, options = {}) => {
      parent = shadow
      host = shadow.host as HTMLElement
      initialMedia = options.initialMedia
      const [outgoing, incoming] = [outgoingSlot, ''].map((name) => {
        const wrapper = document.createElement('div')
        wrapper.setAttribute('drawable', '')
        Object.assign(wrapper.style, {
          position: 'absolute', inset: '0', width: '100%', height: '100%', overflow: 'hidden',
        })
        const slot = document.createElement('slot')
        slot.name = name
        wrapper.append(slot)
        canvas.append(wrapper)
        return wrapper
      })
      outgoingElement = outgoing
      incomingElement = incoming
      // Until the GPU is ready, only the outgoing state is displayed: its
      // covering copy when there is one, else the outgoing state itself.
      const visibleOutgoing = document.createElement('slot')
      visibleOutgoing.name = options.coverSlot ?? outgoingSlot
      if (options.coverSlot !== undefined) {
        cover = document.createElement('div')
        Object.assign(cover.style, { position: 'absolute', inset: '0', pointerEvents: 'none' })
        const coverSlot = document.createElement('slot')
        coverSlot.name = options.coverSlot
        cover.append(coverSlot)
      }
      const pendingIncoming = document.createElement('div')
      pendingIncoming.style.display = 'none'
      pendingIncoming.append(document.createElement('slot'))
      shadow.replaceChildren(visibleOutgoing, pendingIncoming)
      void initialize().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)))
    },
    sample: (nextProgress) => {
      if (disposed) return
      progress = nextProgress
      if (resources === undefined) return
      canvas.requestPaint()
    },
    reflow: () => {
      if (disposed || resources === undefined) return
      resize()
      canvas.requestPaint()
    },
    capture: () => {
      if (disposed || resources === undefined || outgoingTexture === undefined || incomingTexture === undefined) return undefined
      draw()
      const frame = document.createElement('canvas')
      frame.width = canvas.width
      frame.height = canvas.height
      const context = frame.getContext('2d')
      if (context === null) return undefined
      // The WebGPU drawing buffer is still the frame just submitted in this task.
      context.drawImage(canvas, 0, 0)
      frame.style.width = '100%'
      frame.style.height = '100%'
      return frame
    },
    onFailure: (callback) => { failure = callback },
    dispose: () => {
      if (disposed) return
      disposed = true
      canvas.removeEventListener('paint', onPaint)
      failure = undefined
      outgoingTexture?.texture.destroy()
      incomingTexture?.texture.destroy()
      cover?.remove()
      cover = undefined
      initialMedia = undefined
      outgoingTexture = undefined
      incomingTexture = undefined
      bindGroup = undefined
      canvas.replaceChildren()
      canvas.remove()
      // The shared device stays alive for the next transition.
      releaseLossWatch?.()
      releaseLossWatch = undefined
      resources?.uniformBuffer.destroy()
      resources?.context.unconfigure()
      resources = undefined
      parent = undefined
      host = undefined
      outgoingElement = undefined
      incomingElement = undefined
    },
  }
}
