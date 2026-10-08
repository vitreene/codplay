import { on, type Handle, type RemixNode } from 'remix/ui'

import { Images, List } from 'lucide-static'
import type { SnapshotFrom } from 'xstate'
import type { DocumentSyncState } from '../../infrastructure/indexed-db/document-store-types'
import type { controllerMachine } from '../controller/controller-machine'
import { EditorContextProvider } from './editor-context'
import type { EditorActionsFacade } from '../facades/editor-actions-facade'
import type { ProjectSessionStatus } from '../projects/project-session-types'
import { selectEditorViewModel } from '../selectors/editor-view-model'
import { PopupPreviewHost } from '../player/popup-preview-host'
import { renderEditorWorkspace } from './workspace/editor-workspace'
import { RemixPageEditor } from './workspace/page-editor'
import type { DraggedScenarioEntry, ResponsivePanel } from './workspace/editor-workspace-types'
import { renderLucideIcon } from './lucide-static-icon'
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
  let dropTarget: string | null = null
  let draggedEntry: DraggedScenarioEntry = null
  let previewError: string | null = null
  let returnFocusId: string | null = null
  let popupPreviewHost: PopupPreviewHost | null = null

  const setResponsivePanel = (panel: ResponsivePanel, triggerId?: string): void => {
    if (panel !== null) returnFocusId = triggerId ?? returnFocusId
    const focusId = panel === null ? returnFocusId : null
    responsivePanel = panel
    if (panel === null) returnFocusId = null
    void handle.update().then(() => {
      const targetId = panel === null ? focusId : panelCloseButtonId(panel)
      if (targetId !== null) document.getElementById(targetId)?.focus()
    })
  }
  const setDropTarget = (targetId: string | null): void => {
    if (dropTarget === targetId) return
    dropTarget = targetId
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
  handle.queueTask(() => {
    const subscription = controller.subscribe((snapshot) => {
      view = selectProjectView(snapshot)
      void handle.update()
    })
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (responsivePanel === null) return
      if (event.key === 'Escape') {
        setResponsivePanel(null)
        return
      }
      if (event.key !== 'Tab') return
      const panelId = responsivePanel === 'outline' ? 'elce-outline' : 'elce-properties'
      const panel = document.getElementById(panelId)
      if (panel === null) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (first === undefined || last === undefined) return
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
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
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)
    const dispose = (): void => {
      subscription.unsubscribe()
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
      popupPreviewHost?.destroy()
    }
    handle.signal.addEventListener('abort', dispose, { once: true })
  })

  return () => renderApplication(view, actions, {
    responsivePanel,
    dropTarget,
    visible: view.activeProject !== null && view.projectStatus === 'active' && view.editAccess === 'active',
    setResponsivePanel,
    setDropTarget,
    setDraggedEntry,
    getDraggedEntry: () => draggedEntry,
    onPreview: openPreview,
    previewError,
    movePage: (pageId, placement) => actions.movePage(pageId, placement),
    moveChapter: (chapterId, index) => actions.moveChapter(chapterId, index),
  })
}

/** Selects only project-management data from the XState-owned application snapshot. */
function selectProjectView(snapshot: SnapshotFrom<typeof controllerMachine>): ProjectApplicationView {
  return {
    projects: snapshot.context.projects,
    activeProject: snapshot.context.activeProject,
    projectStatus: snapshot.context.projectStatus,
    projectError: snapshot.context.projectError,
    editAccess: snapshot.context.editAccess,
    document: snapshot.context.document,
    syncStatus: snapshot.context.syncStatus,
    editor: selectEditorViewModel(snapshot),
  }
}

