import { deriveSimpleTransitions } from '../animation/derive-simple'
import { runAnimationBatch } from '../animation/run-batch'
import type { AnimationAdapter, AnimationBatchResult, AnimationResolvedAction } from '../animation/types'
import { resolveHtmlRenderMutations } from './html-render-mutation-resolver'
import type { RenderMutationTraceEntry } from './render-mutation-resolver'
import type { RuntimeElementMap } from './types'

export type ApplyActionsResult = {
  appliedActionsCount: number
  animation: AnimationBatchResult
  conflictTrace: RenderMutationTraceEntry[]
}

type MutableNode = Record<string, unknown>

/**
 * Checks whether one runtime node reference is a browser Element.
 */
function isDomElement(nodeRef: unknown): nodeRef is Element {
  if (typeof globalThis.Element === 'undefined') {
    return false
  }

  return nodeRef instanceof globalThis.Element
}

/**
 * Checks whether one runtime node reference is a browser Node.
 */
function isDomNode(nodeRef: unknown): nodeRef is Node {
  if (typeof globalThis.Node === 'undefined') {
    return false
  }

  return nodeRef instanceof globalThis.Node
}

/**
 * Applies style entries directly on one DOM element style declaration.
 */
function applyDomStylePatch(node: Element, patch: Record<string, unknown>): void {
  const style = (node as unknown as { style?: Record<string, unknown> }).style
  if (style === undefined || style === null) {
    return
  }

  const styleWithSetProperty = style as Record<string, unknown> & {
    setProperty?: (propertyName: string, value: string) => void
    removeProperty?: (propertyName: string) => void
  }

  for (const [key, rawValue] of Object.entries(patch)) {
    const finalValue = resolveFinalStyleValue(rawValue)
    if (finalValue === undefined || finalValue === null) {
      if (key.includes('-')) {
        styleWithSetProperty.removeProperty?.(key)
      } else {
        style[key] = ''
      }
      continue
    }

    const value = String(finalValue)
    if (key.includes('-') && styleWithSetProperty.setProperty) {
      styleWithSetProperty.setProperty(key, value)
      continue
    }

    style[key] = value
  }
}

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
  if (isDomElement(node)) {
    applyDomStylePatch(node, patch)
    return
  }

  if (typeof node.style === 'object' && node.style !== null) {
    const style = node.style as Record<string, unknown>
    for (const [key, rawValue] of Object.entries(patch)) {
      style[key] = resolveFinalStyleValue(rawValue)
    }

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

  if (isDomElement(node)) {
    for (const [key, rawValue] of Object.entries(patch)) {
      if (rawValue === undefined || rawValue === null || rawValue === false) {
        node.removeAttribute(key)
        continue
      }

      node.setAttribute(key, String(rawValue))
    }

    return
  }

  const attributes = (node.attributes as Record<string, unknown> | undefined) ?? {}
  Object.assign(attributes, patch)
  node.attributes = attributes
}

/**
 * Resolves the move target id from one action move patch.
 */
function resolveMoveTargetId(movePatch: unknown): string | undefined {
  if (typeof movePatch === 'string') {
    return movePatch
  }

  if (typeof movePatch !== 'object' || movePatch === null) {
    return undefined
  }

  const targetId = (movePatch as { targetId?: unknown }).targetId
  if (typeof targetId === 'string') {
    return targetId
  }

  return undefined
}

/**
 * Applies one move patch by re-parenting the target node when possible.
 */
function applyMovePatch(
  runtimeElements: RuntimeElementMap,
  targetItemId: string,
  movePatch: unknown
): void {
  const moveTargetId = resolveMoveTargetId(movePatch)
  if (!moveTargetId) {
    return
  }

  const runtimeElement = runtimeElements.get(targetItemId)
  const targetNode = runtimeElement?.nodeRef
  if (!targetNode) {
    return
  }

  const runtimeParent = runtimeElements.get(moveTargetId)?.nodeRef
  const domParent =
    runtimeParent ??
    (typeof globalThis.document !== 'undefined' ? globalThis.document.getElementById(moveTargetId) : null)

  if (isDomNode(targetNode) && isDomNode(domParent)) {
    domParent.appendChild(targetNode)
    return
  }

  if (typeof targetNode === 'object' && targetNode !== null) {
    ;(targetNode as Record<string, unknown>).parentId = moveTargetId
  }
}

/**
 * Applies resolved actions through the legacy runtime patch path kept for focused tests.
 *
 * Renderer playback now routes mutations through component-specific resolvers before
 * commits reach the runtime. This helper stays intentionally narrow for older unit
 * tests that still exercise direct node patching.
 */
export function applyResolvedActions(
  resolvedActions: AnimationResolvedAction[],
  runtimeElements: RuntimeElementMap,
  animationAdapter: AnimationAdapter
): ApplyActionsResult {
  const conflictResolution = resolveHtmlRenderMutations(resolvedActions)
  const animatableActions: AnimationResolvedAction[] = []
  let appliedActionsCount = 0

  for (const resolvedAction of conflictResolution.resolvedMutations) {
    const targetItemId = resolveTargetItemId(resolvedAction)
    const runtimeElement = runtimeElements.get(targetItemId)
    if (!runtimeElement || typeof runtimeElement.nodeRef !== 'object' || runtimeElement.nodeRef === null) {
      continue
    }

    const node = runtimeElement.nodeRef as MutableNode

    // Move is applied first so this branch can rely on the pre-patch node state.
    applyMovePatch(runtimeElements, targetItemId, resolvedAction.action.move)
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
    animation,
    conflictTrace: conflictResolution.trace
  }
}
