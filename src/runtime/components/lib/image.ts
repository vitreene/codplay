import {
  appendDomChild,
  applyImageAlt,
  applyImageSource,
  applyObjectFit,
  isDomElement,
  resetRuntimeNodeState
} from '../dom-component-adapter'

export type ImageFitMode = 'wallpaper' | 'sprite'

/**
 * Resolves one image fit mode into the corresponding object-fit value.
 */
export function resolveImageObjectFit(fitMode: ImageFitMode): 'cover' | 'contain' {
  return fitMode === 'sprite' ? 'contain' : 'cover'
}

/**
 * Creates or reuses one image part attached to one root node.
 */
export function ensureImagePart(rootNode: unknown, currentNode: unknown | null): unknown {
  if (isDomElement(rootNode)) {
    const existingNode = currentNode ?? rootNode.querySelector('img') ?? globalThis.document.createElement('img')
    appendDomChild(rootNode, existingNode)
    return existingNode
  }

  return currentNode ?? {
    tagName: 'IMG',
    style: {},
    attributes: {}
  }
}

/**
 * Resets one image part before reapplying authored media props.
 */
export function resetImagePart(nodeRef: unknown): void {
  resetRuntimeNodeState(nodeRef)
}

/**
 * Applies one image source url on one image part.
 */
export function setImageSource(nodeRef: unknown, src: string): void {
  applyImageSource(nodeRef, src)
}

/**
 * Applies one image alternative text on one image part.
 */
export function setImageAlt(nodeRef: unknown, alt: string): void {
  applyImageAlt(nodeRef, alt)
}

/**
 * Applies one image fit mode on one image part.
 */
export function setImageFitMode(nodeRef: unknown, fitMode: ImageFitMode): void {
  applyObjectFit(nodeRef, resolveImageObjectFit(fitMode))
}
