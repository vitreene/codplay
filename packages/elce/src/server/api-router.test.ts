import { describe, expect, it } from 'vitest'
import { applyDocumentCommand } from '../domain/commands/document-commands'
import { createInitialDocument, ElceDocument } from '../domain/document/document-model'
import type {
  CreateProjectResult,
  ProjectEditGrant,
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
    const grant = await reserve(router, 'project-rename')

    const response = await router.fetch(jsonRequest('PATCH', '/api/projects/project-rename', { name: 'Nouveau nom' }, grant))

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
    const grant = await reserve(router, 'project-save')
    const renamed = applyDocumentCommand(document, { type: 'document.rename', name: 'Enregistré' })

    const saved = await router.fetch(jsonRequest('PUT', '/api/projects/project-save/document', renamed.toJSON(), {
      'If-Match': '"0"',
      ...grant,
    }))
    expect(saved.status).toBe(200)
    expect(saved.headers.get('ETag')).toBe('"1"')
    expect(await saved.json()).toEqual({
      project: { id: 'project-save', name: 'Enregistré', revision: 1 },
    })

    const stale = await router.fetch(jsonRequest('PUT', '/api/projects/project-save/document', document.toJSON(), {
      'If-Match': '"0"',
      ...grant,
    }))
    expect(stale.status).toBe(412)
    expect(await stale.json()).toEqual({ error: 'revision_mismatch' })
    const opened = await router.fetch(new Request('http://elce.test/api/projects/project-save'))
    expect(await opened.json()).toMatchObject({ document: { name: 'Enregistré' } })
  })

  it('rejects a missing or malformed revision and a document id that differs from the route', async () => {
    const router = createElceApiRouter(new MemoryProjectPersistence())
    const document = documentWithId('project-path-mismatch')
    const grant = { 'X-Elce-Page-Id': 'test-page', 'X-Elce-Edit-Grant': 'test-grant' }

    const missingRevision = await router.fetch(jsonRequest('PUT', '/api/projects/project-path-mismatch/document', document.toJSON(), grant))
    const malformedRevision = await router.fetch(jsonRequest('PUT', '/api/projects/project-path-mismatch/document', document.toJSON(), {
      'If-Match': '0',
      ...grant,
    }))
    const mismatchedId = await router.fetch(jsonRequest('PUT', '/api/projects/other-project/document', document.toJSON(), {
      'If-Match': '"0"',
      ...grant,
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
    const grant = await reserve(router, 'project-delete')

    const deleted = await router.fetch(new Request('http://elce.test/api/projects/project-delete', { method: 'DELETE', headers: grant }))
    const missing = await router.fetch(new Request('http://elce.test/api/projects/project-delete', { method: 'DELETE', headers: grant }))

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

/** Reserves a fixture project and returns its authenticated mutation headers. */
async function reserve(router: ReturnType<typeof createElceApiRouter>, projectId: string): Promise<Record<string, string>> {
  const response = await router.fetch(jsonRequest('POST', `/api/projects/${projectId}/edit-access`, { pageId: 'test-page' }))
  const body = await response.json() as { grantId: string }
  return { 'X-Elce-Page-Id': 'test-page', 'X-Elce-Edit-Grant': body.grantId }
}

/** Provides isolated route-level behavior without claiming SQLite coverage. */
class MemoryProjectPersistence implements ProjectPersistence {
  private readonly projects = new Map<string, StoredProject>()
  private readonly grants = new Map<string, ProjectEditGrant>()

  /** Reserves a fixture project for one page. */
  public async acquireEditAccess(projectId: string, pageId: string) {
    if (!this.projects.has(projectId)) return { kind: 'not-found' as const }
    const current = this.grants.get(projectId)
    if (current !== undefined && current.pageId !== pageId) return { kind: 'occupied' as const }
    const grantId = current?.grantId ?? 'test-grant'
    this.grants.set(projectId, { pageId, grantId })
    return { kind: 'granted' as const, grantId }
  }

  /** Checks the exact fixture grant. */
  public async hasEditAccess(projectId: string, grant: ProjectEditGrant): Promise<boolean> {
    const current = this.grants.get(projectId)
    return current?.pageId === grant.pageId && current.grantId === grant.grantId
  }

  /** Releases the exact fixture grant. */
  public async releaseEditAccess(projectId: string, grant: ProjectEditGrant): Promise<boolean> {
    if (!await this.hasEditAccess(projectId, grant)) return false
    this.grants.delete(projectId)
    return true
  }

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
  public async renameProject(projectId: string, name: string, grant: ProjectEditGrant) {
    const stored = this.projects.get(projectId)
    if (stored === undefined) return { kind: 'not-found' as const }
    if (!await this.hasEditAccess(projectId, grant)) return { kind: 'edit-access-lost' as const }
    switch (stored) {
      default: {
        const document = applyDocumentCommand(stored.document, { type: 'document.rename', name })
        const project = { ...stored.project, name, revision: stored.project.revision + 1 }
        this.projects.set(projectId, { project, document })
        return { kind: 'updated' as const, project }
      }
    }
  }

  /** Removes a fixture project and reports whether it existed. */
  public async deleteProject(projectId: string, grant: ProjectEditGrant) {
    if (!this.projects.has(projectId)) return 'not-found' as const
    if (!await this.hasEditAccess(projectId, grant)) return 'edit-access-lost' as const
    this.projects.delete(projectId)
    return 'deleted' as const
  }

  /** Replaces a fixture document only when the expected revision is current. */
  public async saveDocument(
    projectId: string,
    expectedRevision: number,
    document: ElceDocument,
    grant: ProjectEditGrant,
  ): Promise<SaveProjectDocumentResult> {
    const stored = this.projects.get(projectId)
    switch (stored) {
      case undefined:
        return { kind: 'not-found' }
      default:
        if (!await this.hasEditAccess(projectId, grant)) return { kind: 'edit-access-lost' }
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
