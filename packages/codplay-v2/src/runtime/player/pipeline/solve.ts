import type { ResolvedScene, SolvedScene } from './types'

/** Establishes the stable solve output before hierarchy support is opened. */
export function solveScene(resolved: ResolvedScene): SolvedScene {
  return {
    timeMs: resolved.timeMs,
    persos: resolved.persos,
  }
}
