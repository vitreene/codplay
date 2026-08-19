import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureHtmlPose, createHtmlDomProjection, HtmlFlipRuntime } from '../../../src/runtime/flip'
import { FlipCaptureCache } from '../../../src/runtime/flip/flip-capture'

type FakeStyle = Record<string, string> & {
  setProperty: (property: string, value: string, priority?: string) => void
  getPropertyValue: (property: string) => string
  getPropertyPriority: (property: string) => string
  removeProperty: (property: string) => string
}

/** Minimal document view used by the deterministic overlay host. */
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
  readonly head = { appendChild: (_node: FakeElement) => undefined }

  /** Creates one measurable element for the overlay layer. */
  createElement(_tagName: string): FakeElement {
    return new FakeElement(this, 0, 0)
  }
}

/** DOM-like element supporting cloning and recursive ghost queries. */
class FakeElement {
  readonly ownerDocument: FakeDocument
  readonly childNodes: FakeElement[] = []
  readonly attributes = new Map<string, string>()
  readonly dataset: Record<string, string> = {}
  readonly style: FakeStyle
  parentNode: FakeElement | null = null
  offsetLeft = 0
  offsetTop = 0
  fractionalLeft: number | undefined
  fractionalTop: number | undefined
  offsetWidth: number
  offsetHeight: number
  clientLeft = 0
  clientTop = 0

  /** Creates one deterministic element with a local box. */
  constructor(ownerDocument: FakeDocument, width: number, height: number) {
    this.ownerDocument = ownerDocument
    this.offsetWidth = width
    this.offsetHeight = height
    const values: Record<string, string> = {}
    this.style = {
      setProperty: (property: string, value: string) => {
        values[property] = value
        this.style[camelCase(property)] = value
      },
      getPropertyValue: (property: string) => values[property] ?? this.style[camelCase(property)] ?? '',
      getPropertyPriority: () => '',
      removeProperty: (property: string) => {
        const previous = values[property] ?? this.style[camelCase(property)] ?? ''
        delete values[property]
        delete this.style[camelCase(property)]
        return previous
      },
    } as unknown as FakeStyle
  }

  /** Resolves the DOM parent expected by the HTML pose implementation. */
  get parentElement(): FakeElement | null {
    return this.parentNode
  }

  /** Uses the DOM parent as the deterministic offset parent. */
  get offsetParent(): FakeElement | null {
    return this.parentNode
  }

  /** Exposes element children through the browser-shaped property. */
  get children(): readonly FakeElement[] {
    return this.childNodes
  }

  /** Exposes an element ID for the ghost descendant selector. */
  get id(): string {
    return this.attributes.get('id') ?? ''
  }

