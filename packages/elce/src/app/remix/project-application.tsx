import { on, type Handle, type RemixNode } from 'remix/ui'

import type { SnapshotFrom } from 'xstate'
import type { DocumentSyncState } from '../../infrastructure/indexed-db/document-store-types'
import { isImportChange, type controllerMachine } from '../controller/controller-machine'
import { EditorContextProvider } from './editor-context'
import type { EditorActionsFacade } from '../facades/editor-actions-facade'
import type { ProjectSessionStatus } from '../projects/project-session-types'
import { selectEditorViewModel } from '../selectors/editor-view-model'
import { CATALOG_TAB } from '../../config/document-config'
import { PopupPreviewHost } from '../player/popup-preview-host'
import { downloadElceSightyPackage, requestElceSightyPackage } from '../../export/elce-sighty-export-client'
import { renderEditorWorkspace } from './workspace/editor-workspace'
import { RemixPageEditor } from './workspace/page-editor'
import type { DraggedScenarioEntry, ResponsivePanel } from './workspace/editor-workspace-types'
import type { ProjectApplicationView, ProjectApplicationWorkspaceState } from './project-application-types'

/** Renders project management and the native Remix authoring workspace. */
export function ProjectApplication(handle: Handle) {
  const { controller, actions } = handle.context.get(EditorContextProvider)
  if (controller === null || actions === null) {
    return () => <div
      id="elce-remix-project-app"
    />
  }

  let view = selectProjectView(controller.getSnapshot())
  let responsivePanel: ResponsivePanel = null
  let summarySettingsOpen = false
  let profileTokenTargetId: string | null = null
  let authoringError: string | null = null
  let dropTarget: string | null = null
  let draggedEntry: DraggedScenarioEntry = null
  let previewError: string | null = null
  let exportBusy = false
  let exportError: string | null = null
  let exportNotice: string | null = null
  let returnFocusId: string | null = null
  let popupPreviewHost: PopupPreviewHost | null = null

  const setResponsivePanel = (panel: ResponsivePanel, triggerId?: string): void => {
    if (panel !== null) returnFocusId = triggerId ?? returnFocusId
    const focusId = panel === null ? returnFocusId : null
    responsivePanel = panel
    if (panel === null) returnFocusId = null
    void handle.update().then(() => {
      if (panel === null && focusId !== null) document.getElementById(focusId)?.focus()
    })
  }
  const setDropTarget = (targetId: string | null): void => {
    if (dropTarget === targetId) return
    dropTarget = targetId
    void handle.update()
  }
  const setSummarySettingsOpen = (open: boolean): void => {
    summarySettingsOpen = open
    authoringError = null
    void handle.update()
  }
  /** Keeps profile-variable insertion available only for the active text target. */
  const setProfileTokenTarget = (targetId: string | null): void => {
    if (profileTokenTargetId === targetId) return
    profileTokenTargetId = targetId
    if (targetId === null && view.editor.catalogTab === CATALOG_TAB.PROFILE) {
      actions.selectCatalogTab(CATALOG_TAB.AVAILABLE_BDCS)
    }
    void handle.update()
  }
  const setAuthoringError = (error: string | null): void => {
    authoringError = error
    void handle.update()
  }
  const setDraggedEntry = (entry: DraggedScenarioEntry): void => {
    draggedEntry = entry
  }
  const openPreview = (): void => {
    previewError = null
    popupPreviewHost ??= new PopupPreviewHost(controller)
    if (!popupPreviewHost.open()) previewError = 'Le navigateur a bloqué la fenêtre de lecture.'
    void handle.update()
  }
  /** Packages the current actor snapshot and downloads it without saving or initializing it. */
  const exportScenario = (): void => {
    const context = controller.getSnapshot().context
    if (exportBusy || context.activeProject === null || context.projectStatus !== 'active' || context.editAccess !== 'active') return
    const documentSnapshot = context.document
    const mediaSources = context.mediaSources
    exportBusy = true
    exportError = null
    exportNotice = null
    void handle.update()
    void (async () => {
      try {
        const packageBlob = await requestElceSightyPackage(documentSnapshot, mediaSources)
        const filename = downloadElceSightyPackage(packageBlob, documentSnapshot.data.name)
        exportNotice = `Téléchargement de « ${filename} » démarré.`
      } catch (error) {
        exportError = error instanceof Error ? error.message : 'L’export du scénario Elcé a échoué.'
      } finally {
        exportBusy = false
        void handle.update()
      }
    })()
  }
  /** Routes either button or shortcut through the same controller gesture. */
  const runHistoryAction = (kind: 'undo' | 'redo'): void => {
    if (view.activeProject === null || view.projectStatus !== 'active' || view.editAccess !== 'active') return
    if (kind === 'undo') commitFocusedInlineTitle()
    if (kind === 'undo') actions.undo()
    else actions.redo()
  }
  handle.queueTask(() => {
    const subscription = controller.subscribe((snapshot) => {
      view = selectProjectView(snapshot)
      void handle.update()
    })
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && responsivePanel !== null) setResponsivePanel(null)
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'z') return
      if (view.activeProject === null || view.projectStatus !== 'active' || view.editAccess !== 'active') return
      event.preventDefault()
      event.stopPropagation()
      runHistoryAction(event.shiftKey ? 'redo' : 'undo')
    }
    /** Refreshes button availability while an inline title is still dirty. */
    const handleInput = (event: Event): void => {
      if (event.target instanceof HTMLInputElement && isInlineTitle(event.target)) void handle.update()
    }
    /** Tracks the text or rich-text field whose profile variable can be inserted. */
    const handleProfileTokenFocusIn = (event: FocusEvent): void => {
      if (event.target instanceof Element) {
        const target = event.target.closest<HTMLElement>('[data-elce-profile-token-target="true"]')
        if (target !== null && target.id.length > 0) {
          setProfileTokenTarget(target.id)
          return
        }
        if (event.target.closest('#elce-properties, #elce-properties-toggle') !== null) return
      }
      setProfileTokenTarget(null)
    }
    /** Clears the insertion context when the author clicks outside its field and panel. */
    const handleProfileTokenPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Element)) {
        setProfileTokenTarget(null)
        return
      }
      if (event.target.closest('[data-elce-profile-token-target="true"]') !== null
        || event.target.closest('#elce-properties, #elce-properties-toggle') !== null) return
      setProfileTokenTarget(null)
    }
    document.addEventListener('click', closeProjectMenuOnOutsideClick, true)
    const handleResize = (): void => {
      switch (responsivePanel) {
        case 'outline':
          if (window.innerWidth > 800) setResponsivePanel(null)
          return
        case 'properties':
          if (window.innerWidth > 1200) setResponsivePanel(null)
          return
        case null:
          return
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('input', handleInput)
    document.addEventListener('focusin', handleProfileTokenFocusIn, true)
    document.addEventListener('pointerdown', handleProfileTokenPointerDown, true)
    window.addEventListener('resize', handleResize)
    const dispose = (): void => {
      subscription.unsubscribe()
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('input', handleInput)
      document.removeEventListener('focusin', handleProfileTokenFocusIn, true)
      document.removeEventListener('pointerdown', handleProfileTokenPointerDown, true)
      document.removeEventListener('click', closeProjectMenuOnOutsideClick, true)
      window.removeEventListener('resize', handleResize)
      popupPreviewHost?.destroy()
    }
    handle.signal.addEventListener('abort', dispose, { once: true })
  })

  return () => renderApplication(view, actions, {
    responsivePanel,
    summarySettingsOpen,
    profileTokenTargetId,
    authoringError,
    dropTarget,
    visible: view.activeProject !== null && view.projectStatus === 'active' && view.editAccess === 'active',
    setResponsivePanel,
    setSummarySettingsOpen,
    setAuthoringError,
    setDropTarget,
    setDraggedEntry,
    getDraggedEntry: () => draggedEntry,
    onPreview: openPreview,
    previewError,
    onExport: exportScenario,
    exportBusy,
    exportError,
    exportNotice,
    movePage: (pageId, placement) => actions.movePage(pageId, placement),
    moveChapter: (chapterId, index) => actions.moveChapter(chapterId, index),
  }, runHistoryAction)
}

