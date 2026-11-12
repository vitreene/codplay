import { ScormSession } from '@codplay/sighty-scorm/session'
import type { ScormVersion } from '@codplay/sighty-scorm'
import { QuizHuntPlayer } from '../reading/quiz-hunt-player'
import { readQuizHuntDocument } from '../persistence/quiz-hunt-document-codec'
import { QuizHuntScormAdapter } from './quiz-hunt-scorm-adapter'

interface QuizHuntScormRuntimeData {
  readonly schemaVersion: 1
  readonly documentData: unknown
  readonly mediaSources: Readonly<Record<string, string>>
}

/** Configures the real Quiz Hunt player around one standalone SCO session. */
export async function startQuizHuntScormPackageRuntime(
  options: Readonly<{
    root: HTMLElement
    runtimeData: unknown
    version: ScormVersion
  }>,
): Promise<Readonly<{ close(): Promise<void> }>> {
  const browserWindow = options.root.ownerDocument.defaultView
  if (browserWindow === null) throw new Error('Le package SCORM doit être lancé dans un document navigateur.')

  const runtimeData = readQuizHuntScormRuntimeData(options.runtimeData)
  const document = readQuizHuntDocument(runtimeData.documentData)
  const mediaSources = Object.fromEntries(Object.entries(runtimeData.mediaSources).map(([mediaId, path]) => [
    mediaId,
    new URL(path, browserWindow.location.href).href,
  ]))
  const session = new ScormSession({
    version: options.version,
    onDiagnostic: (message) => console.warn(message),
  })
  const restore = await session.initialize()
  const adapter = new QuizHuntScormAdapter(session, document.id, restore)
  const startPageId = document.pages.some((page) => page.id === restore.location)
    ? restore.location
    : undefined
  const originalVisibility = options.root.style.visibility
  options.root.style.visibility = 'hidden'
  let player: QuizHuntPlayer | null = null
  let closed = false

  /** Destroys the player and closes the LMS session once. */
  const close = async (): Promise<void> => {
    if (closed) return
    closed = true
    browserWindow.removeEventListener('pagehide', handlePageEnd)
    browserWindow.removeEventListener('beforeunload', handlePageEnd)
    player?.destroy()
    player = null
    await adapter.close()
  }

  /** Begins asynchronous session cleanup when the browser leaves this SCO. */
  const handlePageEnd = (): void => {
    void close().catch((error: unknown) => console.error('Fermeture SCORM Quiz Hunt impossible.', error))
  }

  try {
    player = new QuizHuntPlayer({
      stage: options.root,
      document,
      mediaSources,
      ...(startPageId === undefined ? {} : { startPageId }),
      context: 'release',
      gameStatePersistence: adapter,
      onPageChange: (pageId) => {
        void adapter.savePage(pageId).catch((error: unknown) => console.error('Signet SCORM Quiz Hunt impossible.', error))
      },
      onLog: (message, level) => {
        if (level === 'error' || level === 'warn') console.warn(message)
      },
    })
    await player.initialize()
    options.root.style.visibility = 'visible'
    browserWindow.addEventListener('pagehide', handlePageEnd, { once: true })
    browserWindow.addEventListener('beforeunload', handlePageEnd, { once: true })
    return { close }
  } catch (error) {
    options.root.style.visibility = originalVisibility
    player?.destroy()
    player = null
    await adapter.close()
    throw error
  }
}

/** Validates the package sidecar once before its values enter the player. */
function readQuizHuntScormRuntimeData(value: unknown): QuizHuntScormRuntimeData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Les données Quiz Hunt du package SCORM sont absentes.')
  }
  const candidate = value as Record<string, unknown>
  if (candidate.schemaVersion !== 1 || typeof candidate.documentData !== 'object'
    || candidate.documentData === null || Array.isArray(candidate.documentData)
    || typeof candidate.mediaSources !== 'object' || candidate.mediaSources === null
    || Array.isArray(candidate.mediaSources)) {
    throw new Error('Les données Quiz Hunt du package SCORM ne sont pas reconnues.')
  }
  const mediaSources = candidate.mediaSources as Record<string, unknown>
  if (!Object.values(mediaSources).every((source) => typeof source === 'string')) {
    throw new Error('Les références média du package Quiz Hunt ne sont pas reconnues.')
  }
  return {
    schemaVersion: 1,
    documentData: candidate.documentData,
    mediaSources: mediaSources as Record<string, string>,
  }
}