  /** Sets an element ID for the ghost descendant selector. */
  set id(value: string) {
    this.attributes.set('id', value)
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

  /** Removes this element from its parent. */
  remove(): void {
    this.parentNode?.removeChild(this)
  }

  /** Clones this element and, when requested, all descendants. */
  cloneNode(deep = false): FakeElement {
    const clone = new FakeElement(this.ownerDocument, this.offsetWidth, this.offsetHeight)
    clone.offsetLeft = this.offsetLeft
    clone.offsetTop = this.offsetTop
    clone.fractionalLeft = this.fractionalLeft
    clone.fractionalTop = this.fractionalTop
    for (const [name, value] of this.attributes) clone.attributes.set(name, value)
    for (const [name, value] of Object.entries(this.dataset)) clone.dataset[name] = value
    for (const [name, value] of Object.entries(this.style)) {
      if (typeof value === 'string') clone.style[name] = value
    }
    if (deep) for (const child of this.childNodes) clone.appendChild(child.cloneNode(true))
    return clone
  }

  /** Recursively resolves the selectors used to hide nested overlay items. */
  querySelectorAll<T extends FakeElement>(selector: string): T[] {
    const result: FakeElement[] = []
    for (const child of this.childNodes) {
      if (selector === '[data-item-id], [id]'
        && (child.dataset.itemId !== undefined || child.id !== '')) result.push(child)
      result.push(...child.querySelectorAll(selector))
    }
    return result as T[]
  }

  /** Reads one fake HTML attribute. */
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  /** Stores one fake HTML attribute. */
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  /** Removes one fake HTML attribute. */
  removeAttribute(name: string): void {
    this.attributes.delete(name)
  }

  /** Returns the untransformed world rectangle used only by overlay anchoring. */
  getBoundingClientRect(): DOMRect {
    let left = this.fractionalLeft ?? this.offsetLeft
    let top = this.fractionalTop ?? this.offsetTop
    let parent = this.parentNode
    while (parent !== null) {
      left += parent.fractionalLeft ?? parent.offsetLeft
      top += parent.fractionalTop ?? parent.offsetTop
      parent = parent.parentNode
    }
    return { left, top, width: this.offsetWidth, height: this.offsetHeight } as DOMRect
  }
}

/** Converts a CSS property into the key used by the fake style object. */
function camelCase(property: string): string {
  return property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

/** Creates one source/target root with an item nested below a parent item. */
function overlayHierarchy(): Readonly<{
  root: FakeElement
  source: FakeElement
  target: FakeElement
  item: FakeElement
}> {
  const document = new FakeDocument()
  const root = new FakeElement(document, 600, 300)
  root.offsetLeft = 100
  const source = new FakeElement(document, 180, 120)
  source.dataset.itemId = 'parent'
  source.offsetLeft = 20
  source.offsetTop = 20
  const target = new FakeElement(document, 180, 120)
  target.offsetLeft = 320
  target.offsetTop = 20
  const item = new FakeElement(document, 80, 40)
  item.dataset.itemId = 'child'
  item.offsetLeft = 10
  item.offsetTop = 10
  root.appendChild(source)
  root.appendChild(target)
  source.appendChild(item)
  return { root, source, target, item }
}

/** Creates a nested chain whose every level owns an independent overlay. */
function nestedOverlayHierarchy(depth: number): Readonly<{
  root: FakeElement
  levels: readonly FakeElement[]
}> {
  const document = new FakeDocument()
  const root = new FakeElement(document, 900, 600)
  const levels: FakeElement[] = []
  let parent = root
  for (let index = 0; index <= depth; index += 1) {
    const level = new FakeElement(document, 140, 80)
    level.dataset.itemId = `level-${index}`
    level.offsetLeft = 10 + index * 5
    level.offsetTop = 10 + index * 3
    parent.appendChild(level)
    levels.push(level)
    parent = level
  }
  return { root, levels }
}

/** Returns all overlay-layer children in one fake root. */
function overlayLayers(root: FakeElement): readonly FakeElement[] {
  return root.childNodes.filter((child) => child.getAttribute('data-selection-frame-overlay') !== null)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HTML FLIP overlay integration', () => {
  it('calibrates one world ghost in the root coordinate system and removes it at the end', () => {
    const nodes = overlayHierarchy()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('Element', FakeElement)
    const projection = createHtmlDomProjection({
      hostContextId: 'overlay-host',
      getProjectionEpoch: () => 1,
      root: nodes.root as unknown as Element,
      resolveHandle: (itemId) => itemId === 'item' ? nodes.item as unknown as HTMLElement : undefined,
    })
    const runtime = new HtmlFlipRuntime(projection)
    const capture = runtime.run({
      captureId: 'overlay-move',
      hostContextId: 'overlay-host',
      projectionEpoch: 1,
      startAt: 0,
      duration: 100,
      ease: 'linear',
      entries: [{ itemId: 'item', ancestorIds: [], mode: 'overlay-world' }],
      mutate: () => {
        nodes.target.appendChild(nodes.item)
      },
    })

    expect(capture.ok).toBe(true)
    expect(nodes.item.parentElement).toBe(nodes.target)
    expect(nodes.item.getAttribute('data-codplay-flip-hidden')).toBe('')
    expect(overlayLayers(nodes.root)).toHaveLength(1)
    const layer = overlayLayers(nodes.root)[0]!
    expect(layer.childNodes).toHaveLength(1)
    expect((layer.childNodes[0] as FakeElement).style.transform).toMatch(/^matrix\(/)
    expect((layer.childNodes[0] as FakeElement).style.transform).toContain(', 30, 30)')

    runtime.seekCached('overlay-host', 1, 150)
    expect(nodes.item.getAttribute('data-codplay-flip-hidden')).toBeNull()
    expect(layer.childNodes).toHaveLength(0)

    runtime.destroy()
    expect(overlayLayers(nodes.root)).toHaveLength(0)
  })

  it('preserves fractional DOM placement at the overlay boundary', () => {
    const nodes = overlayHierarchy()
    nodes.source.fractionalLeft = 20.5
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('Element', FakeElement)
    const projection = createHtmlDomProjection({
      hostContextId: 'fractional-overlay-host',
      getProjectionEpoch: () => 1,
      root: nodes.root as unknown as Element,
      resolveHandle: (itemId) => itemId === 'item' ? nodes.item as unknown as HTMLElement : undefined,
    })
    const runtime = new HtmlFlipRuntime(projection)
    const capture = runtime.run({
      captureId: 'fractional-overlay-move',
      hostContextId: 'fractional-overlay-host',
      projectionEpoch: 1,
      startAt: 0,
      duration: 100,
      ease: 'linear',
      entries: [{ itemId: 'item', ancestorIds: [], mode: 'overlay-world' }],
      mutate: () => nodes.target.appendChild(nodes.item),
    })

    expect(capture.ok).toBe(true)
    if (!capture.ok) return
    const entry = capture.value.entries.find((candidate) => candidate.itemId === 'item')
    expect(entry?.from.rect.left).toBeCloseTo(130.5)
    expect(entry?.from.origin.x).toBeCloseTo(130.5)
    expect(entry?.from.layoutOffset?.x).toBeCloseTo(10)

    runtime.destroy()
  })

  it('reuses the FIRST subtree when a cached parent overlay is reactivated', () => {
    const nodes = overlayHierarchy()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('Element', FakeElement)
    const projection = createHtmlDomProjection({
      hostContextId: 'template-host',
      getProjectionEpoch: () => 1,
      root: nodes.root as unknown as Element,
      resolveHandle: (itemId) => itemId === 'parent' ? nodes.source as unknown as HTMLElement : undefined,
    })
    const runtime = new HtmlFlipRuntime(projection)
    const captured = runtime.run({
      captureId: 'template-parent',
      hostContextId: 'template-host',
      projectionEpoch: 1,
      startAt: 0,
      duration: 100,
      ease: 'linear',
      entries: [{ itemId: 'parent', ancestorIds: [], mode: 'overlay-world' }],
      mutate: () => nodes.target.appendChild(nodes.source),
    })

    expect(captured.ok).toBe(true)
    runtime.cancel()
    const laterChild = new FakeElement(nodes.source.ownerDocument, 20, 20)
    laterChild.dataset.itemId = 'created-after-first'
    nodes.source.appendChild(laterChild)

    expect(runtime.seekCached('template-host', 1, 50).ok).toBe(true)
    const layer = overlayLayers(nodes.root)[0]!
    const ghost = layer.childNodes.find((child) => child.dataset.itemId === 'parent')!
    expect(ghost.querySelectorAll<FakeElement>('[data-item-id], [id]').map((child) => child.dataset.itemId)).toEqual(['child'])

    runtime.destroy()
  })

  it('reconciles a parent ghost from current logical descendants on a cold seek', () => {
    const nodes = overlayHierarchy()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('Element', FakeElement)
    const handles = new Map<string, FakeElement>([
      ['parent', nodes.source],
      ['child', nodes.item],
    ])
    const projection = createHtmlDomProjection({
      hostContextId: 'content-sync-host',
      getProjectionEpoch: () => 1,
      root: nodes.root as unknown as Element,
      resolveHandle: (itemId) => handles.get(itemId) as unknown as HTMLElement | undefined,
    })
    const runtime = new HtmlFlipRuntime(projection)
    const captured = runtime.run({
      captureId: 'content-sync-parent',
      hostContextId: 'content-sync-host',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1_000,
      ease: 'linear',
      entries: [{ itemId: 'parent', ancestorIds: [], mode: 'overlay-world' }],
      mutate: () => nodes.target.appendChild(nodes.source),
    })

    expect(captured.ok).toBe(true)
    nodes.source.removeChild(nodes.item)
    const currentChild = new FakeElement(nodes.source.ownerDocument, 80, 40)
    currentChild.dataset.itemId = 'current-child'
    nodes.source.appendChild(currentChild)
    handles.set('current-child', currentChild)
    runtime.setOverlayContentState({
      descendantsByOverlay: { parent: ['current-child'] },
      targetByItem: { 'current-child': 'current-target' },
    })

    expect(runtime.seekCached('content-sync-host', 1, 500).ok).toBe(true)
    const layer = overlayLayers(nodes.root)[0]!
    const ghost = layer.childNodes.find((child) => child.dataset.itemId === 'parent')!
    expect(ghost.querySelectorAll<FakeElement>('[data-item-id], [id]').map((child) => child.dataset.itemId)).toEqual(['current-child'])

    runtime.destroy()
  })

  it('does not copy active transient visibility into a later FIRST template', () => {
    const nodes = overlayHierarchy()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('Element', FakeElement)
    const projection = createHtmlDomProjection({
      hostContextId: 'clean-template-host',
      getProjectionEpoch: () => 1,
      root: nodes.root as unknown as Element,
      resolveHandle: (itemId) => ({
        parent: nodes.source,
        child: nodes.item,
      }[itemId] as unknown as HTMLElement | undefined),
    })
    const runtime = new HtmlFlipRuntime(projection)
    const first = runtime.run({
      captureId: 'clean-template-first',
      hostContextId: 'clean-template-host',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1_000,
      ease: 'linear',
      entries: [{
        itemId: 'parent',
        ancestorIds: [],
        overlayTargetByPerso: { child: 'source-target' },
        mode: 'overlay-world',
      }],
      mutate: () => nodes.target.appendChild(nodes.source),
    })
    if (!first.ok) throw new Error(first.diagnostics.errors.map((entry) => entry.message).join('\n'))

    const second = runtime.run({
      captureId: 'clean-template-second',
      hostContextId: 'clean-template-host',
      projectionEpoch: 1,
      startAt: 100,
      duration: 1_000,
      ease: 'linear',
      entries: [{
        itemId: 'parent',
        ancestorIds: [],
        overlayTargetByPerso: { child: 'source-target' },
        mode: 'overlay-world',
      }],
      mutate: () => {
        nodes.source.offsetLeft += 10
      },
    })
    if (!second.ok) throw new Error(second.diagnostics.errors.map((entry) => entry.message).join('\n'))

    const layer = overlayLayers(nodes.root)[0]!
    const ghost = layer.childNodes.find((child) => child.dataset.itemId === 'parent')!
    const childClone = ghost.querySelectorAll<FakeElement>('[data-item-id], [id]')
      .find((child) => child.dataset.itemId === 'child')!
    expect(ghost.getAttribute('data-codplay-flip-hidden')).toBeNull()
    expect(childClone.getAttribute('data-codplay-flip-hidden')).toBeNull()

    runtime.destroy()
  })

  it('hides a child clone in a parent ghost while the child owns its overlay', () => {
    const nodes = overlayHierarchy()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('Element', FakeElement)
    const projection = createHtmlDomProjection({
      hostContextId: 'nested-overlay-host',
      getProjectionEpoch: () => 1,
      root: nodes.root as unknown as Element,
      resolveHandle: (itemId) => ({
        parent: nodes.source,
        child: nodes.item,
      }[itemId] as unknown as HTMLElement | undefined),
    })
    const runtime = new HtmlFlipRuntime(projection)
    const capture = runtime.run({
      captureId: 'nested-overlay-move',
      hostContextId: 'nested-overlay-host',
      projectionEpoch: 1,
      startAt: 0,
      duration: 100,
      ease: 'linear',
      entries: [
        { itemId: 'parent', ancestorIds: [], mode: 'overlay-world' },
        { itemId: 'child', ancestorIds: [], mode: 'overlay-world' },
      ],
      mutate: () => {
        nodes.target.appendChild(nodes.source)
      },
    })

    expect(capture.ok).toBe(true)
    const layer = overlayLayers(nodes.root)[0]!
    const parentGhost = layer.childNodes.find((child) => child.dataset.itemId === 'parent')!
    const childCloneInParent = parentGhost.querySelectorAll<FakeElement>('[data-item-id], [id]')
      .find((child) => child.dataset.itemId === 'child')
    expect(childCloneInParent?.getAttribute('data-codplay-flip-hidden')).toBe('')
    expect(layer.childNodes).toHaveLength(2)

    runtime.seekCached('nested-overlay-host', 1, 150)
    expect(layer.childNodes).toHaveLength(0)
    expect(nodes.source.getAttribute('data-codplay-flip-hidden')).toBeNull()
    expect(nodes.item.getAttribute('data-codplay-flip-hidden')).toBeNull()
    runtime.destroy()
  })

  it('hides every parent clone while an active child owner has a newer source target', () => {
    const nodes = overlayHierarchy()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('Element', FakeElement)
    const projection = createHtmlDomProjection({
      hostContextId: 'grouped-child-ownership-host',
      getProjectionEpoch: () => 1,
      root: nodes.root as unknown as Element,
      resolveHandle: (itemId) => ({
        parent: nodes.source,
        child: nodes.item,
      }[itemId] as unknown as HTMLElement | undefined),
    })
    const runtime = new HtmlFlipRuntime(projection)
    const parentCapture = runtime.run({
      captureId: 'grouped-child-parent',
      hostContextId: 'grouped-child-ownership-host',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1_000,
      ease: 'linear',
      entries: [{
        itemId: 'parent',
        ancestorIds: [],
        overlayTargetByPerso: { child: 'source-target' },
        mode: 'overlay-world',
      }],
      mutate: () => nodes.target.appendChild(nodes.source),
    })
    if (!parentCapture.ok) throw new Error(parentCapture.diagnostics.errors.map((entry) => entry.message).join('\n'))

    const childCapture = runtime.run({
      captureId: 'grouped-child-current-owner',
      hostContextId: 'grouped-child-ownership-host',
      projectionEpoch: 1,
      startAt: 100,
      duration: 100,
      ease: 'linear',
      entries: [{
        itemId: 'child',
        ancestorIds: [],
        sourceTargetId: 'already-moved-source',
        destinationTargetId: 'already-moved-destination',
        mode: 'overlay-world',
      }],
      mutate: () => nodes.target.appendChild(nodes.item),
    })
    if (!childCapture.ok) throw new Error(childCapture.diagnostics.errors.map((entry) => entry.message).join('\n'))

    const layer = overlayLayers(nodes.root)[0]!
    const parentGhost = layer.childNodes.find((child) => child.dataset.itemId === 'parent')!
    const childCloneInParent = parentGhost.querySelectorAll<FakeElement>('[data-item-id], [id]')
      .find((child) => child.dataset.itemId === 'child')!
    expect(childCloneInParent.getAttribute('data-codplay-flip-hidden')).toBe('')

    runtime.destroy()
  })

  it('uses captured descendant references after clone identity attributes are removed', () => {
    const nodes = overlayHierarchy()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('Element', FakeElement)
    const projection = createHtmlDomProjection({
      hostContextId: 'reference-overlay-host',
      getProjectionEpoch: () => 1,
      root: nodes.root as unknown as Element,
      resolveHandle: (itemId) => ({
        parent: nodes.source,
        child: nodes.item,
      }[itemId] as unknown as HTMLElement | undefined),
    })
    const runtime = new HtmlFlipRuntime(projection)
    const parentCapture = runtime.run({
      captureId: 'reference-parent',
      hostContextId: 'reference-overlay-host',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1_000,
      ease: 'linear',
      entries: [{
        itemId: 'parent',
        ancestorIds: [],
        sourceTargetId: 'source-target',
        destinationTargetId: 'target-target',
        overlayTargetByPerso: { child: 'source-target' },
        mode: 'overlay-world',
      }],
      mutate: () => nodes.target.appendChild(nodes.source),
    })
    if (!parentCapture.ok) throw new Error(parentCapture.diagnostics.errors.map((entry) => entry.message).join('\n'))

    const layer = overlayLayers(nodes.root)[0]!
    const parentGhost = layer.childNodes[0] as FakeElement
    const childClone = parentGhost.childNodes[0]!
    delete childClone.dataset.itemId
    childClone.attributes.delete('data-item-id')
    childClone.attributes.delete('id')

    const childCapture = runtime.run({
      captureId: 'reference-child',
      hostContextId: 'reference-overlay-host',
      projectionEpoch: 1,
      startAt: 100,
      duration: 100,
      ease: 'linear',
      entries: [{
        itemId: 'child',
        ancestorIds: [],
        sourceTargetId: 'source-target',
        destinationTargetId: 'target-target',
        mode: 'overlay-world',
      }],
      mutate: () => nodes.target.appendChild(nodes.item),
    })
    if (!childCapture.ok) throw new Error(childCapture.diagnostics.errors.map((entry) => entry.message).join('\n'))

    expect(childClone.getAttribute('data-codplay-flip-hidden')).toBe('')
    runtime.destroy()
  })

  it('does not restore a cross-target child into the FIRST parent ghost at LAST', () => {
    const nodes = overlayHierarchy()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('Element', FakeElement)
    const projection = createHtmlDomProjection({
      hostContextId: 'ownership-aware-host',
      getProjectionEpoch: () => 1,
      root: nodes.root as unknown as Element,
      resolveHandle: (itemId) => ({
        parent: nodes.source,
        child: nodes.item,
      }[itemId] as unknown as HTMLElement | undefined),
    })
    const runtime = new HtmlFlipRuntime(projection)
    const parentCapture = runtime.run({
      captureId: 'ownership-parent',
      hostContextId: 'ownership-aware-host',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1_000,
      ease: 'linear',
      entries: [{
        itemId: 'parent',
        ancestorIds: [],
        sourceTargetId: 'root-source',
        destinationTargetId: 'root-target',
        overlayTargetByPerso: { child: 'source-target' },
        mode: 'overlay-world',
      }],
      mutate: () => nodes.target.appendChild(nodes.source),
    })
    if (!parentCapture.ok) throw new Error(parentCapture.diagnostics.errors.map((entry) => entry.message).join('\n'))

    const layer = overlayLayers(nodes.root)[0]!
    const parentGhost = layer.childNodes.find((child) => child.dataset.itemId === 'parent')!
    const childCloneInParent = parentGhost.querySelectorAll<FakeElement>('[data-item-id], [id]')
      .find((child) => child.dataset.itemId === 'child')!
    expect(childCloneInParent.getAttribute('data-codplay-flip-hidden')).toBeNull()

    const childCapture = runtime.run({
      captureId: 'ownership-child',
      hostContextId: 'ownership-aware-host',
      projectionEpoch: 1,
      startAt: 100,
      duration: 100,
      ease: 'linear',
      entries: [{
        itemId: 'child',
        ancestorIds: [],
        sourceTargetId: 'source-target',
        destinationTargetId: 'target-target',
        mode: 'overlay-world',
      }],
      mutate: () => nodes.target.appendChild(nodes.item),
    })
    if (!childCapture.ok) throw new Error(childCapture.diagnostics.errors.map((entry) => entry.message).join('\n'))

    runtime.seekCached('ownership-aware-host', 1, 200)
    expect(childCloneInParent.getAttribute('data-codplay-flip-hidden')).toBe('')
    expect(nodes.item.parentElement).toBe(nodes.target)
    expect(nodes.item.getAttribute('data-codplay-flip-hidden')).toBeNull()

    const reverseCapture = runtime.run({
      captureId: 'ownership-child-reverse',
      hostContextId: 'ownership-aware-host',
      projectionEpoch: 1,
      startAt: 300,
      duration: 100,
      ease: 'linear',
      entries: [{
        itemId: 'child',
        ancestorIds: [],
        sourceTargetId: 'target-target',
        destinationTargetId: 'source-target',
        mode: 'overlay-world',
      }],
      mutate: () => nodes.source.appendChild(nodes.item),
    })
    if (!reverseCapture.ok) throw new Error(reverseCapture.diagnostics.errors.map((entry) => entry.message).join('\n'))

    runtime.seekCached('ownership-aware-host', 1, 400)
    expect(childCloneInParent.getAttribute('data-codplay-flip-hidden')).toBeNull()

    runtime.destroy()
  })

  it('keeps a child overlay on the moving destination parent after the child LAST', () => {
    const nodes = overlayHierarchy()
    nodes.target.dataset.itemId = 'destination'
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('Element', FakeElement)
    const projection = createHtmlDomProjection({
      hostContextId: 'handoff-host',
      getProjectionEpoch: () => 1,
      root: nodes.root as unknown as Element,
      resolveHandle: (itemId) => ({
        destination: nodes.target,
        child: nodes.item,
      }[itemId] as unknown as HTMLElement | undefined),
    })
    const runtime = new HtmlFlipRuntime(projection)
    const parentCapture = runtime.run({
      captureId: 'handoff-parent',
      hostContextId: 'handoff-host',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1_000,
      ease: 'linear',
      entries: [{ itemId: 'destination', ancestorIds: [], mode: 'overlay-world' }],
      mutate: () => {
        nodes.target.offsetLeft = 420
      },
    })
    if (!parentCapture.ok) throw new Error(parentCapture.diagnostics.errors.map((entry) => entry.message).join('\n'))

    const childCapture = runtime.run({
      captureId: 'handoff-child',
      hostContextId: 'handoff-host',
      projectionEpoch: 1,
      startAt: 100,
      duration: 100,
      ease: 'linear',
      entries: [{
        itemId: 'child',
        ancestorIds: [],
        sourceTargetId: 'source-target',
        destinationTargetId: 'target-target',
        sourceParentId: 'parent',
        destinationParentId: 'destination',
        mode: 'overlay-world',
      }],
      mutate: () => {
        nodes.target.appendChild(nodes.item)
      },
    })
    if (!childCapture.ok) throw new Error(childCapture.diagnostics.errors.map((entry) => entry.message).join('\n'))

    const layer = overlayLayers(nodes.root)[0]!
    const childGhost = () => layer.childNodes.find((child) => child.dataset.itemId === 'child')!
    runtime.seekCached('handoff-host', 1, 200)
    const childAtLast = childGhost()
    const lastTransform = childAtLast.style.transform
    expect(nodes.item.getAttribute('data-codplay-flip-hidden')).toBe('')
    expect(layer.childNodes).toHaveLength(2)

    runtime.seekCached('handoff-host', 1, 500)
    expect(childGhost().style.transform).not.toBe(lastTransform)
    expect(nodes.item.getAttribute('data-codplay-flip-hidden')).toBe('')

    runtime.seekCached('handoff-host', 1, 1_000)
    expect(layer.childNodes).toHaveLength(0)
    expect(nodes.item.parentElement).toBe(nodes.target)
    expect(nodes.item.getAttribute('data-codplay-flip-hidden')).toBeNull()
    expect(nodes.target.getAttribute('data-codplay-flip-hidden')).toBeNull()

    runtime.destroy()
  })

  it('uses the current active parent when a stale direct child overlay remains during reparenting', () => {
    const nodes = overlayHierarchy()
    nodes.target.dataset.itemId = 'destination'
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('Element', FakeElement)
    const projection = createHtmlDomProjection({
      hostContextId: 'reparent-measurement-host',
      getProjectionEpoch: () => 1,
      root: nodes.root as unknown as Element,
      resolveHandle: (itemId) => ({
        parent: nodes.source,
        destination: nodes.target,
        child: nodes.item,
      }[itemId] as unknown as HTMLElement | undefined),
    })
    const runtime = new HtmlFlipRuntime(projection)

    const parentCapture = runtime.run({
      captureId: 'reparent-parent',
      hostContextId: 'reparent-measurement-host',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1_000,
      ease: 'linear',
      entries: [
        { itemId: 'parent', ancestorIds: [], mode: 'overlay-world' },
        { itemId: 'child', ancestorIds: [], isDirectMover: false, mode: 'overlay-world' },
      ],
      mutate: () => {
        nodes.source.offsetLeft += 100
      },
    })
    if (!parentCapture.ok) throw new Error(parentCapture.diagnostics.errors.map((entry) => entry.message).join('\n'))

    const destinationCapture = runtime.run({
      captureId: 'reparent-destination',
      hostContextId: 'reparent-measurement-host',
      projectionEpoch: 1,
      startAt: 0,
      duration: 1_000,
      ease: 'linear',
      entries: [{ itemId: 'destination', ancestorIds: [], mode: 'overlay-world' }],
      mutate: () => {
        nodes.target.offsetLeft += 100
      },
    })
    if (!destinationCapture.ok) throw new Error(destinationCapture.diagnostics.errors.map((entry) => entry.message).join('\n'))

    const childCapture = runtime.run({
      captureId: 'reparent-child',
      hostContextId: 'reparent-measurement-host',
      projectionEpoch: 1,
      startAt: 100,
      duration: 100,
      ease: 'linear',
      entries: [{
        itemId: 'child',
        ancestorIds: [],
        sourceParentId: 'parent',
        destinationParentId: 'destination',
        mode: 'overlay-world',
      }],
      mutate: () => {
        nodes.target.appendChild(nodes.item)
      },
    })
    if (!childCapture.ok) throw new Error(childCapture.diagnostics.errors.map((entry) => entry.message).join('\n'))

    const childEntry = childCapture.value.entries.find((entry) => entry.itemId === 'child')!
    const destinationEntry = destinationCapture.value.entries.find((entry) => entry.itemId === 'destination')!
    const destinationAtChildEnd = destinationEntry.from.rect.left
      + (destinationEntry.to.rect.left - destinationEntry.from.rect.left) * 0.2
    const currentChildPose = captureHtmlPose(nodes.item as unknown as Element)
    const currentDestinationPose = captureHtmlPose(nodes.target as unknown as Element)
    const childOffsetInDestination = currentChildPose.origin.x - currentDestinationPose.origin.x
    // The measured child LAST must follow the active destination ghost plus
    // its local offset, rather than the stale direct ghost from the source.
    expect(childEntry.to.origin.x).toBeCloseTo(destinationAtChildEnd + childOffsetInDestination)

    runtime.destroy()
  })

  it('keeps a five-level DOM overlay chain alive through recursive handoffs', () => {
    const nodes = nestedOverlayHierarchy(5)
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('Element', FakeElement)
    const handles = new Map(nodes.levels.map((node) => [node.dataset.itemId, node]))
    const projection = createHtmlDomProjection({
      hostContextId: 'depth-five-host',
      getProjectionEpoch: () => 1,
      root: nodes.root as unknown as Element,
      resolveHandle: (itemId) => handles.get(itemId) as unknown as HTMLElement | undefined,
    })
    const runtime = new HtmlFlipRuntime(projection)

    for (let depth = 0; depth <= 5; depth += 1) {
      const itemId = `level-${depth}`
      const descendantIds = nodes.levels.slice(depth + 1).map((node) => node.dataset.itemId)
      const startAt = depth * 50
      const endAt = 1_000 - depth * 50
      const result = runtime.run({
        captureId: `depth-five-${depth}`,
        hostContextId: 'depth-five-host',
        projectionEpoch: 1,
        startAt,
        duration: endAt - startAt,
        ease: 'linear',
        entries: [{
          itemId,
          ancestorIds: [],
          sourceTargetId: `target-${itemId}`,
          destinationTargetId: `target-${itemId}`,
          ...(depth === 0 ? {} : {
            sourceParentId: `level-${depth - 1}`,
            destinationParentId: `level-${depth - 1}`,
          }),
          overlayTargetByPerso: Object.fromEntries(descendantIds.map((id) => [id, `target-${id}`])),
          mode: 'overlay-world',
        }],
        mutate: () => {
          nodes.levels[depth]!.offsetLeft += 7
        },
      })
      if (!result.ok) throw new Error(result.diagnostics.errors.map((entry) => entry.message).join('\n'))
    }

    const layer = () => overlayLayers(nodes.root)[0]
    runtime.seekCached('depth-five-host', 1, 700)
    expect(layer()?.childNodes).toHaveLength(6)
    for (const level of nodes.levels) expect(level.getAttribute('data-codplay-flip-hidden')).toBe('')

    runtime.seekCached('depth-five-host', 1, 999)
    expect(layer()?.childNodes).toHaveLength(6)
    runtime.seekCached('depth-five-host', 1, 1_000)
    expect(layer()?.childNodes).toHaveLength(0)
    for (const level of nodes.levels) expect(level.getAttribute('data-codplay-flip-hidden')).toBeNull()

    runtime.destroy()
  })

  it('keeps the parent ghost when a grouped capture replaces a single alias', () => {
    const nodes = overlayHierarchy()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('Element', FakeElement)
    const projection = createHtmlDomProjection({
      hostContextId: 'grouped-overlay-host',
      getProjectionEpoch: () => 1,
      root: nodes.root as unknown as Element,
      resolveHandle: (itemId) => ({
        parent: nodes.source,
        child: nodes.item,
      }[itemId] as unknown as HTMLElement | undefined),
    })
    const cache = new FlipCaptureCache()
    const runtime = new HtmlFlipRuntime(projection, cache)
    const parentCapture = runtime.run({
      captureId: 'compiled:parent',
      hostContextId: 'grouped-overlay-host',
      projectionEpoch: 1,
      startAt: 0,
      duration: 100,
      ease: 'linear',
      entries: [{ itemId: 'parent', ancestorIds: [], mode: 'overlay-world' }],
      mutate: () => nodes.target.appendChild(nodes.source),
    })

    if (!parentCapture.ok) throw new Error(parentCapture.diagnostics.errors.map((entry) => entry.message).join('\n'))
    const layer = overlayLayers(nodes.root)[0]!
    const parentGhost = layer.childNodes.find((child) => child.dataset.itemId === 'parent')!
    cache.set({
      ...parentCapture.value,
      captureId: 'grouped-parent',
      sourceCaptureIds: ['compiled:parent'],
    })

    expect(runtime.seekCached('grouped-overlay-host', 1, 50).ok).toBe(true)
    expect(layer.childNodes.find((child) => child.dataset.itemId === 'parent')).toBe(parentGhost)

    runtime.destroy()
  })
})
