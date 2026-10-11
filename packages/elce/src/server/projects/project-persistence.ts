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

/** Identifies the one page and acquisition currently allowed to mutate a project. */
export interface ProjectEditGrant {
  readonly pageId: string
  readonly grantId: string
}

export type AcquireProjectEditResult =
  | Readonly<{ kind: 'granted'; grantId: string }>
  | Readonly<{ kind: 'occupied' }>
  | Readonly<{ kind: 'not-found' }>

export type EditProjectResult =
  | Readonly<{ kind: 'updated'; project: ProjectSummary }>
  | Readonly<{ kind: 'not-found' }>
  | Readonly<{ kind: 'edit-access-lost' }>

export type DeleteProjectResult = 'deleted' | 'not-found' | 'edit-access-lost'

/** Describes the result of creating a project with a document identifier. */
export type CreateProjectResult =
  | Readonly<{ kind: 'created'; project: ProjectSummary }>
  | Readonly<{ kind: 'already-exists' }>

/** Describes the result of replacing a document at an expected revision. */
export type SaveProjectDocumentResult =
  | Readonly<{ kind: 'saved'; project: ProjectSummary }>
  | Readonly<{ kind: 'revision-mismatch' }>
  | Readonly<{ kind: 'not-found' }>
  | Readonly<{ kind: 'edit-access-lost' }>

/** Defines the storage operations used by the project HTTP controller. */
export interface ProjectPersistence {
  /** Reserves one project for a page, or returns its existing reservation. */
  acquireEditAccess(projectId: string, pageId: string): Promise<AcquireProjectEditResult>

  /** Checks whether one grant still owns editing, without acquiring it. */
  hasEditAccess(projectId: string, grant: ProjectEditGrant): Promise<boolean>

  /** Releases editing only for the grant that currently owns it. */
  releaseEditAccess(projectId: string, grant: ProjectEditGrant): Promise<boolean>

  /** Lists project identifiers, names, and current revisions. */
  listProjects(): Promise<readonly ProjectSummary[]>

  /** Loads a project and its reconstructed v4 document. */
  findProject(projectId: string): Promise<StoredProject | null>

  /** Creates revision zero unless the document identifier is already stored. */
  createProject(document: ElceDocument): Promise<CreateProjectResult>

  /** Renames the document and increments its project revision. */
  renameProject(projectId: string, name: string, grant: ProjectEditGrant): Promise<EditProjectResult>

  /** Deletes a project and reports whether it existed. */
  deleteProject(projectId: string, grant: ProjectEditGrant): Promise<DeleteProjectResult>

  /** Replaces the document atomically when the current revision matches. */
  saveDocument(
    projectId: string,
    expectedRevision: number,
    document: ElceDocument,
    grant: ProjectEditGrant,
  ): Promise<SaveProjectDocumentResult>
}
