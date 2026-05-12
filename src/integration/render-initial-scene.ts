import { createElement } from '../runtime/create-element'
import type { StoryDoc } from '../runtime/types'
import { PlayerRuntimePlanner } from '../player/create-player-utils'
import type { SceneDoc } from '../player/types'

export type RenderInitialSceneResult = {
  renderedCount: number
  unresolvedParentCount: number
  nodeByItemId: Map<string, HTMLElement>
}

/**
 * Checks whether one runtime node reference is a mountable HTML element.
 */
function isHtmlElement(nodeRef: unknown): nodeRef is HTMLElement {
  if (typeof globalThis.HTMLElement === 'undefined') {
    return false
  }

  return nodeRef instanceof globalThis.HTMLElement
}

/**
 * Resolves active story used for initial scene rendering.
 */
function resolveActiveStory(scene: SceneDoc): StoryDoc | null {
  const planner = new PlayerRuntimePlanner()
  const rootStoryId = planner.resolveRootStoryId(scene)
  if (rootStoryId === null) {
    return null
  }

  const story = scene.stories[rootStoryId]
  if (!story) {
    return null
  }

  return planner.createRuntimeStory(story)
}

/**
 * Renders the initial story hierarchy into one target mount element.
 */
export function renderInitialScene(scene: SceneDoc, mountTarget: HTMLElement): RenderInitialSceneResult {
  const story = resolveActiveStory(scene)
  mountTarget.innerHTML = ''

  if (story === null) {
    return {
      renderedCount: 0,
      unresolvedParentCount: 0,
      nodeByItemId: new Map()
    }
  }

  const stage = globalThis.document.createElement('section')
  stage.className = 'legacy-scene-stage aspect-video flex-1'
  stage.id = 'container-scene'
  mountTarget.append(stage)

  const nodeByItemId = new Map<string, HTMLElement>()
  for (const item of Object.values(story.items)) {
    const runtimeElement = createElement(item)
    if (!isHtmlElement(runtimeElement.nodeRef)) {
      continue
    }

    nodeByItemId.set(item.id, runtimeElement.nodeRef)
  }

  const pendingItemIds = new Set(Object.keys(story.items))
  let progress = true
  while (pendingItemIds.size > 0 && progress) {
    progress = false

    for (const itemId of [...pendingItemIds]) {
      const item = story.items[itemId]
      if (!item) {
        pendingItemIds.delete(itemId)
        continue
      }

      const node = nodeByItemId.get(itemId)
      if (!node) {
        pendingItemIds.delete(itemId)
        continue
      }

      const parentValue = (item.initial as Record<string, unknown>).move
      const parentId = typeof parentValue === 'string' ? parentValue : undefined
      if (!parentId || parentId === 'container-scene') {
        stage.append(node)
        pendingItemIds.delete(itemId)
        progress = true
        continue
      }

      const parentNode = nodeByItemId.get(parentId)
      if (!parentNode) {
        continue
      }

      parentNode.append(node)
      pendingItemIds.delete(itemId)
      progress = true
    }
  }

  for (const unresolvedItemId of pendingItemIds) {
    const unresolvedNode = nodeByItemId.get(unresolvedItemId)
    if (unresolvedNode) {
      stage.append(unresolvedNode)
    }
  }

  return {
    renderedCount: nodeByItemId.size,
    unresolvedParentCount: pendingItemIds.size,
    nodeByItemId
  }
}
