import { useSelector } from '@xstate/react'
import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Archive, FilePlus, FolderPlus, GripVertical, Trash2 } from 'lucide-react'
import './app-layout.css'

import { ANCHOR_RETURN, BDC_TYPE, CATALOG_REFERENCE, CATALOG_TAB, MEDIA_TYPE, PAGE_LOCATION } from '../../config/document-config'
import {
  createChapterCommand,
  createPageDeleteCommand,
  createPageMoveCommand,
} from '../commands/document-commands'
import type { PagePlacement } from '../commands/document-command-types'
import type { AppLayoutProps } from './app-layout-types'
import { SectionEditor } from '../editor/SectionEditor'
import { PlayerPreview } from '../player/PlayerPreview'
import type { ElceDocument } from '../../domain/document-model'
import { ElceAnchorDropFacade } from '../../domain/anchor-drop-facade'
import { ElcePageMediaService } from '../../domain/page-media-service'
import type { ElceCatalogMediaEntry, ElceCatalogReference } from '../../domain/catalog-types'

const pageMediaService = new ElcePageMediaService()

/** Renders the Elcé work area from the controller-owned application state. */
export function AppLayout({ controller }: AppLayoutProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const draggedPageId = useRef<string | null>(null)
  const anchorDropFacadeRef = useRef<ElceAnchorDropFacade | null>(null)
  if (anchorDropFacadeRef.current === null) {
    anchorDropFacadeRef.current = new ElceAnchorDropFacade({
      dispatch: (sectionBdcId, change) => controller.send({ type: 'section.change', sectionBdcId, change }),
    })
  }
  const anchorDropFacade = anchorDropFacadeRef.current
  const stateValue = useSelector(controller, (snapshot) => String(snapshot.value))
  const documentModel = useSelector(controller, (snapshot) => snapshot.context.document)
  const selectedPageId = useSelector(controller, (snapshot) => snapshot.context.selectedPageId)
  const catalogTab = useSelector(controller, (snapshot) => snapshot.context.catalogTab)
  const mediaSources = useSelector(controller, (snapshot) => snapshot.context.mediaSources)
  const mediaSourceKey = Object.keys(mediaSources).sort().join('|')
  const selectedPage = documentModel.pages.find((page) => page.id === selectedPageId) ?? documentModel.pages[0]
  const selectedChapter = selectedPage?.chapterId === null || selectedPage === undefined
    ? undefined
    : documentModel.chapters.find((chapter) => chapter.id === selectedPage.chapterId)
  const selectedSection = selectedPage === undefined
    ? undefined
    : selectedPage.bdcIds
      .map((bdcId) => documentModel.bdcs.find((bdc) => bdc.id === bdcId))
      .find((bdc) => bdc?.type === BDC_TYPE.SECTION)
  const catalogContents = anchorDropFacade.catalogContents(documentModel)
  const unanchoredMediaBdcs = selectedPage === undefined
    ? []
    : pageMediaService.unanchoredMediaBdcs(documentModel, selectedPage)

  const addPage = () => {
    controller.send({ type: 'page.create' })
  }

  const addChapter = () => {
    controller.send({ type: 'document.apply', command: createChapterCommand(documentModel) })
  }

  const movePage = (pageId: string, placement: PagePlacement) => {
    controller.send({ type: 'document.apply', command: createPageMoveCommand(pageId, placement) })
  }

  const deletePage = (pageId: string) => {
    controller.send({ type: 'document.apply', command: createPageDeleteCommand(pageId) })
  }

  const returnBdcToCatalog = (bdcId: string) => {
    controller.send({ type: 'document.apply', command: { type: 'bdc.remove', bdcId } })
  }

  const beginPageDrag = (event: DragEvent<HTMLElement>, pageId: string) => {
    draggedPageId.current = pageId
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', pageId)
  }

  const endPageDrag = () => {
    draggedPageId.current = null
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
    switch (draggedPageId.current) {
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

  const dropPage = (event: DragEvent<HTMLElement>, placement: PagePlacement) => {
    const pageId = draggedPageId.current
    switch (pageId) {
      case null:
        return
      default:
        break
    }
    event.preventDefault()
    event.stopPropagation()
    movePage(pageId, placement)
    endPageDrag()
  }

  return (
    <div id="elce-workspace" className="elce-workspace">
      <header id="elce-header" className="elce-header">
        <div id="elce-brand" className="elce-brand">
          <span id="elce-brand-name">Elcé</span>
          <span id="elce-brand-status">POC</span>
        </div>
        <span id="elce-controller-state" className="elce-controller-state">
          état : {stateValue}
        </span>
      </header>
      <main id="elce-main" className="elce-main">
        <section id="elce-outline" className="elce-panel">
          <div id="elce-outline-heading" className="elce-panel-heading">
            <h1 id="elce-outline-title">Scénario</h1>
            <div id="elce-outline-actions" className="elce-outline-actions">
              <button id="elce-create-chapter" className="elce-icon-action" type="button" aria-label="Ajouter un chapitre" title="Ajouter un chapitre" onClick={addChapter}>
                <FolderPlus aria-hidden="true" size={17} strokeWidth={2} />
              </button>
              <button id="elce-create-page" className="elce-icon-action" type="button" aria-label="Ajouter une page" title="Ajouter une page" onClick={addPage} disabled={documentModel.chapters.length === 0}>
                <FilePlus aria-hidden="true" size={17} strokeWidth={2} />
              </button>
            </div>
          </div>
          <p id="elce-document-name">{documentModel.data.name}</p>
          <p id="elce-page-dnd-help" className="elce-muted">Glissez une page pour la déplacer ou la réordonner.</p>
          <PageDropList
            id="elce-scenario-page-list"
            documentModel={documentModel}
            pageIds={documentModel.data.scenarioPageIds}
            selectedPageId={selectedPage?.id}
            emptyLabel="Déposer une page à la racine du scénario"
            dropTarget={dropTarget}
            placementAt={(index) => ({ kind: PAGE_LOCATION.SCENARIO, index })}
            onSelect={(pageId) => controller.send({ type: 'page.select', pageId })}
            onDelete={deletePage}
            onDragStart={beginPageDrag}
            onDragEnd={endPageDrag}
            onDragOver={dragOverPageTarget}
            onDrop={dropPage}
          />
          <ul id="elce-chapter-list" className="elce-outline-list">
            {documentModel.chapters.map((chapter) => (
              <li id={`elce-chapter-${chapter.id}`} key={chapter.id}>
                <div id={`elce-chapter-heading-${chapter.id}`} className="elce-outline-item-heading">
                  <strong id={`elce-chapter-name-${chapter.id}`}>{chapter.name}</strong>
                  <DeleteIconButton
                    id={`elce-chapter-delete-${chapter.id}`}
                    disabled={chapter.pageIds.length > 0}
                    onClick={() => controller.send({ type: 'document.apply', command: { type: 'chapter.delete', chapterId: chapter.id } })}
                  />
                </div>
                <PageDropList
                  id={`elce-pages-${chapter.id}`}
                  documentModel={documentModel}
                  pageIds={chapter.pageIds}
                  selectedPageId={selectedPage?.id}
                  emptyLabel="Déposer une page dans ce chapitre"
                  dropTarget={dropTarget}
                  placementAt={(index) => ({ kind: PAGE_LOCATION.CHAPTER, chapterId: chapter.id, index })}
                  onSelect={(pageId) => controller.send({ type: 'page.select', pageId })}
                  onDelete={deletePage}
                  onDragStart={beginPageDrag}
                  onDragEnd={endPageDrag}
                  onDragOver={dragOverPageTarget}
                  onDrop={dropPage}
                />
              </li>
            ))}
          </ul>
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
              placementAt={() => ({ kind: PAGE_LOCATION.CATALOG })}
              onSelect={(pageId) => controller.send({ type: 'page.select', pageId })}
              onDelete={deletePage}
              onDragStart={beginPageDrag}
              onDragEnd={endPageDrag}
              onDragOver={dragOverPageTarget}
              onDrop={dropPage}
            />
          </section>
          <section id="elce-content-catalog" className="elce-outline-group">
            <h2 id="elce-content-catalog-title">Contenus disponibles</h2>
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
        </section>
        <section id="elce-work-area" className="elce-panel elce-work-area">
          <div id="elce-work-area-heading" className="elce-work-area-heading">
            <div id="elce-work-area-titles" className="elce-work-area-titles">
              {selectedChapter === undefined
                ? null
                : <h2 id="elce-work-area-chapter-title" className="elce-work-area-chapter-title">
                    <input
                      id={`elce-chapter-title-${selectedChapter.id}`}
                      key={`${selectedChapter.id}:${selectedChapter.name}`}
                      className="elce-inline-title-input"
                      type="text"
                      aria-label="Titre du chapitre"
                      title="Modifier le titre du chapitre"
                      defaultValue={selectedChapter.name}
                      onBlur={(event) => commitInlineName(event.currentTarget, selectedChapter.name, (name) => controller.send({
                        type: 'document.apply',
                        command: { type: 'chapter.rename', chapterId: selectedChapter.id, name },
                      }))}
                      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                    />
                  </h2>}
              {selectedPage === undefined
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
            <button id="elce-preview-open" type="button" onClick={() => setPreviewOpen(true)}>
              Prévisualiser
            </button>
          </div>
          {selectedSection === undefined
            ? <p id="elce-editor-unavailable">Sélectionnez une page Flux contenant une Section.</p>
            : <SectionEditor
                key={`${selectedSection.id}:${mediaSourceKey}`}
                bdc={selectedSection}
                createFileDropTarget={(file) => selectedPage === undefined ? null : anchorDropFacade.createFileDropTarget(file, selectedPage.id)}
                createCatalogDropTarget={(reference) => anchorDropFacade.createCatalogDropTarget(
                  documentModel,
                  reference,
                  selectedPage?.id ?? null,
                  selectedSection.id,
                )}
                resolveMediaSource={(mediaId) => mediaSources[mediaId] ?? null}
                onChange={(change) => anchorDropFacade.submitSectionChange(selectedSection.id, change)}
              />}
        </section>
        <aside id="elce-properties" className="elce-panel">
          <h1 id="elce-properties-title">Propriétés</h1>
          {unanchoredMediaBdcs.length === 0
            ? <p id="elce-properties-empty">Les propriétés du document apparaîtront ici.</p>
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
      {previewOpen
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

type PageDropListProps = Readonly<{
  readonly id: string
  readonly documentModel: ElceDocument
  readonly pageIds: readonly string[]
  readonly selectedPageId?: string
  readonly emptyLabel: string
  readonly dropTarget: string | null
  readonly placementAt: (index: number) => PagePlacement
  readonly onSelect: (pageId: string) => void
  readonly onDelete: (pageId: string) => void
  readonly onDragStart: (event: DragEvent<HTMLElement>, pageId: string) => void
  readonly onDragEnd: () => void
  readonly onDragOver: (event: DragEvent<HTMLElement>, targetId: string) => void
  readonly onDrop: (event: DragEvent<HTMLElement>, placement: PagePlacement) => void
}>

/** Renders one ordered page collection and its explicit drop targets. */
function PageDropList({
  id,
  documentModel,
  pageIds,
  selectedPageId,
  emptyLabel,
  dropTarget,
  placementAt,
  onSelect,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: PageDropListProps) {
  return (
    <ul
      id={id}
      className={dropTarget === `${id}-end` ? 'elce-outline-list elce-drop-target' : 'elce-outline-list'}
      onDragOver={(event) => onDragOver(event, `${id}-end`)}
      onDrop={(event) => onDrop(event, placementAt(pageIds.length))}
    >
      {pageIds.map((pageId, pageIndex) => {
        const page = documentModel.pages.find((candidate) => candidate.id === pageId)
        if (page === undefined) return null
        const rowTarget = `${id}-${page.id}`
        const rowClassName = dropTarget === rowTarget ? 'elce-page-row elce-page-row--drop-target' : 'elce-page-row'
        return (
          <li id={`${id}-item-${page.id}`} key={page.id}>
            <div
              id={`${id}-row-${page.id}`}
              className={rowClassName}
              draggable
              aria-label={`Glisser pour déplacer ${page.name}`}
              onDragStart={(event) => onDragStart(event, page.id)}
              onDragEnd={onDragEnd}
              onDragOver={(event) => onDragOver(event, rowTarget)}
              onDrop={(event) => onDrop(event, placementAt(resolveDropIndex(event, pageIndex)))}
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
              <span id={`${id}-type-${page.id}`} className="elce-muted"> · {page.type}</span>
              <div id={`${id}-actions-${page.id}`} className="elce-page-actions">
                <DeleteIconButton id={`${id}-delete-${page.id}`} onClick={() => onDelete(page.id)} />
              </div>
            </div>
          </li>
        )
      })}
      {pageIds.length === 0
        ? <li id={`${id}-empty`} className={dropTarget === `${id}-empty` ? 'elce-page-drop-empty elce-drop-target' : 'elce-page-drop-empty'} onDragOver={(event) => onDragOver(event, `${id}-empty`)} onDrop={(event) => onDrop(event, placementAt(0))}>{emptyLabel}</li>
        : null}
    </ul>
  )
}

/** Chooses insertion before or after the row under the pointer. */
function resolveDropIndex(event: DragEvent<HTMLElement>, pageIndex: number): number {
  const bounds = event.currentTarget.getBoundingClientRect()
  return event.clientY > bounds.top + bounds.height / 2 ? pageIndex + 1 : pageIndex
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