/** Closes the native project disclosure when a click lands outside it. */
function closeProjectMenuOnOutsideClick(event: MouseEvent): void {
  const menu = document.getElementById('elce-project-menu')
  if (!(menu instanceof HTMLDetailsElement) || !menu.open) return
  if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false
}

/** Detects the two inline titles that commit their edits on blur. */
function isInlineTitle(input: HTMLInputElement): boolean {
  return input.id.startsWith('elce-page-title-') || input.id.startsWith('elce-chapter-title-')
}

/** Commits the active dirty title before Undo enters the global history. */
function commitFocusedInlineTitle(): void {
  const active = document.activeElement
  if (active instanceof HTMLInputElement && isInlineTitle(active)) active.blur()
}

/** Reports a local title edit that has not yet reached the controller. */
function hasDirtyInlineTitle(): boolean {
  if (typeof document === 'undefined') return false
  const active = document.activeElement
  return active instanceof HTMLInputElement && isInlineTitle(active)
    && active.value.trim() !== active.defaultValue.trim()
}

/** Selects only project-management data from the XState-owned application snapshot. */
function selectProjectView(snapshot: SnapshotFrom<typeof controllerMachine>): ProjectApplicationView {
  return {
    projects: snapshot.context.projects,
    activeProject: snapshot.context.activeProject,
    projectStatus: snapshot.context.projectStatus,
    projectError: snapshot.context.projectError,
    accessRecoveryAvailable: snapshot.context.accessRecoveryAvailable,
    recoverableLocalCopy: snapshot.context.recoverableLocalCopy,
    editAccess: snapshot.context.editAccess,
    document: snapshot.context.document,
    history: snapshot.context.history,
    importPending: snapshot.matches('processingDocumentChange') && isImportChange(snapshot.context.documentChanges[0]),
    syncStatus: snapshot.context.syncStatus,
    editor: selectEditorViewModel(snapshot),
  }
}

