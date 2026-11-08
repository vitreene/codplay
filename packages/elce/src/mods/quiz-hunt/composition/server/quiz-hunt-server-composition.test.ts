import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { QuizHuntDocumentService } from '../../document/quiz-hunt-document-service'
import { QuizHuntProjectDocument } from '../../persistence/quiz-hunt-document-codec'
import { openElceProjectDatabase } from '../../../../server/elce-project-database'
import type { SqliteDatabase } from 'remix/data-table/sqlite'
import { createQuizHuntServerComposition } from './quiz-hunt-server-composition'

describe('Quiz Hunt server composition media routes', () => {
  let database: SqliteDatabase | undefined
  let temporaryDirectory: string | undefined

  afterEach(async () => {
    await database?.close()
    database = undefined
    if (temporaryDirectory !== undefined) await rm(temporaryDirectory, { recursive: true, force: true })
    temporaryDirectory = undefined
  })

  it('uploads and reads a video through the shared media controller and Quiz Hunt SQLite adapter', async () => {
    database = await openElceProjectDatabase(':memory:')
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'quiz-hunt-media-'))
    const composition = await createQuizHuntServerComposition({
      database,
      mediaDirectory: join(temporaryDirectory, 'files'),
    })
    const documents = new QuizHuntDocumentService()
    const initial = documents.createInitialDocument('quiz-hunt-media-upload')
    const questionPage = initial.pages.find((page) => page.chapterId !== null)!
    const bytes = new TextEncoder().encode('quiz-hunt-video-data')
    const media = {
      id: 'media-video',
      name: 'video.webm',
      mimeType: 'video/webm',
      size: bytes.byteLength,
      caption: '',
    }
    const document = documents.attachQuestionMedia(initial, questionPage.bdcIds[0]!, media)
    const project = new QuizHuntProjectDocument(document)
    const created = await composition.router.fetch(new Request('http://elce.test/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project.toJSON()),
    }))
    expect(created.status).toBe(201)
    const missingMedia = await composition.router.fetch(new Request(
      `http://elce.test/api/projects/${document.id}/media/missing-media`,
    ))
    expect(missingMedia.status).toBe(404)

    const accessResponse = await composition.router.fetch(new Request(
      `http://elce.test/api/projects/${document.id}/edit-access`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: 'quiz-hunt-media-test' }),
      },
    ))
    const { grantId } = await accessResponse.json() as { grantId: string }
    const uploaded = await composition.router.fetch(new Request(
      `http://elce.test/api/projects/${document.id}/media/${media.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': media.mimeType,
          'X-Elce-Page-Id': 'quiz-hunt-media-test',
          'X-Elce-Edit-Grant': grantId,
        },
        body: new Blob([bytes], { type: media.mimeType }),
      },
    ))

    expect(uploaded.status).toBe(201)
    expect(await uploaded.json()).toEqual({
      media: { id: media.id, url: `/api/projects/${document.id}/media/${media.id}` },
    })
    const fetched = await composition.router.fetch(new Request(
      `http://elce.test/api/projects/${document.id}/media/${media.id}`,
    ))
    expect(fetched.status).toBe(200)
    expect(new Uint8Array(await fetched.arrayBuffer())).toEqual(bytes)
  })
})
