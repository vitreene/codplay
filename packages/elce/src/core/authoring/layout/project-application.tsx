import { on, type RemixNode } from 'remix/ui'
import { X } from 'lucide-static'
import type { ScormVersion } from '../../../scorm/scorm-types'
import type { ElceProjectSummary } from '../../../infrastructure/project-api/project-api-types'
import type { DocumentSyncStatus, ProjectControllerStatus } from '../../controller/controller-types'
import { CoreEditorFacade } from '../core-editor-facade'
import { renderLucideIcon } from '../lucide-static-icon'

export interface CoreProjectApplicationView {
  readonly projects: readonly ElceProjectSummary[]
  readonly activeProject: ElceProjectSummary | null
  readonly projectName: string | null
  readonly projectStatus: ProjectControllerStatus
  readonly projectError: string | null
  readonly accessRecoveryAvailable: boolean
  readonly recoverableLocalCopy: boolean
  readonly editAccess: 'waiting' | 'active'
  readonly history: Readonly<{ past: readonly unknown[]; future: readonly unknown[] }>
  readonly importPending: boolean
  readonly syncStatus: DocumentSyncStatus
}

export interface CoreProjectExportState {
  readonly onExport: () => void
  readonly onCloseExportDialog: () => void
  readonly onExportSighty: () => void
  readonly onExportScorm: (version: ScormVersion, monoSco: boolean) => void
  readonly exportBusy: boolean
}

export interface CoreProjectApplicationProps {
  readonly view: CoreProjectApplicationView
  readonly actions: CoreEditorFacade
  readonly editorWorkspace: RemixNode
  readonly export: CoreProjectExportState
  readonly runHistoryAction: (kind: 'undo' | 'redo') => void
}

