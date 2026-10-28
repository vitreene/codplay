import type { LearningDocument } from '../../mods/learning/document/learning-document'
import type { ElceProjectSummary } from '../../core/persistence/project-api/project-api-types'
import type {
  ProjectSessionPort as CoreProjectSessionPort,
  ProjectSessionResult as CoreProjectSessionResult,
} from '../../core/projects/project-session-types'

export type { ProjectSessionOperation, ProjectSessionStatus } from '../../core/projects/project-session-types'
export type ProjectSessionResult = CoreProjectSessionResult<LearningDocument, ElceProjectSummary>
export type ProjectSessionPort = CoreProjectSessionPort<LearningDocument, ElceProjectSummary>
