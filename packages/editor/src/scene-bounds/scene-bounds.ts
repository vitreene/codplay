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

/** Maps one parent group to bound inputs: the first pose KF locks the intro, the last one (if distinct) the outro. */
function boundsNodesOf(items: readonly Item[], parentId: string | null): BoundsNodeInput[] {
  return childrenOf(items, parentId).map((item) => {
    const keyframes = item.keyframes
      .filter((keyframe) => resolveKeyframeChannel(keyframe) === 'pose')
      .sort((left, right) => left.timeMs - right.timeMs)
    const first = keyframes[0]
    const last = keyframes.length > 1 ? keyframes.at(-1) : undefined
    return {
      id: item.id,
      intro: first === undefined ? undefined : lockedBound(first, first.transitionIn),
      outro: last === undefined ? undefined : lockedBound(last, last.transitionOut),
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

/** A stored keyframe locks its bound; only a named transition is an explicit appearance transition. */
function lockedBound(keyframe: Keyframe, transition: Transition | undefined): BoundInput {
  const explicit = explicitTransition(transition)
  return explicit === undefined ? { timeMs: keyframe.timeMs } : { timeMs: keyframe.timeMs, transition: explicit }
}

/** Maps a named transition to Capsule Automation's explicit transition; `cut`/`--` last 0 ms. */
function explicitTransition(transition: Transition | undefined): BoundTransitionInput | undefined {
  if (transition?.kind !== 'named') return undefined
  const instantaneous = transition.name === 'cut' || transition.name === '--'
  return { ref: transition.name, durationMs: instantaneous ? 0 : transition.durationMs }
}
