import { reconcileProjectTestState } from '../domain/summary-profile/test-state-reconciliation'
import { CHAPTER_TYPE } from '../config/document-config'
import { ElcePlayerComposition } from '../player/elce-player-composition'
import type { ElcePlayerCompositionOptions } from '../player/player-composition-types'
import type { PipwerksScormApi, ScormVersion } from '@codplay/sighty-scorm'
import { ElceScormAdapter } from './elce-scorm-adapter'

/** Provides one exported Elcé document and its browser presentation host. */
export interface ScormPlayerRuntimeOptions extends Omit<
  ElcePlayerCompositionOptions,
  'startPageId' | 'testState' | 'scormSession'
> {
  readonly version: ScormVersion
  readonly monoSco?: boolean
  readonly api?: PipwerksScormApi
}

/** Exposes the running player and its idempotent LMS shutdown operation. */
export interface ScormPlayerRuntimeHandle {
  readonly player: ElcePlayerComposition
  readonly session: ElceScormAdapter
  close(): Promise<void>
}

/** Opens SCORM, restores compatible reader state, then initializes Sighty. */
export async function startScormPlayerRuntime(
  options: ScormPlayerRuntimeOptions,
): Promise<ScormPlayerRuntimeHandle> {
  const view = options.stage.ownerDocument.defaultView
  if (view === null) throw new Error('Le runtime SCORM doit être lancé dans un document navigateur.')
  const session = new ElceScormAdapter({
    version: options.version,
    monoSco: options.monoSco,
    evaluationChapterIds: options.document.chapters
      .filter((chapter) => chapter.type === CHAPTER_TYPE.EVALUATION)
      .map((chapter) => chapter.id),
    chapterIds: options.document.chapters.map((chapter) => chapter.id),
    chapterPageIds: options.document.chapters.map((chapter) => chapter.pageIds),
    api: options.api,
    onDiagnostic: (message) => options.onLog?.(message, 'warn'),
  })
  const restoredState = await session.initialize()
  let closed = false
  let player: ElcePlayerComposition | undefined
  /** Removes lifecycle listeners and shuts down the player and LMS session once. */
  const close = async (): Promise<void> => {
    if (closed) return
    closed = true
    view.removeEventListener('pagehide', handlePageEnd)
    view.removeEventListener('beforeunload', handlePageEnd)
    player?.destroy()
    await session.close()
  }
  /** Starts shutdown when the browser leaves the SCO document. */
  const handlePageEnd = (): void => {
    void close()
  }

  view.addEventListener('pagehide', handlePageEnd, { once: true })
  view.addEventListener('beforeunload', handlePageEnd, { once: true })
  try {
    const projectTestState = reconcileProjectTestState(options.document, restoredState.projectTestState)
    if (projectTestState !== restoredState.projectTestState) {
      await session.saveReaderState(projectTestState, restoredState.currentPageId ?? undefined)
    }
    player = new ElcePlayerComposition({
      stage: options.stage,
      document: options.document,
      startPageId: restoredState.currentPageId ?? undefined,
      mediaSources: options.mediaSources,
      sceneCache: options.sceneCache,
      testState: projectTestState,
      scormSession: session,
      onLog: options.onLog,
    })
    await player.initialize()
  } catch (error: unknown) {
    await close()
    throw error
  }
  return { player: player!, session, close }
}
