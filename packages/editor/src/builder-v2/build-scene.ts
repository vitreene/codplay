import {
  AutoCapsule,
  DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS,
  EVENT_ACTION,
  resolveAutoCapsuleDefaults,
} from '@codplay/capsule-automation'
import type {
  AutoCapsuleChildElementArtifact,
  AutoCapsuleChildInput,
  AutoCapsuleChildPlacementInput,
  AutoCapsuleEventInput,
  AutoCapsuleType,
} from '@codplay/capsule-automation'
import type { CapsuleBoundsOutput, ResolvedNodeBounds } from '@codplay/capsule-automation'
import type { Move, PersoDoc, SceneDoc } from 'codplay'
import { parseEase, prepareSvgPath } from 'ace'
import { resolveKeyframeChannel } from '../app/commands/types'
import { childrenOf, resolveSceneBounds, ROOT_CAPSULE_DEFAULT_KIND } from '../scene-bounds/scene-bounds'
import type { CapsuleDef, EditorScene, Item, Keyframe, Zone } from '../app/commands/types'
import { hasExplicitPlacementGeometry } from '../app/commands/offset-placement'
import { isItemVisible } from '../app/commands/item-visibility/item-visibility'
import { resolveKeyframeTransition, resolveSegmentMotionPath, resolveSegmentTiming } from './keyframe-transition'
import { normalizeMotionEasing } from '../motion-editor/easing'
import { normalizeAngleDegrees } from '../motion-editor/geometry'
import { resolveInitialPathRotation } from '../motion-editor/item-rotation/item-rotation'
import { ITEM_MOTION_REFERENCE_ANGLE, ITEM_MOTION_ROTATION_BASELINE } from '../item-presentation/item-motion-reference'
import {
  resolveTangentJoinRotationOffset,
  resolveTangentReferenceAngle,
  resolveTangentSegmentAngle,
  type MotionProjection,
} from './item-rotation/tangent-reference'
import { OFFSET_STYLE_PROPERTIES } from '../decor-editor/units'
import {
  computeStyleDiff,
  hasZoneAssignment,
  isInterpolableStylePair,
  resolveInitialClassName,
  resolveInitialOffset,
  resolveInitialStyle,
  resolveKeyframeDecorStyle,
  resolveStyleDefaultsForTarget,
  resolveKeyframeClassName,
  resolveKeyframePoseStyle,
  resolveKeyframeOffset,
  resolveKeyframeStyle,
  sortDecorationKeyframes,
  resolveRootClassName,
  resolveRootStyle,
} from './decor-resolution'
import {
  EDITOR_V2_ROOT_PERSO_ID,
  EDITOR_V2_STORY_ID,
  type BuildSceneV2Failure,
  type BuildSceneV2Result,
  type StyleDefaultCapture,
  type StyleDefaultRequest,
  type BuilderDiagnostic,
} from './types'

/** Builds the native V2 SceneDoc for the currently supported editor scene slice. */
export function buildSceneDocV2(
  scene: EditorScene,
  styleDefaultsByItem: ReadonlyMap<string, StyleDefaultCapture> = new Map(),
  projection?: MotionProjection,
): BuildSceneV2Result {
  const compilationScene = { ...scene, items: itemsForCompilation(scene.items) }
  const diagnostics = validateSceneInput(compilationScene)
  if (diagnostics.some((diagnostic) => diagnostic.level === 'error')) {
    return failure(diagnostics)
  }

  const rootItems = childrenOf(compilationScene.items, null)
  const rootCapsule = compilationScene.rootCapsule
  const rootCapsuleType = rootCapsule?.kind ?? ROOT_CAPSULE_DEFAULT_KIND
  const bounds = resolveSceneBounds(compilationScene)
  diagnostics.push(...bounds.diagnostics.map((diagnostic) => error(
    'EDITOR_V2_CAPSULE_RESOLUTION_FAILED',
    diagnostic.message,
    { capsuleType: diagnostic.kind, itemCount: diagnostic.childCount, ...(diagnostic.capsuleId === null ? {} : { itemId: diagnostic.capsuleId }) },
  )))
  if (diagnostics.some((diagnostic) => diagnostic.level === 'error')) return failure(diagnostics)
  const preRollMs = bounds.preRollMs

  const rootZones = zonesForCapsule(compilationScene, null)
  const rootResolution = resolveCapsule(rootItems, rootCapsuleType, bounds, diagnostics, {
    sceneRoot: true,
    grid: rootCapsule?.grid,
    targetPlacements: resolveZoneTargetPlacements(rootZones),
    transitionDefaults: resolveAutoCapsuleDefaults(rootCapsuleType, {
      introTransitionRef: rootCapsule?.defaultTransitionIn,
      outroTransitionRef: rootCapsule?.defaultTransitionOut,
    }),
  })
  if (rootResolution === undefined || diagnostics.some((diagnostic) => diagnostic.level === 'error')) {
    return failure(diagnostics)
  }

  const rootPerso: PersoDoc<'list'> = buildRootPerso(compilationScene, rootResolution.rootArtifact.className)
  const persos: Array<V2Perso> = [rootPerso]
  const eventimes: Array<{ name: string; startAt: number }> = []
  const styleDefaultRequests: StyleDefaultRequest[] = []
  const styleSheets: string[] = [rootResolution.styleSheet]
  const stackRules = new Set<string>()
  type WorkItem = Readonly<{
    items: Item[]
    capsuleId: string | null
    parentPersoId: string
    resolution: CapsuleResolution
  }>
  const worklist: WorkItem[] = [{ items: rootItems, capsuleId: null, parentPersoId: EDITOR_V2_ROOT_PERSO_ID, resolution: rootResolution }]

  while (worklist.length > 0) {
    const current = worklist.shift()!
    const zones = zonesForCapsule(compilationScene, current.capsuleId)
    persos.push(...zones.flatMap((zone) => {
      const targetId = zoneTargetPersoId(zone.id)
      const childArtifact = current.resolution.childArtifactById.get(targetId)
      if (childArtifact === undefined) {
        diagnostics.push(error('EDITOR_V2_ZONE_TARGET_UNRESOLVED', `No capsule artifact was produced for zone '${zone.id}'.`, { zoneId: zone.id, capsuleId: current.capsuleId }))
        return []
      }
      return [buildZoneTargetPerso(zone, current.parentPersoId, childArtifact)]
    }))
    for (const [stackOrder, item] of current.items.entries()) {
      stackRules.add(`.editor-stack-${stackOrder}{z-index:${stackOrder}}`)
      const childArtifact = current.resolution.childArtifactById.get(item.id)
      if (childArtifact === undefined) {
        diagnostics.push(error('EDITOR_V2_CAPSULE_CHILD_UNRESOLVED', `No capsule artifact was produced for item '${item.id}'.`, { itemId: item.id }))
        continue
      }

      if (item.type === 'capsule') {
        const nested = buildNestedCapsulePerso(compilationScene, item, current.parentPersoId, childArtifact, stackOrder, bounds, diagnostics)
        if (nested === undefined) continue
        persos.push(nested.perso)
        eventimes.push(...nested.eventimes)
        styleSheets.push(nested.resolution.styleSheet)
        worklist.push({
          items: childrenOf(compilationScene.items, item.id),
          capsuleId: item.id,
          parentPersoId: item.id,
          resolution: nested.resolution,
        })
        continue
      }

      const leaf = buildLeafPerso(
        compilationScene, item, current.parentPersoId, childArtifact, preRollMs, diagnostics,
        styleDefaultsByItem.get(item.id), styleDefaultRequests, stackOrder, projection,
      )
      persos.push(...leaf.persos)
      eventimes.push(...leaf.eventimes)
    }
  }

  if (diagnostics.some((diagnostic) => diagnostic.level === 'error')) return failure(diagnostics)
  styleSheets.push([...stackRules].join('\n'))

  const sceneDoc: SceneDoc = {
    id: compilationScene.id,
    name: compilationScene.meta.title,
    stories: {
      [EDITOR_V2_STORY_ID]: {
        id: EDITOR_V2_STORY_ID,
        name: 'main',
        persos,
        eventimes,
      },
    },
  }

  return {
    ok: true,
    sceneDoc,
    durationMs: scene.meta.durationMs,
    preRollMs,
    styleSheet: styleSheets.filter((styleSheet) => styleSheet.trim() !== '').join('\n'),
    rootGrid: rootResolution.grid,
    styleDefaultRequests,
    // The browser bridge sends styleSheet to codplay.preload.css.set(). Content URLs are derived
    // by CodPlay.build(), so no URL is invented at this pure builder boundary.
    preloadManifest: { entries: [] },
    diagnostics,
  }
}

