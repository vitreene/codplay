// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHtmlInCanvasSession } from '../../../../src/runtime/runner-html/replace-presentation/html-in-canvas/session'
import { createHtmlInCanvasRenderer } from '../../../../src/runtime/runner-html/replace-presentation/html-in-canvas/webgpu-renderer'
import { HTML_IN_CANVAS_EFFECTS } from '../../../../src/runtime/runner-html/replace-presentation/html-in-canvas/effects'

// jsdom has no HTML-in-Canvas or WebGPU implementation. Replace only that
// rendering boundary; the session and its DOM lifecycle remain real.
vi.mock('../../../../src/runtime/runner-html/replace-presentation/html-in-canvas/webgpu-renderer', () => ({
  /** Supplies a renderer that records its mount without emulating the GPU. */
  createHtmlInCanvasRenderer: vi.fn(() => ({
    mount: vi.fn(),
    sample: vi.fn(),
    reflow: vi.fn(),
    capture: () => undefined,
    onFailure: vi.fn(),
    dispose: vi.fn(),
  })),
}))

const hosts: HTMLElement[] = []

/** Attaches one replace root to the document, as the component runtime does. */
function createRoot(...children: HTMLElement[]): HTMLElement {
  const host = document.createElement('div')
  const root = document.createElement('div')
  root.append(...children)
  host.append(root)
  document.body.append(host)
  hosts.push(host)
  return root
}

afterEach(() => {
  for (const host of hosts) host.remove()
  hosts.length = 0
  vi.clearAllMocks()
})

describe('HTML-in-Canvas replace session', () => {
  it.each(HTML_IN_CANVAS_EFFECTS)('mounts the %s effect with its own renderer', (effect) => {
    const root = createRoot(document.createElement('section'))
    const session = createHtmlInCanvasSession(root, { transition: effect, freezeMedia: false, clipToSlot: true })
    expect(session).toBeDefined()
    expect(createHtmlInCanvasRenderer).toHaveBeenCalledWith(effect)
    session?.cancel()
  })

  it('keeps the native outgoing media node for a media replace', () => {
    const outgoing = document.createElement('img')
    const root = createRoot(outgoing)
    const session = createHtmlInCanvasSession(root, { transition: 'burn', freezeMedia: true, clipToSlot: true })
    const renderer = vi.mocked(createHtmlInCanvasRenderer).mock.results[0]?.value
    expect(renderer?.mount).toHaveBeenCalledWith(root.shadowRoot, outgoing.slot, {})
    expect(root.children).toHaveLength(1)
    expect(root.firstElementChild).toBe(outgoing)
    session?.cancel()
    expect(outgoing.hasAttribute('slot')).toBe(false)
  })

  it('presents temporary copies of the slot content and leaves the content itself untouched', () => {
    const content = document.createElement('section')
    content.textContent = 'scene A'
    const root = createRoot(content)
    const session = createHtmlInCanvasSession(root, { transition: 'ripple', freezeMedia: false, clipToSlot: true })
    const renderer = vi.mocked(createHtmlInCanvasRenderer).mock.results[0]?.value
    // One copy is drawn by the canvas, the other covers it until its first DOM frame.
    expect(root.children).toHaveLength(3)
    expect(content.hasAttribute('slot')).toBe(false)
    const [, drawn, cover] = Array.from(root.children) as HTMLElement[]
    expect(drawn?.textContent).toBe('scene A')
    expect(cover?.textContent).toBe('scene A')
    expect(renderer?.mount).toHaveBeenCalledWith(root.shadowRoot, drawn?.slot, { coverSlot: cover?.slot })
    session?.finish()
    expect(Array.from(root.children)).toEqual([content])
  })

  it('draws a ready native outgoing image before the first paint, framed like its CSS', () => {
    const outgoing = document.createElement('img')
    Object.defineProperties(outgoing, {
      naturalWidth: { value: 200 }, naturalHeight: { value: 100 }, complete: { value: true },
    })
    outgoing.style.objectFit = 'cover'
    const root = createRoot(outgoing)
    const session = createHtmlInCanvasSession(root, { transition: 'burn', freezeMedia: true, clipToSlot: true })
    const renderer = vi.mocked(createHtmlInCanvasRenderer).mock.results[0]?.value
    expect(renderer?.mount).toHaveBeenCalledWith(root.shadowRoot, outgoing.slot, {
      initialMedia: { source: outgoing, width: 200, height: 100, objectFit: 'cover' },
    })
    session?.cancel()
  })

  it('never hides the presented states with visibility, which would leave them without a picture', () => {
    const content = document.createElement('section')
    const root = createRoot(content)
    const session = createHtmlInCanvasSession(root, { transition: 'swirl', freezeMedia: false, clipToSlot: true })
    for (const element of Array.from(root.children) as HTMLElement[]) expect(element.style.visibility).toBe('')
    session?.cancel()
  })

  it('declares the effect duration, or 900 ms by default', () => {
    const root = createRoot(document.createElement('section'))
    const session = createHtmlInCanvasSession(root, { transition: 'fold', freezeMedia: false, clipToSlot: true, duration: 1200 })
    expect(session?.getDuration?.()).toBe(1200)
    session?.cancel()
    const defaultSession = createHtmlInCanvasSession(createRoot(document.createElement('section')), {
      transition: 'fold', freezeMedia: false, clipToSlot: true,
    })
    expect(defaultSession?.getDuration?.()).toBe(900)
    defaultSession?.cancel()
  })

  it('finishes and restores the DOM when the GPU fails', () => {
    const content = document.createElement('section')
    const root = createRoot(content)
    createHtmlInCanvasSession(root, { transition: 'shatter', freezeMedia: false, clipToSlot: true })
    const renderer = vi.mocked(createHtmlInCanvasRenderer).mock.results[0]?.value
    const onFailure = vi.mocked(renderer?.onFailure)
    const finish = onFailure?.mock.calls[0]?.[0] as ((reason: string) => void) | undefined
    finish?.('device lost')
    expect(renderer?.dispose).toHaveBeenCalled()
    expect(Array.from(root.children)).toEqual([content])
    expect(root.shadowRoot?.querySelector('[data-codplay-hic-rest]')).not.toBeNull()
  })
})
