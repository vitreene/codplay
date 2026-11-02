import type { ProjectSessionOperation } from '../projects/project-session-types'

type CoreEditorEvent =
  | Readonly<{ type: 'project.operation'; operation: ProjectSessionOperation }>
  | Readonly<{ type: 'history.undo' | 'history.redo' | 'import.cancel' }>
  | Readonly<{ type: 'project.access.retry' | 'project.access.force' }>

/** Routes shared project and history intentions through the owning authoring actor. */
export class CoreEditorFacade {
  private readonly send: (event: CoreEditorEvent) => void
  private readonly renameDocument: (name: string) => void

  public constructor(send: (event: CoreEditorEvent) => void, renameDocument: (name: string) => void) {
    this.send = send
    this.renameDocument = renameDocument
  }

  /** Sends a project lifecycle intention through the existing actor. */
  public manageProjects(operation: ProjectSessionOperation): void {
    this.send({ type: 'project.operation', operation })
  }

  /** Undoes the most recent accepted document gesture in the controller. */
  public undo(): void {
    this.send({ type: 'history.undo' })
  }

  /** Replays the next gesture from the controller's Redo branch. */
  public redo(): void {
    this.send({ type: 'history.redo' })
  }

  /** Cancels only the active file preparation, leaving document history intact. */
  public cancelImport(): void {
    this.send({ type: 'import.cancel' })
  }

  /** Starts the server-owned project list and restores this tab's selection. */
  public bootstrapProjects(rememberedProjectId: string | null): void {
    this.manageProjects({ kind: 'bootstrap', rememberedProjectId })
  }

  /** Re-reads project summaries from the server. */
  public refreshProjects(): void {
    this.manageProjects({ kind: 'refresh' })
  }

  /** Creates a new project and opens it after server creation succeeds. */
  public createProject(): void {
    this.manageProjects({ kind: 'create' })
  }

  /** Starts an independent project from the confirmed document on screen. */
  public saveAs(name: string): void {
    this.manageProjects({ kind: 'save-as', name })
  }

  /** Preserves an unpublished local revision as a distinct project. */
  public saveLocalAs(name: string): void {
    this.manageProjects({ kind: 'save-local-as', name })
  }

  /** Rechecks a waiting project's server revision and editing right. */
  public retryProjectAccess(): void {
    this.send({ type: 'project.access.retry' })
  }

  /** Takes the temporary emergency path to replace another page's edit grant. */
  public forceProjectAccess(): void {
    this.send({ type: 'project.access.force' })
  }

  /** Opens a selected project after the current project is confirmed saved. */
  public openProject(projectId: string): void {
    this.manageProjects({ kind: 'open', projectId })
  }

  /** Closes the active project without deleting its server copy. */
  public closeProject(): void {
    this.manageProjects({ kind: 'close' })
  }

  /** Deletes one server project and only its corresponding local cache. */
  public deleteProject(projectId: string): void {
    this.manageProjects({ kind: 'delete', projectId })
  }

  /** Renames the active project through its composition-owned document command. */
  public renameActiveProject(name: string): void {
    this.renameDocument(name)
  }
}
