import { on, type Handle } from 'remix/ui'
import { FileText, List, RefreshCw } from 'lucide-static'
import type { PopupPreviewRequest } from './popup-preview-messages'
import { renderLucideIcon } from '../authoring/lucide-static-icon'

export interface PopupPreviewWindowProps {
  readonly hasSnapshot: boolean
  readonly error: string | null
  readonly pending: boolean
  readonly isNetworkPreview: boolean
  readonly isCatalogPage: boolean
  readonly testStateNotice: string | null
  readonly testControlsOpen: boolean
  readonly profileEnabled: boolean
  readonly onRequestEditor: (type: PopupPreviewRequest['type']) => void
  readonly onToggleTestControls: () => void
  readonly onResetTestProfile: () => void
  readonly onResetTestProgress: () => void
  readonly onToggleProfileMode: (enabled: boolean) => void
}

/** Renders the shared preview window controls around the supplied player stage. */
export function PopupPreviewWindow(handle: Handle<PopupPreviewWindowProps>) {
  const state = handle.props
  return () => <div
    id="elce-popup-reader"
    className={state.isNetworkPreview ? 'elce-popup-reader elce-popup-reader--network-preview' : 'elce-popup-reader'}
  >
    {state.isNetworkPreview ? null : <header id="elce-popup-reader-header" className="elce-popup-reader__header">
      <h1 id="elce-popup-reader-title">Lecture Elcé</h1>
      <div id="elce-popup-reader-actions" className="elce-popup-reader__actions">
        <button
          id="elce-popup-reader-test-controls"
          type="button"
          title="Accéder au profil et aux réglages du test auteur"
          aria-label="Accéder au profil et aux réglages du test auteur"
          aria-expanded={state.testControlsOpen}
          aria-controls="elce-popup-reader-test-panel"
          disabled={!state.hasSnapshot || state.pending}
          mix={on<HTMLButtonElement, 'click'>('click', state.onToggleTestControls)}
        >
          {renderLucideIcon(List, 'elce-popup-reader-test-controls-icon')}
          <span className="elce-popup-reader__action-label">Test auteur</span>
        </button>
        <button
          id="elce-popup-reader-edited-page"
          type="button"
          title="Réafficher la page éditée"
          aria-label="Réafficher la page éditée"
          disabled={!state.hasSnapshot || state.pending}
          mix={on<HTMLButtonElement, 'click'>('click', () => state.onRequestEditor('show-edited-page'))}
        >
          {renderLucideIcon(FileText, 'elce-popup-reader-edited-page-icon')}
          <span id="elce-popup-reader-edited-page-label" className="elce-popup-reader__action-label">
            Réafficher la page éditée
          </span>
        </button>
        <button
          id="elce-popup-reader-sync"
          type="button"
          title={state.pending ? 'Synchronisation…' : 'Synchroniser'}
          aria-label={state.pending ? 'Synchronisation…' : 'Synchroniser'}
          disabled={!state.hasSnapshot || state.pending}
          mix={on<HTMLButtonElement, 'click'>('click', () => state.onRequestEditor('synchronize'))}
        >
          {renderLucideIcon(RefreshCw, 'elce-popup-reader-sync-icon')}
          <span id="elce-popup-reader-sync-label" className="elce-popup-reader__action-label">
            {state.pending ? 'Synchronisation…' : 'Synchroniser'}
          </span>
        </button>
      </div>
    </header>}
    {state.isNetworkPreview || !state.testControlsOpen || !state.hasSnapshot ? null : <section
      id="elce-popup-reader-test-panel"
      className="elce-popup-reader__test-panel"
      role="dialog"
      aria-label="Réglages du test auteur"
    >
      <label id="elce-popup-reader-profile-mode-label" htmlFor="elce-popup-reader-profile-mode">
        <input
          id="elce-popup-reader-profile-mode"
          type="checkbox"
          checked={state.profileEnabled}
          mix={on<HTMLInputElement, 'change'>('change', (event) => state.onToggleProfileMode(event.currentTarget.checked))}
        />
        Appliquer le profil et ses filtres
      </label>
      <button id="elce-popup-reader-reset-profile" type="button" mix={on<HTMLButtonElement, 'click'>('click', state.onResetTestProfile)}>
        Réinitialiser le profil
      </button>
      <button id="elce-popup-reader-reset-progress" type="button" mix={on<HTMLButtonElement, 'click'>('click', state.onResetTestProgress)}>
        Réinitialiser la progression
      </button>
      {state.testStateNotice === null ? null : <p id="elce-popup-reader-test-notice" role="status">{state.testStateNotice}</p>}
    </section>}
    <main
      id="elce-popup-reader-main"
      className={state.isNetworkPreview ? 'elce-popup-reader__main elce-popup-reader__main--network-preview' : 'elce-popup-reader__main'}
    >
      {state.error === null ? null : <p id="elce-popup-reader-error" role="alert">{state.error}</p>}
      {!state.hasSnapshot && !state.isNetworkPreview && state.error === null
        ? <p id="elce-popup-reader-loading">Chargement de la lecture…</p>
        : null}
      {!state.isNetworkPreview && state.isCatalogPage
        ? <p id="elce-player-catalog-message">Cette page est dans le catalogue et n’est pas diffusée.</p>
        : null}
      <div
        id="elce-player-stage"
        className="elce-player-stage"
        aria-label="Prévisualisation du document"
        hidden={!state.hasSnapshot}
      />
    </main>
  </div>
}
