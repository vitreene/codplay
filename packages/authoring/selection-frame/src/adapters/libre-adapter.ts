import type { AuthorApi } from '../author-api'
import { captureNodeOwnMatrix } from '../overlay-pose'
import type { CsRawMoveDiff, CsRawRotateDiff, CsRawScaleDiff, CsRawSizeDiff, CsValueAdapter } from '../types'

export type LibreAdapterMode = 'translate' | 'top-left'

export type LibreAdapterOptions = {
  authorApi: AuthorApi
  itemId: string
  /**
   * 'translate' (default) mutates the individual CSS `translate` property and
   * never affects layout. 'top-left' is only meaningful when the element is
   * absolutely positioned and the editor explicitly chose that mode.
   */
  mode?: LibreAdapterMode
  /** Notified after each applied mutation, for editor-side data propagation. */
  onApplied?: (change: {
    kind: 'move' | 'resize' | 'rotate' | 'scale'
    dx?: number
    dy?: number
    dw?: number
    dh?: number
    dr?: number
    fx?: number
    fy?: number
  }) => void
}

export type LibreAdapter = CsValueAdapter & {
  destroy: () => void
}

function readTranslate(el: HTMLElement): { x: number; y: number } {
  const raw = el.style.translate
  if (!raw || raw === 'none') return { x: 0, y: 0 }
  const parts = raw.split(/\s+/).map((part) => Number.parseFloat(part))
  return { x: parts[0] || 0, y: parts[1] || 0 }
}

