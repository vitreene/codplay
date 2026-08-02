import type { SolvedScene } from './pipeline'

/** Projection boundary called by RuntimePlayer after each solved scene. */
export type LayoutProjection = Readonly<{
  project: (scene: SolvedScene) => void
  destroy?: () => void
}>