/** Renders the project switcher, project list, and Remix work area. */
function renderApplication(
  view: ProjectApplicationView,
  actions: EditorActionsFacade,
  workspace: ProjectApplicationWorkspaceState,
): RemixNode {
  const editorVisible = view.activeProject !== null && view.projectStatus === 'active' && view.editAccess === 'active'
  const currentName = view.activeProject === null ? null : view.document.data.name
  return <div
    id="elce-remix-project-app"
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
        {editorVisible ? renderWorkspaceAccess(workspace) : null}
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
            id="elce-project-close"
            type="button"
            disabled={view.projectStatus === 'busy'}
            mix={on<HTMLButtonElement, 'click'>('click', () => actions.closeProject())}
          >
            Fermer le projet
          </button>}
          {view.activeProject === null ? null : <form
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
      <span
        id="elce-project-sync-status"
        className="elce-project-sync-status"
        role="status"
        aria-live="polite"
      >
        {editorVisible ? syncStatusLabel(view.syncStatus) : projectStatusLabel(view.projectStatus)}
      </span>
    </header>
    {editorVisible ? null : renderProjectSelection(view, actions)}
    {renderEditorWorkspace({
      view: view.editor,
      actions,
      pageEditorHost: editorVisible && view.editor.selectedChapter === undefined
        ? <RemixPageEditor
          onPreview={workspace.onPreview}
          previewError={workspace.previewError}
        />
        : null,
      responsivePanel: workspace.responsivePanel,
      dropTarget: workspace.dropTarget,
      visible: editorVisible,
      onSetResponsivePanel: workspace.setResponsivePanel,
      onSetDropTarget: workspace.setDropTarget,
      onSetDraggedEntry: workspace.setDraggedEntry,
      getDraggedEntry: workspace.getDraggedEntry,
      onPreview: workspace.onPreview,
      previewError: workspace.previewError,
      onMovePage: workspace.movePage,
      onMoveChapter: workspace.moveChapter,
    })}
  </div>
}

/** Renders the responsive panel commands beside the Elcé brand. */
function renderWorkspaceAccess(
  workspace: ProjectApplicationWorkspaceState,
): RemixNode {
  return <nav
    id="elce-responsive-panel-access"
    className="elce-responsive-panel-access"
    aria-label="Panneaux de l’éditeur"
  >
    {renderPanelToggle('outline', workspace.responsivePanel, workspace.setResponsivePanel)}
    {renderPanelToggle('properties', workspace.responsivePanel, workspace.setResponsivePanel)}
  </nav>
}

/** Renders one panel toggle using its documented breakpoint and accessible label. */
function renderPanelToggle(
  panel: Exclude<ResponsivePanel, null>,
  responsivePanel: ResponsivePanel,
  setResponsivePanel: (panel: ResponsivePanel, triggerId?: string) => void,
): RemixNode {
  const outline = panel === 'outline'
  const id = outline ? 'elce-outline-toggle' : 'elce-properties-toggle'
  const label = outline ? 'Ouvrir le scénario' : 'Ouvrir les contenus disponibles'
  const title = outline ? 'Scénario' : 'Contenus disponibles'
  const targetId = outline ? 'elce-outline' : 'elce-properties'
  const icon = outline ? List : Images
  const className = responsivePanel === panel
    ? `elce-responsive-panel-toggle elce-responsive-panel-toggle--${panel} elce-responsive-panel-toggle--open`
    : `elce-responsive-panel-toggle elce-responsive-panel-toggle--${panel}`
  return <button
    id={id}
    className={className}
    type="button"
    aria-label={label}
    title={title}
    aria-expanded={responsivePanel === panel}
    aria-controls={targetId}
    mix={on<HTMLButtonElement, 'click'>('click', () => setResponsivePanel(panel, id))}
  >
    {renderLucideIcon(icon, `${id}-icon`, 18)}
  </button>
}

/** Returns the close control that should receive focus after a drawer opens. */
function panelCloseButtonId(panel: Exclude<ResponsivePanel, null>): string {
  switch (panel) {
    case 'outline':
      return 'elce-outline-close'
    case 'properties':
      return 'elce-properties-close'
  }
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