/** Renders the project switcher, project list, and Remix work area. */
function renderApplication(
  view: ProjectApplicationView,
  actions: EditorActionsFacade,
  workspace: ProjectApplicationWorkspaceState,
  runHistoryAction: (kind: 'undo' | 'redo') => void,
): RemixNode {
  const editorVisible = view.activeProject !== null && view.projectStatus === 'active' && view.editAccess === 'active'
  const projectVisible = view.activeProject !== null && view.projectStatus !== 'loading' && view.projectStatus !== 'busy'
  const currentName = view.activeProject === null ? null : view.document.data.name
  return <div
    id="elce-remix-project-app"
    className={editorVisible ? 'elce-remix-project-app elce-remix-project-app--editing' : 'elce-remix-project-app'}
  >
    <header
      id="elce-project-header"
      className="elce-project-header"
    >
      <div
        id="elce-project-header-brand"
        className="elce-project-header-brand"
      >
        <strong
          id="elce-project-brand-name"
        >
          Elcé
        </strong>
      </div>
      <details
        id="elce-project-menu"
        className="elce-project-menu"
      >
        <summary
          id="elce-project-menu-trigger"
        >
          {currentName === null ? 'Projets' : currentName}
        </summary>
        <div
          id="elce-project-menu-panel"
          className="elce-project-menu-panel"
        >
          <button
            id="elce-project-create"
            type="button"
            disabled={view.projectStatus === 'busy' || view.projectStatus === 'loading'}
            mix={on<HTMLButtonElement, 'click'>('click', () => actions.createProject())}
          >
            Nouveau projet
          </button>
          <button
            id="elce-project-refresh"
            type="button"
            disabled={view.projectStatus === 'busy' || view.projectStatus === 'loading'}
            mix={on<HTMLButtonElement, 'click'>('click', () => actions.refreshProjects())}
          >
            Actualiser
          </button>
          {view.activeProject === null ? null : <button
            id="elce-project-save-as"
            type="button"
            disabled={view.projectStatus === 'busy'}
            mix={on<HTMLButtonElement, 'click'>('click', () => {
              const name = window.prompt('Nom de la copie', `${currentName ?? 'Projet'} (copie)`)
              if (name?.trim()) actions.saveAs(name.trim())
            })}
          >
            Enregistrer sous…
          </button>}
          {view.activeProject === null || !view.recoverableLocalCopy ? null : <button
            id="elce-project-save-local-as"
            type="button"
            disabled={view.projectStatus === 'busy'}
            mix={on<HTMLButtonElement, 'click'>('click', () => {
              const name = window.prompt('Nom de la copie locale', `${currentName ?? 'Projet'} (copie locale)`)
              if (name?.trim()) actions.saveLocalAs(name.trim())
            })}
          >
            Enregistrer la copie locale sous…
          </button>}
          {view.activeProject === null ? null : <button
            id="elce-project-close"
            type="button"
            disabled={view.projectStatus === 'busy'}
            mix={on<HTMLButtonElement, 'click'>('click', () => actions.closeProject())}
          >
            Fermer le projet
          </button>}
          {view.activeProject === null || !editorVisible ? null : <form
            id="elce-project-rename-form"
            className="elce-project-rename-form"
            mix={on<HTMLFormElement, 'submit'>('submit', (event) => {
              event.preventDefault()
              const form = event.currentTarget
              const name = new FormData(form).get('projectName')
              if (typeof name === 'string' && name.trim() !== '') actions.renameActiveProject(name.trim())
            })}
          >
            <label
              id="elce-project-rename-label"
              htmlFor="elce-project-rename-input"
            >
              Nom du projet
            </label>
            <input
              id="elce-project-rename-input"
              name="projectName"
              type="text"
              defaultValue={currentName ?? ''}
              maxLength={120}
            />
            <button
              id="elce-project-rename-submit"
              type="submit"
            >
              Renommer
            </button>
          </form>}
          <ul
            id="elce-project-menu-list"
            className="elce-project-list elce-project-list--menu"
          >
            {projectRows(view, actions, 'menu')}
          </ul>
        </div>
      </details>
      {editorVisible ? <div
        id="elce-history-actions"
        className="elce-history-actions"
      >
        <button
          id="elce-history-undo"
          type="button"
          disabled={view.history.past.length === 0 && !hasDirtyInlineTitle()}
          mix={on<HTMLButtonElement, 'click'>('click', () => runHistoryAction('undo'))}
        >
          Annuler
        </button>
        <button
          id="elce-history-redo"
          type="button"
          disabled={view.history.future.length === 0}
          mix={on<HTMLButtonElement, 'click'>('click', () => runHistoryAction('redo'))}
        >
          Rétablir
        </button>
      </div> : null}
      {editorVisible && view.importPending ? <button
        id="elce-import-cancel"
        className="elce-import-cancel"
        type="button"
        mix={on<HTMLButtonElement, 'click'>('click', () => actions.cancelImport())}
      >
        Annuler l’import
      </button> : null}
      <span
        id="elce-project-sync-status"
        className="elce-project-sync-status"
        role="status"
        aria-live="polite"
      >
        {editorVisible ? syncStatusLabel(view.syncStatus) : projectVisible ? 'Lecture seule' : projectStatusLabel(view.projectStatus)}
      </span>
      {editorVisible ? renderExportButton(workspace.onExport, workspace.exportBusy) : null}
    </header>
    {view.activeProject === null ? renderProjectSelection(view, actions) : null}
    {projectVisible && !editorVisible && view.projectError !== null ? <p id="elce-project-reader-status" role="status">
      {view.projectError}
    </p> : null}
    {projectVisible && !editorVisible && view.accessRecoveryAvailable ? <button
      id="elce-project-access-retry"
      type="button"
      mix={on<HTMLButtonElement, 'click'>('click', () => actions.retryProjectAccess())}
    >
      Réessayer l’accès
    </button> : null}
    {projectVisible && !editorVisible && view.accessRecoveryAvailable ? <button
      id="elce-project-access-force"
      type="button"
      mix={on<HTMLButtonElement, 'click'>('click', () => actions.forceProjectAccess())}
    >
      Forcer l’accès
    </button> : null}
    {editorVisible && view.projectError !== null ? <p id="elce-project-copy-warning" role="alert">{view.projectError}</p> : null}
    {renderEditorWorkspace({
      view: view.editor,
      actions,
      pageEditorHost: projectVisible && view.editor.selectedChapter === undefined
        ? <RemixPageEditor />
        : null,
      responsivePanel: workspace.responsivePanel,
      summarySettingsOpen: workspace.summarySettingsOpen,
      profileTokenTargetId: workspace.profileTokenTargetId,
      authoringError: workspace.authoringError,
      dropTarget: workspace.dropTarget,
      visible: projectVisible,
      editable: editorVisible,
      onSetResponsivePanel: workspace.setResponsivePanel,
      onSetSummarySettingsOpen: workspace.setSummarySettingsOpen,
      onSetAuthoringError: workspace.setAuthoringError,
      onSetDropTarget: workspace.setDropTarget,
      onSetDraggedEntry: workspace.setDraggedEntry,
      getDraggedEntry: workspace.getDraggedEntry,
      onPreview: workspace.onPreview,
      previewError: workspace.previewError,
      exportBusy: workspace.exportBusy,
      exportError: workspace.exportError,
      exportNotice: workspace.exportNotice,
      onMovePage: workspace.movePage,
      onMoveChapter: workspace.moveChapter,
    })}
  </div>
}

