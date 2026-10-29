import type { ElceDocument } from '../../domain/document/document-model'
import type { ElceProjectSummary } from '../../infrastructure/project-api/project-api-types'

export type ProjectSessionOperation =
  | Readonly<{ kind: 'bootstrap'; rememberedProjectId: string | null }>
  | Readonly<{ kind: 'refresh' }>
  | Readonly<{ kind: 'create' }>
  | Readonly<{ kind: 'save-as'; name: string }>
  | Readonly<{ kind: 'save-local-as'; name: string }>
  | Readonly<{ kind: 'open'; projectId: string }>
  | Readonly<{ kind: 'close' }>
  | Readonly<{ kind: 'delete'; projectId: string }>

export type ProjectSessionStatus = 'loading' | 'list' | 'opening' | 'active' | 'busy' | 'error'

export interface ProjectSessionResult {
  readonly projects: readonly ElceProjectSummary[]
  readonly activeProject: ElceProjectSummary | null
  readonly document: ElceDocument | null
  readonly status: ProjectSessionStatus
  readonly editAccess: 'waiting' | 'active'
  readonly projectError?: string | null
}

export interface ProjectSessionPort {
  rememberedProjectId(): string | null
  perform(
    operation: ProjectSessionOperation,
    document: ElceDocument,
    activeProject: ElceProjectSummary | null,
    editAccess: 'waiting' | 'active',
    hadEditAccess: boolean,
  ): Promise<ProjectSessionResult>
  startLock(projectId: string): void
  retryAccess?(): void
  forceAccess?(): void
  dispose(): Promise<void>
}
