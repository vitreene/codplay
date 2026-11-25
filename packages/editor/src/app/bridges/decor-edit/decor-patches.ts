import type { CodPlaySnapshot } from 'codplay'
import type { DecorPatch, OffsetPatch } from '../../../decor-editor/types'
import { modificationsFromDecorPatch, modificationsToDecorPatch } from '../../../decor-editor/modified-properties'
import { resolveKeyframeChannel } from '../../commands/types'
import type { Content, Decor, EditorScene, Item } from '../../commands/types'
import { mergePatch } from '../../../decor-editor/merge'
import { OFFSET_STYLE_PROPERTIES } from '../../../decor-editor/units'
import { hasExplicitPlacementGeometry } from '../../commands/offset-placement'
import { ITEM_MOTION_REFERENCE_ANGLE, ITEM_MOTION_ROTATION_BASELINE } from '../../../item-presentation/item-motion-reference'
import { resolveDecorLayers } from '../../../builder-v2/decor-resolution'
import { resolveInitialPathRotation } from '../../../motion-editor/item-rotation/item-rotation'
import { formatLogicalValue, readLogicalLength, readLogicalNumber, readRotationOrigin, snapshotItemState, snapshotItemStyle } from '../presentation-reading'
import { resolveDecorationKeyframeAlignment, sortPoseKeyframes, type Target } from './decor-target'

/** Decor patches read by the palette and the Selection Frame: authored cascade, presented snapshot and keyframe insertion. */

/** Resolves one pose keyframe's inherited zone assignment. */
export function resolveZoneIdAtPoseKeyframe(scene: EditorScene, item: Item, keyframeId: string): string | null {
  const content = item.contentId === null ? undefined : scene.contents[item.contentId]
  return resolveEffectiveKeyframePatch(scene, item, keyframeId, content).zoneId ?? null
}

/** Reads whether a pose keyframe follows its zone or explicit authored geometry. */
export function zonePlacementAtPoseKeyframe(scene: EditorScene, item: Item, keyframeId: string): string | null {
  const content = item.contentId === null ? undefined : scene.contents[item.contentId]
  const patch = resolveEffectivePosePatch(scene, item, keyframeId, content)
  return hasExplicitPlacementGeometry(patch.offset) ? null : patch.zoneId ?? null
}

/** Resolves the zone assignment inherited at one pose time from the initial decor and prior poses. */
export function resolveZoneIdAtTime(scene: EditorScene, item: Item, timelineMs: number): string | null {
  const keyframe = sortPoseKeyframes(item).filter((candidate) => candidate.timeMs <= timelineMs).at(-1)
  if (keyframe === undefined) return scene.decors[item.initialDecorId]?.zoneId ?? null
  return resolveZoneIdAtPoseKeyframe(scene, item, keyframe.id)
}

/** Identifies a pose time whose placement geometry is owned by a capsule zone target. */
export function itemUsesZonePlacement(scene: EditorScene, item: Item, timelineMs: number, keyframeId?: string | null): boolean {
  const selectedKeyframe = keyframeId === undefined || keyframeId === null
    ? undefined
    : item.keyframes.find((keyframe) => keyframe.id === keyframeId && resolveKeyframeChannel(keyframe) === 'pose')
  if (selectedKeyframe !== undefined) return zonePlacementAtPoseKeyframe(scene, item, selectedKeyframe.id) !== null
  const keyframe = sortPoseKeyframes(item).filter((candidate) => candidate.timeMs <= timelineMs).at(-1)
  if (keyframe !== undefined) return zonePlacementAtPoseKeyframe(scene, item, keyframe.id) !== null
  const content = item.contentId === null ? undefined : scene.contents[item.contentId]
  const initialDecor = scene.decors[item.initialDecorId]
  const initialPatch = resolveCurrentPatch(initialDecor ?? { id: item.initialDecorId }, content)
  return initialPatch.zoneId != null && !hasExplicitPlacementGeometry(initialPatch.offset)
}

/**
 * Décor temporaire — lecture depuis le snapshot logique V2 présenté, jamais depuis `scene.decors`
 * ou le DOM. Les propriétés absentes du snapshot sont complétées par la cascade documentaire
 * précédente ; aucune valeur physique n'est réinterprétée comme une valeur logique. Le parcours
 * est ouvert : chaque propriété effectivement fournie par le snapshot est transportée, y compris
 * une future propriété que la palette actuelle ne connaît pas encore.
 */
export function resolveTemporaryPatch(snapshot: CodPlaySnapshot | null, itemId: string): DecorPatch {
  const state = snapshotItemState(snapshot, itemId)
  if (!state) return {}
  const patch: DecorPatch = {}
  const stateRecord = state as Record<string, unknown>
  const styleState = stateRecord.style
  if (styleState && typeof styleState === 'object' && !Array.isArray(styleState)) {
    const style: Record<string, string> = {}
    for (const [property, raw] of Object.entries(styleState as Record<string, unknown>)) {
      if (OFFSET_STYLE_PROPERTIES.has(property)
        || property === ITEM_MOTION_REFERENCE_ANGLE
        || property === ITEM_MOTION_ROTATION_BASELINE) continue
      style[property] = formatLogicalValue(raw)
    }
    if (Object.keys(style).length > 0) patch.style = style
  }
  // Future runtime modules may expose resolved Decor groups directly beside `style`. Keep them
  // intact; only the known style pose aliases are translated to the editor's structured offset.
  for (const [property, value] of Object.entries(stateRecord)) {
    if (property === 'style' || property === 'editorFrameClassName') continue
    patch[property] = value
  }
  return patch
}

