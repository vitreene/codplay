import { useSelector } from '@xstate/react'
import { Fragment, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Archive, BadgeCheck, ClipboardCheck, FilePlus, FileText, Folder, FolderPlus, GripVertical, Images, List, ListChecks, Presentation, RectangleHorizontal, Trash2, X } from 'lucide-react'
import './app-layout.css'

import { ANCHOR_RETURN, BDC_ORDER, BDC_LOCATION, BDC_TYPE, CATALOG_REFERENCE, CATALOG_TAB, CHAPTER_TYPE, CHAPTER_TYPE_CONFIG, DEFAULT_EVALUATION_SETTINGS, EVALUATION_RETRY_SCOPE, MEDIA_TYPE, PAGE_LOCATION, PAGE_TYPE, SCENARIO_ENTRY_KIND } from '../../config/document-config'
import type { ChapterType, EvaluationRetryScope, PageType } from '../../config/document-config-types'
import {
  createChapterCommand,
  createChapterMoveCommand,
  createCarouselBdcCommand,
  createEvaluationResultBdcCommand,
  createPageDeleteCommand,
  createPageMoveCommand,
  createSectionBdcCommand,
  createStandaloneCardBdcCommand,
} from '../commands/document-commands'
import type { PagePlacement } from '../commands/document-command-types'
import type { AppLayoutProps } from './app-layout-types'
import { SectionEditor } from '../editor/section-editor'
import { CarouselEditor } from '../editor/carousel-editor'
import { QuestionEditor } from '../editor/question-editor'
import { EvaluationResultEditor } from '../editor/evaluation-result-editor'
import { CardEditor } from '../editor/card/card-editor'
import { PlayerPreview } from '../player/player-preview'
import { PopupPreviewHost } from '../player/popup-preview-host'
import { PREVIEW_SURFACE } from '../player/preview-surface-config'
import { createStableId } from '../../domain/document-model'
import type { ElceDocument } from '../../domain/document-model'
import type { Chapter } from '../../domain/document-types'
import { ElceAnchorDropFacade } from '../../domain/anchor-drop-facade'
import { ElcePageMediaService } from '../../domain/page-media-service'
import { ElceQuestionFacade } from '../../domain/question-facade'
import { ElceCarouselFacade, createCarouselBdcId } from '../../domain/carousel-facade'
import { ElceCardFacade } from '../../domain/card/card-facade'
import type { ElceQuestionEditorActions } from '../../domain/question-facade-types'
import type { QuestionContent } from '../../domain/question-types'
import type { EvaluationResultContent } from '../../domain/evaluation/evaluation-result-types'
import type { ElceCatalogMediaEntry, ElceCatalogReference } from '../../domain/catalog-types'
import type { ScenarioEntry } from '../../domain/scenario-entry-types'

const pageMediaService = new ElcePageMediaService()
const PROPERTIES_DRAWER_BREAKPOINT_PX = 1200
const OUTLINE_DRAWER_BREAKPOINT_PX = 800
type ResponsivePanel = 'outline' | 'properties' | null
type ScenarioPagePlacement = Extract<PagePlacement, { kind: typeof PAGE_LOCATION.SCENARIO }>
const chapterIcons = {
  folder: Folder,
  'clipboard-check': ClipboardCheck,
} as const

/** Renders the chapter type icon and any label configured for that type. */
function ChapterTypeMark({ type }: Readonly<{ type: ChapterType }>) {
  const presentation = CHAPTER_TYPE_CONFIG[type]
  const Icon = chapterIcons[presentation.icon]
  return (
    <span className="elce-chapter-type-mark">
      <Icon aria-hidden="true" size={14} strokeWidth={2} />
      {presentation.label === null ? null : <span>{presentation.label}</span>}
    </span>
  )
}

