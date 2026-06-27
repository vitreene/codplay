import type { ThreejsSetDescriptor } from './threejs-types.js'

/** Keeps only well-formed immediate set descriptors targeting named Three.js refs. */
export function normalizeThreejsSetDescriptors(
  descriptors: readonly ThreejsSetDescriptor[],
): ThreejsSetDescriptor[] {
  return descriptors
    .filter((descriptor) => typeof descriptor.ref === 'string' && descriptor.ref.length > 0)
    .filter((descriptor) => typeof descriptor.values === 'object' && descriptor.values !== null)
}
