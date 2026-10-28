import { mkdir, rm } from 'node:fs/promises'
import { MediaApiController } from '../../../../core/server/media/media-api-controller'
import { createMediaFileStorage, removeUnreferencedMediaFiles } from '../../../../core/server/media/media-file-storage'
import { openProjectDatabase } from '../../persistence/server/sqlite/project-database'
import { LearningSqliteProjectPersistence } from '../../persistence/server/sqlite/learning-sqlite-project-persistence'
import { createLearningApiRouter } from './learning-api-router'

/** Owns the Learning SQLite connection and API resources for one local server. */
export interface LearningServerComposition {
  readonly router: ReturnType<typeof createLearningApiRouter>
  readonly media: MediaApiController
  close(): Promise<void>
}

/** Creates Learning persistence, project/test-state routes, and media services. */
export async function createLearningServerComposition(options: Readonly<{
  databaseFile: string
  mediaDirectory: string
}>): Promise<LearningServerComposition> {
  const database = await openProjectDatabase(options.databaseFile)

  try {
    const persistence = new LearningSqliteProjectPersistence(database)
    const fileStorage = createMediaFileStorage(options.mediaDirectory)
    const temporaryDirectory = `${options.mediaDirectory}.incoming`
    await rm(temporaryDirectory, { recursive: true, force: true })
    await mkdir(temporaryDirectory, { recursive: true })
    await removeUnreferencedMediaFiles(fileStorage, persistence)
    const media = new MediaApiController(persistence, fileStorage, temporaryDirectory)
    const router = createLearningApiRouter(persistence, media)
    return {
      router,
      media,
      async close() {
        await database.close()
      },
    }
  } catch (error) {
    await database.close()
    throw error
  }
}