/** Validates the supported scene graph without returning a partial SceneDoc. */
function validateSceneInput(scene: EditorScene): BuilderDiagnostic[] {
  const diagnostics: BuilderDiagnostic[] = []
  if (scene.id.trim() === '') diagnostics.push(error('EDITOR_V2_SCENE_ID_INVALID', 'scene.id must not be empty.'))
  if (!Number.isFinite(scene.meta.durationMs) || scene.meta.durationMs < 0) {
    diagnostics.push(error('EDITOR_V2_DURATION_INVALID', 'scene.meta.durationMs must be a finite non-negative number.'))
  }

  const itemById = new Map<string, Item>()
  for (const item of scene.items) {
    if (item.id.trim() === '') {
      diagnostics.push(error('EDITOR_V2_ITEM_ID_INVALID', 'The mapped item id must not be empty.', { itemId: item.id }))
    } else if (itemById.has(item.id)) {
      diagnostics.push(error('EDITOR_V2_ITEM_ID_DUPLICATED', `Item id '${item.id}' is duplicated.`, { itemId: item.id }))
    } else {
      itemById.set(item.id, item)
    }
  }

  for (const zone of Object.values(scene.zones)) {
    if (itemById.has(zoneTargetPersoId(zone.id))) {
      diagnostics.push(error('EDITOR_V2_ZONE_TARGET_ID_COLLISION', `Zone '${zone.id}' resolves to an existing item id.`, { zoneId: zone.id, targetId: zoneTargetPersoId(zone.id) }))
    }
  }

  for (const item of scene.items) {
    validateItemInput(scene, item, itemById, diagnostics)
  }
  validateRootDecor(scene, diagnostics)
  validateParentGraph(scene.items, itemById, diagnostics)
  return diagnostics
}

/** Removes hidden items and descendants before Editor projects the document into V2. */
function itemsForCompilation(items: readonly Item[]): Item[] {
  const itemById = new Map(items.map((item) => [item.id, item]))
  return items.filter((item) => isItemVisible(item, itemById))
}

/** Validates the implicit scene-root decor with the same zone rules as item decors. */
function validateRootDecor(scene: EditorScene, diagnostics: BuilderDiagnostic[]): void {
  if (scene.rootDecorId === undefined) return
  const decor = scene.decors[scene.rootDecorId]
  if (decor === undefined) {
    diagnostics.push(error('EDITOR_V2_DECOR_NOT_FOUND', `Decor '${scene.rootDecorId}' is not present.`, { decorId: scene.rootDecorId, target: 'scene-root' }))
    return
  }
  if (hasZoneAssignment(decor)) diagnostics.push({
    level: 'warning',
    code: 'EDITOR_V2_ZONE_DEFERRED',
    message: 'The root Decor.zoneId is preserved in the editor model but zone materialization is deferred to the post-V2 zones tranche.',
    context: { decorId: decor.id, zoneId: decor.zoneId, target: 'scene-root' },
  })
}

