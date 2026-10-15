import { afterEach, describe, expect, it } from 'vitest'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rawSql } from 'remix/data-table'
import { loadMigrations } from 'remix/data-table/migrations/node'
import {
  BDC_LOCATION,
  BDC_TYPE,
  CAROUSEL_TRANSITION,
  CHAPTER_TYPE,
  DEFAULT_PRESET_ID,
  EVALUATION_RESULT_ACTION,
  EVALUATION_RETRY_SCOPE,
  PAGE_LOCATION,
  PAGE_TYPE,
  STATISTICAL_GRAPH_RENDERING,
} from '../../../config/document-config'
import { applyDocumentCommand, assertDocumentInvariants, createStatisticalGraphCarouselBdcCommand } from '../../../domain/commands/document-commands'
import { createInitialDocument, ElceDocument } from '../../../domain/document/document-model'
import { INITIAL_PROJECT_TEST_STATE, type ProjectTestState } from '../../../domain/summary-profile/test-state-types'
import type { ElceDocument as ElceDocumentClass } from '../../../domain/document/document-model'
import { ElceProjectApiClient } from '../../../infrastructure/project-api/project-api-client'
import { createElceApiRouter } from '../../api-router'
import { createElceHttpServer } from '../../elce-http-server'
import { MediaApiController } from '../../media/media-api-controller'
import { createMediaFileStorage } from '../../media/media-file-storage'
import { openProjectDatabase } from './project-database'
import { SqliteProjectPersistence } from './sqlite-project-persistence'
import { createSqliteDatabase } from 'remix/data-table/sqlite'
import type { SqliteDatabase } from 'remix/data-table/sqlite'