/** Renders the Elcé work area from the controller-owned application state. */
export function AppLayout({ controller }: AppLayoutProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [responsivePanel, setResponsivePanel] = useState<ResponsivePanel>(null)
  const popupPreviewHostRef = useRef<PopupPreviewHost | null>(null)
  const outlineDrawerRef = useRef<HTMLElement | null>(null)
  const propertiesDrawerRef = useRef<HTMLElement | null>(null)
  const outlineToggleRef = useRef<HTMLButtonElement | null>(null)
  const propertiesToggleRef = useRef<HTMLButtonElement | null>(null)
  const outlineCloseRef = useRef<HTMLButtonElement | null>(null)
  const propertiesCloseRef = useRef<HTMLButtonElement | null>(null)
  const responsivePanelWasOpenRef = useRef<ResponsivePanel>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const draggedEntry = useRef<ScenarioEntry | null>(null)
  const draggedBdcId = useRef<string | null>(null)
  const anchorDropFacadeRef = useRef<ElceAnchorDropFacade | null>(null)
  if (anchorDropFacadeRef.current === null) {
    anchorDropFacadeRef.current = new ElceAnchorDropFacade({
      dispatch: (sectionBdcId, change) => controller.send({ type: 'section.change', sectionBdcId, change }),
    })
  }
  const anchorDropFacade = anchorDropFacadeRef.current
  const questionFacadeRef = useRef<ElceQuestionFacade | null>(null)
  if (questionFacadeRef.current === null) {
    questionFacadeRef.current = new ElceQuestionFacade({
      dispatch: (command) => controller.send({ type: 'document.apply', command }),
      importMedia: (bdcId, mediaImport) => controller.send({
        type: 'question.media.file.import',
        bdcId,
        file: mediaImport.file,
        media: mediaImport.media,
      }),
    })
  }
  const questionFacade = questionFacadeRef.current
  const carouselFacadeRef = useRef<ElceCarouselFacade | null>(null)
  if (carouselFacadeRef.current === null) {
    carouselFacadeRef.current = new ElceCarouselFacade({
      dispatch: (command) => controller.send({ type: 'document.apply', command }),
      selectCard: (bdcId) => controller.send({ type: 'carousel.card.select', bdcId }),
      importMedia: (bdcId, mediaImport) => controller.send({
        type: 'card.media.file.import',
        bdcId,
        file: mediaImport.file,
        media: mediaImport.media,
      }),
    })
  }
  const carouselFacade = carouselFacadeRef.current
  const cardFacadeRef = useRef<ElceCardFacade | null>(null)
  if (cardFacadeRef.current === null) {
    cardFacadeRef.current = new ElceCardFacade({
      dispatch: (command) => controller.send({ type: 'document.apply', command }),
      importMedia: (bdcId, mediaImport) => controller.send({
        type: 'card.media.file.import',
        bdcId,
        file: mediaImport.file,
        media: mediaImport.media,
      }),
    })
  }
  const cardFacade = cardFacadeRef.current
  const documentModel = useSelector(controller, (snapshot) => snapshot.context.document)
  const selectedPageId = useSelector(controller, (snapshot) => snapshot.context.selectedPageId)
  const selectedChapterId = useSelector(controller, (snapshot) => snapshot.context.selectedChapterId)
  const selectedCarouselCardBdcId = useSelector(controller, (snapshot) => snapshot.context.selectedCarouselCardBdcId)
  const catalogTab = useSelector(controller, (snapshot) => snapshot.context.catalogTab)
  const mediaSources = useSelector(controller, (snapshot) => snapshot.context.mediaSources)
  const mediaSourceKey = Object.keys(mediaSources).sort().join('|')
  const selectedPage = documentModel.pages.find((page) => page.id === selectedPageId) ?? documentModel.pages[0]
  const selectedChapter = selectedChapterId === null
    ? undefined
    : documentModel.chapters.find((chapter) => chapter.id === selectedChapterId)
  const pageChapter = selectedPage?.chapterId === null || selectedPage === undefined
    ? undefined
    : documentModel.chapters.find((chapter) => chapter.id === selectedPage.chapterId)
  const selectedPageBdcs = selectedPage === undefined
    ? []
    : selectedPage.bdcIds.flatMap((bdcId) => {
        const bdc = documentModel.bdcs.find((candidate) => candidate.id === bdcId)
        switch (bdc?.type) {
          case BDC_TYPE.SECTION:
            return bdc.section === null ? [] : [bdc]
          case BDC_TYPE.QUESTION:
            return bdc.question === null ? [] : [bdc]
          case BDC_TYPE.EVALUATION_RESULT:
            return bdc.evaluationResult == null ? [] : [bdc]
          case BDC_TYPE.CAROUSEL:
            return bdc.carousel == null ? [] : [bdc]
          case BDC_TYPE.CARD:
            return bdc.card == null ? [] : [bdc]
          default:
            return []
        }
      })
  const pageHasQuestion = selectedPageBdcs.some((bdc) => bdc.type === BDC_TYPE.QUESTION)
  const pageHasCarousel = selectedPageBdcs.some((bdc) => bdc.type === BDC_TYPE.CAROUSEL)
  const pageHasContent = selectedPageBdcs.length > 0
  const canCreateQuestion = pageAllowsQuestion(selectedPage)
    && !pageHasQuestion
    && (selectedPage?.type !== PAGE_TYPE.DIAPO || !pageHasContent)
  const canCreateSection = pageAllowsSection(selectedPage)
  const canCreateEvaluationResult = pageAllowsEvaluationResult(selectedPage, documentModel.chapters)
  const canCreateCarousel = selectedPage?.type === PAGE_TYPE.FLUX
    || (selectedPage?.type === PAGE_TYPE.DIAPO && !pageHasContent && !pageHasCarousel)
  const canCreateStandaloneCard = selectedPage?.type === PAGE_TYPE.DIAPO && !pageHasContent
  const mediaById = Object.fromEntries(documentModel.medias.map((media) => [media.id, {
    name: media.name,
    type: media.type,
    source: mediaSources[media.id] ?? null,
  }]))
  const catalogContents = anchorDropFacade.catalogContents(documentModel)
  const unanchoredMediaBdcs = selectedPage === undefined || selectedChapter !== undefined
    ? []
    : pageMediaService.unanchoredMediaBdcs(documentModel, selectedPage)

  useEffect(() => () => popupPreviewHostRef.current?.destroy(), [])

  useEffect(() => {
    /** Closes a responsive panel when its inline layout becomes available again. */
    const closeDrawerWhenInline = () => {
      if (responsivePanel === 'outline' && window.innerWidth > OUTLINE_DRAWER_BREAKPOINT_PX) {
        setResponsivePanel(null)
      } else if (responsivePanel === 'properties' && window.innerWidth > PROPERTIES_DRAWER_BREAKPOINT_PX) {
        setResponsivePanel(null)
      }
    }
    window.addEventListener('resize', closeDrawerWhenInline)
    return () => window.removeEventListener('resize', closeDrawerWhenInline)
  }, [responsivePanel])

  useEffect(() => {
    if (responsivePanel === 'outline') {
      outlineCloseRef.current?.focus()
    } else if (responsivePanel === 'properties') {
      propertiesCloseRef.current?.focus()
    } else if (responsivePanelWasOpenRef.current === 'outline' && window.innerWidth <= OUTLINE_DRAWER_BREAKPOINT_PX) {
      outlineToggleRef.current?.focus()
    } else if (responsivePanelWasOpenRef.current === 'properties' && window.innerWidth <= PROPERTIES_DRAWER_BREAKPOINT_PX) {
      propertiesToggleRef.current?.focus()
    }
    responsivePanelWasOpenRef.current = responsivePanel
  }, [responsivePanel])

  useEffect(() => {
    if (responsivePanel === null) return
    const drawer = responsivePanel === 'outline' ? outlineDrawerRef.current : propertiesDrawerRef.current
    if (drawer === null) return
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    /** Keeps Escape and Tab navigation inside the open responsive panel. */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setResponsivePanel(null)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.getClientRects().length > 0)
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (first === undefined || last === undefined) return
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [responsivePanel])

  /** Opens the active POC preview surface from the editor's current page. */
  const openPreview = () => {
    setPreviewError(null)
    if (PREVIEW_SURFACE === 'modal') {
      setPreviewOpen(true)
      return
    }
    popupPreviewHostRef.current ??= new PopupPreviewHost(controller)
    if (!popupPreviewHostRef.current.open()) {
      setPreviewError('Le navigateur a bloqué la fenêtre de lecture.')
    }
  }

  const addPage = (placement: PagePlacement, pageType: PageType = PAGE_TYPE.FLUX) => {
    controller.send({ type: 'page.create', placement, pageType })
  }

  /** Creates a standard chapter through the controller's document command. */
  const addChapter = () => {
    controller.send({ type: 'document.apply', command: createChapterCommand(documentModel) })
  }

  /** Creates an Evaluation chapter through the same XState document command. */
  const addEvaluationChapter = () => {
    controller.send({
      type: 'document.apply',
      command: createChapterCommand(documentModel, undefined, CHAPTER_TYPE.EVALUATION),
    })
  }

  const movePage = (pageId: string, placement: PagePlacement) => {
    controller.send({ type: 'document.apply', command: createPageMoveCommand(pageId, placement) })
  }

  const moveChapter = (chapterId: string, index: number) => {
    controller.send({ type: 'document.apply', command: createChapterMoveCommand(chapterId, index) })
  }

  const deletePage = (pageId: string) => {
    controller.send({ type: 'document.apply', command: createPageDeleteCommand(pageId) })
  }

  const returnBdcToCatalog = (bdcId: string) => {
    controller.send({ type: 'document.apply', command: { type: 'bdc.remove', bdcId } })
  }

  const beginBdcDrag = (event: DragEvent<HTMLButtonElement>, bdcId: string) => {
    draggedBdcId.current = bdcId
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(BDC_ORDER.MIME_TYPE, bdcId)
  }

  const dragOverBdcSeparator = (event: DragEvent<HTMLElement>, targetId: string) => {
    if (draggedBdcId.current === null) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setDropTarget(targetId)
  }

  const dropBdc = (event: DragEvent<HTMLElement>, index: number) => {
    const bdcId = draggedBdcId.current
    if (bdcId === null || selectedPage === undefined) return
    event.preventDefault()
    event.stopPropagation()
    controller.send({
      type: 'document.apply',
      command: { type: 'bdc.move', bdcId, placement: { kind: BDC_LOCATION.PAGE, pageId: selectedPage.id, index } },
    })
    draggedBdcId.current = null
    setDropTarget(null)
  }

  const endBdcDrag = () => {
    draggedBdcId.current = null
    setDropTarget(null)
  }

  const addQuestion = () => {
    switch (selectedPage?.type) {
      case PAGE_TYPE.FLUX:
      case PAGE_TYPE.DIAPO:
        questionFacade.create(documentModel, selectedPage.id, selectedPage.bdcIds.length)
        return
      default:
        return
    }
  }

  const addSection = () => {
    switch (selectedPage?.type) {
      case PAGE_TYPE.FLUX:
        controller.send({
          type: 'document.apply',
          command: createSectionBdcCommand(createStableId('bdc-section'), selectedPage.id, selectedPage.bdcIds.length),
        })
        return
      case PAGE_TYPE.DIAPO:
      default:
        return
    }
  }

  /** Creates the single dual-outcome Result BDC through XState. */
  const addEvaluationResult = () => {
    switch (selectedPage?.type) {
      case PAGE_TYPE.FLUX:
        controller.send({
          type: 'document.apply',
          command: createEvaluationResultBdcCommand(
            createStableId('bdc-evaluation-result'),
            selectedPage.id,
            selectedPage.bdcIds.length,
          ),
        })
        return
      case PAGE_TYPE.DIAPO:
      default:
        return
    }
  }

  /** Adds a unique Carousel BDC at the end of the selected page's BDC order. */
  const addCarousel = () => {
    switch (selectedPage?.type) {
      case PAGE_TYPE.FLUX:
        controller.send({
          type: 'document.apply',
          command: createCarouselBdcCommand(createCarouselBdcId(), selectedPage.id, selectedPage.bdcIds.length),
        })
        return
      case PAGE_TYPE.DIAPO:
        if (!pageHasCarousel) {
          controller.send({
            type: 'document.apply',
            command: createCarouselBdcCommand(createCarouselBdcId(), selectedPage.id, selectedPage.bdcIds.length),
          })
        }
        return
      default:
        return
    }
  }

  /** Adds the reusable standalone Card model as the Diapo's only direct BDC. */
  const addStandaloneCard = () => {
    if (selectedPage?.type !== PAGE_TYPE.DIAPO || pageHasContent) return
    controller.send({
      type: 'document.apply',
      command: createStandaloneCardBdcCommand(createStableId('bdc-card'), selectedPage.id),
    })
  }

  const beginPageDrag = (event: DragEvent<HTMLElement>, pageId: string) => {
    draggedEntry.current = { kind: SCENARIO_ENTRY_KIND.PAGE, pageId }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', pageId)
  }

  const beginChapterDrag = (event: DragEvent<HTMLElement>, chapterId: string) => {
    draggedEntry.current = { kind: SCENARIO_ENTRY_KIND.CHAPTER, chapterId }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', chapterId)
  }

  const endPageDrag = () => {
    draggedEntry.current = null
    setDropTarget(null)
  }

  const beginCatalogDrag = (event: DragEvent<HTMLButtonElement>, reference: ElceCatalogReference) => {
    event.dataTransfer.setData(CATALOG_REFERENCE.MIME_TYPE, JSON.stringify(reference))
    switch (reference.kind) {
      case CATALOG_REFERENCE.BDC:
        event.dataTransfer.effectAllowed = 'move'
        break
      case CATALOG_REFERENCE.MEDIA:
        event.dataTransfer.effectAllowed = 'copy'
        break
    }
  }

  const dragOverAvailableBdcCatalog = (event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes(ANCHOR_RETURN.MIME_TYPE)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    if (dropTarget !== CATALOG_TAB.AVAILABLE_BDCS) setDropTarget(CATALOG_TAB.AVAILABLE_BDCS)
  }

  const leaveAvailableBdcCatalog = (event: DragEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
    setDropTarget(null)
  }

  const dropIntoAvailableBdcCatalog = (event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes(ANCHOR_RETURN.MIME_TYPE)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setDropTarget(null)
    if (catalogTab !== CATALOG_TAB.AVAILABLE_BDCS) {
      controller.send({ type: 'catalog.tab.select', tabId: CATALOG_TAB.AVAILABLE_BDCS })
    }
  }

  const dragOverPageTarget = (event: DragEvent<HTMLElement>, targetId: string) => {
    switch (draggedEntry.current?.kind) {
      case SCENARIO_ENTRY_KIND.PAGE:
        break
      case SCENARIO_ENTRY_KIND.CHAPTER:
        event.stopPropagation()
        return
      default:
        return
    }
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setDropTarget(targetId)
  }

  const dragOverScenarioEntry = (event: DragEvent<HTMLElement>, targetId: string) => {
    switch (draggedEntry.current) {
      case null:
        return
      default:
        break
    }
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setDropTarget(targetId)
  }

  const dragLeaveDropSeparator = (event: DragEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
    setDropTarget(null)
  }

  const dropPage = (event: DragEvent<HTMLElement>, placement: PagePlacement) => {
    const entry = draggedEntry.current
    switch (entry?.kind) {
      case SCENARIO_ENTRY_KIND.PAGE:
        event.preventDefault()
        event.stopPropagation()
        movePage(entry.pageId, placement)
        endPageDrag()
        return
      case SCENARIO_ENTRY_KIND.CHAPTER:
        event.stopPropagation()
        return
      default:
        return
    }
  }

  const dropScenarioEntry = (event: DragEvent<HTMLElement>, placement: ScenarioPagePlacement) => {
    const entry = draggedEntry.current
    switch (entry?.kind) {
      case SCENARIO_ENTRY_KIND.PAGE:
        event.preventDefault()
        event.stopPropagation()
        movePage(entry.pageId, placement)
        endPageDrag()
        return
      case SCENARIO_ENTRY_KIND.CHAPTER:
        event.preventDefault()
        event.stopPropagation()
        moveChapter(entry.chapterId, placement.index ?? documentModel.data.scenarioEntries.length)
        endPageDrag()
        return
      default:
        return
    }
  }

  return (
    <div id="elce-workspace" className="elce-workspace">
      <header id="elce-header" className="elce-header">
        <div id="elce-header-title" className="elce-header-title">
          <div id="elce-brand" className="elce-brand">
            <span id="elce-brand-name">Elcé</span>
          </div>
          <nav id="elce-responsive-panel-access" className="elce-responsive-panel-access" aria-label="Panneaux de l’éditeur">
            <button
              id="elce-outline-toggle"
              ref={outlineToggleRef}
              className={responsivePanel === 'outline' ? 'elce-responsive-panel-toggle elce-responsive-panel-toggle--outline elce-responsive-panel-toggle--open' : 'elce-responsive-panel-toggle elce-responsive-panel-toggle--outline'}
              type="button"
              aria-label="Ouvrir le scénario"
              title="Scénario"
              aria-expanded={responsivePanel === 'outline'}
              aria-controls="elce-outline"
              onClick={() => setResponsivePanel('outline')}
            ><List aria-hidden="true" size={18} strokeWidth={2} /></button>
            <button
              id="elce-properties-toggle"
              ref={propertiesToggleRef}
              className={responsivePanel === 'properties' ? 'elce-responsive-panel-toggle elce-responsive-panel-toggle--properties elce-responsive-panel-toggle--open' : 'elce-responsive-panel-toggle elce-responsive-panel-toggle--properties'}
              type="button"
              aria-label="Ouvrir les contenus disponibles"
              title="Contenus disponibles"
              aria-expanded={responsivePanel === 'properties'}
              aria-controls="elce-properties"
              onClick={() => setResponsivePanel('properties')}
            ><Images aria-hidden="true" size={18} strokeWidth={2} /></button>
          </nav>
        </div>
      </header>
      <main id="elce-main" className="elce-main">
        <section
          id="elce-outline"
          ref={outlineDrawerRef}
          className="elce-panel elce-outline"
          data-drawer-open={responsivePanel === 'outline'}
          role={responsivePanel === 'outline' ? 'dialog' : undefined}
          aria-modal={responsivePanel === 'outline' ? true : undefined}
          aria-labelledby="elce-outline-title"
        >
          <div id="elce-outline-heading" className="elce-panel-heading">
            <h1 id="elce-outline-title">Scénario</h1>
            <div id="elce-outline-actions" className="elce-outline-actions">
              <button id="elce-create-chapter" className="elce-icon-action" type="button" aria-label={CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.STANDARD].createLabel} title={CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.STANDARD].createLabel} onClick={addChapter}>
                <FolderPlus aria-hidden="true" size={17} strokeWidth={2} />
              </button>
              <button id="elce-create-evaluation-chapter" className="elce-icon-action" type="button" aria-label={CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.EVALUATION].createLabel} title={CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.EVALUATION].createLabel} onClick={addEvaluationChapter}>
                <ClipboardCheck aria-hidden="true" size={17} strokeWidth={2} />
              </button>
              <button
                id="elce-create-scenario-page"
                className="elce-icon-action"
                type="button"
                aria-label="Ajouter une Page à la racine du scénario"
                title="Ajouter une Page à la racine du scénario"
                onClick={() => addPage({ kind: PAGE_LOCATION.SCENARIO }, PAGE_TYPE.FLUX)}
              >
                <FilePlus aria-hidden="true" size={14} strokeWidth={2} />
              </button>
              <button
                id="elce-create-scenario-diapo"
                className="elce-icon-action"
                type="button"
                aria-label="Ajouter une Diapo à la racine du scénario"
                title="Ajouter une Diapo à la racine du scénario"
                onClick={() => addPage({ kind: PAGE_LOCATION.SCENARIO }, PAGE_TYPE.DIAPO)}
              >
                <Presentation aria-hidden="true" size={16} strokeWidth={2} />
              </button>
            </div>
            <button
              id="elce-outline-close"
              ref={outlineCloseRef}
              className="elce-responsive-panel-close elce-outline-close"
              type="button"
              aria-label="Fermer le scénario"
              onClick={() => setResponsivePanel(null)}
            ><X aria-hidden="true" size={18} strokeWidth={2} /></button>
          </div>
          <p id="elce-document-name">{documentModel.data.name}</p>
          <p id="elce-page-dnd-help" className="elce-muted">Glissez une page pour la déplacer ou la réordonner.</p>
          <ScenarioEntryDropList
            id="elce-scenario-entry-list"
            documentModel={documentModel}
            selectedPageId={selectedChapter === undefined ? selectedPage?.id : undefined}
            selectedChapterId={selectedChapter?.id}
            dropTarget={dropTarget}
            onDragLeaveDropSeparator={dragLeaveDropSeparator}
            onSelect={(pageId) => controller.send({ type: 'page.select', pageId })}
            onSelectChapter={(chapterId) => controller.send({ type: 'chapter.select', chapterId })}
            onDeletePage={deletePage}
            onDeleteChapter={(chapterId) => controller.send({ type: 'document.apply', command: { type: 'chapter.delete', chapterId } })}
            onAddChapterPage={(chapterId, pageType) => addPage({ kind: PAGE_LOCATION.CHAPTER, chapterId }, pageType)}
            onDragStartPage={beginPageDrag}
            onDragStartChapter={beginChapterDrag}
            onDragEnd={endPageDrag}
            onDragOverRoot={dragOverScenarioEntry}
            onDragOverPage={dragOverPageTarget}
            onDropRoot={dropScenarioEntry}
            onDropPage={dropPage}
          />
          <section id="elce-catalog-pages" className="elce-outline-group">
            <h2 id="elce-catalog-pages-title">Catalogue</h2>
            <p id="elce-catalog-pages-description" className="elce-muted">Pages créées mais non placées dans le scénario.</p>
            <PageDropList
              id="elce-catalog-page-list"
              documentModel={documentModel}
              pageIds={documentModel.data.catalogPageIds}
              selectedPageId={selectedPage?.id}
              emptyLabel="Déposer une page ici"
              dropTarget={dropTarget}
              onDragLeaveDropSeparator={dragLeaveDropSeparator}
              placementAt={() => ({ kind: PAGE_LOCATION.CATALOG })}
              onSelect={(pageId) => controller.send({ type: 'page.select', pageId })}
              onDelete={deletePage}
              onDragStart={beginPageDrag}
              onDragEnd={endPageDrag}
              onDragOver={dragOverPageTarget}
              onDrop={dropPage}
            />
          </section>
        </section>
        <section id="elce-work-area" className="elce-panel elce-work-area">
          <div id="elce-work-area-heading" className="elce-work-area-heading">
            <div id="elce-work-area-preview-row" className="elce-work-area-preview-row">
              <button id="elce-preview-open" type="button" onClick={openPreview}>
                Prévisualiser
              </button>
              {previewError === null ? null : <p id="elce-preview-open-error" role="alert">{previewError}</p>}
            </div>
            <div id="elce-work-area-title-row" className="elce-work-area-title-row">
              <div id="elce-work-area-titles" className="elce-work-area-titles">
                {selectedChapter !== undefined
                  ? <h1 id="elce-work-area-chapter-title" className="elce-work-area-page-title elce-work-area-chapter-title--active">
                      <ChapterTypeMark type={selectedChapter.type} />
                      <input
                        id={`elce-chapter-title-${selectedChapter.id}`}
                        key={`${selectedChapter.id}:${selectedChapter.name}`}
                        className="elce-inline-title-input"
                        type="text"
                        aria-label={CHAPTER_TYPE_CONFIG[selectedChapter.type].titleLabel}
                        title={CHAPTER_TYPE_CONFIG[selectedChapter.type].editTitleLabel}
                        defaultValue={selectedChapter.name}
                        onBlur={(event) => commitInlineName(event.currentTarget, selectedChapter.name, (name) => controller.send({
                          type: 'document.apply',
                          command: { type: 'chapter.rename', chapterId: selectedChapter.id, name },
                        }))}
                        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                      />
                    </h1>
                  : pageChapter === undefined
                    ? null
                    : <h2 id="elce-work-area-chapter-title" className="elce-work-area-chapter-title">
                        <ChapterTypeMark type={pageChapter.type} />
                        <input
                          id={`elce-chapter-title-${pageChapter.id}`}
                          key={`${pageChapter.id}:${pageChapter.name}`}
                          className="elce-inline-title-input"
                          type="text"
                          aria-label={CHAPTER_TYPE_CONFIG[pageChapter.type].titleLabel}
                          title={CHAPTER_TYPE_CONFIG[pageChapter.type].editTitleLabel}
                          defaultValue={pageChapter.name}
                          onBlur={(event) => commitInlineName(event.currentTarget, pageChapter.name, (name) => controller.send({
                            type: 'document.apply',
                            command: { type: 'chapter.rename', chapterId: pageChapter.id, name },
                          }))}
                          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                        />
                      </h2>}
                {selectedChapter !== undefined
                  ? null
                  : selectedPage === undefined
                  ? <h1 id="elce-work-area-title">Éditeur</h1>
                  : <h1 id="elce-work-area-title" className="elce-work-area-page-title">
                      <input
                        id={`elce-page-title-${selectedPage.id}`}
                        key={`${selectedPage.id}:${selectedPage.name}`}
                        className="elce-inline-title-input"
                        type="text"
                        aria-label="Titre de la page"
                        title="Modifier le titre de la page"
                        defaultValue={selectedPage.name}
                        onBlur={(event) => commitInlineName(event.currentTarget, selectedPage.name, (name) => controller.send({
                          type: 'document.apply',
                          command: { type: 'page.rename', pageId: selectedPage.id, name },
                        }))}
                        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                      />
                    </h1>}
              </div>
              {selectedChapter === undefined && <div id="elce-work-area-actions" className="elce-work-area-actions">
                <button
                  id="elce-section-create"
                  className="elce-icon-action"
                  type="button"
                  aria-label="Ajouter un bloc texte"
                  title="Ajouter un bloc texte"
                  disabled={!canCreateSection}
                  onClick={addSection}
                ><FileText aria-hidden="true" size={17} strokeWidth={2} /></button>
                <button
                  id="elce-question-create"
                  className="elce-icon-action"
                  type="button"
                  aria-label="Ajouter un bloc quiz"
                  title="Ajouter un bloc quiz"
                  disabled={!canCreateQuestion}
                  onClick={addQuestion}
                ><ListChecks aria-hidden="true" size={17} strokeWidth={2} /></button>
                <button
                  id="elce-carousel-create"
                  className="elce-icon-action"
                  type="button"
                  aria-label="Ajouter un bloc Carousel"
                  title="Ajouter un bloc Carousel"
                  disabled={!canCreateCarousel}
                  onClick={addCarousel}
                ><Images aria-hidden="true" size={17} strokeWidth={2} /></button>
                {selectedPage?.type === PAGE_TYPE.DIAPO && <button
                  id="elce-card-create"
                  className="elce-icon-action"
                  type="button"
                  aria-label="Ajouter une carte autonome"
                  title="Ajouter une carte autonome"
                  disabled={!canCreateStandaloneCard}
                  onClick={addStandaloneCard}
                ><RectangleHorizontal aria-hidden="true" size={17} strokeWidth={2} /></button>}
                {canCreateEvaluationResult && <button
                  id="elce-evaluation-result-create"
                  className="elce-icon-action"
                  type="button"
                  aria-label="Ajouter un bloc résultat"
                  title="Ajouter un bloc résultat"
                  onClick={addEvaluationResult}
                ><BadgeCheck aria-hidden="true" size={17} strokeWidth={2} /></button>}
              </div>}
            </div>
          </div>
          {selectedChapter !== undefined
            ? selectedChapter.type === CHAPTER_TYPE.EVALUATION
              ? <EvaluationChapterSettingsEditor
                  chapter={selectedChapter}
                  onChange={(attemptLimit, retryScope) => controller.send({
                    type: 'document.apply',
                    command: {
                      type: 'chapter.evaluation.settings.update',
                      chapterId: selectedChapter.id,
                      attemptLimit,
                      retryScope,
                    },
                  })}
                />
              : null
            : selectedPage === undefined
              ? <p id="elce-editor-unavailable">Sélectionnez une page du scénario.</p>
              : <div id={`elce-page-bdc-list-${selectedPage.id}`} className="elce-page-bdc-list">
                {selectedPageBdcs.length === 0
                  ? <p id="elce-editor-unavailable">Cette page ne contient aucun bloc éditable.</p>
                  : null}
                {selectedPageBdcs.map((bdc) => {
                  const index = selectedPage.bdcIds.indexOf(bdc.id)
                  const separatorId = `elce-page-bdc-drop-${index}`
                  const carouselCards = bdc.carousel?.cards.flatMap((entry) => {
                    const card = documentModel.bdcs.find((candidate) => candidate.id === entry.bdcId)
                    return card === undefined ? [] : [card]
                  }) ?? []
                  return (
                    <Fragment key={bdc.id}>
                      <div
                        id={separatorId}
                        className={dropTarget === separatorId ? 'elce-page-bdc-drop elce-page-bdc-drop--active' : 'elce-page-bdc-drop'}
                        aria-label="Déposer le bloc à cet endroit"
                        onDragOver={(event) => dragOverBdcSeparator(event, separatorId)}
                        onDragLeave={dragLeaveDropSeparator}
                        onDrop={(event) => dropBdc(event, index)}
                      ><span /></div>
                      <div id={`elce-page-bdc-${bdc.id}`} className="elce-page-bdc">
                        <button
                          id={`elce-page-bdc-drag-${bdc.id}`}
                          className="elce-page-bdc__drag"
                          type="button"
                          draggable
                          aria-label="Déplacer le bloc dans la page"
                          title="Glisser pour déplacer"
                          onDragStart={(event) => beginBdcDrag(event, bdc.id)}
                          onDragEnd={endBdcDrag}
                        ><GripVertical aria-hidden="true" size={15} /></button>
                        {bdc.type === BDC_TYPE.SECTION
                          ? <SectionEditor
                              key={`${bdc.id}:${mediaSourceKey}`}
                              bdc={bdc}
                              onDelete={() => controller.send({
                                type: 'document.apply',
                                command: { type: 'bdc.section.delete', bdcId: bdc.id },
                              })}
                              createFileDropTarget={(file) => anchorDropFacade.createFileDropTarget(file, selectedPage.id)}
                              createCatalogDropTarget={(reference) => anchorDropFacade.createCatalogDropTarget(
                                documentModel,
                                reference,
                                selectedPage.id,
                                bdc.id,
                              )}
                              resolveMediaSource={(mediaId) => mediaSources[mediaId] ?? null}
                              onChange={(change) => anchorDropFacade.submitSectionChange(bdc.id, change)}
                            />
                          : bdc.type === BDC_TYPE.QUESTION && bdc.question !== null
                            ? <QuestionEditor
                                bdcId={bdc.id}
                                question={bdc.question}
                                media={documentModel.medias.find((media) => media.id === bdc.mediaId) ?? null}
                                mediaSource={bdc.mediaId === null ? null : mediaSources[bdc.mediaId] ?? null}
                                actions={createQuestionEditorActions(questionFacade, bdc.id, bdc.question)}
                                onCatalogReference={(value) => questionFacade.attachMediaReference(bdc.id, value)}
                              />
                            : bdc.type === BDC_TYPE.EVALUATION_RESULT && bdc.evaluationResult !== null && bdc.evaluationResult !== undefined
                              ? <EvaluationResultEditor
                                  bdcId={bdc.id}
                                  content={bdc.evaluationResult}
                                  onChange={(evaluationResult: EvaluationResultContent) => controller.send({
                                    type: 'document.apply',
                                    command: { type: 'bdc.evaluation-result.update', bdcId: bdc.id, evaluationResult },
                                  })}
                                  onDelete={() => controller.send({
                                    type: 'document.apply',
                                    command: { type: 'bdc.evaluation-result.delete', bdcId: bdc.id },
                                  })}
                                />
                              : bdc.type === BDC_TYPE.CAROUSEL && bdc.carousel !== null && bdc.carousel !== undefined
                              ? <CarouselEditor
                                  bdcId={bdc.id}
                                  content={bdc.carousel}
                                  cards={carouselCards}
                                  selectedCardBdcId={selectedCarouselCardBdcId}
                                  mediaById={mediaById}
                                  actions={carouselFacade.createEditorActions(bdc.id, bdc.carousel, carouselCards)}
                                />
                              : bdc.type === BDC_TYPE.CARD && bdc.card !== null
                              ? <CardEditor
                                  bdc={bdc}
                                  mediaById={mediaById}
                                  actions={cardFacade.createEditorActions(documentModel.bdcs)}
                                  onDelete={() => controller.send({
                                    type: 'document.apply',
                                    command: { type: 'bdc.card.delete', bdcId: bdc.id },
                                  })}
                                />
                              : null}
                      </div>
                    </Fragment>
                  )
                })}
                <div
                  id={`elce-page-bdc-drop-${selectedPage.bdcIds.length}`}
                  className={dropTarget === `elce-page-bdc-drop-${selectedPage.bdcIds.length}` ? 'elce-page-bdc-drop elce-page-bdc-drop--active' : 'elce-page-bdc-drop'}
                  aria-label="Déposer le bloc à la fin de la page"
                  onDragOver={(event) => dragOverBdcSeparator(event, `elce-page-bdc-drop-${selectedPage.bdcIds.length}`)}
                  onDragLeave={dragLeaveDropSeparator}
                  onDrop={(event) => dropBdc(event, selectedPage.bdcIds.length)}
                ><span /></div>
              </div>}
        </section>
        <aside
          id="elce-properties"
          ref={propertiesDrawerRef}
          className="elce-panel elce-properties"
          data-drawer-open={responsivePanel === 'properties'}
          role={responsivePanel === 'properties' ? 'dialog' : undefined}
          aria-modal={responsivePanel === 'properties' ? true : undefined}
          aria-labelledby="elce-content-catalog-title"
        >
          <section id="elce-content-catalog" className="elce-outline-group">
            <header id="elce-properties-heading" className="elce-properties-heading">
              <h1 id="elce-content-catalog-title">Contenus disponibles</h1>
              <button
                id="elce-properties-close"
                ref={propertiesCloseRef}
                className="elce-responsive-panel-close elce-properties-close"
                type="button"
                aria-label="Fermer les contenus disponibles"
                onClick={() => setResponsivePanel(null)}
              >
                <X aria-hidden="true" size={18} strokeWidth={2} />
              </button>
            </header>
            <div id="elce-content-catalog-tabs" className="elce-content-catalog-tabs" role="group" aria-label="Contenus du catalogue">
              <button
                id="elce-content-catalog-tab-bdcs"
                className={availableBdcTabClass(
                  catalogTab === CATALOG_TAB.AVAILABLE_BDCS,
                  dropTarget === CATALOG_TAB.AVAILABLE_BDCS,
                )}
                type="button"
                aria-pressed={catalogTab === CATALOG_TAB.AVAILABLE_BDCS}
                aria-controls="elce-catalog-bdcs"
                onClick={() => controller.send({ type: 'catalog.tab.select', tabId: CATALOG_TAB.AVAILABLE_BDCS })}
                onDragOver={dragOverAvailableBdcCatalog}
                onDragLeave={leaveAvailableBdcCatalog}
                onDrop={dropIntoAvailableBdcCatalog}
              >
                Blocs disponibles
              </button>
              <button
                id="elce-content-catalog-tab-media"
                className={catalogTab === CATALOG_TAB.MEDIA ? 'elce-content-catalog-tab elce-content-catalog-tab--active' : 'elce-content-catalog-tab'}
                type="button"
                aria-pressed={catalogTab === CATALOG_TAB.MEDIA}
                aria-controls="elce-catalog-media"
                onClick={() => controller.send({ type: 'catalog.tab.select', tabId: CATALOG_TAB.MEDIA })}
              >
                Médias
              </button>
            </div>
            <section
              id="elce-catalog-bdcs"
              className={dropTarget === CATALOG_TAB.AVAILABLE_BDCS ? 'elce-content-catalog-panel elce-content-catalog-panel--drop-target' : 'elce-content-catalog-panel'}
              hidden={catalogTab !== CATALOG_TAB.AVAILABLE_BDCS}
              onDragOver={dragOverAvailableBdcCatalog}
              onDragLeave={leaveAvailableBdcCatalog}
              onDrop={dropIntoAvailableBdcCatalog}
            >
              <p id="elce-catalog-bdcs-description" className="elce-muted">
                Ces blocs ne sont utilisés sur aucune page. Déposer ici un bloc ancré le retire du texte et le rend disponible.
              </p>
              {catalogContents.bdcs.length === 0
                ? <p id="elce-catalog-bdcs-empty" className="elce-muted">Aucun bloc image ou vidéo disponible.</p>
                : <ul id="elce-catalog-bdcs-list" className="elce-content-catalog-list">
                    {catalogContents.bdcs.map((entry) => (
                      <li id={`elce-catalog-bdc-${entry.reference.bdcId}`} key={entry.key}>
                        <div id={`elce-catalog-bdc-actions-${entry.reference.bdcId}`} className="elce-content-catalog-row">
                          <button
                            id={`elce-catalog-bdc-drag-${entry.key}`}
                            className="elce-content-catalog-item"
                            type="button"
                            draggable
                            onDragStart={(event) => beginCatalogDrag(event, entry.reference)}
                            aria-label={`Insérer le bloc ${catalogMediaLabel(entry.mediaType)} : ${entry.name}`}
                            title={`Insérer le bloc ${catalogMediaLabel(entry.mediaType)} : ${entry.name}`}
                          >
                            <GripVertical aria-hidden="true" size={14} strokeWidth={2} />
                            <span>{entry.name}</span>
                            <small>Bloc {catalogMediaLabel(entry.mediaType)} · unique</small>
                          </button>
                          <DeleteIconButton
                            id={`elce-catalog-bdc-delete-${entry.reference.bdcId}`}
                            ariaLabel={`Supprimer définitivement le bloc ${entry.name}`}
                            onClick={() => controller.send({
                              type: 'document.apply',
                              command: { type: 'bdc.delete', bdcId: entry.reference.bdcId },
                            })}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>}
            </section>
            <section id="elce-catalog-media" className="elce-content-catalog-panel" hidden={catalogTab !== CATALOG_TAB.MEDIA}>
              <p id="elce-catalog-media-description" className="elce-muted">
                Les fichiers image et vidéo restent disponibles après insertion.
              </p>
              {catalogContents.media.length === 0
                ? <p id="elce-catalog-media-empty" className="elce-muted">Les médias ajoutés apparaîtront ici.</p>
                : <ul id="elce-catalog-media-list" className="elce-content-catalog-list">
                    {catalogContents.media.map((entry) => (
                      <li id={`elce-catalog-media-${entry.reference.mediaId}`} key={entry.key}>
                        <button
                          id={`elce-catalog-media-drag-${entry.key}`}
                          className="elce-content-catalog-item"
                          type="button"
                          draggable
                          onDragStart={(event) => beginCatalogDrag(event, entry.reference)}
                          aria-label={`Déposer le média ${catalogMediaLabel(entry.mediaType)} : ${entry.name}`}
                          title={`Déposer le média ${catalogMediaLabel(entry.mediaType)} : ${entry.name}`}
                        >
                          <GripVertical aria-hidden="true" size={14} strokeWidth={2} />
                          <span>{entry.name}</span>
                          <small>{catalogMediaLabel(entry.mediaType)}</small>
                        </button>
                      </li>
                    ))}
                  </ul>}
            </section>
          </section>
          {unanchoredMediaBdcs.length === 0
            ? null
            : <section id="elce-page-media" className="elce-outline-group">
                <h2 id="elce-page-media-title">Médias dans la page</h2>
                <ul id="elce-page-media-list" className="elce-media-catalog-list">
                  {unanchoredMediaBdcs.map((bdc) => {
                    const media = documentModel.medias.find((candidate) => candidate.id === bdc.mediaId)
                    return (
                      <li id={`elce-page-media-${bdc.id}`} key={bdc.id} className="elce-media-catalog-row">
                        <span id={`elce-page-media-name-${bdc.id}`}>{media?.name ?? bdc.type}</span>
                        <button
                          id={`elce-page-media-catalog-${bdc.id}`}
                          type="button"
                          className="elce-secondary-action"
                          aria-label="Renvoyer au catalogue"
                          title="Renvoyer au catalogue"
                          onClick={() => returnBdcToCatalog(bdc.id)}
                        >
                          <Archive aria-hidden="true" size={14} strokeWidth={2} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>}
        </aside>
      </main>
      {responsivePanel !== null
        ? <button
            id="elce-responsive-panel-backdrop"
            className="elce-responsive-panel-backdrop"
            type="button"
            aria-label={responsivePanel === 'outline' ? 'Fermer le scénario' : 'Fermer les contenus disponibles'}
            onClick={() => setResponsivePanel(null)}
          />
        : null}
      {PREVIEW_SURFACE === 'modal' && previewOpen
        ? <div id="elce-preview-modal" className="elce-preview-modal" role="dialog" aria-modal="true" aria-labelledby="elce-preview-title">
            <div id="elce-preview-dialog" className="elce-preview-dialog">
              <header id="elce-preview-header" className="elce-preview-header">
                <h2 id="elce-preview-title">Prévisualisation</h2>
                <button id="elce-preview-close" type="button" onClick={() => setPreviewOpen(false)}>Fermer</button>
              </header>
              <PlayerPreview documentModel={documentModel} selectedPageId={selectedPage?.id ?? null} mediaSources={mediaSources} />
            </div>
          </div>
        : null}
    </div>
  )
}

/** Commits a central title field through the document command path. */
function commitInlineName(
  input: HTMLInputElement,
  currentName: string,
  commit: (name: string) => void,
): void {
  const name = input.value.trim()
  if (name.length === 0 || name === currentName) {
    input.value = currentName
    return
  }
  commit(name)
}

type EvaluationChapterSettingsEditorProps = Readonly<{
  readonly chapter: Chapter
  readonly onChange: (attemptLimit: number | null, retryScope: EvaluationRetryScope) => void
}>

/** Edits the persisted POC settings for one Evaluation chapter. */
function EvaluationChapterSettingsEditor({ chapter, onChange }: EvaluationChapterSettingsEditorProps) {
  const attemptLimit = chapter.evaluationAttemptLimit ?? DEFAULT_EVALUATION_SETTINGS.attemptLimit
  const retryScope = chapter.evaluationRetryScope ?? DEFAULT_EVALUATION_SETTINGS.retryScope
  return (
    <form id={`elce-evaluation-settings-${chapter.id}`} className="elce-evaluation-settings" onSubmit={(event) => event.preventDefault()}>
      <label className="elce-evaluation-setting">
        <span>Seuil de réussite</span>
        <output id={`elce-evaluation-threshold-${chapter.id}`}>{DEFAULT_EVALUATION_SETTINGS.threshold * 100} %</output>
        <small>Fixé pour le POC.</small>
      </label>
      <label className="elce-evaluation-setting">
        <span>Nombre maximal de tentatives</span>
        <input
          id={`elce-evaluation-attempt-limit-${chapter.id}`}
          key={`${chapter.id}:${attemptLimit ?? 'unlimited'}`}
          type="number"
          min="1"
          step="1"
          placeholder="Illimité"
          defaultValue={attemptLimit ?? ''}
          onBlur={(event) => commitAttemptLimit(event.currentTarget, attemptLimit, (value) => onChange(value, retryScope))}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
        />
        <small>Laisser vide pour autoriser un nombre illimité de tentatives.</small>
      </label>
      <label className="elce-evaluation-setting">
        <span>Questions à reprendre après un échec</span>
        <select
          id={`elce-evaluation-retry-scope-${chapter.id}`}
          value={retryScope}
          onChange={(event) => onChange(attemptLimit, event.currentTarget.value as EvaluationRetryScope)}
        >
          <option value={EVALUATION_RETRY_SCOPE.ALL_QUESTIONS}>Toutes les questions</option>
          <option value={EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS}>Les réponses incorrectes seulement</option>
        </select>
      </label>
    </form>
  )
}

/** Commits a positive attempt limit or restores the current unlimited/default value. */
function commitAttemptLimit(
  input: HTMLInputElement,
  currentValue: number | null,
  commit: (value: number | null) => void,
): void {
  const value = input.value.trim() === '' ? null : Number(input.value)
  if (value !== null && (!Number.isInteger(value) || value < 1)) {
    input.value = currentValue === null ? '' : String(currentValue)
    return
  }
  if (value !== currentValue) commit(value)
}

/** Binds one Question editor to the métier facade without keeping React state. */
function createQuestionEditorActions(
  facade: ElceQuestionFacade,
  bdcId: string,
  question: QuestionContent,
): ElceQuestionEditorActions {
  return {
    setType: (type) => facade.setType(bdcId, question, type),
    setTitle: (title) => facade.setTitle(bdcId, question, title),
    setPrompt: (prompt) => facade.setPrompt(bdcId, question, prompt),
    setAnswerLabel: (answerId, label) => facade.setAnswerLabel(bdcId, question, answerId, label),
    setAnswerCorrect: (answerId, correct) => facade.setAnswerCorrect(bdcId, question, answerId, correct),
    addAnswer: () => facade.addAnswer(bdcId, question),
    removeAnswer: (answerId) => facade.removeAnswer(bdcId, question, answerId),
    canRemoveAnswer: (answerId) => facade.canRemoveAnswer(question, answerId),
    moveAnswer: (answerId, index) => facade.moveAnswer(bdcId, question, answerId, index),
    importMedia: (file) => facade.importMediaFile(bdcId, file),
    clearMedia: () => facade.clearMedia(bdcId),
    deleteQuestion: () => facade.delete(bdcId),
  }
}

type ScenarioEntryDropListProps = Readonly<{
  readonly id: string
  readonly documentModel: ElceDocument
  readonly selectedPageId?: string
  readonly selectedChapterId?: string
  readonly dropTarget: string | null
  readonly onDragLeaveDropSeparator: (event: DragEvent<HTMLElement>) => void
  readonly onSelect: (pageId: string) => void
  readonly onSelectChapter: (chapterId: string) => void
  readonly onDeletePage: (pageId: string) => void
  readonly onDeleteChapter: (chapterId: string) => void
  readonly onAddChapterPage: (chapterId: string, pageType: PageType) => void
  readonly onDragStartPage: (event: DragEvent<HTMLElement>, pageId: string) => void
  readonly onDragStartChapter: (event: DragEvent<HTMLElement>, chapterId: string) => void
  readonly onDragEnd: () => void
  readonly onDragOverRoot: (event: DragEvent<HTMLElement>, targetId: string) => void
  readonly onDragOverPage: (event: DragEvent<HTMLElement>, targetId: string) => void
  readonly onDropRoot: (event: DragEvent<HTMLElement>, placement: ScenarioPagePlacement) => void
  readonly onDropPage: (event: DragEvent<HTMLElement>, placement: PagePlacement) => void
}>

/** Renders root pages and chapter entries in their shared scenario order. */
function ScenarioEntryDropList({
  id,
  documentModel,
  selectedPageId,
  selectedChapterId,
  dropTarget,
  onDragLeaveDropSeparator,
  onSelect,
  onSelectChapter,
  onDeletePage,
  onDeleteChapter,
  onAddChapterPage,
  onDragStartPage,
  onDragStartChapter,
  onDragEnd,
  onDragOverRoot,
  onDragOverPage,
  onDropRoot,
  onDropPage,
}: ScenarioEntryDropListProps) {
  const entries = documentModel.data.scenarioEntries
  const placementAt = (index: number): ScenarioPagePlacement => ({ kind: PAGE_LOCATION.SCENARIO, index })

  return (
    <ul id={id} className="elce-outline-list">
      {entries.map((entry, entryIndex) => {
        switch (entry.kind) {
          case SCENARIO_ENTRY_KIND.PAGE: {
            const page = documentModel.pages.find((candidate) => candidate.id === entry.pageId)
            if (page === undefined) return null
            return (
              <Fragment key={`${SCENARIO_ENTRY_KIND.PAGE}-${page.id}`}>
                <ScenarioDropSeparator
                  id={`${id}-drop-${entryIndex}`}
                  dropTarget={dropTarget}
                  onDragOver={onDragOverRoot}
                  onDragLeave={onDragLeaveDropSeparator}
                  onDrop={(event) => onDropRoot(event, placementAt(entryIndex))}
                />
                <li id={`${id}-item-${page.id}`}>
                  <PageOutlineRow
                    id={id}
                    page={page}
                    selectedPageId={selectedPageId}
                    onSelect={onSelect}
                    onDelete={onDeletePage}
                    onDragStart={onDragStartPage}
                    onDragEnd={onDragEnd}
                  />
                </li>
              </Fragment>
            )
          }
          case SCENARIO_ENTRY_KIND.CHAPTER: {
            const chapter = documentModel.chapters.find((candidate) => candidate.id === entry.chapterId)
            if (chapter === undefined) return null
            return (
              <Fragment key={`${SCENARIO_ENTRY_KIND.CHAPTER}-${chapter.id}`}>
              <ScenarioDropSeparator
                id={`${id}-drop-${entryIndex}`}
                dropTarget={dropTarget}
                onDragOver={onDragOverRoot}
                onDragLeave={onDragLeaveDropSeparator}
                onDrop={(event) => onDropRoot(event, placementAt(entryIndex))}
              />
              <li id={`elce-chapter-${chapter.id}`}>
                <div
                  id={`elce-chapter-heading-${chapter.id}`}
                  className="elce-outline-item-heading"
                  draggable
                  aria-label={`Glisser pour déplacer ${chapter.name}`}
                  onDragStart={(event) => onDragStartChapter(event, chapter.id)}
                  onDragEnd={onDragEnd}
                >
                  <span className="elce-drag-handle" title="Glisser pour déplacer" aria-hidden="true">
                    <GripVertical size={14} strokeWidth={2} />
                  </span>
                  <button
                    id={`elce-chapter-select-${chapter.id}`}
                    className={selectedChapterId === chapter.id ? 'elce-chapter-select elce-chapter-select--selected' : 'elce-chapter-select'}
                    type="button"
                    aria-pressed={selectedChapterId === chapter.id}
                    onClick={() => onSelectChapter(chapter.id)}
                  >
                    <ChapterTypeMark type={chapter.type} />
                    <strong id={`elce-chapter-name-${chapter.id}`}>{chapter.name}</strong>
                  </button>
                  <div id={`elce-chapter-actions-${chapter.id}`} className="elce-outline-item-actions">
                    <button
                      id={`elce-create-page-${chapter.id}`}
                      className="elce-location-page-action"
                      type="button"
                      aria-label={`Ajouter une Page dans ${chapter.name}`}
                      title={`Ajouter une Page dans ${chapter.name}`}
                      onClick={() => onAddChapterPage(chapter.id, PAGE_TYPE.FLUX)}
                    >
                      <FilePlus aria-hidden="true" size={14} strokeWidth={2} />
                    </button>
                    <button
                      id={`elce-create-diapo-${chapter.id}`}
                      className="elce-location-page-action"
                      type="button"
                      aria-label={`Ajouter une Diapo dans ${chapter.name}`}
                      title={`Ajouter une Diapo dans ${chapter.name}`}
                      onClick={() => onAddChapterPage(chapter.id, PAGE_TYPE.DIAPO)}
                    >
                      <Presentation aria-hidden="true" size={16} strokeWidth={2} />
                    </button>
                    <DeleteIconButton
                      id={`elce-chapter-delete-${chapter.id}`}
                      disabled={chapter.pageIds.length > 0}
                      onClick={() => onDeleteChapter(chapter.id)}
                    />
                  </div>
                </div>
                <PageDropList
                  id={`elce-pages-${chapter.id}`}
                  documentModel={documentModel}
                  pageIds={chapter.pageIds}
                  selectedPageId={selectedPageId}
                  emptyLabel="Déposer une page dans ce chapitre"
                  dropTarget={dropTarget}
                  onDragLeaveDropSeparator={onDragLeaveDropSeparator}
                  placementAt={(index) => ({ kind: PAGE_LOCATION.CHAPTER, chapterId: chapter.id, index })}
                  onSelect={onSelect}
                  onDelete={onDeletePage}
                  onDragStart={onDragStartPage}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOverPage}
                  onDrop={onDropPage}
                />
              </li>
              </Fragment>
            )
          }
        }
      })}
      <ScenarioDropSeparator
        id={`${id}-drop-${entries.length}`}
        label={entries.length === 0 ? 'Déposer une page à la racine du scénario' : undefined}
        dropTarget={dropTarget}
        onDragOver={onDragOverRoot}
        onDragLeave={onDragLeaveDropSeparator}
        onDrop={(event) => onDropRoot(event, placementAt(entries.length))}
      />
    </ul>
  )
}

type PageDropListProps = Readonly<{
  readonly id: string
  readonly documentModel: ElceDocument
  readonly pageIds: readonly string[]
  readonly selectedPageId?: string
  readonly emptyLabel: string
  readonly dropTarget: string | null
  readonly onDragLeaveDropSeparator: (event: DragEvent<HTMLElement>) => void
  readonly placementAt: (index: number) => PagePlacement
  readonly onSelect: (pageId: string) => void
  readonly onDelete: (pageId: string) => void
  readonly onDragStart: (event: DragEvent<HTMLElement>, pageId: string) => void
  readonly onDragEnd: () => void
  readonly onDragOver: (event: DragEvent<HTMLElement>, targetId: string) => void
  readonly onDrop: (event: DragEvent<HTMLElement>, placement: PagePlacement) => void
}>

/** Renders one ordered page collection with separators as its only drop targets. */
function PageDropList({
  id,
  documentModel,
  pageIds,
  selectedPageId,
  emptyLabel,
  dropTarget,
  onDragLeaveDropSeparator,
  placementAt,
  onSelect,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: PageDropListProps) {
  return (
    <ul id={id} className="elce-outline-list">
      {pageIds.map((pageId, pageIndex) => {
        const page = documentModel.pages.find((candidate) => candidate.id === pageId)
        if (page === undefined) return null
        return (
          <Fragment key={page.id}>
            <ScenarioDropSeparator
                id={`${id}-drop-${pageIndex}`}
                dropTarget={dropTarget}
                onDragOver={onDragOver}
                onDragLeave={onDragLeaveDropSeparator}
                onDrop={(event) => onDrop(event, placementAt(pageIndex))}
            />
            <li id={`${id}-item-${page.id}`}>
              <PageOutlineRow
                id={id}
                page={page}
                selectedPageId={selectedPageId}
                onSelect={onSelect}
                onDelete={onDelete}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            </li>
          </Fragment>
        )
      })}
      <ScenarioDropSeparator
        id={`${id}-drop-${pageIds.length}`}
        label={pageIds.length === 0 ? emptyLabel : undefined}
        dropTarget={dropTarget}
        onDragOver={onDragOver}
        onDragLeave={onDragLeaveDropSeparator}
        onDrop={(event) => onDrop(event, placementAt(pageIds.length))}
      />
    </ul>
  )
}

type ScenarioDropSeparatorProps = Readonly<{
  readonly id: string
  readonly label?: string
  readonly dropTarget: string | null
  readonly onDragOver: (event: DragEvent<HTMLElement>, targetId: string) => void
  readonly onDragLeave: (event: DragEvent<HTMLElement>) => void
  readonly onDrop: (event: DragEvent<HTMLElement>) => void
}>

/** Displays a list insertion point and handles drops at that position. */
function ScenarioDropSeparator({ id, label, dropTarget, onDragOver, onDragLeave, onDrop }: ScenarioDropSeparatorProps) {
  const active = dropTarget === id
  const className = active
    ? 'elce-drop-separator elce-drop-separator--active'
    : 'elce-drop-separator'
  return (
    <li
      id={id}
      className={className}
      aria-label={label ?? 'Point d’insertion'}
      onDragOver={(event) => onDragOver(event, id)}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <span className="elce-drop-separator__line" aria-hidden="true" />
      {label === undefined ? null : <span className="elce-drop-separator__label">{label}</span>}
    </li>
  )
}

type PageOutlineRowProps = Readonly<{
  readonly id: string
  readonly page: ElceDocument['pages'][number]
  readonly selectedPageId?: string
  readonly onSelect: (pageId: string) => void
  readonly onDelete: (pageId: string) => void
  readonly onDragStart: (event: DragEvent<HTMLElement>, pageId: string) => void
  readonly onDragEnd: () => void
}>

/** Renders one draggable page entry with its selection and delete actions. */
function PageOutlineRow({
  id,
  page,
  selectedPageId,
  onSelect,
  onDelete,
  onDragStart,
  onDragEnd,
}: PageOutlineRowProps) {
  return (
    <div
      id={`${id}-row-${page.id}`}
      className="elce-page-row"
      draggable
      aria-label={`Glisser pour déplacer ${page.name}`}
      onDragStart={(event) => {
        event.stopPropagation()
        onDragStart(event, page.id)
      }}
      onDragEnd={onDragEnd}
    >
      <span className="elce-drag-handle" title="Glisser pour déplacer" aria-hidden="true">
        <GripVertical size={14} strokeWidth={2} />
      </span>
      <button
        id={`${id}-select-${page.id}`}
        className={page.id === selectedPageId ? 'elce-page-button elce-page-button--selected' : 'elce-page-button'}
        type="button"
        onClick={() => onSelect(page.id)}
      >
        {page.name}
      </button>
        <span id={`${id}-type-${page.id}`} className="elce-muted"> · {pageTypeLabel(page.type)}</span>
      <div id={`${id}-actions-${page.id}`} className="elce-page-actions">
        <DeleteIconButton id={`${id}-delete-${page.id}`} onClick={() => onDelete(page.id)} />
      </div>
    </div>
  )
}

/** Returns the user-facing name of a page type without exposing code identifiers. */
function pageTypeLabel(pageType: PageType): 'Page' | 'Diapo' {
  switch (pageType) {
    case PAGE_TYPE.FLUX:
      return 'Page'
    case PAGE_TYPE.DIAPO:
      return 'Diapo'
  }
}

type DeleteIconButtonProps = Readonly<{
  readonly id: string
  readonly ariaLabel?: string
  readonly disabled?: boolean
  readonly onClick: () => void
}>

/** Renders the compact, accessible permanent-delete action. */
function DeleteIconButton({ id, ariaLabel = 'Supprimer définitivement', disabled, onClick }: DeleteIconButtonProps) {
  return (
    <button
      id={id}
      type="button"
      className="elce-danger-action"
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    >
      <Trash2 aria-hidden="true" size={14} strokeWidth={2} />
    </button>
  )
}

/** Applies the editor's page-type whitelist for creating a Question BDC. */
function pageAllowsQuestion(page: ElceDocument['pages'][number] | undefined): boolean {
  switch (page?.type) {
    case PAGE_TYPE.FLUX:
    case PAGE_TYPE.DIAPO:
      return true
    default:
      return false
  }
}

/** Applies the editor's page-type whitelist for creating a text BDC. */
function pageAllowsSection(page: ElceDocument['pages'][number] | undefined): boolean {
  switch (page?.type) {
    case PAGE_TYPE.FLUX:
      return true
    case PAGE_TYPE.DIAPO:
    default:
      return false
  }
}

/** Applies the Evaluation-only whitelist for the Result BDC toolbar action. */
function pageAllowsEvaluationResult(
  page: ElceDocument['pages'][number] | undefined,
  chapters: ElceDocument['chapters'],
): boolean {
  switch (page?.type) {
    case PAGE_TYPE.FLUX: {
      const chapter = page.chapterId === null
        ? undefined
        : chapters.find((candidate) => candidate.id === page.chapterId)
      switch (chapter?.type) {
        case CHAPTER_TYPE.EVALUATION:
          return true
        case CHAPTER_TYPE.STANDARD:
        case undefined:
          return false
      }
    }
    case PAGE_TYPE.DIAPO:
    default:
      return false
  }
}

/** Gives an image or video media type a compact label for catalogue rows. */
function catalogMediaLabel(mediaType: ElceCatalogMediaEntry['mediaType']): string {
  switch (mediaType) {
    case MEDIA_TYPE.IMAGE:
      return 'image'
    case MEDIA_TYPE.VIDEO:
      return 'vidéo'
  }
}

/** Returns the active tab style plus the visible cue for an accepted anchor return. */
function availableBdcTabClass(isActive: boolean, isDropTarget: boolean): string {
  return [
    'elce-content-catalog-tab',
    ...(isActive ? ['elce-content-catalog-tab--active'] : []),
    ...(isDropTarget ? ['elce-content-catalog-tab--drop-target'] : []),
  ].join(' ')
}
