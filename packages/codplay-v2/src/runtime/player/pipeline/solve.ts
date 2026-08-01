import type { ResolvedScene, SolvedScene } from './types'

/** Establishes the stable solve output before hierarchy support is opened. */
export function solveScene(resolved: ResolvedScene): SolvedScene {
  return {
    timeMs: resolved.timeMs,
    sceneState: resolved.sceneState,
    storyStates: resolved.storyStates,
    persos: resolved.persos,
  }
}
