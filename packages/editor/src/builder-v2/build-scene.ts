import { DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS, EVENT_ACTION } from '@codplay/capsule-automation'
import { TransitionTiming } from '@codplay/scene-factory'
import type { SceneDoc } from 'codplay'
import type { EditorScene, Item, Keyframe, Transition } from '../app/commands/types'
import { DEFAULT_EASING } from '../sequence-editor/constants'
import {
  computeStyleDiff,
  hasOffsetData,
  hasZoneAssignment,
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

/** Builds the minimal native V2 SceneDoc used to start the editor integration. */
export function buildSceneDocV2(scene: EditorScene): BuildSceneV2Result {
  const diagnostics = validateMinimalInput(scene)
  if (diagnostics.some((diagnostic) => diagnostic.level === 'error')) {
    return failure(diagnostics)
  }

  const item = scene.items.find((candidate) => candidate.parentId === null)!
  const keyframes = sortKeyframes(item)
  const firstKeyframe = keyframes[0]!
  const lastKeyframe = keyframes[1]!
  const preRollMs = TransitionTiming.computeScenePreRollMs([{
    firstKeyframe: {
      timeMs: firstKeyframe.timeMs,
      transitionInDurationMs: namedTransitionDuration(firstKeyframe.transitionIn),
    },
  }])

  const itemActions: Record<string, { style: Record<string, unknown> }> = {}
  const eventimes: Array<{ name: string; startAt: number }> = []
  const initialStyle = resolveKeyframeStyle(scene, item, firstKeyframe)
  const rootStyle = resolveRootStyle(scene)
  const rootClassName = resolveRootClassName(scene)
  const initialClassName = resolveKeyframeClassName(scene, item, firstKeyframe)
  if (resolveKeyframeClassName(scene, item, lastKeyframe) !== initialClassName) {
    diagnostics.push({
      level: 'warning',
      code: 'EDITOR_V2_DISCRETE_CLASSES_IGNORED',
      message: 'Class changes between keyframes are discrete and are not interpolated by the first V2 increment.',
      context: { itemId: item.id },
    })
  }
  const intro = resolveNamedTransition(firstKeyframe.transitionIn, EVENT_ACTION.intro, item.id, diagnostics)
  const outro = resolveNamedTransition(lastKeyframe.transitionOut, EVENT_ACTION.outro, item.id, diagnostics)

  if (intro !== undefined && Object.keys(intro.style).length > 0) {
    itemActions[`${item.id}-intro`] = { style: intro.style }
    eventimes.push({
      name: `${item.id}-intro`,
      startAt: firstKeyframe.timeMs + preRollMs - intro.durationMs,
    })
    for (const [property, value] of Object.entries(intro.style)) {
      if (isStyleTransition(value) && value.from !== undefined) initialStyle[property] = value.from
    }
  }

  const interpolation = buildInterpolationAction(scene, item, firstKeyframe, lastKeyframe, preRollMs)
  if (interpolation !== undefined) {
    itemActions[interpolation.name] = { style: interpolation.style }
    eventimes.push({ name: interpolation.name, startAt: interpolation.startAt })
  }

  if (outro !== undefined && Object.keys(outro.style).length > 0) {
    itemActions[`${item.id}-outro`] = { style: outro.style }
    eventimes.push({
      name: `${item.id}-outro`,
      startAt: lastKeyframe.timeMs + preRollMs,
    })
  }

  if (diagnostics.some((diagnostic) => diagnostic.level === 'error')) {
    return failure(diagnostics)
  }

  const sceneDoc: SceneDoc = {
    id: scene.id,
    name: scene.meta.title,
    stories: {
      [EDITOR_V2_STORY_ID]: {
        id: EDITOR_V2_STORY_ID,
        name: 'main',
        persos: [
          {
            id: EDITOR_V2_ROOT_PERSO_ID,
            name: 'root',
            type: 'list',
            initial: {
              move: '@root',
              tag: 'div',
              ...(rootClassName === undefined ? {} : { className: rootClassName }),
              ...(Object.keys(rootStyle).length > 0 ? { style: rootStyle } : {}),
            },
            actions: {},
          },
          {
            id: item.id,
            name: item.id,
            type: 'tag',
            initial: {
              move: { target: EDITOR_V2_ROOT_PERSO_ID },
              tag: 'div',
              ...(initialClassName === undefined ? {} : { className: initialClassName }),
              ...(resolveText(scene, item) === undefined ? {} : { content: resolveText(scene, item) }),
              ...(Object.keys(initialStyle).length > 0 ? { style: initialStyle } : {}),
            },
            actions: itemActions,
          },
        ],
        eventimes,
      },
    },
  }

  return {
    ok: true,
    sceneDoc,
    durationMs: scene.meta.durationMs,
    preRollMs,
    // No capsule-automation CSS is emitted by this first root/text increment. Keeping the
    // manifest explicit makes the future bridge handoff visible without pretending CSS exists.
    preloadManifest: { entries: [] },
    diagnostics,
  }
}

/** Validates the intentionally narrow first increment without returning a partial SceneDoc. */
function validateMinimalInput(scene: EditorScene): BuilderDiagnostic[] {
  const diagnostics: BuilderDiagnostic[] = []
  if (scene.id.trim() === '') diagnostics.push(error('EDITOR_V2_SCENE_ID_INVALID', 'scene.id must not be empty.'))
  if (!Number.isFinite(scene.meta.durationMs) || scene.meta.durationMs < 0) {
    diagnostics.push(error('EDITOR_V2_DURATION_INVALID', 'scene.meta.durationMs must be a finite non-negative number.'))
  }

  const rootItems = scene.items.filter((item) => item.parentId === null)
  if (rootItems.length !== 1 || scene.items.length !== 1) {
    diagnostics.push(error(
      'EDITOR_V2_MINIMAL_SHAPE_UNSUPPORTED',
      'The first V2 builder increment accepts exactly one root-level text item and no nested item.',
      { itemCount: scene.items.length, rootItemCount: rootItems.length },
    ))
    return diagnostics
  }

  const item = rootItems[0]!
  if (item.id.trim() === '') diagnostics.push(error('EDITOR_V2_ITEM_ID_INVALID', 'The mapped item id must not be empty.', { itemId: item.id }))
  if (item.type !== 'text') diagnostics.push(error('EDITOR_V2_ITEM_TYPE_UNSUPPORTED', `Item type '${item.type}' is not part of the first V2 increment.`, { itemId: item.id }))
  if (item.visible === false) diagnostics.push(error('EDITOR_V2_ITEM_VISIBILITY_UNSUPPORTED', 'An invisible item has no V2 mapping in the first increment.', { itemId: item.id }))

  const keyframes = sortKeyframes(item)
  if (keyframes.length !== 2) diagnostics.push(error('EDITOR_V2_KEYFRAME_COUNT_UNSUPPORTED', 'The first V2 increment accepts exactly two keyframes.', { itemId: item.id, keyframeCount: keyframes.length }))
  if (keyframes.some((keyframe) => !Number.isFinite(keyframe.timeMs) || keyframe.timeMs < 0)) {
    diagnostics.push(error('EDITOR_V2_KEYFRAME_TIME_INVALID', 'Keyframe times must be finite non-negative numbers.', { itemId: item.id }))
  }
  for (const keyframe of keyframes) {
    for (const transition of [keyframe.transitionIn, keyframe.transitionOut]) {
      if (transition !== undefined && (!Number.isFinite(transition.durationMs) || transition.durationMs < 0)) {
        diagnostics.push(error('EDITOR_V2_TRANSITION_DURATION_INVALID', 'Transition durations must be finite non-negative numbers.', { itemId: item.id, keyframeId: keyframe.id }))
      }
    }
  }
  if (keyframes.length === 2 && keyframes[1]!.timeMs < keyframes[0]!.timeMs) {
    diagnostics.push(error('EDITOR_V2_KEYFRAME_ORDER_INVALID', 'Keyframes must have a non-decreasing time order.', { itemId: item.id }))
  }

  const content = item.contentId === null ? undefined : scene.contents[item.contentId]
  if (item.contentId !== null && content === undefined) diagnostics.push(error('EDITOR_V2_CONTENT_NOT_FOUND', `Content '${item.contentId}' is not present.`, { itemId: item.id, contentId: item.contentId }))
  if (content !== undefined && content.type !== 'text') diagnostics.push(error('EDITOR_V2_CONTENT_TYPE_UNSUPPORTED', `Content type '${content.type}' is not part of the text increment.`, { itemId: item.id, contentId: content.id }))

  const decorIds = [...new Set([
    scene.rootDecorId,
    item.initialDecorId,
    ...keyframes.map((keyframe) => keyframe.decorId),
  ])]
  for (const decorId of decorIds) {
    if (decorId !== undefined && scene.decors[decorId] === undefined) {
      diagnostics.push(error('EDITOR_V2_DECOR_NOT_FOUND', `Decor '${decorId}' is not present.`, { itemId: item.id, decorId }))
    }
  }

  const relevantDecors = decorIds
    .filter((decorId): decorId is string => decorId !== undefined)
    .map((decorId) => scene.decors[decorId])
  for (const decor of relevantDecors) {
    if (hasOffsetData(decor)) diagnostics.push(error('EDITOR_V2_OFFSET_REQUIRES_CQW', 'Structured OffsetData is deferred until the V2 cqw capability is implemented.', { decorId: decor?.id }))
    if (hasZoneAssignment(decor)) diagnostics.push({
      level: 'warning',
      code: 'EDITOR_V2_ZONE_DEFERRED',
      message: 'Decor.zoneId is preserved in the editor model but zone materialization is deferred to the post-V2 zones tranche.',
      context: { decorId: decor?.id, zoneId: decor?.zoneId },
    })
  }

  if (keyframes.length === 2 && keyframes[0]?.transitionIn?.kind === 'interpolated') {
    diagnostics.push(error('EDITOR_V2_FIRST_INTRO_UNSUPPORTED', 'The first keyframe intro must use a named transition in this increment.', { itemId: item.id }))
  }
  return diagnostics
}

/** Builds one forward interpolated decor action between the two accepted keyframes. */
function buildInterpolationAction(
  scene: EditorScene,
  item: Item,
  source: Keyframe,
  destination: Keyframe,
  preRollMs: number,
): { name: string; style: Record<string, unknown>; startAt: number } | undefined {
  const fromStyle = resolveKeyframeStyle(scene, item, source)
  const toStyle = resolveKeyframeStyle(scene, item, destination)
  const diff = computeStyleDiff(fromStyle, toStyle)
  if (Object.keys(diff).length === 0) return undefined

  const transition = destination.transitionIn?.kind === 'interpolated'
    ? destination.transitionIn
    : source.transitionOut?.kind === 'interpolated'
      ? source.transitionOut
      : undefined
  const intervalMs = Math.max(0, destination.timeMs - source.timeMs)
  const durationMs = transition?.durationMs ?? intervalMs
  const ease = transition === undefined ? normalizeEasing(DEFAULT_EASING) : normalizeEasing(transition.easing)
  const style: Record<string, unknown> = {}
  for (const [property, value] of Object.entries(diff)) {
    const from = fromStyle[property]
    style[property] = from === undefined
      ? { to: value, duration: durationMs, ease }
      : { from, to: value, duration: durationMs, ease }
  }

  const startAt = durationMs <= 0
    ? destination.timeMs + preRollMs
    : TransitionTiming.interpolatedTransitionTriggerMs({
      sourceKfTimeMs: source.timeMs,
      destKfTimeMs: destination.timeMs,
      durationMs,
      direction: transition?.direction ?? 'after',
    }) + preRollMs
  return { name: `${item.id}-kf-${destination.id}`, style, startAt }
}

/** Resolves a named transition definition from the existing capsule-automation catalog. */
function resolveNamedTransition(
  transition: Transition | undefined,
  action: string,
  itemId: string,
  diagnostics: BuilderDiagnostic[],
): { style: Record<string, unknown>; durationMs: number } | undefined {
  if (transition === undefined || transition.kind !== 'named') return undefined
  if (transition.name === '--') return undefined
  const definition = DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS[transition.name]
  if (definition === undefined) {
    diagnostics.push(error('EDITOR_V2_TRANSITION_NOT_FOUND', `Named transition '${transition.name}' is not in the capsule-automation catalog.`, { itemId, transition: transition.name }))
    return undefined
  }

  const definitionStyle = definition.style?.[action as typeof EVENT_ACTION.intro | typeof EVENT_ACTION.outro] ?? {}
  const style: Record<string, unknown> = {}
  for (const [property, value] of Object.entries(definitionStyle)) {
    style[property] = {
      ...value,
      duration: transition.durationMs,
    }
  }
  return { style, durationMs: transition.durationMs }
}

/** Extracts the duration used by a named intro when calculating the scene pre-roll. */
function namedTransitionDuration(transition: Transition | undefined): number | undefined {
  return transition?.kind === 'named' ? transition.durationMs : undefined
}

/** Returns keyframes in the timeline order required by the pure resolver. */
function sortKeyframes(item: Item): Keyframe[] {
  return [...item.keyframes].sort((left, right) => left.timeMs - right.timeMs)
}

/** Resolves text content while preserving the absence of an authored value. */
function resolveText(scene: EditorScene, item: Item): string | undefined {
  if (item.contentId === null) return undefined
  return scene.contents[item.contentId]?.text
}

/** Normalizes the editor easing vocabulary to the V2 action spelling. */
function normalizeEasing(easing: string | { kind: 'cubic-bezier'; p1x: number; p1y: number; p2x: number; p2y: number }): string {
  if (typeof easing !== 'string') return `cubic-bezier(${easing.p1x},${easing.p1y},${easing.p2x},${easing.p2y})`
  return {
    linear: 'linear',
    'ease-in': 'easeIn',
    'ease-out': 'easeOut',
    'ease-in-out': 'easeInOut',
  }[easing] ?? easing
}

/** Detects a named style transition value while keeping the helper local to the builder boundary. */
function isStyleTransition(value: unknown): value is { from?: unknown; to?: unknown } {
  return typeof value === 'object' && value !== null && ('from' in value || 'to' in value)
}

/** Creates one blocking diagnostic. */
function error(code: string, message: string, context?: Readonly<Record<string, unknown>>): BuilderDiagnostic {
  return { level: 'error', code, message, ...(context === undefined ? {} : { context }) }
}

/** Keeps the failure branch explicit and guarantees that no partial scene escapes. */
function failure(diagnostics: readonly BuilderDiagnostic[]): BuildSceneV2Failure {
  return { ok: false, diagnostics }
}
