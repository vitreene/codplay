// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadCss } from '../../src/preload/preload-strategies'

/**
 * `fetch()`/`<link>.onload` against a real `blob:` URL don't resolve in this repo's jsdom
 * environment (verified directly, twice, before writing this file) — `fetch` is mocked here so
 * the wrapping/scoping logic itself is exercised without depending on that broken plumbing.
 */
function mockFetchOnce(text: string): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(text) }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('loadCss — scoped (container given)', () => {
  it('wraps the fetched CSS in @scope(...), in document.head — never as a child of the container', async () => {
    mockFetchOnce('.probe{color:red;}')
    const container = document.createElement('div')
    document.body.appendChild(container)

    await loadCss('blob:whatever', 1000, new AbortController().signal, container)

    // The container itself gets no extra child — v1-invariants.md ("Invariants moteur"): when
    // this is the player's own mountTarget, its children must stay exactly the authored root
    // persos, nothing else. Only an attribute (metadata on an already-existing element) is set.
    expect(container.childElementCount).toBe(0)
    expect(container.getAttribute('data-codplay-scope')).not.toBeNull()

    const style = document.head.querySelector('style')
    expect(style).not.toBeNull()
    expect(style!.textContent).toContain('.probe{color:red;}')
    expect(style!.textContent).toMatch(/^@scope \(\[data-codplay-scope="[^"]+"\]\) \{/)
  })

  it('reuses the same scope attribute/selector across repeated loads of the same container', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    mockFetchOnce('.a{color:red;}')
    await loadCss('blob:a', 1000, new AbortController().signal, container)
    const firstScopeAttr = container.getAttribute('data-codplay-scope')

    mockFetchOnce('.b{color:blue;}')
    await loadCss('blob:b', 1000, new AbortController().signal, container)
    const secondScopeAttr = container.getAttribute('data-codplay-scope')

    expect(firstScopeAttr).not.toBeNull()
    expect(secondScopeAttr).toBe(firstScopeAttr)
  })

  it('assigns a different scope attribute to a different container', async () => {
    const containerA = document.createElement('div')
    const containerB = document.createElement('div')
    document.body.append(containerA, containerB)

    mockFetchOnce('.a{color:red;}')
    await loadCss('blob:a', 1000, new AbortController().signal, containerA)
    mockFetchOnce('.b{color:blue;}')
    await loadCss('blob:b', 1000, new AbortController().signal, containerB)

    expect(containerA.getAttribute('data-codplay-scope')).not.toBe(containerB.getAttribute('data-codplay-scope'))
  })

  it('rejects when the fetch response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve('') }))
    const container = document.createElement('div')

    await expect(loadCss('blob:broken', 1000, new AbortController().signal, container)).rejects.toThrow(
      /Failed to load CSS/,
    )
  })
})

describe('loadCss — unscoped fallback (no container)', () => {
  it('creates a <link rel="stylesheet"> in document.head, not a <style> in any container', () => {
    // No fetch mock needed — the unscoped path never fetches, it lets the browser resolve <link>
    // itself (unchanged from before this increment). The promise is left pending on purpose —
    // only the synchronous DOM setup is asserted, jsdom never fires <link>.onload for it anyway.
    void loadCss('blob:whatever', 1000, new AbortController().signal, null).catch(() => {})

    const link = document.head.querySelector('link[rel="stylesheet"]')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('blob:whatever')
  })
})
