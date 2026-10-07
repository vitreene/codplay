import { afterEach, describe, expect, it } from 'vitest'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rawSql } from 'remix/data-table'
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
} from '../../../config/document-config'
import { applyDocumentCommand, assertDocumentInvariants } from '../../../domain/commands/document-commands'
import { createInitialDocument, ElceDocument } from '../../../domain/document/document-model'
import type { ElceDocument as ElceDocumentClass } from '../../../domain/document/document-model'
import { createElceApiRouter } from '../../api-router'
import { createElceHttpServer } from '../../elce-http-server'
import { MediaApiController } from '../../media/media-api-controller'
import { createMediaFileStorage } from '../../media/media-file-storage'
import { openProjectDatabase } from './project-database'
import { SqliteProjectPersistence } from './sqlite-project-persistence'
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

  it('migrates a fresh database and round-trips the v4 scenario and BDC relations', async () => {
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
    assertDocumentInvariants(restored)
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

    await database.exec(rawSql(
      'UPDATE media_resources SET storage_key = ?, content_sha256 = ? WHERE project_id = ? AND media_id = ?',
      ['image-1.webp', 'a'.repeat(64), original.id, 'media-1'],
    ))

    const renamed = applyDocumentCommand(original, { type: 'document.rename', name: 'Nom modifié' })
    const saved = await router.fetch(jsonRequest(
      'PUT', `/api/projects/${original.id}/document`, renamed.toJSON(), { 'If-Match': '"0"' },
    ))
    expect(saved.status).toBe(200)
    expect(saved.headers.get('ETag')).toBe('"1"')

    const stale = await router.fetch(jsonRequest(
      'PUT', `/api/projects/${original.id}/document`, original.toJSON(), { 'If-Match': '"0"' },
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

      const projectResponse = await fetch(`${origin}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(document.toJSON()),
      })
      expect(projectResponse.status).toBe(201)

      const imageUrl = `${origin}/api/projects/${document.id}/media/media-upload-image`
      const oversizedUpload = await fetch(imageUrl, {
        method: 'PUT',
        body: new Blob([imageBytes, new Uint8Array([0])], { type: 'image/webp' }),
      })
      expect(oversizedUpload.status).toBe(400)

      const uploadedImage = await fetch(imageUrl, {
        method: 'PUT',
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
        body: new Blob([videoBytes], { type: 'video/mp4' }),
      })
      expect(uploadedVideo.status).toBe(201)

      const partialFile = await fetch(videoUrl, { headers: { Range: 'bytes=2-6' } })
      expect(partialFile.status).toBe(206)
      expect(partialFile.headers.get('Content-Range')).toBe(`bytes 2-6/${videoBytes.byteLength}`)
      expect(new Uint8Array(await partialFile.arrayBuffer())).toEqual(videoBytes.slice(2, 7))

      const repeatedUpload = await fetch(imageUrl, {
        method: 'PUT',
        body: new Blob([imageBytes], { type: 'image/webp' }),
      })
      expect(repeatedUpload.status).toBe(204)

      const duplicateImageUrl = `${origin}/api/projects/${document.id}/media/media-upload-image-duplicate`
      const duplicateImageBytes = new TextEncoder().encode('elce-other-content')
      const uploadedDuplicateImage = await fetch(duplicateImageUrl, {
        method: 'PUT',
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
        headers: { 'Content-Type': 'application/json', 'If-Match': '"0"' },
        body: JSON.stringify(document.toJSON()),
      })
      expect(mergedDocument.status).toBe(200)
      const removedDuplicateFile = await fetch(duplicateImageUrl)
      expect(removedDuplicateFile.status).toBe(404)

      const deletedProject = await fetch(`${origin}/api/projects/${document.id}`, { method: 'DELETE' })
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

    const canonical = await router.fetch(new Request(
      `http://elce.test/api/projects/${document.id}/media/media-canonical`,
      { method: 'PUT', body: new Blob([bytes], { type: 'image/webp' }) },
    ))
    const duplicate = await router.fetch(new Request(
      `http://elce.test/api/projects/${document.id}/media/media-duplicate`,
      { method: 'PUT', body: new Blob([bytes], { type: 'image/webp' }) },
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

    const listed = await router.fetch(new Request('http://elce.test/api/projects'))
    expect(listed.status).toBe(200)
    expect(await listed.json()).toMatchObject({
      projects: expect.arrayContaining([
        { id: 'project-first', name: first.data.name, revision: 0 },
        { id: 'project-second', name: second.data.name, revision: 0 },
      ]),
    })

    const renamed = await router.fetch(jsonRequest('PATCH', '/api/projects/project-first', { name: 'Projet renommé' }))
    expect(renamed.status).toBe(200)
    expect(renamed.headers.get('ETag')).toBe('"1"')

    const deleted = await router.fetch(new Request('http://elce.test/api/projects/project-second', { method: 'DELETE' }))
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

    await database.close()
    database = undefined
    database = await openProjectDatabase(filename)

    const reopenedRouter = createElceApiRouter(new SqliteProjectPersistence(database))
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

/** Builds a v4 fixture that exercises independent ordering and nested placements. */
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
