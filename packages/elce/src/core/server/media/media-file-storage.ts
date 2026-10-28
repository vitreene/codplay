import { createFsFileStorage } from 'remix/file-storage/fs'
import type { FileStorage } from 'remix/file-storage'
import type { LazyFile } from 'remix/lazy-file'
import type { MediaPersistence } from './media-persistence'

export type ElceMediaFileStorage = FileStorage<LazyFile>

/** Opens Remix filesystem storage dedicated to Elcé media files. */
export function createMediaFileStorage(directory: string): ElceMediaFileStorage {
  return createFsFileStorage(directory)
}

/** Removes stored media that no longer has a SQLite reference. */
export async function removeUnreferencedMediaFiles(
  storage: ElceMediaFileStorage,
  persistence: MediaPersistence,
  protectedKeys: ReadonlySet<string> = new Set(),
): Promise<void> {
  const referencedKeys = new Set(await persistence.listMediaStorageKeys())
  const unreferencedKeys: string[] = []
  let cursor: string | undefined

  do {
    const page = await storage.list({
      prefix: 'media/',
      limit: 500,
      ...(cursor === undefined ? {} : { cursor }),
    })
    for (const file of page.files) {
      if (!referencedKeys.has(file.key) && !protectedKeys.has(file.key)) unreferencedKeys.push(file.key)
    }
    cursor = page.cursor
  } while (cursor !== undefined)

  await Promise.all(unreferencedKeys.map((key) => storage.remove(key)))
}
