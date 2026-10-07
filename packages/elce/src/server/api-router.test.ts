import { describe, expect, it } from 'vitest'
import { applyDocumentCommand } from '../domain/commands/document-commands'
import { createInitialDocument, ElceDocument } from '../domain/document/document-model'
import type {
  CreateProjectResult,
  ProjectPersistence,
  ProjectSummary,
  SaveProjectDocumentResult,
  StoredProject,
} from './projects/project-persistence'
import { createElceApiRouter } from './api-router'

describe('Elcé project API Fetch router', () => {
  it('returns 404 for an unregistered endpoint', async () => {
    const router = createElceApiRouter(new MemoryProjectPersistence())
    const response = await router.fetch(new Request('http://elce.test/api/unknown'))

    expect(response.status).toBe(404)
  })

  it('lists project summaries without embedding their documents', async () => {
    const persistence = new MemoryProjectPersistence()
    const router = createElceApiRouter(persistence)
    await persistence.createProject(documentWithId('project-a'))

    const response = await router.fetch(new Request('http://elce.test/api/projects'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      projects: [{ id: 'project-a', name: 'Document Elcé', revision: 0 }],
    })
  })

  it('creates and opens a project from the editor document', async () => {
    const router = createElceApiRouter(new MemoryProjectPersistence())
    const document = documentWithId('project-created')
    const created = await router.fetch(jsonRequest('POST', '/api/projects', document.toJSON()))

    expect(created.status).toBe(201)
    expect(created.headers.get('ETag')).toBe('"0"')
    expect(await created.json()).toEqual({
      project: { id: 'project-created', name: 'Document Elcé', revision: 0 },
    })

    const opened = await router.fetch(new Request('http://elce.test/api/projects/project-created'))
    expect(opened.status).toBe(200)
    expect(opened.headers.get('ETag')).toBe('"0"')
    expect(await opened.json()).toEqual({
      project: { id: 'project-created', name: 'Document Elcé', revision: 0 },
      document: document.toJSON(),
    })
  })

  it('rejects a second project with the same document identifier', async () => {
    const persistence = new MemoryProjectPersistence()
    const router = createElceApiRouter(persistence)
    const document = documentWithId('project-existing')
    await persistence.createProject(document)

    const response = await router.fetch(jsonRequest('POST', '/api/projects', document.toJSON()))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'project_already_exists' })
  })

  it('renames the document and advances the project revision', async () => {
    const persistence = new MemoryProjectPersistence()
    const router = createElceApiRouter(persistence)
    await persistence.createProject(documentWithId('project-rename'))

    const response = await router.fetch(jsonRequest('PATCH', '/api/projects/project-rename', { name: 'Nouveau nom' }))

    expect(response.status).toBe(200)
    expect(response.headers.get('ETag')).toBe('"1"')
    expect(await response.json()).toEqual({
      project: { id: 'project-rename', name: 'Nouveau nom', revision: 1 },
    })
    const opened = await router.fetch(new Request('http://elce.test/api/projects/project-rename'))
    expect(await opened.json()).toMatchObject({ document: { name: 'Nouveau nom' } })
  })

  it('saves a matching document revision and refuses a stale replacement', async () => {
    const persistence = new MemoryProjectPersistence()
    const router = createElceApiRouter(persistence)
    const document = documentWithId('project-save')
    await persistence.createProject(document)
    const renamed = applyDocumentCommand(document, { type: 'document.rename', name: 'Enregistré' })

    const saved = await router.fetch(jsonRequest('PUT', '/api/projects/project-save/document', renamed.toJSON(), {
      'If-Match': '"0"',
    }))
    expect(saved.status).toBe(200)
    expect(saved.headers.get('ETag')).toBe('"1"')
    expect(await saved.json()).toEqual({
      project: { id: 'project-save', name: 'Enregistré', revision: 1 },
    })

    const stale = await router.fetch(jsonRequest('PUT', '/api/projects/project-save/document', document.toJSON(), {
      'If-Match': '"0"',
    }))
    expect(stale.status).toBe(412)
    expect(await stale.json()).toEqual({ error: 'revision_mismatch' })
    const opened = await router.fetch(new Request('http://elce.test/api/projects/project-save'))
    expect(await opened.json()).toMatchObject({ document: { name: 'Enregistré' } })
  })

  it('rejects a missing or malformed revision and a document id that differs from the route', async () => {
    const router = createElceApiRouter(new MemoryProjectPersistence())
    const document = documentWithId('project-path-mismatch')

    const missingRevision = await router.fetch(jsonRequest('PUT', '/api/projects/project-path-mismatch/document', document.toJSON()))
    const malformedRevision = await router.fetch(jsonRequest('PUT', '/api/projects/project-path-mismatch/document', document.toJSON(), {
      'If-Match': '0',
    }))
    const mismatchedId = await router.fetch(jsonRequest('PUT', '/api/projects/other-project/document', document.toJSON(), {
      'If-Match': '"0"',
    }))

    expect(missingRevision.status).toBe(428)
    expect(malformedRevision.status).toBe(400)
    expect(mismatchedId.status).toBe(400)
  })

  it('rejects unreadable JSON and unsupported document versions', async () => {
    const router = createElceApiRouter(new MemoryProjectPersistence())
    const invalidJson = await router.fetch(new Request('http://elce.test/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    }))
    const oldDocument = documentWithId('project-old-version').toJSON()
    const unsupportedVersion = await router.fetch(jsonRequest('POST', '/api/projects', { ...oldDocument, version: 3 }))

    expect(invalidJson.status).toBe(400)
    expect(unsupportedVersion.status).toBe(400)
  })

  it('deletes a project and reports when it is already absent', async () => {
    const persistence = new MemoryProjectPersistence()
    const router = createElceApiRouter(persistence)
    await persistence.createProject(documentWithId('project-delete'))

    const deleted = await router.fetch(new Request('http://elce.test/api/projects/project-delete', { method: 'DELETE' }))
    const missing = await router.fetch(new Request('http://elce.test/api/projects/project-delete', { method: 'DELETE' }))

    expect(deleted.status).toBe(204)
    expect(missing.status).toBe(404)
  })
})