/** Renders the Sighty export action at the right edge of the project title bar. */
function renderExportButton(onExport: () => void, busy: boolean): RemixNode {
  return <button
    id="elce-sighty-export"
    className="elce-project-export-button"
    type="button"
    disabled={busy}
    aria-busy={busy}
    mix={on<HTMLButtonElement, 'click'>('click', onExport)}
  >
    {busy ? 'Préparation…' : 'Exporter le scénario'}
  </button>
}

/** Renders the selection surface when no project is actively being edited. */
function renderProjectSelection(view: ProjectApplicationView, actions: EditorActionsFacade): RemixNode {
  return <main
    id="elce-project-selection"
    className="elce-project-selection"
  >
    <section
      id="elce-project-selection-panel"
      className="elce-project-selection-panel"
    >
      <h1
        id="elce-project-selection-title"
      >
        {projectSelectionTitle(view)}
      </h1>
      {view.projectError === null ? null : <p
        id="elce-project-error"
        className="elce-project-error"
        role="alert"
      >
        {view.projectError}
      </p>}
      {view.activeProject !== null && view.editAccess !== 'active'
        ? <p
          id="elce-project-access-waiting"
          role="status"
        >
          {`En attente de l’accès au projet « ${view.activeProject.name} ». Fermez son autre fenêtre si elle ne libère pas l’accès.`}
        </p>
        : null}
      {view.projectStatus === 'loading' || view.projectStatus === 'busy'
        ? <p
          id="elce-project-loading"
          role="status"
        >
          Chargement…
        </p>
        : null}
      <button
        id="elce-project-create-empty"
        className="elce-project-primary-action"
        type="button"
        disabled={view.projectStatus === 'busy' || view.projectStatus === 'loading'}
        mix={on<HTMLButtonElement, 'click'>('click', () => actions.createProject())}
      >
        Créer un projet
      </button>
      <ul
        id="elce-project-selection-list"
        className="elce-project-list"
      >
        {projectRows(view, actions, 'selection')}
      </ul>
    </section>
  </main>
}

