import { CapsuleBounds } from '@codplay/capsule-automation'
import type { BoundInput, BoundTransitionInput, BoundsNodeInput, CapsuleBoundsOutput } from '@codplay/capsule-automation'
import { resolveKeyframeChannel } from '../app/commands/types'
import type { CapsuleDef, EditorScene, Item, Keyframe, Transition } from '../app/commands/types'

/** Root capsule kind when the scene does not author one: a full-surface card. */
export const ROOT_CAPSULE_DEFAULT_KIND = 'card'

/** Root distribution when the scene does not author one: every root child spans the scene. */
export const ROOT_CAPSULE_DEFAULT_DISTRIBUTION: NonNullable<CapsuleDef['distribution']> = { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 }

/**
 * Resolves every item's entry/exit bounds through Capsule Automation. The timeline preview and the
 * Builder both read this result, so a bound is placed at the same instant everywhere.
 */
export function resolveSceneBounds(scene: EditorScene): CapsuleBoundsOutput {
  const root = scene.rootCapsule
  return CapsuleBounds.resolve({
    durationMs: scene.meta.durationMs,
    order: scene.meta.capsuleOrder,
    root: {
      kind: root?.kind ?? ROOT_CAPSULE_DEFAULT_KIND,
      distribution: root?.distribution ?? ROOT_CAPSULE_DEFAULT_DISTRIBUTION,
      defaultTransitionIn: root?.defaultTransitionIn,
      defaultTransitionOut: root?.defaultTransitionOut,
      children: boundsNodesOf(scene.items, null),
    },
  })
}

/** Returns one parent group's children in the editor's fractional order (id breaks ties). */
export function childrenOf(items: readonly Item[], parentId: string | null): Item[] {
  return items
    .filter((item) => item.parentId === parentId)
    .sort((left, right) => left.order < right.order ? -1 : left.order > right.order ? 1 : left.id.localeCompare(right.id))
}

/**
 * Rewrites the `timeMs` of every linked bound keyframe with its resolved instant: the projection in
 * milliseconds the Builder and the timeline read. Returns the same scene when nothing moved.
 */
export function syncLinkedBoundTimes(scene: EditorScene): EditorScene {
  if (!scene.items.some((item) => item.keyframes.some((keyframe) => keyframe.autoBound !== undefined))) return scene
  const bounds = resolveSceneBounds(scene)
  let changed = false
  const items = scene.items.map((item) => {
    const node = bounds.nodes.get(item.id)
    if (node === undefined || !item.keyframes.some((keyframe) => keyframe.autoBound !== undefined)) return item
    const keyframes = item.keyframes.map((keyframe) => {
      if (keyframe.autoBound === undefined) return keyframe
      const timeMs = node[keyframe.autoBound].timeMs
      if (timeMs === keyframe.timeMs) return keyframe
      changed = true
      return { ...keyframe, timeMs }
    })
    return { ...item, keyframes: keyframes.sort((left, right) => left.timeMs - right.timeMs) }
  })
  return changed ? { ...scene, items } : scene
}

/**
 * Maps one parent group to bound inputs. The intro is the pose KF marked `autoBound: 'intro'`, else
 * the first pose KF; the outro is the one marked `'outro'`, else the last pose KF when distinct. A
 * marked KF is a linked bound, any other bound KF a locked one.
 */
function boundsNodesOf(items: readonly Item[], parentId: string | null): BoundsNodeInput[] {
  return childrenOf(items, parentId).map((item) => {
    const keyframes = item.keyframes
      .filter((keyframe) => resolveKeyframeChannel(keyframe) === 'pose')
      .sort((left, right) => left.timeMs - right.timeMs)
    const first = keyframes.find((keyframe) => keyframe.autoBound === 'intro') ?? keyframes[0]
    const last = keyframes.find((keyframe) => keyframe.autoBound === 'outro') ?? (keyframes.length > 1 ? keyframes.at(-1) : undefined)
    return {
      id: item.id,
      intro: first === undefined ? undefined : boundOf(first, first.transitionIn),
      outro: last === undefined || last === first ? undefined : boundOf(last, last.transitionOut),
      capsule: item.type !== 'capsule' || item.capsule === undefined ? undefined : {
        kind: item.capsule.kind,
        distribution: item.capsule.distribution,
        defaultTransitionIn: item.capsule.defaultTransitionIn,
        defaultTransitionOut: item.capsule.defaultTransitionOut,
        children: boundsNodesOf(items, item.id),
      },
    }
  })
}

/** A linked keyframe leaves its instant to the capsule; any other bound keyframe locks it. */
function boundOf(keyframe: Keyframe, transition: Transition | undefined): BoundInput {
  const explicit = explicitTransition(transition)
  const placement = keyframe.autoBound === undefined ? { timeMs: keyframe.timeMs } : { linked: true as const }
  return explicit === undefined ? placement : { ...placement, transition: explicit }
}

/** Maps a named transition to Capsule Automation's explicit transition; `cut`/`--` last 0 ms. */
function explicitTransition(transition: Transition | undefined): BoundTransitionInput | undefined {
  if (transition?.kind !== 'named') return undefined
  const instantaneous = transition.name === 'cut' || transition.name === '--'
  return { ref: transition.name, durationMs: instantaneous ? 0 : transition.durationMs }
}
