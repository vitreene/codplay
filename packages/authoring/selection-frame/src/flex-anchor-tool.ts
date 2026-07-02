import { worldDeltaToLocalDelta } from 'codplay/runtime/modules/list-flip/engine/dom-matrix'
import type { AuthorApi } from './author-api'
import type { FlexAdapter, FlexAlignmentPoint } from './adapters/flex-adapter'
import {
  calibrateGhostToWorldSnapshot,
  captureOverlayPose,
  ensureOverlayLayer,
  localFractionToViewportPoint
} from './overlay-pose'

const POINT_SIZE_PX = 14
const POINT_INSET_PX = 6

export type FlexAnchorToolOptions = {
  /** persoId of the edited element (stretch points live on it). */
  itemId: string
  /** persoId of the parent container (the 9 alignment points live on it). */
  containerId: string
  authorApi: AuthorApi
  sceneRoot: Element
  /** Applies the clicked alignment; owned by the editor. */
  adapter: FlexAdapter
}

export type FlexAnchorToolHandle = {
  destroy: () => void
  setVisible: (visible: boolean) => void
  sync: () => void
}

/** The 9 container points, in container-local fractions. */
const CONTAINER_POINTS: Array<{ point: FlexAlignmentPoint; fx: number; fy: number }> = [
  { point: 'TL', fx: 0, fy: 0 },
  { point: 'TC', fx: 0.5, fy: 0 },
  { point: 'TR', fx: 1, fy: 0 },
  { point: 'ML', fx: 0, fy: 0.5 },
  { point: 'C', fx: 0.5, fy: 0.5 },
  { point: 'MR', fx: 1, fy: 0.5 },
  { point: 'BL', fx: 0, fy: 1 },
  { point: 'BC', fx: 0.5, fy: 1 },
  { point: 'BR', fx: 1, fy: 1 }
]

/**
 * Attache-flex: distinct tool from the cs (v1 plan, «outil distinct»). Renders
 * the 11-point placement interface — 8 points inside the container sides plus
 * one center, and 2 stretch points (↔ / ↕) on the element itself. Clicking a
 * point applies the matching align-self/justify-self through the FlexAdapter.
 * Uses the same player attach infrastructure as the cs (subscribeToNode).
 */
export function createFlexAnchorTool(options: FlexAnchorToolOptions): FlexAnchorToolHandle {
  const doc = options.sceneRoot.ownerDocument
  const overlayLayer = ensureOverlayLayer(options.sceneRoot)

  let containerNode: HTMLElement | null = null
  let elementNode: HTMLElement | null = null
  let visible = true
  let destroyed = false

  const toolRoot = doc.createElement('div')
  toolRoot.setAttribute('data-flex-anchor-tool', options.itemId)
  toolRoot.style.position = 'fixed'
  toolRoot.style.transformOrigin = '0px 0px'
  toolRoot.style.display = 'none'
  toolRoot.style.pointerEvents = 'none'
  overlayLayer.appendChild(toolRoot)

  const makePoint = (label: string, point: FlexAlignmentPoint): HTMLElement => {
    const node = doc.createElement('div')
    node.setAttribute('data-flex-anchor-point', point)
    node.style.position = 'absolute'
    node.style.width = `${POINT_SIZE_PX}px`
    node.style.height = `${POINT_SIZE_PX}px`
    node.style.marginLeft = `${-POINT_SIZE_PX / 2}px`
    node.style.marginTop = `${-POINT_SIZE_PX / 2}px`
    node.style.borderRadius = '50%'
    node.style.background = '#ffffff'
    node.style.border = '1px solid #4a90d9'
    node.style.boxSizing = 'border-box'
    node.style.display = 'flex'
    node.style.alignItems = 'center'
    node.style.justifyContent = 'center'
    node.style.fontSize = '9px'
    node.style.lineHeight = '1'
    node.style.color = '#4a90d9'
    node.style.cursor = 'pointer'
    node.style.pointerEvents = 'auto'
    node.style.userSelect = 'none'
    node.textContent = label
    node.addEventListener('click', () => {
      options.adapter.applyAlignment(point)
      sync()
    })
    return node
  }

  for (const { point, fx, fy } of CONTAINER_POINTS) {
    const node = makePoint('', point)
    // Inside the container: inset the border points inward.
    const insetX = fx === 0 ? POINT_INSET_PX : fx === 1 ? -POINT_INSET_PX : 0
    const insetY = fy === 0 ? POINT_INSET_PX : fy === 1 ? -POINT_INSET_PX : 0
    node.style.left = `calc(${fx * 100}% + ${insetX}px)`
    node.style.top = `calc(${fy * 100}% + ${insetY}px)`
    toolRoot.appendChild(node)
  }

  // The 2 stretch points sit on the element itself, shown as opposed double arrows.
  const stretchH = makePoint('↔', 'stretch-h')
  const stretchV = makePoint('↕', 'stretch-v')
  toolRoot.appendChild(stretchH)
  toolRoot.appendChild(stretchV)

  const positionStretchPoints = (): void => {
    if (elementNode === null || containerNode === null) {
      stretchH.style.display = 'none'
      stretchV.style.display = 'none'
      return
    }
    stretchH.style.display = 'flex'
    stretchV.style.display = 'flex'
    // Element center mapped into the tool's local space through the poses —
    // never through the axis-aligned bounding rects.
    const containerPose = captureOverlayPose(containerNode)
    const elementPose = captureOverlayPose(elementNode)
    const centerViewport = localFractionToViewportPoint(elementPose, 0.5, 0.5)
    const containerOrigin = localFractionToViewportPoint(containerPose, 0, 0)
    const local = worldDeltaToLocalDelta(
      containerPose.matrix,
      centerViewport.x - containerOrigin.x,
      centerViewport.y - containerOrigin.y
    )
    const centerX = local.x * containerPose.scaleX
    const centerY = local.y * containerPose.scaleY
    stretchH.style.left = `${centerX - POINT_SIZE_PX}px`
    stretchH.style.top = `${centerY}px`
    stretchV.style.left = `${centerX + POINT_SIZE_PX}px`
    stretchV.style.top = `${centerY}px`
  }

  function sync(): void {
    if (destroyed) return
    if (containerNode === null || !visible) {
      toolRoot.style.display = 'none'
      return
    }
    const pose = captureOverlayPose(containerNode)
    const m = pose.rotationMatrix
    toolRoot.style.display = ''
    toolRoot.style.width = `${pose.frameWidth}px`
    toolRoot.style.height = `${pose.frameHeight}px`
    toolRoot.style.transform = `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, 0, 0)`
    calibrateGhostToWorldSnapshot(toolRoot, pose.rect)
    positionStretchPoints()
  }

  const unsubscribeContainer = options.authorApi.subscribeToNode(options.containerId, (node) => {
    if (destroyed) return
    containerNode = node instanceof HTMLElement ? node : null
    sync()
  })

  const unsubscribeElement = options.authorApi.subscribeToNode(options.itemId, (node) => {
    if (destroyed) return
    elementNode = node instanceof HTMLElement ? node : null
    sync()
  })

  return {
    destroy(): void {
      if (destroyed) return
      destroyed = true
      unsubscribeContainer()
      unsubscribeElement()
      toolRoot.remove()
    },

    setVisible(next: boolean): void {
      visible = next
      sync()
    },

    sync
  }
}
