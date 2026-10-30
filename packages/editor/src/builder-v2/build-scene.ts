import {
  AutoCapsule,
  CAPSULE_TYPE,
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
import { CapsuleDistribution } from '@codplay/scene-factory/capsule-distribution'
import { CapsulePreset } from '@codplay/scene-factory/capsule-preset'
import { TransitionTiming } from '@codplay/scene-factory/transition-timing'
import type { CapsuleDistributionOutput } from '@codplay/scene-factory/capsule-distribution'
import type { CapsuleKind } from '@codplay/scene-factory/capsule-preset'
import type { Move, PersoDoc, SceneDoc } from 'codplay'
import { prepareSvgPath } from 'ace'
import { resolveKeyframeChannel } from '../app/commands/types'
import type { CapsuleDef, EditorScene, Item, Keyframe, Transition } from '../app/commands/types'
import { resolveKeyframeTransition } from './keyframe-transition'
import { motionVisualPersoId } from './motion-visual-id'
import { OFFSET_STYLE_PROPERTIES } from '../decor-editor/units'
import { resolveBorderInsetLengths } from '../motion-editor/border-insets'
import {
  computeStyleDiff,
  hasZoneAssignment,
  isInterpolableStylePair,
  resolveInitialClassName,
  resolveInitialStyle,
  resolveKeyframeDecorStyle,
  resolveKeyframeClassName,
  resolveKeyframePoseStyle,
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
  type BuilderDiagnostic,
} from './types'

/** Builds the native V2 SceneDoc for the currently supported editor scene slice. */
export function buildSceneDocV2(scene: EditorScene): BuildSceneV2Result {
  const diagnostics = validateSceneInput(scene)
  if (diagnostics.some((diagnostic) => diagnostic.level === 'error')) {
    return failure(diagnostics)
  }

  const rootItems = childrenOf(scene.items, null)
  const itemById = new Map(scene.items.map((item) => [item.id, item]))
  const rootCapsule = scene.rootCapsule
  const rootCapsuleType = rootCapsule?.kind ?? CAPSULE_TYPE.card
  const rootTransitionDefaults = resolveAutoCapsuleDefaults(rootCapsuleType, {
    introTransitionRef: rootCapsule?.defaultTransitionIn,
    outroTransitionRef: rootCapsule?.defaultTransitionOut,
  })
  const preRollMs = TransitionTiming.computeScenePreRollMs(scene.items.map((item) => {
    const firstKeyframe = sortPoseKeyframes(item)[0]
    const parentTransitionDefaults = resolveParentTransitionDefaults(item, itemById, rootTransitionDefaults)
    return {
      firstKeyframe: firstKeyframe === undefined ? undefined : {
        timeMs: firstKeyframe.timeMs,
        transitionInDurationMs: resolveIntroDuration(firstKeyframe.transitionIn, parentTransitionDefaults.introTransitionRef),
      },
    }
  }))

  const rootResolution = resolveCapsule(rootItems, rootCapsuleType, preRollMs, diagnostics, {
    sceneRoot: true,
    fallbackClipDurationMs: scene.meta.durationMs,
    grid: rootCapsule?.grid,
    placements: resolveRootZonePlacements(scene, rootItems),
    distribution: rootCapsule?.distribution ?? { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
    transitionDefaults: rootTransitionDefaults,
  })
  if (rootResolution === undefined || diagnostics.some((diagnostic) => diagnostic.level === 'error')) {
    return failure(diagnostics)
  }

  const rootPerso: PersoDoc<'list'> = buildRootPerso(scene, rootResolution.rootArtifact.className)
  const persos: Array<V2Perso> = [rootPerso]
  const reservedPersoIds = new Set([EDITOR_V2_ROOT_PERSO_ID, ...scene.items.map((item) => item.id)])
  const eventimes: Array<{ name: string; startAt: number }> = []
  const styleSheets: string[] = [rootResolution.styleSheet]
  type WorkItem = Readonly<{
    items: Item[]
    parentPersoId: string
    resolution: CapsuleResolution
  }>
  const worklist: WorkItem[] = [{ items: rootItems, parentPersoId: EDITOR_V2_ROOT_PERSO_ID, resolution: rootResolution }]

  while (worklist.length > 0) {
    const current = worklist.shift()!
    for (const item of current.items) {
      const childArtifact = current.resolution.childArtifactById.get(item.id)
      if (childArtifact === undefined) {
        diagnostics.push(error('EDITOR_V2_CAPSULE_CHILD_UNRESOLVED', `No capsule artifact was produced for item '${item.id}'.`, { itemId: item.id }))
        continue
      }

      if (item.type === 'capsule') {
        const nested = buildNestedCapsulePerso(scene, item, current.parentPersoId, childArtifact, preRollMs, diagnostics)
        if (nested === undefined) continue
        persos.push(nested.perso)
        eventimes.push(...nested.eventimes)
        styleSheets.push(nested.resolution.styleSheet)
        worklist.push({
          items: childrenOf(scene.items, item.id),
          parentPersoId: item.id,
          resolution: nested.resolution,
        })
        continue
      }

      const leaf = buildLeafPerso(
        scene, item, current.parentPersoId, childArtifact, preRollMs, diagnostics, reservedPersoIds,
      )
      persos.push(...leaf.persos)
      eventimes.push(...leaf.eventimes)
    }
  }

  if (diagnostics.some((diagnostic) => diagnostic.level === 'error')) return failure(diagnostics)

  const sceneDoc: SceneDoc = {
    id: scene.id,
    name: scene.meta.title,
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

  for (const item of scene.items) {
    validateItemInput(scene, item, itemById, diagnostics)
  }
  validateRootDecor(scene, diagnostics)
  validateParentGraph(scene.items, itemById, diagnostics)
  return diagnostics
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
  if (item.visible === false) diagnostics.push(error('EDITOR_V2_ITEM_VISIBILITY_UNSUPPORTED', 'An invisible item has no V2 mapping in this increment.', { itemId: item.id }))
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
      continue
    }
    if (item.parentId === null && decor.id === item.initialDecorId) continue
    diagnostics.push({
      level: 'warning',
      code: 'EDITOR_V2_ZONE_DEFERRED',
      message: 'This zone assignment is not the root item’s initial decor; its temporal materialization remains deferred.',
      context: { itemId: item.id, decorId: decor.id, zoneId: decor.zoneId },
    })
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

/** Returns one parent group's children in the editor's fractional order. */
function childrenOf(items: readonly Item[], parentId: string | null): Item[] {
  return items
    .filter((item) => item.parentId === parentId)
    .sort((left, right) => left.order < right.order ? -1 : left.order > right.order ? 1 : left.id.localeCompare(right.id))
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

/** Resolves initial root-item zones into Capsule Automation's existing row/column placement input. */
function resolveRootZonePlacements(
  scene: EditorScene,
  items: readonly Item[],
): ReadonlyMap<string, AutoCapsuleChildPlacementInput> {
  return new Map(items.flatMap((item) => {
    const decor = scene.decors[item.initialDecorId]
    if (decor?.zoneId == null) return []
    const zone = scene.zones[decor.zoneId]
    if (zone === undefined || zone.capsuleId !== null) return []
    const { row, col, rowSpan, colSpan } = zone.surfaces.landscape
    return [[item.id, { row, col, rowSpan, colSpan } as const]]
  }))
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

/** Builds one capsule level from the existing timing, placement and CSS domain services. */
function resolveCapsule(
  items: Item[],
  capsuleType: AutoCapsuleType,
  preRollMs: number,
  diagnostics: BuilderDiagnostic[],
  options?: Readonly<{
    sceneRoot?: boolean
    /** Duration of the implicit root clip when no child keyframe supplies an end. */
    fallbackClipDurationMs?: number
    grid?: CapsuleDef['grid']
    distribution?: CapsuleDef['distribution']
    transitionDefaults?: ReturnType<typeof resolveAutoCapsuleDefaults>
    placements?: ReadonlyMap<string, AutoCapsuleChildPlacementInput>
  }>,
): CapsuleResolution | undefined {
  try {
    const preset = resolveCapsulePreset(capsuleType, options?.distribution)
    const transitionDefaults = options?.transitionDefaults ?? resolveAutoCapsuleDefaults(capsuleType)
    const distribution = resolveCapsuleDistribution(items, preRollMs, preset, transitionDefaults, options?.fallbackClipDurationMs)
    const children: AutoCapsuleChildInput[] = items.map((item, index) => {
      const timing = distribution.children.find((child) => child.trackId === item.id)
      if (timing === undefined) throw new Error(`No timing was produced for item '${item.id}'.`)
      const placement = options?.placements?.get(item.id)
      return {
        id: item.id,
        order: index,
        timeRange: { startMs: timing.introMs, endMs: timing.outroMs },
        ...(placement === undefined ? {} : { placement }),
        events: buildTransitionEvents(item),
      }
    })
    const autoCapsule = new AutoCapsule({
      capsule: {
        id: 'editor-v2-capsule',
        type: capsuleType,
        grid: { rows: options?.grid?.rows, cols: options?.grid?.cols },
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

/** Resolves the author-selected distribution through the scene-factory domain service. */
function resolveCapsulePreset(
  capsuleType: AutoCapsuleType,
  distribution: CapsuleDef['distribution'] | undefined,
): { mode: 'sequential' | 'stagger'; staggerInMs?: number; staggerOutMs?: number } {
  return CapsulePreset.resolve({
    capsuleType: capsuleType as CapsuleKind,
    distribution,
  })
}

/** Computes one capsule's child timing without reimplementing its distribution formulas. */
function resolveCapsuleDistribution(
  items: Item[],
  preRollMs: number,
  preset: { mode: 'sequential' | 'stagger'; staggerInMs?: number; staggerOutMs?: number },
  transitionDefaults: ReturnType<typeof resolveAutoCapsuleDefaults>,
  fallbackClipDurationMs = 0,
): CapsuleDistributionOutput {
  const authoredClipDurationMs = items.reduce((max, item) => Math.max(max, sortPoseKeyframes(item).at(-1)?.timeMs ?? 0), 0)
  return CapsuleDistribution.compute({
    clipDurationMs: Math.max(authoredClipDurationMs, fallbackClipDurationMs) + preRollMs,
    ...preset,
    children: items.map((item) => {
      const keyframes = sortPoseKeyframes(item)
      // A single real keyframe fixes the entry boundary; the capsule distribution supplies the
      // missing exit boundary. Locking both sides to that same keyframe would make the item
      // zero-duration and would diverge from the sequence-editor preview.
      const lastKeyframe = keyframes.length > 1 ? keyframes.at(-1) : undefined
      return {
        trackId: item.id,
        lockedIntroMs: TransitionTiming.lockedIntroMs(
          keyframes[0] === undefined ? undefined : {
            timeMs: keyframes[0].timeMs,
            transitionInDurationMs: resolveIntroDuration(keyframes[0].transitionIn, transitionDefaults.introTransitionRef),
          },
          preRollMs,
        ),
        lockedOutroMs: TransitionTiming.lockedOutroMs(lastKeyframe, preRollMs),
      }
    }),
  })
}

/** Builds the capsule's explicit named transition inputs for capsule-automation. */
function buildTransitionEvents(item: Item): Partial<Record<string, AutoCapsuleEventInput>> {
  const keyframes = sortPoseKeyframes(item)
  const events: Partial<Record<string, AutoCapsuleEventInput>> = {}
  const intro = keyframes[0]?.transitionIn
  const outro = keyframes.at(-1)?.transitionOut
  if (intro?.kind === 'named') events[EVENT_ACTION.intro] = { action: EVENT_ACTION.intro, name: `${item.id}-intro`, ref: intro.name, durationMs: intro.durationMs }
  if (outro?.kind === 'named') events[EVENT_ACTION.outro] = { action: EVENT_ACTION.outro, name: `${item.id}-outro`, ref: outro.name, durationMs: outro.durationMs }
  return events
}

/** Converts one resolved capsule child event set into V2 actions and pure eventime triggers. */
function resolveTransitionActions(
  childArtifact: AutoCapsuleChildElementArtifact,
): { actions: Record<string, { style: Record<string, unknown> }>; eventimes: Array<{ name: string; startAt: number }>; introFrom: Record<string, unknown> } {
  const actions: Record<string, { style: Record<string, unknown> }> = {}
  const eventimes: Array<{ name: string; startAt: number }> = []
  for (const event of Object.values(childArtifact.events)) {
    const styleDiff = event.definition?.style?.[event.action]
    if (styleDiff === undefined || Object.keys(styleDiff).length === 0) continue
    const style: Record<string, unknown> = {}
    for (const [property, transition] of Object.entries(styleDiff)) {
      style[property] = { ...transition, duration: event.durationMs }
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
  preRollMs: number,
  diagnostics: BuilderDiagnostic[],
): Readonly<{ perso: PersoDoc<'list'>; eventimes: Array<{ name: string; startAt: number }>; resolution: CapsuleResolution }> | undefined {
  if (item.capsule === undefined) return undefined
  const resolution = resolveCapsule(childrenOf(scene.items, item.id), item.capsule.kind, preRollMs, diagnostics, {
    grid: item.capsule.grid,
    distribution: item.capsule.distribution,
    transitionDefaults: resolveAutoCapsuleDefaults(item.capsule.kind, {
      introTransitionRef: item.capsule.defaultTransitionIn,
      outroTransitionRef: item.capsule.defaultTransitionOut,
    }),
  })
  if (resolution === undefined) return undefined
  const transition = resolveTransitionActions(childArtifact)
  const className = [resolution.rootArtifact.className, childArtifact.className].filter(Boolean).join(' ') || undefined
  return {
    perso: {
      id: item.id,
      name: item.id,
      type: 'list',
      initial: {
        move: { target: parentPersoId },
        tag: 'div',
        attr: { 'data-item-id': `${EDITOR_V2_STORY_ID}:${item.id}` },
        ...(className === undefined ? {} : { className }),
      },
      actions: transition.actions,
    },
    eventimes: transition.eventimes,
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
  reservedPersoIds: Set<string>,
): Readonly<{ persos: V2Perso[]; eventimes: Array<{ name: string; startAt: number }> }> {
  const content = item.contentId === null ? undefined : scene.contents[item.contentId]
  const keyframes = sortPoseKeyframes(item)
  const decorationKeyframes = sortDecorationKeyframes(scene, item)
  const firstKeyframe = keyframes[0]
  const initialStyle = firstKeyframe === undefined
    ? resolveInitialStyle(scene, item)
    : resolveKeyframeStyle(scene, item, firstKeyframe)
  const initialClassName = firstKeyframe === undefined
    ? resolveInitialClassName(scene, item)
    : resolveKeyframeClassName(scene, item, firstKeyframe)
  const transition = resolveTransitionActions(childArtifact)
  const initial = { ...initialStyle, ...transition.introFrom }
  const decorActions = buildInterpolationActions(
    scene,
    item,
    decorationKeyframes,
    keyframes,
    preRollMs,
    diagnostics,
    childArtifact.className,
    initialClassName,
  )
  const actions: Record<string, { style?: Record<string, unknown>; className?: ClassNameAction; move?: Move }> = { ...transition.actions }
  for (const action of decorActions) {
    actions[action.name] = {
      ...(action.style === undefined || Object.keys(action.style).length === 0 ? {} : { style: action.style }),
      ...(action.className === undefined ? {} : { className: action.className }),
      ...(action.move === undefined ? {} : { move: action.move }),
    }
  }
  const eventimes = [...transition.eventimes, ...decorActions.map((action) => ({ name: action.name, startAt: action.startAt }))]
  const common = {
    move: { target: parentPersoId },
    attr: { 'data-item-id': `${EDITOR_V2_STORY_ID}:${item.id}` },
    ...(childArtifact.className === '' && initialClassName === undefined
      ? {}
      : { className: [childArtifact.className, initialClassName].filter(Boolean).join(' ') }),
    ...(Object.keys(initial).length > 0 ? { style: initial } : {}),
  }

  const hasMotionPath = keyframes.slice(1).some((keyframe) => {
    const path = scene.decors[keyframe.decorId]?.path
    return typeof path === 'string' && path.trim() !== ''
  })
  if (!hasMotionPath) return { persos: [buildLeafElement(scene, item, content, common, actions)], eventimes }

  const visualPersoId = motionVisualPersoId(item.id, reservedPersoIds)
  reservedPersoIds.add(visualPersoId)
  const initialVisualStyle = omitMotionPoseStyle(initial)
  const initialHostStyle = {
    display: 'grid',
    gridTemplateColumns: 'max-content',
    gridTemplateRows: 'max-content',
    justifyItems: 'start',
    alignItems: 'start',
    width: 'max-content',
    height: 'max-content',
    overflow: 'visible',
    ...pickMotionPoseStyle(initial),
  }
  const { hostActions, visualActions } = splitMotionHostActions(item.id, actions)
  const visualPerso = buildLeafElement(scene, item, content, {
    move: { target: item.id },
    attr: { 'data-editor-visual-for': item.id },
    ...(initialClassName === undefined ? {} : { className: initialClassName }),
    ...(Object.keys(initialVisualStyle).length === 0 ? {} : { style: initialVisualStyle }),
  }, visualActions, visualPersoId)
  const motionHost: PersoDoc<'list'> = {
    id: item.id,
    name: item.id,
    type: 'list',
    initial: {
      move: { target: parentPersoId },
      tag: 'div',
      attr: { 'data-item-id': `${EDITOR_V2_STORY_ID}:${item.id}` },
      ...(childArtifact.className === '' ? {} : { className: childArtifact.className }),
      style: initialHostStyle,
    },
    actions: hostActions,
  }

  return {
    persos: [motionHost, visualPerso],
    eventimes,
  }
}

/** Builds one concrete leaf component before optionally placing it in a geometry host. */
function buildLeafElement(
  scene: EditorScene,
  item: Item,
  content: EditorScene['contents'][string] | undefined,
  common: {
    move: Move
    attr: Record<string, string>
    className?: string
    style?: Record<string, unknown>
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

/** Keeps CSS geometry on the visual child while the host owns the path's affine pose. */
function splitMotionHostActions(
  itemId: string,
  actions: Record<string, { style?: Record<string, unknown>; className?: ClassNameAction; move?: Move }>,
): Readonly<{
  hostActions: Record<string, { style?: Record<string, unknown>; className?: ClassNameAction; move?: Move }>
  visualActions: Record<string, { style?: Record<string, unknown>; className?: ClassNameAction; move?: Move }>
}> {
  const hostActions: Record<string, { style?: Record<string, unknown>; className?: ClassNameAction; move?: Move }> = {}
  const visualActions: Record<string, { style?: Record<string, unknown>; className?: ClassNameAction; move?: Move }> = {}
  for (const [name, action] of Object.entries(actions)) {
    if (name.startsWith(`${itemId}-decor-kf-`) || name.endsWith('-classes')) {
      const style = action.style ?? {}
      const hostStyle = pickMotionTranslationStyle(style)
      const visualStyle = omitMotionTranslationStyle(style)
      if (Object.keys(hostStyle).length > 0) hostActions[name] = { style: hostStyle }
      if (Object.keys(visualStyle).length > 0 || action.className !== undefined) {
        visualActions[name] = {
          ...(Object.keys(visualStyle).length === 0 ? {} : { style: visualStyle }),
          ...(action.className === undefined ? {} : { className: action.className }),
        }
      }
      continue
    }

    const style = action.style ?? {}
    const hostStyle = action.move === undefined
      ? pickMotionPoseStyle(style)
      : omitMotionSizeStyle(pickMotionPoseStyle(style))
    const visualStyle = {
      ...pickMotionSizeStyle(style),
      ...omitMotionPoseStyle(style),
    }
    if (Object.keys(hostStyle).length > 0 || action.move !== undefined) {
      hostActions[name] = {
        ...(Object.keys(hostStyle).length === 0 ? {} : { style: hostStyle }),
        ...(action.move === undefined ? {} : { move: action.move }),
      }
    }
    if (Object.keys(visualStyle).length > 0) visualActions[name] = { style: visualStyle }
  }
  return { hostActions, visualActions }
}

/** Selects the affine fields that define a motion host pose. */
function pickMotionPoseStyle(style: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(style).filter(([property]) => (
    property === 'x' || property === 'y' || property === 'rotate'
    || property === 'scaleX' || property === 'scaleY' || property === 'transform-origin'
  )))
}

/** Selects the dimensions that belong to the visual element inside a motion host. */
function pickMotionSizeStyle(style: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(style).filter(([property]) => property === 'width' || property === 'height'))
}

/** Selects only host translation fields used by border projection actions. */
function pickMotionTranslationStyle(style: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(style).filter(([property]) => property === 'x' || property === 'y'))
}

/** Removes pose-only fields from the visual element's initial CSS style. */
function omitMotionPoseStyle(style: Record<string, unknown>): Record<string, unknown> {
  const result = { ...style }
  for (const property of ['x', 'y', 'rotate', 'scaleX', 'scaleY', 'transform-origin']) delete result[property]
  return result
}

/** Removes host translation fields from a decor action applied to its visual child. */
function omitMotionTranslationStyle(style: Record<string, unknown>): Record<string, unknown> {
  const result = { ...style }
  delete result.x
  delete result.y
  return result
}

/** Removes the dimensions handled by the visual child from an affine host action. */
function omitMotionSizeStyle(style: Record<string, unknown>): Record<string, unknown> {
  const result = { ...style }
  delete result.width
  delete result.height
  return result
}

/**
 * Builds decor actions between every adjacent keyframe pair.
 *
 * A property present at the destination but absent from the resolved source has no authored
 * interpolation endpoint. It therefore becomes a direct style patch at the destination KF, with
 * one pose-only exception: numeric rotation uses its documented `0°` identity as an explicit start.
 * No `{to: ...}` tween without a materialized `from` is emitted.
 */
function buildInterpolationActions(
  scene: EditorScene,
  item: Item,
  decorationKeyframes: Keyframe[],
  poseKeyframes: Keyframe[],
  preRollMs: number,
  diagnostics: BuilderDiagnostic[],
  generatedClassName: string,
  initialClassName: string | undefined,
): DecorAction[] {
  const actions: DecorAction[] = []
  const poseSegments = poseKeyframes.slice(1).map((destination, index) => {
    const source = poseKeyframes[index]!
    const fromStyle = resolveKeyframePoseStyle(scene, item, source)
    const toStyle = resolveKeyframePoseStyle(scene, item, destination)
    const path = scene.decors[destination.decorId]?.path
    return {
      source,
      destination,
      fromStyle,
      toStyle,
      diff: computeStyleDiff(fromStyle, toStyle),
      path,
      hasMotionPath: typeof path === 'string' && path.trim() !== '',
    }
  })

  for (let index = 1; index < decorationKeyframes.length; index += 1) {
    const source = decorationKeyframes[index - 1]!
    const destination = decorationKeyframes[index]!
    const sourceDecorStyle = resolveKeyframeDecorStyle(scene, item, source)
    const targetDecorStyle = resolveKeyframeDecorStyle(scene, item, destination)
    const borderChanged = !sameBorderInsetLengths(
      resolveBorderInsetLengths(sourceDecorStyle),
      resolveBorderInsetLengths(targetDecorStyle),
    )
    const sourceAnchorStyle = borderChanged
      ? poseAnchorStyle(resolveKeyframePoseStyle(scene, item, source))
      : {}
    const targetAnchorStyle = borderChanged
      ? poseAnchorStyle(resolveKeyframePoseStyle(scene, item, destination))
      : {}
    const overlappingPoseSegments = poseSegments.filter((segment) => (
      source.timeMs < segment.destination.timeMs
      && segment.source.timeMs < destination.timeMs
    ))
    const borderAnchorDiff = borderChanged
      ? computeStyleDiff(sourceAnchorStyle, targetAnchorStyle)
      : {}
    if (overlappingPoseSegments.some((segment) => segment.hasMotionPath || segment.diff.x !== undefined)) {
      delete borderAnchorDiff.x
    }
    if (overlappingPoseSegments.some((segment) => segment.hasMotionPath || segment.diff.y !== undefined)) {
      delete borderAnchorDiff.y
    }
    const fromStyle = { ...sourceDecorStyle, ...sourceAnchorStyle }
    const diff = {
      ...computeStyleDiff(sourceDecorStyle, targetDecorStyle),
      ...borderAnchorDiff,
    }
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
      generatedClassName,
    )
    if (className !== undefined) {
      actions.push({ name: `${actionName}-classes`, className, startAt: destination.timeMs + preRollMs })
    }
  }

  for (const { source, destination, fromStyle, toStyle, diff, path, hasMotionPath } of poseSegments) {
    const orientToPath = hasMotionPath && scene.decors[destination.decorId]?.orientToPath === true
    if (hasMotionPath && path !== undefined) {
      try {
        prepareSvgPath(path, { traversal: 'arc-length', precision: 2 })
      } catch (cause) {
        diagnostics.push(error(
          'EDITOR_V2_MOTION_PATH_INVALID',
          cause instanceof Error ? cause.message : 'The authored motion path is invalid.',
          { itemId: item.id, keyframeId: destination.id, decorId: destination.decorId },
        ))
        continue
      }
    }
    if (Object.keys(diff).length === 0 && !hasMotionPath) continue

    const intervalMs = Math.max(0, destination.timeMs - source.timeMs)
    const { durationMs, ease, startAtMs } = resolveKeyframeTransition(source, destination)
    const startAt = startAtMs + preRollMs
    const style = buildStyleTransition(fromStyle, diff, durationMs, ease, true, hasMotionPath && intervalMs > 0)
    const actionName = `${item.id}-kf-${destination.id}`
    if (Object.keys(style.interpolated).length > 0 || (hasMotionPath && intervalMs > 0)) {
      actions.push({
        name: actionName,
        ...(Object.keys(style.interpolated).length === 0 ? {} : { style: style.interpolated }),
        ...(hasMotionPath && intervalMs > 0 ? {
          move: {
            target: item.parentId === null ? EDITOR_V2_ROOT_PERSO_ID : item.parentId,
            transition: {
              duration: intervalMs,
              ease,
              path,
              ...(orientToPath ? {
                orientToPath: true,
                rotateOffset: {
                  from: typeof fromStyle.rotate === 'number' ? fromStyle.rotate : 0,
                  to: typeof toStyle.rotate === 'number' ? toStyle.rotate : 0,
                },
              } : {}),
            },
          },
        } : {}),
        startAt: hasMotionPath && intervalMs > 0 ? source.timeMs + preRollMs : startAt,
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
  return actions
}

/** Keeps only derived x/y channels needed to animate the content-box anchor. */
function poseAnchorStyle(style: Record<string, unknown>): Record<string, unknown> {
  const anchor: Record<string, unknown> = {}
  if (style.x !== undefined) anchor.x = style.x
  if (style.y !== undefined) anchor.y = style.y
  return anchor
}

/** Compares resolved border lengths without converting logical units through a viewport. */
function sameBorderInsetLengths(
  source: ReturnType<typeof resolveBorderInsetLengths>,
  destination: ReturnType<typeof resolveBorderInsetLengths>,
): boolean {
  return source.top.value === destination.top.value
    && source.top.unit === destination.top.unit
    && source.right.value === destination.right.value
    && source.right.unit === destination.right.unit
    && source.bottom.value === destination.bottom.value
    && source.bottom.unit === destination.bottom.unit
    && source.left.value === destination.left.value
    && source.left.unit === destination.left.unit
}

/** Builds the discrete class delta while preserving capsule-generated classes. */
function buildClassNameTransition(
  fromDecorClassName: string | undefined,
  toDecorClassName: string | undefined,
  generatedClassName: string,
): ClassNameAction | undefined {
  const from = classTokens(combineClassNames(generatedClassName, fromDecorClassName))
  const to = classTokens(combineClassNames(generatedClassName, toDecorClassName))
  const remove = [...from].filter((token) => !to.has(token)).join(' ')
  const add = [...to].filter((token) => !from.has(token)).join(' ')
  if (remove === '' && add === '') return undefined
  return {
    ...(add === '' ? {} : { add }),
    ...(remove === '' ? {} : { remove }),
  }
}

/** Combines authored and generated classes without introducing an empty class value. */
function combineClassNames(...values: Array<string | undefined>): string | undefined {
  const result = values.filter((value): value is string => value !== undefined && value.trim() !== '').join(' ')
  return result === '' ? undefined : result
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
    // Missing numeric pose rotation uses the CSS identity angle without densifying source decor.
    const from = fromStyle[property]
      ?? (poseRotationIdentity && property === 'rotate' && typeof value === 'number' ? 0 : undefined)
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
    interpolated[property] = { from, to: value, duration: durationMs, ease }
  }
  return { interpolated, discrete }
}

/** Identifies a raw CSS calculation that cannot be encoded as a structured logical length tween. */
function isCssCalc(value: unknown): boolean {
  return typeof value === 'string' && /^\s*calc\(/i.test(value)
}

/** Extracts the effective intro duration, using the parent capsule default when no override exists. */
function resolveIntroDuration(transition: Transition | undefined, defaultRef: string | null): number | undefined {
  if (transition === undefined) return transitionRefDuration(defaultRef)
  if (transition.kind !== 'named') return undefined
  return namedTransitionDuration(transition)
}

/** Extracts an explicit named duration while keeping cut/sentinel transitions instantaneous. */
function namedTransitionDuration(transition: Transition | undefined): number | undefined {
  if (transition?.kind !== 'named') return undefined
  if (transition.name === '--' || transition.name === 'cut') return 0
  return transition.durationMs
}

/** Reads a duration from the shared capsule-automation event catalog. */
function transitionRefDuration(ref: string | null): number {
  if (ref === null || ref === '--' || ref === 'cut') return 0
  return Math.max(0, DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS[ref]?.durationMs ?? 0)
}

/** Resolves the transition defaults inherited by one item from its immediate capsule parent. */
function resolveParentTransitionDefaults(
  item: Item,
  itemById: ReadonlyMap<string, Item>,
  rootDefaults: ReturnType<typeof resolveAutoCapsuleDefaults>,
): ReturnType<typeof resolveAutoCapsuleDefaults> {
  if (item.parentId === null) return rootDefaults
  const parent = itemById.get(item.parentId)
  if (parent?.type !== 'capsule' || parent.capsule === undefined) return rootDefaults
  return resolveAutoCapsuleDefaults(parent.capsule.kind, {
    introTransitionRef: parent.capsule.defaultTransitionIn,
    outroTransitionRef: parent.capsule.defaultTransitionOut,
  })
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
