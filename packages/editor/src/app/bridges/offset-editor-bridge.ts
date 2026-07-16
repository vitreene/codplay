import type { LibreAdapter, TrackedSession } from '@codplay/selection-frame'
import type { OffsetEditorBridge, OffsetValuesPx } from '../../decor-editor/types'

/**
 * Pont offset — implémente `PositionEditorBridge` du spec `2026-07-07-dedit-spec.md` §6, renommé
 * `OffsetEditorBridge` (`project-offset-vs-position-naming` : `position` reste réservé au futur
 * placement en grille). dedit reste le seul interlocuteur de l'app pour le décor — ce pont est
 * construit une fois par `scene-player-bridge.ts` et publié via `context.offsetBridge`
 * (`2026-07-16-position-bridge-reconciliation-plan.md` §Étape A), jamais câblé en dur entre les
 * deux fichiers de pont.
 *
 * `OffsetEditorBridgeHandle` étend l'interface publique de deux méthodes réservées à son
 * propriétaire (`scene-player-bridge.ts`) — jamais exposées à dedit :
 * - `rebind` : reconnecte le pont sur la session/adaptateur de l'item actuellement sélectionné
 *   (ou `null` si rien n'est sélectionné) — le pont lui-même reste stable, un seul construit pour
 *   toute la durée de vie du pont scenePlayer.
 * - `notifyNow` : déclenché à chaque delta appliqué par `LibreAdapter` (son `onApplied`) — c'est
 *   le canal d'émission continue vers `onValues` (spec §4.3 : jamais de debounce à ce niveau).
 */

export type OffsetEditorBinding = {
  session: TrackedSession
  adapter: LibreAdapter
  itemId: string
  referenceWidthPx: () => number
}

export type OffsetEditorBridgeHandle = OffsetEditorBridge & {
  rebind(binding: OffsetEditorBinding | null): void
  notifyNow(): void
}

/** Même lecture que l'ancien `readCurrentOffsetPx` (`scene-player-bridge.ts`) — ne relit jamais un
 *  delta, seul l'état CSS final du node fait foi. `x`/`y` bruts (`style.translate`) sont exposés
 *  sous `translate` (`OffsetValuesPx.x`/`.y` sont un concept distinct, non encore câblé). */
function readOffsetValuesPx(node: HTMLElement): OffsetValuesPx {
  const translateRaw = node.style.translate
  const translateParts = translateRaw && translateRaw !== 'none' ? translateRaw.split(/\s+/).map(p => Number.parseFloat(p)) : []
  const computed = node.ownerDocument.defaultView?.getComputedStyle(node)
  const width = Number.parseFloat(node.style.width) || (computed ? Number.parseFloat(computed.width) : 0) || node.offsetWidth
  const height = Number.parseFloat(node.style.height) || (computed ? Number.parseFloat(computed.height) : 0) || node.offsetHeight
  const rotate = Number.parseFloat(node.style.rotate) || 0
  const scaleRaw = node.style.scale
  const scaleParts = scaleRaw && scaleRaw !== 'none' ? scaleRaw.split(/\s+/).map(p => Number.parseFloat(p)) : []
  const scaleX = Number.isFinite(scaleParts[0]) ? scaleParts[0]! : 1
  const scaleY = Number.isFinite(scaleParts[1]) ? scaleParts[1]! : scaleX
  return {
    translate: { x: translateParts[0] || 0, y: translateParts[1] || 0 },
    width,
    height,
    rotate,
    scale: { x: scaleX, y: scaleY },
  }
}

export function createOffsetEditorBridge(): OffsetEditorBridgeHandle {
  let binding: OffsetEditorBinding | null = null
  const valueListeners = new Set<(values: OffsetValuesPx) => void>()
  const gestureActiveListeners = new Set<(active: boolean) => void>()
  let unsubscribeSessionActivity: (() => void) | null = null
  let wasGestureActive = false

  const getActiveNode = (): HTMLElement | null => {
    if (binding === null || !binding.session.canAct()) return null
    const node = binding.session.getNode(binding.itemId)
    return node instanceof HTMLElement ? node : null
  }

  const notifyGestureActiveChange = (active: boolean): void => {
    if (active === wasGestureActive) return
    wasGestureActive = active
    for (const cb of gestureActiveListeners) cb(active)
  }

  return {
    activate() {
      // Seul 'transform' a un éditeur visuel intégré à l'app aujourd'hui ('position'/grille et
      // 'flex-anchor' existent côté selection-frame mais ne sont pas câblés dans ed2 — risque
      // documenté, `2026-07-16-position-bridge-reconciliation-plan.md` §5). Rien à faire tant
      // qu'aucun bouton de bascule de mode n'existe : le CS reste déjà entièrement visible/actif
      // dès la sélection, indépendamment de ce pont.
    },

    deactivate() {
      // Symétrique de `activate` — no-op tant qu'aucun mode alternatif n'est câblé.
    },

    apply(patch) {
      const node = getActiveNode()
      if (node === null || binding === null) return
      const current = readOffsetValuesPx(node)
      if (patch.translate !== undefined) {
        const cur = current.translate ?? { x: 0, y: 0 }
        binding.adapter.applyMove({ dx: patch.translate.x - cur.x, dy: patch.translate.y - cur.y })
      }
      if (patch.width !== undefined || patch.height !== undefined) {
        const dw = patch.width !== undefined ? patch.width - (current.width ?? 0) : 0
        const dh = patch.height !== undefined ? patch.height - (current.height ?? 0) : 0
        if (dw !== 0 || dh !== 0) binding.adapter.applyResize({ dw, dh })
      }
      if (patch.rotate !== undefined) {
        binding.adapter.applyRotate({ dr: patch.rotate - (current.rotate ?? 0) })
      }
      if (patch.scale !== undefined) {
        const cur = current.scale ?? { x: 1, y: 1 }
        binding.adapter.applyScale({
          fx: cur.x === 0 ? 1 : patch.scale.x / cur.x,
          fy: cur.y === 0 ? 1 : patch.scale.y / cur.y,
        })
      }
    },

    onValues(cb) {
      valueListeners.add(cb)
      return () => valueListeners.delete(cb)
    },

    containerRefWidthPx() {
      return binding?.referenceWidthPx() ?? 0
    },

    isGestureActive() {
      return binding?.session.isGestureActive() ?? false
    },

    onGestureActiveChange(cb) {
      gestureActiveListeners.add(cb)
      return () => gestureActiveListeners.delete(cb)
    },

    rebind(nextBinding) {
      unsubscribeSessionActivity?.()
      unsubscribeSessionActivity = null
      binding = nextBinding
      if (nextBinding !== null) {
        unsubscribeSessionActivity = nextBinding.session.subscribe(() => {
          notifyGestureActiveChange(nextBinding.session.isGestureActive())
        })
      } else {
        notifyGestureActiveChange(false)
      }
    },

    notifyNow() {
      const node = getActiveNode()
      if (node === null) return
      const values = readOffsetValuesPx(node)
      for (const cb of valueListeners) cb(values)
    },
  }
}
