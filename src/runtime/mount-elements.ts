import { createElement, type CreateElementOptions } from './create-element'
import type { RuntimeElementMap, RuntimePersos } from './types'

/**
 * Mounts all runtime persos into runtime elements in declaration order.
 */
export function mountSceneElements(runtimePersos: RuntimePersos, options: CreateElementOptions = {}): RuntimeElementMap {
  const runtimeElements: RuntimeElementMap = new Map()

  for (const item of Object.values(runtimePersos.persos)) {
    const runtimeElement = createElement(item, options)
    runtimeElements.set(runtimeElement.runtimeItemId, runtimeElement)
  }

  return runtimeElements
}
