import type { Handle, RemixNode } from 'remix/ui'
import type { SnapshotFrom } from 'xstate'
import { isImportChange, type controllerMachine } from '../../../app/controller/controller-machine'
import { LearningEditorContextProvider } from '../composition/learning-editor-context'
import type { LearningEditorFacade } from './learning-editor-facade'
import { editorViewModelEqual, type LearningAuthoringService } from './learning-authoring-service'
import { CATALOG_TAB } from './learning-authoring-config'
import { PopupPreviewHost } from '../../../core/preview/popup-preview-host'
import { learningDocumentService } from '../document/learning-document-service'
import type { LearningDocument } from '../document/learning-document'
import type { LearningDocumentData } from '../document/learning-document-types'
import { renderCoreProjectApplication } from '../../../core/authoring/layout/project-application'
import { downloadElceSightyPackage, requestElceSightyPackage } from '../../../export/elce-sighty-export-client'
import { downloadElceScormPackage, requestElceScormPackage } from '../../../export/elce-scorm-export-client'
import type { ScormVersion } from '../../../scorm/scorm-types'
import { LearningWorkspaceState, renderEditorWorkspace } from './learning-workspace'
import { LearningPageEditor } from './learning-page-editor'
import type { DraggedScenarioEntry, ResponsivePanel, SidePanelTab } from './learning-workspace-types'
import type { ProjectApplicationView, ProjectApplicationWorkspaceState } from './learning-project-application-types'
import type { AppearanceTarget } from '../commands/learning-document-command-types'

const learningPreviewDocumentCodec = {
  encode: (document: LearningDocument) => document.toJSON(),
  decode: (payload: unknown) => learningDocumentService.readDocument(payload),
}