function readPx(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function readLocalDims(node: HTMLElement): { w: number; h: number } {
  const computed = node.ownerDocument.defaultView?.getComputedStyle(node)
  const w = (computed ? readPx(computed.width) : 0) || node.offsetWidth
  const h = (computed ? readPx(computed.height) : 0) || node.offsetHeight
  return { w, h }
}

/**
 * Re-pins `translate`/`width`/`height` to explicit resolved px the instant a node is (re)captured
 * — never assumes the inline value is already px. A node freshly mounted by the player can carry
 * any CSS unit on these properties (e.g. `cqw`, written by the editor's own document); this
 * adapter's own delta math (`readTranslate`/`readPx` on the RAW inline string) only holds once the
 * inline value is unambiguously px, otherwise a later `current + rawDeltaPx` silently treats a
 * foreign unit's number as px — a real, confirmed double-conversion bug, not a hypothetical.
 * `getComputedStyle` always resolves to real px regardless of the declared unit, so it's the one
 * safe read for this one-time re-pin (never used for the running deltas themselves — those still
 * read the inline value, now guaranteed already px by this call).
 */
function pinToResolvedPx(node: HTMLElement): void {
  const computed = node.ownerDocument.defaultView?.getComputedStyle(node)
  if (!computed) return
  const translateRaw = computed.translate
  if (translateRaw && translateRaw !== 'none') {
    const parts = translateRaw.split(/\s+/).map((part) => Number.parseFloat(part))
    node.style.translate = `${parts[0] || 0}px ${parts[1] || 0}px`
  }
  if (node.style.width) node.style.width = `${readPx(computed.width)}px`
  if (node.style.height) node.style.height = `${readPx(computed.height)}px`
}

function parseOriginComponentPx(part: string | undefined, sizePx: number): number {
  if (part === undefined) return sizePx / 2
  const parsed = Number.parseFloat(part)
  if (!Number.isFinite(parsed)) return sizePx / 2
  return part.endsWith('%') ? (parsed / 100) * sizePx : parsed
}

/**
 * Moves the rotation origin while strictly preserving the visual pose.
 * Changing transform-origin on an already-transformed element re-applies the
 * current transform around the new point — the element jumps. Compensation:
 * delta = (I − M)·(O_prev − O_next) added to `translate`, with M the current
 * own linear matrix (rotate·scale·transform composed).
 */
function applyRotationOrigin(node: HTMLElement, origin: { fx: number; fy: number }): void {
  const { w, h } = readLocalDims(node)
  const prevParts = (node.style.transformOrigin || '').split(/\s+/).filter(Boolean)
  const prevX = parseOriginComponentPx(prevParts[0], w)
  const prevY = parseOriginComponentPx(prevParts[1], h)
  const nextX = origin.fx * w
  const nextY = origin.fy * h

  if (Math.abs(prevX - nextX) > 1e-6 || Math.abs(prevY - nextY) > 1e-6) {
    const m = captureNodeOwnMatrix(node)
    const vx = prevX - nextX
    const vy = prevY - nextY
    const deltaX = vx - (m.a * vx + m.c * vy)
    const deltaY = vy - (m.b * vx + m.d * vy)
    if (Math.abs(deltaX) > 1e-6 || Math.abs(deltaY) > 1e-6) {
      const current = readTranslate(node)
      node.style.translate = `${current.x + deltaX}px ${current.y + deltaY}px`
    }
  }

  node.style.transformOrigin = `${origin.fx * 100}% ${origin.fy * 100}%`
}

/**
 * Free-placement adapter: applies raw pixel deltas straight onto the element.
 */
export function createLibreAdapter(options: LibreAdapterOptions): LibreAdapter {
  const mode: LibreAdapterMode = options.mode ?? 'translate'
  let node: HTMLElement | null = null

  const unsubscribe = options.authorApi.subscribeToNode(options.itemId, (next) => {
    node = next instanceof HTMLElement ? next : null
    if (node !== null) pinToResolvedPx(node)
  })

  return {
    applyMove(raw: CsRawMoveDiff): void {
      if (node === null) return
      if (mode === 'translate') {
        const current = readTranslate(node)
        node.style.translate = `${current.x + raw.dx}px ${current.y + raw.dy}px`
      } else {
        node.style.left = `${readPx(node.style.left) + raw.dx}px`
        node.style.top = `${readPx(node.style.top) + raw.dy}px`
      }
      options.onApplied?.({ kind: 'move', dx: raw.dx, dy: raw.dy })
    },

    applyResize(raw: CsRawSizeDiff): void {
      if (node === null) return
      // Local dimensions from inline/computed styles and offsets — never from
      // getBoundingClientRect (transform-dependent AABB).
      const computed = node.ownerDocument.defaultView?.getComputedStyle(node)
      const baseWidth = readPx(node.style.width) || (computed ? readPx(computed.width) : 0) || node.offsetWidth
      const baseHeight = readPx(node.style.height) || (computed ? readPx(computed.height) : 0) || node.offsetHeight
      node.style.width = `${Math.max(0, baseWidth + raw.dw)}px`
      node.style.height = `${Math.max(0, baseHeight + raw.dh)}px`
      options.onApplied?.({ kind: 'resize', dw: raw.dw, dh: raw.dh })
    },

    applyRotate(raw: CsRawRotateDiff): void {
      if (node === null) return
      if (raw.origin !== undefined) {
        applyRotationOrigin(node, raw.origin)
      }
      const current = Number.parseFloat(node.style.rotate) || 0
      node.style.rotate = `${current + raw.dr}deg`
      options.onApplied?.({ kind: 'rotate', dr: raw.dr })
    },

    applyScale(raw: CsRawScaleDiff): void {
      if (node === null) return
      const parts = (node.style.scale === '' || node.style.scale === 'none' ? '1 1' : node.style.scale)
        .split(/\s+/)
        .map((part) => Number.parseFloat(part))
      const currentX = Number.isFinite(parts[0]) ? parts[0]! : 1
      const currentY = Number.isFinite(parts[1]) ? parts[1]! : currentX
      node.style.scale = `${currentX * raw.fx} ${currentY * raw.fy}`
      options.onApplied?.({ kind: 'scale', fx: raw.fx, fy: raw.fy })
    },

    destroy(): void {
      unsubscribe()
      node = null
    }
  }
}
