import type { RuntimeComponentClassInput } from '../types'
import { applyNodeId, createRuntimeNode, resetRuntimeNodeState } from '../dom-component-adapter'

/**
 * Creates one component root using the shared runtime node factory.
 */
export function createComponentRoot(
  item: RuntimeComponentClassInput['item'],
  tagName: string,
  createElementOptions: RuntimeComponentClassInput['createElementOptions']
): unknown {
  return createRuntimeNode(item, tagName, createElementOptions)
}

/**
 * Resets one component root before reapplying authored state.
 */
export function resetComponentRoot(nodeRef: unknown): void {
  resetRuntimeNodeState(nodeRef)
}

/**
 * Applies one stable runtime id on the component root.
 */
export function setComponentRootId(nodeRef: unknown, itemId: string, authoredId: unknown): void {
  applyNodeId(nodeRef, typeof authoredId === 'string' ? authoredId : itemId)
}
