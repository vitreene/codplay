import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { createInitialDocument, ElceDocument } from '../../domain/document/document-model'
import type { ElceDocument as ElceDocumentModel } from '../../domain/document/document-model'
import type { ElceProjectSummary } from '../../infrastructure/project-api/project-api-types'
import type { ProjectSessionOperation, ProjectSessionPort, ProjectSessionResult } from '../projects/project-session-types'
import { controllerMachine } from './controller-machine'

class ProjectSessionFixture implements ProjectSessionPort {
  public result: ProjectSessionResult = {
    projects: [],
    activeProject: null,
    document: null,
    status: 'list',
    editAccess: 'waiting',
  }
  public failure: Error | null = null
  public readonly operations: ProjectSessionOperation[] = []
  public readonly startedLocks: string[] = []

  public rememberedProjectId(): string | null {
    return null
  }

  public async perform(operation: ProjectSessionOperation): Promise<ProjectSessionResult> {
    this.operations.push(operation)
    if (this.failure !== null) throw this.failure
    return this.result
  }

  public startLock(projectId: string): void {
    this.startedLocks.push(projectId)
  }

  public async dispose(): Promise<void> {}
}

describe('Elcé project operations in the application actor', () => {
  it('loads an empty server list without creating or activating the temporary document', async () => {
    const session = new ProjectSessionFixture()
    const actor = createActor(controllerMachine, { input: { projectSession: session } })
    actor.start()
    const temporaryDocumentId = actor.getSnapshot().context.document.id

    actor.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: null } })
    await flushActor()

    expect(session.operations).toEqual([{ kind: 'bootstrap', rememberedProjectId: null }])
    expect(actor.getSnapshot().context.document.id).toBe(temporaryDocumentId)
    expect(actor.getSnapshot().context.activeProject).toBeNull()
    expect(actor.getSnapshot().context.projectStatus).toBe('list')
    expect(actor.getSnapshot().context.editAccess).toBe('waiting')
    expect(actor.getSnapshot().value).toBe('suspended')
    expect(session.startedLocks).toEqual([])
    actor.stop()
  })

  it('replaces the document before starting its project lock', async () => {
    const session = new ProjectSessionFixture()
    const project = { id: 'project-b', name: 'Projet B', revision: 4 } satisfies ElceProjectSummary
    const document = renamedDocument('project-b', 'Projet B')
    session.result = {
      projects: [project],
      activeProject: project,
      document,
      status: 'opening',
      editAccess: 'waiting',
    }
    const actor = createActor(controllerMachine, { input: { projectSession: session } })
    actor.start()

    actor.send({ type: 'project.operation', operation: { kind: 'open', projectId: project.id } })
    await flushActor()

    expect(actor.getSnapshot().context.document).toBe(document)
    expect(actor.getSnapshot().context.activeProject).toEqual(project)
    expect(actor.getSnapshot().context.projectStatus).toBe('opening')
    expect(session.startedLocks).toEqual([project.id])
    expect(actor.getSnapshot().value).toBe('suspended')

    actor.send({ type: 'editor.access.activate' })
    expect(actor.getSnapshot().context.projectStatus).toBe('active')
    expect(actor.getSnapshot().value).toBe('ready')
    actor.stop()
  })

  it('keeps the current document and edit access when a project request fails', async () => {
    const session = new ProjectSessionFixture()
    const currentProject = { id: 'current-project', name: 'Courant', revision: 2 } satisfies ElceProjectSummary
    const currentDocument = renamedDocument(currentProject.id, currentProject.name)
    session.result = {
      projects: [currentProject],
      activeProject: currentProject,
      document: currentDocument,
      status: 'opening',
      editAccess: 'waiting',
    }
    const actor = createActor(controllerMachine, { input: { projectSession: session } })
    actor.start()
    actor.send({ type: 'project.operation', operation: { kind: 'open', projectId: currentProject.id } })
    await flushActor()
    actor.send({ type: 'editor.access.activate' })
    session.failure = new Error('Serveur indisponible')
    actor.send({ type: 'project.operation', operation: { kind: 'open', projectId: 'target-project' } })
    await flushActor()

    expect(actor.getSnapshot().context.document.id).toBe(currentProject.id)
    expect(actor.getSnapshot().context.activeProject).toEqual(currentProject)
    expect(actor.getSnapshot().context.projectError).toBe('Serveur indisponible')
    expect(actor.getSnapshot().context.editAccess).toBe('active')
    expect(actor.getSnapshot().value).toBe('ready')
    actor.stop()
  })
})

/** Creates a test document whose identity and visible name match a project. */
function renamedDocument(id: string, name: string): ElceDocumentModel {
  const document = createInitialDocument().toJSON()
  return ElceDocument.fromJSON({ ...document, id, name })
}

/** Waits for the invoked XState promise actor to publish its result. */
async function flushActor(): Promise<void> {
  for (let turn = 0; turn < 4; turn += 1) await new Promise<void>((resolve) => setTimeout(resolve, 0))
}
