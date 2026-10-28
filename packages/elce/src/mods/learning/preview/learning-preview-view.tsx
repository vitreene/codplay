import type { Handle } from 'remix/ui'
import { PopupPreviewWindow } from '../../../core/preview/popup-preview-window'
import type { LearningPreviewSession } from './learning-preview-session'
import { learningPreviewService } from './learning-preview-service'

type LearningPreviewViewProps = Readonly<{ session: LearningPreviewSession }>

/** Adapts Learning consultation state to the shared preview window surface. */
export function LearningPreviewView(handle: Handle<LearningPreviewViewProps>) {
  const { session } = handle.props
  let view = session.getView()

  handle.queueTask(() => {
    const unsubscribe = session.subscribe(() => {
      view = session.getView()
      if (!handle.signal.aborted) void handle.update()
    })
    const dispose = (): void => {
      unsubscribe()
      session.destroy()
    }
    handle.signal.addEventListener('abort', dispose, { once: true })
    session.start()
  })

  return () => {
    const snapshot = view.snapshot
    return <PopupPreviewWindow
      hasSnapshot={snapshot !== null}
      error={view.error}
      pending={view.pending}
      isNetworkPreview={view.isNetworkPreview}
      isCatalogPage={snapshot !== null && learningPreviewService.isCatalogPage(snapshot.documentModel, snapshot.selectedPageId)}
      testStateNotice={view.testStateNotice}
      testControlsOpen={view.testControlsOpen}
      profileEnabled={snapshot?.testState.profileEnabled ?? true}
      onRequestEditor={(type) => session.requestEditor(type)}
      onToggleTestControls={() => session.toggleTestControls()}
      onResetTestProfile={() => session.resetTestProfile()}
      onResetTestProgress={() => session.resetTestProgress()}
      onToggleProfileMode={(enabled) => session.toggleProfileMode(enabled)}
    />
  }
}
