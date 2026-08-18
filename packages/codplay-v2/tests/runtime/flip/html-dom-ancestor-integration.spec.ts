import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHtmlDomProjection, HtmlFlipRuntime } from '../../../src/runtime/flip'

type FakeStyle = Record<string, string> & {
  setProperty: (property: string, value: string) => void
}

/** Minimal document view used by the standalone HTML pose host. */
class FakeDocument {
  readonly defaultView = {
    scrollX: 0,
    scrollY: 0,
    getComputedStyle: (node: FakeElement) => ({
      width: `${node.offsetWidth}px`,
      height: `${node.offsetHeight}px`,
      transform: node.style.transform || 'none',
      scale: node.style.scale || 'none',
      rotate: node.style.rotate || 'none',
      translate: node.style.translate || 'none',
      transformOrigin: node.style.transformOrigin || '0 0',
    }),
  }
}

/** DOM-like element with deterministic layout offsets and inline styles. */
class FakeElement {
  readonly ownerDocument: FakeDocument
  readonly childNodes: FakeElement[] = []
  readonly attributes = new Map<string, string>()
  readonly dataset: Record<string, string> = {}
  readonly style: FakeStyle
  parentNode: FakeElement | null = null
  offsetLeft = 0
  offsetTop = 0
  offsetWidth = 0
  offsetHeight = 0
  clientLeft = 0
  clientTop = 0

  /** Creates one measurable fake HTML element. */
  constructor(ownerDocument: FakeDocument, width: number, height: number) {
    this.ownerDocument = ownerDocument
    this.offsetWidth = width
    this.offsetHeight = height
    this.style = Object.assign({
      setProperty: (property: string, value: string) => { this.style[property] = value },
    }, {}) as FakeStyle
  }

  /** Resolves the DOM parent expected by the HTML pose implementation. */
  get parentElement(): FakeElement | null {
    return this.parentNode
  }

  /** Uses the DOM parent as the deterministic offset parent. */
  get offsetParent(): FakeElement | null {
    return this.parentNode
  }

  /** Appends one child after removing it from its former parent. */
  appendChild<T extends FakeElement>(child: T): T {
    child.parentNode?.removeChild(child)
    this.childNodes.push(child)
    child.parentNode = this
    return child
  }

  /** Removes one direct child. */
  removeChild<T extends FakeElement>(child: T): T {
    const index = this.childNodes.indexOf(child)
    if (index >= 0) this.childNodes.splice(index, 1)
    child.parentNode = null
    return child
  }

  /** Reads one fake HTML attribute. */
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  /** Stores one fake HTML attribute. */
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  /** Removes one fake HTML attribute and clears inline style state like a browser. */
  removeAttribute(name: string): void {
    this.attributes.delete(name)
    if (name === 'style') {
      for (const property of Object.keys(this.style)) {
        if (property !== 'setProperty') delete this.style[property]
      }
    }
  }
}

