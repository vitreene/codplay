import type { AuthorApi, NodePose } from '../author-api'
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
 * Seeds `translate`/`rotate`/`scale`/`width`/`height` as explicit resolved px/deg/factor the
 * instant a node is (re)captured — from `getNodePose`, never from `getComputedStyle`. codplay
 * resolves the authored pose via anime.js (`utils.set`), which freely picks its own DOM
 * representation (discrete properties or a composed `transform`) — not a stable contract. Only
 * anime.js itself (`utils.get`, what `getNodePose` calls) is guaranteed to read back what it
 * actually wrote; reconstructing from `getComputedStyle` drifts silently, in two confirmed ways:
 * a value in a foreign unit (e.g. `cqw`) read as if it were already px (the original
 * double-conversion bug this replaced), and — the harder one — a rotation anime composed only
 * into `transform` reading back as 0 from the discrete `rotate` property on a fresh node after a
 * rebuild, silently dropped by the next gesture that doesn't itself touch rotation (e.g. a plain
 * move). `getNodePose` is symmetric with anime's own write, so neither failure mode exists here.
 *
 * Clears `transform` before seeding: the fresh node may still carry anime's own composed
 * `transform` holding this exact pose — leaving it in place while also seeding the same values as
 * discrete `translate`/`rotate`/`scale` would compose the two and apply the pose twice. From this
 * point on the node's pose is exclusively expressed via the discrete properties, matching every
 * other write in this adapter (`applyMove`/`applyResize`/`applyRotate`/`applyScale`).
 *
 * The caller (the tracked anchor's `subscribe`, below) gates every call on `canAct()` — never called
 * while the node is absent or not yet connected.
 */
function seedResolvedPose(node: HTMLElement, pose: NodePose): void {
  node.style.transform = 'none'
  node.style.translate = `${pose.x}px ${pose.y}px`
  node.style.rotate = `${pose.rotate}deg`
  node.style.scale = `${pose.scaleX} ${pose.scaleY}`
  node.style.width = `${pose.width}px`
  node.style.height = `${pose.height}px`
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

  const unsubscribe = anchor.subscribe(() => {
    const node = getActiveNode()
    if (node === null) return
    const pose = options.authorApi.getNodePose(options.itemId)
    if (pose !== null) seedResolvedPose(node, pose)
  })

  return {
    applyMove(raw: CsRawMoveDiff): void {
      const node = getActiveNode()
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
      const node = getActiveNode()
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
      const node = getActiveNode()
      if (node === null) return
      if (raw.origin !== undefined) {
        applyRotationOrigin(node, raw.origin)
      }
      const current = Number.parseFloat(node.style.rotate) || 0
      node.style.rotate = `${current + raw.dr}deg`
      options.onApplied?.({ kind: 'rotate', dr: raw.dr })
    },

    applyScale(raw: CsRawScaleDiff): void {
      const node = getActiveNode()
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
      // Only tear down an anchor this adapter built itself — a shared anchor
      // (options.anchor) is owned by whoever constructed it (typically the
      // same caller that also handed it to SelectionFrame) and outlives this
      // adapter's own destroy().
      if (ownsAnchor) anchor.destroy()
    }
  }
}
