import { mkdir, rm } from 'node:fs/promises'
import { MediaApiController } from '../../../../core/server/media/media-api-controller'
import { createMediaFileStorage, removeUnreferencedMediaFiles } from '../../../../core/server/media/media-file-storage'
import type { SqliteDatabase } from 'remix/data-table/sqlite'
import { LearningSqliteProjectPersistence } from '../../persistence/server/sqlite/learning-sqlite-project-persistence'
import { createLearningApiRouter } from './learning-api-router'

/** Composes Learning API resources on the product-owned SQLite connection. */
export interface LearningServerComposition {
  readonly router: ReturnType<typeof createLearningApiRouter>
  readonly media: MediaApiController
}

/** Creates Learning persistence, project/test-state routes, and media services. */
export async function createLearningServerComposition(options: Readonly<{
  database: SqliteDatabase
  mediaDirectory: string
}>): Promise<LearningServerComposition> {
  const persistence = new LearningSqliteProjectPersistence(options.database)
  const fileStorage = createMediaFileStorage(options.mediaDirectory)
  const temporaryDirectory = `${options.mediaDirectory}.incoming`
  await rm(temporaryDirectory, { recursive: true, force: true })
  await mkdir(temporaryDirectory, { recursive: true })
  await removeUnreferencedMediaFiles(fileStorage, persistence)
  const media = new MediaApiController(persistence, fileStorage, temporaryDirectory)
  const router = createLearningApiRouter(persistence, media)
  return { router, media }
}
