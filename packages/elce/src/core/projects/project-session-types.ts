import type { ElceProjectSummary } from '../persistence/project-api/project-api-types'

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

export interface ProjectSessionResult<TDocument, TProject = ElceProjectSummary> {
  readonly projects: readonly TProject[]
  readonly activeProject: TProject | null
  readonly document: TDocument | null
  readonly status: ProjectSessionStatus
  readonly editAccess: 'waiting' | 'active'
  readonly projectError?: string | null
}

export interface ProjectSessionPort<TDocument, TProject = ElceProjectSummary> {
  rememberedProjectId(): string | null
  perform(
    operation: ProjectSessionOperation,
    document: TDocument,
    activeProject: TProject | null,
    editAccess: 'waiting' | 'active',
    hadEditAccess: boolean,
  ): Promise<ProjectSessionResult<TDocument, TProject>>
  startLock(projectId: string): void
  retryAccess?(): void
  forceAccess?(): void
  dispose(): Promise<void>
}
