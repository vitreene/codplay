import type { ElceDocument } from '../../domain/document/document-model'

/** Describes the public project fields returned by the local API. */
export interface ProjectSummary {
  readonly id: string
  readonly name: string
  readonly revision: number
}

/** Describes one persisted project and its current domain document. */
export interface StoredProject {
  readonly project: ProjectSummary
  readonly document: ElceDocument
}

/** Describes the result of creating a project with a document identifier. */
export type CreateProjectResult =
  | Readonly<{ kind: 'created'; project: ProjectSummary }>
  | Readonly<{ kind: 'already-exists' }>

/** Describes the result of replacing a document at an expected revision. */
export type SaveProjectDocumentResult =
  | Readonly<{ kind: 'saved'; project: ProjectSummary }>
  | Readonly<{ kind: 'revision-mismatch' }>
  | Readonly<{ kind: 'not-found' }>

/** Defines the storage operations used by the project HTTP controller. */
export interface ProjectPersistence {
  /** Lists project identifiers, names, and current revisions. */
  listProjects(): Promise<readonly ProjectSummary[]>

  /** Loads a project and its reconstructed v4 document. */
  findProject(projectId: string): Promise<StoredProject | null>

  /** Creates revision zero unless the document identifier is already stored. */
  createProject(document: ElceDocument): Promise<CreateProjectResult>

  /** Renames the document and increments its project revision. */
  renameProject(projectId: string, name: string): Promise<ProjectSummary | null>

  /** Deletes a project and reports whether it existed. */
  deleteProject(projectId: string): Promise<boolean>

  /** Replaces the document atomically when the current revision matches. */
  saveDocument(
    projectId: string,
    expectedRevision: number,
    document: ElceDocument,
  ): Promise<SaveProjectDocumentResult>
}
