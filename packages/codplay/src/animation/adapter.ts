import { utils } from 'animejs'
import { morphTo as animeSvgMorphTo } from 'animejs/svg'

import { resolveContainerQueryValue } from '../runtime/components/lib/container-query-units'
import type { AnimationAdapter, AnimationHandle, AnimationOperation, AnimeSvgMorphOperation, TransitionRequest } from './types'

/**
 * Resolves one transition value's container query units, when the transition
 * target is a real DOM element — a no-op for any other target (three.js
 * meshes, plain objects...) and for any non-container-query value.
 */
function resolveTransitionValue(target: unknown, rawValue: string | number | undefined): string | number | undefined {
  if (rawValue === undefined || typeof globalThis.Element === 'undefined' || !(target instanceof globalThis.Element)) {
    return rawValue
  }

  return resolveContainerQueryValue(target, rawValue) as string | number
}

export type AnimeAnimationLike = {
  pause?: () => void
  resume?: () => void
  play?: () => void
  seek?: (time: number, muteCallbacks?: boolean | number, internalRender?: boolean | number) => void
  revert?: () => void
}

export type AnimeImplementation = (parameters: Record<string, unknown>) => AnimeAnimationLike | null | undefined

export type AnimationAdapterOptions = {
  renderFrame?: (frameNowMs: number) => void
  setRate?: (rate: number) => void
}

type TransitionGroup = {
  parameters: Record<string, unknown>
  transitions: TransitionRequest[]
  properties: Set<string>
  onFrameCallbacks: Set<() => void>
}

type ActiveAnimation = {
  animation: AnimeAnimationLike
  target: unknown
  operations: AnimationOperation[]
  eventId: string
  duration: number
  delayMs: number
  loopDelayMs: number
  reversed: boolean
  alternate: boolean
  loop: boolean | number
  finalized: boolean
}

/**
 * Returns true when one operation is a simple transition request.
 */
function isTransitionRequest(operation: AnimationOperation): operation is TransitionRequest {
  return !('kind' in operation)
}

/**
 * Returns true when one operation targets Anime.js SVG morphing.
 */
function isAnimeSvgMorphOperation(operation: AnimationOperation): operation is AnimeSvgMorphOperation {
  return 'kind' in operation && operation.kind === 'anime-svg:morphTo'
}

/**
 * Resolves the stable handle id used by active animation bookkeeping.
 */
function getAnimationOperationId(operation: AnimationOperation): string {
  return isTransitionRequest(operation) ? operation.transitionId : operation.operationId
}

/**
 * Applies one SVG attribute value to a morph target.
 */
function applySvgMorphValue(target: unknown, property: 'd' | 'points', value: string): void {
  if (typeof target === 'object' && target !== null && 'setAttribute' in target) {
    const setAttribute = (target as { setAttribute?: unknown }).setAttribute
    if (typeof setAttribute === 'function') {
      setAttribute.call(target, property, value)
      return
    }
  }

  if (typeof target === 'object' && target !== null) {
    ;(target as Record<string, unknown>)[property] = value
  }
}

/**
 * Applies final SVG morph attributes after seek completion.
 */
function finalizeAnimeSvgMorphOperation(operation: AnimeSvgMorphOperation, reason: 'completed' | 'stopped'): void {
  if (reason !== 'completed' || operation.finalValue === undefined) {
    return
  }

  applySvgMorphValue(operation.target, operation.property, operation.finalValue)
}

/**
 * Converts historical CodPlay easing names to Anime.js v4 names.
 */
