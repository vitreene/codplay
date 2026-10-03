import type { LayoutFlowReservation } from './layout-flow-reservation-types'

type FlowPart = {
  node: HTMLElement
  paragraph: HTMLElement | null
  nextSibling: Node | null
  blockSize: string
}

/** Keeps existing layout parts after their insertion line as the text width changes. */
export class LayoutFlowReservationController {
  private readonly parts: readonly FlowPart[]
  private readonly observer: ResizeObserver | null
  private partsInDocumentOrder: readonly FlowPart[] | null = null
  private width: number | null = null
  private scheduled = false
  private destroyed = false

  /** Resolves existing parts and observes the layout text width. */
  constructor(root: HTMLElement, declarations: readonly LayoutFlowReservation[], resolvePart: (partId: string) => unknown) {
    this.parts = declarations.map((declaration) => {
      const node = resolvePart(declaration.partId)
      if (!(node instanceof HTMLElement)) {
        throw new Error(`Layout flow part is not an HTML element: ${declaration.partId}`)
      }
      return { node, paragraph: null, nextSibling: null, blockSize: declaration.blockSize }
    })
    this.observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width
      if (nextWidth === undefined || nextWidth === this.width) return
      this.width = nextWidth
      this.schedule()
    })
    this.observer?.observe(root)
    this.schedule()
  }

  /** Recomputes after a player seek or reset reattaches the layout. */
  refresh(): void {
    this.schedule()
  }

  /** Releases the width listener and the saved insertion positions. */
  destroy(): void {
    this.destroyed = true
    this.observer?.disconnect()
  }

  /** Coalesces mount, seek, and resize notifications into one layout pass. */
  private schedule(): void {
    if (this.scheduled || this.destroyed) return
    this.scheduled = true
    queueMicrotask(() => {
      this.scheduled = false
      if (!this.destroyed) this.reflow()
    })
  }

  /** Restores the slots to their logical points before reserving visual space. */
  private reflow(): void {
    if (!this.captureConnectedParts()) return
    const orderedParts = this.partsInDocumentOrder!
    for (const part of [...orderedParts].reverse()) {
      if (part.paragraph === null) continue
      part.paragraph.insertBefore(part.node, part.nextSibling)
    }
    const paragraphs = new Set(orderedParts.flatMap((part) => part.paragraph === null ? [] : [part.paragraph]))
    for (const paragraph of paragraphs) paragraph.normalize()
    for (const part of orderedParts) part.nextSibling = part.node.nextSibling
    for (const part of orderedParts) {
      part.node.style.display = 'inline'
      part.node.style.float = 'none'
      part.node.style.width = '0'
      part.node.style.height = '0'
      part.node.style.padding = '0'
      part.node.style.margin = '0'
    }
    for (const part of orderedParts) this.placeAfterLine(part)
  }

  /** Captures source positions only after CodPlay has attached the template. */
  private captureConnectedParts(): boolean {
    if (this.partsInDocumentOrder !== null) return true
    for (const part of this.parts) {
      if (!part.node.isConnected || part.node.parentElement === null) return false
    }
    for (const part of this.parts) {
      part.paragraph = part.node.parentElement
      part.nextSibling = part.node.nextSibling
    }
    this.partsInDocumentOrder = [...this.parts].sort(compareFlowParts)
    return true
  }

  /** Moves one existing slot after its visual line and sizes its reservation. */
  private placeAfterLine(part: FlowPart): void {
    if (part.paragraph === null) return
    const lineTop = part.node.getClientRects()[0]?.top
    if (lineTop === undefined) return
    const boundary = this.findNextLine(part, lineTop)
    if (boundary === null) {
      part.paragraph.append(part.node)
    } else {
      const following = boundary.node.splitText(boundary.offset)
      following.parentNode?.insertBefore(part.node, following)
    }
    part.node.style.display = 'block'
    part.node.style.float = 'left'
    part.node.style.width = '100%'
    part.node.style.height = '0'
    part.node.style.paddingBottom = part.blockSize
  }

  /** Finds the first text character rendered below the slot's natural line. */
  private findNextLine(part: FlowPart, lineTop: number): { node: Text; offset: number } | null {
    if (part.paragraph === null) return null
    const iterator = part.paragraph.ownerDocument.createTreeWalker(part.paragraph, NodeFilter.SHOW_TEXT)
    const range = part.paragraph.ownerDocument.createRange()
    let candidate = iterator.nextNode()
    while (candidate !== null) {
      if (!part.node.contains(candidate) && (part.node.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) {
        const text = candidate as Text
        for (let offset = 0; offset < text.length; offset += 1) {
          range.setStart(text, offset)
          range.setEnd(text, offset + 1)
          const top = range.getClientRects()[0]?.top
          if (top !== undefined && top > lineTop + 1) return { node: text, offset }
        }
      }
      candidate = iterator.nextNode()
    }
    return null
  }
}

/** Orders reservations by their immutable source positions in the authored markup. */
function compareFlowParts(first: FlowPart, second: FlowPart): number {
  if (first.node === second.node) return 0
  return first.node.compareDocumentPosition(second.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
}
