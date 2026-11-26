// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHtmlInCanvasBurnSession } from '../../../../src/runtime/runner-html/replace-presentation/html-in-canvas-burn/burn-session'
import { createHtmlInCanvasBurnRenderer } from '../../../../src/runtime/runner-html/replace-presentation/html-in-canvas-burn/burn-renderer'
import { getFittedMediaRect } from '../../../../src/runtime/runner-html/replace-presentation/media'

// jsdom has no H-i-C/WebGL implementation. Replace only that rendering boundary;
// the session, readiness checks and native DOM lifecycle remain real.
vi.mock('../../../../src/runtime/runner-html/replace-presentation/html-in-canvas-burn/burn-renderer', () => ({
  /** Supplies a canvas mount without emulating the browser's GPU. */
  createHtmlInCanvasBurnRenderer: vi.fn(() => ({
    mount: vi.fn((shadow: ShadowRoot) => shadow.replaceChildren(document.createElement('canvas'))),
    sample: () => undefined,
    capture: () => undefined,
    onContextLost: () => undefined,
    dispose: () => undefined,
  })),
}))

const hosts: HTMLElement[] = []

afterEach(() => {
  for (const host of hosts) host.remove()
  hosts.length = 0
  vi.clearAllMocks()
})

describe('H-i-C native media preparation', () => {
  it('passes the existing decoded native image to initialize the canvas before its first paint', () => {
    const host = document.createElement('div')
    const root = document.createElement('div')
    const outgoing = document.createElement('img')
    Object.defineProperties(outgoing, {
      naturalWidth: { value: 200 }, naturalHeight: { value: 100 },
    })
    outgoing.style.objectFit = 'cover'
    root.append(outgoing)
    host.append(root)
    document.body.append(host)
    hosts.push(host)
    const session = createHtmlInCanvasBurnSession(root, {
      transition: 'burn', freezeMedia: true, clipToSlot: true,
    })
    const renderer = vi.mocked(createHtmlInCanvasBurnRenderer).mock.results[0]?.value

    expect(renderer?.mount).toHaveBeenCalledWith(root.shadowRoot, outgoing.slot, {
      source: outgoing, width: 200, height: 100, objectFit: 'cover',
    })
    expect(root.firstElementChild).toBe(outgoing)
    expect(root.children).toHaveLength(1)
    session?.cancel()
  })

  it.each([
    ['cover', { left: -50, top: 0, width: 200, height: 100 }],
    ['contain', { left: 0, top: 25, width: 100, height: 50 }],
    ['fill', { left: 0, top: 0, width: 100, height: 100 }],
  ] as const)('keeps the authored %s framing when initializing the GPU textures', (fit, expected) => {
    expect(getFittedMediaRect(200, 100, 100, 100, fit)).toEqual(expected)
  })

  it.each(['img', 'video'] as const)(
    'keeps the outgoing native image drawable while the incoming %s is not ready',
    (tag) => {
      const host = document.createElement('div')
      const root = document.createElement('div')
      const outgoing = document.createElement('img')
      outgoing.src = '/hic-fixture-outgoing.png'
      root.append(outgoing)
      host.append(root)
      document.body.append(host)
      hosts.push(host)

      const session = createHtmlInCanvasBurnSession(root, {
        transition: 'burn', freezeMedia: true, clipToSlot: true, duration: 600,
      })
      expect(session).toBeDefined()
      if (session === undefined) return
      const incoming = document.createElement(tag)
      incoming.src = `/hic-fixture-incoming.${tag === 'img' ? 'png' : 'mp4'}`
      root.replaceChildren(incoming)
      expect(outgoing.parentElement).toBeNull()

      expect(session.tryStart?.()).toBe(false)
      expect(outgoing.parentElement).toBe(root)
      expect(outgoing.slot).not.toBe('')
      expect(incoming.parentElement).toBe(root)
      expect(root.children).toHaveLength(2)
      expect(root.querySelector('[data-codplay-replace-view]')).toBeNull()

      session.cancel()
      expect(root.children).toHaveLength(1)
      expect(root.firstElementChild).toBe(incoming)
      expect(outgoing.hasAttribute('slot')).toBe(false)
      expect(outgoing.hasAttribute('data-codplay-transient')).toBe(false)
      expect(root.shadowRoot?.querySelector('canvas')).toBeNull()
    },
  )
})
