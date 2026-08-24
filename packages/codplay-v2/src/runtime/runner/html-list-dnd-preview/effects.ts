import { isPlainRecord } from '../../../shared'
import type { CompiledRecord } from '../../../scene/compiled'
import type { RuntimeCaptureState } from '../../capture'
import { clearHtmlTransientNode, markHtmlTransientNode } from '../html-transient-node'
import { asElement } from './geometry'
import type { ActivePreview } from './types'

/** Creates one non-author ghost with dimensions copied from the dragged node. */
export function createGhost(
  className: string,
  preview: ActivePreview,
  captureState: RuntimeCaptureState,
): HTMLElement {
  if (typeof document === 'undefined') throw new Error('HTML DnD preview requires a document.')
  const configured = isPlainRecord(captureState.ghost)
    ? captureState.ghost as CompiledRecord
    : undefined
  const configuredClassName = typeof configured?.className === 'string' ? configured.className : className
  const ghost = document.createElement('div')
  ghost.className = configuredClassName
  ghost.setAttribute('data-codplay-dnd-ghost', '')
  markHtmlTransientNode(ghost)
  if (preview.width !== undefined) ghost.style.width = `${preview.width}px`
  if (preview.height !== undefined) ghost.style.height = `${preview.height}px`
  const ghostStyle = isPlainRecord(configured?.style) ? configured.style : undefined
  if (ghostStyle !== undefined) {
    for (const [property, value] of Object.entries(ghostStyle)) ghost.style.setProperty(property, String(value))
  }
  return ghost
}

/** Applies the temporary fixed pose used while the item leaves list flow. */
export function applyFloatingStyle(
  node: HTMLElement,
  preview: ActivePreview,
  clientX: number,
  clientY: number,
): void {
  node.style.position = 'fixed'
  node.style.left = `${clientX - (preview.offsetX ?? 0)}px`
  node.style.top = `${clientY - (preview.offsetY ?? 0)}px`
  if (preview.width !== undefined) node.style.width = `${preview.width}px`
  if (preview.height !== undefined) node.style.height = `${preview.height}px`
  node.style.margin = '0'
  node.style.zIndex = '1000'
  node.style.pointerEvents = 'none'
}

/** Removes only the inline properties owned by this preview controller. */
export function clearFloatingStyle(node: unknown): void {
  const element = asElement(node)
  if (element === undefined) return
  for (const property of ['position', 'left', 'top', 'width', 'height', 'margin', 'z-index', 'pointer-events']) {
    element.style.removeProperty(property)
  }
  clearHtmlTransientNode(element)
}
