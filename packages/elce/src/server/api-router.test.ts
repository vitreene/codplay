import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyDocumentCommand } from '../domain/commands/document-commands'
import { createInitialDocument, ElceDocument } from '../domain/document/document-model'
import { INITIAL_PROJECT_TEST_STATE, type ProjectTestState, type VersionedProjectTestState } from '../domain/summary-profile/test-state-types'
import type {
  CreateProjectResult,
  ProjectEditGrant,
  ProjectPersistence,
  ProjectSummary,
  SaveProjectDocumentResult,
  SaveProjectTestStateResult,
  StoredProject,
} from './projects/project-persistence'
import { createElceApiRouter } from './api-router'

afterEach(() => vi.restoreAllMocks())

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
    const malformedRevisionBody = await malformedRevision.json() as Record<string, unknown>
    const mismatchedIdBody = await mismatchedId.json() as Record<string, unknown>
    expect(malformedRevisionBody).toMatchObject({
      error: 'invalid_request',
      diagnosticId: expect.any(String),
      diagnosticReason: 'invalid_if_match',
    })
    expect(mismatchedIdBody).toMatchObject({
      error: 'invalid_request',
      diagnosticId: expect.any(String),
      diagnosticReason: 'document_id_mismatch',
    })
    expect(malformedRevisionBody.diagnosticId).not.toBe(mismatchedIdBody.diagnosticId)
  })

  it('classifies unreadable JSON and invalid document shapes', async () => {
    const router = createElceApiRouter(new MemoryProjectPersistence())
    const invalidJson = await router.fetch(new Request('http://elce.test/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    }))
    const grant = { 'X-Elce-Page-Id': 'test-page', 'X-Elce-Edit-Grant': 'test-grant' }
    const invalidDocumentJson = await router.fetch(new Request('http://elce.test/api/projects/project-invalid/document', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': '"0"', ...grant },
      body: '{',
    }))
    const document = documentWithId('project-invalid-shape').toJSON()
    const invalidShape = await router.fetch(jsonRequest('PUT', '/api/projects/project-invalid-shape/document', {
      ...document,
      version: 3,
    }, { 'If-Match': '"0"', ...grant }))

    expect(invalidJson.status).toBe(400)
    expect(invalidDocumentJson.status).toBe(400)
    expect(await invalidDocumentJson.json()).toMatchObject({
      error: 'invalid_request',
      diagnosticId: expect.any(String),
      diagnosticReason: 'invalid_json',
    })
    expect(await invalidShape.json()).toMatchObject({
      error: 'invalid_request',
      diagnosticId: expect.any(String),
      diagnosticReason: 'invalid_document_shape',
    })
  })

  it('correlates invariant rejection without logging document content', async () => {
    const router = createElceApiRouter(new MemoryProjectPersistence())
    const document = documentWithId('project-invalid-invariant').toJSON()
    const privateSentinel = 'DOCUMENT_TEXT_MUST_NOT_BE_LOGGED'
    const invalidDocument = {
      ...document,
      appearance: { privateNote: privateSentinel },
    }
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await router.fetch(jsonRequest(
      'PUT',
      '/api/projects/project-invalid-invariant/document',
      invalidDocument,
      {
        'If-Match': '"0"',
        'X-Elce-Page-Id': 'test-page',
        'X-Elce-Edit-Grant': 'test-grant',
      },
    ))
    const diagnostic = await response.json() as Record<string, unknown>

    expect(response.status).toBe(400)
    expect(diagnostic).toMatchObject({
      error: 'invalid_request',
      diagnosticId: expect.any(String),
      diagnosticReason: 'document_invariants_rejected',
    })
    expect(report).toHaveBeenCalledWith('Elcé API rejected project document.', expect.objectContaining({
      diagnosticId: diagnostic.diagnosticId,
      projectId: 'project-invalid-invariant',
      diagnosticReason: 'document_invariants_rejected',
      validationFrames: expect.any(Array),
    }))
    expect(JSON.stringify(report.mock.calls)).not.toContain(privateSentinel)
  })

  it('reads and saves test state on its independent revision and rejects stale writes', async () => {
    const persistence = new MemoryProjectPersistence()
    const router = createElceApiRouter(persistence)
    await persistence.createProject(documentWithId('project-test-state'))

    const initial = await router.fetch(new Request('http://elce.test/api/projects/project-test-state/test-state'))
    expect(initial.headers.get('ETag')).toBe('"0"')
    expect(await initial.json()).toEqual({ state: INITIAL_PROJECT_TEST_STATE })

    const nextState: ProjectTestState = {
      ...INITIAL_PROJECT_TEST_STATE,
      profileValues: { name: 'Ada' },
    }
    const saved = await router.fetch(jsonRequest('PUT', '/api/projects/project-test-state/test-state', { state: nextState }, {
      'If-Match': '"0"',
    }))
    expect(saved.status).toBe(200)
    expect(saved.headers.get('ETag')).toBe('"1"')

    const stale = await router.fetch(jsonRequest('PUT', '/api/projects/project-test-state/test-state', { state: INITIAL_PROJECT_TEST_STATE }, {
      'If-Match': '"0"',
    }))
    expect(stale.status).toBe(412)
    const current = await router.fetch(new Request('http://elce.test/api/projects/project-test-state/test-state'))
    expect(current.headers.get('ETag')).toBe('"1"')
    expect(await current.json()).toEqual({ state: nextState })
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

/** Creates an isolated v6 document fixture for API tests. */
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
  private readonly testStates = new Map<string, VersionedProjectTestState>()

  /** Reserves a fixture project for one page. */
  public async acquireEditAccess(projectId: string, pageId: string, force = false) {
    if (!this.projects.has(projectId)) return { kind: 'not-found' as const }
    const current = this.grants.get(projectId)
    if (!force && current !== undefined && current.pageId !== pageId) return { kind: 'occupied' as const }
    const grantId = !force && current?.pageId === pageId ? current.grantId : 'test-grant'
    this.grants.set(projectId, { pageId, grantId })
    return { kind: 'granted' as const, grantId, recovered: force || current !== undefined }
  }

  /** Renews a fixture grant while it remains the current owner. */
  public async renewEditAccess(projectId: string, grant: ProjectEditGrant): Promise<boolean> {
    return this.hasEditAccess(projectId, grant)
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
    this.testStates.delete(projectId)
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

  /** Reads preview state independently from the project document revision. */
  public async readTestState(projectId: string): Promise<VersionedProjectTestState | null> {
    if (!this.projects.has(projectId)) return null
    return this.testStates.get(projectId) ?? { state: INITIAL_PROJECT_TEST_STATE, revision: 0 }
  }

  /** Stores preview state only when its independent revision matches. */
  public async saveTestState(
    projectId: string,
    expectedRevision: number,
    state: ProjectTestState,
  ): Promise<SaveProjectTestStateResult> {
    if (!this.projects.has(projectId)) return { kind: 'not-found' }
    const current = this.testStates.get(projectId) ?? { state: INITIAL_PROJECT_TEST_STATE, revision: 0 }
    if (current.revision !== expectedRevision) return { kind: 'revision-mismatch' }
    const value = { state, revision: current.revision + 1 }
    this.testStates.set(projectId, value)
    return { kind: 'saved', value }
  }
}
