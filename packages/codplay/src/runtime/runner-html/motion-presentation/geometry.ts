import { multiplyMatrix } from 'ace'
import { worldDeltaToLocalDelta } from '../../motion/html-pose'
import type { HtmlMatrix, HtmlPose } from '../../motion/html-types'
import type { GhostTransformProperty, OverlayResource } from './types'

/** Applies one root-localized affine pose to a fixed overlay ghost. */
export function applyGhostPose(
  resource: OverlayResource,
  root: HtmlPose,
  rootInverse: HtmlMatrix,
  pose: HtmlPose,
): void {
  const localized = localizePose(root, rootInverse, pose)
  if (resource.lastWidth !== pose.localWidth) {
    resource.ghost.style.width = `${pose.localWidth}px`
    resource.lastWidth = pose.localWidth
  }
  if (resource.lastHeight !== pose.localHeight) {
    resource.ghost.style.height = `${pose.localHeight}px`
    resource.lastHeight = pose.localHeight
  }
  if (resource.lastMatrix !== undefined && sameHtmlMatrix(resource.lastMatrix, localized)) return
  resource.ghost.style.transform = `matrix(${localized.a}, ${localized.b}, ${localized.c}, ${localized.d}, ${localized.e}, ${localized.f})`
  resource.lastMatrix = localized
}

/** Reports whether one author transform longhand is at its neutral CSS value. */
export function isDefaultTransformPropertyValue(
  property: GhostTransformProperty,
  value: string,
): boolean {
  const normalized = value.trim().toLowerCase()
  if (normalized === '' || normalized === 'none') return true
  if (property === 'rotate') return /^0(?:deg|grad|rad|turn)?$/.test(normalized)
  if (property === 'scale') {
    const factors = normalized.split(/\s+/)
    return factors.length <= 3 && factors.every((factor) => factor === '1')
  }
  const translations = normalized.split(/\s+/)
  return translations.length <= 3 && translations.every((part) => /^0(?:[a-z%]+)?$/.test(part))
}

/** Resolves a live-node matrix by subtracting its untransformed layout slot. */
export function resolveLocalPresentationMatrix(
  naturalLayoutOrigin: readonly [number, number],
  target: HtmlPose,
  parentInverse: HtmlMatrix,
): HtmlMatrix {
  const targetMatrix = multiplyMatrix(parentInverse, poseAffineMatrix(target))
  return {
    ...targetMatrix,
    e: targetMatrix.e - naturalLayoutOrigin[0],
    f: targetMatrix.f - naturalLayoutOrigin[1],
  }
}

/** Converts one pose into the complete affine matrix of its local-box origin. */
export function poseAffineMatrix(pose: HtmlPose): HtmlMatrix {
  return { ...pose.matrix, e: pose.origin.x, f: pose.origin.y }
}

/** Compares two affine matrices before rewriting a local presentation slot. */
export function sameHtmlMatrix(left: HtmlMatrix, right: HtmlMatrix): boolean {
  return left.a === right.a
    && left.b === right.b
    && left.c === right.c
    && left.d === right.d
    && left.e === right.e
    && left.f === right.f
}

/** Converts one world pose into the overlay root's local coordinates. */
export function localizePose(root: HtmlPose, rootInverse: HtmlMatrix, pose: HtmlPose): HtmlMatrix {
  const originDelta = worldDeltaToLocalDelta(
    root.matrix,
    pose.origin.x - root.origin.x,
    pose.origin.y - root.origin.y,
  )
  return {
    ...multiplyMatrix(rootInverse, { ...pose.matrix, e: 0, f: 0 }),
    e: originDelta.x,
    f: originDelta.y,
  }
}