/**
 * Pose temporaire des champs structurés présents dans le snapshot V2. Un champ absent est complété
 * par `base`, jamais par un défaut arbitraire qui écraserait silencieusement l'héritage.
 */
export function resolveTemporaryOffset(
  snapshot: CodPlaySnapshot | null,
  itemId: string,
  base: DecorPatch,
): DecorPatch {
  const persoState = snapshotItemState(snapshot, itemId)?.style
  if (!persoState || typeof persoState !== 'object') return {}
  const style = snapshotItemStyle(snapshot, itemId)
  const x = readLogicalLength(style.x) ?? base.offset?.translate?.x
  const y = readLogicalLength(style.y) ?? base.offset?.translate?.y
  const width = readLogicalLength(style.width) ?? base.offset?.width
  const height = readLogicalLength(style.height) ?? base.offset?.height
  const rotate = readLogicalNumber(style.rotate) ?? base.offset?.rotate
  const scaleX = readLogicalNumber(style.scaleX) ?? base.offset?.scale?.x
  const scaleY = readLogicalNumber(style.scaleY) ?? base.offset?.scale?.y
  const rotationOrigin = readRotationOrigin(style['transform-origin']) ?? base.offset?.rotationOrigin

  const offset: OffsetPatch = {}
  if (x !== undefined || y !== undefined) offset.translate = { x: x ?? 0, y: y ?? 0 }
  if (width !== undefined) offset.width = width
  if (height !== undefined) offset.height = height
  if (rotate !== undefined) offset.rotate = rotate
  if (scaleX !== undefined || scaleY !== undefined) offset.scale = { x: scaleX ?? 1, y: scaleY ?? 1 }
  if (rotationOrigin !== undefined) offset.rotationOrigin = rotationOrigin
  return Object.keys(offset).length > 0 ? { offset } : {}
}

/**
 * `decor.zoneId` → `patch.zoneId` conserve l'identité stable de la zone dans tout le circuit.
 * `content.text`/`.textAutoSize` sont inclus ici (pas seulement le décor) : le panneau
 * « Contenu »/« Auto » de la palette doit refléter la valeur RÉELLEMENT posée à l'attache,
 * pas repartir vide alors que l'item porte déjà du texte.
 */
export function resolveCurrentPatch(decor: Decor, content: Content | undefined): DecorPatch {
  const patch: DecorPatch = {}
  if (decor.style !== undefined) patch.style = decor.style
  // Le modèle document accepte une chaîne ou un tableau ; le modèle décor accepte aussi
  // add/remove. Une valeur issue du document est déjà une valeur complète et reste donc une chaîne.
  if (decor.classes !== undefined) patch.classes = decor.classes as unknown as DecorPatch['classes']
  // Le document et le décor portent la même structure d'offset pour cette frontière.
  if (decor.offset !== undefined) patch.offset = decor.offset as unknown as OffsetPatch
  if (decor.custom !== undefined) patch.custom = decor.custom
  if (decor.zoneId !== undefined) patch.zoneId = decor.zoneId
  if (decor.path !== undefined) patch.path = decor.path
  if (content?.text !== undefined) patch.text = content.text
  if (content?.textAutoSize !== undefined) patch.textAutoSize = content.textAutoSize

  // Keep future Decor modules at the bridge boundary. Known document-only fields are converted
  // above; every other own property is copied without a palette whitelist.
  const knownProperties = new Set(['id', 'style', 'classes', 'offset', 'custom', 'zoneId', 'path', 'orientToPath'])
  const patchRecord = patch as Record<string, unknown>
  for (const [property, value] of Object.entries(decor as unknown as Record<string, unknown>)) {
    if (!knownProperties.has(property)) patchRecord[property] = value
  }
  return patch
}

/** Reads the segment-local path from a keyframe's own decor without inheriting a previous segment. */
export function resolveMotionPath(scene: EditorScene, item: Item, keyframeId: string): string | undefined {
  const keyframe = item.keyframes.find((candidate) => candidate.id === keyframeId)
  return keyframe === undefined || resolveKeyframeChannel(keyframe) !== 'pose' ? undefined : scene.decors[keyframe.decorId]?.path
}

/**
 * Décor effectif d'un keyframe, tel que la palette et le cadre l'éditent — recalculé à chaque
 * lecture, jamais mémorisé (`specs/decor-style-interpolation-spec.md`). Les couches viennent de la
 * cascade unique du Builder (`resolveDecorLayers`) : l'habillage traverse toutes les couches, la
 * pose seulement les KF de pose. Les deux groupes de champs sont disjoints, d'où leur fusion finale.
 */
