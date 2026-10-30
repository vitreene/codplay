import type { Actor } from 'xstate'
import type { CodPlaySnapshot, CodPlaySnapshotPatch } from 'codplay'
import type { MotionEasing } from '../../motion-editor/easing'
import { resolveMotionEaseProgress } from '../../motion-editor/easing'
import { createRotationModifier, createSelectionFrameV2 } from '@codplay/selection-frame/v2'
import type {
  SelectionFrameDelta,
  SelectionFrameHandleId,
  SelectionFrameV2CreationResult,
  SelectionFrameV2Handle,
} from '@codplay/selection-frame/v2'
import { DecorEditorController } from '../../decor-editor/controller'
import { mountDecorEditor } from '../../decor-editor/mount'
import { DEFAULT_PALETTE, DEFAULT_PRESETS } from '../../decor-editor/default-palette'
import type { DecorEditorCatalogs } from '../../decor-editor/controller'
import type { DecorEditorMountHandle } from '../../decor-editor/mount'
import type { DecorPatch, OffsetPatch, SelectionFrameValue } from '../../decor-editor/types'
import {
  applyDecorPatch,
  applyDecorModifications,
  collectDecorModifications,
  modificationsFromDecorPatch,
  modificationsToDecorPatch,
} from '../../decor-editor/modified-properties'
import type { DecorModificationMap } from '../../decor-editor/modified-properties'
import { resolveKeyframeChannel } from '../commands/types'
import type { Content, Decor, EditorScene, Item, ItemType, OffsetData, RootPlacementMode } from '../commands/types'
import { ROOT_PLACEMENT_GRID, rootPlacementModeForScene } from '../commands/root-placement-commands'
import type { Command, Selection } from '../controller/types'
import type { controllerMachine } from '../controller/controller-machine'
import type { BridgeHandle } from './types'
import { mergePatch } from '../../decor-editor/merge'
import { cqwToPx, offsetValuesPxToPatch, pxToCqw, OFFSET_STYLE_PROPERTIES } from '../../decor-editor/units'
// Read the stable identifier without importing the builder barrel: the latter also loads the
// optional `ace` compiler, which is not needed by this authoring bridge or its pure tests.
import { EDITOR_V2_ROOT_PERSO_ID, EDITOR_V2_STORY_ID } from '../../builder-v2/types'
import { resolveDecorationStyleAtTime } from '../../builder-v2/decor-resolution'
import { motionVisualPersoId as getMotionVisualPersoId } from '../../builder-v2/motion-visual-id'
import { createMotionOverlay } from '../../motion-editor/overlay'
import type { MotionOverlayGhost, MotionOverlayHandle, MotionOverlayRole, MotionOverlaySegment } from '../../motion-editor/overlay'
import { createMotionGeometryStore } from '../../motion-editor/geometry-store'
import {
  frameWithRotationAtPathAnchor,
  midpoint,
  motionControlFromPath,
  motionPathTangentAngle,
  motionPathAnchorForFrame,
  resolveMotionGeometryPose,
  frameWithTangentAtPathAnchor,
  presentationBorderBoxPoseToContentFrame,
  presentationPoseToSelectionFrame,
  splitMotionPath,
  type MotionGeometryPose,
} from '../../motion-editor/geometry'
import {
  contentBoxFrameToPoseFrame,
  poseFrameToContentBoxFrame,
  ZERO_CONTENT_BOX_INSETS_PX,
} from '../../motion-editor/content-box'
import { resolveBorderInsetsPx, type FrameBorderInsetsPx } from '../../motion-editor/border-insets'
import {
  resolveMotionKeyframeAlignment,
  type MotionKeyframeAlignment,
} from '../../motion-editor/timing'

/**
 * Pont `decorEditor` — `2026-07-13-controller-islands-bridge-plan.md` §3.2. `defaults`/`chain`
 * restent vides : aucune chaîne d'héritage (capsule/zone) n'est modélisée côté document
 * aujourd'hui — `patch` porte donc, à lui seul, le décor résolu.
 */

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
type Target = {
  itemId: string
  keyframeId: string | null
  contentId: string | null
  /** `null` seulement quand `isTemporary` — la preview est alors hors document. */
  writeDecorId: string | null
  itemType: ItemVisualType
  isTemporary: boolean
}

/** Ephemeral source/target projection kept by the decor bridge after one motion drop. */
type ActiveMotion = Readonly<{
  itemId: string
  sourceKeyframeId: string
  targetKeyframeId: string
  sourceTimeMs: number
  targetTimeMs: number
  ease: MotionEasing
  path?: string
  orientToPath?: boolean
  role: MotionOverlayRole
}>

type MotionEndpointProjection = Readonly<{
  geometry: MotionGeometryPose
  insets: FrameBorderInsetsPx
  authorFrame: SelectionFrameValue
}>

/** Returns the keyframes that define the item's spatial chain in temporal order. */
function sortPoseKeyframes(item: Item): Item['keyframes'] {
  return [...item.keyframes]
    .filter((keyframe) => resolveKeyframeChannel(keyframe) === 'pose')
    .sort((left, right) => left.timeMs - right.timeMs)
}

/** Resolves the selected document item and its active decor target, including an undecorated block. */
function resolveTarget(scene: EditorScene, selection: Selection, timelineMs: number): Target | null {
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
function resolveDecorationKeyframeAlignment(item: Item, timelineMs: number): KeyframeAlignment {
  return resolveMotionKeyframeAlignment(item.keyframes, timelineMs)
}

/**
 * Décor temporaire — lecture depuis le snapshot logique V2 présenté, jamais depuis `scene.decors`
 * ou le DOM. Les propriétés absentes du snapshot sont complétées par la cascade documentaire
 * précédente ; aucune valeur physique n'est réinterprétée comme une valeur logique. Le parcours
 * est ouvert : chaque propriété effectivement fournie par le snapshot est transportée, y compris
 * une future propriété que la palette actuelle ne connaît pas encore.
 */
export function resolveTemporaryPatch(snapshot: CodPlaySnapshot | null, itemId: string, visualPersoId?: string): DecorPatch {
  const state = snapshotState(snapshot, itemId, visualPersoId)
  if (!state) return {}
  const patch: DecorPatch = {}
  const stateRecord = state as Record<string, unknown>
  const styleState = stateRecord.style
  if (styleState && typeof styleState === 'object' && !Array.isArray(styleState)) {
    const style: Record<string, string> = {}
    for (const [property, raw] of Object.entries(styleState as Record<string, unknown>)) {
      if (OFFSET_STYLE_PROPERTIES.has(property)) continue
      style[property] = formatSnapshotValue(raw)
    }
    if (Object.keys(style).length > 0) patch.style = style
  }
  // Future runtime modules may expose resolved Decor groups directly beside `style`. Keep them
  // intact; only the known style pose aliases are translated to the editor's structured offset.
  for (const [property, value] of Object.entries(stateRecord)) {
    if (property === 'style') continue
    patch[property] = value
  }
  return patch
}

/**
 * Pose temporaire des champs structurés présents dans le snapshot V2. Un champ absent est complété
 * par `base`, jamais par un défaut arbitraire qui écraserait silencieusement l'héritage.
 */
function resolveTemporaryOffset(
  snapshot: CodPlaySnapshot | null,
  itemId: string,
  base: DecorPatch,
  rootWidthPx: number | null,
  visualPersoId?: string,
): DecorPatch {
  const state = snapshotState(snapshot, itemId, visualPersoId)
  const persoState = state?.style
  if (!persoState || typeof persoState !== 'object') return {}
  const parseCqw = (raw: unknown): number | undefined => {
    if (raw === undefined) return undefined
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const value = (raw as Record<string, unknown>).value
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined
    }
    const parsed = typeof raw === 'number' ? raw : Number.parseFloat(String(raw))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  const style = persoState as Record<string, unknown>
  let x = parseCqw(style.x) ?? base.offset?.translate?.x
  let y = parseCqw(style.y) ?? base.offset?.translate?.y
  const width = parseCqw(style.width) ?? base.offset?.width
  const height = parseCqw(style.height) ?? base.offset?.height
  const rotate = parseCqw(style.rotate) ?? base.offset?.rotate
  const scaleX = parseCqw(style.scaleX) ?? base.offset?.scale?.x
  const scaleY = parseCqw(style.scaleY) ?? base.offset?.scale?.y
  const rotationOrigin = parseRotationOrigin(style['transform-origin']) ?? base.offset?.rotationOrigin

  // The live snapshot exposes the runtime border-box `x/y`, while the temporary Decor base must
  // remain content-box anchored. Normalize that base before the sparse user edit is compared;
  // otherwise a border-only edit makes the editor believe the interpolated pose itself changed
  // and the next sync puts the Selection Frame back on the source endpoint.
  if (rootWidthPx !== null && x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
    const runtimeFrame: SelectionFrameValue = {
      x: cqwToPx(x, rootWidthPx),
      y: cqwToPx(y, rootWidthPx),
      width: cqwToPx(width, rootWidthPx),
      height: cqwToPx(height, rootWidthPx),
      rotate: rotate ?? 0,
      scaleX: scaleX ?? 1,
      scaleY: scaleY ?? 1,
      rotationOrigin,
    }
    const contentFrame = poseFrameToContentBoxFrame(
      runtimeFrame,
      resolveBorderInsetsPx(style, rootWidthPx),
    )
    x = pxToCqw(contentFrame.x, rootWidthPx)
    y = pxToCqw(contentFrame.y, rootWidthPx)
  }
  const offset: OffsetPatch = {}
  if (x !== undefined || y !== undefined) offset.translate = { x: x ?? 0, y: y ?? 0 }
  if (width !== undefined) offset.width = width
  if (height !== undefined) offset.height = height
  if (rotate !== undefined) offset.rotate = rotate
  if (scaleX !== undefined || scaleY !== undefined) offset.scale = { x: scaleX ?? 1, y: scaleY ?? 1 }
  if (rotationOrigin !== undefined) offset.rotationOrigin = rotationOrigin
  return Object.keys(offset).length > 0 ? { offset } : {}
}

/** Returns the selected item state from a CodPlay V2 snapshot. */
function snapshotState(
  snapshot: CodPlaySnapshot | null,
  itemId: string,
  visualPersoId?: string,
): Record<string, unknown> | null {
  const hostState = snapshot?.states.find((entry) => entry.target.persoId === itemId)?.state
  if (visualPersoId === undefined) return hostState ?? null
  const visualState = snapshot?.states.find((entry) => entry.target.persoId === visualPersoId)?.state
  if (hostState === undefined) return visualState ?? null
  if (visualState === undefined) return hostState
  const hostStyle = hostState.style
  const visualStyle = visualState.style
  return {
    ...visualState,
    ...hostState,
    ...(visualStyle !== null && typeof visualStyle === 'object' && !Array.isArray(visualStyle)
      || hostStyle !== null && typeof hostStyle === 'object' && !Array.isArray(hostStyle)
      ? {
        style: {
          ...(hostStyle !== null && typeof hostStyle === 'object' && !Array.isArray(hostStyle)
            ? hostStyle as Record<string, unknown>
            : {}),
          ...(visualStyle !== null && typeof visualStyle === 'object' && !Array.isArray(visualStyle)
            ? visualStyle as Record<string, unknown>
            : {}),
        },
      }
      : {}),
  }
}

/** Resolves the generated visual child id for a path-backed item, matching the scene builder. */
function motionVisualIdForItem(scene: EditorScene | null, itemId: string): string | undefined {
  const item = scene?.items.find((candidate) => candidate.id === itemId)
  if (scene === null || item === undefined) return undefined
  const poseKeyframes = item.keyframes
    .filter((keyframe) => resolveKeyframeChannel(keyframe) === 'pose')
    .sort((left, right) => left.timeMs - right.timeMs)
  const hasMotionPath = poseKeyframes.slice(1).some((keyframe) => {
    const path = scene.decors[keyframe.decorId]?.path
    return typeof path === 'string' && path.trim() !== ''
  })
  if (!hasMotionPath) return undefined
  return getMotionVisualPersoId(item.id, new Set([EDITOR_V2_ROOT_PERSO_ID, ...scene.items.map(({ id }) => id)]))
}

/** Formats one logical V2 value for the decor model without converting its unit. */
function formatSnapshotValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return String(value)
  const record = value as Record<string, unknown>
  if (record.kind === 'length' && typeof record.value === 'number' && typeof record.unit === 'string') {
    return `${record.value}${record.unit}`
  }
  if (record.kind === 'color' && Array.isArray(record.coords) && typeof record.alpha === 'number') {
    const coords = record.coords.filter((coordinate): coordinate is number => typeof coordinate === 'number')
    if (record.space === 'srgb' && coords.length >= 3) {
      return `rgba(${Math.round(coords[0]! * 255)}, ${Math.round(coords[1]! * 255)}, ${Math.round(coords[2]! * 255)}, ${record.alpha})`
    }
    if (record.space === 'oklch' && coords.length >= 3) {
      return `oklch(${coords[0]} ${coords[1]} ${coords[2]} / ${record.alpha})`
    }
  }
  return String(value)
}

/** Reads a CSS transform-origin percentage/keyword pair as local-box fractions. */
function parseRotationOrigin(value: unknown): { fx: number; fy: number } | undefined {
  if (typeof value !== 'string') return undefined
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return undefined
  const parse = (part: string, axis: 'x' | 'y'): number | undefined => {
    const keyword = part.toLowerCase()
    if (keyword === 'center') return 0.5
    if (axis === 'x' && keyword === 'left') return 0
    if (axis === 'x' && keyword === 'right') return 1
    if (axis === 'y' && keyword === 'top') return 0
    if (axis === 'y' && keyword === 'bottom') return 1
    if (!part.endsWith('%')) return undefined
    const number = Number.parseFloat(part.slice(0, -1))
    return Number.isFinite(number) ? Math.min(1, Math.max(0, number / 100)) : undefined
  }
  const fx = parse(parts[0]!, 'x')
  const fy = parse(parts[1]!, 'y')
  return fx === undefined || fy === undefined ? undefined : { fx, fy }
}

/**
 * Copy-on-write (`2026-06-11-sequence-editor-grid-spec.md` §2.3) : un `decorId` peut être partagé
 * entre plusieurs keyframes adjacents (`KEYFRAME.ADD` en hérite délibérément, §2.3 « à la création
 * d'un keyframe » — pour ne pas dupliquer inutilement des décors identiques). Le muter en place
 * (`setDecor`) modifierait TOUS les keyframes qui le référencent, pas seulement celui en cours
 * d'édition — bug constaté 2026-07-17 (kf2 hérite du décor de kf1, éditer kf2 change aussi kf1, et
 * `buildKeyframeDecorActions` ne voit alors aucun diff entre les deux, donc aucune interpolation).
 * Les éditions ordinaires conservent la compatibilité du contrat existant quand le premier KF
 * partage volontairement `initialDecorId`. L'édition du champ `path`, qui est segment-local, active
 * en plus la garde `includeInitialDecor` afin qu'une donnée importée ou une commande manuelle ne
 * puisse pas contaminer le décor initial d'un item.
 */
function isDecorSharedByAnotherReference(
  scene: EditorScene,
  decorId: string,
  keyframeId: string,
  options?: Readonly<{ includeInitialDecor?: boolean }>,
): boolean {
  return scene.items.some((item) => (options?.includeInitialDecor === true && item.initialDecorId === decorId)
    || item.keyframes.some((k) => k.id !== keyframeId && k.decorId === decorId))
}

