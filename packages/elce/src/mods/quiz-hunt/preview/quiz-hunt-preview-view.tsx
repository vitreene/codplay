import { on, type Handle } from 'remix/component'
import { FileText, RefreshCw } from 'lucide-static'
import { renderLucideIcon } from '../../../core/authoring/lucide-static-icon'
import type { QuizHuntPreviewSession } from './quiz-hunt-preview-session'

type QuizHuntPreviewViewProps = Readonly<{ session: QuizHuntPreviewSession }>

/** Connects the Quiz Hunt preview session to its reader controls and player host. */
export function QuizHuntPreviewView(handle: Handle<QuizHuntPreviewViewProps>) {
  const { session } = handle.props
  let view = session.getView()

  handle.queueTask(() => {
    const unsubscribe = session.subscribe(() => {
      view = session.getView()
      if (!handle.signal.aborted) void handle.update()
    })
    handle.signal.addEventListener('abort', unsubscribe, { once: true })
    session.start()
  })

  return () => <div
    id="elce-popup-reader"
    className={view.isNetworkPreview ? 'elce-popup-reader elce-popup-reader--network-preview' : 'elce-popup-reader'}
  >
    {view.isNetworkPreview ? null : <header id="elce-popup-reader-header" className="elce-popup-reader__header">
      <h1 id="elce-popup-reader-title">Quiz Hunt</h1>
      <div id="elce-popup-reader-actions" className="elce-popup-reader__actions">
        <button
          id="elce-popup-reader-edited-page"
          type="button"
          title="Revenir sur la page éditée et reprendre la synchronisation"
          aria-label="Revenir sur la page éditée et reprendre la synchronisation"
          disabled={view.snapshot === null || view.pending}
          mix={on<HTMLButtonElement, 'click'>('click', () => session.returnToEditedPage())}
        >
          {renderLucideIcon(FileText, 'elce-popup-reader-edited-page-icon')}
          <span id="elce-popup-reader-edited-page-label" className="elce-popup-reader__action-label">Page éditée</span>
        </button>
        <button
          id="elce-popup-reader-sync"
          type="button"
          title={view.automaticSync ? 'Arrêter la synchronisation automatique' : 'Activer la synchronisation automatique'}
          aria-label={view.automaticSync ? 'Arrêter la synchronisation automatique' : 'Activer la synchronisation automatique'}
          aria-pressed={view.automaticSync}
          disabled={view.snapshot === null}
          mix={on<HTMLButtonElement, 'click'>('click', () => session.toggleAutomaticSync())}
        >
          {renderLucideIcon(RefreshCw, 'elce-popup-reader-sync-icon')}
          <span id="elce-popup-reader-sync-label" className="elce-popup-reader__action-label">
            {view.automaticSync ? 'Synchro active' : 'Synchro arrêtée'}
          </span>
        </button>
      </div>
    </header>}
    <main
      id="elce-popup-reader-main"
      className={view.isNetworkPreview ? 'elce-popup-reader__main elce-popup-reader__main--network-preview' : 'elce-popup-reader__main'}
    >
      {view.error === null ? null : <p id="elce-popup-reader-error" role="alert">{view.error}</p>}
      {view.snapshot === null && !view.isNetworkPreview && view.error === null
        ? <p id="elce-popup-reader-loading">Chargement de Quiz Hunt…</p>
        : null}
      <div
        id="elce-player-stage"
        className="elce-player-stage"
        aria-label="Prévisualisation Quiz Hunt"
        hidden={view.snapshot === null}
      />
    </main>
  </div>
}
