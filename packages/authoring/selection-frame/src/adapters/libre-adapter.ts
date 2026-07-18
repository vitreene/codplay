import type { AuthorApi } from '../author-api'
import { captureNodeOwnMatrix } from '../overlay-pose'
import { createMinimalAnchor, type TrackedTarget } from '../tracked-session'
import type { CsRawMoveDiff, CsRawRotateDiff, CsRawScaleDiff, CsRawSizeDiff, CsValueAdapter } from '../types'

export type LibreAdapterMode = 'translate' | 'top-left'

export type LibreAdapterOptions = {
  authorApi: AuthorApi
  itemId: string
  /**
   * Shares the node-tracking anchor with another module watching the same
   * `itemId` (typically `SelectionFrame`, co-constructed by the same caller
   * — `2026-07-16-authoring-shared-tracking-layer-plan.md` §3, Étape 2:
   * "une seule session... transmise aux deux" instead of two independent
   * `subscribeToNode` calls on the same id). Built internally when absent
   * (standalone/test usage) — either way this adapter never owns/destroys an
   * anchor it didn't build itself (see `destroy()`).
   */
  anchor?: TrackedTarget
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
  /** Relayed straight through to `CsValueAdapter.onCommit` — see that field's own doc. */
  onCommit?: (kind: 'move' | 'resize' | 'rotate' | 'scale') => void
}

export type LibreAdapter = CsValueAdapter & {
  destroy: () => void
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
 * own linear matrix (rotate·scale·transform composed). `transformOrigin`
 * itself stays a direct style write — outside anime.js's pose vocabulary
 * (`x`/`y`/`rotate`/`scaleX`/`scaleY`/`width`/`height`), never composed into
 * `transform`, so no conflict with `AuthorApi.setNodePose` exists here. The
 * translate compensation, however, must go through `getNodePose`/
 * `setNodePose` like every other pose read/write in this adapter.
 */
function applyRotationOrigin(authorApi: AuthorApi, itemId: string, node: HTMLElement, origin: { fx: number; fy: number }): void {
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
      const pose = authorApi.getNodePose(itemId)
      if (pose !== null) {
        authorApi.setNodePose(itemId, { x: pose.x + deltaX, y: pose.y + deltaY })
      }
    }
  }

  node.style.transformOrigin = `${origin.fx * 100}% ${origin.fy * 100}%`
}

/**
 * Free-placement adapter: applies raw pixel deltas straight onto the element.
 * Node lifecycle and the "safe to act" decision come from the shared
 * ancrage minimal (`tracked-session.ts` — `2026-07-16-authoring-shared-
 * tracking-layer-plan.md` §2.1): this adapter has no gesture of its own to
 * declare, only a question to ask (`canAct()`) before each apply call —
 * replaces this file's own former `node`/`subscribeToNode` closure.
 */
export function createLibreAdapter(options: LibreAdapterOptions): LibreAdapter {
  const mode: LibreAdapterMode = options.mode ?? 'translate'
  const ownsAnchor = options.anchor === undefined
  const anchor = options.anchor ?? createMinimalAnchor({ authorApi: options.authorApi, persoIds: [options.itemId] })

  const getActiveNode = (): HTMLElement | null => {
    if (!anchor.canAct()) return null
    const node = anchor.getNode(options.itemId)
    return node instanceof HTMLElement ? node : null
  }

  return {
    applyMove(raw: CsRawMoveDiff): void {
      const node = getActiveNode()
      if (node === null) return
      if (mode === 'translate') {
        const pose = options.authorApi.getNodePose(options.itemId)
        if (pose === null) return
        options.authorApi.setNodePose(options.itemId, { x: pose.x + raw.dx, y: pose.y + raw.dy })
      } else {
        node.style.left = `${readPx(node.style.left) + raw.dx}px`
        node.style.top = `${readPx(node.style.top) + raw.dy}px`
      }
      options.onApplied?.({ kind: 'move', dx: raw.dx, dy: raw.dy })
    },

    applyResize(raw: CsRawSizeDiff): void {
      const node = getActiveNode()
      if (node === null) return
      const pose = options.authorApi.getNodePose(options.itemId)
      if (pose === null) return
      options.authorApi.setNodePose(options.itemId, {
        width: Math.max(0, pose.width + raw.dw),
        height: Math.max(0, pose.height + raw.dh)
      })
      options.onApplied?.({ kind: 'resize', dw: raw.dw, dh: raw.dh })
    },

    applyRotate(raw: CsRawRotateDiff): void {
      const node = getActiveNode()
      if (node === null) return
      if (raw.origin !== undefined) {
        applyRotationOrigin(options.authorApi, options.itemId, node, raw.origin)
      }
      const pose = options.authorApi.getNodePose(options.itemId)
      if (pose === null) return
      options.authorApi.setNodePose(options.itemId, { rotate: pose.rotate + raw.dr })
      options.onApplied?.({ kind: 'rotate', dr: raw.dr })
    },

    applyScale(raw: CsRawScaleDiff): void {
      const node = getActiveNode()
      if (node === null) return
      const pose = options.authorApi.getNodePose(options.itemId)
      if (pose === null) return
      options.authorApi.setNodePose(options.itemId, { scaleX: pose.scaleX * raw.fx, scaleY: pose.scaleY * raw.fy })
      options.onApplied?.({ kind: 'scale', fx: raw.fx, fy: raw.fy })
    },

    onCommit(kind): void {
      options.onCommit?.(kind)
    },

    destroy(): void {
      // Only tear down an anchor this adapter built itself — a shared anchor
      // (options.anchor) is owned by whoever constructed it (typically the
      // same caller that also handed it to SelectionFrame) and outlives this
      // adapter's own destroy().
      if (ownsAnchor) anchor.destroy()
    }
  }
}
