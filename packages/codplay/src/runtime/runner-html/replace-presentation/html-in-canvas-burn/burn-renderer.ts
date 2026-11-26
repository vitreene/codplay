import { markHtmlTransientNode } from '../../transient-node'
import { getUntransformedBorderBoxSize } from '../dom'
import { getCanvasViewGeometry, getDrawableTextureMapping, getNativeMediaTextureMapping } from './texture-mapping'

export type BurnInitialMedia = Readonly<{
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  width: number
  height: number
  objectFit: string
}>

type HtmlInCanvasCanvas = HTMLCanvasElement & Readonly<{
  content: string
  requestPaint: () => void
  updateElementGeometry: (element: Element, options: { canvasTransform: DOMMatrix }) => void
  getElementImageDefaultSize: (element: Element) => Readonly<{ width: number; height: number }>
}>

type HtmlInCanvasWebGlContext = WebGL2RenderingContext & Readonly<{
  texElementSubImage2D: (
    target: GLenum,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    element: Element,
  ) => void
}>

type ReplaceTexture = Readonly<{
  handle: WebGLTexture
  width: number
  height: number
  mapping: ReturnType<typeof getNativeMediaTextureMapping>
}>

/** WebGL resources that paint two slotted DOM states with the H-i-C burn shader. */
export type HtmlInCanvasBurnRenderer = Readonly<{
  canvas: HTMLCanvasElement
  mount: (parent: ShadowRoot, outgoingSlot: string, initialMedia?: BurnInitialMedia) => void
  capture: () => HTMLCanvasElement | undefined
  onContextLost: (callback: () => void) => void
  sample: (progress: number) => void
  dispose: () => void
}>

const VERTEX_SHADER = `#version 300 es
in vec2 position;
in vec2 textureCoordinate;
out vec2 uv;

void main() {
  uv = textureCoordinate;
  gl_Position = vec4(position, 0.0, 1.0);
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 uv;
uniform sampler2D outgoingView;
uniform sampler2D incomingView;
uniform float progress;
uniform vec4 outgoingMapping;
uniform vec4 incomingMapping;
uniform vec4 viewMapping;
out vec4 color;

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 offset = fract(point);
  offset = offset * offset * (3.0 - 2.0 * offset);
  float lower = mix(hash(cell), hash(cell + vec2(1.0, 0.0)), offset.x);
  float upper = mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), offset.x);
  return mix(lower, upper, offset.y);
}

vec4 sampleView(sampler2D viewTexture, vec4 mapping, vec2 point) {
  vec2 coordinates = mapping.xy + point * mapping.zw;
  if (any(lessThan(coordinates, vec2(0.0))) || any(greaterThan(coordinates, vec2(1.0)))) {
    return vec4(0.0);
  }
  return texture(viewTexture, coordinates);
}

void main() {
  vec2 point = viewMapping.xy + uv * viewMapping.zw;
  if (any(lessThan(point, vec2(0.0))) || any(greaterThan(point, vec2(1.0)))) {
    color = vec4(0.0);
    return;
  }
  float threshold = 0.55 * length(vec2(point.x, 1.0 - point.y)) / sqrt(2.0)
    + 0.45 * noise(point * 6.0);
  float edge = progress * 1.3 - 0.14 - threshold;
  vec4 fromColor = sampleView(outgoingView, outgoingMapping, point);
  vec4 toColor = sampleView(incomingView, incomingMapping, point);
  if (edge > 0.0) {
    float hot = 1.0 - smoothstep(0.0, 0.05, edge);
    color = toColor + vec4(1.0, 0.45, 0.1, 0.0) * hot * 0.5 * toColor.a;
    return;
  }
  float charred = smoothstep(-0.09, -0.02, edge);
  float glow = smoothstep(-0.035, 0.0, edge);
  vec3 ember = mix(vec3(1.0, 0.25, 0.02), vec3(1.0, 0.85, 0.35), glow);
  color = vec4(fromColor.rgb * (1.0 - 0.9 * charred) + ember * glow * fromColor.a, fromColor.a);
}`

const VERTICES = new Float32Array([
  -1, -1, 0, 0,
  1, -1, 1, 0,
  -1, 1, 0, 1,
  -1, 1, 0, 1,
  1, -1, 1, 0,
  1, 1, 1, 1,
])