/** Validates one item and the decor/content references consumed by its V2 mapping. */
function validateItemInput(
  scene: EditorScene,
  item: Item,
  itemById: ReadonlyMap<string, Item>,
  diagnostics: BuilderDiagnostic[],
): void {
  if (!['bloc', 'text', 'image', 'video', 'media', 'capsule'].includes(item.type)) {
    diagnostics.push(error('EDITOR_V2_ITEM_TYPE_UNSUPPORTED', `Item type '${item.type}' is not part of the V2 editor mapping.`, { itemId: item.id }))
  }
  if (item.parentId !== null && !itemById.has(item.parentId)) {
    diagnostics.push(error('EDITOR_V2_PARENT_NOT_FOUND', `Parent item '${item.parentId}' is not present.`, { itemId: item.id, parentId: item.parentId }))
  } else if (item.parentId !== null && itemById.get(item.parentId)?.type !== 'capsule') {
    diagnostics.push(error('EDITOR_V2_PARENT_NOT_CAPSULE', `Item '${item.id}' cannot be placed under non-capsule parent '${item.parentId}'.`, { itemId: item.id, parentId: item.parentId }))
  }

  const keyframes = sortKeyframes(item)
  if (keyframes.some((keyframe) => !Number.isFinite(keyframe.timeMs) || keyframe.timeMs < 0)) {
    diagnostics.push(error('EDITOR_V2_KEYFRAME_TIME_INVALID', 'Keyframe times must be finite non-negative numbers.', { itemId: item.id }))
  }
  for (const keyframe of keyframes) {
    if (keyframe.id.trim() === '') {
      diagnostics.push(error('EDITOR_V2_KEYFRAME_ID_INVALID', 'Keyframe ids must not be empty.', { itemId: item.id }))
    }
    if (keyframe.channel !== undefined && keyframe.channel !== 'pose' && keyframe.channel !== 'decor') {
      diagnostics.push(error('EDITOR_V2_KEYFRAME_CHANNEL_INVALID', `Keyframe channel '${String(keyframe.channel)}' is unsupported.`, { itemId: item.id, keyframeId: keyframe.id }))
    }
    for (const transition of [keyframe.transitionIn, keyframe.transitionOut]) {
      if (transition !== undefined && (!Number.isFinite(transition.durationMs) || transition.durationMs < 0)) {
        diagnostics.push(error('EDITOR_V2_TRANSITION_DURATION_INVALID', 'Transition durations must be finite non-negative numbers.', { itemId: item.id, keyframeId: keyframe.id }))
      }
      if (transition?.kind === 'named' && transition.name !== '--' && DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS[transition.name] === undefined) {
        diagnostics.push(error('EDITOR_V2_TRANSITION_NOT_FOUND', `Named transition '${transition.name}' is not in the capsule-automation catalog.`, { itemId: item.id, keyframeId: keyframe.id, transition: transition.name }))
      }
      if (transition?.kind === 'interpolated') {
        const ease = normalizeMotionEasing(transition.easing)
        try {
          parseEase(ease)
        } catch (cause) {
          diagnostics.push(error(
            'EDITOR_V2_EASING_UNSUPPORTED',
            cause instanceof Error ? cause.message : `Easing '${ease}' is not supported by ACE.`,
            { itemId: item.id, keyframeId: keyframe.id, ease },
          ))
        }
      }
    }
  }

  const content = item.contentId === null ? undefined : scene.contents[item.contentId]
  if (item.contentId !== null && content === undefined) {
    diagnostics.push(error('EDITOR_V2_CONTENT_NOT_FOUND', `Content '${item.contentId}' is not present.`, { itemId: item.id, contentId: item.contentId }))
  }
  if (item.type === 'capsule') {
    if (item.contentId !== null) {
      diagnostics.push(error('EDITOR_V2_CAPSULE_CONTENT_UNSUPPORTED', 'A capsule item does not map a Content record.', { itemId: item.id, contentId: item.contentId }))
    }
    if (item.capsule === undefined) {
      diagnostics.push(error('EDITOR_V2_CAPSULE_DEFINITION_MISSING', `Capsule item '${item.id}' requires Item.capsule.`, { itemId: item.id }))
    } else if (item.capsule.kind !== 'carousel' && item.capsule.distribution === undefined) {
      diagnostics.push(error('EDITOR_V2_CAPSULE_DISTRIBUTION_MISSING', `Capsule '${item.id}' requires an explicit distribution for type '${item.capsule.kind}'.`, { itemId: item.id, capsuleType: item.capsule.kind }))
    }
  }

  const expectedContentTypes: Partial<Record<Exclude<Item['type'], 'capsule'>, Item['type']>> = {
    text: 'text',
    bloc: 'bloc',
    image: 'image',
    video: 'video',
    media: 'media',
  }
  if (content !== undefined && item.type !== 'capsule' && expectedContentTypes[item.type] !== content.type) {
    diagnostics.push(error('EDITOR_V2_CONTENT_TYPE_UNSUPPORTED', `Content type '${content.type}' does not match item type '${item.type}'.`, { itemId: item.id, contentId: content.id }))
  }
  if ((item.type === 'video' || item.type === 'media') && content?.source === undefined) {
    diagnostics.push(error('EDITOR_V2_MEDIA_SOURCE_MISSING', `Media item '${item.id}' requires Content.source.`, { itemId: item.id, contentId: item.contentId }))
  }

  const decorIds = [item.initialDecorId, ...keyframes.map((keyframe) => keyframe.decorId)]
  for (const decorId of [...new Set(decorIds)]) {
    if (scene.decors[decorId] === undefined) {
      diagnostics.push(error('EDITOR_V2_DECOR_NOT_FOUND', `Decor '${decorId}' is not present.`, { itemId: item.id, decorId }))
    }
  }
  for (const decor of [...new Set(decorIds)].map((decorId) => scene.decors[decorId])) {
    if (decor?.zoneId == null) continue
    const zone = scene.zones[decor.zoneId]
    if (zone === undefined) {
      diagnostics.push(error('EDITOR_V2_ZONE_NOT_FOUND', `Zone '${decor.zoneId}' is not present.`, { itemId: item.id, decorId: decor.id, zoneId: decor.zoneId }))
      continue
    }
    if (zone.capsuleId !== item.parentId) {
      diagnostics.push(error('EDITOR_V2_ZONE_PARENT_MISMATCH', `Zone '${zone.id}' does not belong to the capsule that contains item '${item.id}'.`, { itemId: item.id, zoneId: zone.id, parentId: item.parentId, zoneParentId: zone.capsuleId }))
    }
  }
  for (const keyframe of item.keyframes) {
    const decor = scene.decors[keyframe.decorId]
    if (resolveKeyframeChannel(keyframe) === 'decor'
      && decor !== undefined
      && Object.prototype.hasOwnProperty.call(decor, 'zoneId')) {
      diagnostics.push(error(
        'EDITOR_V2_ZONE_KEYFRAME_CHANNEL_INVALID',
        `Zone assignment for item '${item.id}' must be placed on a pose keyframe.`,
        { itemId: item.id, keyframeId: keyframe.id, decorId: decor.id },
      ))
    }
  }
  if (keyframes[0]?.transitionIn?.kind === 'interpolated') {
    diagnostics.push(error('EDITOR_V2_FIRST_INTRO_UNSUPPORTED', 'The first keyframe intro must use a named transition in this increment.', { itemId: item.id }))
  }
}

/** Verifies that the flat parent links form a rooted acyclic editor tree. */
function validateParentGraph(
  items: readonly Item[],
  itemById: ReadonlyMap<string, Item>,
  diagnostics: BuilderDiagnostic[],
): void {
  for (const item of items) {
    const visited = new Set<string>()
    let current: Item | undefined = item
    while (current?.parentId !== null && current?.parentId !== undefined) {
      if (visited.has(current.id)) {
        diagnostics.push(error('EDITOR_V2_PARENT_CYCLE', `Parent cycle detected from item '${item.id}'.`, { itemId: item.id }))
        break
      }
      visited.add(current.id)
      current = itemById.get(current.parentId)
      if (current === undefined) break
    }
  }
}

/** Names the private frame class that maps sibling order to rendered stack order. */
function stackClassName(stackOrder: number): string {
  return `editor-stack-${stackOrder}`
}

