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
  AutoCapsuleEventInput,
  AutoCapsuleType,
} from '@codplay/capsule-automation'
import { CapsuleDistribution } from '@codplay/scene-factory/capsule-distribution'
import { CapsulePreset } from '@codplay/scene-factory/capsule-preset'
import { TransitionTiming } from '@codplay/scene-factory/transition-timing'
import type { CapsuleDistributionOutput } from '@codplay/scene-factory/capsule-distribution'
import type { CapsuleKind } from '@codplay/scene-factory/capsule-preset'
import type { PersoDoc, SceneDoc } from 'codplay'
import { prepareSvgPath } from 'ace'
import type { CapsuleDef, EditorScene, Item, Keyframe, Transition } from '../app/commands/types'
import { DEFAULT_EASING } from '../sequence-editor/constants'
import {
  computeStyleDiff,
  hasZoneAssignment,
  isInterpolableStylePair,
  resolveInitialClassName,
  resolveInitialStyle,
  resolveKeyframeClassName,
  resolveKeyframeStyle,
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
  const rootTransitionDefaults = resolveAutoCapsuleDefaults(CAPSULE_TYPE.card)
  const preRollMs = TransitionTiming.computeScenePreRollMs(scene.items.map((item) => {
    const firstKeyframe = sortKeyframes(item)[0]
    const parentTransitionDefaults = resolveParentTransitionDefaults(item, itemById, rootTransitionDefaults)
    return {
      firstKeyframe: firstKeyframe === undefined ? undefined : {
        timeMs: firstKeyframe.timeMs,
        transitionInDurationMs: resolveIntroDuration(firstKeyframe.transitionIn, parentTransitionDefaults.introTransitionRef),
      },
    }
  }))

  const rootResolution = resolveCapsule(rootItems, CAPSULE_TYPE.card, preRollMs, diagnostics, {
    sceneRoot: true,
    fallbackClipDurationMs: scene.meta.durationMs,
    distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
    transitionDefaults: rootTransitionDefaults,
  })
  if (rootResolution === undefined || diagnostics.some((diagnostic) => diagnostic.level === 'error')) {
    return failure(diagnostics)
  }

  const rootPerso: PersoDoc<'list'> = buildRootPerso(scene, rootResolution.rootArtifact.className)
  const persos: Array<V2Perso> = [rootPerso]
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

      const leaf = buildLeafPerso(scene, item, current.parentPersoId, childArtifact, preRollMs, diagnostics)
      persos.push(leaf.perso)
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
    if (hasZoneAssignment(decor)) diagnostics.push({
      level: 'warning',
      code: 'EDITOR_V2_ZONE_DEFERRED',
      message: 'Decor.zoneId is preserved in the editor model but zone materialization is deferred to the post-V2 zones tranche.',
      context: { itemId: item.id, decorId: decor?.id, zoneId: decor?.zoneId },
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

type CapsuleResolution = Readonly<{
  rootArtifact: Readonly<{ className: string }>
  childArtifactById: ReadonlyMap<string, AutoCapsuleChildElementArtifact>
  styleSheet: string
  grid: Readonly<{ rows: number; cols: number }>
}>

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
  }>,
): CapsuleResolution | undefined {
  try {
    const preset = resolveCapsulePreset(capsuleType, options?.distribution)
    const transitionDefaults = options?.transitionDefaults ?? resolveAutoCapsuleDefaults(capsuleType)
    const distribution = resolveCapsuleDistribution(items, preRollMs, preset, transitionDefaults, options?.fallbackClipDurationMs)
    const children: AutoCapsuleChildInput[] = items.map((item, index) => {
      const timing = distribution.children.find((child) => child.trackId === item.id)
      if (timing === undefined) throw new Error(`No timing was produced for item '${item.id}'.`)
      return {
        id: item.id,
        order: index,
        timeRange: { startMs: timing.introMs, endMs: timing.outroMs },
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
  const authoredClipDurationMs = items.reduce((max, item) => Math.max(max, sortKeyframes(item).at(-1)?.timeMs ?? 0), 0)
  return CapsuleDistribution.compute({
    clipDurationMs: Math.max(authoredClipDurationMs, fallbackClipDurationMs) + preRollMs,
    ...preset,
    children: items.map((item) => {
      const keyframes = sortKeyframes(item)
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
  const keyframes = sortKeyframes(item)
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
): Readonly<{ perso: V2LeafPerso; eventimes: Array<{ name: string; startAt: number }> }> {
  const content = item.contentId === null ? undefined : scene.contents[item.contentId]
  const text = item.type === 'text' ? content?.text : undefined
  const keyframes = sortKeyframes(item)
  const firstKeyframe = keyframes[0]
  const initialStyle = firstKeyframe === undefined
    ? resolveInitialStyle(scene, item)
    : resolveKeyframeStyle(scene, item, firstKeyframe)
  const initialClassName = firstKeyframe === undefined
    ? resolveInitialClassName(scene, item)
    : resolveKeyframeClassName(scene, item, firstKeyframe)
  const lastKeyframe = keyframes.at(-1)
  const lastClassName = lastKeyframe === undefined
    ? initialClassName
    : resolveKeyframeClassName(scene, item, lastKeyframe)
  const transition = resolveTransitionActions(childArtifact)
  if (lastClassName !== initialClassName) {
    // The class channel is discrete by contract; the current V2 builder slice keeps the initial class and
    // reports the later authored value instead of manufacturing a class tween.
    diagnostics.push({
      level: 'warning',
      code: 'EDITOR_V2_DISCRETE_CLASSES_IGNORED',
      message: 'Class changes between keyframes are discrete and are not interpolated by the V2 builder.',
      context: { itemId: item.id },
    })
  }
  const initial = { ...initialStyle, ...transition.introFrom }
  const decorActions = buildInterpolationActions(scene, item, keyframes, preRollMs, diagnostics)
  const actions: Record<string, { style?: Record<string, unknown>; move?: Record<string, unknown> }> = { ...transition.actions }
  for (const action of decorActions) {
    actions[action.name] = {
      ...(Object.keys(action.style).length === 0 ? {} : { style: action.style }),
      ...(action.move === undefined ? {} : { move: action.move }),
    }
  }
  const eventimes = [...transition.eventimes, ...decorActions.map((action) => ({ name: action.name, startAt: action.startAt }))]
  const common = {
    move: { target: parentPersoId },
    ...(childArtifact.className === '' && initialClassName === undefined
      ? {}
      : { className: [childArtifact.className, initialClassName].filter(Boolean).join(' ') }),
    ...(Object.keys(initial).length > 0 ? { style: initial } : {}),
  }

  if (item.type === 'image') {
    return { perso: { id: item.id, name: item.id, type: 'img', initial: { ...common, ...(content?.source === undefined ? {} : { src: content.source }) }, actions }, eventimes }
  }

  if (item.type === 'video' || item.type === 'media') {
    return { perso: { id: item.id, name: item.id, type: 'media', initial: { ...common, tag: item.type === 'video' ? 'video' : 'audio', src: content?.source as string, master: item.id === scene.masterItemId }, actions }, eventimes }
  }

  return { perso: { id: item.id, name: item.id, type: 'tag', initial: { ...common, tag: 'div', ...(text === undefined ? {} : { content: text }) }, actions }, eventimes }
}

/**
 * Builds decor actions between every adjacent keyframe pair.
 *
 * A property present at the destination but absent from the resolved source has no authored
 * interpolation endpoint. It therefore becomes a direct style patch at the destination KF; no
 * CSS default is invented and no `{to: ...}` tween without a materialized `from` is emitted.
 */
function buildInterpolationActions(
  scene: EditorScene,
  item: Item,
  keyframes: Keyframe[],
  preRollMs: number,
  diagnostics: BuilderDiagnostic[],
): Array<{ name: string; style: Record<string, unknown>; startAt: number; move?: Record<string, unknown> }> {
  const actions: Array<{ name: string; style: Record<string, unknown>; startAt: number; move?: Record<string, unknown> }> = []
  for (let index = 1; index < keyframes.length; index += 1) {
    const source = keyframes[index - 1]!
    const destination = keyframes[index]!
    const fromStyle = resolveKeyframeStyle(scene, item, source)
    const toStyle = resolveKeyframeStyle(scene, item, destination)
    const diff = computeStyleDiff(fromStyle, toStyle)
    const path = scene.decors[destination.decorId]?.path
    const hasMotionPath = typeof path === 'string' && path.trim() !== ''
    if (hasMotionPath) {
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

    const transition = destination.transitionIn?.kind === 'interpolated'
      ? destination.transitionIn
      : source.transitionOut?.kind === 'interpolated'
        ? source.transitionOut
        : undefined
    const intervalMs = Math.max(0, destination.timeMs - source.timeMs)
    const durationMs = transition?.durationMs ?? intervalMs
    const ease = transition === undefined ? normalizeEasing(DEFAULT_EASING) : normalizeEasing(transition.easing)
    const style: Record<string, unknown> = {}
    const discreteStyle: Record<string, unknown> = {}
    for (const [property, value] of Object.entries(diff)) {
      const from = fromStyle[property]
      if (from === undefined) {
        // The destination property is authored, but the source has no authored value. Applying it
        // at the destination preserves the keyframe state without pretending that a CSS default is
        // part of the V2 document.
        if (value !== undefined) discreteStyle[property] = value
        continue
      }
      if (!isInterpolableStylePair(from, value)) continue
      style[property] = { from, to: value, duration: durationMs, ease }
    }

    const startAt = durationMs <= 0
      ? destination.timeMs + preRollMs
      : TransitionTiming.interpolatedTransitionTriggerMs({
        sourceKfTimeMs: source.timeMs,
        destKfTimeMs: destination.timeMs,
        durationMs,
        direction: transition?.direction ?? 'after',
      }) + preRollMs
    const actionName = `${item.id}-kf-${destination.id}`
    if (Object.keys(style).length > 0 || (hasMotionPath && intervalMs > 0)) {
      actions.push({
        name: actionName,
        style,
        ...(hasMotionPath && intervalMs > 0 ? {
          move: {
            target: item.parentId === null ? EDITOR_V2_ROOT_PERSO_ID : item.parentId,
            flipMode: 'local',
            transition: {
              duration: intervalMs,
              ease,
              path,
              traversal: 'arc-length',
              // The editor overlay is authored from affine visual centers;
              // CodPlay must resolve the same center path at presentation time.
              pathAnchor: 'center',
            },
          },
        } : {}),
        startAt: hasMotionPath && intervalMs > 0 ? source.timeMs + preRollMs : startAt,
      })
    }
    if (Object.keys(discreteStyle).length > 0) {
      actions.push({
        name: `${actionName}-discrete`,
        style: discreteStyle,
        startAt: destination.timeMs + preRollMs,
      })
    }
  }
  return actions
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

/** Normalizes the editor easing vocabulary to the V2 action spelling. */
function normalizeEasing(easing: string | { kind: 'cubic-bezier'; p1x: number; p1y: number; p2x: number; p2y: number }): string {
  if (typeof easing !== 'string') return `cubic-bezier(${easing.p1x},${easing.p1y},${easing.p2x},${easing.p2y})`
  return {
    linear: 'linear',
    'ease-in': 'in',
    'ease-out': 'out',
    'ease-in-out': 'inOut',
  }[easing] ?? easing
}

/** Creates one blocking diagnostic. */
function error(code: string, message: string, context?: Readonly<Record<string, unknown>>): BuilderDiagnostic {
  return { level: 'error', code, message, ...(context === undefined ? {} : { context }) }
}

/** Keeps the failure branch explicit and guarantees that no partial scene escapes. */
function failure(diagnostics: readonly BuilderDiagnostic[]): BuildSceneV2Failure {
  return { ok: false, diagnostics }
}