describe('SQLite project persistence through the Remix API', () => {
  let database: SqliteDatabase | undefined
  let temporaryDirectory: string | undefined

  afterEach(async () => {
    await database?.close()
    database = undefined
    if (temporaryDirectory !== undefined) await rm(temporaryDirectory, { recursive: true, force: true })
    temporaryDirectory = undefined
  })

  it('migrates a fresh database and round-trips the v5 scenario and BDC relations', async () => {
    database = await openProjectDatabase(':memory:')
    const persistence = new SqliteProjectPersistence(database)
    const router = createElceApiRouter(persistence)
    const document = createRelationalFixture()

    const created = await router.fetch(jsonRequest('POST', '/api/projects', document.toJSON()))
    expect(created.status).toBe(201)
    expect(created.headers.get('ETag')).toBe('"0"')

    const opened = await router.fetch(new Request(`http://elce.test/api/projects/${document.id}`))
    expect(opened.status).toBe(200)
    const body = await opened.json() as { document: ReturnType<ElceDocumentClass['toJSON']> }
    const restored = ElceDocument.fromJSON(body.document)

    expect(restored.data.scenarioEntries).toEqual(document.data.scenarioEntries)
    expect(restored.chapters.toSorted(compareById)).toEqual(document.chapters.toSorted(compareById))
    expect(restored.pages.toSorted(compareById)).toEqual(document.pages.toSorted(compareById))
    expect(restored.catalogPageIds).toEqual(document.catalogPageIds)
    expect(restored.data.catalogBdcIds).toEqual(document.data.catalogBdcIds)
    expect(restored.medias).toEqual(document.medias)
    expect(restored.bdcs.toSorted(compareById)).toEqual(document.bdcs.toSorted(compareById))
    expect(restored.data.revelationDefaults).toEqual(document.data.revelationDefaults)
    expect(restored.data.summary).toEqual(document.data.summary)
    expect(restored.data.profile).toEqual(document.data.profile)
    assertDocumentInvariants(restored)
  })

  it('adds the default page continuation mode without overwriting an existing choice', async () => {
    database = createSqliteDatabase({ filename: ':memory:', foreignKeys: true })
    const migrations = await loadMigrations(fileURLToPath(new URL('./migrations/', import.meta.url)))
    await database.migrate(migrations, { to: '20261014100000_add_summary_profile_test_state' })

    await database.exec(rawSql(
      `INSERT INTO projects (
        project_id, name, format_version, revision, created_at, updated_at,
        default_intro_transition_ref, default_outro_transition_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['project-summary-default', 'Sommaire par défaut', 5, 0, '2026-10-15', '2026-10-15', 'fade', 'fade'],
    ))
    await database.exec(rawSql(
      `INSERT INTO projects (
        project_id, name, format_version, revision, created_at, updated_at,
        default_intro_transition_ref, default_outro_transition_ref, summary_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['project-summary-free', 'Sommaire libre', 5, 0, '2026-10-15', '2026-10-15', 'fade', 'fade',
        JSON.stringify({ title: 'Libre', pageContinuationMode: 'free' })],
    ))

    await database.migrate(migrations)

    const rows = await database.exec(rawSql(
      'SELECT project_id, summary_json FROM projects ORDER BY project_id',
    ))
    const summaries = new Map(rows.rows?.map((row) => [
      String(row.project_id), JSON.parse(String(row.summary_json)) as Record<string, unknown>,
    ]))
    expect(summaries.get('project-summary-default')).toMatchObject({ pageContinuationMode: 'endpage' })
    expect(summaries.get('project-summary-free')).toMatchObject({ title: 'Libre', pageContinuationMode: 'free' })
  })

  it('persists test state separately and rejects a stale state revision', async () => {
    database = await openProjectDatabase(':memory:')
    const persistence = new SqliteProjectPersistence(database)
    const document = createDocumentWithId('project-preview-state')
    await persistence.createProject(document)

    expect(await persistence.readTestState(document.id)).toEqual({ state: INITIAL_PROJECT_TEST_STATE, revision: 0 })
    const state: ProjectTestState = { ...INITIAL_PROJECT_TEST_STATE, profileValues: { name: 'Ada' } }
    expect(await persistence.saveTestState(document.id, 0, state)).toEqual({
      kind: 'saved', value: { state, revision: 1 },
    })
    expect(await persistence.saveTestState(document.id, 0, INITIAL_PROJECT_TEST_STATE)).toEqual({ kind: 'revision-mismatch' })
    expect(await persistence.findProject(document.id)).toMatchObject({ project: { revision: 0 } })
    expect(await persistence.readTestState(document.id)).toEqual({ state, revision: 1 })
  })

  it('migrates relational Graph rows to JSON and back without changing Question/Réponses', async () => {
    database = createSqliteDatabase({ filename: ':memory:', foreignKeys: true })
    const migrations = await loadMigrations(fileURLToPath(new URL('./migrations/', import.meta.url)))
    await database.migrate(migrations, { to: '20261013110000_add-statistical-graph-transposition' })
    const projectId = 'project-graph-json-migration'
    await database.exec(rawSql(
      `INSERT INTO projects (
        project_id, name, format_version, revision, created_at, updated_at,
        default_intro_transition_ref, default_outro_transition_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'Migration Graphe', 5, 0, '2026-10-14', '2026-10-14', 'fade', 'fade'],
    ))
    await database.exec(rawSql(
      `INSERT INTO content_blocks (project_id, content_block_id, content_block_type, preset_id)
       VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
      [projectId, 'bdc-graph', BDC_TYPE.STATISTICAL_GRAPH, DEFAULT_PRESET_ID.STATISTICAL_GRAPH_ABOVE_TEXT,
        projectId, 'bdc-question', BDC_TYPE.QUESTION, DEFAULT_PRESET_ID.QUESTION],
    ))
    await database.exec(rawSql(
      `INSERT INTO statistical_graphs (
        project_id, content_block_id, rendering, overline, title,
        category_axis_label, series_axis_label, editorial_text, pie_series_id, pie_category_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'bdc-graph', STATISTICAL_GRAPH_RENDERING.PIE, '2026', 'Population',
        'Région', 'Habitants', 'Source locale', 'series-1', null],
    ))
    await database.exec(rawSql(
      `INSERT INTO graph_categories (project_id, graph_content_block_id, category_id, position, label)
       VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
      [projectId, 'bdc-graph', 'category-1', 0, 'Nord',
        projectId, 'bdc-graph', 'category-2', 1, 'Sud'],
    ))
    await database.exec(rawSql(
      `INSERT INTO graph_series (project_id, graph_content_block_id, series_id, position, label)
       VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
      [projectId, 'bdc-graph', 'series-1', 0, 'Population',
        projectId, 'bdc-graph', 'series-2', 1, 'Surface'],
    ))
    await database.exec(rawSql(
      `INSERT INTO graph_values (project_id, graph_content_block_id, category_id, series_id, value)
       VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
      [projectId, 'bdc-graph', 'category-1', 'series-1', 1250.5,
        projectId, 'bdc-graph', 'category-2', 'series-2', 0],
    ))
    await database.exec(rawSql(
      `INSERT INTO questions (project_id, content_block_id, media_id, question_type, title, prompt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [projectId, 'bdc-question', null, 'multiple-choice', 'Question', 'Choisir une réponse'],
    ))
    await database.exec(rawSql(
      `INSERT INTO question_answers (
        project_id, question_content_block_id, answer_id, position, label, is_correct
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [projectId, 'bdc-question', 'answer-1', 0, 'Réponse', 1],
    ))
    const questionRowsBefore = await database.exec(rawSql(
      'SELECT * FROM questions WHERE project_id = ?', [projectId],
    ))
    const answerRowsBefore = await database.exec(rawSql(
      'SELECT * FROM question_answers WHERE project_id = ?', [projectId],
    ))
    await database.migrate(migrations)

    const graphRows = await database.exec(rawSql(
      'SELECT content_json FROM statistical_graphs WHERE project_id = ? AND content_block_id = ?',
      [projectId, 'bdc-graph'],
    ))
    const graphJson = graphRows.rows?.[0]?.content_json
    expect(typeof graphJson).toBe('string')
    expect(JSON.parse(String(graphJson))).toEqual({
      rendering: STATISTICAL_GRAPH_RENDERING.PIE,
      transposeEnabled: true,
      columnLabelsEnabled: true,
      rowLabelsEnabled: true,
      overline: '2026',
      title: 'Population',
      categoryAxisLabel: 'Région',
      seriesAxisLabel: 'Habitants',
      editorialText: 'Source locale',
      pieSeriesId: 'series-1',
      pieCategoryId: 'category-1',
      categories: [
        { id: 'category-1', label: 'Nord' },
        { id: 'category-2', label: 'Sud' },
      ],
      series: [
        { id: 'series-1', label: 'Population' },
        { id: 'series-2', label: 'Surface' },
      ],
      values: [
        { categoryId: 'category-1', seriesId: 'series-1', value: 1250.5 },
        { categoryId: 'category-2', seriesId: 'series-2', value: 0 },
      ],
    })

    const detailTables = await database.exec(rawSql(
      `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name IN ('graph_categories', 'graph_series', 'graph_values') ORDER BY name`,
    ))
    expect(detailTables.rows).toEqual([])

    expect((await database.exec(rawSql('SELECT * FROM questions WHERE project_id = ?', [projectId]))).rows)
      .toEqual(questionRowsBefore.rows)
    expect((await database.exec(rawSql('SELECT * FROM question_answers WHERE project_id = ?', [projectId]))).rows)
      .toEqual(answerRowsBefore.rows)

    await database.migrate(migrations, { direction: 'down', step: 3 })
    const relationalValues = await database.exec(rawSql(
      'SELECT category_id, series_id, value FROM graph_values WHERE project_id = ? ORDER BY category_id',
      [projectId],
    ))
    expect(relationalValues.rows).toEqual([
      { category_id: 'category-1', series_id: 'series-1', value: 1250.5 },
      { category_id: 'category-2', series_id: 'series-2', value: 0 },
    ])
  })

  it('preserves server media metadata and rejects stale document revisions atomically', async () => {
    database = await openProjectDatabase(':memory:')
    const persistence = new SqliteProjectPersistence(database)
    const router = createElceApiRouter(persistence)
    const original = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-1', name: 'image.webp', mimeType: 'image/webp', size: 20, caption: '' },
    })
    const created = await router.fetch(jsonRequest('POST', '/api/projects', original.toJSON()))
    expect(created.status).toBe(201)
    const grant = await reserve(router, original.id)

    await database.exec(rawSql(
      'UPDATE media_resources SET storage_key = ?, content_sha256 = ? WHERE project_id = ? AND media_id = ?',
      ['image-1.webp', 'a'.repeat(64), original.id, 'media-1'],
    ))

    const renamed = applyDocumentCommand(original, { type: 'document.rename', name: 'Nom modifié' })
    const saved = await router.fetch(jsonRequest(
      'PUT', `/api/projects/${original.id}/document`, renamed.toJSON(), { 'If-Match': '"0"', ...grant },
    ))
    expect(saved.status).toBe(200)
    expect(saved.headers.get('ETag')).toBe('"1"')

    const stale = await router.fetch(jsonRequest(
      'PUT', `/api/projects/${original.id}/document`, original.toJSON(), { 'If-Match': '"0"', ...grant },
    ))
    expect(stale.status).toBe(412)

    const opened = await persistence.findProject(original.id)
    expect(opened?.document.data.name).toBe('Nom modifié')
    const mediaRows = await database.exec(rawSql(
      'SELECT storage_key, content_sha256 FROM media_resources WHERE project_id = ?',
      [original.id],
    ))
    expect(mediaRows.rows).toEqual([{ storage_key: 'image-1.webp', content_sha256: 'a'.repeat(64) }])
  })

  it('excludes another page and rejects an old grant after release and reacquisition', async () => {
    database = await openProjectDatabase(':memory:')
    const router = createElceApiRouter(new SqliteProjectPersistence(database))
    const document = createDocumentWithId('project-exclusive')
    await router.fetch(jsonRequest('POST', '/api/projects', document.toJSON()))
    const first = await router.fetch(jsonRequest('POST', '/api/projects/project-exclusive/edit-access', { pageId: 'page-a' }))
    const firstGrant = (await first.json() as { grantId: string }).grantId
    const occupied = await router.fetch(jsonRequest('POST', '/api/projects/project-exclusive/edit-access', { pageId: 'page-b' }))
    expect(occupied.status).toBe(409)
    const firstHeaders = { 'X-Elce-Page-Id': 'page-a', 'X-Elce-Edit-Grant': firstGrant }
    const released = await router.fetch(new Request('http://elce.test/api/projects/project-exclusive/edit-access', {
      method: 'DELETE', headers: firstHeaders,
    }))
    expect(released.status).toBe(204)
    const second = await router.fetch(jsonRequest('POST', '/api/projects/project-exclusive/edit-access', { pageId: 'page-b' }))
    const secondGrant = (await second.json() as { grantId: string }).grantId
    expect(secondGrant).not.toBe(firstGrant)
    const stale = await router.fetch(jsonRequest('PUT', '/api/projects/project-exclusive/document', document.toJSON(), {
      'If-Match': '"0"', ...firstHeaders,
    }))
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ error: 'edit_access_lost' })
    const current = await router.fetch(jsonRequest('PUT', '/api/projects/project-exclusive/document', document.toJSON(), {
      'If-Match': '"0"', 'X-Elce-Page-Id': 'page-b', 'X-Elce-Edit-Grant': secondGrant,
    }))
    expect(current.status).toBe(200)
  })

  it('renews a live lease and lets another page recover it after expiry', async () => {
    database = await openProjectDatabase(':memory:')
    const router = createElceApiRouter(new SqliteProjectPersistence(database))
    const document = createDocumentWithId('project-expired-edit-lease')
    await router.fetch(jsonRequest('POST', '/api/projects', document.toJSON()))
    const first = await router.fetch(jsonRequest('POST', `/api/projects/${document.id}/edit-access`, { pageId: 'page-a' }))
    const firstGrant = (await first.json() as { grantId: string }).grantId
    const firstHeaders = { 'X-Elce-Page-Id': 'page-a', 'X-Elce-Edit-Grant': firstGrant }

    const renewed = await router.fetch(new Request(`http://elce.test/api/projects/${document.id}/edit-access`, {
      method: 'PUT', headers: firstHeaders,
    }))
    expect(renewed.status).toBe(204)

    await database.exec(rawSql(
      'UPDATE projects SET edit_lease_expires_at = ? WHERE project_id = ?', [Date.now() - 1, document.id],
    ))
    const lateRenewal = await router.fetch(new Request(`http://elce.test/api/projects/${document.id}/edit-access`, {
      method: 'PUT', headers: firstHeaders,
    }))
    expect(lateRenewal.status).toBe(409)

    const recovered = await router.fetch(jsonRequest('POST', `/api/projects/${document.id}/edit-access`, { pageId: 'page-b' }))
    expect(recovered.status).toBe(200)
    const body = await recovered.json() as { grantId: string; recovered: boolean }
    expect(body.recovered).toBe(true)
    expect(body.grantId).not.toBe(firstGrant)

    const staleWrite = await router.fetch(jsonRequest(
      'PUT', `/api/projects/${document.id}/document`, document.toJSON(), { 'If-Match': '"0"', ...firstHeaders },
    ))
    expect(staleWrite.status).toBe(409)
  })

  it('lets the temporary force control replace a live grant and rejects its old writes', async () => {
    database = await openProjectDatabase(':memory:')
    const router = createElceApiRouter(new SqliteProjectPersistence(database))
    const document = createDocumentWithId('project-forced-edit-recovery')
    await router.fetch(jsonRequest('POST', '/api/projects', document.toJSON()))
    const first = await router.fetch(jsonRequest('POST', `/api/projects/${document.id}/edit-access`, { pageId: 'page-a' }))
    const firstGrant = (await first.json() as { grantId: string }).grantId
    const firstHeaders = { 'X-Elce-Page-Id': 'page-a', 'X-Elce-Edit-Grant': firstGrant }

    const forced = await router.fetch(jsonRequest(
      'POST', `/api/projects/${document.id}/edit-access`, { pageId: 'page-b', force: true },
    ))
    expect(forced.status).toBe(200)
    const body = await forced.json() as { grantId: string; recovered: boolean }
    expect(body.recovered).toBe(true)
    expect(body.grantId).not.toBe(firstGrant)

    const staleWrite = await router.fetch(jsonRequest(
      'PUT', `/api/projects/${document.id}/document`, document.toJSON(), { 'If-Match': '"0"', ...firstHeaders },
    ))
    expect(staleWrite.status).toBe(409)
    expect(await staleWrite.json()).toEqual({ error: 'edit_access_lost' })
  })

  it('returns the same grant when an acquisition response is lost after commit', async () => {
    database = await openProjectDatabase(':memory:')
    const router = createElceApiRouter(new SqliteProjectPersistence(database))
    const document = createDocumentWithId('project-lost-acquisition')
    await router.fetch(jsonRequest('POST', '/api/projects', document.toJSON()))

    let committedGrant: string | null = null
    let loseResponse = true
    const request = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const response = await router.fetch(new Request(input, init))
      if (loseResponse && init?.method === 'POST' && new URL(input.toString()).pathname.endsWith('/edit-access')) {
        loseResponse = false
        committedGrant = (await response.json() as { grantId: string }).grantId
        throw new TypeError('Acquisition response lost after commit')
      }
      return response
    }
    const client = new ElceProjectApiClient('http://elce.test', request)
    await expect(client.acquireEditAccess(document.id, 'page-a')).rejects.toThrow('response lost')
    expect((await client.acquireEditAccess(document.id, 'page-a'))?.grantId).toBe(committedGrant)

    const otherPage = await router.fetch(jsonRequest('POST', `/api/projects/${document.id}/edit-access`, { pageId: 'page-b' }))
    expect(otherPage.status).toBe(409)
  })

  it('rejects a late media publication from a grant released during its upload', async () => {
    database = await openProjectDatabase(':memory:')
    const persistence = new SqliteProjectPersistence(database)
    const router = createElceApiRouter(persistence)
    const document = applyDocumentCommand(createDocumentWithId('project-late-media'), {
      type: 'media.add', media: { id: 'media-late', name: 'photo.webp', mimeType: 'image/webp', size: 3, caption: '' },
    })
    await router.fetch(jsonRequest('POST', '/api/projects', document.toJSON()))
    const headers = await reserve(router, document.id)
    const released = await router.fetch(new Request(`http://elce.test/api/projects/${document.id}/edit-access`, {
      method: 'DELETE', headers,
    }))
    expect(released.status).toBe(204)
    const result = await persistence.storeMediaFile(document.id, 'media-late', 3, 'unpublished-key', 'a'.repeat(64), {
      pageId: headers['X-Elce-Page-Id'], grantId: headers['X-Elce-Edit-Grant'],
    })
    expect(result).toEqual({ kind: 'edit-access-lost' })
    expect((await persistence.findMediaFile(document.id, 'media-late'))?.storageKey).toBeNull()
  })

  it('streams media through SQLite and Remix FileStorage, including native byte ranges', async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'elce-media-'))
    const databaseFile = join(temporaryDirectory, 'projects.sqlite')
    const mediaDirectory = join(temporaryDirectory, 'files')
    const temporaryUploadDirectory = `${mediaDirectory}.incoming`
    const staleTemporaryFile = join(temporaryUploadDirectory, 'interrupted-upload')
    await mkdir(temporaryUploadDirectory, { recursive: true })
    await writeFile(staleTemporaryFile, 'interrupted')
    const staleKey = 'media/project-interrupted/media-old/hash/upload-old'
    await createMediaFileStorage(mediaDirectory).put(
      staleKey,
      new File([new Uint8Array([1])], 'orphan.webp', { type: 'image/webp' }),
    )
    const api = await createElceHttpServer({
      databaseFile,
      mediaDirectory,
    })
    expect(await createMediaFileStorage(mediaDirectory).has(staleKey)).toBe(false)
    await expect(access(staleTemporaryFile)).rejects.toThrow()
    const { server } = api
    const imageBytes = new TextEncoder().encode('elce-image-content')
    const videoBytes = new TextEncoder().encode('elce-video-content')
    let document = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-upload-image', name: 'picture.webp', mimeType: 'image/webp', size: imageBytes.byteLength, caption: '' },
    })
    document = applyDocumentCommand(document, {
      type: 'media.add',
      media: { id: 'media-upload-video', name: 'sample.mp4', mimeType: 'video/mp4', size: videoBytes.byteLength, caption: '' },
    })
    document = applyDocumentCommand(document, {
      type: 'media.add',
      media: { id: 'media-upload-image-duplicate', name: 'other-picture.webp', mimeType: 'image/webp', size: imageBytes.byteLength, caption: '' },
    })

    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => {
          server.off('error', reject)
          resolve()
        })
      })
      const address = server.address() as AddressInfo
      const origin = `http://127.0.0.1:${address.port}`

      const preflight = await fetch(`${origin}/api/projects`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5175',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      })
      expect(preflight.status).toBe(204)
      expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5175')
      expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type')
      const rejectedOrigin = await fetch(`${origin}/api/projects`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'POST' },
      })
      expect(rejectedOrigin.status).toBe(403)

      const projectResponse = await fetch(`${origin}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(document.toJSON()),
      })
      expect(projectResponse.status).toBe(201)
      const accessResponse = await fetch(`${origin}/api/projects/${document.id}/edit-access`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId: 'test-page' }),
      })
      const access = await accessResponse.json() as { grantId: string }
      const grant = { 'X-Elce-Page-Id': 'test-page', 'X-Elce-Edit-Grant': access.grantId }

      const imageUrl = `${origin}/api/projects/${document.id}/media/media-upload-image`
      const oversizedUpload = await fetch(imageUrl, {
        method: 'PUT',
        headers: grant,
        body: new Blob([imageBytes, new Uint8Array([0])], { type: 'image/webp' }),
      })
      expect(oversizedUpload.status).toBe(400)

      const uploadedImage = await fetch(imageUrl, {
        method: 'PUT',
        headers: grant,
        body: new Blob([imageBytes], { type: 'image/webp' }),
      })
      expect(uploadedImage.status).toBe(201)
      expect(await uploadedImage.json()).toEqual({
        media: { id: 'media-upload-image', url: `/api/projects/${document.id}/media/media-upload-image` },
      })

      const fullFile = await fetch(imageUrl)
      expect(fullFile.status).toBe(200)
      expect(fullFile.headers.get('Content-Type')).toBe('image/webp')
      expect(fullFile.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
      expect(new Uint8Array(await fullFile.arrayBuffer())).toEqual(imageBytes)

      const videoUrl = `${origin}/api/projects/${document.id}/media/media-upload-video`
      const uploadedVideo = await fetch(videoUrl, {
        method: 'PUT',
        headers: grant,
        body: new Blob([videoBytes], { type: 'video/mp4' }),
      })
      expect(uploadedVideo.status).toBe(201)

      const partialFile = await fetch(videoUrl, { headers: { Range: 'bytes=2-6' } })
      expect(partialFile.status).toBe(206)
      expect(partialFile.headers.get('Content-Range')).toBe(`bytes 2-6/${videoBytes.byteLength}`)
      expect(new Uint8Array(await partialFile.arrayBuffer())).toEqual(videoBytes.slice(2, 7))

      const repeatedUpload = await fetch(imageUrl, {
        method: 'PUT',
        headers: grant,
        body: new Blob([imageBytes], { type: 'image/webp' }),
      })
      expect(repeatedUpload.status).toBe(204)

      const duplicateImageUrl = `${origin}/api/projects/${document.id}/media/media-upload-image-duplicate`
      const duplicateImageBytes = new TextEncoder().encode('elce-other-content')
      const uploadedDuplicateImage = await fetch(duplicateImageUrl, {
        method: 'PUT',
        headers: grant,
        body: new Blob([duplicateImageBytes], { type: 'image/webp' }),
      })
      expect(uploadedDuplicateImage.status).toBe(201)

      document = applyDocumentCommand(document, {
        type: 'media.merge',
        canonicalMediaId: 'media-upload-image',
        duplicateMediaIds: ['media-upload-image-duplicate'],
      })
      const mergedDocument = await fetch(`${origin}/api/projects/${document.id}/document`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'If-Match': '"0"', ...grant },
        body: JSON.stringify(document.toJSON()),
      })
      expect(mergedDocument.status).toBe(200)
      const removedDuplicateFile = await fetch(duplicateImageUrl)
      expect(removedDuplicateFile.status).toBe(404)

      const deletedProject = await fetch(`${origin}/api/projects/${document.id}`, { method: 'DELETE', headers: grant })
      expect(deletedProject.status).toBe(204)
    } finally {
      await api.close()
    }

    const remainingFiles = await createMediaFileStorage(mediaDirectory).list({ prefix: 'media/' })
    expect(remainingFiles.files).toEqual([])
  })

  it('rejects an upload whose bytes would duplicate a different media resource', async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'elce-media-duplicate-'))
    database = await openProjectDatabase(':memory:')
    const persistence = new SqliteProjectPersistence(database)
    const fileStorage = createMediaFileStorage(join(temporaryDirectory, 'files'))
    const router = createElceApiRouter(persistence, new MediaApiController(
      persistence,
      fileStorage,
      join(temporaryDirectory, 'incoming'),
    ))
    const bytes = new TextEncoder().encode('shared-image')
    let document = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-canonical', name: 'one.webp', mimeType: 'image/webp', size: bytes.byteLength, caption: '' },
    })
    document = applyDocumentCommand(document, {
      type: 'media.add',
      media: { id: 'media-duplicate', name: 'two.webp', mimeType: 'image/webp', size: bytes.byteLength, caption: '' },
    })
    await router.fetch(jsonRequest('POST', '/api/projects', document.toJSON()))
    const grant = await reserve(router, document.id)

    const canonical = await router.fetch(new Request(
      `http://elce.test/api/projects/${document.id}/media/media-canonical`,
      { method: 'PUT', headers: grant, body: new Blob([bytes], { type: 'image/webp' }) },
    ))
    const duplicate = await router.fetch(new Request(
      `http://elce.test/api/projects/${document.id}/media/media-duplicate`,
      { method: 'PUT', headers: grant, body: new Blob([bytes], { type: 'image/webp' }) },
    ))

    expect(canonical.status).toBe(201)
    expect(duplicate.status).toBe(409)
    expect(await duplicate.json()).toEqual({ error: 'media_already_exists', mediaId: 'media-canonical' })
    expect((await persistence.findMediaFile(document.id, 'media-duplicate'))?.storageKey).toBeNull()
  })

  it('lists, renames, and deletes projects through their SQLite-backed routes', async () => {
    database = await openProjectDatabase(':memory:')
    const router = createElceApiRouter(new SqliteProjectPersistence(database))
    const first = createDocumentWithId('project-first')
    const second = createDocumentWithId('project-second')
    await router.fetch(jsonRequest('POST', '/api/projects', first.toJSON()))
    await router.fetch(jsonRequest('POST', '/api/projects', second.toJSON()))
    const firstGrant = await reserve(router, first.id)
    const secondGrant = await reserve(router, second.id)

    const listed = await router.fetch(new Request('http://elce.test/api/projects'))
    expect(listed.status).toBe(200)
    expect(await listed.json()).toMatchObject({
      projects: expect.arrayContaining([
        { id: 'project-first', name: first.data.name, revision: 0 },
        { id: 'project-second', name: second.data.name, revision: 0 },
      ]),
    })

    const renamed = await router.fetch(jsonRequest('PATCH', '/api/projects/project-first', { name: 'Projet renommé' }, firstGrant))
    expect(renamed.status).toBe(200)
    expect(renamed.headers.get('ETag')).toBe('"1"')

    const deleted = await router.fetch(new Request('http://elce.test/api/projects/project-second', { method: 'DELETE', headers: secondGrant }))
    expect(deleted.status).toBe(204)
    const missing = await router.fetch(new Request('http://elce.test/api/projects/project-second'))
    expect(missing.status).toBe(404)
  })

  it('keeps a project readable after closing and reopening the migrated SQLite file', async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'elce-sqlite-'))
    const filename = join(temporaryDirectory, 'projects.sqlite')
    database = await openProjectDatabase(filename)
    const document = createRelationalFixture()
    const router = createElceApiRouter(new SqliteProjectPersistence(database))
    const created = await router
      .fetch(jsonRequest('POST', '/api/projects', document.toJSON()))
    expect(created.status).toBe(201)
    const second = createDocumentWithId('project-persistent-second')
    const secondCreated = await router.fetch(jsonRequest('POST', '/api/projects', second.toJSON()))
    expect(secondCreated.status).toBe(201)
    const heldGrant = await reserve(router, document.id)

    await database.close()
    database = undefined
    database = await openProjectDatabase(filename)

    const reopenedRouter = createElceApiRouter(new SqliteProjectPersistence(database))
    const occupiedAfterRestart = await reopenedRouter.fetch(jsonRequest('POST', `/api/projects/${document.id}/edit-access`, { pageId: 'other-page' }))
    expect(occupiedAfterRestart.status).toBe(409)
    const stillHeld = await reopenedRouter.fetch(new Request(`http://elce.test/api/projects/${document.id}/edit-access`, { headers: heldGrant }))
    expect(await stillHeld.json()).toEqual({ held: true })
    const reopenedList = await reopenedRouter.fetch(new Request('http://elce.test/api/projects'))
    expect(await reopenedList.json()).toMatchObject({
      projects: expect.arrayContaining([
        { id: document.id, name: document.data.name, revision: 0 },
        { id: second.id, name: second.data.name, revision: 0 },
      ]),
    })

    const reopened = await reopenedRouter
      .fetch(new Request(`http://elce.test/api/projects/${document.id}`))
    expect(reopened.status).toBe(200)
    const body = await reopened.json() as { document: ReturnType<ElceDocumentClass['toJSON']> }
    const restored = ElceDocument.fromJSON(body.document)
    expect(restored.data.scenarioEntries).toEqual(document.data.scenarioEntries)
    expect(restored.bdcs.toSorted(compareById)).toEqual(document.bdcs.toSorted(compareById))
    expect(restored.medias).toEqual(document.medias)
  })
})