type V2LeafPerso = PersoDoc<'tag'> | PersoDoc<'img'> | PersoDoc<'media'>
type V2Perso = PersoDoc<'list'> | V2LeafPerso
type ClassNameAction = Readonly<{ add?: string; remove?: string }>
type DecorAction = Readonly<{
  name: string
  style?: Record<string, unknown>
  className?: ClassNameAction
  startAt: number
  move?: Move
}>

type CapsuleResolution = Readonly<{
  rootArtifact: Readonly<{ className: string }>
  childArtifactById: ReadonlyMap<string, AutoCapsuleChildElementArtifact>
  styleSheet: string
  grid: Readonly<{ rows: number; cols: number }>
}>

/** Returns zones declared on one capsule so their targets share that capsule's grid. */
function zonesForCapsule(scene: EditorScene, capsuleId: string | null): Zone[] {
  return Object.values(scene.zones).filter((zone) => zone.capsuleId === capsuleId)
}

/** Resolves each declared zone through Capsule Automation's existing child-placement input. */
function resolveZoneTargetPlacements(zones: readonly Zone[]): ReadonlyMap<string, AutoCapsuleChildPlacementInput> {
  return new Map(zones.map((zone) => {
    const { row, col, rowSpan, colSpan } = zone.surfaces.landscape
    return [zoneTargetPersoId(zone.id), { row, col, rowSpan, colSpan }]
  }))
}

/** Gives each editor zone a stable V2 structural target without adding it to the authored item tree. */
function zoneTargetPersoId(zoneId: string): string {
  return `editor-zone-target:${zoneId}`
}

/** Resolves a pose keyframe's zone by folding explicit assignments over the initial decor. */
function resolveZoneIdAtPoseKeyframe(scene: EditorScene, item: Item, keyframe: Keyframe): string | null {
  const poseKeyframes = sortPoseKeyframes(item)
  const targetIndex = poseKeyframes.findIndex((candidate) => candidate.id === keyframe.id)
  const initialDecor = scene.decors[item.initialDecorId]
  let zoneId = initialDecor?.zoneId ?? null
  for (const poseKeyframe of poseKeyframes.slice(0, targetIndex + 1)) {
    const decor = scene.decors[poseKeyframe.decorId]
    if (decor !== undefined && Object.prototype.hasOwnProperty.call(decor, 'zoneId')) {
      zoneId = decor.zoneId ?? null
    }
  }
  return zoneId
}

/** Resolves the target zone represented by the item's initial pose in the Builder projection. */
function resolveInitialZoneId(scene: EditorScene, item: Item, firstPoseKeyframe: Keyframe | undefined): string | null {
  if (firstPoseKeyframe !== undefined) return resolvePlacementZoneIdAtPoseKeyframe(scene, item, firstPoseKeyframe)
  const zoneId = scene.decors[item.initialDecorId]?.zoneId ?? null
  return hasExplicitPlacementGeometry(resolveInitialOffset(scene, item)) ? null : zoneId
}

/** Lets explicit x/y/width/height geometry own placement while retaining the zone reference. */
function resolvePlacementZoneIdAtPoseKeyframe(scene: EditorScene, item: Item, keyframe: Keyframe): string | null {
  if (hasExplicitPlacementGeometry(resolveKeyframeOffset(scene, item, keyframe))) return null
  return resolveZoneIdAtPoseKeyframe(scene, item, keyframe)
}

/** Keeps an item in its capsule unless its decor assigns it to one of that capsule's zones. */
function resolveMoveTarget(parentPersoId: string, zoneId: string | null): string {
  if (zoneId === null) return parentPersoId
  return zoneTargetPersoId(zoneId)
}

/** Builds zone-reassignment Move actions for capsule items using CodPlay's existing target motion. */
function buildZoneMoveActions(
  scene: EditorScene,
  item: Item,
  parentPersoId: string,
  poseKeyframes: readonly Keyframe[],
  preRollMs: number,
): DecorAction[] {
  return poseKeyframes.slice(1).flatMap((destination, index) => {
    const source = poseKeyframes[index]!
    const sourceZoneId = resolvePlacementZoneIdAtPoseKeyframe(scene, item, source)
    const destinationZoneId = resolvePlacementZoneIdAtPoseKeyframe(scene, item, destination)
    if (sourceZoneId === destinationZoneId) return []

    const { durationMs, ease, startAtMs } = resolveKeyframeTransition(source, destination)
    const actionName = `${item.id}-zone-kf-${destination.id}`
    return [{
      name: actionName,
      move: {
        target: resolveMoveTarget(parentPersoId, destinationZoneId),
        transition: { duration: durationMs, ease },
      },
      startAt: startAtMs + preRollMs,
    }]
  })
}

/** Builds the implicit scene-root list and keeps its authored decor separate from layout CSS. */
function buildRootPerso(scene: EditorScene, generatedClassName: string): PersoDoc<'list'> {
  const rootClassName = resolveRootClassName(scene)
  const className = [rootClassName, generatedClassName].filter(Boolean).join(' ') || undefined
  const rootStyle = resolveRootStyle(scene)
  return {
    id: EDITOR_V2_ROOT_PERSO_ID,
    name: 'root',
    type: 'list',
    initial: {
      move: '@root',
      tag: 'div',
      ...(className === undefined ? {} : { className }),
      ...(Object.keys(rootStyle).length > 0 ? { style: rootStyle } : {}),
    },
    actions: {},
  }
}

/** Builds one invisible structural target whose grid area is owned by Capsule Automation. */
function buildZoneTargetPerso(
  zone: Zone,
  parentPersoId: string,
  childArtifact: AutoCapsuleChildElementArtifact,
): PersoDoc<'list'> {
  return {
    id: zoneTargetPersoId(zone.id),
    name: zone.name,
    type: 'list',
    initial: {
      move: { target: parentPersoId },
      tag: 'div',
      ...(childArtifact.className === '' ? {} : { className: childArtifact.className }),
      attr: { 'data-editor-zone-target': zone.id },
    },
    actions: {},
  }
}

