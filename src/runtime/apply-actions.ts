import { deriveSimpleTransitions } from '../animation/derive-simple'
import { runAnimationBatch } from '../animation/run-batch'
import type { AnimationAdapter, AnimationBatchResult, AnimationResolvedAction } from '../animation/types'
import type { RuntimeElementMap } from './types'

export type ApplyActionsResult = {
  appliedActionsCount: number
  animation: AnimationBatchResult
}

type MutableNode = Record<string, unknown>

/**
 * Resolves the runtime target identifier for one resolved action.
 */
function resolveTargetItemId(action: AnimationResolvedAction): string {
  return action.action.targetId ?? action.listenerId
}

/**
 * Normalizes class names into a mutable string set.
 */
function toClassSet(className: unknown): Set<string> {
  if (typeof className !== 'string') {
    return new Set<string>()
  }

  return new Set(className.split(/\s+/).filter((token) => token.length > 0))
}

/**
 * Applies className updates onto a mutable runtime node.
 */
function applyClassNamePatch(node: MutableNode, classNamePatch: unknown): void {
  if (classNamePatch === undefined) {
    return
  }

  if (typeof classNamePatch === 'string') {
    node.className = classNamePatch
    return
  }

  if (typeof classNamePatch !== 'object' || classNamePatch === null) {
    return
  }

  const patch = classNamePatch as { add?: string; remove?: string }
  const classSet = toClassSet(node.className)

  if (patch.add) {
    for (const token of patch.add.split(/\s+/)) {
      if (token.length > 0) {
        classSet.add(token)
      }
    }
  }

  if (patch.remove) {
    for (const token of patch.remove.split(/\s+/)) {
      if (token.length > 0) {
        classSet.delete(token)
      }
    }
  }

  node.className = [...classSet].join(' ')
}

/**
 * Resolves the final style value from one style definition.
 */
function resolveFinalStyleValue(rawValue: unknown): unknown {
  if (typeof rawValue === 'object' && rawValue !== null) {
    const withTo = rawValue as { to?: unknown }
    if (withTo.to !== undefined) {
      return withTo.to
    }
  }

  return rawValue
}

/**
 * Applies style updates onto a mutable runtime node.
 */
function applyStylePatch(node: MutableNode, stylePatch: unknown): void {
  if (typeof stylePatch !== 'object' || stylePatch === null) {
    return
  }

  const patch = stylePatch as Record<string, unknown>
  if (typeof node.style === 'object' && node.style !== null) {
    const style = node.style as Record<string, unknown>
    for (const [key, rawValue] of Object.entries(patch)) {
      style[key] = resolveFinalStyleValue(rawValue)
    }

    node.style = style
    return
  }

  for (const [key, rawValue] of Object.entries(patch)) {
    node[key] = resolveFinalStyleValue(rawValue)
  }
}

/**
 * Applies attribute updates onto a mutable runtime node.
 */
function applyAttrPatch(node: MutableNode, attrPatch: unknown): void {
  if (typeof attrPatch !== 'object' || attrPatch === null) {
    return
  }

  const patch = attrPatch as Record<string, unknown>
  const attributes = (node.attributes as Record<string, unknown> | undefined) ?? {}
  Object.assign(attributes, patch)
  node.attributes = attributes
}

/**
 * Applies resolved actions to runtime nodes and triggers simple animation transitions.
 */
export function applyResolvedActions(
  resolvedActions: AnimationResolvedAction[],
  runtimeElements: RuntimeElementMap,
  animationAdapter: AnimationAdapter
): ApplyActionsResult {
  const animatableActions: AnimationResolvedAction[] = []
  let appliedActionsCount = 0

  for (const resolvedAction of resolvedActions) {
    const targetItemId = resolveTargetItemId(resolvedAction)
    const runtimeElement = runtimeElements.get(targetItemId)
    if (!runtimeElement || typeof runtimeElement.nodeRef !== 'object' || runtimeElement.nodeRef === null) {
      continue
    }

    const node = runtimeElement.nodeRef as MutableNode

    applyClassNamePatch(node, resolvedAction.action.className)
    applyStylePatch(node, resolvedAction.action.style)
    applyAttrPatch(node, resolvedAction.action.attr)

    animatableActions.push({
      ...resolvedAction,
      action: {
        ...resolvedAction.action,
        target: runtimeElement.nodeRef
      }
    })

    appliedActionsCount += 1
  }

  const transitions = deriveSimpleTransitions(animatableActions)
  const animation = runAnimationBatch(transitions, animationAdapter)

  return {
    appliedActionsCount,
    animation
  }
}
