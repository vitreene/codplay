import {
  captureHtmlPose,
  createHtmlPoseCaptureContext,
  type HtmlPoseCaptureContext,
} from '../motion/html-pose'

/** Rectangle captured before one transient HTML layout change. */
export type HtmlTransientRect = Readonly<{
  left: number
  top: number
  width: number
  height: number
}>

/** Captures settled rectangles for a collection of HTML nodes. */
export function captureHtmlTransientRects(
  nodes: readonly HTMLElement[],
  context: HtmlPoseCaptureContext = createHtmlPoseCaptureContext(),
): ReadonlyMap<HTMLElement, HtmlTransientRect> {
  return new Map(nodes.map((node) => [node, measureHtmlSettledRect(node, context)]))
}

/** Reads one settled rectangle from the shared HTML pose and removes a preview transform. */
export function measureHtmlSettledRect(
  node: HTMLElement,
  context: HtmlPoseCaptureContext = createHtmlPoseCaptureContext(),
): HtmlTransientRect {
  const rect = captureHtmlPose(node, context).rect
  const computed = node.ownerDocument.defaultView?.getComputedStyle(node)
  const matrix = parseCssMatrix(computed?.transform ?? node.style.transform)
  if (isIdentityMatrix(matrix)) return copyRect(rect)
  return {
    left: rect.left - matrix.e,
    top: rect.top - matrix.f,
    width: Math.abs(matrix.a) > 1e-8 ? rect.width / Math.abs(matrix.a) : rect.width,
    height: Math.abs(matrix.d) > 1e-8 ? rect.height / Math.abs(matrix.d) : rect.height,
  }
}

/** Plays one transient sibling FLIP transition and restores author inline styles. */
export function playHtmlTransientFlip(
  node: HTMLElement,
  fromRect: HtmlTransientRect,
  duration: number,
  cleanups: Map<HTMLElement, () => void>,
  context: HtmlPoseCaptureContext = createHtmlPoseCaptureContext(),
): void {
  const toRect = measureHtmlSettledRect(node, context)
  const previousCleanup = cleanups.get(node)
  previousCleanup?.()

  const deltaX = fromRect.left - toRect.left
  const deltaY = fromRect.top - toRect.top
  const scaleX = toRect.width === 0 ? 1 : fromRect.width / toRect.width
  const scaleY = toRect.height === 0 ? 1 : fromRect.height / toRect.height
  if (deltaX === 0 && deltaY === 0 && scaleX === 1 && scaleY === 1) return

  const previousTransition = node.style.transition
  const previousTransform = node.style.transform
  const previousTransformOrigin = node.style.transformOrigin
  let cleanup: (() => void) | undefined
  const onTransitionEnd = (event: Event): void => {
    if ((event as TransitionEvent).propertyName !== 'transform') return
    cleanup?.()
  }
  cleanup = (): void => {
    node.removeEventListener('transitionend', onTransitionEnd)
    node.style.transition = previousTransition
    node.style.transform = previousTransform
    node.style.transformOrigin = previousTransformOrigin
    if (cleanups.get(node) === cleanup) cleanups.delete(node)
  }
  cleanups.set(node, cleanup)

  node.style.transition = 'none'
  node.style.transformOrigin = 'top left'
  node.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`
  // Use the shared pose entry point for the one layout flush required by FLIP.
  void captureHtmlPose(node)
  node.style.transition = `transform ${duration}ms ease`
  node.style.transform = previousTransform
  node.addEventListener('transitionend', onTransitionEnd)
}

/** Parses the 2D transform forms emitted by browsers for preview-owned FLIP. */
function parseCssMatrix(value: string | undefined): { a: number; b: number; c: number; d: number; e: number; f: number } {
  if (value === undefined || value === '' || value === 'none') return identityMatrix()
  const match = value.match(/^matrix\(([^)]+)\)$/)
  if (match === null) return identityMatrix()
  const values = match[1].split(',').map((part) => Number(part.trim()))
  return values.length === 6 && values.every((part) => Number.isFinite(part))
    ? { a: values[0]!, b: values[1]!, c: values[2]!, d: values[3]!, e: values[4]!, f: values[5]! }
    : identityMatrix()
}

/** Creates one identity affine matrix for the transient geometry helpers. */
function identityMatrix(): { a: number; b: number; c: number; d: number; e: number; f: number } {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
}

/** Tests whether one affine matrix contributes no visual transform. */
function isIdentityMatrix(matrix: ReturnType<typeof identityMatrix>): boolean {
  return matrix.a === 1 && matrix.b === 0 && matrix.c === 0 && matrix.d === 1 && matrix.e === 0 && matrix.f === 0
}

/** Copies the measurable fields needed by a transient FLIP pair. */
function copyRect(rect: Readonly<Pick<HtmlTransientRect, 'left' | 'top' | 'width' | 'height'>>): HtmlTransientRect {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}