function freshDecorId(): string {
  return `decor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * `decor.zoneId` (référence par id) → `patch.zone` (référence par nom, modèle dedit).
 * `content.text`/`.textAutoSize` sont inclus ici (pas seulement le décor) : le panneau
 * « Contenu »/« Auto » de la palette doit refléter la valeur RÉELLEMENT posée à l'attache,
 * pas repartir vide alors que l'item porte déjà du texte.
 */
export function resolveCurrentPatch(decor: Decor, content: Content | undefined, scene: EditorScene): DecorPatch {
  const patch: DecorPatch = {}
  if (decor.style !== undefined) patch.style = decor.style
  // Le modèle document accepte une chaîne ou un tableau ; le modèle décor accepte aussi
  // add/remove. Une valeur issue du document est déjà une valeur complète et reste donc une chaîne.
  if (decor.classes !== undefined) patch.classes = decor.classes as unknown as DecorPatch['classes']
  // Le document et le décor portent la même structure d'offset pour cette frontière.
  if (decor.offset !== undefined) patch.offset = decor.offset as unknown as OffsetPatch
  if (decor.custom !== undefined) patch.custom = decor.custom
  if (decor.zoneId !== undefined) {
    if (decor.zoneId === null) {
      patch.zone = null
    } else {
      const zone = scene.zones[decor.zoneId]
      if (zone) patch.zone = zone.name
    }
  }
  if (decor.path !== undefined) patch.path = decor.path
  if (decor.orientToPath !== undefined) patch.orientToPath = decor.orientToPath
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

/** Reads whether one explicit incoming path owns the target KF's item orientation. */
function resolveMotionPathOrientation(scene: EditorScene, item: Item, keyframeId: string): boolean {
  const keyframe = item.keyframes.find((candidate) => candidate.id === keyframeId)
  return keyframe !== undefined
    && resolveKeyframeChannel(keyframe) === 'pose'
    && scene.decors[keyframe.decorId]?.orientToPath === true
}

/** Resolves the easing used by the pose segment, with the same precedence as the V2 builder. */
function resolveMotionEasing(item: Item, sourceKeyframeId: string, targetKeyframeId: string): MotionEasing {
  const source = item.keyframes.find((keyframe) => keyframe.id === sourceKeyframeId)
  const target = item.keyframes.find((keyframe) => keyframe.id === targetKeyframeId)
  if (target?.transitionIn?.kind === 'interpolated') return target.transitionIn.easing
  if (source?.transitionOut?.kind === 'interpolated') return source.transitionOut.easing
  return 'ease-in-out'
}

/**
 * Décor effectif d'un keyframe sélectionné — cascade en DIRECT (jamais stockée, jamais figée à un
 * instant donné) : `item.initialDecorId`, puis chaque keyframe antérieur dans l'ordre du temps,
 * puis le keyframe lui-même. Une propriété absente d'un maillon reste celle du maillon précédent
 * (persistance visuelle standard d'un keyframe non retouché) — recalculée à CHAQUE sélection,
 * jamais mémorisée : un réordonnancement ultérieur ou une édition faite après coup sur un
 * keyframe antérieur se reflètent immédiatement, sans jamais devenir « faux »
 * (`2026-07-17-decor-keyframe-layering-plan.md` §3 — répond précisément au cas : border ajouté sur
 * kf1 après que kf2 existe déjà, kf2 doit le voir dès sa prochaine sélection). Réutilise
 * `resolveCurrentPatch` (conversion décor→patch déjà existante) et `mergePatch`
 * (`decor-editor/merge.ts`, déjà existant) — aucune nouvelle logique de fusion ici.
 */
export function resolveEffectiveKeyframePatch(
  scene: EditorScene,
  item: Item,
  keyframeId: string,
  content: Content | undefined,
): DecorPatch {
  const kf = item.keyframes.find((k) => k.id === keyframeId)
  const initial = scene.decors[item.initialDecorId] ?? { id: item.initialDecorId }
  if (!kf) return resolveCurrentPatch(initial, content, scene)

  const precedingDecors = item.keyframes
    .filter((k) => k.timeMs < kf.timeMs)
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((k) => ({ keyframe: k, decor: scene.decors[k.decorId] }))
    .filter((entry): entry is { keyframe: Item['keyframes'][number]; decor: Decor } => entry.decor !== undefined)

  const ownDecor = scene.decors[kf.decorId] ?? { id: kf.decorId }
  const layers = [
    { keyframe: null, decor: initial },
    ...precedingDecors,
    { keyframe: kf, decor: ownDecor },
  ]
  return layers
    .map(({ keyframe, decor }) => keyframe === null || resolveKeyframeChannel(keyframe) === 'pose'
      ? resolveCurrentPatch(decor, content, scene)
      : withoutPosePatch(resolveCurrentPatch(decor, content, scene)))
    .reduce((acc, patch) => mergePatch(acc, patch), {} as DecorPatch)
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
  if (keyframe === undefined) return withoutNonPosePatch(resolveCurrentPatch(initial, content, scene))

  const poseKeyframes = item.keyframes
    .filter((candidate) => (candidate.timeMs < keyframe.timeMs || candidate.id === keyframe.id)
      && resolveKeyframeChannel(candidate) === 'pose')
    .sort((left, right) => left.timeMs - right.timeMs)
  return [initial, ...poseKeyframes.map((candidate) => scene.decors[candidate.decorId])]
    .map((decor) => withoutNonPosePatch(resolveCurrentPatch(decor ?? { id: '' }, content, scene)))
    .reduce((acc, patch) => mergePatch(acc, patch), {} as DecorPatch)
}

/** Removes the structured pose group from a full decoration patch. */
function withoutPosePatch(patch: DecorPatch): DecorPatch {
  const result = { ...patch }
  delete result.offset
  return result
}

/** Keeps only the structured pose group needed by the current selection-frame projection. */
function withoutNonPosePatch(patch: DecorPatch): DecorPatch {
  return patch.offset === undefined ? {} : { offset: patch.offset }
}

/**
 * Diff propriété par propriété entre deux `DecorPatch` résolus — vrai si `patch` diverge de `base`
 * sur au moins une propriété présente dans `patch`. Granularité identique à `mergePatch`
 * (`decor-editor/merge.ts`) : clés de `style` une à une, sous-champs d'`offset` un à un,
 * `classes`/`custom`/`zone` comme valeurs entières.
 */
export function patchDiffersFromBase(base: DecorPatch, patch: DecorPatch): boolean {
  return modificationsFromDecorPatch(base, patch).size > 0
}

/**
 * Décor à consigner pour un NOUVEAU keyframe inséré à `timelineMs` sur `item` — `null` si rien à
 * consigner (pas entre deux keyframes réels, ou état résolu identique à la cascade : le keyframe
 * peut alors partager le décor adjacent). Non-null lorsque l'état affiché diverge de la cascade.
 *
 * Le snapshot sert à présenter l'état courant, mais il ne devient jamais une écriture documentaire
 * implicite. Seul le candidat sparse issu de la map des propriétés modifiées peut être persisté ;
 * une valeur interpolée non touchée reste donc absente du nouveau décor et continuera à cascader.
 * `snapshot.get()` est conservé dans la signature pour garder la frontière de lecture explicite,
 * mais il ne sert pas de source de persistance.
 */
export function resolveKeyframeInsertionPatch(
  scene: EditorScene,
  item: Item,
  timelineMs: number,
  content: Content | undefined,
  snapshot: CodPlaySnapshot | null,
  /** Candidate déjà accepté par la preview, qui prime sur `snapshot.get()` (qui l'exclut). */
  livePatch?: DecorPatch,
): DecorPatch | null {
  void snapshot
  const alignment = resolveDecorationKeyframeAlignment(item, timelineMs)
  if (alignment.kind !== 'between') return null
  const base = resolveEffectiveKeyframePatch(scene, item, alignment.prevKeyframeId, content)
  if (livePatch === undefined) return null
  const modifications = modificationsFromDecorPatch(base, livePatch)
  return modifications.size > 0 ? modificationsToDecorPatch(modifications) : null
}

/** Écarts routés vers `setDecor` (`style`/`classes`/`offset`/`custom`/`zone`) — présents seulement si modifiés. */
export function patchToDecorArgs(patch: DecorPatch, scene: EditorScene): Partial<Omit<Decor, 'id'>> | null {
  const args: Partial<Omit<Decor, 'id'>> = {}
  let touched = false
  if (patch.style !== undefined) { args.style = patch.style; touched = true }
  if (patch.classes !== undefined) { args.classes = patch.classes as unknown as Decor['classes']; touched = true }
  if (patch.offset !== undefined) { args.offset = patch.offset as unknown as OffsetData; touched = true }
  if (patch.custom !== undefined) { args.custom = patch.custom; touched = true }
  if (patch.path !== undefined) { args.path = patch.path; touched = true }
  if (patch.orientToPath !== undefined) { args.orientToPath = patch.orientToPath; touched = true }
  if (patch.zone !== undefined) {
    touched = true
    if (patch.zone === null) {
      args.zoneId = null
    } else {
      const zone = Object.values(scene.zones).find((z) => z.name === patch.zone)
      if (zone) args.zoneId = zone.id
      else console.warn(`[decorEditor bridge] zone '${patch.zone}' introuvable dans la scène`)
    }
  }
  const knownProperties = new Set(['style', 'classes', 'offset', 'custom', 'path', 'orientToPath', 'zone'])
  const argsRecord = args as Record<string, unknown>
  for (const [property, value] of Object.entries(patch)) {
    if (knownProperties.has(property)) continue
    argsRecord[property] = value
    touched = true
  }
  return touched ? args : null
}

/** Adds only the target decor's already-authored siblings before a sparse exact-KF write. */
function materializeExistingDecorPatch(scene: EditorScene, decorId: string, patch: DecorPatch): DecorPatch {
  const existing = scene.decors[decorId]
  if (!existing) return patch
  const existingPatch = resolveCurrentPatch(existing, undefined, scene)
  return applyDecorPatch(existingPatch, patch)
}

/** Écart routé vers `assignContent` (`text`/`textAutoSize`) — fusionné sur le `Content` existant, jamais un remplacement partiel (`assignContent` remplace tout l'objet). */
function patchToContentArgs(patch: DecorPatch, existing: Content | undefined, itemType: Target['itemType']): Omit<Content, 'id'> | null {
  if (patch.text === undefined && patch.textAutoSize === undefined) return null
  return {
    type: itemType === 'capsule' ? 'text' : itemType,
    source: existing?.source,
    mediaId: existing?.mediaId,
    text: patch.text ?? existing?.text,
    textAutoSize: patch.textAutoSize ?? existing?.textAutoSize,
    lang: existing?.lang,
    waveform: existing?.waveform,
    cues: existing?.cues,
  }
}

/**
 * Commandes d'écriture pour `patch` sur `target` — fork-si-partagé (spec §2.3) inclus. Commun à
 * `onDecorChange` (édition continue via dedit — palette, CSS libre, presets) et au commit d'une
 * `DecorLiveSession` (fin de geste CS-family — `2026-07-25-decor-unified-channel-plan.md` §4 étape
 * 5) : un seul endroit qui sait construire ces commandes, plus deux copies qui auraient pu diverger.
 */
function buildDecorCommands(scene: EditorScene, target: Target, patch: DecorPatch): Command[] {
  const commands: Command[] = []
  let writeDecorId = target.writeDecorId!
  if (target.keyframeId && isDecorSharedByAnotherReference(scene, writeDecorId, target.keyframeId)) {
    // Fork avant d'écrire, jamais après (spec §2.3) — sinon la mutation en place a déjà atteint
    // le keyframe voisin le temps que le fork soit décidé.
    writeDecorId = freshDecorId()
    commands.push({ name: 'registerDecor', args: { decorId: writeDecorId } })
    commands.push({ name: 'assignKeyframeDecor', args: { itemId: target.itemId, keyframeId: target.keyframeId, decorId: writeDecorId } })
  }
  const decorArgs = patchToDecorArgs(materializeExistingDecorPatch(scene, writeDecorId, patch), scene)
  if (decorArgs) commands.push({ name: 'setDecor', args: { decorId: writeDecorId, patch: decorArgs } })

  const existingContent = target.contentId ? scene.contents[target.contentId] : undefined
  const contentArgs = patchToContentArgs(patch, existingContent, target.itemType)
  if (contentArgs) commands.push({ name: 'assignContent', args: { itemId: target.itemId, content: contentArgs } })

  // `.capsule` (→ `Item.capsule`) : aucun geste de création de capsule n'existe encore dans
  // l'app (`DemoMenuRegion` ne crée que des items texte) — rien à vérifier tant que ce cas ne
  // se présente pas réellement. `.custom` (CSS libre) est routé depuis ce jour via
  // `Decor.custom`/`patchToDecorArgs` — plus un gap, cf `2026-07-17-decor-keyframe-layering-plan.md`.
  if (patch.capsule !== undefined) console.warn('[decorEditor bridge] patch.capsule non routé — aucune capsule créée par cet incrément')

  return commands
}

/** Signal d'inactivité seulement — jamais une cadence de commit pour un geste actif (spec §4.3, `2026-07-17-phase-commit-selection-recovery-plan.md` §Étape B.4). Exporté pour que les tests avancent les minuteurs factices sur la valeur réelle, sans dupliquer la constante. */
export const PHASE_IDLE_FLUSH_MS = 4000
/**
 * Applies one V2 selection-frame gesture to the current local-pixel frame.
 *
 * Move/resize deltas are local pixels, rotation is a gesture-relative degree value and pivot is an
 * absolute local-box fraction. Resize and pivot both rebuild the translation from a visual anchor
 * instead of mutating the untransformed top-left: this keeps the opposite resize point fixed under
 * rotation/scale and keeps the rendered item still while its rotation axis is moved.
 */
export function applyFrameDelta(base: SelectionFrameValue, delta: SelectionFrameDelta): SelectionFrameValue {
  if (delta.kind === 'move') return { ...base, x: base.x + delta.dx, y: base.y + delta.dy }
  if (delta.kind === 'rotate') return { ...base, rotate: (base.rotate ?? 0) + delta.dr }
  if (delta.kind === 'pivot') return applyRotationOriginDelta(base, delta.fx, delta.fy)

  const minSize = 4
  const linear = frameLinearTransform(base)
  const scaleX = finiteNonZeroScale(base.scaleX)
  const scaleY = finiteNonZeroScale(base.scaleY)
  const cosine = linear.a / scaleX
  const sine = linear.b / scaleX
  const localDx = (delta.dx * cosine + delta.dy * sine) / scaleX
  const localDy = (-delta.dx * sine + delta.dy * cosine) / scaleY

  const width = delta.handle.includes('e')
    ? Math.max(minSize, base.width + localDx)
    : delta.handle.includes('w')
      ? Math.max(minSize, base.width - localDx)
      : base.width
  const height = delta.handle.includes('s')
    ? Math.max(minSize, base.height + localDy)
    : delta.handle.includes('n')
      ? Math.max(minSize, base.height - localDy)
      : base.height
  const opposite = oppositePointForHandle(delta.handle)
  const oldAnchor = framePoint(base, opposite.fx * base.width, opposite.fy * base.height)
  const candidateWithoutTranslation = framePoint({ ...base, x: 0, y: 0, width, height }, opposite.fx * width, opposite.fy * height)

  return {
    ...base,
    x: oldAnchor.x - candidateWithoutTranslation.x,
    y: oldAnchor.y - candidateWithoutTranslation.y,
    width,
    height,
  }
}

/** Returns a finite non-zero scale so local-axis projection remains defined. */
function finiteNonZeroScale(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && Math.abs(value) > 1e-8 ? value : 1
}

/** Returns the frame's linear rotate/scale matrix in local scene coordinates. */
function frameLinearTransform(value: SelectionFrameValue): { a: number; b: number; c: number; d: number } {
  const angle = ((value.rotate ?? 0) * Math.PI) / 180
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return {
    a: cosine * finiteNonZeroScale(value.scaleX),
    b: sine * finiteNonZeroScale(value.scaleX),
    c: -sine * finiteNonZeroScale(value.scaleY),
    d: cosine * finiteNonZeroScale(value.scaleY),
  }
}

/** Returns the effective axis fraction, with the V2 center default and a finite clamp. */
function frameRotationOrigin(value: SelectionFrameValue): { fx: number; fy: number } {
  const origin = value.rotationOrigin
  const clamp = (input: number): number => Number.isFinite(input) ? Math.min(1, Math.max(0, input)) : 0.5
  return { fx: clamp(origin?.fx ?? 0.5), fy: clamp(origin?.fy ?? 0.5) }
}

/** Maps one local-box point into the frame's scene-local visual coordinates. */
function framePoint(value: SelectionFrameValue, localX: number, localY: number): { x: number; y: number } {
  const origin = frameRotationOrigin(value)
  const originX = origin.fx * value.width
  const originY = origin.fy * value.height
  const matrix = frameLinearTransform(value)
  return {
    x: value.x + originX - (matrix.a * originX + matrix.c * originY) + matrix.a * localX + matrix.c * localY,
    y: value.y + originY - (matrix.b * originX + matrix.d * originY) + matrix.b * localX + matrix.d * localY,
  }
}

/** Resolves the opposite characteristic point that must remain fixed during a resize. */
function oppositePointForHandle(handle: SelectionFrameHandleId): { fx: number; fy: number } {
  return {
    fx: handle.includes('e') ? 0 : handle.includes('w') ? 1 : 0.5,
    fy: handle.includes('s') ? 0 : handle.includes('n') ? 1 : 0.5,
  }
}

/** Changes the pivot while compensating translation so the current visual pose does not jump. */
function applyRotationOriginDelta(base: SelectionFrameValue, fx: number, fy: number): SelectionFrameValue {
  const clamp = (input: number): number => Number.isFinite(input) ? Math.min(1, Math.max(0, input)) : 0.5
  const nextOrigin = { fx: clamp(fx), fy: clamp(fy) }
  const currentOrigin = frameRotationOrigin(base)
  const previousPivot = { x: currentOrigin.fx * base.width, y: currentOrigin.fy * base.height }
  const nextPivot = { x: nextOrigin.fx * base.width, y: nextOrigin.fy * base.height }
  const matrix = frameLinearTransform(base)
  const deltaX = (previousPivot.x - nextPivot.x) - (matrix.a * (previousPivot.x - nextPivot.x) + matrix.c * (previousPivot.y - nextPivot.y))
  const deltaY = (previousPivot.y - nextPivot.y) - (matrix.b * (previousPivot.x - nextPivot.x) + matrix.d * (previousPivot.y - nextPivot.y))
  return {
    ...base,
    x: base.x + deltaX,
    y: base.y + deltaY,
    rotationOrigin: nextOrigin,
  }
}

export function createDecorEditorBridge(
  container: HTMLElement,
  machine: Actor<typeof controllerMachine>,
  coordination: import('./editor-coordination-bridge').EditorCoordinationBridge,
): BridgeHandle {
  const catalogs: DecorEditorCatalogs = { presets: DEFAULT_PRESETS, cards: [], palette: DEFAULT_PALETTE }
  const controller = new DecorEditorController(catalogs)
  const motionGeometry = createMotionGeometryStore()
  let mountHandle: DecorEditorMountHandle | null = null
  let selectionFrame: SelectionFrameV2Handle | null = null
  let unsubscribeSelectionGeometry: (() => void) | null = null
  let motionOverlay: MotionOverlayHandle | null = null
  let activeCreationMode: { itemType: ItemType; placementMode: RootPlacementMode } | null = null
  let playbackActive = false
  let sceneHost: HTMLElement | null = null
  let resizeObserver: ResizeObserver | null = null
  let sceneRootContentWidthPx: number | null = null
  let frameTarget: Target | null = null
  /** Logical author frame kept for snapshot/document writes. */
  let authorFramePx: SelectionFrameValue | null = null
  let displayFramePx: SelectionFrameValue | null = null
  let frameLogicalValue: SelectionFrameValue | null = null
  let frameGestureBasePx: SelectionFrameValue | null = null
  /** Authored rotation offset paired with the displayed frame captured at gesture start. */
  let frameGestureBaseAuthorRotate: number | null = null
  /** Keeps a just-released CS pose authoritative while the player presentation catches up. */
  let frameCommitCandidatePx: SelectionFrameValue | null = null
  /** Retains the live frame preview until the rebuilt document has been presented by the player. */
  let snapshotCommitAwaitingPresentation = false
  /** Prevents re-entrant presentation events from projecting stale host dimensions during a preview. */
  let snapshotProjectionUpdateInProgress = false
  /** Current border geometry used only to move between the outer pose origin and content-box origin. */
  let frameBorderInsetsPx: FrameBorderInsetsPx = ZERO_CONTENT_BOX_INSETS_PX
  /** Synchronous candidate used while a controller change is being converted to a snapshot. */
  let previewContentFrameOverride: SelectionFrameValue | null = null
  /** Border geometry belonging to the same synchronous snapshot candidate. */
  let previewBorderInsetsOverride: FrameBorderInsetsPx | null = null
  let lastPreviewAccepted = false
  let snapshotPreviewActive = false
  /** Makes the runtime presentation authoritative for the visible CS during an active seek. */
  let seekProjectionActive = false
  let activeMotion: ActiveMotion | null = null
  let endpointGeometryScene: EditorScene | null = null
  let endpointGeometryRootWidthPx: number | null = null
  const endpointGeometryCache = new Map<string, MotionGeometryPose>()
  /** Coalesced root-resize projection; runs after the runtime's own resize observer. */
  let resizeFrameRequest: number | null = null
  let resizeProjectionQueued = false

  // ── Commit de fin de phase (`2026-07-17-phase-commit-selection-recovery-plan.md` §Étape B) —
  // dedit lui-même n'a aucun debounce (spec §4.3, émission continue) ; c'est ce pont, l'hôte, qui
  // décide seul QUAND committer. Six signaux de fin de phase, jamais un minuteur court réarmé à
  // chaque micro-geste : changement de sélection, seek, mutation externe du document et Échap sont
  // immédiats (`flushNow`/`abortPhase` appelés directement) ; seule l'inactivité prolongée passe par
  // un minuteur (`armIdleFlush`, réarmé à chaque signal d'activité). ─────────────────────────────

  let pendingCommands: Command[] | null = null
  type DecorEditState = { base: DecorPatch; modifications: DecorModificationMap }
  const decorEditStates = new Map<string, DecorEditState>()
  let pendingTemporaryDecorCommit: { itemId: string; timeMs: number } | null = null
  let idleFlushTimer: ReturnType<typeof setTimeout> | null = null
  /** Dernière scène/sélection observées — distingue une vraie mutation externe (signal 5) et un simple écho de notre propre flush (qui vide `pendingCommands` avant d'émettre). */
  let lastObservedScene: EditorScene | null = null
  let lastSelectionKey: string | null = null
  /**
   * Référentiel AUTEUR (sans `preRollMs`, même convention que `Keyframe.timeMs`) — mis à jour
   * uniquement par un vrai `SEEK` explicite (scrub/Stop), jamais par la progression naturelle de
   * la lecture (`telco.onProgress`, local à `sequence-editor`, ne redescend jamais vers ce
   * contrôleur — sans conséquence : dedit est de toute façon suspendu pendant `playing`, §Signal
   * `playbackActiveChanged`). Sert à `resolveKeyframeAlignment` pour situer la sélection courante
   * par rapport aux keyframes de l'item (`2026-07-17-resolved-state-at-time-notes.md`).
   */
  let lastKnownTimelineMs = 0

  /** Names one item/time pair without constraining the property paths stored inside it. */
  function decorEditStateKey(itemId: string, timeMs: number): string {
    return `${itemId}\u0000${timeMs}`
  }

  /** Returns the snapshot only when it belongs to the author time currently being projected. */
  function presentedSnapshotAt(timeMs: number): CodPlaySnapshot | null {
    const snapshot = coordination.snapshot.get()
    if (snapshot === null) return null
    const progress = coordination.transport.getProgress()
    if (progress !== null && Math.abs(progress.timelineMs - timeMs) > 1) return null
    if (progress !== null && Math.abs(snapshot.timeMs - progress.playerTimeMs) > 1) return null
    return snapshot
  }

  /** Resolves the complete state used as the immutable base of one current Decor edit. */
  function resolveDecorEditBase(scene: EditorScene, target: Target, timeMs: number): DecorPatch {
    const item = scene.items.find(candidate => candidate.id === target.itemId)
    if (item === undefined) return {}
    const content = target.contentId === null ? undefined : scene.contents[target.contentId]
    if (!target.isTemporary) {
      const authored = target.keyframeId !== null
        ? resolveEffectiveKeyframePatch(scene, item, target.keyframeId, content)
        : resolveCurrentPatch(scene.decors[target.writeDecorId!] ?? { id: target.writeDecorId! }, content, scene)
      return mergePatch(
        authored,
        resolveTemporaryPatch(presentedSnapshotAt(timeMs), item.id, motionVisualIdForItem(scene, item.id)),
      )
    }
    const alignment = resolveDecorationKeyframeAlignment(item, timeMs)
    const previous = alignment.kind === 'between'
      ? resolveEffectiveKeyframePatch(scene, item, alignment.prevKeyframeId, content)
      : {}
    const snapshot = presentedSnapshotAt(timeMs)
    return mergePatch(
      mergePatch(previous, resolveTemporaryPatch(snapshot, item.id, motionVisualIdForItem(scene, item.id))),
      resolveTemporaryOffset(snapshot, item.id, previous, sceneRootWidthPx(), motionVisualIdForItem(scene, item.id)),
    )
  }

  /** Updates the rendering projection and the sparse registry for the active Decor target. */
  function setDecorEditState(itemId: string, timeMs: number, base: DecorPatch, current: DecorPatch): DecorModificationMap {
    const modifications = collectDecorModifications(base, current)
    const key = decorEditStateKey(itemId, timeMs)
    if (modifications.size === 0) decorEditStates.delete(key)
    else decorEditStates.set(key, { base, modifications })
    controller.setModifiedProperties(itemId, [...modifications.keys()])
    return modifications
  }

  /** Removes one temporary edit state and its preview candidate after a commit or cancellation. */
  function clearDecorEditState(itemId: string, timeMs: number): void {
    decorEditStates.delete(decorEditStateKey(itemId, timeMs))
    coordination.decorPreview.clear(itemId, timeMs)
    if (pendingTemporaryDecorCommit?.itemId === itemId
      && Math.abs(pendingTemporaryDecorCommit.timeMs - timeMs) <= 1) {
      pendingTemporaryDecorCommit = null
    }
  }

  /** Builds the sparse document transaction for a Decor edit made between two real keyframes. */
  function buildTemporaryDecorCommit(scene: EditorScene, itemId: string, timeMs: number): { commands: Command[]; keyframeId: string } | null {
    const item = scene.items.find(candidate => candidate.id === itemId)
    if (item === undefined) return null
    const alignment = resolveDecorationKeyframeAlignment(item, timeMs)
    if (alignment.kind !== 'between' || item.keyframes.some(keyframe => keyframe.timeMs === timeMs)) return null
    const state = decorEditStates.get(decorEditStateKey(itemId, timeMs))
    if (state === undefined || state.modifications.size === 0) return null
    const patch = modificationsToDecorPatch(state.modifications)
    const decorArgs = patchToDecorArgs(patch, scene)
    if (decorArgs === null) return null
    const keyframeId = `decor-kf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    return {
      keyframeId,
      commands: [
        { name: 'createNamedKeyframe', args: { itemId, keyframeId, timeMs, channel: 'decor' } },
        { name: 'setDecor', args: { decorId: `decor-${keyframeId}`, patch: decorArgs } },
      ],
    }
  }

  /** Commits the pending temporary Decor edit as one sparse keyframe, if it still has a target. */
  function commitPendingTemporaryDecor(): void {
    const pending = pendingTemporaryDecorCommit
    if (pending === null) return
    pendingTemporaryDecorCommit = null
    const scene = machine.getSnapshot().context.scene
    if (scene === null) return
    const transaction = buildTemporaryDecorCommit(scene, pending.itemId, pending.timeMs)
    if (transaction === null) {
      clearDecorEditState(pending.itemId, pending.timeMs)
      return
    }
    clearDecorEditState(pending.itemId, pending.timeMs)
    retainSnapshotPreviewUntilPresentation()
    machine.send({ type: 'RUN_TRANSACTION', commands: transaction.commands })
  }

  /** Drops temporary registry entries already consumed by an external timeline keyframe insertion. */
  function reconcileConsumedTemporaryDecor(scene: EditorScene): void {
    const pending = pendingTemporaryDecorCommit
    if (pending === null) return
    const item = scene.items.find(candidate => candidate.id === pending.itemId)
    if (item?.keyframes.some(keyframe => Math.abs(keyframe.timeMs - pending.timeMs) <= 1)) {
      clearDecorEditState(pending.itemId, pending.timeMs)
    }
  }

  function selectionKey(selection: Selection): string {
    return JSON.stringify([selection.itemIds, selection.keyframeId ?? null])
  }

  function armIdleFlush(): void {
    if (idleFlushTimer !== null) clearTimeout(idleFlushTimer)
    idleFlushTimer = setTimeout(flushNow, PHASE_IDLE_FLUSH_MS)
  }

  function cancelIdleFlush(): void {
    if (idleFlushTimer !== null) {
      clearTimeout(idleFlushTimer)
      idleFlushTimer = null
    }
  }

  /**
   * Double garde avec `onGestureActiveChange` : un geste CS repris entre-temps (ex. resize→rotate
   * enchaînés) laisse `pendingCommands` en place sans committer — sa propre fin réarmera. Sans ce
   * second contrôle au moment du tir, un signal de fin de phase déjà en vol au moment où un nouveau
   * geste démarre pourrait committer une position intermédiaire.
   */
  function flushNow(): void {
    cancelIdleFlush()
    if (selectionFrame?.isGestureActive()) return
    const commands = pendingCommands
    pendingCommands = null
    if (commands && commands.length > 0) {
      retainSnapshotPreviewUntilPresentation()
      machine.send({ type: 'RUN_TRANSACTION', commands })
    }
    commitPendingTemporaryDecor()
  }

  /** Clears the live snapshot and its target metadata as one phase operation. */
  function clearSnapshotPreview(clearRuntime = true): void {
    if (clearRuntime && snapshotPreviewActive) coordination.snapshot.clear()
    snapshotPreviewActive = false
  }

  /** Keeps the accepted display pose until the committed scene replaces the old player. */
  function retainSnapshotPreviewUntilPresentation(): void {
    if (!snapshotPreviewActive) return
    frameCommitCandidatePx ??= displayFramePx
    snapshotCommitAwaitingPresentation = true
  }

  /** Échap — abandon de phase (§Étape B.6) : jette l'écart en attente sans committer, puis force le pont `scenePlayer` à rejouer le document inchangé pour effacer la preview live devenue périmée. */
  function abortPhase(): void {
    cancelIdleFlush()
    const hadPendingCommands = pendingCommands !== null
    const hadPreview = snapshotPreviewActive
    const hadTemporaryEdit = pendingTemporaryDecorCommit !== null || decorEditStates.size > 0
    pendingCommands = null
    pendingTemporaryDecorCommit = null
    decorEditStates.clear()
    if (hadPreview) {
      clearSnapshotPreview()
    }
    coordination.decorPreview.clearAll()
    if (hadPendingCommands || hadPreview || hadTemporaryEdit) machine.send({ type: 'PHASE_ABORT' })
  }

  /**
   * `AppLayout.tsx::useClearSelectionShortcuts` écoute déjà `Escape` sur `document` (phase de
   * bulles, déjà câblé) et envoie `CLEAR_SELECTION` — ce qui, via le signal 1 ci-dessus, COMMIT le
   * patch en attente. Sans précaution, Échap ferait donc l'inverse du contrat validé (« abandon,
   * jamais de commit »). Capturée en phase de capture sur `document` (jamais `window` en phase de
   * bulles, qui s'exécuterait APRÈS le `CLEAR_SELECTION` de la bulle) : la capture descend
   * `window → document → …` STRICTEMENT avant toute bulle, donc `abortPhase()` vide
   * `pendingCommands` avant que `CLEAR_SELECTION` n'atteigne le signal 1 — son flush devient un
   * no-op. Ne duplique pas la désélection elle-même, seulement l'abandon du patch en attente.
   */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    abortPhase()
  }
  document.addEventListener('keydown', onKeyDown, { capture: true })

  /** Mounts the palette as soon as the editor region exists; it has no player dependency. */
  function ensureMounted(): void {
    if (mountHandle) return
    mountHandle = mountDecorEditor(container, controller)
  }

  /** Returns the current scene-root width used by the single logical-length conversion boundary. */
  function sceneRootWidthPx(): number | null {
    if (sceneHost === null) return null
    const cssWidth = Number.parseFloat(getComputedStyle(sceneHost).width)
    const width = sceneRootContentWidthPx
      ?? (Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : sceneHost.clientWidth)
    return Number.isFinite(width) && width > 0 ? width : null
  }

  /** Reads one logical cqw value from the immutable V2 snapshot representation. */
  function readLogicalLength(value: unknown): number | undefined {
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
    if (typeof value === 'string') {
      const match = value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))cqw$/)
      return match ? Number(match[1]) : undefined
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    const record = value as Record<string, unknown>
    if (record.kind !== 'length' || typeof record.value !== 'number' || !Number.isFinite(record.value)) return undefined
    return record.value
  }

  /** Reads a dimensionless V2 value without interpreting CSS text as a pixel measurement. */
  function readNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  }

  /** Resolves a logical frame from snapshot state, with document offset only as a missing-field fallback. */
  function readLogicalFrame(snapshot: CodPlaySnapshot | null, itemId: string, fallback: DecorPatch): SelectionFrameValue | null {
    const stateStyle = snapshotState(
      snapshot, itemId, motionVisualIdForItem(machine.getSnapshot().context.scene, itemId),
    )?.style
    const style = stateStyle && typeof stateStyle === 'object' ? stateStyle as Record<string, unknown> : {}
    const offset = fallback.offset
    const x = readLogicalLength(style.x) ?? offset?.translate?.x ?? offset?.x
    const y = readLogicalLength(style.y) ?? offset?.translate?.y ?? offset?.y
    const width = readLogicalLength(style.width) ?? offset?.width
    const height = readLogicalLength(style.height) ?? offset?.height
    if (x === undefined || y === undefined || width === undefined || height === undefined) return null
    return {
      x,
      y,
      width,
      height,
      rotate: readNumber(style.rotate) ?? offset?.rotate ?? 0,
      scaleX: readNumber(style.scaleX) ?? offset?.scale?.x ?? 1,
      scaleY: readNumber(style.scaleY) ?? offset?.scale?.y ?? 1,
      rotationOrigin: parseRotationOrigin(style['transform-origin'])
        ?? parseRotationOrigin(fallback.style?.['transform-origin'])
        ?? offset?.rotationOrigin,
    }
  }

  /** Restores the authored content-box origin from the builder's border-box runtime translation. */
  function restoreSnapshotContentFrame(
    snapshot: CodPlaySnapshot,
    itemId: string,
    frame: SelectionFrameValue,
    insets: FrameBorderInsetsPx,
    rootWidthPx: number,
  ): SelectionFrameValue {
    const style = snapshotState(
      snapshot, itemId, motionVisualIdForItem(machine.getSnapshot().context.scene, itemId),
    )?.style
    if (!style || typeof style !== 'object' || Array.isArray(style)) return frame
    const hasRuntimeX = Object.prototype.hasOwnProperty.call(style, 'x')
    const hasRuntimeY = Object.prototype.hasOwnProperty.call(style, 'y')
    if (!hasRuntimeX && !hasRuntimeY) return frame
    const runtimeFrame = logicalFrameToPx(frame, rootWidthPx)
    const contentFrame = poseFrameToContentBoxFrame(runtimeFrame, insets)
    return {
      ...frame,
      ...(hasRuntimeX ? { x: pxToCqw(contentFrame.x, rootWidthPx) } : {}),
      ...(hasRuntimeY ? { y: pxToCqw(contentFrame.y, rootWidthPx) } : {}),
    }
  }

  /** Projects one logical frame into the local pixel coordinate system of the scene root. */
  function logicalFrameToPx(value: SelectionFrameValue, rootWidthPx: number): SelectionFrameValue {
    return {
      x: cqwToPx(value.x, rootWidthPx),
      y: cqwToPx(value.y, rootWidthPx),
      width: cqwToPx(value.width, rootWidthPx),
      height: cqwToPx(value.height, rootWidthPx),
      rotate: value.rotate ?? 0,
      scaleX: value.scaleX ?? 1,
      scaleY: value.scaleY ?? 1,
      rotationOrigin: value.rotationOrigin === undefined ? undefined : { ...value.rotationOrigin },
    }
  }

  /** Resolves border geometry from the current Decor/snapshot without reading the item DOM. */
  function resolveFrameBorderInsets(
    snapshot: CodPlaySnapshot | null,
    itemId: string,
    patch: DecorPatch,
    rootWidthPx: number,
  ): FrameBorderInsetsPx {
    const style: Record<string, unknown> = { ...(patch.style ?? {}) }
    const snapshotStyle = snapshotState(
      snapshot, itemId, motionVisualIdForItem(machine.getSnapshot().context.scene, itemId),
    )?.style
    if (snapshotStyle && typeof snapshotStyle === 'object' && !Array.isArray(snapshotStyle)) {
      Object.assign(style, snapshotStyle)
    }
    return resolveBorderInsetsPx(style, rootWidthPx)
  }

  /** Resolves the border belonging to one endpoint, including its current accepted preview. */
  function motionEndpointInsets(scene: EditorScene, item: Item, keyframeId: string, rootWidthPx: number): FrameBorderInsetsPx {
    const keyframe = item.keyframes.find((candidate) => candidate.id === keyframeId)
    const isCurrentPreview = snapshotPreviewActive
      && frameTarget?.itemId === item.id
      && frameTarget.keyframeId === keyframeId
      && keyframe !== undefined
      && Math.abs(lastKnownTimelineMs - keyframe.timeMs) <= 1
    if (isCurrentPreview) return frameBorderInsetsPx
    return resolveBorderInsetsPx(resolveDecorationStyleAtTime(scene, item, keyframe?.timeMs ?? 0), rootWidthPx)
  }

  /** Resolves the adjacent pair represented by the current selection or playhead. */
  function resolveMotionPair(item: Item, selectedKeyframeId: string | null, timelineMs: number): {
    sourceKeyframe: Item['keyframes'][number]
    targetKeyframe: Item['keyframes'][number]
  } | null {
    const keyframes = sortPoseKeyframes(item)
    const selectedKeyframe = selectedKeyframeId === null
      ? undefined
      : item.keyframes.find((keyframe) => keyframe.id === selectedKeyframeId)
    const selectedIndex = selectedKeyframeId === null
      ? -1
      : keyframes.findIndex((keyframe) => keyframe.id === selectedKeyframeId)
    // A selected first pose KF owns the outgoing segment; every later pose KF owns the incoming
    // segment. A decoration-only KF has no spatial endpoint, so its movement preview attaches to
    // the pose segment containing its time and can promote that KF on commit.
    const pairIndex = selectedKeyframe !== undefined && resolveKeyframeChannel(selectedKeyframe) === 'decor'
      ? keyframes.findIndex((keyframe, index) => {
        const next = keyframes[index + 1]
        return next !== undefined
          && selectedKeyframe.timeMs >= keyframe.timeMs
          && selectedKeyframe.timeMs <= next.timeMs
      })
      : selectedIndex > 0
        ? selectedIndex - 1
        : selectedIndex === 0 && keyframes.length > 1
          ? 0
          : selectedIndex < 0
            ? keyframes.findIndex((keyframe, index) => {
              const next = keyframes[index + 1]
              return next !== undefined && timelineMs > keyframe.timeMs && timelineMs < next.timeMs
            })
            : -1
    if (pairIndex < 0) return null
    const sourceKeyframe = keyframes[pairIndex]
    const targetKeyframe = keyframes[pairIndex + 1]
    return sourceKeyframe === undefined || targetKeyframe === undefined
      ? null
      : { sourceKeyframe, targetKeyframe }
  }

  /** Resolves the selected path owner before falling back to the keyframe/time default pair. */
  function resolveGestureMotion(
    scene: EditorScene,
    item: Item,
    target: Target,
  ): {
    sourceKeyframe: Item['keyframes'][number]
    targetKeyframe: Item['keyframes'][number]
    path: string | undefined
    orientToPath: boolean
    ease: MotionEasing
  } | null {
    const motion = activeMotion
    const motionContainsTarget = motion !== null
      && motion.itemId === item.id
      && (target.keyframeId === null
        ? lastKnownTimelineMs > motion.sourceTimeMs && lastKnownTimelineMs < motion.targetTimeMs
        : target.keyframeId === motion.sourceKeyframeId || target.keyframeId === motion.targetKeyframeId)
    const pair = motionContainsTarget
      ? {
        sourceKeyframe: item.keyframes.find((keyframe) => keyframe.id === motion.sourceKeyframeId),
        targetKeyframe: item.keyframes.find((keyframe) => keyframe.id === motion.targetKeyframeId),
      }
      : resolveMotionPair(item, target.keyframeId, lastKnownTimelineMs)
    if (pair === null || pair.sourceKeyframe === undefined || pair.targetKeyframe === undefined) return null
    return {
      sourceKeyframe: pair.sourceKeyframe,
      targetKeyframe: pair.targetKeyframe,
      path: motionContainsTarget ? motion.path : resolveMotionPath(scene, item, pair.targetKeyframe.id),
      orientToPath: motionContainsTarget
        ? motion.orientToPath === true
        : resolveMotionPathOrientation(scene, item, pair.targetKeyframe.id),
      ease: motionContainsTarget
        ? motion.ease
        : resolveMotionEasing(item, pair.sourceKeyframe.id, pair.targetKeyframe.id),
    }
  }

  /** Builds all adjacent document segments for the selected item in one shared overlay projection. */
  function resolveMotionOverlaySegments(
    scene: EditorScene,
    item: Item,
    selectedKeyframeId: string | null,
    rootWidthPx: number,
    currentMotion: ActiveMotion | null,
    timelineMs: number,
  ): { selection: MotionGeometryPose | null; segments: MotionOverlaySegment[] } {
    if (endpointGeometryScene !== scene || endpointGeometryRootWidthPx !== rootWidthPx) {
      endpointGeometryCache.clear()
      endpointGeometryScene = scene
      endpointGeometryRootWidthPx = rootWidthPx
    }
    const keyframes = sortPoseKeyframes(item)
    const selectedPair = resolveMotionPair(item, selectedKeyframeId, timelineMs)
    const activeSourceId = currentMotion?.sourceKeyframeId ?? selectedPair?.sourceKeyframe.id
    const activeTargetId = currentMotion?.targetKeyframeId ?? selectedPair?.targetKeyframe.id
    const content = item.contentId === null ? undefined : scene.contents[item.contentId]
    const selectedKeyframe = selectedKeyframeId === null
      ? undefined
      : item.keyframes.find((keyframe) => keyframe.id === selectedKeyframeId)
    const selectedTargetIsAtTimeline = selectedKeyframe !== undefined
      && Math.abs(selectedKeyframe.timeMs - timelineMs) <= 1
    const endpointGeometry = new Map<string, MotionEndpointProjection>()
    for (const keyframe of keyframes) {
      const logicalFrame = readLogicalFrame(
        null,
        item.id,
        resolveEffectiveKeyframePatch(scene, item, keyframe.id, content),
      )
      if (logicalFrame === null) continue
      const isSelectedEndpoint = frameTarget?.itemId === item.id
        && !frameTarget.isTemporary
        && frameTarget.keyframeId === keyframe.id
        && selectedTargetIsAtTimeline
      const presentationFrame = isSelectedEndpoint && displayFramePx !== null
        ? presentedContentBoxFrameForItem(item.id, displayFramePx.rotationOrigin)
        : null
      const selectedFrame = isSelectedEndpoint
        ? frameCommitCandidatePx
          ?? (frameGestureBasePx === null ? null : displayFramePx)
          ?? presentationFrame
          ?? authorFramePx
        : null
      const presentationOwnsPose = isSelectedEndpoint
        && (frameCommitCandidatePx !== null
          || (frameGestureBasePx !== null && displayFramePx !== null)
          || presentationFrame !== null)
      const cacheKey = `${item.id}:${keyframe.id}`
      const insets = motionEndpointInsets(scene, item, keyframe.id, rootWidthPx)
      const authorFrame = isSelectedEndpoint && authorFramePx !== null
        ? authorFramePx
        : logicalFrameToPx(logicalFrame, rootWidthPx)
      const cachedGeometry = endpointGeometryCache.get(cacheKey)
      const frame = selectedFrame ?? cachedGeometry?.frame ?? authorFrame
      const geometry = resolveMotionGeometryPose(frame, insets)
      if (presentationOwnsPose) endpointGeometryCache.set(cacheKey, geometry)
      endpointGeometry.set(keyframe.id, {
        geometry,
        insets,
        authorFrame,
      })
    }
    const selectedEndpointGeometry = selectedKeyframeId === null
      ? undefined
      : endpointGeometry.get(selectedKeyframeId)?.geometry
    const selectionGeometry = selectedTargetIsAtTimeline && selectedEndpointGeometry !== undefined
      ? selectedEndpointGeometry
      : displayFramePx === null
        ? null
        : resolveMotionGeometryPose(displayFramePx, frameBorderInsetsPx)
    const segments: MotionOverlaySegment[] = []

    for (let index = 0; index < keyframes.length - 1; index += 1) {
      const sourceKeyframe = keyframes[index]!
      const targetKeyframe = keyframes[index + 1]!
      const sourceEndpoint = endpointGeometry.get(sourceKeyframe.id)
      const targetEndpoint = endpointGeometry.get(targetKeyframe.id)
      if (sourceEndpoint === undefined || targetEndpoint === undefined) continue
      const sourceGeometry = sourceEndpoint.geometry
      const targetGeometry = targetEndpoint.geometry

      const pairIsActive = activeSourceId === sourceKeyframe.id && activeTargetId === targetKeyframe.id
      const sourceDocumentFrame = sourceEndpoint.authorFrame
      const targetDocumentFrame = targetEndpoint.authorFrame
      const path = pairIsActive && currentMotion !== null
        ? currentMotion.path
        : resolveMotionPath(scene, item, targetKeyframe.id)
      const orientToPath = pairIsActive && currentMotion !== null
        ? currentMotion.orientToPath === true
        : resolveMotionPathOrientation(scene, item, targetKeyframe.id)
      const sourceInsets = sourceEndpoint.insets
      const targetInsets = targetEndpoint.insets
      const sourceCenter = sourceGeometry.pathAnchor
      const targetCenter = targetGeometry.pathAnchor
      const tangentPath = path !== undefined && orientToPath ? path : undefined
      const sourceTangent = tangentPath === undefined
        ? undefined
        : motionPathTangentAngle(tangentPath, sourceCenter, targetCenter, 0)
      const targetTangent = tangentPath === undefined
        ? undefined
        : motionPathTangentAngle(tangentPath, sourceCenter, targetCenter, 1)
      const sourceFrame = sourceTangent === undefined
        ? sourceDocumentFrame
        : frameWithTangentAtPathAnchor(
          sourceDocumentFrame,
          sourceCenter,
          sourceTangent,
          sourceInsets,
        )
      const targetFrame = targetTangent === undefined
        ? targetDocumentFrame
        : frameWithTangentAtPathAnchor(
          targetDocumentFrame,
          targetCenter,
          targetTangent,
          targetInsets,
        )
      const control = path === undefined
        ? midpoint(sourceCenter, targetCenter)
        : motionControlFromPath(path, sourceCenter, targetCenter) ?? midpoint(sourceCenter, targetCenter)
      const role = pairIsActive
        ? currentMotion?.role ?? (selectedPair?.sourceKeyframe.id === sourceKeyframe.id ? 'source' : 'target')
        : undefined
      const isTemporary = pairIsActive
        && (selectedKeyframe === undefined || resolveKeyframeChannel(selectedKeyframe) === 'decor')
        && timelineMs > sourceKeyframe.timeMs
        && timelineMs < targetKeyframe.timeMs
      const sourcePose = sourceTangent === undefined
        ? sourceGeometry
        : resolveMotionGeometryPose(sourceFrame, sourceInsets)
      const targetPose = targetTangent === undefined
        ? targetGeometry
        : resolveMotionGeometryPose(targetFrame, targetInsets)
      segments.push({
        id: `${item.id}:${sourceKeyframe.id}->${targetKeyframe.id}`,
        sourceKeyframeId: sourceKeyframe.id,
        targetKeyframeId: targetKeyframe.id,
        sourceGeometry: sourcePose,
        targetGeometry: targetPose,
        ...(selectionGeometry === null ? {} : { selectionGeometry }),
        control,
        ...(path === undefined ? {} : { path }),
        ...(orientToPath ? { orientToPath: true } : {}),
        active: pairIsActive,
        ...(role === undefined ? {} : { role }),
        ...(isTemporary ? {
          isTemporary: true,
          splitProgress: resolveMotionEaseProgress(resolveMotionEasing(item, sourceKeyframe.id, targetKeyframe.id),
            (timelineMs - sourceKeyframe.timeMs) / (targetKeyframe.timeMs - sourceKeyframe.timeMs)),
          ...(frameGestureBasePx === null ? {} : { posePreview: true }),
        } : {}),
      })
    }
    return { selection: selectionGeometry, segments }
  }

  /** Converts one projected active segment into the ephemeral motion state used by CS gestures. */
  function activeMotionFromSegment(
    item: Item,
    segment: MotionOverlaySegment,
  ): ActiveMotion | null {
    const sourceKeyframeId = segment.sourceKeyframeId
    const targetKeyframeId = segment.targetKeyframeId
    if (sourceKeyframeId === undefined || targetKeyframeId === undefined) return null
    const sourceKeyframe = item.keyframes.find((keyframe) => keyframe.id === sourceKeyframeId)
    const targetKeyframe = item.keyframes.find((keyframe) => keyframe.id === targetKeyframeId)
    if (sourceKeyframe === undefined || targetKeyframe === undefined) return null
    return {
      itemId: item.id,
      sourceKeyframeId,
      targetKeyframeId,
      sourceTimeMs: sourceKeyframe.timeMs,
      targetTimeMs: targetKeyframe.timeMs,
      ease: resolveMotionEasing(item, sourceKeyframeId, targetKeyframeId),
      ...(segment.path === undefined ? {} : { path: segment.path }),
      ...(segment.orientToPath === true ? { orientToPath: true } : {}),
      role: segment.role ?? 'target',
    }
  }

  /** Rebuilds the active motion projection from the committed document and selected keyframe. */
  function activateCommittedMotion(item: Item, selectedKeyframeId: string, rootWidthPx: number): MotionOverlaySegment | null {
    const projectedSegments = resolveMotionOverlaySegments(
      machine.getSnapshot().context.scene!,
      item,
      selectedKeyframeId,
      rootWidthPx,
      null,
      lastKnownTimelineMs,
    )
    const activeSegment = projectedSegments.segments.find((candidate) => candidate.active === true) ?? null
    activeMotion = activeSegment === null
      ? null
      : activeMotionFromSegment(item, activeSegment)
    return activeSegment
  }

  /** Builds one ghost projection for every real keyframe in the item's temporal chain. */
  function resolveMotionOverlayGhosts(
    scene: EditorScene,
    item: Item,
    selectedKeyframeId: string | null,
    rootWidthPx: number,
    projectedSegments: readonly MotionOverlaySegment[],
    selectionGeometry: MotionGeometryPose | null,
  ): MotionOverlayGhost[] {
    const keyframes = sortPoseKeyframes(item)
    const content = item.contentId === null ? undefined : scene.contents[item.contentId]
    const activeSegment = projectedSegments.find((candidate) => candidate.active === true)
    const selectedIndex = selectedKeyframeId === null
      ? -1
      : keyframes.findIndex((keyframe) => keyframe.id === selectedKeyframeId)
    const activeSourceIndex = activeSegment?.sourceKeyframeId === undefined
      ? -1
      : keyframes.findIndex((keyframe) => keyframe.id === activeSegment.sourceKeyframeId)
    const activeTargetIndex = activeSegment?.targetKeyframeId === undefined
      ? -1
      : keyframes.findIndex((keyframe) => keyframe.id === activeSegment.targetKeyframeId)
    const anchorIndices = selectedIndex >= 0
      ? [selectedIndex]
      : [activeSourceIndex, activeTargetIndex].filter((index) => index >= 0)

    return keyframes.flatMap((keyframe, index) => {
      const outgoingSegment = projectedSegments.find((segment) =>
        segment.sourceKeyframeId === keyframe.id && segment.path !== undefined)
      const incomingSegment = projectedSegments.find((segment) => segment.targetKeyframeId === keyframe.id)
      const ownerSegment = outgoingSegment ?? incomingSegment
      const projectedGeometry = ownerSegment === undefined
        ? undefined
        : ownerSegment === outgoingSegment
          ? ownerSegment.sourceGeometry
          : ownerSegment.targetGeometry
      const fallbackPatch = resolveEffectiveKeyframePatch(scene, item, keyframe.id, content)
      const fallbackFrame = projectedGeometry === undefined
        ? readLogicalFrame(null, item.id, fallbackPatch)
        : null
      const fallbackInsets = projectedGeometry === undefined
        ? motionEndpointInsets(scene, item, keyframe.id, rootWidthPx)
        : undefined
      const geometry = projectedGeometry
        ?? (fallbackFrame === null ? undefined : resolveMotionGeometryPose(
          logicalFrameToPx(fallbackFrame, rootWidthPx), fallbackInsets!,
        ))
      if (geometry === undefined) return []
      const atCurrentKeyframe = frameTarget?.itemId === item.id
        && Math.abs(lastKnownTimelineMs - keyframe.timeMs) <= 1
      const currentFrame = atCurrentKeyframe ? frameCommitCandidatePx ?? displayFramePx : null
      // At the current KF the acknowledged presentation (or accepted preview) owns the ghost,
      // including the compiler's path quantization. Other KFs use their owning segment projection.
      const usesSelectedGeometry = atCurrentKeyframe
        && frameTarget?.keyframeId === keyframe.id
        && selectionGeometry !== null
      const ghostGeometry = usesSelectedGeometry
        ? selectionGeometry
        : currentFrame === null
          ? geometry
          : resolveMotionGeometryPose(currentFrame, geometry.insets)
      const chainDistance = anchorIndices.length === 0
        ? index
        : Math.min(...anchorIndices.map((anchorIndex) => Math.abs(index - anchorIndex)))
      return [{
        id: `${item.id}:ghost:${keyframe.id}`,
        keyframeId: keyframe.id,
        geometry: ghostGeometry,
        chainDistance,
        ...(index === 0 ? { isInitial: true } : {}),
      }]
    })
  }

  /** Projects the current runtime pose and its affine content inset into the visible CS. */
  function presentedContentBoxFrameForItem(
    itemId: string,
    rotationOrigin: SelectionFrameValue['rotationOrigin'],
  ): SelectionFrameValue | null {
    if ((snapshotProjectionUpdateInProgress || snapshotPreviewActive)
      && frameTarget?.itemId === itemId
      && displayFramePx !== null) {
      return displayFramePx
    }
    const presentation = coordination.presentation.get()
    if (presentation === null || Math.abs(presentation.timeMs - lastKnownTimelineMs) > 1) return null
    const runtimeItemId = `${EDITOR_V2_STORY_ID}:${itemId}`
    const item = presentation.items.find((candidate) => candidate.itemId === runtimeItemId)
    if (item === undefined) return null
    const scene = machine.getSnapshot().context.scene
    const documentItem = scene?.items.find((candidate) => candidate.id === itemId)
    const poseKeyframes = documentItem?.keyframes
      .filter((keyframe) => resolveKeyframeChannel(keyframe) === 'pose')
      .sort((left, right) => left.timeMs - right.timeMs) ?? []
    const usesMotionGeometryHost = scene !== null && scene !== undefined && poseKeyframes.slice(1).some((keyframe) => {
      const path = scene.decors[keyframe.decorId]?.path
      return typeof path === 'string' && path.trim() !== ''
    })
    return usesMotionGeometryHost
      ? presentationBorderBoxPoseToContentFrame(item.pose, rotationOrigin, frameBorderInsetsPx)
      : presentationPoseToSelectionFrame(item.pose, rotationOrigin, frameBorderInsetsPx)
  }

  /** Converts one local pixel frame to the unitless structured offset vocabulary. */
  function frameToOffsetPatch(value: SelectionFrameValue, rootWidthPx: number): OffsetPatch {
    return offsetValuesPxToPatch(value, rootWidthPx)
  }

  /** Keeps pixel and responsive projections of the same authored frame together. */
  function setAuthorFrame(value: SelectionFrameValue, rootWidthPx: number): void {
    authorFramePx = value
    frameLogicalValue = {
      ...value,
      x: pxToCqw(value.x, rootWidthPx),
      y: pxToCqw(value.y, rootWidthPx),
      width: pxToCqw(value.width, rootWidthPx),
      height: pxToCqw(value.height, rootWidthPx),
    }
  }

  /** Stores the authored tangent-relative offset while keeping the CS value in presentation space. */
  function authorFrameForGesture(displayedFrame: SelectionFrameValue, authoredRotate: number): SelectionFrameValue {
    return frameWithRotationAtPathAnchor(
      displayedFrame, authoredRotate, motionPathAnchorForFrame(displayedFrame, frameBorderInsetsPx), frameBorderInsetsPx,
    )
  }

  /** Reports whether the target pose is presented on a path-owned tangent segment. */
  function targetUsesTangent(scene: EditorScene, target: Target): boolean {
    const item = scene.items.find((candidate) => candidate.id === target.itemId)
    if (item === undefined) return false
    const motion = resolveGestureMotion(scene, item, target)
    return motion !== null && motion.path !== undefined && motion.orientToPath
  }

  /** Resolves the path tangent for a gesture candidate using the document endpoint frames. */
  function resolveTangentGestureProjection(
    scene: EditorScene,
    target: Target,
    candidateFrame: SelectionFrameValue,
    candidateInsets = frameBorderInsetsPx,
  ): { angle: number; pathAnchor: { x: number; y: number } } | null {
    const item = scene.items.find((candidate) => candidate.id === target.itemId)
    if (item === undefined) return null
    const motion = resolveGestureMotion(scene, item, target)
    if (motion === null || motion.path === undefined || !motion.orientToPath) return null
    const projectedSegment = motionGeometry.get().segments.find((segment) =>
      segment.sourceKeyframeId === motion.sourceKeyframe.id
      && segment.targetKeyframeId === motion.targetKeyframe.id)
    if (projectedSegment === undefined) return null
    const candidateIsSource = target.keyframeId === motion.sourceKeyframe.id
    const candidateIsTarget = target.keyframeId === motion.targetKeyframe.id
    const pathAnchor = motionPathAnchorForFrame(candidateFrame, candidateInsets)
    const sourceAnchor = candidateIsSource ? pathAnchor : projectedSegment.sourceGeometry.pathAnchor
    const targetAnchor = candidateIsTarget ? pathAnchor : projectedSegment.targetGeometry.pathAnchor
    const selectedKeyframe = target.keyframeId === null
      ? undefined
      : item.keyframes.find((keyframe) => keyframe.id === target.keyframeId)
    const timelineMs = selectedKeyframe?.timeMs ?? lastKnownTimelineMs
    const durationMs = motion.targetKeyframe.timeMs - motion.sourceKeyframe.timeMs
    const progress = durationMs <= 0
      ? 1
      : Math.min(1, Math.max(0, (timelineMs - motion.sourceKeyframe.timeMs) / durationMs))
    const easedProgress = resolveMotionEaseProgress(motion.ease, progress)
    const tangentProgress = candidateIsSource ? 0 : candidateIsTarget ? 1 : easedProgress
    if (!candidateIsSource && !candidateIsTarget && frameGestureBasePx !== null) {
      const waypoint = motionPathAnchorForFrame(candidateFrame, candidateInsets)
      const split = splitMotionPath(motion.path, sourceAnchor, waypoint, targetAnchor, easedProgress)
      const angle = split.after === undefined
        ? undefined
        : motionPathTangentAngle(split.after, split.waypoint, targetAnchor, 0)
      return angle === undefined ? null : { angle, pathAnchor: split.waypoint }
    }
    const angle = motionPathTangentAngle(motion.path, sourceAnchor, targetAnchor, tangentProgress)
    return angle === undefined ? null : { angle, pathAnchor }
  }

  /** Projects every author-frame candidate through the same path, border and tangent conversion. */
  function displayFrameForAuthorFrame(
    scene: EditorScene,
    target: Target,
    value: SelectionFrameValue,
    insets = frameBorderInsetsPx,
  ): SelectionFrameValue {
    const projection = resolveTangentGestureProjection(scene, target, value, insets)
    return projection === null ? value : frameWithTangentAtPathAnchor(
      value, projection.pathAnchor, projection.angle, insets,
    )
  }

  /** Resolves the offset angle for the pose currently shown by the Selection Frame. */
  function authoredRotationAtGestureStart(
    scene: EditorScene,
    target: Target,
    displayedBase: SelectionFrameValue,
  ): number {
    const item = scene.items.find((candidate) => candidate.id === target.itemId)
    if (item === undefined) return authorFramePx?.rotate ?? displayedBase.rotate ?? 0

    const content = item.contentId === null ? undefined : scene.contents[item.contentId]
    const selectedKeyframe = target.keyframeId === null
      ? undefined
      : item.keyframes.find((keyframe) => keyframe.id === target.keyframeId)
    if (selectedKeyframe !== undefined && resolveKeyframeChannel(selectedKeyframe) === 'pose') {
      const documentFrame = readLogicalFrame(
        null,
        item.id,
        resolveEffectivePosePatch(scene, item, selectedKeyframe.id, content),
      )
      return documentFrame?.rotate ?? 0
    }

    const motion = resolveGestureMotion(scene, item, target)
    if (motion === null) return authorFramePx?.rotate ?? displayedBase.rotate ?? 0
    const sourcePatch = resolveEffectivePosePatch(scene, item, motion.sourceKeyframe.id, content)
    const targetPatch = resolveEffectivePosePatch(scene, item, motion.targetKeyframe.id, content)
    const sourceFrame = readLogicalFrame(null, item.id, sourcePatch)
    const targetFrame = readLogicalFrame(null, item.id, targetPatch)
    const sourceAngle = sourceFrame?.rotate ?? 0
    const targetAngle = targetFrame?.rotate ?? 0
    const durationMs = motion.targetKeyframe.timeMs - motion.sourceKeyframe.timeMs
    const progress = durationMs <= 0
      ? 1
      : Math.min(1, Math.max(0, (lastKnownTimelineMs - motion.sourceKeyframe.timeMs) / durationMs))
    const easedProgress = resolveMotionEaseProgress(motion.ease, progress)

    return sourceAngle + (targetAngle - sourceAngle) * easedProgress
  }

  /** Routes pose previews to the path host and visual styles to its child as one snapshot update. */
  function toSnapshotPatches(itemId: string, patch: DecorPatch): CodPlaySnapshotPatch[] | null {
    const progress = coordination.transport.getProgress()
    if (progress === null) return null
    const hostStyle: Record<string, unknown> = {}
    const visualStyle: Record<string, unknown> = {}
    for (const [property, value] of Object.entries(patch.style ?? {})) {
      if (property === 'width' || property === 'height') continue
      if (property === 'x' || property === 'y' || property === 'rotate'
        || property === 'scaleX' || property === 'scaleY' || property === 'transform-origin') {
        hostStyle[property] = value
        continue
      }
      visualStyle[property] = value
    }
    if (patch.offset) {
      const offset = patch.offset
      if (offset.x !== undefined) hostStyle.x = offset.x
      if (offset.y !== undefined) hostStyle.y = offset.y
      if (offset.translate !== undefined) {
        if (offset.translate.x !== undefined) hostStyle.x = offset.translate.x
        if (offset.translate.y !== undefined) hostStyle.y = offset.translate.y
      }
      if (offset.width !== undefined) visualStyle.width = offset.width
      if (offset.height !== undefined) visualStyle.height = offset.height
      if (offset.rotate !== undefined) hostStyle.rotate = offset.rotate
      if (offset.scale?.x !== undefined) hostStyle.scaleX = offset.scale.x
      if (offset.scale?.y !== undefined) hostStyle.scaleY = offset.scale.y
      if (offset.rotationOrigin !== undefined) {
        hostStyle['transform-origin'] = `${offset.rotationOrigin.fx * 100}% ${offset.rotationOrigin.fy * 100}%`
      }
    }
    // A snapshot preview replaces the materialized pose. Keep the full affine pose on the host,
    // while the child retains the content dimensions and CSS decoration used by the shared frame.
    const rootWidth = sceneRootWidthPx()
    const contentFrame = previewContentFrameOverride ?? displayFramePx
    const insets = previewBorderInsetsOverride ?? frameBorderInsetsPx
    if (rootWidth !== null && contentFrame !== null && frameTarget?.itemId === itemId) {
      const runtimeFrame = contentBoxFrameToPoseFrame(contentFrame, insets)
      hostStyle.x = pxToCqw(runtimeFrame.x, rootWidth)
      hostStyle.y = pxToCqw(runtimeFrame.y, rootWidth)
      hostStyle.rotate = runtimeFrame.rotate ?? 0
      hostStyle.scaleX = runtimeFrame.scaleX ?? 1
      hostStyle.scaleY = runtimeFrame.scaleY ?? 1
      hostStyle['transform-origin'] = `${(runtimeFrame.rotationOrigin?.fx ?? 0.5) * 100}% ${(runtimeFrame.rotationOrigin?.fy ?? 0.5) * 100}%`
      visualStyle.width = pxToCqw(contentFrame.width, rootWidth)
      visualStyle.height = pxToCqw(contentFrame.height, rootWidth)
    }
    const visualPersoId = motionVisualIdForItem(machine.getSnapshot().context.scene, itemId)
    if (visualPersoId === undefined) {
      const style = { ...visualStyle, ...hostStyle }
      return Object.keys(style).length === 0 ? null : [{
        target: { storyId: EDITOR_V2_STORY_ID, persoId: itemId },
        timeMs: progress.playerTimeMs,
        state: { style },
      }]
    }
    const snapshotPatches: CodPlaySnapshotPatch[] = []
    if (Object.keys(hostStyle).length > 0) snapshotPatches.push({
      target: { storyId: EDITOR_V2_STORY_ID, persoId: itemId },
      timeMs: progress.playerTimeMs,
      state: { style: hostStyle },
    })
    if (Object.keys(visualStyle).length > 0) snapshotPatches.push({
      target: { storyId: EDITOR_V2_STORY_ID, persoId: visualPersoId },
      timeMs: progress.playerTimeMs,
      state: { style: visualStyle },
    })
    return snapshotPatches.length === 0 ? null : snapshotPatches
  }

  /** Presents a patch through snapshot and optionally records its temporary candidate. */
  function previewPatch(itemId: string, patch: DecorPatch, recordCandidate = false): boolean {
    // Snapshot V2 currently carries the live style channel. A temporary edit may nevertheless
    // touch content, classes, custom data, zone or a future decor module. Record the complete
    // candidate independently so creation of a KF can capture those properties as well.
    if (recordCandidate) {
      coordination.decorPreview.set({ itemId, timeMs: lastKnownTimelineMs, patch })
    }
    const snapshotPatches = toSnapshotPatches(itemId, patch)
    if (snapshotPatches === null) return recordCandidate
    snapshotProjectionUpdateInProgress = true
    let result: ReturnType<typeof coordination.snapshot.set>
    try {
      result = coordination.snapshot.set(snapshotPatches)
    } finally {
      snapshotProjectionUpdateInProgress = false
    }
    const accepted = result?.ok === true
    if (accepted) {
      snapshotPreviewActive = true
    }
    return accepted
  }

  /** Converts a frame delta to a controller patch and returns the accepted pixel candidate. */
  function previewFrame(delta: SelectionFrameDelta): SelectionFrameValue | null {
    const target = frameTarget
    const base = frameGestureBasePx ?? displayFramePx
    const rootWidth = sceneRootWidthPx()
    if (target === null || base === null || rootWidth === null) return null
    if (frameGestureBasePx === null) {
      frameGestureBasePx = base
      const { scene } = machine.getSnapshot().context
      frameGestureBaseAuthorRotate = scene === null
        ? authorFramePx?.rotate ?? base.rotate ?? 0
        : authoredRotationAtGestureStart(scene, target, base)
    }
    const displayedBase = frameGestureBasePx
    const authoredBaseRotate = frameGestureBaseAuthorRotate ?? authorFramePx?.rotate ?? displayedBase.rotate ?? 0
    const { scene } = machine.getSnapshot().context
    const tangentMotion = scene !== null && targetUsesTangent(scene, target)
    const rawCandidate = applyFrameDelta(displayedBase, delta)
    const candidateAuthorFrame = tangentMotion
      ? authorFrameForGesture(rawCandidate, authoredBaseRotate + (delta.kind === 'rotate' ? delta.dr : 0))
      : rawCandidate
    const candidate = tangentMotion && scene !== null
      ? displayFrameForAuthorFrame(scene, target, candidateAuthorFrame)
      : rawCandidate
    const baseOffset = frameToOffsetPatch(
      tangentMotion ? authorFrameForGesture(displayedBase, authoredBaseRotate) : displayedBase,
      rootWidth,
    )
    lastPreviewAccepted = false
    const candidateOffset = frameToOffsetPatch(candidateAuthorFrame, rootWidth)
    const frameModifications = modificationsFromDecorPatch(
      { offset: baseOffset },
      { offset: candidateOffset },
    )
    previewContentFrameOverride = candidate
    previewBorderInsetsOverride = frameBorderInsetsPx
    try {
      controller.applyPatch(modificationsToDecorPatch(frameModifications))
    } finally {
      previewContentFrameOverride = null
      previewBorderInsetsOverride = null
    }
    if (!lastPreviewAccepted) return base
    displayFramePx = candidate
    setAuthorFrame(candidateAuthorFrame, rootWidth)
    syncMotionOverlay()
    return candidate
  }

  /** Builds one copy-on-write command batch for a segment-local path edit. */
  function buildMotionPathCommands(
    scene: EditorScene,
    itemId: string,
    keyframeId: string,
    path: string | undefined,
    orientToPath?: boolean,
    endpointOffset?: OffsetPatch,
  ): Command[] {
    const item = scene.items.find((candidate) => candidate.id === itemId)
    const keyframe = item?.keyframes.find((candidate) => candidate.id === keyframeId)
    if (item === undefined || keyframe === undefined) return []
    let decorId = keyframe.decorId
    const commands: Command[] = []
    if (isDecorSharedByAnotherReference(scene, decorId, keyframeId, { includeInitialDecor: true })) {
      decorId = freshDecorId()
      commands.push({ name: 'registerDecor', args: { decorId } })
      commands.push({ name: 'assignKeyframeDecor', args: { itemId, keyframeId, decorId } })
    }
    // `undefined` is intentional here: setDecor's shallow merge clears the optional field while
    // retaining every other property of the target decor. The builder treats it as a straight
    // segment, so no null sentinel is introduced into the V2 document vocabulary.
    commands.push({
      name: 'setDecor',
      args: { decorId, patch: {
        path,
        ...(orientToPath === undefined ? {} : { orientToPath }),
        ...(endpointOffset === undefined ? {} : { offset: endpointOffset }),
      } },
    })
    return commands
  }

  /** Commits one path control-point edit without touching the source pose or sequence-editor. */
  function commitMotionPath(change: { control: { x: number; y: number }; path?: string }): void {
    const motion = activeMotion
    if (motion === null) return
    const { scene } = machine.getSnapshot().context
    if (scene === null) return
    const commands = buildMotionPathCommands(scene, motion.itemId, motion.targetKeyframeId, change.path)
    if (commands.length === 0) return
    activeMotion = { ...motion, path: change.path }
    machine.send({ type: 'RUN_TRANSACTION', commands })
    syncMotionOverlay()
  }

  /** Persists the selected path segment's orientation option on its target Decor. */
  function commitMotionPathOrientation(orientToPath: boolean): void {
    const motion = activeMotion
    if (motion === null || motion.path === undefined) return
    const { scene } = machine.getSnapshot().context
    if (scene === null) return
    const commands = buildMotionPathCommands(
      scene,
      motion.itemId,
      motion.targetKeyframeId,
      motion.path,
      orientToPath,
    )
    if (commands.length === 0) return
    activeMotion = { ...motion, orientToPath }
    machine.send({ type: 'RUN_TRANSACTION', commands })
    syncMotionOverlay()
  }

  /** Commits one pose gesture to the real KF at the playhead, or creates one between real KFs. */
  function commitMotionDrop(drop: { sourceFrame: SelectionFrameValue; targetFrame: SelectionFrameValue }): MotionOverlaySegment | null {
    const beforeFlush = machine.getSnapshot().context
    const gestureTarget = beforeFlush.scene === null
      ? null
      : resolveTarget(beforeFlush.scene, beforeFlush.selection, lastKnownTimelineMs)
    const gestureUsesTangent = beforeFlush.scene !== null
      && gestureTarget !== null
      && targetUsesTangent(beforeFlush.scene, gestureTarget)
    const convertDisplayedFrames = gestureUsesTangent
    const gestureAuthorRotate = frameGestureBaseAuthorRotate
      ?? (beforeFlush.scene !== null && gestureTarget !== null && convertDisplayedFrames
        ? authoredRotationAtGestureStart(beforeFlush.scene, gestureTarget, drop.sourceFrame)
        : authorFramePx?.rotate ?? drop.sourceFrame.rotate ?? 0)
    const sourceDocumentFrame = convertDisplayedFrames
      ? authorFrameForGesture(drop.sourceFrame, gestureAuthorRotate)
      : drop.sourceFrame
    const requestedTargetDocumentFrame = convertDisplayedFrames
      ? frameGestureBasePx !== null && authorFramePx !== null
        ? authorFramePx
        : authorFrameForGesture(drop.targetFrame, gestureAuthorRotate)
      : drop.targetFrame
    // A previous palette/CS phase may still be waiting for its host-level flush. Finish it before
    // resolving the drop so this gesture cannot be overwritten by an older pending command.
    // The current temporary pose gesture itself is committed below from the same sparse registry;
    // do not let the generic phase flush create an intermediate Decor KF before that transaction.
    const currentTemporaryEdit = pendingTemporaryDecorCommit !== null
      && pendingTemporaryDecorCommit.itemId === frameTarget?.itemId
      && Math.abs(pendingTemporaryDecorCommit.timeMs - lastKnownTimelineMs) <= 1
    if (currentTemporaryEdit) pendingTemporaryDecorCommit = null
    flushNow()
    const { scene, selection } = machine.getSnapshot().context
    if (scene === null || selection.itemIds.length !== 1) return null
    const sourceTarget = resolveTarget(scene, selection, lastKnownTimelineMs)
    if (sourceTarget === null) return null
    const item = scene.items.find((candidate) => candidate.id === sourceTarget.itemId)
    if (item === undefined) return null
    const rootWidth = sceneRootWidthPx()
    if (rootWidth === null) return null

    const selectedKeyframe = item.keyframes.find((keyframe) => keyframe.id === sourceTarget.keyframeId)
    const insertsPose = sourceTarget.isTemporary
      || (selectedKeyframe !== undefined && resolveKeyframeChannel(selectedKeyframe) === 'decor')
    const originalSegment = insertsPose
      ? resolveMotionOverlaySegments(scene, item, sourceTarget.keyframeId, rootWidth, null, lastKnownTimelineMs)
        .segments.find((segment) => segment.active === true)
      : undefined
    const requestedWaypoint = motionPathAnchorForFrame(requestedTargetDocumentFrame, frameBorderInsetsPx)
    const split = originalSegment?.path === undefined ? null : splitMotionPath(
      originalSegment.path,
      originalSegment.sourceGeometry.pathAnchor,
      requestedWaypoint,
      originalSegment.targetGeometry.pathAnchor,
      originalSegment.splitProgress ?? 0.5,
    )
    const targetDocumentFrame = split === null
      ? requestedTargetDocumentFrame
      : frameWithRotationAtPathAnchor(
        requestedTargetDocumentFrame,
        requestedTargetDocumentFrame.rotate ?? 0,
        split.waypoint,
        frameBorderInsetsPx,
      )
    const splitPatch: DecorPatch = split === null ? {} : {
      ...(split.before === undefined ? {} : { path: split.before }),
      ...(originalSegment?.orientToPath ? { orientToPath: true } : {}),
    }
    const preservedTargetPatch = originalSegment?.targetKeyframeId === undefined ? null : resolveEffectivePosePatch(
      scene, item, originalSegment.targetKeyframeId,
    )
    const preservedTargetFrame = preservedTargetPatch === null ? null : readLogicalFrame(null, item.id, preservedTargetPatch)
    const preservedTargetOffset = preservedTargetFrame === null ? undefined : mergePatch(preservedTargetPatch!, {
      offset: frameToOffsetPatch(logicalFrameToPx(preservedTargetFrame, rootWidth), rootWidth),
    }).offset
    const splitCommands = split === null || originalSegment?.targetKeyframeId === undefined
      ? []
      : buildMotionPathCommands(scene, item.id, originalSegment.targetKeyframeId, split.after, undefined, preservedTargetOffset)

    // Movement-surface frames are already content-box frames. Persist those author coordinates;
    // the builder derives the border-box layout translation at runtime.
    const targetOffset = frameToOffsetPatch(targetDocumentFrame, rootWidth)
    // A pose gesture is the explicit exception to sparse Decor capture: the new waypoint must
    // freeze the complete frame, otherwise its missing width/rotation/etc. would keep resolving
    // from a different pose and the two resulting trajectory segments would not be stable.
    const capturedPosePatch: DecorPatch = { offset: targetOffset }
    const gestureOffsetPatch = modificationsToDecorPatch(
      modificationsFromDecorPatch(
        { offset: frameToOffsetPatch(sourceDocumentFrame, rootWidth) },
        { offset: targetOffset },
      ),
    )

    if (sourceTarget.keyframeId !== null && !sourceTarget.isTemporary) {
      // An exact real KF is edited at its own time. The common decor command builder supplies the
      // copy-on-write fork, so a shared decor cannot move a neighbouring KF by accident.
      const selectedKeyframe = item.keyframes.find((keyframe) => keyframe.id === sourceTarget.keyframeId)
      if (selectedKeyframe === undefined) return null
      const editState = decorEditStates.get(decorEditStateKey(sourceTarget.itemId, lastKnownTimelineMs))
      const decorPatch = editState === undefined || editState.modifications.size === 0
        ? {}
        : modificationsToDecorPatch(editState.modifications)
      // Promoting a decoration-only point creates a new spatial waypoint at an interpolated time.
      // It therefore needs the same complete pose capture as a newly-created middle KF. An
      // already-spatial KF keeps the historical sparse movement patch: its pose endpoint already
      // exists and untouched Decor values must continue to cascade.
      const posePatch = resolveKeyframeChannel(selectedKeyframe) === 'decor'
        ? capturedPosePatch
        : gestureOffsetPatch
      const sparsePatch = { ...mergePatch(posePatch, decorPatch), ...splitPatch }
      const commands: Command[] = []
      if (resolveKeyframeChannel(selectedKeyframe) === 'decor') {
        commands.push({ name: 'setKeyframeChannel', args: { itemId: item.id, keyframeId: sourceTarget.keyframeId, channel: 'pose' } })
      }
      commands.push(...buildDecorCommands(scene, sourceTarget, sparsePatch))
      commands.push(...splitCommands)
      if (commands.length === 0) return null
      clearDecorEditState(sourceTarget.itemId, lastKnownTimelineMs)
      retainSnapshotPreviewUntilPresentation()
      machine.send({ type: 'RUN_TRANSACTION', commands })
      const committedScene = machine.getSnapshot().context.scene
      const committedItem = committedScene?.items.find((candidate) => candidate.id === item.id)
      if (committedScene === null || committedScene === undefined || committedItem === undefined) return null
      const activeSegment = activateCommittedMotion(committedItem, sourceTarget.keyframeId, rootWidth)
      syncMotionOverlay()
      return activeSegment
    }

    // With no explicit KF, a movement gesture is valid only in the strict interval between two real
    // KFs. Its document time is the current author playhead; the provisional 500 ms value belongs
    // to a future transition-window resolver and must never shift this keyframe's time.
    if (!sourceTarget.isTemporary) return null
    const alignment = resolveKeyframeAlignment(item, lastKnownTimelineMs)
    if (alignment.kind !== 'between') return null
    const targetTimeMs = Math.max(0, Math.min(lastKnownTimelineMs, scene.meta.durationMs))
    if (item.keyframes.some((keyframe) => keyframe.timeMs === targetTimeMs)) return null

    const editState = decorEditStates.get(decorEditStateKey(sourceTarget.itemId, lastKnownTimelineMs))
    const sparsePatch = {
      ...(editState === undefined
        ? capturedPosePatch
        : mergePatch(capturedPosePatch, modificationsToDecorPatch(editState.modifications))),
      ...splitPatch,
    }
    const targetPatch = patchToDecorArgs(sparsePatch, scene)
    if (targetPatch === null) return null

    const targetKeyframeId = `motion-kf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const targetDecorId = `decor-${targetKeyframeId}`
    const commands: Command[] = [
      { name: 'createNamedKeyframe', args: { itemId: item.id, keyframeId: targetKeyframeId, timeMs: targetTimeMs, channel: 'pose' } },
      { name: 'setDecor', args: { decorId: targetDecorId, patch: targetPatch } },
      ...splitCommands,
    ]
    clearDecorEditState(sourceTarget.itemId, lastKnownTimelineMs)
    retainSnapshotPreviewUntilPresentation()
    machine.send({ type: 'RUN_TRANSACTION', commands })
    const committedScene = machine.getSnapshot().context.scene
    const committedItem = committedScene?.items.find((candidate) => candidate.id === item.id)
    if (committedScene === null || committedScene === undefined || committedItem === undefined) return null
    const activeSegment = activateCommittedMotion(committedItem, targetKeyframeId, rootWidth)
    machine.send({ type: 'SELECT_ITEM', itemIds: [item.id], keyframeId: targetKeyframeId })
    coordination.requestAuthorSeek(targetTimeMs)
    syncMotionOverlay()
    return activeSegment
  }

  /** Commits every Selection Frame affine gesture through the pose-KF path immediately. */
  function commitSelectionFrameDrop(targetFrame: SelectionFrameValue): void {
    const sourceFrame = frameGestureBasePx ?? displayFramePx
    frameCommitCandidatePx = targetFrame
    try {
      if (sourceFrame !== null) {
        commitMotionDrop({ sourceFrame, targetFrame })
      }
    } finally {
      if (!snapshotCommitAwaitingPresentation) frameCommitCandidatePx = null
      frameGestureBasePx = null
      frameGestureBaseAuthorRotate = null
    }
    controller.notifyInteractionEnd()
  }

  /** Publishes one border-aware projection to the frame, trajectory, and ghost subscribers. */
  function publishMotionGeometrySnapshot(
    selectionGeometry: MotionGeometryPose | null,
    segments: readonly MotionOverlaySegment[],
    ghosts: readonly MotionOverlayGhost[],
    selectionEnabled: boolean,
  ): void {
    motionGeometry.publish({
      selection: selectionGeometry === null ? null : {
        geometry: selectionGeometry,
        enabled: selectionEnabled,
      },
      segments,
      ghosts,
      initialGhost: null,
    })
  }

  /** Synchronizes the artefact layer with the current CS selection without entering the document. */
  function syncMotionOverlay(): void {
    if (motionOverlay === null) return
    const { scene, selection } = machine.getSnapshot().context
    const target = scene === null ? null : resolveTarget(scene, selection, lastKnownTimelineMs)
    if (target === null || displayFramePx === null) {
      publishMotionGeometrySnapshot(null, [], [], false)
      return
    }
    // A temporary/interpolated pose is also a valid source for the movement gesture: releasing it
    // materializes a real KF at the current author playhead. Path editing still requires a real
    // target KF because `Decor.path` has no temporary document owner.
    const canDraw = target.keyframeId !== null || target.isTemporary
    let motion = activeMotion
    // A motion remains the active projection while the author seeks between its endpoints. When
    // another real KF is selected, however, the active segment must be reconstructed from that
    // KF's own adjacent pair; otherwise the old path would keep claiming the CS and its median.
    const targetIsEndpoint = motion !== null && target.keyframeId !== null
      && (target.keyframeId === motion.sourceKeyframeId || target.keyframeId === motion.targetKeyframeId)
    const targetIsInsideMotion = motion !== null && target.keyframeId === null
      && lastKnownTimelineMs > motion.sourceTimeMs && lastKnownTimelineMs < motion.targetTimeMs
    if (motion !== null && (motion.itemId !== target.itemId || (!targetIsEndpoint && !targetIsInsideMotion))) {
      motion = null
      activeMotion = null
    }
    const rootWidth = sceneRootWidthPx()
    const item = scene?.items.find((candidate) => candidate.id === target.itemId)
    if (scene !== null && item !== undefined && rootWidth !== null) {
      if (motion !== null) {
        const role: MotionOverlayRole = target.keyframeId === motion.sourceKeyframeId ? 'source'
          : target.keyframeId === motion.targetKeyframeId ? 'target'
            : motion.role
        motion = { ...motion, role }
        activeMotion = motion
      }
      const projected = resolveMotionOverlaySegments(
        scene,
        item,
        target.keyframeId,
        rootWidth,
        motion,
        lastKnownTimelineMs,
      )
      const projectedSegments = projected.segments
      if (motion === null && target.keyframeId !== null) {
        const activeSegment = projectedSegments.find((candidate) => candidate.active === true)
        if (activeSegment !== undefined) activeMotion = activeMotionFromSegment(item, activeSegment)
      }
      const projectedGhosts = resolveMotionOverlayGhosts(
        scene,
        item,
        target.keyframeId,
        rootWidth,
        projectedSegments,
        projected.selection,
      )
      publishMotionGeometrySnapshot(projected.selection, projectedSegments, projectedGhosts, canDraw)
      return
    }
    if (motion !== null && motion.itemId !== target.itemId) activeMotion = null
    publishMotionGeometrySnapshot(
      resolveMotionGeometryPose(displayFramePx, frameBorderInsetsPx),
      [],
      [],
      canDraw,
    )
  }

  /** Applies one coalesced root-resize projection after CodPlay has refreshed its presentation. */
  function refreshProjectionAfterResize(): void {
    resizeFrameRequest = null
    resizeProjectionQueued = false
    const rootWidth = sceneRootWidthPx()
    const { scene, selection } = machine.getSnapshot().context
    if (rootWidth === null || scene === null || selectionFrame === null) return

    // A pending CS/palette phase is not in the document yet. Keep its logical candidate, but
    // project it through the same width boundary and let syncMotionOverlay reproject both path
    // endpoints around it. Calling syncSelection here would discard that candidate.
    if ((pendingCommands !== null || pendingTemporaryDecorCommit !== null) && frameLogicalValue !== null) {
      const target = resolveTarget(scene, selection, lastKnownTimelineMs)
      const attachedPatch = target === null
        ? null
        : controller.getPatches().find((entry) => entry.itemId === target.itemId)?.patch
      const patch = attachedPatch ?? (target === null
        ? {}
        : resolveDecorEditBase(scene, target, lastKnownTimelineMs))
      const temporaryCandidate = target?.isTemporary === true
        ? coordination.decorPreview.getAt(target.itemId, lastKnownTimelineMs)
        : null
      const snapshot = target?.isTemporary === true && temporaryCandidate === null
        ? presentedSnapshotAt(lastKnownTimelineMs)
        : null
      if (target !== null) {
        frameBorderInsetsPx = resolveFrameBorderInsets(snapshot, target.itemId, patch, rootWidth)
      }
      authorFramePx = logicalFrameToPx(frameLogicalValue, rootWidth)
      displayFramePx = target === null ? authorFramePx : displayFrameForAuthorFrame(scene, target, authorFramePx)
      syncMotionOverlay()
      return
    }
    // The runtime observer runs before this deferred callback in the same rendering turn; the
    // presentation port therefore exposes the new scaled item pose when syncSelection reads it.
    syncSelection(scene, selection)
  }

  /** Coalesces root-size notifications so every overlay artefact is refreshed in one pass. */
  function scheduleProjectionAfterResize(): void {
    if (resizeProjectionQueued) return
    resizeProjectionQueued = true
    const win = sceneHost?.ownerDocument.defaultView
    if (win?.requestAnimationFrame !== undefined) {
      resizeFrameRequest = win.requestAnimationFrame(() => refreshProjectionAfterResize())
      return
    }
    queueMicrotask(refreshProjectionAfterResize)
  }

  /** Cancels a queued root-resize projection during host teardown. */
  function cancelProjectionAfterResize(): void {
    if (resizeFrameRequest !== null) {
      const win = sceneHost?.ownerDocument.defaultView
      win?.cancelAnimationFrame(resizeFrameRequest)
    }
    resizeFrameRequest = null
    resizeProjectionQueued = false
  }

  /** Selects one real keyframe and routes its author time through the sequence-editor owner. */
  function activateMotionKeyframe(itemId: string, keyframeId: string, role?: MotionOverlayRole): void {
    const { scene } = machine.getSnapshot().context
    const item = scene?.items.find((candidate) => candidate.id === itemId)
    const keyframe = item?.keyframes.find((candidate) => candidate.id === keyframeId)
    if (item === undefined || keyframe === undefined) return

    const currentMotion = activeMotion
    activeMotion = role !== undefined && currentMotion?.itemId === item.id
      ? { ...currentMotion, role }
      : null
    machine.send({ type: 'SELECT_ITEM', itemIds: [item.id], keyframeId: keyframe.id })
    coordination.requestAuthorSeek(keyframe.timeMs)
  }

  /** Creates the frame once a scene host exists and binds it to the decor-owned callbacks. */
  function mountSelectionFrame(host: HTMLElement): void {
    if (selectionFrame !== null && sceneHost === host) return
    unsubscribeSelectionGeometry?.()
    unsubscribeSelectionGeometry = null
    selectionFrame?.destroy()
    resizeObserver?.disconnect()
    sceneHost = host
    selectionFrame = createSelectionFrameV2({
      sceneRoot: host,
      // V2 capabilities are composed explicitly. Rotation remains a reusable modifier rather
      // than becoming a branch in the neutral move/resize overlay; future CS modules can be added
      // here without changing the editor bridge contract.
      modifiers: [createRotationModifier()],
      onPreview: previewFrame,
      onCommit: commitSelectionFrameDrop,
      onCancel: () => {
        frameGestureBasePx = null
        frameGestureBaseAuthorRotate = null
        abortPhase()
      },
      creation: { onCreate: commitBlockCreation },
    })
    unsubscribeSelectionGeometry = motionGeometry.subscribe(({ selection }) => {
      selectionFrame?.setValue(selection?.geometry.frame ?? null)
    })
    selectionFrame.element.style.cursor = 'move'
    // Keep the movement surface visually and hit-test-wise below the CS layer. The frame body is
    // intentionally transparent to pointer targeting so the full-frame movement surface can still
    // receive the item drag; its rotation/resize/pivot children retain pointer-events: auto.
    selectionFrame.element.style.zIndex = '1100'
    selectionFrame.element.style.pointerEvents = 'none'
    motionOverlay = createMotionOverlay(host, {
      onDrop: commitMotionDrop,
      onActivateRole: (role) => {
        const motion = activeMotion
        if (motion === null) return
        const keyframeId = role === 'source' ? motion.sourceKeyframeId : motion.targetKeyframeId
        activateMotionKeyframe(motion.itemId, keyframeId, role)
      },
      onActivateKeyframe: (keyframeId) => {
        const { scene, selection } = machine.getSnapshot().context
        const itemId = activeMotion?.itemId ?? selection.itemIds[0]
        const item = scene && itemId
          ? scene.items.find((candidate) => candidate.id === itemId)
          : undefined
        const keyframe = item?.keyframes.find((candidate) => candidate.id === keyframeId)
        if (item === undefined || keyframe === undefined) return
        // A non-active ghost changes the active segment. Let the ordinary selection/rebuild path
        // reconstruct it from this keyframe instead of retaining the previous pair.
        activateMotionKeyframe(item.id, keyframe.id)
      },
      onActivateInitial: () => {
        const { scene, selection } = machine.getSnapshot().context
        const itemId = selection.itemIds[0]
        const item = scene && itemId ? scene.items.find((candidate) => candidate.id === itemId) : undefined
        const firstKeyframe = item === undefined ? undefined : sortPoseKeyframes(item)[0]
        if (item === undefined || firstKeyframe === undefined) return
        // Selecting the route start reconstructs the first outgoing segment through the normal
        // bridge path; no separate player or timeline circuit is created for this artefact click.
        activateMotionKeyframe(item.id, firstKeyframe.id)
      },
      onPathActivate: () => {
        // The first path tranche has one control point and no secondary panel; clicking the path
        // only claims the segment so the control point is ready for the next gesture.
      },
      onPathChange: commitMotionPath,
      onPathOrientationChange: commitMotionPathOrientation,
      onDrawCancel: () => undefined,
    }, motionGeometry)
    if (activeCreationMode !== null) {
      selectionFrame.setCreationMode(selectionModeFor(activeCreationMode.placementMode))
      motionOverlay.setSuspended(playbackActive)
    }
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(([entry]) => {
        if (entry !== undefined) {
          sceneRootContentWidthPx = entry.contentBoxSize[0]?.inlineSize ?? entry.contentRect.width
        }
        scheduleProjectionAfterResize()
      })
      resizeObserver.observe(host)
    }
  }

  /** Converts one creation trace into the existing command/facade document path. */
  function commitBlockCreation(result: SelectionFrameV2CreationResult): void {
    const { scene, creatingType, creatingPlacementMode } = machine.getSnapshot().context
    if (
      scene === null
      || creatingType !== 'bloc'
      || creatingPlacementMode === null
      || rootPlacementModeForScene(scene) !== creatingPlacementMode
    ) return

    const beforeItemIds = new Set(scene.items.map((item) => item.id))
    const commands: Command[] = []
    if (creatingPlacementMode === 'fine-grid') {
      if (result.kind !== 'cell-area') return
      const zoneId = `zone-${crypto.randomUUID()}`
      commands.push(
        { name: 'createRootZone', args: { zoneId, area: result.area } },
        { name: 'createItem', args: { geometry: {}, zoneId } },
      )
    } else {
      if (result.kind !== 'rect' || sceneHost === null) return
      const rootWidth = sceneHost.clientWidth
      if (rootWidth <= 0) return
      const geometry: OffsetData = offsetValuesPxToPatch({
        x: result.rect.x,
        y: result.rect.y,
        width: result.rect.width,
        height: result.rect.height,
      }, rootWidth)
      commands.push({ name: 'createItem', args: { geometry } })
    }

    machine.send({ type: 'RUN_TRANSACTION', commands })
    const createdItem = machine.getSnapshot().context.scene?.items.find((item) => !beforeItemIds.has(item.id))
    if (createdItem === undefined) return
    machine.send({ type: 'SELECT_ITEM', itemIds: [createdItem.id] })
    machine.send({ type: 'CREATE_COMMIT' })
  }

  /** Maps the persisted root placement mode to the selection-frame V2 drawing mode. */
  function selectionModeFor(mode: RootPlacementMode) {
    if (mode === 'fine-grid') {
      const grid = ROOT_PLACEMENT_GRID['fine-grid']
      return { kind: 'grid' as const, rows: grid.rows, cols: grid.cols }
    }
    return { kind: 'free' as const }
  }

  /** Removes the frame and root observer when the scene host is unavailable. */
  function unmountSelectionFrame(): void {
    cancelProjectionAfterResize()
    resizeObserver?.disconnect()
    resizeObserver = null
    sceneRootContentWidthPx = null
    unsubscribeSelectionGeometry?.()
    unsubscribeSelectionGeometry = null
    selectionFrame?.destroy()
    selectionFrame = null
    motionOverlay?.destroy()
    motionOverlay = null
    sceneHost = null
    frameTarget = null
    authorFramePx = null
    displayFramePx = null
    frameLogicalValue = null
    seekProjectionActive = false
    frameGestureBasePx = null
    frameGestureBaseAuthorRotate = null
    frameCommitCandidatePx = null
    frameBorderInsetsPx = ZERO_CONTENT_BOX_INSETS_PX
    previewContentFrameOverride = null
    previewBorderInsetsOverride = null
    activeMotion = null
    motionGeometry.publish({ selection: null, segments: [], ghosts: [], initialGhost: null })
  }

  function syncSelection(scene: EditorScene, selection: Selection): void {
    const target = resolveTarget(scene, selection, lastKnownTimelineMs)
    if (!target) {
      frameTarget = null
      authorFramePx = null
      displayFramePx = null
      frameLogicalValue = null
      seekProjectionActive = false
      frameGestureBasePx = null
      frameGestureBaseAuthorRotate = null
      frameCommitCandidatePx = null
      frameBorderInsetsPx = ZERO_CONTENT_BOX_INSETS_PX
      previewContentFrameOverride = null
      previewBorderInsetsOverride = null
      publishMotionGeometrySnapshot(null, [], [], false)
      controller.detach()
      return
    }
    const item = scene.items.find((candidate) => candidate.id === target.itemId)
    if (item === undefined) return
    // A document-backed target no longer needs the temporary snapshot contribution. This also
    // closes the preview left by a temporary edit when a freshly created keyframe is selected.
    if (!target.isTemporary && snapshotPreviewActive && !snapshotCommitAwaitingPresentation) {
      clearSnapshotPreview()
    }

    // Un keyframe (explicite ou déduit de l'alignement playhead) se lit en cascade. Un décor
    // temporaire part de la cascade précédente puis superpose l'état logique présenté par snapshot
    // et, le cas échéant, le patch sparse de la map utilisateur. `snapshot.get()` exclut toujours
    // la preview active.
    const temporaryCandidate = target.isTemporary
      ? coordination.decorPreview.getAt(target.itemId, lastKnownTimelineMs)
      : null
    let patch: DecorPatch
    let modifiedProperties: DecorModificationMap = new Map()
    if (target.isTemporary) {
      const base = resolveDecorEditBase(scene, target, lastKnownTimelineMs)
      const editKey = decorEditStateKey(target.itemId, lastKnownTimelineMs)
      if (temporaryCandidate !== null) {
        const previousState = decorEditStates.get(editKey)
        const candidateBase = previousState?.base ?? base
        modifiedProperties = modificationsFromDecorPatch(candidateBase, temporaryCandidate.patch)
        decorEditStates.set(editKey, { base: candidateBase, modifications: modifiedProperties })
        patch = applyDecorModifications(candidateBase, modifiedProperties)
        controller.setModifiedProperties(target.itemId, [...modifiedProperties.keys()])
        // A scene rebuild destroys the runtime preview. Re-apply the accepted candidate only when
        // the player has reached its author time; the request-side `seek` notification is too early.
        const progress = coordination.transport.getProgress()
        if (progress !== null && Math.abs(progress.timelineMs - temporaryCandidate.timeMs) <= 1) {
          previewPatch(target.itemId, temporaryCandidate.patch, true)
        }
      } else {
        patch = base
        decorEditStates.delete(editKey)
        controller.setModifiedProperties(target.itemId, [])
      }
    } else if (target.keyframeId) {
      patch = resolveDecorEditBase(scene, target, lastKnownTimelineMs)
      decorEditStates.set(decorEditStateKey(target.itemId, lastKnownTimelineMs), { base: patch, modifications: new Map() })
    } else {
      patch = resolveDecorEditBase(scene, target, lastKnownTimelineMs)
      decorEditStates.set(decorEditStateKey(target.itemId, lastKnownTimelineMs), { base: patch, modifications: new Map() })
    }
    const rootWidth = sceneRootWidthPx()
    const targetKeyframeTimeMs = target.keyframeId === null
      ? null
      : item.keyframes.find((keyframe) => keyframe.id === target.keyframeId)?.timeMs ?? null
    const targetIsAtTimeline = targetKeyframeTimeMs === null
      || Math.abs(targetKeyframeTimeMs - lastKnownTimelineMs) <= 1
    // A real KF remains the document target for the trajectory, but an explicit selection can be
    // stale while the author scrubs. In that case the runtime snapshot is also the CS source; this
    // is essential for bordered items because the document endpoint alone would leave the frame on
    // the last visited KF. A temporary target uses the same snapshot unless it already has a live
    // candidate of its own.
    const readsPresentedSnapshot = target.isTemporary || (seekProjectionActive && !targetIsAtTimeline)
    const currentLogicalSnapshot = readsPresentedSnapshot
      ? presentedSnapshotAt(lastKnownTimelineMs)
      : null
    const logicalSnapshot = target.isTemporary && temporaryCandidate !== null
      ? null
      : currentLogicalSnapshot
    const posePatch = target.keyframeId === null
      ? patch
      : resolveEffectivePosePatch(scene, item, target.keyframeId, target.contentId === null ? undefined : scene.contents[target.contentId])
    const resolvedBorderInsets = rootWidth === null
      ? ZERO_CONTENT_BOX_INSETS_PX
      : resolveFrameBorderInsets(logicalSnapshot, target.itemId, patch, rootWidth)
    const logicalFrameFromState = rootWidth === null
      ? null
      : readLogicalFrame(logicalSnapshot, target.itemId, posePatch)
    const logicalFrame = logicalFrameFromState !== null
      && logicalSnapshot !== null
      && rootWidth !== null
      ? restoreSnapshotContentFrame(
        logicalSnapshot,
        target.itemId,
        logicalFrameFromState,
        resolvedBorderInsets,
        rootWidth,
      )
      : logicalFrameFromState
    frameTarget = target
    frameLogicalValue = logicalFrame
    // An exact KF is always document-authoritative. For a temporary target, the logical projection
    // is authoritative only when the snapshot belongs to the current author time; otherwise the
    // presentation port remains the safe fallback for parent transforms and stale seek handoffs.
    authorFramePx = rootWidth === null || logicalFrame === null ? null : logicalFrameToPx(logicalFrame, rootWidth)
    frameBorderInsetsPx = resolvedBorderInsets
    displayFramePx = authorFramePx === null
      ? null
      : frameCommitCandidatePx
        ?? (() => {
          return presentedContentBoxFrameForItem(target.itemId, authorFramePx.rotationOrigin)
            ?? authorFramePx
        })()
    frameGestureBasePx = null
    frameGestureBaseAuthorRotate = null
    controller.attachItems([
      {
        itemId: target.itemId,
        itemType: target.itemType,
        defaults: {},
        chain: [],
        patch,
        zones: [],
        context: 'horizontal',
        isTemporary: target.isTemporary,
        modifiedProperties: [...modifiedProperties.keys()],
      },
    ])
    syncMotionOverlay()
  }

  const unsubscribeDecorChange = controller.onDecorChange((entries) => {
    const { scene, selection } = machine.getSnapshot().context
    if (!scene) return
    const target = resolveTarget(scene, selection, lastKnownTimelineMs)
    if (!target) return
    const entry = entries.find((e) => e.itemId === target.itemId)
    if (!entry) return
    // Selection Frame edits use the pose channel. Keep their sparse registry and live preview,
    // but do not arm the generic Decor-KF flush; `commitSelectionFrameDrop` captures the affine
    // pose synchronously on pointer release. A palette edit already pending before the gesture is
    // left intact so the pose commit can merge its sparse decoration patch.
    const isFramePoseGesture = frameGestureBasePx !== null

    const editKey = decorEditStateKey(target.itemId, lastKnownTimelineMs)
    const currentState = decorEditStates.get(editKey)
    const base = currentState?.base ?? resolveDecorEditBase(scene, target, lastKnownTimelineMs)
    const modifications = setDecorEditState(entry.itemId, lastKnownTimelineMs, base, entry.patch)
    const sparsePatch = modificationsToDecorPatch(modifications)

    if (modifications.size === 0) {
      pendingCommands = null
      if (target.isTemporary) pendingTemporaryDecorCommit = null
      coordination.decorPreview.clear(entry.itemId, lastKnownTimelineMs)
      clearSnapshotPreview()
      lastPreviewAccepted = true
      return
    }

    // A temporary target is previewed through the runtime snapshot and kept in the open registry;
    // its sparse patch is committed as one new KF at the phase boundary. No interpolated value is
    // copied into the candidate merely because it was visible in the palette.
    const rootWidth = sceneRootWidthPx()
    const nextBorderInsets = rootWidth === null
      ? null
      : resolveFrameBorderInsets(null, entry.itemId, entry.patch, rootWidth)
    const authorBase = displayFramePx !== null && target.isTemporary && targetUsesTangent(scene, target)
      ? authorFrameForGesture(displayFramePx, authoredRotationAtGestureStart(scene, target, displayFramePx))
      : authorFramePx
    const authorPatch = rootWidth === null || authorBase === null
      ? null
      : mergePatch({ offset: frameToOffsetPatch(authorBase, rootWidth) }, sparsePatch)
    const logicalCandidate = authorPatch === null ? null : readLogicalFrame(null, entry.itemId, authorPatch)
    const authorCandidate = rootWidth === null || logicalCandidate === null
      ? null
      : logicalFrameToPx(logicalCandidate, rootWidth)
    const displayedCandidate = authorCandidate === null || nextBorderInsets === null || rootWidth === null
      ? displayFramePx
      : displayFrameForAuthorFrame(scene, target, authorCandidate, nextBorderInsets)
    const gesturePreview = previewContentFrameOverride
    previewContentFrameOverride = gesturePreview ?? displayedCandidate
    previewBorderInsetsOverride = nextBorderInsets
    try {
      lastPreviewAccepted = previewPatch(entry.itemId, sparsePatch, target.isTemporary)
    } finally {
      previewContentFrameOverride = gesturePreview
      previewBorderInsetsOverride = null
    }
    if (lastPreviewAccepted && nextBorderInsets !== null) {
      frameBorderInsetsPx = nextBorderInsets
      if (!isFramePoseGesture && rootWidth !== null && authorCandidate !== null && displayedCandidate !== null) {
        setAuthorFrame(authorCandidate, rootWidth)
        displayFramePx = displayedCandidate
      }
      if (!isFramePoseGesture) syncMotionOverlay()
    }
    if (target.isTemporary) {
      if (!isFramePoseGesture) {
        pendingTemporaryDecorCommit = { itemId: entry.itemId, timeMs: lastKnownTimelineMs }
        // Palette changes keep the existing host phase contract. Movement creation is handled by
        // `commitMotionDrop`, which materializes a pose KF synchronously on pointer release.
        armIdleFlush()
      }
      return
    }
    if (target.writeDecorId === null) return

    // Exact targets also stay sparse until the host phase boundary. Existing target siblings are
    // materialized only by `buildDecorCommands`, so a partial nested offset never erases a value
    // authored earlier on the same Decor.
    const commands = buildDecorCommands(scene, target, sparsePatch)
    if (!isFramePoseGesture && commands.length > 0) {
      pendingCommands = commands
      armIdleFlush()
    }
  })

  const unsubscribeInteractionEnd = controller.onInteractionEnd(() => {
    if (pendingCommands === null && pendingTemporaryDecorCommit === null) return
    if (selectionFrame?.isGestureActive()) {
      cancelIdleFlush()
      return
    }
    // `change` d'un champ palette — harmonisé (arbitrage 2026-07-17) : un signal d'activité de
    // phase comme la fin d'un geste CS, jamais un commit en soi.
    armIdleFlush()
  })

  /**
   * Raccourci « aller à kf1 » (`2026-07-17-resolved-state-at-time-notes.md`) — dedit n'a aucune
   * notion de temps/keyframe dans son propre domaine, il ne fait que demander ; c'est ce pont qui
   * résout le premier keyframe de l'item sélectionné et déclenche le `SEEK` (même chemin qu'un
   * scrub réel — flush, resynchro CS, resynchro palette en découlent déjà tous).
   */
  const unsubscribeSnapToFirstKeyframe = controller.onSnapToFirstKeyframeRequest(() => {
    const { scene, selection } = machine.getSnapshot().context
    const itemId = selection.itemIds[0]
    const item = scene && itemId ? scene.items.find((i) => i.id === itemId) : undefined
    const firstKeyframe = item ? [...item.keyframes].sort((a, b) => a.timeMs - b.timeMs)[0] : undefined
    if (firstKeyframe) machine.send({ type: 'SEEK', timelineMs: firstKeyframe.timeMs })
  })

  const unsubscribeCommitted = machine.on('sceneCommitted', ({ scene, selection }) => {
    ensureMounted()
    const key = selectionKey(selection)
    // Signal 1 — changement de sélection : flush avant de resynchroniser la palette sur la
    // nouvelle cible, quelle que soit l'origine (timeline, clic hors CS, etc.).
    if (key !== lastSelectionKey) {
      flushNow()
      // A deliberate selection (timeline item/KF or ghost) re-establishes its own target. A seek
      // without a selection change must keep following the runtime time instead of the last KF.
      seekProjectionActive = false
    } else if (scene !== lastObservedScene && pendingCommands !== null) {
      // Signal 5 — mutation externe du document (ex. édition timeline) survenue pendant une phase
      // décor en cours : notre propre flush vide `pendingCommands` AVANT d'émettre son propre
      // commit, donc son écho ne peut jamais retomber dans cette branche (pas de boucle).
      flushNow()
    }
    lastSelectionKey = key
    lastObservedScene = scene
    reconcileConsumedTemporaryDecor(scene)
    syncSelection(scene, selection)
  })
  const unsubscribeLoaded = machine.on('sceneLoaded', ({ scene }) => {
    // Un chargement de document supplante toute phase en cours — rien à committer, rien à préserver.
    cancelIdleFlush()
    pendingCommands = null
    pendingTemporaryDecorCommit = null
    decorEditStates.clear()
    coordination.snapshot.clear()
    snapshotPreviewActive = false
    seekProjectionActive = false
    snapshotCommitAwaitingPresentation = false
    frameCommitCandidatePx = null
    coordination.decorPreview.clearAll()
    ensureMounted()
    const selection = machine.getSnapshot().context.selection
    syncSelection(scene, selection)
    lastObservedScene = scene
    lastSelectionKey = selectionKey(selection)
  })
  const unsubscribeReverted = machine.on('sceneReverted', ({ scene }) => {
    pendingTemporaryDecorCommit = null
    decorEditStates.clear()
    coordination.snapshot.clear()
    snapshotPreviewActive = false
    seekProjectionActive = false
    snapshotCommitAwaitingPresentation = false
    frameCommitCandidatePx = null
    coordination.decorPreview.clearAll()
    const selection = machine.getSnapshot().context.selection
    syncSelection(scene, selection)
  })
  // Signal 3 — seek de l'auteur : flush immédiat (le rebuild qui suit rejoue la position demandée).
  // Resynchronise aussi la palette après coup — l'alignement kf/décor temporaire dépend de
  // `lastKnownTimelineMs` (`2026-07-17-resolved-state-at-time-notes.md`) ; sans ce resync explicite,
  // un seek qui ne flush rien (rien en attente) laisserait la palette affichant l'instant précédent.
  const unsubscribeSeek = machine.on('seek', ({ timelineMs }) => {
    lastKnownTimelineMs = timelineMs
    snapshotCommitAwaitingPresentation = false
    frameCommitCandidatePx = null
    // The controller intentionally retains the last explicit KF until scrub release. The visual
    // CS must nevertheless follow the time being sought, including when that selection is stale.
    seekProjectionActive = true
    flushNow()
    // A temporary snapshot belongs to the old presented time. Keep its coordination candidate
    // for a possible return to that time, but clear the runtime preview before the asynchronous
    // seek so it cannot paint the old edit over the new base frame.
    if (snapshotPreviewActive) {
      clearSnapshotPreview()
    }
    const { scene, selection } = machine.getSnapshot().context
    if (scene) syncSelection(scene, selection)
  })
  /**
   * `'seek'` ci-dessus est émis à la DEMANDE (synchrone), avant que `telco.seek()` (asynchrone,
   * `scene-player-bridge.ts`) n'ait réellement appliqué la position au runtime — le
   * `syncSelection` immédiat ci-dessus capture donc systématiquement l'état D'AVANT le seek pour
   * tout champ lu dans le snapshot temporaire. Bug constaté en direct : la couleur d'un décor
   * temporaire restait figée sur le keyframe précédent pendant qu'un scrub répété faisait
   * progresser la position. Le CS, lui, est resynchronisé depuis `instance.presentation` au même
   * rendez-vous de fin ; `'seekApplied'` referme aussi l'écart de palette sans nouvel appel
   * `telco.seek()`.
   */
  const unsubscribeSeekApplied = machine.on('seekApplied', () => {
    if (snapshotCommitAwaitingPresentation) {
      snapshotCommitAwaitingPresentation = false
      frameCommitCandidatePx = null
      // The contribution belonged to the old instance, which the rebuild has now discarded.
      clearSnapshotPreview(false)
    }
    const { scene, selection } = machine.getSnapshot().context
    if (scene) syncSelection(scene, selection)
  })
  // Signal 6 — play demandé : flush immédiat AVANT `telco.play()` (`PLAY_REQUEST`, `types.ts`) —
  // sans ça une édition tout juste faite peut rester en attente pendant tout le play qui suit.
  const unsubscribeFlushPending = machine.on('flushPending', () => flushNow())

  /**
   * État `playing` (`2026-07-17-play-mode-decor-editor-deactivation-plan.md`) — aucune écriture de
   * preview live pendant que `isPlaying === true`. Le pont `scenePlayer` conserve l'instance pour
   * un simple Play/Seek et réapplique la pose runtime avant de jouer ; le gel empêche donc la
   * palette de réinjecter une preview périmée pendant ce handoff.
   * `mountHandle.setPreviewSuspended` — pas `controller.detach()` — préserve le panneau actif et les
   * toggles (`visualPosition`/`zoneMode`) à travers un cycle play→pause : `ITEMS.DETACH` les
   * réinitialise (vérifié dans `decor-editor/machine.ts`), ce que ce chantier ne veut pas faire pour
   * un simple play/pause. `syncSelection` à la sortie : la resynchronisation se fait sur le node
   * dont la pose a déjà été réappliquée par le runtime, `setPreviewSuspended(false)` déclenche alors
   * une seule écriture, déjà à jour.
   */
  const unsubscribePlaybackActive = machine.on('playbackActiveChanged', ({ active }) => {
    playbackActive = active
    if (active) {
      mountHandle?.setPreviewSuspended(true)
      selectionFrame?.setSuspended(true)
      motionOverlay?.setSuspended(true)
      return
    }
    ensureMounted()
    const { scene, selection } = machine.getSnapshot().context
    if (scene) syncSelection(scene, selection)
    mountHandle?.setPreviewSuspended(false)
    selectionFrame?.setSuspended(false)
    motionOverlay?.setSuspended(false)
  })
  const unsubscribePlaybackReconciled = coordination.onPlaybackReconciled((timelineMs) => {
    lastKnownTimelineMs = timelineMs
    const { scene, selection } = machine.getSnapshot().context
    if (scene) syncSelection(scene, selection)
  })

  const unsubscribeCreationMode = machine.on('creationModeChanged', ({ mode }) => {
    activeCreationMode = mode
    selectionFrame?.setCreationMode(mode === null ? null : selectionModeFor(mode.placementMode))
    motionOverlay?.setSuspended(playbackActive || mode !== null)
    if (mode === null) {
      const { scene, selection } = machine.getSnapshot().context
      if (scene) syncSelection(scene, selection)
    }
  })

  const unsubscribeSceneHost = coordination.onSceneHostChange((host) => {
    if (host === null) {
      unmountSelectionFrame()
      return
    }
    mountSelectionFrame(host)
    const { scene, selection } = machine.getSnapshot().context
    if (scene) syncSelection(scene, selection)
  })

  ensureMounted()
  const initial = machine.getSnapshot().context
  if (initial.scene) syncSelection(initial.scene, initial.selection)
  lastObservedScene = initial.scene
  lastSelectionKey = selectionKey(initial.selection)

  return {
    destroy(): void {
      cancelIdleFlush()
      document.removeEventListener('keydown', onKeyDown, { capture: true })
      unsubscribeSeek.unsubscribe()
      unsubscribeSeekApplied.unsubscribe()
      unsubscribeFlushPending.unsubscribe()
      unsubscribePlaybackActive.unsubscribe()
      unsubscribeCreationMode.unsubscribe()
      unsubscribePlaybackReconciled()
      pendingCommands = null
      pendingTemporaryDecorCommit = null
      decorEditStates.clear()
      unsubscribeCommitted.unsubscribe()
      unsubscribeLoaded.unsubscribe()
      unsubscribeReverted.unsubscribe()
      unsubscribeSceneHost()
      unsubscribeDecorChange()
      unsubscribeSelectionGeometry?.()
      unsubscribeSelectionGeometry = null
      unsubscribeInteractionEnd()
      unsubscribeSnapToFirstKeyframe()
      mountHandle?.destroy()
      cancelProjectionAfterResize()
      resizeObserver?.disconnect()
      selectionFrame?.destroy()
      motionOverlay?.destroy()
      motionOverlay = null
      frameGestureBasePx = null
      frameGestureBaseAuthorRotate = null
      frameCommitCandidatePx = null
      snapshotCommitAwaitingPresentation = false
      controller.destroy()
    },
  }
}
