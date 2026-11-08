import type { Handle } from 'remix/component'
import type { SnapshotFrom } from 'xstate'
import { renderCoreProjectApplication } from '../../../core/authoring/layout/project-application'
import type { CoreProjectApplicationView } from '../../../core/authoring/layout/project-application'
import type { EditorPanelName, EditorPanelVisibility } from '../../../core/authoring/layout/editor-frame'
import { initialEditorPanelVisibility, resizedEditorPanelVisibility } from '../../../core/authoring/layout/editor-panel-state.ts'
import { SectionEditorSession } from '../../../resources/bdcs/section/authoring/section-editor-session'
import type { ScormVersion } from '../../../scorm/scorm-types'
import { PopupPreviewHost } from '../../../core/preview/popup-preview-host'
import { POPUP_PREVIEW_PAGE_PARAM, POPUP_PREVIEW_PROJECT_PARAM } from '../../../core/preview/popup-preview-messages'
import { downloadElceScormPackage } from '../../../export/elce-scorm-export-client'
import { downloadQuizHuntSightyPackage, requestQuizHuntSightyPackage } from '../persistence/quiz-hunt-sighty-export-client'
import { requestQuizHuntScormPackage } from '../persistence/quiz-hunt-scorm-export-client.ts'
import { readQuizHuntDocument, writeQuizHuntDocument } from '../persistence/quiz-hunt-document-codec'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { isQuizHuntImportChange, createQuizHuntControllerMachine } from './quiz-hunt-controller'
import { QuizHuntEditorContextProvider } from '../composition/quiz-hunt-editor-context'
import { renderQuizHuntWorkspace } from './quiz-hunt-workspace'
import type { QuizHuntResultPage, QuizHuntWorkspaceInteraction, QuizHuntWorkspaceView } from './quiz-hunt-workspace'

type QuizHuntSnapshot = SnapshotFrom<ReturnType<typeof createQuizHuntControllerMachine>>

const quizHuntPreviewDocumentCodec = {
  encode: writeQuizHuntDocument,
  decode: readQuizHuntDocument,
}

interface QuizHuntProjectView {
  readonly project: CoreProjectApplicationView
  readonly workspace: QuizHuntWorkspaceView
}

