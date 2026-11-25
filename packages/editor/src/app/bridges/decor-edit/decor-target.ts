import { resolveKeyframeChannel } from '../../commands/types'
import type { EditorScene, Item } from '../../commands/types'
import type { Selection } from '../../controller/types'
import { resolveMotionKeyframeAlignment, type MotionKeyframeAlignment } from '../../../motion-editor/timing'

/** Target of a Decor edit: the selected item, its keyframe alignment and the decor it writes. */

export type ItemVisualType = 'bloc' | 'text' | 'image' | 'media' | 'video' | 'capsule'

/**
 * `keyframeId: null` + `isTemporary: false` = décor initial de l'item (`initialDecorId`), comme
 * avant ce chantier. `keyframeId` non nul = décor RÉEL d'un keyframe (sélectionné explicitement OU
 * déduit de l'alignement playhead — les deux s'écrivent pareil, `2026-07-17-resolved-state-at-
 * time-notes.md`, « initialDecorId ≈ kf1 »). `isTemporary: true` = aucun décor réel ne correspond
 * à l'instant courant (entre deux kf) : il n'y a pas encore de cible documentaire, mais la cible
 * reste éditable par preview V2. Son candidat est conservé par la coordination jusqu'à la création
 * d'un keyframe, qui est le seul acte le rendant persistant.
 */
export type Target = {
  itemId: string
  keyframeId: string | null
  contentId: string | null
  /** `null` seulement quand `isTemporary` — la preview est alors hors document. */
  writeDecorId: string | null
  itemType: ItemVisualType
  isTemporary: boolean
}

/** Returns the keyframes that define the item's spatial chain in temporal order. */
export function sortPoseKeyframes(item: Item): Item['keyframes'] {
  return [...item.keyframes]
    .filter((keyframe) => resolveKeyframeChannel(keyframe) === 'pose')
    .sort((left, right) => left.timeMs - right.timeMs)
}

/** Resolves the selected document item and its active decor target, including an undecorated block. */
export function resolveTarget(scene: EditorScene, selection: Selection, timelineMs: number): Target | null {
  const itemId = selection.itemIds[0]
  if (!itemId) return null
  const item = scene.items.find((i) => i.id === itemId)
  if (!item) return null

  if (selection.keyframeId) {
    const decorId = item.keyframes.find((k) => k.id === selection.keyframeId)?.decorId
    if (!decorId) return null
    return { itemId: item.id, keyframeId: selection.keyframeId, contentId: item.contentId, writeDecorId: decorId, itemType: item.type, isTemporary: false }
  }

  // Pas de keyframe explicitement sélectionné — déduit de l'alignement de la tête de lecture
  // (`resolveKeyframeAlignment`) plutôt que de retomber systématiquement sur `initialDecorId`,
  // qui ne correspond à l'instant courant que si la tête est AVANT le premier keyframe.
  const alignment = resolveDecorationKeyframeAlignment(item, timelineMs)
  if (alignment.kind === 'before-first' || alignment.kind === 'no-keyframes') {
    return { itemId: item.id, keyframeId: null, contentId: item.contentId, writeDecorId: item.initialDecorId, itemType: item.type, isTemporary: false }
  }
  if (alignment.kind === 'between') {
    return { itemId: item.id, keyframeId: null, contentId: item.contentId, writeDecorId: null, itemType: item.type, isTemporary: true }
  }
  const decorId = item.keyframes.find((k) => k.id === alignment.keyframeId)?.decorId
  if (!decorId) return null
  return { itemId: item.id, keyframeId: alignment.keyframeId, contentId: item.contentId, writeDecorId: decorId, itemType: item.type, isTemporary: false }
}

export type KeyframeAlignment = MotionKeyframeAlignment

/**
 * Où se trouve `timelineMs` par rapport aux keyframes de l'item — `2026-07-17-resolved-state-at-
 * time-notes.md`. `exact`/`after-last` se résolvent depuis le document (cascade, comme un kf
 * explicitement sélectionné — même résultat, `initialDecorId ≈ kf1`) ; seul `between` a besoin
 * d'une lecture live (aucun décor réel ne correspond à un instant interpolé).
 */
export function resolveKeyframeAlignment(item: Item, timelineMs: number): KeyframeAlignment {
  return resolveMotionKeyframeAlignment(item.keyframes.filter((keyframe) => resolveKeyframeChannel(keyframe) === 'pose'), timelineMs)
}

/** Resolves the playhead against the combined decoration event chain. */
export function resolveDecorationKeyframeAlignment(item: Item, timelineMs: number): KeyframeAlignment {
  return resolveMotionKeyframeAlignment(item.keyframes, timelineMs)
}
