export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Preload timeout after ${ms}ms`)), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) }
    )
  })
}

export function loadImage(url: string, timeoutMs: number, signal: AbortSignal): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
      const img = new Image()
      const cleanup = () => signal.removeEventListener('abort', onAbort)
      const onAbort = () => { reject(new DOMException('Aborted', 'AbortError')); cleanup() }
      signal.addEventListener('abort', onAbort)
      img.onload = () => { cleanup(); resolve() }
      img.onerror = () => { cleanup(); reject(new Error(`Failed to load image: ${url}`)) }
      img.src = url
    }),
    timeoutMs
  )
}

export function loadAudio(url: string, timeoutMs: number, signal: AbortSignal): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
      const audio = new Audio()
      audio.preload = 'auto'
      const cleanup = () => {
        audio.removeEventListener('canplaythrough', onReady)
        audio.removeEventListener('error', onError)
        signal.removeEventListener('abort', onAbort)
      }
      const onReady = () => { cleanup(); resolve() }
      const onError = () => { cleanup(); reject(new Error(`Failed to load audio: ${url}`)) }
      const onAbort = () => { audio.src = ''; cleanup(); reject(new DOMException('Aborted', 'AbortError')) }
      audio.addEventListener('canplaythrough', onReady)
      audio.addEventListener('error', onError)
      signal.addEventListener('abort', onAbort)
      audio.src = url
      audio.load()
    }),
    timeoutMs
  )
}

export function loadVideo(url: string, timeoutMs: number, signal: AbortSignal): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
      const video = document.createElement('video')
      video.preload = 'auto'
      video.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none'
      document.body.appendChild(video)
      const cleanup = () => {
        video.removeEventListener('canplaythrough', onReady)
        video.removeEventListener('error', onError)
        signal.removeEventListener('abort', onAbort)
        if (video.parentNode) video.parentNode.removeChild(video)
      }
      const onReady = () => { cleanup(); resolve() }
      const onError = () => { cleanup(); reject(new Error(`Failed to load video: ${url}`)) }
      const onAbort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')) }
      video.addEventListener('canplaythrough', onReady)
      video.addEventListener('error', onError)
      signal.addEventListener('abort', onAbort)
      video.src = url
      video.load()
    }),
    timeoutMs
  )
}

export function loadFont(url: string, name: string | undefined, timeoutMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
  const fontName = name ?? url.split('/').pop()?.split('.')[0] ?? 'preloaded-font'
  const face = new FontFace(fontName, `url(${url})`)
  document.fonts.add(face)
  return withTimeout(
    face.load().then(() => undefined),
    timeoutMs
  )
}

export function loadCss(url: string, timeoutMs: number, signal: AbortSignal): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = url
      const cleanup = () => signal.removeEventListener('abort', onAbort)
      const onAbort = () => {
        cleanup()
        if (link.parentNode) link.parentNode.removeChild(link)
        reject(new DOMException('Aborted', 'AbortError'))
      }
      signal.addEventListener('abort', onAbort)
      link.onload = () => { cleanup(); resolve() }
      link.onerror = () => { cleanup(); reject(new Error(`Failed to load CSS: ${url}`)) }
      document.head.appendChild(link)
    }),
    timeoutMs
  )
}
