import { ANIMATION_RUNTIME_CONFIG } from './config'
import type { AnimationResolvedAction, TransitionRequest } from './types'

type StylePropertyDefinition = {
  from?: number | string
  to?: number | string
  duration?: number
  delay?: number
  easing?: string
  ease?: string
  stagger?: number
  loopDelay?: number
  reversed?: boolean
  alternate?: boolean
  loop?: boolean | number
  ignoreDuration?: boolean
}

/**
 * Resolves the transition target from an animation action.
 */
function resolveTarget(action: AnimationResolvedAction['action'], listenerId: string): unknown {
  return action.target ?? action.targetId ?? listenerId
}

/**
 * Extracts one style property definition from an arbitrary style object.
 */
function getStylePropertyDefinition(
  rawValue: unknown
): StylePropertyDefinition | null {
  if (rawValue === null || rawValue === undefined) {
    return null
  }

  if (typeof rawValue === 'number' || typeof rawValue === 'string') {
    return { to: rawValue }
  }

  if (typeof rawValue !== 'object') {
    return null
  }

  const definition = rawValue as StylePropertyDefinition
  if (definition.to === undefined) {
    return null
  }

  return definition
}

/**
 * Derives transition requests from resolved event actions by forwarding all
 * valid style properties without a hardcoded property allowlist.
 */
export function deriveSimpleTransitions(resolvedActions: AnimationResolvedAction[]): TransitionRequest[] {
  const transitions: TransitionRequest[] = []

  for (const resolvedAction of resolvedActions) {
    const style = resolvedAction.action.style
    if (style === undefined || typeof style !== 'object' || style === null) {
      continue
    }

    const target = resolveTarget(resolvedAction.action, resolvedAction.listenerId)

    for (const [property, rawValue] of Object.entries(style)) {
      const definition = getStylePropertyDefinition(rawValue)
      if (definition === null || definition.to === undefined) {
        continue
      }

      transitions.push({
        transitionId: `tr-${resolvedAction.eventId}-${property}`,
        eventId: resolvedAction.eventId,
        eventName: resolvedAction.eventName,
        listenerId: resolvedAction.listenerId,
        property,
        target,
        from: definition.from,
        to: definition.to,
        duration: definition.duration ?? ANIMATION_RUNTIME_CONFIG.defaultDurationMs,
        delayMs: definition.delay,
        easing: definition.easing ?? definition.ease,
        ease: definition.ease ?? definition.easing,
        stagger: definition.stagger,
        loopDelayMs: definition.loopDelay,
        reversed: definition.reversed,
        alternate: definition.alternate,
        loop: definition.loop,
        ignoreDuration: definition.ignoreDuration
      })
    }
  }

  return transitions
}