/** Creates the nested source/target hierarchy used by the integration check. */
function hierarchy(): Readonly<{
  root: FakeElement
  sourceOutlet: FakeElement
  targetLayout: FakeElement
  targetContainer: FakeElement
  item: FakeElement
}> {
  const document = new FakeDocument()
  const root = new FakeElement(document, 800, 500)
  const sourceLayout = new FakeElement(document, 260, 300)
  sourceLayout.offsetLeft = 20
  sourceLayout.offsetTop = 20
  const sourceOutlet = new FakeElement(document, 220, 220)
  sourceOutlet.offsetLeft = 20
  sourceOutlet.offsetTop = 60
  const targetLayout = new FakeElement(document, 260, 300)
  targetLayout.dataset.itemId = 'target'
  targetLayout.offsetLeft = 500
  targetLayout.offsetTop = 20
  targetLayout.style.transform = 'matrix(0.98, 0.17, -0.17, 0.98, 0, 0)'
  const targetOutlet = new FakeElement(document, 220, 220)
  targetOutlet.offsetLeft = 20
  targetOutlet.offsetTop = 60
  const targetContainer = new FakeElement(document, 150, 140)
  targetContainer.dataset.itemId = 'container'
  targetContainer.offsetLeft = 30
  targetContainer.offsetTop = 30
  const item = new FakeElement(document, 80, 50)
  item.dataset.itemId = 'item'
  item.offsetLeft = 15
  item.offsetTop = 20

  root.appendChild(sourceLayout)
  root.appendChild(targetLayout)
  sourceLayout.appendChild(sourceOutlet)
  targetLayout.appendChild(targetOutlet)
  targetOutlet.appendChild(targetContainer)
  sourceOutlet.appendChild(item)
  return { root, sourceOutlet, targetLayout, targetContainer, item }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HTML FLIP runner ancestor integration', () => {
  it('captures the target ancestor chain and resolves middle, end and seek-back poses', () => {
    const nodes = hierarchy()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('Element', FakeElement)
    const appliedProgress: number[] = []
    const projection = createHtmlDomProjection({
      hostContextId: 'ancestor-host',
      getProjectionEpoch: () => 1,
      root: nodes.root as unknown as Element,
      resolveHandle: (itemId) => ({
        item: nodes.item,
        target: nodes.targetLayout,
        container: nodes.targetContainer,
      }[itemId] as unknown as HTMLElement | undefined),
      debug: (label, payload) => {
        if (label === 'local-debug-mid-transition' && typeof payload === 'object' && payload !== null && 'progress' in payload) {
          appliedProgress.push(Number(payload.progress))
        }
      },
    })
    const runtime = new HtmlFlipRuntime(projection)
    const capture = runtime.run({
      captureId: 'ancestor-move',
      hostContextId: 'ancestor-host',
      projectionEpoch: 1,
      startAt: 0,
      duration: 100,
      ease: 'linear',
      entries: [
        { itemId: 'target', ancestorIds: [], mode: 'local' },
        { itemId: 'container', ancestorIds: ['target'], mode: 'local' },
        { itemId: 'item', ancestorIds: ['target', 'container'], mode: 'local' },
      ],
      ancestors: [
        { ancestorId: 'target', regime: 'stable' },
        { ancestorId: 'container', parentId: 'target', regime: 'stable' },
      ],
      mutate: () => {
        nodes.targetContainer.offsetHeight = 220
        nodes.targetContainer.appendChild(nodes.item)
      },
    })

    expect(capture.ok).toBe(true)
    if (!capture.ok) return
    const itemCapture = capture.value.entries.find((entry) => entry.itemId === 'item')
    expect(itemCapture?.ancestorIds).toEqual(['target', 'container'])
    expect(capture.value.ancestors.map((ancestor) => ancestor.ancestorId)).toEqual(['target', 'container'])
    expect(itemCapture?.from.rect.left).not.toBe(itemCapture?.to.rect.left)
    expect(nodes.item.parentElement).toBe(nodes.targetContainer)

    runtime.seekCached('ancestor-host', 1, 50)
    expect(appliedProgress.some((progress) => progress > 0 && progress < 1)).toBe(true)
    expect(nodes.item.style.transform).toMatch(/^matrix\(/)
    expect(nodes.item.style.width).toBe('80px')
    expect(nodes.item.style.height).toBe('50px')
    expect(nodes.targetContainer.style.height).toBe('180px')

    runtime.seekCached('ancestor-host', 1, 150)
    expect(nodes.item.style.transform).toBeUndefined()
    expect(nodes.item.style.width).toBeUndefined()
    expect(nodes.item.style.height).toBeUndefined()
    expect(nodes.targetContainer.style.height).toBeUndefined()
    runtime.seekCached('ancestor-host', 1, 50)
    expect(nodes.item.style.transform).toMatch(/^matrix\(/)

    expect(runtime.invalidateHost('ancestor-host', 2).ok).toBe(true)
    expect(nodes.item.style.transform).toBeUndefined()
    runtime.seekCached('ancestor-host', 2, 50)
    expect(nodes.item.style.transform).toBeUndefined()
  })
})
