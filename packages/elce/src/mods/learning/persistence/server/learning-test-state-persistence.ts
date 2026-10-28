import type { ProjectTestState, VersionedProjectTestState } from '../../reading/learning-test-state-types'

/** Describes the independent revision result of one saved Learning test state. */
export type SaveLearningTestStateResult =
  | Readonly<{ kind: 'saved'; value: VersionedProjectTestState }>
  | Readonly<{ kind: 'revision-mismatch' }>
  | Readonly<{ kind: 'not-found' }>

/** Defines Learning's persistence operations for the author-preview state. */
export interface LearningTestStatePersistence {
  /** Reads the author's separate preview state, or null when its project is missing. */
  readTestState(projectId: string): Promise<VersionedProjectTestState | null>

  /** Saves preview state against the exact revision previously read. */
  saveTestState(
    projectId: string,
    expectedRevision: number,
    state: ProjectTestState,
  ): Promise<SaveLearningTestStateResult>
}
