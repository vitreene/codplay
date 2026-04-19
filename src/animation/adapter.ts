import type { AnimationAdapter, AnimationHandle, TransitionRequest } from './types'

export type AnimeAnimationLike = {
  pause?: () => void
  resume?: () => void
  play?: () => void
  seek?: (time: number, muteCallbacks?: boolean | number, internalRender?: boolean | number) => void
  revert?: () => void
}

export type AnimeImplementation = (parameters: Record<string, unknown>) => AnimeAnimationLike | null | undefined

type TransitionGroup = {
  parameters: Record<string, unknown>
  transitions: TransitionRequest[]
  properties: Set<string>
}

type ActiveAnimation = {
  animation: AnimeAnimationLike
  target: unknown
  transitions: TransitionRequest[]
  eventId: string
  duration: number
  delayMs: number
}

/**
 * Applies one style cleanup marker on one transition target.
 */
function cleanupTransitionStyle(transition: TransitionRequest): void {
  const cleanupProperty = transition.cleanupStyleProperty
  if (cleanupProperty === undefined) {
    return
  }

  const target = transition.target
  if (typeof globalThis.Element !== 'undefined' && target instanceof globalThis.Element) {
    const style = (target as HTMLElement).style
    if (cleanupProperty === 'width') {
      style.width = ''
      return
    }

    style.height = ''
    return
  }

  if (typeof target === 'object' && target !== null) {
    const targetObject = target as Record<string, unknown>
    const styleRecord =
      typeof targetObject.style === 'object' && targetObject.style !== null
        ? (targetObject.style as Record<string, unknown>)
        : null

    if (styleRecord !== null) {
      delete styleRecord[cleanupProperty]
    }
  }
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
    const timingKey = `${transition.eventId}|${transition.duration}|${transition.easing ?? ''}|${transition.delayMs ?? 0}|${transition.composition ?? ''}`
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
  const activeAnimations: ActiveAnimation[] = []

  /**
   * Removes active handles associated with one transition set.
   */
  function removeHandlesForTransitions(transitions: TransitionRequest[]): void {
    const transitionIds = new Set(transitions.map((transition) => transition.transitionId))
    for (let index = activeHandles.length - 1; index >= 0; index -= 1) {
      const handle = activeHandles[index]
      if (transitionIds.has(handle.transitionId)) {
        activeHandles.splice(index, 1)
      }
    }
  }

  /**
   * Removes one active animation entry from internal tracking.
   */
  function removeActiveAnimation(entry: ActiveAnimation): void {
    const index = activeAnimations.indexOf(entry)
    if (index >= 0) {
      activeAnimations.splice(index, 1)
    }
  }

  /**
   * Stops one tracked animation and clears its handles.
   */
  function stopActiveAnimation(entry: ActiveAnimation): void {
    entry.animation.revert?.()
    entry.animation.pause?.()
    removeHandlesForTransitions(entry.transitions)
    removeActiveAnimation(entry)
  }

  /**
   * Marks one tracked animation as completed and applies cleanup markers.
   */
  function completeActiveAnimation(entry: ActiveAnimation): void {
    for (const transition of entry.transitions) {
      cleanupTransitionStyle(transition)
    }

    removeHandlesForTransitions(entry.transitions)
    removeActiveAnimation(entry)
  }

  /**
   * Starts a batch of transitions and stores stoppable handles.
   */
  function run(transitions: TransitionRequest[]): AnimationHandle[] {
    const startedHandles: AnimationHandle[] = []
    const transitionGroups = groupTransitions(transitions)

    for (const transitionGroup of transitionGroups) {
      const transitionCleanupRunner = () => {
        for (const transition of transitionGroup.transitions) {
          cleanupTransitionStyle(transition)
        }

        const activeAnimation = activeAnimations.find((entry) => entry.transitions === transitionGroup.transitions)
        if (activeAnimation !== undefined) {
          removeHandlesForTransitions(activeAnimation.transitions)
          removeActiveAnimation(activeAnimation)
        }
      }

      transitionGroup.parameters.onComplete = transitionCleanupRunner
      transitionGroup.parameters.complete = transitionCleanupRunner

      const animation = animeImplementation(transitionGroup.parameters)
      if (animation === null || animation === undefined) {
        continue
      }

      const firstTransition = transitionGroup.transitions[0]
      if (firstTransition === undefined) {
        continue
      }

      const activeAnimation: ActiveAnimation = {
        animation,
        target: firstTransition.target,
        transitions: transitionGroup.transitions,
        eventId: firstTransition.eventId,
        duration: firstTransition.duration,
        delayMs: firstTransition.delayMs ?? 0
      }
      activeAnimations.push(activeAnimation)

      let isStopped = false
      const stopAnimation = () => {
        if (isStopped) {
          return
        }

        isStopped = true
        stopActiveAnimation(activeAnimation)
      }

      for (const transition of transitionGroup.transitions) {
        const handle: AnimationHandle = {
          transitionId: transition.transitionId,
          target: transition.target,
          stop: stopAnimation
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
    for (const activeAnimation of [...activeAnimations]) {
      if (target !== undefined && activeAnimation.target !== target) {
        continue
      }

      stopActiveAnimation(activeAnimation)
    }
  }

  /**
   * Pauses active animations either globally or for one specific target.
   */
  function pause(target?: unknown): void {
    for (const activeAnimation of activeAnimations) {
      if (target !== undefined && activeAnimation.target !== target) {
        continue
      }

      activeAnimation.animation.pause?.()
    }
  }

  /**
   * Resumes active animations either globally or for one specific target.
   */
  function resume(target?: unknown): void {
    for (const activeAnimation of activeAnimations) {
      if (target !== undefined && activeAnimation.target !== target) {
        continue
      }

      if (typeof activeAnimation.animation.resume === 'function') {
        activeAnimation.animation.resume()
        continue
      }

      activeAnimation.animation.play?.()
    }
  }

  /**
   * Seeks active animations to match the requested player timeline.
   */
  function seek(timelineMs: number, eventMsByEventId: ReadonlyMap<string, number>, target?: unknown): void {
    for (const activeAnimation of [...activeAnimations]) {
      if (target !== undefined && activeAnimation.target !== target) {
        continue
      }

      const eventMs = eventMsByEventId.get(activeAnimation.eventId)
      if (eventMs === undefined) {
        continue
      }

      const elapsedMs = timelineMs - eventMs - activeAnimation.delayMs
      const clampedElapsedMs = Math.min(Math.max(0, elapsedMs), activeAnimation.duration)
      activeAnimation.animation.seek?.(clampedElapsedMs)
      activeAnimation.animation.pause?.()

      if (elapsedMs >= activeAnimation.duration) {
        completeActiveAnimation(activeAnimation)
      }
    }
  }

  return { run, stop, pause, resume, seek }
}