/** Returns a valid initial document with a stable identifier for API assertions. */
function createDocumentWithId(id: string): ElceDocumentClass {
  return ElceDocument.fromJSON({ ...createInitialDocument().toJSON(), id })
}

/** Reserves the exact project grant used by a SQLite route fixture. */
async function reserve(router: ReturnType<typeof createElceApiRouter>, projectId: string): Promise<Record<string, string>> {
  const response = await router.fetch(jsonRequest('POST', `/api/projects/${projectId}/edit-access`, { pageId: 'test-page' }))
  const body = await response.json() as { grantId: string }
  return { 'X-Elce-Page-Id': 'test-page', 'X-Elce-Edit-Grant': body.grantId }
}

/** Builds a v5 fixture that exercises independent ordering and nested placements. */
function createRelationalFixture(): ElceDocumentClass {
  let document = createInitialDocument()
  document = applyDocumentCommand(document, {
    type: 'chapter.create',
    chapterId: 'chapter-evaluation',
    name: 'Évaluation',
    chapterType: CHAPTER_TYPE.EVALUATION,
  })
  document = applyDocumentCommand(document, {
    type: 'chapter.evaluation.settings.update',
    chapterId: 'chapter-evaluation',
    attemptLimit: 3,
    retryScope: EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS,
  })
  document = applyDocumentCommand(document, {
    type: 'page.create',
    pageId: 'page-quiz',
    bdcId: 'bdc-question',
    defaultBdcType: BDC_TYPE.QUESTION,
    placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-evaluation' },
  })
  document = applyDocumentCommand(document, {
    type: 'bdc.create',
    bdcId: 'bdc-result',
    bdcType: BDC_TYPE.EVALUATION_RESULT,
    presetId: DEFAULT_PRESET_ID.EVALUATION_RESULT,
    placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-quiz' },
  })
  document = applyDocumentCommand(document, {
    type: 'bdc.evaluation-result.update',
    bdcId: 'bdc-result',
    evaluationResult: {
      success: { message: 'Bravo', action: EVALUATION_RESULT_ACTION.REPLAY },
      failure: { message: 'À reprendre', action: EVALUATION_RESULT_ACTION.RETRY },
    },
  })
  document = applyDocumentCommand(document, {
    type: 'page.create',
    pageId: 'page-diapo',
    bdcId: 'bdc-carousel',
    initialCardBdcId: 'bdc-card-photo',
    pageType: PAGE_TYPE.DIAPO,
    placement: { kind: PAGE_LOCATION.SCENARIO, index: 1 },
  })
  document = applyDocumentCommand(document, {
    type: 'page.create',
    pageId: 'page-catalog',
    bdcId: 'bdc-catalog-section',
    placement: { kind: PAGE_LOCATION.CATALOG },
  })
  document = applyDocumentCommand(document, {
    type: 'media.add',
    media: { id: 'media-image', name: 'photo.webp', mimeType: 'image/webp', size: 123, caption: '' },
  })
  document = applyDocumentCommand(document, {
    type: 'media.add',
    media: { id: 'media-video', name: 'clip.mp4', mimeType: 'video/mp4', size: 456, caption: 'Voix' },
  })
  document = applyDocumentCommand(document, {
    type: 'bdc.card.layout.set',
    bdcId: 'bdc-card-photo',
    layoutId: DEFAULT_PRESET_ID.PHOTO,
  })
  document = applyDocumentCommand(document, {
    type: 'bdc.card.media.set',
    bdcId: 'bdc-card-photo',
    mediaId: 'media-image',
  })
  document = applyDocumentCommand(document, {
    type: 'bdc.create',
    bdcId: 'bdc-card-message',
    bdcType: BDC_TYPE.CARD,
    presetId: DEFAULT_PRESET_ID.TEXT_IMAGE,
    placement: { kind: BDC_LOCATION.PARENT, parentBdcId: 'bdc-carousel' },
  })
  document = applyDocumentCommand(document, {
    type: 'bdc.card.media.set',
    bdcId: 'bdc-card-message',
    mediaId: 'media-image',
  })
  document = applyDocumentCommand(document, createStatisticalGraphCarouselBdcCommand(
    'bdc-statistical-graph',
    'bdc-carousel',
    2,
  ))
  const graphContent = document.bdcs.find((bdc) => bdc.id === 'bdc-statistical-graph')?.statisticalGraph
  if (graphContent == null) throw new Error('Le BDC Graphe de test doit avoir son contenu par défaut.')
  document = applyDocumentCommand(document, {
    type: 'bdc.statistical-graph.update',
    bdcId: 'bdc-statistical-graph',
    statisticalGraph: {
      ...graphContent,
      rendering: STATISTICAL_GRAPH_RENDERING.LINE,
      columnLabelsEnabled: false,
      rowLabelsEnabled: true,
      overline: '2026',
      title: 'Population',
      editorialText: 'Source locale',
      categories: [{ ...graphContent.categories[0]!, label: 'Nord' }],
      series: [{ ...graphContent.series[0]!, label: 'Habitants' }],
      values: [{
        categoryId: graphContent.categories[0]!.id,
        seriesId: graphContent.series[0]!.id,
        value: 1250.5,
      }],
    },
  })
  document = applyDocumentCommand(document, {
    type: 'bdc.question.media.set',
    bdcId: 'bdc-question',
    mediaId: 'media-video',
  })
  const carousel = document.bdcs.find((bdc) => bdc.id === 'bdc-carousel')!.carousel!
  document = applyDocumentCommand(document, {
    type: 'bdc.carousel.update',
    bdcId: 'bdc-carousel',
    carousel: {
      ...carousel,
      revelation: { intro: CAROUSEL_TRANSITION.FADE, outro: CAROUSEL_TRANSITION.SWIPE_RIGHT },
      cards: carousel.cards.map((entry, index) => index === 0
        ? {
          ...entry,
          durationMs: 2500,
          introTransitionRef: CAROUSEL_TRANSITION.SWIPE_LEFT,
          outroTransitionRef: CAROUSEL_TRANSITION.FADE,
        }
        : entry),
    },
  })
  document = applyDocumentCommand(document, {
    type: 'bdc.section.revelation.update',
    bdcId: 'bdc-section-1',
    revelation: { intro: CAROUSEL_TRANSITION.ZOOM, outro: null },
  })
  document = applyDocumentCommand(document, {
    type: 'document.revelation.update',
    revelationDefaults: { intro: CAROUSEL_TRANSITION.FADE, outro: CAROUSEL_TRANSITION.SWIPE_RIGHT },
  })

  assertDocumentInvariants(document)
  return document
}

/** Compares entity arrays by stable identity rather than incidental storage order. */
function compareById(left: { readonly id: string }, right: { readonly id: string }): number {
  return left.id.localeCompare(right.id)
}

/** Creates an HTTP request carrying a JSON API body. */
function jsonRequest(method: string, path: string, body: unknown, headers: HeadersInit = {}): Request {
  return new Request(`http://elce.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}