export function resolveEffectiveKeyframePatch(
  scene: EditorScene,
  item: Item,
  keyframeId: string,
  content: Content | undefined,
): DecorPatch {
  const keyframe = item.keyframes.find((candidate) => candidate.id === keyframeId)
  const initial = scene.decors[item.initialDecorId] ?? { id: item.initialDecorId }
  if (!keyframe) return resolveCurrentPatch(initial, content)
  const decoration = resolveDecorLayers(scene, item, keyframe, 'decoration')
    .map((decor) => withoutPosePatch(resolveCurrentPatch(decor ?? { id: '' }, content)))
    .reduce((acc, patch) => mergePatch(acc, patch), {} as DecorPatch)
  return mergePatch(decoration, resolveEffectivePosePatch(scene, item, keyframeId, content))
}

/** Resolves only the pose payload at a keyframe, excluding decoration-only timeline points. */
export function resolveEffectivePosePatch(
  scene: EditorScene,
  item: Item,
  keyframeId: string,
  content?: Content,
): DecorPatch {
  const keyframe = item.keyframes.find((candidate) => candidate.id === keyframeId)
  const initial = scene.decors[item.initialDecorId] ?? { id: item.initialDecorId }
  if (keyframe === undefined) return withoutNonPosePatch(resolveCurrentPatch(initial, content))
  const patch = resolveDecorLayers(scene, item, keyframe, 'pose')
    .map((decor) => withoutNonPosePatch(resolveCurrentPatch(decor ?? { id: '' }, content)))
    .reduce((acc, patch) => mergePatch(acc, patch), {} as DecorPatch)
  return item.rotationMode === 'tangent'
    ? mergePatch(patch, { offset: { rotate: resolveInitialPathRotation(scene, item) } })
    : patch
}

/** Removes the structured pose group from a full decoration patch. */
export function withoutPosePatch(patch: DecorPatch): DecorPatch {
  const result = { ...patch }
  delete result.offset
  delete result.zoneId
  return result
}

/** Keeps explicit geometry and zone assignment in the keyframe's spatial pose cascade. */
export function withoutNonPosePatch(patch: DecorPatch): DecorPatch {
  return {
    ...(patch.offset === undefined ? {} : { offset: patch.offset }),
    ...(patch.zoneId === undefined ? {} : { zoneId: patch.zoneId }),
  }
}

/**
 * Décor à consigner pour un NOUVEAU keyframe inséré à `timelineMs` sur `item` — `null` si rien à
 * consigner (pas entre deux keyframes réels, ou état résolu identique à la cascade : le keyframe
 * peut alors partager le décor adjacent). Non-null lorsque l'état affiché diverge de la cascade.
 *
 * Le snapshot présente l'état courant mais ne devient jamais une écriture documentaire implicite :
 * seul le candidat sparse issu de la map des propriétés modifiées est persisté ; une valeur
 * interpolée non touchée reste absente du nouveau décor et continue à cascader.
 */
export function resolveKeyframeInsertionPatch(
  scene: EditorScene,
  item: Item,
  timelineMs: number,
  content: Content | undefined,
  /** Candidat accepté par la preview — `snapshot.get()` l'exclut, il n'est donc lu qu'ici. */
  livePatch?: DecorPatch,
): DecorPatch | null {
  const alignment = resolveDecorationKeyframeAlignment(item, timelineMs)
  if (alignment.kind !== 'between') return null
  const base = resolveEffectiveKeyframePatch(scene, item, alignment.prevKeyframeId, content)
  if (livePatch === undefined) return null
  const modifications = modificationsFromDecorPatch(base, livePatch)
  return modifications.size > 0 ? modificationsToDecorPatch(modifications) : null
}

/** Resolves only the persisted author cascade, excluding live snapshot geometry and preview CSS. */
export function resolveDocumentDecorBase(scene: EditorScene, target: Target, timeMs: number): DecorPatch {
  const item = scene.items.find((candidate) => candidate.id === target.itemId)
  if (item === undefined) return {}
  const content = target.contentId === null ? undefined : scene.contents[target.contentId]
  const keyframe = target.keyframeId === null
    ? undefined
    : item.keyframes.find((candidate) => candidate.id === target.keyframeId)
  if (keyframe !== undefined) return resolveEffectiveKeyframePatch(scene, item, keyframe.id, content)
  if (!target.isTemporary && target.keyframeId === null) {
    return resolveCurrentPatch(scene.decors[target.writeDecorId!] ?? { id: target.writeDecorId! }, content)
  }
  const alignment = resolveDecorationKeyframeAlignment(item, timeMs)
  return alignment.kind === 'between'
    ? resolveEffectiveKeyframePatch(scene, item, alignment.prevKeyframeId, content)
    : resolveCurrentPatch(scene.decors[item.initialDecorId] ?? { id: item.initialDecorId }, content)
}
