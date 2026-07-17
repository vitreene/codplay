import type { AuthorApi, LibreAdapter, NodePose, TrackedSession } from '@codplay/selection-frame'
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
  authorApi: AuthorApi
  itemId: string
  referenceWidthPx: () => number
}

/** Composant manipulé — vocabulaire de `LibreAdapter.onApplied`'s `change.kind`. */
export type OffsetGestureKind = 'move' | 'resize' | 'rotate' | 'scale'

export type OffsetEditorBridgeHandle = OffsetEditorBridge & {
  rebind(binding: OffsetEditorBinding | null): void
  /**
   * `kind` — composant que ce delta vient de manipuler (`2026-07-17-phase-commit-selection-
   * recovery-plan.md` §Étape C, « props intouchées ») : accumulé dans l'ensemble des composants
   * manipulés depuis le dernier `rebind` (une phase committée en repart à zéro, cf. étape A qui
   * fait suivre chaque rebuild réel d'un `rebind`). `onValues` n'émet alors QUE ces composants —
   * un move seul ne fige plus `width`/`height`/`rotate`/`scale` dans l'écart.
   */
  notifyNow(kind: OffsetGestureKind): void
}

/** `NodePose` (`AuthorApi.getNodePose`) → `OffsetValuesPx` — pur remappage de forme, aucune
 *  relecture DOM ici : `v1-author-api-spec.md` §"anime.js comme unique source de vérité de la
 *  pose" interdit à tout module authoring de re-décoder `style`/`getComputedStyle` pour déduire
 *  une pose — seul `getNodePose` (symétrique de `utils.set` côté codplay, via `utils.get`) le
 *  fait correctement, y compris après un remplacement de nœud (rebuild). */
function nodePoseToOffsetValuesPx(pose: NodePose): OffsetValuesPx {
  return {
    translate: { x: pose.x, y: pose.y },
    width: pose.width,
    height: pose.height,
    rotate: pose.rotate,
    scale: { x: pose.scaleX, y: pose.scaleY },
  }
}

/**
 * EXCEPTION TEMPORAIRE à "anime.js comme unique source de vérité de la pose" — pendant un
 * geste CS en cours, c'est `LibreAdapter` lui-même qui écrit la pose (propriétés CSS discrètes
 * brutes, `style.translate`/`.rotate`/`.scale`), entièrement hors du `utils.set` d'anime — le
 * cache d'anime (`getNodePose`) ne voit donc rien de ce geste tant qu'il n'y a pas eu de
 * commit+rebuild. Confirmé en direct (2026-07-16) : `getNodePose` reste figé à `{x:0,y:0}`
 * pendant tout un drag alors que `style.translate` suit correctement `"60px -45px"`.
 *
 * Ne fermer ce trou qu'en faisant écrire `LibreAdapter` via le même module partagé qu'anime
 * (chantier 3/6, `packages/codplay/plan/notes/2026-07-16-anime-js-native-substitution-
 * chantiers.md`) — à ce moment cette fonction et la branche `isGestureActive()` de
 * `readActivePose` doivent être supprimées, `getNodePose` devenant correct sans exception.
 */
function readLiveGestureNodePose(node: HTMLElement): OffsetValuesPx {
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

/** `kind` → sous-ensemble de `OffsetValuesPx` qu'il autorise à traverser vers l'écart. */
function restrictToManipulated(values: OffsetValuesPx, kinds: ReadonlySet<OffsetGestureKind>): OffsetValuesPx {
  const restricted: OffsetValuesPx = {}
  if (kinds.has('move') && values.translate !== undefined) restricted.translate = values.translate
  if (kinds.has('resize')) {
    if (values.width !== undefined) restricted.width = values.width
    if (values.height !== undefined) restricted.height = values.height
  }
  if (kinds.has('rotate') && values.rotate !== undefined) restricted.rotate = values.rotate
  if (kinds.has('scale') && values.scale !== undefined) restricted.scale = values.scale
  return restricted
}

export function createOffsetEditorBridge(): OffsetEditorBridgeHandle {
  let binding: OffsetEditorBinding | null = null
  const valueListeners = new Set<(values: OffsetValuesPx) => void>()
  const gestureActiveListeners = new Set<(active: boolean) => void>()
  let unsubscribeSessionActivity: (() => void) | null = null
  let wasGestureActive = false
  /** Composants manipulés depuis le dernier `rebind` (§Étape C) — vidé à chaque rebind, jamais pendant une phase en cours. */
  const manipulatedKinds = new Set<OffsetGestureKind>()

  /**
   * Gate via `session.canAct()` (santé de la session — connexion + non-suspendue). Pose lue via
   * `authorApi.getNodePose` (jamais une relecture DOM, cf. `nodePoseToOffsetValuesPx`) — SAUF
   * pendant un geste CS actif, où `readLiveGestureNodePose` prend le relais (voir son
   * commentaire — exception temporaire, à supprimer avec le chantier 3/6).
   */
  const readActivePose = (): OffsetValuesPx | null => {
    if (binding === null || !binding.session.canAct()) return null
    if (binding.session.isGestureActive()) {
      const node = binding.session.getNode(binding.itemId)
      return node instanceof HTMLElement ? readLiveGestureNodePose(node) : null
    }
    const pose = binding.authorApi.getNodePose(binding.itemId)
    return pose === null ? null : nodePoseToOffsetValuesPx(pose)
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
      const current = readActivePose()
      if (current === null || binding === null) return
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
      manipulatedKinds.clear()
      if (nextBinding !== null) {
        unsubscribeSessionActivity = nextBinding.session.subscribe(() => {
          notifyGestureActiveChange(nextBinding.session.isGestureActive())
        })
      } else {
        notifyGestureActiveChange(false)
      }
    },

    notifyNow(kind) {
      manipulatedKinds.add(kind)
      const values = readActivePose()
      if (values === null) return
      const restricted = restrictToManipulated(values, manipulatedKinds)
      for (const cb of valueListeners) cb(restricted)
    },
  }
}