/** Renders shared project management around Quiz Hunt's own authoring workspace. */
export function QuizHuntProjectApplication(handle: Handle) {
  const { controller, actions } = handle.context.get(QuizHuntEditorContextProvider)
  if (controller === null || actions === null) return () => <div id="elce-remix-project-app" />

  let view = selectQuizHuntProjectView(controller.getSnapshot())
  const sectionSession = new SectionEditorSession()
  let exportBusy = false
  let exportKind: 'sighty' | 'scorm' | null = null
  let exportError: string | null = null
  let exportNotice: string | null = null
  let previewError: string | null = null
  let popupPreviewHost: PopupPreviewHost<QuizHuntDocument> | null = null
  let panelVisibility: EditorPanelVisibility = initialEditorPanelVisibility(window.innerWidth)
  let previousWindowWidth = window.innerWidth
  let returnFocusId: string | null = null
  let draggedBdcId: string | null = null
  let dropTarget: string | null = null
  let isAddContentMenuOpen = false
  let trashAnimationToken = 0
  let trashAnimationTimer: ReturnType<typeof setTimeout> | undefined
  let introductionFolderOpen = false
  let resultPage: QuizHuntResultPage = null
  let summarySettingsOpen = view.workspace.document.pages.some((page) =>
    page.id === view.workspace.selection.pageId && page.type === 'summary')

  /** Updates the active BDC insertion target and refreshes its shared highlight. */
  const setDropTarget = (targetId: string | null): void => {
    if (dropTarget === targetId) return
    dropTarget = targetId
    if (!handle.signal.aborted) void handle.update()
  }

  /** Opens or closes the shared page BDC creation menu. */
  const setAddContentMenuOpen = (isOpen: boolean): void => {
    if (isAddContentMenuOpen === isOpen) return
    isAddContentMenuOpen = isOpen
    if (!handle.signal.aborted) void handle.update()
  }

  /** Shows Learning's successful delete animation after a page BDC is removed. */
  const animateTrashDropSuccess = (): void => {
    trashAnimationToken += 1
    if (trashAnimationTimer !== undefined) clearTimeout(trashAnimationTimer)
    if (!handle.signal.aborted) void handle.update()
    trashAnimationTimer = setTimeout(() => {
      trashAnimationTimer = undefined
      trashAnimationToken = 0
      if (!handle.signal.aborted) void handle.update()
    }, 420)
  }

  /** Updates the shared responsive panels and restores focus after a close. */
  const setPanelVisibility = (panel: EditorPanelName, open: boolean, triggerId?: string): void => {
    if (open) returnFocusId = triggerId ?? returnFocusId
    const focusId = open ? null : returnFocusId
    panelVisibility = open && window.innerWidth <= 800
      ? { outline: panel === 'outline', properties: panel === 'properties' }
      : { ...panelVisibility, [panel]: open }
    if (!open) returnFocusId = null
    void handle.update().then(() => {
      if (!open && focusId !== null) document.getElementById(focusId)?.focus()
    })
  }

  /** Opens or closes the fixed Sommaire workspace in the central area. */
  const setSummarySettingsOpen = (open: boolean): void => {
    if (summarySettingsOpen === open && !introductionFolderOpen && resultPage === null) return
    summarySettingsOpen = open
    introductionFolderOpen = false
    resultPage = null
    void handle.update()
  }

  /** Opens the empty Introduction chapter landing page. */
  const setIntroductionFolderOpen = (open: boolean): void => {
    if (introductionFolderOpen === open && !summarySettingsOpen && resultPage === null) return
    summarySettingsOpen = false
    introductionFolderOpen = open
    resultPage = null
    void handle.update()
  }

  /** Selects the optional Introduction page through the document controller. */
  const selectIntroductionPage = (pageId: string): void => {
    if (view.workspace.selection.pageId === pageId && !summarySettingsOpen && resultPage === null) return
    summarySettingsOpen = false
    introductionFolderOpen = false
    resultPage = null
    actions.selectPage(pageId)
    void handle.update()
  }

  /** Selects one of the existing result Cards in its virtual authoring page. */
  const selectResultPage = (page: QuizHuntResultPage): void => {
    if (resultPage === page && !summarySettingsOpen) return
    summarySettingsOpen = false
    introductionFolderOpen = false
    resultPage = page
    void handle.update()
  }

  /** Opens the shared export dialog while retaining the active document state. */
  const openExportDialog = (): void => {
    const dialog = document.getElementById('elce-export-dialog') as HTMLDialogElement | null
    if (dialog !== null && !dialog.open) dialog.showModal()
  }

  /** Closes the shared export dialog. */
  const closeExportDialog = (): void => {
    const dialog = document.getElementById('elce-export-dialog') as HTMLDialogElement | null
    if (dialog?.open === true) dialog.close()
  }

  /** Opens a synchronized reader from the current Quiz Hunt project snapshot. */
  const openPreview = (): void => {
    previewError = null
    const activeProject = controller.getSnapshot().context.activeProject
    if (activeProject === null) return
    if (window.__ELCE_PREVIEW_ORIGIN__ !== undefined && window.__ELCE_PREVIEW_ORIGIN__ !== null) {
      const context = controller.getSnapshot().context
      const url = new URL(window.__ELCE_PREVIEW_ORIGIN__)
      url.searchParams.set('mod', 'quiz-hunt')
      url.searchParams.set(POPUP_PREVIEW_PROJECT_PARAM, activeProject.id)
      const selectedPageId = context.selection.pageId ?? context.document.pages[0]?.id
      if (selectedPageId === undefined) url.searchParams.delete(POPUP_PREVIEW_PAGE_PARAM)
      else url.searchParams.set(POPUP_PREVIEW_PAGE_PARAM, selectedPageId)
      const popup = window.open(url.href, 'elce-player-preview', 'popup,width=1280,height=840')
      if (popup === null) previewError = 'Le navigateur a bloqué la fenêtre de lecture.'
      else popup.focus()
      void handle.update()
      return
    }
    popupPreviewHost ??= new PopupPreviewHost(() => {
      const context = controller.getSnapshot().context
      if (context.activeProject === null) return null
      return {
        projectId: context.activeProject.id,
        document: context.document,
        selectedPageId: context.selection.pageId ?? context.document.pages[0]?.id ?? null,
      }
    }, quizHuntPreviewDocumentCodec, (listener) => {
      const subscription = controller.subscribe(() => listener())
      return () => subscription.unsubscribe()
    })
    if (!popupPreviewHost.open()) previewError = 'Le navigateur a bloqué la fenêtre de lecture.'
    void handle.update()
  }

  /** Builds and downloads the real Quiz Hunt Sighty scenario. */
  const exportSighty = (): void => {
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
        const packageBlob = await requestQuizHuntSightyPackage(documentSnapshot, mediaSources)
        const filename = downloadQuizHuntSightyPackage(packageBlob, documentSnapshot.name)
        exportNotice = `Téléchargement de « ${filename} » démarré.`
      } catch (error) {
        exportError = error instanceof Error ? error.message : 'L’export du scénario Quiz Hunt a échoué.'
      } finally {
        exportBusy = false
        exportKind = null
        void handle.update()
      }
    })()
  }

  /** Packages the Sighty archive as SCORM using the common exporter. */
  const exportScorm = (version: ScormVersion): void => {
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
        const sightyPackage = await requestQuizHuntSightyPackage(documentSnapshot, mediaSources)
        const scormPackage = await requestQuizHuntScormPackage(sightyPackage, documentSnapshot.name, version)
        const filename = downloadElceScormPackage(scormPackage.archive, scormPackage.filename)
        exportNotice = `Téléchargement du package monoSCO « ${filename} » démarré.`
      } catch (error) {
        exportError = error instanceof Error ? error.message : 'L’export SCORM Quiz Hunt a échoué.'
      } finally {
        exportBusy = false
        exportKind = null
        void handle.update()
      }
    })()
  }

  /** Runs one shared document-history action only while the project is editable. */
  const runHistoryAction = (kind: 'undo' | 'redo'): void => {
    if (view.project.activeProject === null || view.project.projectStatus !== 'active' || view.project.editAccess !== 'active') return
    if (kind === 'undo') actions.core.undo()
    else actions.core.redo()
  }

  handle.queueTask(() => {
    const subscription = controller.subscribe((snapshot) => {
      const previousHistoryRestore = view.workspace.historySelection
      const next = selectQuizHuntProjectView(snapshot)
      if (sameQuizHuntProjectView(view, next)) return
      if (view.project.activeProject?.id !== next.project.activeProject?.id
        || view.workspace.selection.pageId !== next.workspace.selection.pageId) {
        summarySettingsOpen = next.workspace.document.pages.some((page) =>
          page.id === next.workspace.selection.pageId && page.type === 'summary')
        introductionFolderOpen = false
        resultPage = null
      }
      for (const bdc of next.workspace.document.bdcs) {
        if (bdc.section !== null) sectionSession.updateSection(bdc.id, bdc.section)
      }
      view = next
      void handle.update().then(() => {
        const restore = view.workspace.historySelection
        if (restore === null || restore === previousHistoryRestore || restore.sectionSelection === null) return
        sectionSession.restoreSelection(restore.sectionSelection)
      })
    })
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && window.innerWidth <= 800) {
        const openPanel = panelVisibility.outline ? 'outline' : panelVisibility.properties ? 'properties' : null
        if (openPanel !== null) setPanelVisibility(openPanel, false)
      }
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'z') return
      if (view.project.activeProject === null || view.project.projectStatus !== 'active' || view.project.editAccess !== 'active') return
      event.preventDefault()
      event.stopPropagation()
      runHistoryAction(event.shiftKey ? 'redo' : 'undo')
    }
    const handleResize = (): void => {
      const nextWidth = window.innerWidth
      panelVisibility = resizedEditorPanelVisibility(panelVisibility, previousWindowWidth, nextWidth)
      previousWindowWidth = nextWidth
      void handle.update()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)
    handle.signal.addEventListener('abort', () => {
      subscription.unsubscribe()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
      popupPreviewHost?.destroy()
      if (trashAnimationTimer !== undefined) clearTimeout(trashAnimationTimer)
      sectionSession.destroy()
    }, { once: true })
  })

  return () => {
    const projectVisible = view.project.activeProject !== null
      && view.project.projectStatus !== 'loading'
      && view.project.projectStatus !== 'busy'
    const workspace = projectVisible ? renderQuizHuntWorkspace({
      ...view.workspace,
      editable: view.project.projectStatus === 'active' && view.project.editAccess === 'active',
      exportBusy,
      exportKind,
      exportError,
      exportNotice,
      previewError,
      onPreview: openPreview,
    }, actions, sectionSession, handle, {
      panelVisibility,
      summarySettingsOpen,
      introductionFolderOpen,
      resultPage,
      getDraggedBdcId: () => draggedBdcId,
      onSetDraggedBdcId: (bdcId) => { draggedBdcId = bdcId },
      dropTarget,
      onSetDropTarget: setDropTarget,
      isAddContentMenuOpen,
      onSetAddContentMenuOpen: setAddContentMenuOpen,
      trashAnimationToken,
      onTrashDropSuccess: animateTrashDropSuccess,
      onSetSummarySettingsOpen: setSummarySettingsOpen,
      onSetIntroductionFolderOpen: setIntroductionFolderOpen,
      onSelectIntroductionPage: selectIntroductionPage,
      onSelectResultPage: selectResultPage,
      onSetPanelVisibility: setPanelVisibility,
    } satisfies QuizHuntWorkspaceInteraction) : null
    return renderCoreProjectApplication({
      view: view.project,
      actions: actions.core,
      editorWorkspace: workspace,
      export: {
        onExport: openExportDialog,
        onCloseExportDialog: closeExportDialog,
        onExportSighty: exportSighty,
        onExportScorm: exportScorm,
        exportBusy,
        showMonoScoOption: false,
        scormDescription: 'La partie complète est exportée dans un seul SCO.',
      },
      runHistoryAction,
    })
  }
}