/** Renders project management around the workspace supplied by its authoring mod. */
export function renderCoreProjectApplication(props: CoreProjectApplicationProps): RemixNode {
  const view = props.view
  const editorVisible = view.activeProject !== null && view.projectStatus === 'active' && view.editAccess === 'active'
  const projectVisible = view.activeProject !== null && view.projectStatus !== 'loading' && view.projectStatus !== 'busy'
  const currentName = view.activeProject === null ? null : view.projectName
  return <div
    id="elce-remix-project-app"
    className={editorVisible ? 'elce-remix-project-app elce-remix-project-app--editing' : 'elce-remix-project-app'}
  >
    <header id="elce-project-header" className="elce-project-header">
      <div id="elce-project-header-brand" className="elce-project-header-brand">
        <strong id="elce-project-brand-name">Elcé</strong>
      </div>
      <details id="elce-project-menu" className="elce-project-menu">
        <summary id="elce-project-menu-trigger">{currentName ?? 'Projets'}</summary>
        <div id="elce-project-menu-panel" className="elce-project-menu-panel">
          <button
            id="elce-project-create"
            type="button"
            disabled={view.projectStatus === 'busy' || view.projectStatus === 'loading'}
            mix={on<HTMLButtonElement, 'click'>('click', () => props.actions.createProject())}
          >Nouveau projet</button>
          <button
            id="elce-project-refresh"
            type="button"
            disabled={view.projectStatus === 'busy' || view.projectStatus === 'loading'}
            mix={on<HTMLButtonElement, 'click'>('click', () => props.actions.refreshProjects())}
          >Actualiser</button>
          {view.activeProject === null ? null : <button
            id="elce-project-save-as"
            type="button"
            disabled={view.projectStatus === 'busy'}
            mix={on<HTMLButtonElement, 'click'>('click', () => {
              const name = window.prompt('Nom de la copie', `${currentName ?? 'Projet'} (copie)`)
              if (name?.trim()) props.actions.saveAs(name.trim())
            })}
          >Enregistrer sous…</button>}
          {view.activeProject === null || !view.recoverableLocalCopy ? null : <button
            id="elce-project-save-local-as"
            type="button"
            disabled={view.projectStatus === 'busy'}
            mix={on<HTMLButtonElement, 'click'>('click', () => {
              const name = window.prompt('Nom de la copie locale', `${currentName ?? 'Projet'} (copie locale)`)
              if (name?.trim()) props.actions.saveLocalAs(name.trim())
            })}
          >Enregistrer la copie locale sous…</button>}
          {view.activeProject === null ? null : <button
            id="elce-project-close"
            type="button"
            disabled={view.projectStatus === 'busy'}
            mix={on<HTMLButtonElement, 'click'>('click', () => props.actions.closeProject())}
          >Fermer le projet</button>}
          {view.activeProject === null || !editorVisible ? null : <form
            id="elce-project-rename-form"
            className="elce-project-rename-form"
            mix={on<HTMLFormElement, 'submit'>('submit', (event) => {
              event.preventDefault()
              const name = new FormData(event.currentTarget).get('projectName')
              if (typeof name === 'string' && name.trim() !== '') props.actions.renameActiveProject(name.trim())
            })}
          >
            <label id="elce-project-rename-label" htmlFor="elce-project-rename-input">Nom du projet</label>
            <input id="elce-project-rename-input" name="projectName" type="text" defaultValue={currentName ?? ''} maxLength={120} />
            <button id="elce-project-rename-submit" type="submit">Renommer</button>
          </form>}
          <ul id="elce-project-menu-list" className="elce-project-list elce-project-list--menu">
            {renderProjectRows(view, props.actions, 'menu')}
          </ul>
        </div>
      </details>
      {editorVisible ? <div id="elce-history-actions" className="elce-history-actions">
        <button
          id="elce-history-undo"
          type="button"
          disabled={view.history.past.length === 0 && !hasDirtyInlineTitle()}
          mix={on<HTMLButtonElement, 'click'>('click', () => props.runHistoryAction('undo'))}
        >Annuler</button>
        <button
          id="elce-history-redo"
          type="button"
          disabled={view.history.future.length === 0}
          mix={on<HTMLButtonElement, 'click'>('click', () => props.runHistoryAction('redo'))}
        >Rétablir</button>
      </div> : null}
      {editorVisible && view.importPending ? <button
        id="elce-import-cancel"
        className="elce-import-cancel"
        type="button"
        mix={on<HTMLButtonElement, 'click'>('click', () => props.actions.cancelImport())}
      >Annuler l’import</button> : null}
      <span id="elce-project-sync-status" className="elce-project-sync-status" role="status" aria-live="polite">
        {editorVisible ? syncStatusLabel(view.syncStatus) : projectVisible ? 'Lecture seule' : projectStatusLabel(view.projectStatus)}
      </span>
      {editorVisible ? renderExportButton(props.export.onExport, props.export.exportBusy) : null}
    </header>
    {editorVisible ? renderExportDialog(props.export) : null}
    {view.activeProject === null ? renderProjectSelection(view, props.actions) : null}
    {projectVisible && !editorVisible && view.projectError !== null ? <p id="elce-project-reader-status" role="status">{view.projectError}</p> : null}
    {projectVisible && !editorVisible && view.accessRecoveryAvailable ? <button
      id="elce-project-access-retry"
      type="button"
      mix={on<HTMLButtonElement, 'click'>('click', () => props.actions.retryProjectAccess())}
    >Réessayer l’accès</button> : null}
    {projectVisible && !editorVisible && view.accessRecoveryAvailable ? <button
      id="elce-project-access-force"
      type="button"
      mix={on<HTMLButtonElement, 'click'>('click', () => props.actions.forceProjectAccess())}
    >Forcer l’accès</button> : null}
    {editorVisible && view.projectError !== null ? <p id="elce-project-copy-warning" role="alert">{view.projectError}</p> : null}
    {props.editorWorkspace}
  </div>
}

/** Renders the shared export control in the project header. */
function renderExportButton(onExport: () => void, busy: boolean): RemixNode {
  return <button
    id="elce-export-open"
    className="elce-project-export-button"
    type="button"
    aria-haspopup="dialog"
    aria-controls="elce-export-dialog"
    disabled={busy}
    aria-busy={busy}
    mix={on<HTMLButtonElement, 'click'>('click', onExport)}
  >{busy ? 'Préparation…' : 'Exporter'}</button>
}