/** Prepares the H-i-C canvas and returns undefined before presentation if unsupported. */
export function createHtmlInCanvasBurnRenderer(): HtmlInCanvasBurnRenderer | undefined {
  if (typeof globalThis.WebGL2RenderingContext === 'undefined') return undefined

  const canvas = document.createElement('canvas') as HtmlInCanvasCanvas
  canvas.setAttribute('content', 'drawable')
  canvas.setAttribute('layoutsubtree', '')
  if (canvas.content !== 'drawable'
    || typeof canvas.requestPaint !== 'function'
    || typeof canvas.updateElementGeometry !== 'function'
    || typeof canvas.getElementImageDefaultSize !== 'function'
    || !('texElementSubImage2D' in WebGL2RenderingContext.prototype)) return undefined

  const rawContext = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    depth: false,
    stencil: false,
  })
  if (rawContext === null) return undefined
  const gl = rawContext as HtmlInCanvasWebGlContext
  const contextLoss = gl.getExtension('WEBGL_lose_context')
  const releaseContext = (): void => contextLoss?.loseContext()
  if (typeof gl.texElementSubImage2D !== 'function') {
    releaseContext()
    return undefined
  }

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  if (vertexShader === undefined) {
    releaseContext()
    return undefined
  }
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  if (fragmentShader === undefined) {
    gl.deleteShader(vertexShader)
    releaseContext()
    return undefined
  }

  const program = gl.createProgram()
  if (program === null) {
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    releaseContext()
    return undefined
  }
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.bindAttribLocation(program, 0, 'position')
  gl.bindAttribLocation(program, 1, 'textureCoordinate')
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    releaseContext()
    return undefined
  }

  const vertexBuffer = gl.createBuffer()
  const outgoingTexture = gl.createTexture()
  const incomingTexture = gl.createTexture()
  const progressLocation = gl.getUniformLocation(program, 'progress')
  const viewMappingLocation = gl.getUniformLocation(program, 'viewMapping')
  const outgoingMappingLocation = gl.getUniformLocation(program, 'outgoingMapping')
  const incomingMappingLocation = gl.getUniformLocation(program, 'incomingMapping')
  if (vertexBuffer === null || outgoingTexture === null || incomingTexture === null || progressLocation === null
    || outgoingMappingLocation === null || incomingMappingLocation === null || viewMappingLocation === null) {
    if (vertexBuffer !== null) gl.deleteBuffer(vertexBuffer)
    if (outgoingTexture !== null) gl.deleteTexture(outgoingTexture)
    if (incomingTexture !== null) gl.deleteTexture(incomingTexture)
    gl.deleteProgram(program)
    releaseContext()
    return undefined
  }

  const textures = [outgoingTexture, incomingTexture]
  for (const texture of textures) {
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, VERTICES, gl.STATIC_DRAW)
  gl.useProgram(program)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8)
  gl.uniform1i(gl.getUniformLocation(program, 'outgoingView'), 0)
  gl.uniform1i(gl.getUniformLocation(program, 'incomingView'), 1)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
  gl.clearColor(0, 0, 0, 0)

  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    display: 'block',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  })
  markHtmlTransientNode(canvas)

  let host: HTMLElement | undefined
  let viewWidth = 1
  let viewHeight = 1
  let viewGeometry = getCanvasViewGeometry({ left: 0, top: 0, width: 1, height: 1 }, 1, 1, 1)
  let progress = 0
  let outgoingElement: HTMLElement | undefined
  let incomingElement: HTMLElement | undefined
  let outgoingResource: ReplaceTexture | undefined
  let incomingResource: ReplaceTexture | undefined
  let initialFit: Pick<BurnInitialMedia, 'width' | 'height' | 'objectFit'> | undefined
  let disposed = false
  let contextLost: (() => void) | undefined

  /** Allocates or resizes one texture to the drawable snapshot's natural canvas size. */
  const upload = (element: HTMLElement, unit: number, current: ReplaceTexture | undefined): ReplaceTexture | undefined => {
    const size = canvas.getElementImageDefaultSize(element)
    const width = Math.max(1, Math.ceil(size.width))
    const height = Math.max(1, Math.ceil(size.height))
    const texture = textures[unit]
    if (texture === undefined) return undefined

    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    if (current === undefined || current.width !== width || current.height !== height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    }
    gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, element)
    return { handle: texture, width, height, mapping: getDrawableTextureMapping(size.width, size.height, width, height) }
  }

  /** Draws the latest replace progress when H-i-C reports a paint opportunity. */
  const onPaint = (): void => {
    if (disposed || outgoingElement === undefined || incomingElement === undefined) return
    outgoingResource = upload(outgoingElement, 0, outgoingResource)
    incomingResource = upload(incomingElement, 1, incomingResource)
    if (outgoingResource === undefined || incomingResource === undefined) return

    initialFit = undefined
    draw()
    for (const element of [outgoingElement, incomingElement]) {
      canvas.updateElementGeometry(element, { canvasTransform: new DOMMatrix().translate(-viewGeometry.left, -viewGeometry.top) })
    }
  }

  /** Sizes the canvas before the browser records its drawable DOM layers. */
  const resize = (): void => {
    if (host === undefined) return
    viewWidth = getUntransformedBorderBoxSize(host, 'width')
    viewHeight = getUntransformedBorderBoxSize(host, 'height')
    const rect = host.getBoundingClientRect()
    if (viewWidth <= 0 || viewHeight <= 0 || rect.width <= 0 || rect.height <= 0) return
    viewGeometry = getCanvasViewGeometry(rect, viewWidth, viewHeight, globalThis.devicePixelRatio || 1)
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
    if (initialFit !== undefined && outgoingResource !== undefined && incomingResource !== undefined) {
      const mapping = getNativeMediaTextureMapping(
        initialFit.width, initialFit.height,
        viewWidth, viewHeight,
        initialFit.objectFit,
      )
      outgoingResource = { ...outgoingResource, mapping }
      incomingResource = { ...incomingResource, mapping }
    }
  }

  /** Draws cached textures synchronously, including immediately before an interruption readback. */
  const draw = (): void => {
    if (disposed || gl.isContextLost() || outgoingResource === undefined || incomingResource === undefined) return

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, outgoingResource.handle)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, incomingResource.handle)
    gl.uniform1f(progressLocation, progress)
    gl.uniform4f(viewMappingLocation, ...viewGeometry.mapping)
    gl.uniform4f(outgoingMappingLocation, ...outgoingResource.mapping)
    gl.uniform4f(incomingMappingLocation, ...incomingResource.mapping)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  /** Reveals ordinary DOM when the graphics context becomes unavailable. */
  const onLost = (): void => contextLost?.()
  canvas.addEventListener('paint', onPaint)
  canvas.addEventListener('webglcontextlost', onLost)

  return {
    canvas,
    mount: (parent, outgoingSlot, initialMedia) => {
      host = parent.host as HTMLElement
      const layers = [outgoingSlot, ''].map((name) => {
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
      outgoingElement = layers[0]
      incomingElement = layers[1]
      parent.replaceChildren(canvas)
      resize()
      if (initialMedia !== undefined) {
        textures.forEach((texture, unit) => {
          gl.activeTexture(gl.TEXTURE0 + unit)
          gl.bindTexture(gl.TEXTURE_2D, texture)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, initialMedia.source)
        })
        const mapping = getNativeMediaTextureMapping(
          initialMedia.width, initialMedia.height,
          viewWidth, viewHeight,
          initialMedia.objectFit,
        )
        outgoingResource = { handle: outgoingTexture, width: initialMedia.width, height: initialMedia.height, mapping }
        incomingResource = { handle: incomingTexture, width: initialMedia.width, height: initialMedia.height, mapping }
        initialFit = { width: initialMedia.width, height: initialMedia.height, objectFit: initialMedia.objectFit }
        draw()
      }
      canvas.requestPaint()
    },
    onContextLost: (callback) => { contextLost = callback },
    capture: () => {
      if (disposed || gl.isContextLost() || outgoingResource === undefined || incomingResource === undefined) return undefined
      draw()
      const pixels = new Uint8Array(canvas.width * canvas.height * 4)
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      const frame = document.createElement('canvas')
      frame.width = canvas.width
      frame.height = canvas.height
      const context = frame.getContext('2d')
      if (context === null) return undefined
      const image = context.createImageData(frame.width, frame.height)
      const stride = frame.width * 4
      for (let row = 0; row < frame.height; row += 1) {
        image.data.set(pixels.subarray(row * stride, (row + 1) * stride), (frame.height - row - 1) * stride)
      }
      context.putImageData(image, 0, 0)
      frame.style.width = '100%'
      frame.style.height = '100%'
      return frame
    },
    sample: (nextProgress) => {
      if (disposed) return
      progress = nextProgress
      resize()
      canvas.requestPaint()
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      canvas.removeEventListener('paint', onPaint)
      canvas.removeEventListener('webglcontextlost', onLost)
      contextLost = undefined
      host = undefined
      outgoingElement = undefined
      incomingElement = undefined
      outgoingResource = undefined
      incomingResource = undefined
      initialFit = undefined
      canvas.replaceChildren()
      canvas.remove()
      gl.deleteTexture(outgoingTexture)
      gl.deleteTexture(incomingTexture)
      gl.deleteBuffer(vertexBuffer)
      gl.deleteProgram(program)
      releaseContext()
    },
  }
}

/** Compiles one shader and returns undefined when the current context rejects it. */
function createShader(
  gl: HtmlInCanvasWebGlContext,
  type: GLenum,
  source: string,
): WebGLShader | undefined {
  const shader = gl.createShader(type)
  if (shader === null) return undefined
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  gl.deleteShader(shader)
  return undefined
}
