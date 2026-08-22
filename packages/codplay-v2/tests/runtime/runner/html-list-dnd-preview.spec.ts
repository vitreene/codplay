import { afterEach, describe, expect, it, vi } from 'vitest'
import { HtmlListDndPreview } from '../../../src/runtime/runner'
import type { RuntimeCaptureSample, RuntimeCaptureState } from '../../../src/runtime/capture'

/** Implements only the inline style operations used by the HTML preview. */
class FakeStyle {
  transition = ''
  transform = ''
  transformOrigin = ''
  position = ''
  left = ''
  top = ''
  width = ''
  height = ''
  margin = ''
  zIndex = ''
  pointerEvents = ''

  /** Writes one CSS property using the same names accepted by CSSStyleDeclaration. */
  setProperty(property: string, value: string): void {
    const key = property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase()) as keyof FakeStyle
    if (key in this) (this as unknown as Record<string, string>)[key] = value
  }

  /** Removes one CSS property written by the preview. */
  removeProperty(property: string): void {
    this.setProperty(property, '')
  }
}

/** Provides the computed-style subset needed to subtract an active FLIP transform. */
class FakeDocument {
  readonly defaultView = {
    getComputedStyle: (node: FakeElement): Readonly<{ transform: string }> => ({
      transform: node.style.transform || 'none',
    }),
  }

  readonly body: FakeElement

  /** Creates the fake document body used by the V1 floating escape path. */
  constructor() {
    this.body = new FakeElement(this, 'body')
  }

  /** Creates one fake element owned by this document. */
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName)
  }
}

/** Supplies deterministic list geometry with normal flow and fixed dragged nodes. */
class FakeElement {
  readonly style = new FakeStyle()
  readonly children: FakeElement[] = []
  readonly attributes = new Map<string, string>()
  private readonly listeners = new Map<string, Set<(event: Event) => void>>()
  parentElement: FakeElement | null = null
  className = ''
  readonly ownerDocument: FakeDocument
  readonly tagName: string
  private readonly listRect: Readonly<{ left: number; top: number; width: number; height: number }> | undefined

  /** Creates one list or item node in the fake browser substrate. */
  constructor(
    ownerDocument: FakeDocument,
    tagName: string,
    listRect?: Readonly<{ left: number; top: number; width: number; height: number }>,
  ) {
    this.ownerDocument = ownerDocument
    this.tagName = tagName
    this.listRect = listRect
  }

  /** Appends one child after detaching it from its former parent. */
  appendChild<T extends FakeElement>(child: T): T {
    child.parentElement?.removeChild(child)
    this.children.push(child)
    child.parentElement = this
    return child
  }

  /** Inserts one child before the requested reference node. */
  insertBefore<T extends FakeElement>(child: T, reference: FakeElement | undefined): T {
    child.parentElement?.removeChild(child)
    const index = reference === undefined ? -1 : this.children.indexOf(reference)
    if (index < 0) this.children.push(child)
    else this.children.splice(index, 0, child)
    child.parentElement = this
    return child
  }

  /** Removes one direct child. */
  removeChild<T extends FakeElement>(child: T): T {
    const index = this.children.indexOf(child)
    if (index >= 0) this.children.splice(index, 1)
    child.parentElement = null
    return child
  }

  /** Removes this node from its current parent. */
  remove(): void {
    this.parentElement?.removeChild(this)
  }

  /** Reads one data attribute used by the preview identity lookup. */
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  /** Writes one data or ghost attribute. */
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  /** Tests one ghost marker attribute. */
  hasAttribute(name: string): boolean {
    return this.attributes.has(name)
  }

  /** Registers one transition listener used by the preview cleanup. */
  addEventListener(type: string, listener: (event: Event) => void): void {
    const listeners = this.listeners.get(type) ?? new Set<(event: Event) => void>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  /** Removes one transition listener used by the preview cleanup. */
  removeEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  /** Returns either the fixed dragged pose or the current flex-column flow pose. */
  getBoundingClientRect(): DOMRect {
    if (this.listRect !== undefined) return toDomRect(this.listRect)
    const fixed = this.style.position === 'fixed'
    if (fixed) {
      const left = readPixels(this.style.left)
      const top = readPixels(this.style.top)
      return toDomRect({
        left,
        top,
        width: readPixels(this.style.width, 120),
        height: readPixels(this.style.height, 42),
      })
    }
    const parent = this.parentElement
    if (parent === null) return toDomRect({ left: 0, top: 0, width: 120, height: 42 })
    const parentRect = parent.getBoundingClientRect()
    const flowChildren = parent.children.filter((child) => child.style.position !== 'fixed')
    const flowIndex = Math.max(0, flowChildren.indexOf(this))
    return toDomRect({
      left: parentRect.left + 12,
      top: parentRect.top + 12 + flowIndex * 50,
      width: 120,
      height: 42,
    })
  }
}

/** Converts a plain geometry record to the DOMRect shape consumed by the preview. */
function toDomRect(rect: Readonly<{ left: number; top: number; width: number; height: number }>): DOMRect {
  return {
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => rect,
  } as DOMRect
}

/** Parses one CSS pixel value used by the fake fixed layout. */
function readPixels(value: string, fallback = 0): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Creates one pointer-like event with the native endpoint coordinates. */
function pointerEvent(clientX: number, clientY: number): Event {
  const event = new Event('pointerup')
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    movementX: { value: 0 },
    movementY: { value: 0 },
  })
  return event
}

