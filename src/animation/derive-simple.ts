import type { AnimationResolvedAction, SimpleAnimatedProperty, TransitionRequest } from './types'

/**
 * TEMPORARY LIMITATION (Phase 1 / Lot 03):
 * Only a minimal subset of properties is supported while the pipeline is stabilized.
 *
 * This limit must be lifted in the upcoming phases documented in `src/animation/README.md`:
 * - Phase 2 (planned Lot 05): configurable property registry.
 * - Phase 3 (planned Lot 06+): broader style transition support.
 */
const SIMPLE_PROPERTIES: readonly SimpleAnimatedProperty[] = ['opacity', 'x', 'y', 'scale', 'rotate']
const DEFAULT_DURATION_MS = 300

type StylePropertyDefinition = {
  from?: number | string
  to?: number | string
  duration?: number
  easing?: string
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
  style: Record<string, unknown>,
  property: SimpleAnimatedProperty
): StylePropertyDefinition | null {
  const rawValue = style[property]

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
 * Derives transition requests from resolved event actions using the temporary
 * minimal property subset defined by `SIMPLE_PROPERTIES`.
 */
export function deriveSimpleTransitions(resolvedActions: AnimationResolvedAction[]): TransitionRequest[] {
  const transitions: TransitionRequest[] = []

  for (const resolvedAction of resolvedActions) {
    const style = resolvedAction.action.style
    if (style === undefined || typeof style !== 'object' || style === null) {
      continue
    }

    const target = resolveTarget(resolvedAction.action, resolvedAction.listenerId)

    for (const property of SIMPLE_PROPERTIES) {
      const definition = getStylePropertyDefinition(style, property)
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
        duration: definition.duration ?? DEFAULT_DURATION_MS,
        easing: definition.easing
      })
    }
  }

  return transitions
}