/** Projects actor-owned document, session and selection values into the shared frame. */
function selectQuizHuntProjectView(snapshot: QuizHuntSnapshot): QuizHuntProjectView {
  const context = snapshot.context
  return {
    project: {
      projects: context.projects,
      activeProject: context.activeProject,
      projectName: context.activeProject === null ? null : context.document.name,
      projectStatus: context.projectStatus,
      projectError: context.projectError,
      accessRecoveryAvailable: context.accessRecoveryAvailable,
      recoverableLocalCopy: context.recoverableLocalCopy,
      editAccess: context.editAccess,
      history: context.history,
      importPending: context.documentChanges.some(isQuizHuntImportChange),
      syncStatus: context.syncStatus,
    },
    workspace: {
      document: context.document,
      selection: context.selection,
      historySelection: context.historyRestore?.selection ?? null,
      mediaSources: context.mediaSources,
      importPending: context.documentChanges.some(isQuizHuntImportChange),
      editable: context.activeProject !== null && context.projectStatus === 'active' && context.editAccess === 'active',
      exportBusy: false,
      exportKind: null,
      exportError: null,
      exportNotice: null,
      previewError: null,
      onPreview: () => undefined,
    },
  }
}

/** Skips a project frame render when actor-owned authoring values did not change. */
function sameQuizHuntProjectView(left: QuizHuntProjectView, right: QuizHuntProjectView): boolean {
  return left.project.projects === right.project.projects
    && left.project.activeProject === right.project.activeProject
    && left.project.projectStatus === right.project.projectStatus
    && left.project.projectError === right.project.projectError
    && left.project.accessRecoveryAvailable === right.project.accessRecoveryAvailable
    && left.project.recoverableLocalCopy === right.project.recoverableLocalCopy
    && left.project.editAccess === right.project.editAccess
    && left.project.history === right.project.history
    && left.project.importPending === right.project.importPending
    && left.project.syncStatus === right.project.syncStatus
    && left.workspace.document === right.workspace.document
    && left.workspace.selection === right.workspace.selection
    && left.workspace.historySelection === right.workspace.historySelection
    && left.workspace.mediaSources === right.workspace.mediaSources
    && left.workspace.editable === right.workspace.editable
  }
