import type { ElceSectionChange, ElceAnchorDropTarget } from '../domain/anchor-types'
import type { ElceAnchorDropService } from '../domain/anchor-drop-service'
import type { ResourceDocumentData } from '../../document/resource-document-types'
import type { ElceCatalogContents, ElceCatalogDropTarget, ElceCatalogReference } from '../../../core/catalog/catalog-types'
import type { PageId } from '../../../core/document/content-document-types'
import type { SectionSelection } from '../../bdcs/section/authoring/section-selection-types'

export interface SectionChangeSelection {
  readonly before?: SectionSelection
  readonly after?: SectionSelection
}

export interface ElceAnchorChangeDispatcher {
  dispatch(sectionBdcId: string, change: ElceSectionChange, selection?: SectionChangeSelection): void
}

export interface ElceAnchorDropFacadeOptions {
  readonly targetService: ElceAnchorDropService
  readonly dispatcher: ElceAnchorChangeDispatcher
}

/** Isolates the editor-to-controller gesture boundary for anchored bdc drops. */
export class ElceAnchorDropFacade {
  private readonly targetService: ElceAnchorDropService
  private readonly dispatcher: ElceAnchorChangeDispatcher

  public constructor(options: ElceAnchorDropFacadeOptions) {
    this.dispatcher = options.dispatcher
    this.targetService = options.targetService
  }

  /** Creates the métier target for one accepted file without storing view state. */
  public createFileDropTarget(file: File, pageId: PageId): ElceAnchorDropTarget | null {
    return this.targetService.createFileDropTarget(file, pageId)
  }

  /** Lists draggable media references and unused media bdcs from the document. */
  public catalogContents(document: ResourceDocumentData): ElceCatalogContents {
    return this.targetService.catalogContents(document)
  }

  /** Resolves a catalogue reference for the currently edited Flux Section. */
  public createCatalogDropTarget(
    document: ResourceDocumentData,
    reference: ElceCatalogReference,
    pageId: PageId | null,
    sectionBdcId: string,
  ): ElceCatalogDropTarget | null {
    return this.targetService.createCatalogDropTarget(document, reference, pageId, sectionBdcId)
  }

  /** Sends the complete drop/edit intention to the XState command boundary. */
  public submitSectionChange(sectionBdcId: string, change: ElceSectionChange, selection?: SectionChangeSelection): void {
    this.dispatcher.dispatch(sectionBdcId, change, selection)
  }
}
