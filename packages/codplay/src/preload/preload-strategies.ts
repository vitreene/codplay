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

/**
 * Attribute used to anchor `@scope` to one scene's mount container. Reused across repeated
 * loads of the same container (ex. `rebuild()`), never regenerated needlessly.
 */
const SCOPE_ATTRIBUTE = 'data-codplay-scope'
let scopeCounter = 0

function resolveScopeSelector(container: Element): string {
  const existing = container.getAttribute(SCOPE_ATTRIBUTE)
  if (existing) return `[${SCOPE_ATTRIBUTE}="${existing}"]`
  scopeCounter += 1
  const id = `cp-scope-${scopeCounter}`
  container.setAttribute(SCOPE_ATTRIBUTE, id)
  return `[${SCOPE_ATTRIBUTE}="${id}"]`
}

/**
 * Load one CSS resource, scoped to `container` via `@scope` — the rules only ever apply to
 * `container` and its descendants, never leaking onto the rest of the host page, regardless of
 * where the `<style>` tag carrying them physically lives in the document. Needs the actual CSS
 * text to wrap it, so this fetches `url` itself rather than letting a `<link>` resolve it — works
 * the same for a `blob:` URL (dynamic Blob CSS, ex. `AutoCapsule.renderStyleSheet()`) and a
 * regular path (a static file), `fetch()` is scheme-agnostic for both.
 *
 * Falls back to a plain, unscoped `<link>` when no `container` is given — preload can run before
 * a scene is mounted (ex. tooling prefetch, `mode:'author'`), and there is nothing to scope to
 * yet in that case.
 */
export function loadCss(url: string, timeoutMs: number, signal: AbortSignal, container?: Element | null): Promise<void> {
  return withTimeout(container ? loadScopedCss(url, container, signal) : loadUnscopedCss(url, signal), timeoutMs)
}

/**
 * The `<style>` tag itself never becomes a child of `container` — `@scope` scopes by selector
 * match, not by the physical DOM position of the `<style>` tag, so it can live in
 * `document.head` like any other stylesheet. This matters: `container` is normally the
 * player's `mountTarget`, and `v1-invariants.md` ("Invariants moteur") requires that its
 * children stay exactly the authored root persos — "le moteur ne crée jamais de node
 * lui-même" — verified by a real test (`mounted-stories-runtime.spec.ts`) that a synthetic
 * node here is a violation. Only an attribute is set on `container` itself (metadata on an
 * already-caller-owned element, not a node Codplay adds), used purely to anchor the selector.
 */
async function loadScopedCss(url: string, container: Element, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Failed to load CSS: ${url}`)
  const cssText = await response.text()
  const scopeSelector = resolveScopeSelector(container)
  const style = document.createElement('style')
  style.textContent = `@scope (${scopeSelector}) {\n${cssText}\n}`
  document.head.appendChild(style)
}

function loadUnscopedCss(url: string, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
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
  })
}
