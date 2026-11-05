import { mkdir, rm } from 'node:fs/promises'
import type { SqliteDatabase } from 'remix/data-table/sqlite'
import { MediaApiController } from '../../../../core/server/media/media-api-controller'
import { createMediaFileStorage } from '../../../../core/server/media/media-file-storage'
import { QuizHuntSqliteProjectPersistence } from '../../persistence/server/sqlite/quiz-hunt-sqlite-project-persistence'
import { createQuizHuntApiRouter } from './quiz-hunt-api-router'

/** Exposes Quiz Hunt's routes and media handler on the shared product database. */
export interface QuizHuntServerComposition {
  readonly router: ReturnType<typeof createQuizHuntApiRouter>
  readonly media: MediaApiController
}

/** Creates Quiz Hunt's own persistence adapter and API routes. */
export async function createQuizHuntServerComposition(options: Readonly<{
  database: SqliteDatabase
  mediaDirectory: string
}>): Promise<QuizHuntServerComposition> {
  const persistence = new QuizHuntSqliteProjectPersistence(options.database)
  const fileStorage = createMediaFileStorage(options.mediaDirectory)
  const temporaryDirectory = `${options.mediaDirectory}.quiz-hunt.incoming`
  await rm(temporaryDirectory, { recursive: true, force: true })
  await mkdir(temporaryDirectory, { recursive: true })
  const media = new MediaApiController(persistence, fileStorage, temporaryDirectory)
  return { router: createQuizHuntApiRouter(persistence, media, persistence), media }
}
