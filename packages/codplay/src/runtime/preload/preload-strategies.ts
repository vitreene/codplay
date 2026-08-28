import type { RuntimePreloadResourceMetadata } from './preload-types'

/** Resolves one portable AbortError in browser and non-browser test hosts. */
function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') return new DOMException('Aborted', 'AbortError')
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}

/** Rejects when a resource strategy exceeds its configured time budget. */
export function withRuntimePreloadTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Preload timeout after ${timeoutMs}ms`)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** Loads one image into the browser cache. */
export function loadRuntimeImage(url: string, signal: AbortSignal): Promise<RuntimePreloadResourceMetadata> {
  return new Promise<RuntimePreloadResourceMetadata>((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError())
      return
    }
    if (typeof globalThis.Image === 'undefined') {
      reject(new Error('Image preload requires a browser Image implementation.'))
      return
    }
    const image = new globalThis.Image()
    const cleanup = (): void => signal.removeEventListener('abort', onAbort)
    const onAbort = (): void => {
      cleanup()
      reject(createAbortError())
    }
    signal.addEventListener('abort', onAbort, { once: true })
    image.onload = (): void => {
      cleanup()
      resolve({ type: 'image' })
    }
    image.onerror = (): void => {
      cleanup()
      reject(new Error(`Failed to load image: ${url}`))
    }
    image.src = url
  })
}

/** Loads one audio resource until the browser reports it can play through. */
export function loadRuntimeAudio(url: string, signal: AbortSignal): Promise<RuntimePreloadResourceMetadata> {
  return new Promise<RuntimePreloadResourceMetadata>((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError())
      return
    }
    if (typeof globalThis.Audio === 'undefined') {
      reject(new Error('Audio preload requires a browser Audio implementation.'))
      return
    }
    const audio = new globalThis.Audio()
    audio.preload = 'auto'
    const cleanup = (): void => {
      audio.removeEventListener('canplaythrough', onReady)
      audio.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
    }
    const onReady = (): void => {
      cleanup()
      const durationMs = Number.isFinite(audio.duration) ? Math.max(0, audio.duration * 1000) : undefined
      resolve({ type: 'audio', ...(durationMs === undefined ? {} : { durationMs }) })
    }
    const onError = (): void => {
      cleanup()
      reject(new Error(`Failed to load audio: ${url}`))
    }
    const onAbort = (): void => {
      cleanup()
      audio.src = ''
      reject(createAbortError())
    }
    audio.addEventListener('canplaythrough', onReady)
    audio.addEventListener('error', onError)
    signal.addEventListener('abort', onAbort, { once: true })
    audio.src = url
    audio.load()
  })
}

/** Loads one video resource through a temporary, non-visible media node. */
export function loadRuntimeVideo(url: string, signal: AbortSignal): Promise<RuntimePreloadResourceMetadata> {
  return new Promise<RuntimePreloadResourceMetadata>((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError())
      return
    }
    if (typeof globalThis.document === 'undefined') {
      reject(new Error('Video preload requires a browser document.'))
      return
    }
    const video = globalThis.document.createElement('video')
    video.preload = 'auto'
    video.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none'
    const parent = globalThis.document.body ?? globalThis.document.documentElement
    if (parent === null) {
      reject(new Error('Video preload requires a document mount point.'))
      return
    }
    parent.appendChild(video)
    const cleanup = (): void => {
      video.removeEventListener('canplaythrough', onReady)
      video.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
      video.remove()
    }
    const onReady = (): void => {
      cleanup()
      const durationMs = Number.isFinite(video.duration) ? Math.max(0, video.duration * 1000) : undefined
      resolve({ type: 'video', ...(durationMs === undefined ? {} : { durationMs }) })
    }
    const onError = (): void => {
      cleanup()
      reject(new Error(`Failed to load video: ${url}`))
    }
    const onAbort = (): void => {
      cleanup()
      reject(createAbortError())
    }
    video.addEventListener('canplaythrough', onReady)
    video.addEventListener('error', onError)
    signal.addEventListener('abort', onAbort, { once: true })
    video.src = url
    video.load()
  })
}

/** Loads one font through the browser FontFace API. */
export function loadRuntimeFont(url: string, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(createAbortError())
  if (typeof globalThis.FontFace === 'undefined' || typeof globalThis.document === 'undefined' || globalThis.document.fonts === undefined) {
    return Promise.reject(new Error('Font preload requires the browser FontFace API.'))
  }
  const family = url.split('/').pop()?.split('.')[0] ?? 'codplay-preloaded-font'
  const face = new globalThis.FontFace(family, `url(${url})`)
  globalThis.document.fonts.add(face)
  return face.load().then(() => undefined)
}

const SCOPE_ATTRIBUTE = 'data-codplay-scope'
let scopeCounter = 0

/** Resolves or creates the stable scope marker on an existing mount element. */
function resolveScopeSelector(container: Element): string {
  const existing = container.getAttribute(SCOPE_ATTRIBUTE)
  if (existing !== null && existing.length > 0) return `[${SCOPE_ATTRIBUTE}="${existing}"]`
  scopeCounter += 1
  const id = `cp-scope-${scopeCounter}`
  container.setAttribute(SCOPE_ATTRIBUTE, id)
  return `[${SCOPE_ATTRIBUTE}="${id}"]`
}

/** Loads CSS with a container scope, or as a normal stylesheet without a container. */
export function loadRuntimeCss(url: string, signal: AbortSignal, container?: Element | null): Promise<void> {
  if (container !== undefined && container !== null) return loadScopedCss(url, signal, container)
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError())
      return
    }
    if (typeof globalThis.document === 'undefined') {
      reject(new Error('CSS preload requires a browser document.'))
      return
    }
    const link = globalThis.document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    const cleanup = (): void => signal.removeEventListener('abort', onAbort)
    const onAbort = (): void => {
      cleanup()
      link.remove()
      reject(createAbortError())
    }
    signal.addEventListener('abort', onAbort, { once: true })
    link.onload = (): void => {
      cleanup()
      resolve()
    }
    link.onerror = (): void => {
      cleanup()
      reject(new Error(`Failed to load CSS: ${url}`))
    }
    globalThis.document.head.appendChild(link)
  })
}

/** Fetches and scopes CSS without adding a child node to the caller's mount. */
async function loadScopedCss(url: string, signal: AbortSignal, container: Element): Promise<void> {
  if (signal.aborted) throw createAbortError()
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Failed to load CSS: ${url}`)
  const cssText = await response.text()
  if (typeof globalThis.document === 'undefined') throw new Error('CSS preload requires a browser document.')
  const style = globalThis.document.createElement('style')
  style.textContent = `@scope (${resolveScopeSelector(container)}) {\n${cssText}\n}`
  globalThis.document.head.appendChild(style)
}
