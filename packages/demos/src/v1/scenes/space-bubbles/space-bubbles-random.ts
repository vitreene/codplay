const LCG_A = 1664525
const LCG_C = 1013904223
const LCG_M = 2 ** 32

/** Advances one deterministic seed and returns the next unsigned seed. */
export function nextSeed(seed: number): number {
  return (Math.imul(seed, LCG_A) + LCG_C) >>> 0
}

/** Resolves a deterministic random float in [0, 1) from one seed. */
export function seedToUnit(seed: number): number {
  return seed / LCG_M
}

/** Generates one deterministic run seed, intentionally only pseudo-random. */
export function createSpaceBubblesRunSeed(): number {
  const dayBucket = Math.floor(Date.now() / 86400000)
  return nextSeed(0x5f3759df ^ dayBucket)
}
