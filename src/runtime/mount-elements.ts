import { createElement, type CreateElementOptions } from './create-element'
import type { RuntimeElementMap, StoryDoc } from './types'

/**
 * Mounts all story items into runtime elements in declaration order.
 */
export function mountSceneElements(story: StoryDoc, options: CreateElementOptions = {}): RuntimeElementMap {
  const runtimeElements: RuntimeElementMap = new Map()

  for (const item of Object.values(story.items)) {
    const runtimeElement = createElement(item, options)
    runtimeElements.set(runtimeElement.runtimeItemId, runtimeElement)
  }

  return runtimeElements
}
