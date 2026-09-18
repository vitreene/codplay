import type { ThreeSceneTarget } from './threejs-types'

/** Checks the opaque value received through a Three.js relation. */
export function isThreeSceneTarget(value: unknown): value is ThreeSceneTarget {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Partial<ThreeSceneTarget>
  return candidate.scene !== undefined
    && candidate.renderer !== undefined
    && typeof candidate.setCamera === 'function'
    && typeof candidate.resize === 'function'
    && typeof candidate.render === 'function'
}
