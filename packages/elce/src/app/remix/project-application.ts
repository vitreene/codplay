import { on, type Handle, type RemixNode } from 'remix/ui'
import { jsx } from 'remix/ui/jsx-runtime'
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
import type { DraggedScenarioEntry, ResponsivePanel } from './workspace/editor-workspace-types'
import { renderLucideIcon } from './lucide-static-icon'
import type { ProjectApplicationView, ProjectApplicationWorkspaceState } from './project-application-types'

/** Renders the Remix project menu and shows the temporary editor only for an open project. */
export function ProjectApplication(handle: Handle) {
  const { controller, actions } = handle.context.get(EditorContextProvider)
  if (controller === null || actions === null) {
    return () => jsx('div', { id: 'elce-remix-project-app' })
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

/** Renders the project switcher, project list, and preserved React work-area host. */
function renderApplication(
  view: ProjectApplicationView,
  actions: EditorActionsFacade,
  workspace: ProjectApplicationWorkspaceState,
): RemixNode {
  const editorVisible = view.activeProject !== null && view.projectStatus === 'active' && view.editAccess === 'active'
  const currentName = view.activeProject === null ? null : view.document.data.name
  return jsx('div', {
    id: 'elce-remix-project-app',
    children: [
      jsx('header', {
        id: 'elce-project-header',
        className: 'elce-project-header',
        children: [
          jsx('div', {
            id: 'elce-project-header-brand',
          className: 'elce-project-header-brand',
            children: [
              jsx('strong', { id: 'elce-project-brand-name', children: 'Elcé' }),
              editorVisible ? renderWorkspaceAccess(workspace) : null,
            ],
          }),
          jsx('details', {
            id: 'elce-project-menu',
            className: 'elce-project-menu',
            children: [
              jsx('summary', {
                id: 'elce-project-menu-trigger',
                children: currentName === null ? 'Projets' : currentName,
              }),
              jsx('div', {
                id: 'elce-project-menu-panel',
                className: 'elce-project-menu-panel',
                children: [
                  jsx('button', {
                    id: 'elce-project-create',
                    type: 'button',
                    disabled: view.projectStatus === 'busy' || view.projectStatus === 'loading',
                    mix: on<HTMLButtonElement, 'click'>('click', () => actions.createProject()),
                    children: 'Nouveau projet',
                  }),
                  jsx('button', {
                    id: 'elce-project-refresh',
                    type: 'button',
                    disabled: view.projectStatus === 'busy' || view.projectStatus === 'loading',
                    mix: on<HTMLButtonElement, 'click'>('click', () => actions.refreshProjects()),
                    children: 'Actualiser',
                  }),
                  view.activeProject === null ? null : jsx('button', {
                    id: 'elce-project-close',
                    type: 'button',
                    disabled: view.projectStatus === 'busy',
                    mix: on<HTMLButtonElement, 'click'>('click', () => actions.closeProject()),
                    children: 'Fermer le projet',
                  }),
                  view.activeProject === null ? null : jsx('form', {
                    id: 'elce-project-rename-form',
                    className: 'elce-project-rename-form',
                    mix: on<HTMLFormElement, 'submit'>('submit', (event) => {
                      event.preventDefault()
                      const form = event.currentTarget
                      const name = new FormData(form).get('projectName')
                      if (typeof name === 'string' && name.trim() !== '') actions.renameActiveProject(name.trim())
                    }),
                    children: [
                      jsx('label', { id: 'elce-project-rename-label', htmlFor: 'elce-project-rename-input', children: 'Nom du projet' }),
                      jsx('input', {
                        id: 'elce-project-rename-input',
                        name: 'projectName',
                        type: 'text',
                        defaultValue: currentName ?? '',
                        maxLength: 120,
                      }),
                      jsx('button', { id: 'elce-project-rename-submit', type: 'submit', children: 'Renommer' }),
                    ],
                  }),
                  jsx('ul', {
                    id: 'elce-project-menu-list',
                    className: 'elce-project-list elce-project-list--menu',
                    children: projectRows(view, actions, 'menu'),
                  }),
                ],
              }),
            ],
          }),
          jsx('span', {
            id: 'elce-project-sync-status',
            className: 'elce-project-sync-status',
            role: 'status',
            'aria-live': 'polite',
            children: editorVisible ? syncStatusLabel(view.syncStatus) : projectStatusLabel(view.projectStatus),
          }),
        ],
      }),
      editorVisible ? null : renderProjectSelection(view, actions),
      renderEditorWorkspace({
        view: view.editor,
        actions,
        pageEditorHost: jsx(ReactEditorTempBridge, { hidden: !editorVisible || view.editor.selectedChapter !== undefined }),
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
      }),
    ],
  })
}

/** Renders the responsive panel commands beside the Elcé brand. */
function renderWorkspaceAccess(
  workspace: ProjectApplicationWorkspaceState,
): RemixNode {
  return jsx('nav', {
    id: 'elce-responsive-panel-access',
    className: 'elce-responsive-panel-access',
    'aria-label': 'Panneaux de l’éditeur',
    children: [
      renderPanelToggle('outline', workspace.responsivePanel, workspace.setResponsivePanel),
      renderPanelToggle('properties', workspace.responsivePanel, workspace.setResponsivePanel),
    ],
  })
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
  return jsx('button', {
    id,
    className,
    type: 'button',
    'aria-label': label,
    title,
    'aria-expanded': responsivePanel === panel,
    'aria-controls': targetId,
    mix: on<HTMLButtonElement, 'click'>('click', () => setResponsivePanel(panel, id)),
    children: renderLucideIcon(icon, `${id}-icon`, 18),
  })
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
  return jsx('main', {
    id: 'elce-project-selection',
    className: 'elce-project-selection',
    children: [
      jsx('section', {
        id: 'elce-project-selection-panel',
        className: 'elce-project-selection-panel',
        children: [
          jsx('h1', { id: 'elce-project-selection-title', children: projectSelectionTitle(view) }),
          view.projectError === null ? null : jsx('p', {
            id: 'elce-project-error',
            className: 'elce-project-error',
            role: 'alert',
            children: view.projectError,
          }),
          view.activeProject !== null && view.editAccess !== 'active'
            ? jsx('p', {
                id: 'elce-project-access-waiting',
                role: 'status',
                children: `En attente de l’accès au projet « ${view.activeProject.name} ». Fermez son autre fenêtre si elle ne libère pas l’accès.`,
              })
            : null,
          view.projectStatus === 'loading' || view.projectStatus === 'busy'
            ? jsx('p', { id: 'elce-project-loading', role: 'status', children: 'Chargement…' })
            : null,
          jsx('button', {
            id: 'elce-project-create-empty',
            className: 'elce-project-primary-action',
            type: 'button',
            disabled: view.projectStatus === 'busy' || view.projectStatus === 'loading',
            mix: on<HTMLButtonElement, 'click'>('click', () => actions.createProject()),
            children: 'Créer un projet',
          }),
          jsx('ul', {
            id: 'elce-project-selection-list',
            className: 'elce-project-list',
            children: projectRows(view, actions, 'selection'),
          }),
        ],
      }),
    ],
  })
}

/** Renders project open and delete commands for one server-owned list. */
function projectRows(view: ProjectApplicationView, actions: EditorActionsFacade, surface: 'menu' | 'selection'): RemixNode[] {
  return view.projects.map((project) => {
    const isActive = view.activeProject?.id === project.id
    const prefix = `elce-project-${surface}-${project.id}`
    return jsx('li', {
      id: `${prefix}-row`,
      className: isActive ? 'elce-project-list-row elce-project-list-row--active' : 'elce-project-list-row',
      children: [
        jsx('span', { id: `${prefix}-name`, children: isActive ? view.document.data.name : project.name }),
        jsx('button', {
          id: `${prefix}-open`,
          type: 'button',
          disabled: isActive || view.projectStatus === 'busy' || view.projectStatus === 'loading',
          mix: on<HTMLButtonElement, 'click'>('click', () => actions.openProject(project.id)),
          children: isActive ? 'Ouvert' : 'Ouvrir',
        }),
        jsx('button', {
          id: `${prefix}-delete`,
          type: 'button',
          disabled: view.projectStatus === 'busy' || view.projectStatus === 'loading',
          mix: on<HTMLButtonElement, 'click'>('click', () => {
            if (window.confirm(`Supprimer le projet « ${project.name} » ?`)) actions.deleteProject(project.id)
          }),
          children: 'Supprimer',
        }),
      ],
    }, project.id)
  })
}

/** Keeps the React editor host mounted so Remix can preserve its DOM across route updates. */
function ReactEditorTempBridge(handle: Handle<Readonly<{ hidden: boolean }>>) {
  return () => jsx('div', {
    id: 'elce-react-temp-host',
    hidden: handle.props.hidden,
    'data-rmx-preserve-dom': true,
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