/** Presents the shared Sighty and SCORM export choices. */
function renderExportDialog(exportState: CoreProjectExportState): RemixNode {
  return <dialog
    id="elce-export-dialog"
    className="elce-export-dialog"
    aria-labelledby="elce-export-dialog-title"
    aria-describedby="elce-export-dialog-description"
  >
    <div id="elce-export-dialog-content" className="elce-export-dialog__content">
      <header id="elce-export-dialog-header" className="elce-export-dialog__header">
        <h2 id="elce-export-dialog-title">Exporter</h2>
        <button
          id="elce-export-dialog-close"
          className="elce-export-dialog__close"
          type="button"
          aria-label="Fermer la fenêtre d’export"
          title="Fermer la fenêtre d’export"
          mix={on<HTMLButtonElement, 'click'>('click', exportState.onCloseExportDialog)}
        >{renderLucideIcon(X, 'elce-export-dialog-close-icon')}</button>
      </header>
      <p id="elce-export-dialog-description">Choisissez le format de diffusion. L’export SCORM reprend le même scénario et les mêmes médias.</p>
      <button
        id="elce-sighty-export-action"
        className="elce-export-dialog__action"
        type="button"
        disabled={exportState.exportBusy}
        mix={on<HTMLButtonElement, 'click'>('click', exportState.onExportSighty)}
      >Exporter le scénario</button>
      <section id="elce-scorm-export-section" className="elce-export-dialog__scorm">
        <h3 id="elce-scorm-export-title">Exporter en SCORM</h3>
        <p id="elce-scorm-export-description">Cochez monoSCO pour obtenir un package SCORM distinct par chapitre.</p>
        <form id="elce-scorm-export-form">
          <fieldset id="elce-scorm-version-options" className="elce-export-dialog__fieldset">
            <legend id="elce-scorm-version-legend">Version SCORM</legend>
            <label id="elce-scorm-version-label-12" className="elce-export-dialog__choice">
              <input id="elce-scorm-version-12" name="version" type="radio" value="1.2" /> SCORM 1.2
            </label>
            <label id="elce-scorm-version-label-2004" className="elce-export-dialog__choice">
              <input id="elce-scorm-version-2004" name="version" type="radio" value="2004v4" checked /> SCORM 2004 (4e édition)
            </label>
          </fieldset>
          <label id="elce-scorm-mono-sco-label" className="elce-export-dialog__choice">
            <input id="elce-scorm-mono-sco" name="monoSco" type="checkbox" value="true" /> monoSCO
          </label>
        </form>
        <button
          id="elce-scorm-export-action"
          className="elce-export-dialog__action"
          type="button"
          disabled={exportState.exportBusy}
          mix={on<HTMLButtonElement, 'click'>('click', () => submitScormExport(exportState.onExportScorm))}
        >Exporter en SCORM</button>
      </section>
    </div>
  </dialog>
}

/** Reads the selected edition and mono-SCO checkbox from the export form. */
function submitScormExport(onExportScorm: CoreProjectExportState['onExportScorm']): void {
  const form = document.getElementById('elce-scorm-export-form') as HTMLFormElement | null
  if (form === null) return
  const formData = new FormData(form)
  const version = formData.get('version')
  if (!isScormVersion(version)) return
  onExportScorm(version, formData.get('monoSco') === 'true')
}

/** Accepts only SCORM editions supported by the package CLI. */
function isScormVersion(value: FormDataEntryValue | null): value is ScormVersion {
  return value === '1.2' || value === '2004v3' || value === '2004v4'
}