/** Renders project management and the native Remix authoring workspace. */
export function LearningProjectApplication(handle: Handle) {
  const { controller, actions } = handle.context.get(LearningEditorContextProvider)
  if (controller === null || actions === null) {
    return () => <div
      id="elce-remix-project-app"
    />
  }

  let view = selectProjectView(controller.getSnapshot(), actions.authoring)
  const learningWorkspaceState = new LearningWorkspaceState()
  let responsivePanel: ResponsivePanel = null
  let sidePanelTab: SidePanelTab = 'contents'
  let appearanceTarget: AppearanceTarget = { kind: 'document' }
  let appearanceProjectId = view.activeProject?.id ?? null
  let authoringError: string | null = null
  let dropTarget: string | null = null
  let previewError: string | null = null
  let exportBusy = false
  let exportKind: 'sighty' | 'scorm' | null = null
  let exportError: string | null = null
  let exportNotice: string | null = null
  let returnFocusId: string | null = null
  let popupPreviewHost: PopupPreviewHost<LearningDocument, LearningDocumentData> | null = null

  const setResponsivePanel = (panel: ResponsivePanel, triggerId?: string): void => {
    if (panel !== null) returnFocusId = triggerId ?? returnFocusId
    const focusId = panel === null ? returnFocusId : null
    responsivePanel = panel
    if (panel === null) returnFocusId = null
    void handle.update().then(() => {
      if (panel === null && focusId !== null) document.getElementById(focusId)?.focus()
    })
  }
  const setSidePanelTab = (tab: SidePanelTab): void => {
    if (sidePanelTab === tab) return
    sidePanelTab = tab
    void handle.update()
  }
  const openAppearanceTarget = (target: AppearanceTarget, triggerId: string): void => {
    appearanceTarget = target
    sidePanelTab = 'style'
    setResponsivePanel('properties', triggerId)
  }
  const setDropTarget = (targetId: string | null): void => {
    if (dropTarget === targetId) return
    dropTarget = targetId
    void handle.update()
  }
  const setSummarySettingsOpen = (open: boolean): void => {
    learningWorkspaceState.summarySettingsOpen = open
    authoringError = null
    void handle.update()
  }
  /** Keeps profile-variable insertion available only for the active text target. */
  const setProfileTokenTarget = (targetId: string | null): void => {
    if (learningWorkspaceState.profileTokenTargetId === targetId) return
    learningWorkspaceState.profileTokenTargetId = targetId
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
    learningWorkspaceState.draggedEntry = entry
  }
  const openPreview = (): void => {
    previewError = null
    popupPreviewHost ??= new PopupPreviewHost(() => {
      const context = controller.getSnapshot().context
      if (context.activeProject === null) return null
      return {
        projectId: context.activeProject.id,
        document: context.document,
        selectedPageId: context.selection.selectedPageId ?? context.document.pages[0]?.id ?? null,
      }
    }, learningPreviewDocumentCodec)
    if (!popupPreviewHost.open()) previewError = 'Le navigateur a bloqué la fenêtre de lecture.'
    void handle.update()
  }
  /** Opens the export choices from the project title bar. */
  const openExportDialog = (): void => {
    const dialog = document.getElementById('elce-export-dialog') as HTMLDialogElement | null
    if (dialog !== null && !dialog.open) dialog.showModal()
  }
  /** Closes the shared export choices dialog. */
  const closeExportDialog = (): void => {
    const dialog = document.getElementById('elce-export-dialog') as HTMLDialogElement | null
    if (dialog?.open === true) dialog.close()
  }
  /** Packages the current actor snapshot and downloads it without saving or initializing it. */
  const exportScenario = (): void => {
    closeExportDialog()
    const context = controller.getSnapshot().context
    if (exportBusy || context.activeProject === null || context.projectStatus !== 'active' || context.editAccess !== 'active') return
    const documentSnapshot = context.document
    const mediaSources = context.mediaSources
    exportBusy = true
    exportKind = 'sighty'
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
        exportKind = null
        void handle.update()
      }
    })()
  }
  /** Builds the existing Sighty archive, then lets the dedicated SCORM CLI package it. */
  const exportScorm = (version: ScormVersion, monoSco: boolean): void => {
    closeExportDialog()
    const context = controller.getSnapshot().context
    if (exportBusy || context.activeProject === null || context.projectStatus !== 'active' || context.editAccess !== 'active') return
    const documentSnapshot = context.document
    const mediaSources = context.mediaSources
    exportBusy = true
    exportKind = 'scorm'
    exportError = null
    exportNotice = null
    void handle.update()
    void (async () => {
      try {
        const sightyPackage = await requestElceSightyPackage(documentSnapshot, mediaSources)
        const scormPackage = await requestElceScormPackage(sightyPackage, documentSnapshot.data.name, version, monoSco)
        const filename = downloadElceScormPackage(scormPackage.archive, scormPackage.filename)
        exportNotice = monoSco
          ? `Téléchargement de « ${filename} » démarré. Extrayez cette archive pour importer séparément les packages SCORM qu’elle contient.`
          : `Téléchargement de « ${filename} » démarré.`
      } catch (error) {
        exportError = error instanceof Error ? error.message : 'L’export SCORM du scénario Elcé a échoué.'
      } finally {
        exportBusy = false
        exportKind = null
        void handle.update()
      }
    })()
  }
  /** Routes either button or shortcut through the same controller gesture. */
  const runHistoryAction = (kind: 'undo' | 'redo'): void => {
    if (view.activeProject === null || view.projectStatus !== 'active' || view.editAccess !== 'active') return
    if (kind === 'undo') commitFocusedInlineTitle()
    if (kind === 'undo') actions.core.undo()
    else actions.core.redo()
  }
  handle.queueTask(() => {
    const subscription = controller.subscribe((snapshot) => {
      const nextView = selectProjectView(snapshot, actions.authoring)
      if (projectApplicationViewEqual(view, nextView)) return
      const nextProjectId = nextView.activeProject?.id ?? null
      if (appearanceProjectId !== nextProjectId) {
        appearanceProjectId = nextProjectId
        appearanceTarget = { kind: 'document' }
      }
      view = nextView
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
    document.addEventListener('drop', preventUnclaimedFileNavigation)
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
      document.removeEventListener('drop', preventUnclaimedFileNavigation)
      document.removeEventListener('click', closeProjectMenuOnOutsideClick, true)
      window.removeEventListener('resize', handleResize)
      popupPreviewHost?.destroy()
    }
    handle.signal.addEventListener('abort', dispose, { once: true })
  })

  return () => renderApplication(view, actions, {
    responsivePanel,
    sidePanelTab,
    appearanceTarget,
    summarySettingsOpen: learningWorkspaceState.summarySettingsOpen,
    profileTokenTargetId: learningWorkspaceState.profileTokenTargetId,
    authoringError,
    dropTarget,
    visible: view.activeProject !== null && view.projectStatus === 'active' && view.editAccess === 'active',
    setResponsivePanel,
    setSidePanelTab,
    openAppearanceTarget,
    setSummarySettingsOpen,
    setAuthoringError,
    setDropTarget,
    setDraggedEntry,
    getDraggedEntry: () => learningWorkspaceState.draggedEntry,
    onPreview: openPreview,
    previewError,
    onExport: openExportDialog,
    onCloseExportDialog: closeExportDialog,
    onExportSighty: exportScenario,
    onExportScorm: exportScorm,
    exportBusy,
    exportKind,
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

/** Prevents the browser from navigating when no authoring target accepts a file drop. */
function preventUnclaimedFileNavigation(event: DragEvent): void {
  if (!event.defaultPrevented && (event.dataTransfer?.files.length ?? 0) > 0) event.preventDefault()
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

/** Selects only project-management data from the XState-owned application snapshot. */
function selectProjectView(snapshot: SnapshotFrom<typeof controllerMachine>, authoring: LearningAuthoringService): ProjectApplicationView {
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
    editor: authoring.selectEditorViewModel(snapshot),
  }
}

/** Skips parent renders when an actor snapshot leaves every projected value unchanged. */
function projectApplicationViewEqual(left: ProjectApplicationView, right: ProjectApplicationView): boolean {
  return sameProjectSummaries(left.projects, right.projects)
    && sameProjectSummary(left.activeProject, right.activeProject)
    && left.projectStatus === right.projectStatus
    && left.projectError === right.projectError
    && left.accessRecoveryAvailable === right.accessRecoveryAvailable
    && left.recoverableLocalCopy === right.recoverableLocalCopy
    && left.editAccess === right.editAccess
    && left.document === right.document
    && left.history === right.history
    && left.importPending === right.importPending
    && left.syncStatus === right.syncStatus
    && editorViewModelEqual(left.editor, right.editor)
}

/** Compares the visible project catalogue by its stable row fields. */
function sameProjectSummaries(
  left: ProjectApplicationView['projects'],
  right: ProjectApplicationView['projects'],
): boolean {
  return left.length === right.length
    && left.every((project, index) => sameProjectSummary(project, right[index] ?? null))
}

/** Compares a displayed project row by its identifier, name, and revision. */
function sameProjectSummary(
  left: ProjectApplicationView['activeProject'],
  right: ProjectApplicationView['activeProject'],
): boolean {
  if (left === null || right === null) return left === right
  return left.id === right.id && left.name === right.name && left.revision === right.revision
}

/** Composes the Learning workspace inside the shared project-management view. */
function renderApplication(
  view: ProjectApplicationView,
  actions: LearningEditorFacade,
  workspace: ProjectApplicationWorkspaceState,
  runHistoryAction: (kind: 'undo' | 'redo') => void,
): RemixNode {
  return renderCoreProjectApplication({
    view: {
      projects: view.projects,
      activeProject: view.activeProject,
      projectName: view.activeProject === null ? null : view.document.data.name,
      projectStatus: view.projectStatus,
      projectError: view.projectError,
      accessRecoveryAvailable: view.accessRecoveryAvailable,
      recoverableLocalCopy: view.recoverableLocalCopy,
      editAccess: view.editAccess,
      history: view.history,
      importPending: view.importPending,
      syncStatus: view.syncStatus,
    },
    actions: actions.core,
    editorWorkspace: renderEditorWorkspace({
      view: view.editor,
      actions,
      pageEditorHost: view.activeProject !== null && view.projectStatus !== 'loading' && view.projectStatus !== 'busy'
        && view.editor.selectedChapter === undefined
        ? <LearningPageEditor canMoveBdcToPage={actions.authoring.canMoveBdcToPage.bind(actions.authoring)} onOpenAppearanceTarget={workspace.openAppearanceTarget} />
        : null,
      responsivePanel: workspace.responsivePanel,
      sidePanelTab: workspace.sidePanelTab,
      appearanceTarget: workspace.appearanceTarget,
      summarySettingsOpen: workspace.summarySettingsOpen,
      profileTokenTargetId: workspace.profileTokenTargetId,
      authoringError: workspace.authoringError,
      dropTarget: workspace.dropTarget,
      visible: view.activeProject !== null && view.projectStatus !== 'loading' && view.projectStatus !== 'busy',
      editable: view.activeProject !== null && view.projectStatus === 'active' && view.editAccess === 'active',
      onSetResponsivePanel: workspace.setResponsivePanel,
      onSetSidePanelTab: workspace.setSidePanelTab,
      onOpenAppearanceTarget: workspace.openAppearanceTarget,
      onSetSummarySettingsOpen: workspace.setSummarySettingsOpen,
      onSetAuthoringError: workspace.setAuthoringError,
      onSetDropTarget: workspace.setDropTarget,
      onSetDraggedEntry: workspace.setDraggedEntry,
      getDraggedEntry: workspace.getDraggedEntry,
      onPreview: workspace.onPreview,
      previewError: workspace.previewError,
      exportBusy: workspace.exportBusy,
      exportKind: workspace.exportKind,
      exportError: workspace.exportError,
      exportNotice: workspace.exportNotice,
      onMovePage: workspace.movePage,
      onMoveChapter: workspace.moveChapter,
    }),
    export: {
      onExport: workspace.onExport,
      onCloseExportDialog: workspace.onCloseExportDialog,
      onExportSighty: workspace.onExportSighty,
      onExportScorm: workspace.onExportScorm,
      exportBusy: workspace.exportBusy,
    },
    runHistoryAction,
  })
}