/** Creates the capture state used by the V2 list preview fixture. */
function captureState(): RuntimeCaptureState {
  return {
    dropIn: ['list-a', 'list-b'],
    move: { transition: { duration: 420 } },
  }
}

/** Creates one pointer sample for the preview source hook. */
function sample(clientX: number, clientY: number): RuntimeCaptureSample {
  return { clientX, clientY, movementX: 0, movementY: 0 }
}

describe('HtmlListDndPreview', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the pointerup coordinates when no final pointermove was received', () => {
    const document = new FakeDocument()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('document', document)
    const listA = new FakeElement(document, 'section', { left: 0, top: 0, width: 180, height: 180 })
    const listB = new FakeElement(document, 'section', { left: 240, top: 0, width: 180, height: 180 })
    const item1 = item(document, 'main:item-1')
    const item2 = item(document, 'main:item-2')
    listA.appendChild(item1)
    listA.appendChild(item2)
    mark(listA, 'main:list-a')
    mark(listB, 'main:list-b')
    const preview = new HtmlListDndPreview({
      resolveNode: () => item1,
      resolveListNode: (_storyId, listId) => listId === 'list-a' ? listA : listB,
    })

    preview.track({ persoKey: 'main:item-1', sample: sample(20, 30), captureState: captureState() })
    const resolved = preview.resolveEndState('main:item-1', captureState(), pointerEvent(260, 30))

    expect(resolved?.move).toEqual(expect.objectContaining({ target: 'list-b', mode: 0 }))
    preview.close('main:item-1')
  })

  it('keeps the original index when the drop falls outside every list', () => {
    const document = new FakeDocument()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('document', document)
    const listA = new FakeElement(document, 'section', { left: 0, top: 0, width: 180, height: 180 })
    const item1 = item(document, 'main:item-1')
    const item2 = item(document, 'main:item-2')
    listA.appendChild(item1)
    listA.appendChild(item2)
    mark(listA, 'main:list-a')
    const preview = new HtmlListDndPreview({
      resolveNode: () => item1,
      resolveListNode: () => listA,
    })

    preview.track({ persoKey: 'main:item-1', sample: sample(20, 30), captureState: captureState() })
    const resolved = preview.resolveEndState('main:item-1', captureState(), pointerEvent(200, 30))

    expect(resolved?.move).toEqual(expect.objectContaining({ target: 'list-a', mode: 0 }))
    preview.close('main:item-1')
  })

  it('animates list neighbors when the transient ghost changes slot', () => {
    const document = new FakeDocument()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('document', document)
    const listA = new FakeElement(document, 'section', { left: 0, top: 0, width: 180, height: 220 })
    const listB = new FakeElement(document, 'section', { left: 240, top: 0, width: 180, height: 220 })
    const item1 = item(document, 'main:item-1')
    const item2 = item(document, 'main:item-2')
    const item3 = item(document, 'main:item-3')
    listA.appendChild(item1)
    listA.appendChild(item2)
    listA.appendChild(item3)
    mark(listA, 'main:list-a')
    mark(listB, 'main:list-b')
    const preview = new HtmlListDndPreview({
      resolveNode: () => item1,
      resolveListNode: (_storyId, listId) => listId === 'list-a' ? listA : listB,
    })
    const state = captureState()

    preview.track({ persoKey: 'main:item-1', sample: sample(20, 30), captureState: state })
    preview.track({ persoKey: 'main:item-1', sample: sample(20, 160), captureState: state })

    expect(listA.children.at(-1)?.hasAttribute('data-codplay-dnd-ghost')).toBe(true)
    expect(item2.style.transition).toBe('transform 420ms ease')
    expect(item3.style.transition).toBe('transform 420ms ease')
    preview.destroy()
  })

  it('places the ghost between the siblings under the pointer', () => {
    const document = new FakeDocument()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('document', document)
    const listA = new FakeElement(document, 'section', { left: 0, top: 0, width: 180, height: 220 })
    const item1 = item(document, 'main:item-1')
    const item2 = item(document, 'main:item-2')
    const item3 = item(document, 'main:item-3')
    listA.appendChild(item1)
    listA.appendChild(item2)
    listA.appendChild(item3)
    mark(listA, 'main:list-a')
    const preview = new HtmlListDndPreview({
      resolveNode: () => item1,
      resolveListNode: () => listA,
      resolveListItemNodes: (_storyId, listId) => listId === 'list-a'
        ? [item1, item2, item3]
        : [],
    })

    preview.track({ persoKey: 'main:item-1', sample: sample(20, 30), captureState: captureState() })
    expect(item1.parentElement).toBe(document.body)
    preview.track({ persoKey: 'main:item-1', sample: sample(20, 110), captureState: captureState() })

    expect(listA.children
      .filter((child) => child !== item1)
      .map((child) => child.getAttribute('data-item-id') ?? 'ghost')).toEqual([
      'main:item-2',
      'ghost',
      'main:item-3',
    ])
    preview.destroy()
    expect(listA.children).toEqual([item1, item2, item3])
  })

  it('keeps the source slot when the second item moves only slightly', () => {
    const document = new FakeDocument()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('document', document)
    const listA = new FakeElement(document, 'section', { left: 0, top: 0, width: 180, height: 220 })
    const item1 = item(document, 'main:item-1')
    const item2 = item(document, 'main:item-2')
    const item3 = item(document, 'main:item-3')
    listA.appendChild(item1)
    listA.appendChild(item2)
    listA.appendChild(item3)
    mark(listA, 'main:list-a')
    const preview = new HtmlListDndPreview({
      resolveNode: () => item2,
      resolveListNode: () => listA,
      resolveListItemNodes: () => [item1, item2, item3],
    })
    const state = captureState()

    // Item 2 is initially centered at y=83. Once detached, item 3 closes the
    // vacated flow slot; the source-slot anchor must prevent that reflow from
    // sending the ghost to the end on this first, only 2px movement.
    preview.track({ persoKey: 'main:item-2', sample: sample(20, 83), captureState: state })
    preview.track({ persoKey: 'main:item-2', sample: sample(20, 85), captureState: state })

    expect(listA.children
      .filter((child) => child !== item2)
      .map((child) => child.getAttribute('data-item-id') ?? 'ghost')).toEqual([
      'main:item-1',
      'ghost',
      'main:item-3',
    ])
    preview.destroy()
  })

  it('does not reuse or close a previous preview when a second capture starts first', () => {
    const document = new FakeDocument()
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('document', document)
    const listA = new FakeElement(document, 'section', { left: 0, top: 0, width: 180, height: 180 })
    const listB = new FakeElement(document, 'section', { left: 240, top: 0, width: 180, height: 180 })
    const item1 = item(document, 'main:item-1')
    listA.appendChild(item1)
    mark(listA, 'main:list-a')
    mark(listB, 'main:list-b')
    const preview = new HtmlListDndPreview({
      resolveNode: () => item1,
      resolveListNode: (_storyId, listId) => listId === 'list-a' ? listA : listB,
    })
    const state = captureState()

    preview.track({ captureId: 'capture-1', persoKey: 'main:item-1', sample: sample(20, 30), captureState: state })
    const first = preview.resolveEndState('main:item-1', state, pointerEvent(260, 30), 'capture-1')
    expect(first?.move).toEqual(expect.objectContaining({ target: 'list-b' }))

    // The normal move commit can happen before the asynchronous close hook is
    // delivered. Reuse the same persistent node from its new list for the
    // second capture, then deliver the old close out of order.
    listB.appendChild(item1)
    preview.track({ captureId: 'capture-2', persoKey: 'main:item-1', sample: sample(260, 30), captureState: state })
    const second = preview.resolveEndState('main:item-1', state, pointerEvent(20, 30), 'capture-2')
    expect(second?.move).toEqual(expect.objectContaining({ target: 'list-a' }))
    preview.close('main:item-1', 'capture-1')
    expect(item1.style.position).toBe('fixed')

    preview.close('main:item-1', 'capture-2')
    expect(item1.style.position).toBe('')
  })
})

/** Creates one ordinary item root with the stable V2 identity attribute. */
function item(document: FakeDocument, itemId: string): FakeElement {
  const node = document.createElement('article')
  mark(node, itemId)
  return node
}

/** Adds one materialized perso identity to a fake node. */
function mark(node: FakeElement, itemId: string): void {
  node.setAttribute('data-item-id', itemId)
}