/** Renders the project selection surface when no project is active. */
function renderProjectSelection(view: CoreProjectApplicationView, actions: CoreEditorFacade): RemixNode {
  return <main id="elce-project-selection" className="elce-project-selection">
    <section id="elce-project-selection-panel" className="elce-project-selection-panel">
      <h1 id="elce-project-selection-title">{projectSelectionTitle(view)}</h1>
      {view.projectError === null ? null : <p id="elce-project-error" className="elce-project-error" role="alert">{view.projectError}</p>}
      {view.activeProject !== null && view.editAccess !== 'active' ? <p id="elce-project-access-waiting" role="status">
        {`En attente de l’accès au projet « ${view.activeProject.name} ». Fermez son autre fenêtre si elle ne libère pas l’accès.`}
      </p> : null}
      {view.projectStatus === 'loading' || view.projectStatus === 'busy' ? <p id="elce-project-loading" role="status">Chargement…</p> : null}
      <button
        id="elce-project-create-empty"
        className="elce-project-primary-action"
        type="button"
        disabled={view.projectStatus === 'busy' || view.projectStatus === 'loading'}
        mix={on<HTMLButtonElement, 'click'>('click', () => actions.createProject())}
      >Créer un projet</button>
      <ul id="elce-project-selection-list" className="elce-project-list">
        {renderProjectRows(view, actions, 'selection')}
      </ul>
    </section>
  </main>
}

/** Renders project open and delete actions for the server-owned list. */
function renderProjectRows(view: CoreProjectApplicationView, actions: CoreEditorFacade, surface: 'menu' | 'selection'): RemixNode[] {
  return view.projects.map((project) => {
    const isActive = view.activeProject?.id === project.id
    const prefix = `elce-project-${surface}-${project.id}`
    return <li
      key={project.id}
      id={`${prefix}-row`}
      className={isActive ? 'elce-project-list-row elce-project-list-row--active' : 'elce-project-list-row'}
    >
      <span id={`${prefix}-name`}>{isActive ? view.projectName : project.name}</span>
      <button
        id={`${prefix}-open`}
        type="button"
        disabled={isActive || view.projectStatus === 'busy' || view.projectStatus === 'loading'}
        mix={on<HTMLButtonElement, 'click'>('click', () => actions.openProject(project.id))}
      >{isActive ? 'Ouvert' : 'Ouvrir'}</button>
      <button
        id={`${prefix}-delete`}
        type="button"
        disabled={view.projectStatus === 'busy' || view.projectStatus === 'loading'}
        mix={on<HTMLButtonElement, 'click'>('click', () => {
          if (window.confirm(`Supprimer le projet « ${project.name} » ?`)) actions.deleteProject(project.id)
        })}
      >Supprimer</button>
    </li>
  })
}

/** Selects the visible synchronization label. */
function syncStatusLabel(status: DocumentSyncStatus): string {
  switch (status) {
    case 'pending': return 'À synchroniser'
    case 'synced': return 'Synchronisé'
    case 'conflict': return 'Conflit de synchronisation'
  }
}

/** Selects a short project-status message. */
function projectStatusLabel(status: ProjectControllerStatus): string {
  switch (status) {
    case 'loading': return 'Chargement des projets'
    case 'list': return 'Aucun projet ouvert'
    case 'opening': return 'Ouverture du projet'
    case 'active': return 'Projet ouvert'
    case 'busy': return 'Opération en cours'
    case 'error': return 'Erreur de projet'
  }
}

/** Chooses the selection heading from the current project state. */
function projectSelectionTitle(view: CoreProjectApplicationView): string {
  switch (view.projectStatus) {
    case 'loading': return 'Chargement de vos projets'
    case 'opening': return `Ouverture de ${view.activeProject?.name ?? 'votre projet'}`
    case 'busy': return view.activeProject === null ? 'Gestion des projets' : `Enregistrement de ${view.activeProject.name}`
    case 'error': return 'L’accès au projet a échoué'
    case 'active': return view.activeProject === null ? 'Vos projets' : `Accès à ${view.activeProject.name}`
    case 'list': return 'Vos projets'
  }
}

/** Allows Escape to commit the current inline title before an undo gesture. */
function hasDirtyInlineTitle(): boolean {
  if (typeof document === 'undefined') return false
  const active = document.activeElement
  return active instanceof HTMLInputElement && isInlineTitle(active)
    && active.value.trim() !== active.defaultValue.trim()
}

/** Identifies inline document and chapter titles handled by the shared history controls. */
function isInlineTitle(input: HTMLInputElement): boolean {
  return input.classList.contains('elce-inline-title-input')
}