/** Creates an isolated v4 document fixture for API tests. */
function documentWithId(id: string): ElceDocument {
  return new ElceDocument({ ...createInitialDocument().toJSON(), id })
}

/** Creates an HTTP request with a JSON body for API tests. */
function jsonRequest(method: string, path: string, body: unknown, headers: HeadersInit = {}): Request {
  return new Request(`http://elce.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

/** Provides isolated route-level behavior without claiming SQLite coverage. */
class MemoryProjectPersistence implements ProjectPersistence {
  private readonly projects = new Map<string, StoredProject>()

  /** Lists summaries from the fixture-owned projects. */
  public async listProjects(): Promise<readonly ProjectSummary[]> {
    return [...this.projects.values()].map(({ project }) => project)
  }

  /** Finds a fixture project by its document identifier. */
  public async findProject(projectId: string): Promise<StoredProject | null> {
    return this.projects.get(projectId) ?? null
  }

  /** Stores a document fixture unless its identifier is already present. */
  public async createProject(document: ElceDocument): Promise<CreateProjectResult> {
    switch (this.projects.has(document.id)) {
      case true:
        return { kind: 'already-exists' }
      case false: {
        const project = { id: document.id, name: document.data.name, revision: 0 }
        this.projects.set(document.id, { project, document })
        return { kind: 'created', project }
      }
    }
  }

  /** Renames the fixture document through the established domain command. */
  public async renameProject(projectId: string, name: string): Promise<ProjectSummary | null> {
    const stored = this.projects.get(projectId)
    switch (stored) {
      case undefined:
        return null
      default: {
        const document = applyDocumentCommand(stored.document, { type: 'document.rename', name })
        const project = { ...stored.project, name, revision: stored.project.revision + 1 }
        this.projects.set(projectId, { project, document })
        return project
      }
    }
  }

  /** Removes a fixture project and reports whether it existed. */
  public async deleteProject(projectId: string): Promise<boolean> {
    return this.projects.delete(projectId)
  }

  /** Replaces a fixture document only when the expected revision is current. */
  public async saveDocument(
    projectId: string,
    expectedRevision: number,
    document: ElceDocument,
  ): Promise<SaveProjectDocumentResult> {
    const stored = this.projects.get(projectId)
    switch (stored) {
      case undefined:
        return { kind: 'not-found' }
      default:
        switch (stored.project.revision === expectedRevision) {
          case false:
            return { kind: 'revision-mismatch' }
          case true: {
            const project = { ...stored.project, name: document.data.name, revision: stored.project.revision + 1 }
            this.projects.set(projectId, { project, document })
            return { kind: 'saved', project }
          }
        }
    }
  }
}