/** Builds one capsule level from the existing timing, placement and CSS domain services. */
function resolveCapsule(
  items: Item[],
  capsuleType: AutoCapsuleType,
  bounds: CapsuleBoundsOutput,
  diagnostics: BuilderDiagnostic[],
  options?: Readonly<{
    sceneRoot?: boolean
    grid?: CapsuleDef['grid']
    transitionDefaults?: ReturnType<typeof resolveAutoCapsuleDefaults>
    targetPlacements?: ReadonlyMap<string, AutoCapsuleChildPlacementInput>
  }>,
): CapsuleResolution | undefined {
  try {
    const transitionDefaults = options?.transitionDefaults ?? resolveAutoCapsuleDefaults(capsuleType)
    const children: AutoCapsuleChildInput[] = items.map((item, index) => {
      const node = bounds.nodes.get(item.id)
      if (node === undefined) throw new Error(`No bounds were resolved for item '${item.id}'.`)
      return {
        id: item.id,
        order: index,
        timeRange: { startMs: node.window.startMs + bounds.preRollMs, endMs: node.outro.timeMs + bounds.preRollMs },
        events: buildBoundEvents(node),
      }
    })
    children.push(...[...(options?.targetPlacements ?? [])].map(([id, placement], index) => ({
      id,
      order: items.length + index,
      timeRange: { startMs: 0, endMs: 0 },
      placement,
      events: {},
    })))
    const autoCapsule = new AutoCapsule({
      capsule: {
        id: 'editor-v2-capsule',
        type: capsuleType,
        grid: {
          rows: options?.grid?.rows,
          cols: options?.grid?.cols,
          ...(options?.grid?.gap?.row === undefined ? {} : { rowGap: `${options.grid.gap.row}cqw` }),
          ...(options?.grid?.gap?.col === undefined ? {} : { columnGap: `${options.grid.gap.col}cqw` }),
        },
        sceneRoot: options?.sceneRoot,
        defaults: transitionDefaults,
      },
      children,
    }, { autoResolveOnWrite: false })
    const result = autoCapsule.resolve()
    for (const diagnostic of result.diagnostics) {
      diagnostics.push({
        level: diagnostic.level === 'error' ? 'error' : 'warning',
        code: `EDITOR_V2_CAPSULE_${diagnostic.code.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
        message: diagnostic.message,
        ...(diagnostic.childId === undefined ? {} : { context: { itemId: diagnostic.childId } }),
      })
    }
    return {
      rootArtifact: { className: result.capsule.className },
      childArtifactById: new Map(result.children.map((child) => [child.id, child])),
      styleSheet: result.styleSheet,
      grid: { rows: result.grid.context.rows, cols: result.grid.context.cols },
    }
  } catch (cause) {
    diagnostics.push(error(
      'EDITOR_V2_CAPSULE_RESOLUTION_FAILED',
      cause instanceof Error ? cause.message : String(cause),
      { capsuleType, itemCount: items.length },
    ))
    return undefined
  }
}

/**
 * Builds the child's appearance events from its resolved bounds: an explicit transition is a named
 * event, a fused bound an explicit `cut`; a default transition is left to `AutoCapsule`'s synthesis.
 */
function buildBoundEvents(node: ResolvedNodeBounds): Partial<Record<string, AutoCapsuleEventInput>> {
  const events: Partial<Record<string, AutoCapsuleEventInput>> = {}
  for (const [action, bound] of [[EVENT_ACTION.intro, node.intro], [EVENT_ACTION.outro, node.outro]] as const) {
    if (bound.transition.source === 'default') continue
    events[action] = {
      action,
      ...(bound.transition.source === 'explicit' ? { name: `${node.id}-${action}` } : {}),
      ref: bound.transition.ref,
      durationMs: bound.transition.durationMs,
    }
  }
  return events
}

/** Converts one resolved capsule child event set into V2 actions and pure eventime triggers. */
function resolveTransitionActions(
  childArtifact: AutoCapsuleChildElementArtifact,
): { actions: Record<string, { style: Record<string, unknown> }>; eventimes: Array<{ name: string; startAt: number }>; introFrom: Record<string, unknown> } {
  const actions: Record<string, { style: Record<string, unknown> }> = {}
  const eventimes: Array<{ name: string; startAt: number }> = []
  const introStyleDiff = childArtifact.events[EVENT_ACTION.intro]?.definition?.style?.[EVENT_ACTION.intro] ?? {}
  for (const event of Object.values(childArtifact.events)) {
    const styleDiff = event.definition?.style?.[event.action]
    if (styleDiff === undefined || Object.keys(styleDiff).length === 0) continue
    const style: Record<string, unknown> = {}
    for (const [property, transition] of Object.entries(styleDiff)) {
      // An exit tween starts from the value materialized by the entry. When the entry does not
      // animate this property (a `cut` entry, fused or explicit), it starts from the resting value
      // of its own transition: the `to` of that definition's entry style.
      const restingValue = event.action === EVENT_ACTION.outro && transition.from === undefined && !(property in introStyleDiff)
        ? event.definition?.style?.[EVENT_ACTION.intro]?.[property]?.to
        : undefined
      style[property] = { ...transition, ...(restingValue === undefined ? {} : { from: restingValue }), duration: event.durationMs }
    }
    actions[event.name] = { style }
    eventimes.push({ name: event.name, startAt: event.triggerMs })
  }
  const introFrom: Record<string, unknown> = {}
  const introStyle = childArtifact.events[EVENT_ACTION.intro]?.definition?.style?.intro
  if (introStyle !== undefined) {
    for (const [property, transition] of Object.entries(introStyle)) {
      if (transition.from !== undefined) introFrom[property] = transition.from
    }
  }
  return { actions, eventimes, introFrom }
}

/** Builds a nested list perso and resolves the list's own children in the next work item. */
function buildNestedCapsulePerso(
  scene: EditorScene,
  item: Item,
  parentPersoId: string,
  childArtifact: AutoCapsuleChildElementArtifact,
  stackOrder: number,
  bounds: CapsuleBoundsOutput,
  diagnostics: BuilderDiagnostic[],
): Readonly<{ perso: PersoDoc<'list'>; eventimes: Array<{ name: string; startAt: number }>; resolution: CapsuleResolution }> | undefined {
  if (item.capsule === undefined) return undefined
  const nestedZones = zonesForCapsule(scene, item.id)
  const preRollMs = bounds.preRollMs
  const resolution = resolveCapsule(childrenOf(scene.items, item.id), item.capsule.kind, bounds, diagnostics, {
    grid: item.capsule.grid,
    targetPlacements: resolveZoneTargetPlacements(nestedZones),
    transitionDefaults: resolveAutoCapsuleDefaults(item.capsule.kind, {
      introTransitionRef: item.capsule.defaultTransitionIn,
      outroTransitionRef: item.capsule.defaultTransitionOut,
    }),
  })
  if (resolution === undefined) return undefined
  const transition = resolveTransitionActions(childArtifact)
  const keyframes = sortPoseKeyframes(item)
  const firstKeyframe = keyframes[0]
  const initialZoneId = resolveInitialZoneId(scene, item, firstKeyframe)
  // Like a leaf, the capsule takes its entry transition's start values so it does not show
  // before its intro, together with any child fused to its edge.
  const initialStyle = {
    ...(firstKeyframe === undefined ? resolveInitialStyle(scene, item) : resolveKeyframeStyle(scene, item, firstKeyframe)),
    ...transition.introFrom,
  }
  const zoneActions = buildZoneMoveActions(scene, item, parentPersoId, keyframes, preRollMs)
  const className = [resolution.rootArtifact.className, childArtifact.className, stackClassName(stackOrder)].filter(Boolean).join(' ') || undefined
  const actions: Record<string, { style?: Record<string, unknown>; move?: Move }> = { ...transition.actions }
  for (const action of zoneActions) actions[action.name] = { move: action.move }
  return {
    perso: {
      id: item.id,
      name: item.id,
      type: 'list',
      initial: {
        move: { target: resolveMoveTarget(parentPersoId, initialZoneId) },
        tag: 'div',
        attr: { 'data-item-id': `${EDITOR_V2_STORY_ID}:${item.id}` },
        ...(className === undefined ? {} : { className }),
        ...(Object.keys(initialStyle).length === 0 ? {} : { style: initialStyle }),
      },
      actions,
    },
    eventimes: [...transition.eventimes, ...zoneActions.map((action) => ({ name: action.name, startAt: action.startAt }))],
    resolution,
  }
}

/** Builds one supported leaf perso while keeping V2 component-specific fields explicit. */
function buildLeafPerso(
  scene: EditorScene,
  item: Item,
  parentPersoId: string,
  childArtifact: AutoCapsuleChildElementArtifact,
  preRollMs: number,
  diagnostics: BuilderDiagnostic[],
  styleDefaults: StyleDefaultCapture | undefined,
  styleDefaultRequests: StyleDefaultRequest[],
  stackOrder: number,
  projection: MotionProjection | undefined,
): Readonly<{ persos: V2Perso[]; eventimes: Array<{ name: string; startAt: number }> }> {
  const content = item.contentId === null ? undefined : scene.contents[item.contentId]
  const keyframes = sortPoseKeyframes(item)
  const decorationKeyframes = sortDecorationKeyframes(scene, item)
  const firstKeyframe = keyframes[0]
  const hasMotionTrajectory = item.rotationMode === 'tangent'
    || keyframes.some(keyframe => typeof resolveKeyframePoseStyle(scene, item, keyframe).rotate === 'number')
    || keyframes.slice(1).some((keyframe) => {
    const path = scene.decors[keyframe.decorId]?.path
    return typeof path === 'string' && path.trim() !== ''
  })
  const rotationBaseline = hasMotionTrajectory ? resolveInitialPathRotation(scene, item) : undefined
  const initialZoneId = resolveInitialZoneId(scene, item, firstKeyframe)
  const initialClassName = firstKeyframe === undefined
    ? resolveInitialClassName(scene, item)
    : resolveKeyframeClassName(scene, item, firstKeyframe)
  const transition = resolveTransitionActions(childArtifact)
  const interpolation = buildInterpolationActions(
    scene,
    item,
    parentPersoId,
    decorationKeyframes,
    keyframes,
    preRollMs,
    diagnostics,
    initialClassName,
    styleDefaults,
    styleDefaultRequests,
    projection,
    rotationBaseline,
  )
  const initialReferenceAngle = interpolation.initialReferenceAngle ?? rotationBaseline
  const initialStyle = firstKeyframe === undefined
    ? resolveInitialStyle(scene, item)
    : resolveKeyframeStyle(scene, item, firstKeyframe)
  const initial = {
    ...initialStyle,
    ...transition.introFrom,
    ...(rotationBaseline === undefined ? {} : {
      [ITEM_MOTION_REFERENCE_ANGLE]: initialReferenceAngle,
      [ITEM_MOTION_ROTATION_BASELINE]: rotationBaseline,
    }),
  }
  const actions: Record<string, { style?: Record<string, unknown>; className?: ClassNameAction; move?: Move }> = { ...transition.actions }
  for (const action of interpolation.actions) {
    actions[action.name] = {
      ...(action.style === undefined || Object.keys(action.style).length === 0 ? {} : { style: action.style }),
      ...(action.className === undefined ? {} : { className: action.className }),
      ...(action.move === undefined ? {} : { move: action.move }),
    }
  }
  const eventimes = [...transition.eventimes, ...interpolation.actions.map((action) => ({ name: action.name, startAt: action.startAt }))]
  const common = {
    move: { target: resolveMoveTarget(parentPersoId, initialZoneId) },
    attr: { 'data-item-id': `${EDITOR_V2_STORY_ID}:${item.id}` },
    editorFrameClassName: [childArtifact.className, stackClassName(stackOrder)].filter(Boolean).join(' '),
    ...(initialClassName === undefined ? {} : { className: initialClassName }),
    ...(Object.keys(initial).length > 0 ? { style: initial } : {}),
  }

  return { persos: [buildLeafElement(scene, item, content, common, actions)], eventimes }
}

/** Builds one native leaf profile with its complete state and stable runtime identity. */
function buildLeafElement(
  scene: EditorScene,
  item: Item,
  content: EditorScene['contents'][string] | undefined,
  common: {
    move: Move
    attr: Record<string, string>
    className?: string
    style?: Record<string, unknown>
    editorFrameClassName: string
  },
  actions: Record<string, { style?: Record<string, unknown>; className?: ClassNameAction; move?: Move }>,
  persoId = item.id,
): V2LeafPerso {
  const text = item.type === 'text' ? content?.text : undefined
  if (item.type === 'image') {
    return { id: persoId, name: item.id, type: 'img', initial: { ...common, ...(content?.source === undefined ? {} : { src: content.source }) }, actions }
  }

  if (item.type === 'video' || item.type === 'media') {
    return { id: persoId, name: item.id, type: 'media', initial: { ...common, tag: item.type === 'video' ? 'video' : 'audio', src: content?.source as string, sync: item.id === scene.masterItemId ? 'master' : 'auto' }, actions }
  }

  return { id: persoId, name: item.id, type: 'tag', initial: { ...common, tag: 'div', ...(text === undefined ? {} : { content: text }) }, actions }
}

/** Builds decor actions between every adjacent keyframe pair through the single ACE style action. */
function buildInterpolationActions(
  scene: EditorScene,
  item: Item,
  parentPersoId: string,
  decorationKeyframes: Keyframe[],
  poseKeyframes: Keyframe[],
  preRollMs: number,
  diagnostics: BuilderDiagnostic[],
  initialClassName: string | undefined,
  styleDefaults: StyleDefaultCapture | undefined,
  styleDefaultRequests: StyleDefaultRequest[],
  projection: MotionProjection | undefined,
  rotationBaseline: number | undefined,
): Readonly<{ actions: DecorAction[]; initialReferenceAngle: number | undefined }> {
  const actions: DecorAction[] = []
  const missingStyleDefaultProperties = new Set<string>()
  const invalidPathKeyframeIds = new Set<string>()
  const poseSegments = poseKeyframes.slice(1).map((destination, index) => {
    const source = poseKeyframes[index]!
    const fromStyle = resolvePlacementPoseStyle(scene, item, source, resolveKeyframePoseStyle(scene, item, source))
    const toStyle = resolveKeyframePoseStyle(scene, item, destination)
    const targetStyle = resolvePlacementPoseStyle(scene, item, destination, toStyle)
    const path = resolveSegmentMotionPath(scene, item, destination)
    const hasMotionPath = path !== undefined
    let validMotionPath = true
    if (hasMotionPath && path !== undefined) {
      try {
        prepareSvgPath(path, { traversal: 'arc-length', precision: 2 })
      } catch (cause) {
        diagnostics.push(error(
          'EDITOR_V2_MOTION_PATH_INVALID',
          cause instanceof Error ? cause.message : 'The authored motion path is invalid.',
          { itemId: item.id, keyframeId: destination.id, decorId: destination.decorId },
        ))
        invalidPathKeyframeIds.add(destination.id)
        validMotionPath = false
      }
    }
    const previous = poseKeyframes[index - 1]
    const canResolveTangentSegment = validMotionPath && !invalidPathKeyframeIds.has(source.id)
      && projection !== undefined
      && [source, destination].every(keyframe => resolvePlacementZoneIdAtPoseKeyframe(scene, item, keyframe) === null)
    const tangentReferenceAngle = item.rotationMode === 'tangent' && previous !== undefined && canResolveTangentSegment
      && [previous, source, destination].every(keyframe => resolvePlacementZoneIdAtPoseKeyframe(scene, item, keyframe) === null)
      ? resolveTangentReferenceAngle(scene, item, previous, source, projection, styleDefaults)
      : undefined
    const initialTangentAngle = item.rotationMode === 'tangent' && index === 0 && canResolveTangentSegment
      ? resolveTangentSegmentAngle(scene, item, source, destination, 0, projection, styleDefaults)
      : undefined
    const tangentJoinRotationOffset = item.rotationMode === 'tangent' && previous !== undefined && canResolveTangentSegment
      && [previous, source, destination].every(keyframe => resolvePlacementZoneIdAtPoseKeyframe(scene, item, keyframe) === null)
      ? resolveTangentJoinRotationOffset(scene, item, previous, source, destination, projection, styleDefaults)
      : undefined
    return {
      source,
      destination,
      sourceZoneId: resolvePlacementZoneIdAtPoseKeyframe(scene, item, source),
      destinationZoneId: resolvePlacementZoneIdAtPoseKeyframe(scene, item, destination),
      fromStyle,
      diff: computeStyleDiff(fromStyle, targetStyle),
      path,
      hasMotionPath,
      validMotionPath,
      followsMotionPath: poseKeyframes.slice(1, index + 1).some(keyframe => {
        const previousPath = scene.decors[keyframe.decorId]?.path
        return typeof previousPath === 'string' && previousPath.trim() !== ''
      }),
      previous,
      tangentReferenceAngle,
      initialTangentAngle,
      tangentJoinRotationOffset,
    }
  })
  const firstTangentAngle = poseSegments[0]?.initialTangentAngle
  const initialReferenceAngle = firstTangentAngle === undefined || rotationBaseline === undefined
    ? rotationBaseline
    : firstTangentAngle + rotationBaseline

  for (let index = 1; index < decorationKeyframes.length; index += 1) {
    const source = decorationKeyframes[index - 1]!
    const destination = decorationKeyframes[index]!
    const sourceDecorStyle = resolveKeyframeDecorStyle(scene, item, source)
    const targetDecorStyle = resolveKeyframeDecorStyle(scene, item, destination)
    const fromStyle = resolveStyleDefaultsForTarget(sourceDecorStyle, targetDecorStyle, styleDefaults)
    const missingDefaults = Object.keys(targetDecorStyle).filter((property) => fromStyle[property] === undefined)
    missingDefaults.forEach((property) => missingStyleDefaultProperties.add(property))
    const diff = computeStyleDiff(fromStyle, targetDecorStyle)
    const { durationMs, ease, startAtMs } = resolveKeyframeTransition(source, destination)
    const startAt = startAtMs + preRollMs
    const style = buildStyleTransition(fromStyle, diff, durationMs, ease)
    const actionName = `${item.id}-decor-kf-${destination.id}`
    if (Object.keys(style.interpolated).length > 0) {
      actions.push({ name: actionName, style: style.interpolated, startAt })
    }
    if (Object.keys(style.discrete).length > 0) {
      actions.push({ name: `${actionName}-discrete`, style: style.discrete, startAt: destination.timeMs + preRollMs })
    }
    const className = buildClassNameTransition(
      index === 1 ? initialClassName : resolveKeyframeClassName(scene, item, source),
      resolveKeyframeClassName(scene, item, destination),
    )
    if (className !== undefined) {
      actions.push({ name: `${actionName}-classes`, className, startAt: destination.timeMs + preRollMs })
    }
  }

  if (missingStyleDefaultProperties.size > 0) {
    styleDefaultRequests.push({
      itemId: item.id,
      initialTimeMs: poseKeyframes[0]?.timeMs ?? 0,
      properties: [...missingStyleDefaultProperties].sort(),
    })
  }

  for (const {
    source,
    destination,
    previous,
    sourceZoneId,
    destinationZoneId,
    fromStyle,
    diff,
    path,
    hasMotionPath,
    validMotionPath,
    followsMotionPath,
    tangentReferenceAngle,
    tangentJoinRotationOffset,
  } of poseSegments) {
    if (!validMotionPath) continue
    const referenceAngle = item.rotationMode === 'tangent'
      ? tangentReferenceAngle ?? (previous === undefined ? initialReferenceAngle : rotationBaseline)
      : rotationBaseline
    const orientToPath = hasMotionPath && item.rotationMode === 'tangent'
    const zoneChanged = sourceZoneId !== destinationZoneId
    if (Object.keys(diff).length === 0 && !hasMotionPath && !zoneChanged) continue

    const { durationMs, ease, startAtMs } = resolveKeyframeTransition(source, destination)
    // Pose clock of the segment: a timed path moves over its whole interval from the source KF.
    const poseTiming = resolveSegmentTiming(scene, item, source, destination)
    const hasTimedMotionPath = hasMotionPath && destination.timeMs > source.timeMs
    const startAt = startAtMs + preRollMs
    const style = buildStyleTransition(fromStyle, diff, durationMs, ease, true, hasTimedMotionPath)
    if (hasMotionPath && referenceAngle !== undefined) {
      style.interpolated[ITEM_MOTION_REFERENCE_ANGLE] = referenceAngle
    }
    const actionName = `${item.id}-kf-${destination.id}`
    const move = hasTimedMotionPath || zoneChanged
      ? {
        target: resolveMoveTarget(parentPersoId, destinationZoneId),
        transition: hasTimedMotionPath
          ? {
            duration: poseTiming.durationMs,
            ease: poseTiming.ease,
            ...(path === undefined ? {} : { path }),
            ...(hasTimedMotionPath ? { orientToPath } : {}),
            ...(orientToPath ? {
              rotateOffset: {
                from: tangentJoinRotationOffset ?? rotationBaseline ?? 0,
                to: rotationBaseline ?? 0,
              },
            } : {}),
          }
          : { duration: durationMs, ease },
      }
      : followsMotionPath ? { target: resolveMoveTarget(parentPersoId, destinationZoneId) } : undefined
    if (Object.keys(style.interpolated).length > 0 || move !== undefined) {
      actions.push({
        name: actionName,
        ...(Object.keys(style.interpolated).length === 0 ? {} : { style: style.interpolated }),
        ...(move === undefined ? {} : { move }),
        startAt: hasTimedMotionPath ? poseTiming.startAtMs + preRollMs : startAt,
      })
    }
    if (Object.keys(style.discrete).length > 0) {
      actions.push({
        name: `${actionName}-discrete`,
        style: style.discrete,
        startAt: destination.timeMs + preRollMs,
      })
    }
  }
  return { actions, initialReferenceAngle }
}

/** Clears inherited x/y runtime offsets when a pose returns to its structural zone target. */
function resolvePlacementPoseStyle(
  scene: EditorScene,
  item: Item,
  keyframe: Keyframe,
  style: Record<string, unknown>,
): Record<string, unknown> {
  return resolvePlacementZoneIdAtPoseKeyframe(scene, item, keyframe) === null
    ? style
    : { x: 0, y: 0, ...style }
}

/** Builds the visual class delta independently of the frame placement classes. */
function buildClassNameTransition(
  fromDecorClassName: string | undefined,
  toDecorClassName: string | undefined,
): ClassNameAction | undefined {
  const from = classTokens(fromDecorClassName)
  const to = classTokens(toDecorClassName)
  const remove = [...from].filter((token) => !to.has(token)).join(' ')
  const add = [...to].filter((token) => !from.has(token)).join(' ')
  if (remove === '' && add === '') return undefined
  return {
    ...(add === '' ? {} : { add }),
    ...(remove === '' ? {} : { remove }),
  }
}

/** Splits one complete class string into stable tokens for a discrete delta. */
function classTokens(value: string | undefined): Set<string> {
  return new Set(value?.split(/\s+/).filter((token) => token !== '') ?? [])
}

/** Converts a destination diff into tween and discrete channels. */
function buildStyleTransition(
  fromStyle: Record<string, unknown>,
  diff: Record<string, unknown>,
  durationMs: number,
  ease: string,
  poseRotationIdentity = false,
  capturesMotionGeometry = false,
): { interpolated: Record<string, unknown>; discrete: Record<string, unknown> } {
  const interpolated: Record<string, unknown> = {}
  const discrete: Record<string, unknown> = {}
  for (const [property, value] of Object.entries(diff)) {
    // Missing pose transforms use their CSS defaults without densifying source decor.
    const from = fromStyle[property]
      ?? (poseRotationIdentity && property === 'rotate' && typeof value === 'number' ? 0 : undefined)
      ?? (poseRotationIdentity && (property === 'scaleX' || property === 'scaleY')
        && typeof value === 'number' ? 1 : undefined)
      ?? (poseRotationIdentity && property === 'transform-origin' ? '50% 50%' : undefined)
    // FIRST precedes this action; LAST includes its resolved pose. Geometry-only assignments
    // therefore belong here even when the style resolver cannot tween the authored pair.
    if (capturesMotionGeometry && OFFSET_STYLE_PROPERTIES.has(property)
      && (from === undefined || !isInterpolableStylePair(from, value) || isCssCalc(from) || isCssCalc(value))) {
      if (value !== undefined) interpolated[property] = value
      continue
    }
    // Structured x/y channels are qualified as logical lengths by CodPlay. A CSS `calc()` that
    // mixes cqw with px cannot be represented by that channel's tween resolver, even though it is
    // valid CSS. Keep the authored endpoint as a discrete value; this preserves the open Decor
    // property and avoids teaching the core runtime about an editor-only border projection.
    if ((property === 'x' || property === 'y') && (isCssCalc(from) || isCssCalc(value))) {
      if (value !== undefined) discrete[property] = value
      continue
    }
    if (from === undefined) {
      // The destination property is authored, but the source has no authored value. Applying it
      // at the destination preserves the keyframe state without inventing a CSS endpoint.
      if (value !== undefined) discrete[property] = value
      continue
    }
    if (!isInterpolableStylePair(from, value)) {
      // A property with two authored endpoints still has a real destination value even when
      // ACE cannot interpolate it (font family, text alignment, object-fit, ...). Keep it in the
      // open discrete channel instead of dropping it behind a property whitelist.
      if (value !== undefined) discrete[property] = value
      continue
    }
    // Authored angles are stored normalized in [−180°, 180°). Between two pose keyframes the
    // rotation takes the shortest arc: only the tween target is unwrapped, never the Decor.
    const to = property === 'rotate' && typeof from === 'number' && typeof value === 'number'
      ? from + normalizeAngleDegrees(value - from)
      : value
    interpolated[property] = { from, to, duration: durationMs, ease }
  }
  return { interpolated, discrete }
}

/** Identifies a raw CSS calculation that cannot be encoded as a structured logical length tween. */
function isCssCalc(value: unknown): boolean {
  return typeof value === 'string' && /^\s*calc\(/i.test(value)
}

/** Returns keyframes in the timeline order required by the pure resolver. */
function sortKeyframes(item: Item): Keyframe[] {
  return [...item.keyframes].sort((left, right) => left.timeMs - right.timeMs)
}

/** Returns only the keyframes that define the item's spatial/visibility timeline. */
function sortPoseKeyframes(item: Item): Keyframe[] {
  return sortKeyframes(item).filter((keyframe) => resolveKeyframeChannel(keyframe) === 'pose')
}

/** Creates one blocking diagnostic. */
function error(code: string, message: string, context?: Readonly<Record<string, unknown>>): BuilderDiagnostic {
  return { level: 'error', code, message, ...(context === undefined ? {} : { context }) }
}

/** Keeps the failure branch explicit and guarantees that no partial scene escapes. */
function failure(diagnostics: readonly BuilderDiagnostic[]): BuildSceneV2Failure {
  return { ok: false, diagnostics }
}