/** Renders project open and delete commands for one server-owned list. */
function projectRows(view: ProjectApplicationView, actions: EditorActionsFacade, surface: 'menu' | 'selection'): RemixNode[] {
  return view.projects.map((project) => {
    const isActive = view.activeProject?.id === project.id
    const prefix = `elce-project-${surface}-${project.id}`
    return <li
      key={project.id}
      id={`${prefix}-row`}
      className={isActive ? 'elce-project-list-row elce-project-list-row--active' : 'elce-project-list-row'}
    >
      <span
        id={`${prefix}-name`}
      >
        {isActive ? view.document.data.name : project.name}
      </span>
      <button
        id={`${prefix}-open`}
        type="button"
        disabled={isActive || view.projectStatus === 'busy' || view.projectStatus === 'loading'}
        mix={on<HTMLButtonElement, 'click'>('click', () => actions.openProject(project.id))}
      >
        {isActive ? 'Ouvert' : 'Ouvrir'}
      </button>
      <button
        id={`${prefix}-delete`}
        type="button"
        disabled={view.projectStatus === 'busy' || view.projectStatus === 'loading'}
        mix={on<HTMLButtonElement, 'click'>('click', () => {
          if (window.confirm(`Supprimer le projet « ${project.name} » ?`)) actions.deleteProject(project.id)
        })}
      >
        Supprimer
      </button>
    </li>
  })
}

/** Selects the page-independent sync label from the XState project view. */
function syncStatusLabel(status: DocumentSyncState['status']): string {
  switch (status) {
    case 'pending': return 'À synchroniser'
    case 'synced': return 'Synchronisé'
    case 'conflict': return 'Conflit de synchronisation'
  }
}

/** Selects a short message for the project-selection view. */
function projectStatusLabel(status: ProjectSessionStatus): string {
  switch (status) {
    case 'loading': return 'Chargement des projets'
    case 'list': return 'Aucun projet ouvert'
    case 'opening': return 'Ouverture du projet'
    case 'active': return 'Projet ouvert'
    case 'busy': return 'Opération en cours'
    case 'error': return 'Erreur de projet'
  }
}

/** Chooses a short heading from the actor-owned active project state. */
function projectSelectionTitle(view: ProjectApplicationView): string {
  switch (view.projectStatus) {
    case 'loading': return 'Chargement de vos projets'
    case 'opening': return `Ouverture de ${view.activeProject?.name ?? 'votre projet'}`
    case 'busy': return view.activeProject === null ? 'Gestion des projets' : `Enregistrement de ${view.activeProject.name}`
    case 'error': return 'L’accès au projet a échoué'
    case 'active': return view.activeProject === null ? 'Vos projets' : `Accès à ${view.activeProject.name}`
    case 'list': return 'Vos projets'
  }
}