function normalizeAnimeEase(ease: string | undefined): string | undefined {
  if (ease === undefined || !ease.startsWith('ease')) {
    return ease
  }

  if (ease === 'easeInOut') {
    return 'inOut'
  }
  if (ease.startsWith('easeInOut')) {
    return `inOut${ease.slice('easeInOut'.length)}`
  }
  if (ease === 'easeOut') {
    return 'out'
  }
  if (ease.startsWith('easeOut')) {
    return `out${ease.slice('easeOut'.length)}`
  }
  if (ease === 'easeIn') {
    return 'in'
  }
  if (ease.startsWith('easeIn')) {
    return `in${ease.slice('easeIn'.length)}`
  }

  return ease
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
 * Applies one transition target value directly when an animation is completed
 * through seek finalization rather than a natural animation frame.
 */
function applyTransitionEndValue(transition: TransitionRequest): void {
  const target = transition.target

  if (typeof globalThis.Element !== 'undefined' && target instanceof globalThis.Element) {
    const resolvedValue = resolveContainerQueryValue(target, transition.finalValue ?? transition.to)
    utils.set(target, { [transition.property]: resolvedValue } as Parameters<typeof utils.set>[1])
    return
  }

  if (typeof target !== 'object' || target === null) {
    return
  }

  const targetObject = target as Record<string, unknown>
  const styleRecord =
    typeof targetObject.style === 'object' && targetObject.style !== null
      ? (targetObject.style as Record<string, unknown>)
      : null

  if (styleRecord !== null) {
    styleRecord[transition.property] = transition.finalValue ?? transition.to
    return
  }

  targetObject[transition.property] = transition.finalValue ?? transition.to
}

/**
 * Applies transition finalization hooks with a deterministic reason.
 */
function finalizeTransition(transition: TransitionRequest, reason: 'completed' | 'stopped'): void {
  if (reason === 'completed') {
    applyTransitionEndValue(transition)
  }

  cleanupTransitionStyle(transition)
  transition.onFinalize?.(reason)
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
function toTransitionValue(transition: TransitionRequest): Record<string, number | string | ((value: number) => number | string)> {
  const resolvedTo = resolveTransitionValue(transition.target, transition.to) as number | string

  if (transition.from === undefined) {
    const payload: Record<string, number | string | ((value: number) => number | string)> = {
      to: resolvedTo
    }
    if (transition.modifier !== undefined) {
      payload.modifier = transition.modifier
    }
    return payload
  }

  const payload: Record<string, number | string | ((value: number) => number | string)> = {
    from: resolveTransitionValue(transition.target, transition.from) as number | string,
    to: resolvedTo
  }
  if (transition.modifier !== undefined) {
    payload.modifier = transition.modifier
  }
  return payload
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
    const animeEase = normalizeAnimeEase(transition.ease ?? transition.easing)
    const timingKey = `${transition.eventId}|${transition.duration}|${animeEase ?? ''}|${transition.delayMs ?? 0}|${transition.loopDelayMs ?? 0}|${String(transition.reversed ?? false)}|${String(transition.alternate ?? false)}|${String(transition.loop ?? false)}|${transition.stagger ?? 0}|${transition.composition ?? ''}`
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
          ease: animeEase,
          delay: transition.delayMs,
          stagger: transition.stagger,
          loopDelay: transition.loopDelayMs,
          reversed: transition.reversed,
          alternate: transition.alternate,
          loop: transition.loop,
          composition: transition.composition
        },
        transitions: [],
        properties: new Set<string>(),
        onFrameCallbacks: new Set<() => void>()
      }

      groupsByKey.set(groupKey, group)
      groupedTransitions.push(group)
    }

    group.parameters[propertyKey] = toTransitionValue(transition)
    group.properties.add(propertyKey)
    if (transition.onFrame !== undefined) {
      group.onFrameCallbacks.add(transition.onFrame)
    }
    group.transitions.push(transition)
  }

  return groupedTransitions
}

/**
 * Creates an animation adapter that bridges transition requests to Anime.js.
 */
type GroupEntry = {
  remaining: number
  hasStop: boolean
  onGroupFinalize: (reason: 'completed' | 'stopped') => void
}

