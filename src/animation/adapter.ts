import type { AnimationAdapter, AnimationHandle, TransitionRequest } from './types'

export type AnimeAnimationLike = {
  pause?: () => void
}

export type AnimeImplementation = (parameters: Record<string, unknown>) => AnimeAnimationLike | null | undefined

type TransitionGroup = {
  parameters: Record<string, unknown>
  transitions: TransitionRequest[]
  properties: Set<string>
}

/**
 * Checks whether one transition does not change any value.
 */
function isNoOpTransition(transition: TransitionRequest): boolean {
  return transition.from !== undefined && transition.from === transition.to
}

/**
 * Builds the tween value payload for one transition.
 */
function toTransitionValue(transition: TransitionRequest): Record<string, number | string> {
  if (transition.from === undefined) {
    return {
      to: transition.to
    }
  }

  return {
    from: transition.from,
    to: transition.to
  }
}

/**
 * Resolves one stable key for a transition target.
 */
function resolveTargetKey(
  target: unknown,
  objectIds: WeakMap<object, number>,
  nextObjectIdRef: { value: number }
): string {
  if (typeof target === 'object' && target !== null) {
    let objectId = objectIds.get(target)
    if (objectId === undefined) {
      objectId = nextObjectIdRef.value
      nextObjectIdRef.value += 1
      objectIds.set(target, objectId)
    }

    return `object:${objectId}`
  }

  return `primitive:${String(target)}`
}

/**
 * Groups transitions by target and shared timing to minimize anime.js calls.
 */
function groupTransitions(transitions: TransitionRequest[]): TransitionGroup[] {
  const groupsByKey = new Map<string, TransitionGroup>()
  const groupedTransitions: TransitionGroup[] = []
  const objectIds = new WeakMap<object, number>()
  const nextObjectIdRef = { value: 1 }

  for (const transition of transitions) {
    if (isNoOpTransition(transition)) {
      continue
    }

    const targetKey = resolveTargetKey(transition.target, objectIds, nextObjectIdRef)
    const timingKey = `${transition.duration}|${transition.easing ?? ''}|${transition.delayMs ?? 0}|${transition.composition ?? ''}`
    const baseGroupKey = `${targetKey}|${timingKey}`

    const propertyKey = transition.property
    let groupKey = baseGroupKey
    let duplicateIndex = 1

    while (true) {
      const existingGroup = groupsByKey.get(groupKey)
      if (existingGroup === undefined || !existingGroup.properties.has(propertyKey)) {
        break
      }

      groupKey = `${baseGroupKey}|dup-${duplicateIndex}`
      duplicateIndex += 1
    }

    let group = groupsByKey.get(groupKey)
    if (group === undefined) {
      group = {
        parameters: {
          targets: transition.target,
          duration: transition.duration,
          ease: transition.easing,
          delay: transition.delayMs,
          composition: transition.composition
        },
        transitions: [],
        properties: new Set<string>()
      }

      groupsByKey.set(groupKey, group)
      groupedTransitions.push(group)
    }

    group.parameters[propertyKey] = toTransitionValue(transition)
    group.properties.add(propertyKey)
    group.transitions.push(transition)
  }

  return groupedTransitions
}

/**
 * Creates an animation adapter that bridges transition requests to Anime.js.
 */
export function createAnimationAdapter(animeImplementation: AnimeImplementation): AnimationAdapter {
  const activeHandles: AnimationHandle[] = []

  /**
   * Starts a batch of transitions and stores stoppable handles.
   */
  function run(transitions: TransitionRequest[]): AnimationHandle[] {
    const startedHandles: AnimationHandle[] = []
    const transitionGroups = groupTransitions(transitions)

    for (const transitionGroup of transitionGroups) {
      const animation = animeImplementation(transitionGroup.parameters)
      if (animation === null || animation === undefined) {
        continue
      }

      for (const transition of transitionGroup.transitions) {
        const handle: AnimationHandle = {
          transitionId: transition.transitionId,
          target: transition.target,
          stop: () => {
            animation.pause?.()
          }
        }

        activeHandles.push(handle)
        startedHandles.push(handle)
      }
    }

    return startedHandles
  }

  /**
   * Stops active animations either globally or for one specific target.
   */
  function stop(target?: unknown): void {
    for (const handle of [...activeHandles]) {
      if (target !== undefined && handle.target !== target) {
        continue
      }

      handle.stop()
      const index = activeHandles.indexOf(handle)
      if (index >= 0) {
        activeHandles.splice(index, 1)
      }
    }
  }

  return { run, stop }
}