export function createAnimationAdapter(
  animeImplementation: AnimeImplementation,
  options: AnimationAdapterOptions = {}
): AnimationAdapter {
  const activeHandles: AnimationHandle[] = []
  const activeAnimations: ActiveAnimation[] = []
  const groupEntries = new Map<string, GroupEntry>()

  /**
   * Removes active handles associated with one transition set.
   */
  function removeHandlesForOperations(operations: AnimationOperation[]): void {
    const operationIds = new Set(operations.map(getAnimationOperationId))
    for (let index = activeHandles.length - 1; index >= 0; index -= 1) {
      const handle = activeHandles[index]
      if (operationIds.has(handle.transitionId)) {
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
   * Resolves one group entry counter and fires onGroupFinalize when all members are done.
   */
  function finalizeGroup(groupId: string, reason: 'completed' | 'stopped'): void {
    const entry = groupEntries.get(groupId)
    if (entry === undefined) {
      return
    }

    if (reason === 'stopped') {
      entry.hasStop = true
    }

    entry.remaining -= 1
    if (entry.remaining <= 0) {
      groupEntries.delete(groupId)
      entry.onGroupFinalize(entry.hasStop ? 'stopped' : 'completed')
    }
  }

  /**
   * Finalizes one tracked animation exactly once.
   */
  function finalizeActiveAnimation(entry: ActiveAnimation, reason: 'completed' | 'stopped'): void {
    if (entry.finalized) {
      return
    }

    entry.finalized = true
    for (const operation of entry.operations) {
      if (isAnimeSvgMorphOperation(operation)) {
        finalizeAnimeSvgMorphOperation(operation, reason)
        continue
      }

      finalizeTransition(operation, reason)
      if (operation.group !== undefined) {
        finalizeGroup(operation.group.id, reason)
      }
    }

    removeHandlesForOperations(entry.operations)
    removeActiveAnimation(entry)
  }

  /**
   * Stops one tracked animation and clears its handles.
   */
  function stopActiveAnimation(entry: ActiveAnimation): void {
    entry.animation.revert?.()
    entry.animation.pause?.()
    finalizeActiveAnimation(entry, 'stopped')
  }

  /**
   * Marks one tracked animation as completed and applies cleanup markers.
   */
  function completeActiveAnimation(entry: ActiveAnimation): void {
    finalizeActiveAnimation(entry, 'completed')
  }

  /**
   * Registers group entries for transitions that declare a group.
   */
  function registerGroups(transitions: TransitionRequest[]): void {
    for (const transition of transitions) {
      const group = transition.group
      if (group === undefined) {
        continue
      }

      if (!groupEntries.has(group.id)) {
        groupEntries.set(group.id, {
          remaining: group.total,
          hasStop: false,
          onGroupFinalize: group.onGroupFinalize
        })
      }
    }
  }

  /**
   * Starts a batch of animation operations and stores stoppable handles.
   */
  function run(operations: AnimationOperation[]): AnimationHandle[] {
    // eslint-disable-next-line no-console
    console.log('[DEBUG anim-adapter] run() called', { operationCount: operations.length, operations: JSON.parse(JSON.stringify(operations)) })
    const transitions = operations.filter(isTransitionRequest)
    const morphOperations = operations.filter(isAnimeSvgMorphOperation)
    registerGroups(transitions)
    const startedHandles: AnimationHandle[] = []
    const transitionGroups = groupTransitions(transitions)

    for (const transitionGroup of transitionGroups) {
      const transitionCleanupRunner = () => {
        const activeAnimation = activeAnimations.find((entry) => entry.operations === transitionGroup.transitions)
        if (activeAnimation !== undefined) {
          completeActiveAnimation(activeAnimation)
        }
      }

      transitionGroup.parameters.onComplete = transitionCleanupRunner
      transitionGroup.parameters.complete = transitionCleanupRunner
      if (transitionGroup.onFrameCallbacks.size > 0) {
        transitionGroup.parameters.onUpdate = () => {
          for (const callback of transitionGroup.onFrameCallbacks) {
            callback()
          }
        }
      }

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
        operations: transitionGroup.transitions,
        eventId: firstTransition.eventId,
        duration: firstTransition.duration,
        delayMs: firstTransition.delayMs ?? 0,
        loopDelayMs: firstTransition.loopDelayMs ?? 0,
        reversed: firstTransition.reversed === true,
        alternate: firstTransition.alternate === true,
        loop: firstTransition.loop ?? false,
        finalized: false
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

    for (const operation of morphOperations) {
      const morphCleanupRunner = () => {
        const activeAnimation = activeAnimations.find((entry) => entry.operations[0] === operation)
        if (activeAnimation !== undefined) {
          completeActiveAnimation(activeAnimation)
        }
      }
      const parameters: Record<string, unknown> = {
        targets: operation.target,
        duration: operation.duration,
        ease: normalizeAnimeEase(operation.ease ?? operation.easing),
        delay: operation.delayMs,
        loopDelay: operation.loopDelayMs,
        reversed: operation.reversed,
        alternate: operation.alternate,
        loop: operation.loop,
        [operation.property]: animeSvgMorphTo(operation.to as Parameters<typeof animeSvgMorphTo>[0], operation.precision),
        onComplete: morphCleanupRunner,
        complete: morphCleanupRunner
      }
      const animation = animeImplementation(parameters)
      if (animation === null || animation === undefined) {
        continue
      }

      const activeAnimation: ActiveAnimation = {
        animation,
        target: operation.target,
        operations: [operation],
        eventId: operation.eventId,
        duration: operation.duration,
        delayMs: operation.delayMs ?? 0,
        loopDelayMs: operation.loopDelayMs ?? 0,
        reversed: operation.reversed === true,
        alternate: operation.alternate === true,
        loop: operation.loop ?? false,
        finalized: false
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
      const handle: AnimationHandle = {
        transitionId: operation.operationId,
        target: operation.target,
        stop: stopAnimation
      }

      activeHandles.push(handle)
      startedHandles.push(handle)
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
      let seekElapsedMs = Math.min(Math.max(0, elapsedMs), activeAnimation.duration)

      if ((activeAnimation.alternate || activeAnimation.loop) && activeAnimation.duration > 0) {
        const cycleDurationMs = activeAnimation.alternate
          ? activeAnimation.duration * 2 + activeAnimation.loopDelayMs
          : activeAnimation.duration + activeAnimation.loopDelayMs
        const cycledElapsedMs = Math.max(0, elapsedMs) % cycleDurationMs
        seekElapsedMs = activeAnimation.alternate && cycledElapsedMs > activeAnimation.duration
          ? (activeAnimation.duration * 2) - Math.min(cycledElapsedMs, activeAnimation.duration * 2)
          : Math.min(cycledElapsedMs, activeAnimation.duration)
      }

      if (activeAnimation.reversed) {
        seekElapsedMs = Math.max(0, activeAnimation.duration - seekElapsedMs)
      }

      activeAnimation.animation.seek?.(seekElapsedMs)
      activeAnimation.animation.pause?.()

      if (!activeAnimation.alternate && !activeAnimation.loop && elapsedMs >= activeAnimation.duration) {
        completeActiveAnimation(activeAnimation)
      }
    }
  }

  const renderFrame = options.renderFrame
  const setRate = options.setRate

  return { run, stop, pause, resume, seek, renderFrame, setRate }
}
