import type { ElceSectionChange, ElceAnchorDropTarget } from '../../../domain/anchor/anchor-types'
import { ElceAnchorDropService } from '../../../domain/anchor/anchor-drop-service'
import type { ElceDocument } from '../../../domain/document/document-model'
import type { ElceCatalogContents, ElceCatalogDropTarget, ElceCatalogReference } from '../../../domain/catalog/catalog-types'
import type { PageId } from '../../../domain/document/document-types'

export interface ElceAnchorChangeDispatcher {
  dispatch(sectionBdcId: string, change: ElceSectionChange): void
}

/** Isolates the editor-to-controller gesture boundary for anchored bdc drops. */
export class ElceAnchorDropFacade {
  private readonly targetService: ElceAnchorDropService
  private readonly dispatcher: ElceAnchorChangeDispatcher

  public constructor(dispatcher: ElceAnchorChangeDispatcher) {
    this.dispatcher = dispatcher
    this.targetService = new ElceAnchorDropService()
  }

  /** Creates the métier target for one accepted file without storing view state. */
  public createFileDropTarget(file: File, pageId: PageId): ElceAnchorDropTarget | null {
    return this.targetService.createFileDropTarget(file, pageId)
  }

  /** Lists draggable media references and unused media bdcs from the document. */
  public catalogContents(document: ElceDocument): ElceCatalogContents {
    return this.targetService.catalogContents(document)
  }

  /** Resolves a catalogue reference for the currently edited Flux Section. */
  public createCatalogDropTarget(
    document: ElceDocument,
    reference: ElceCatalogReference,
    pageId: PageId | null,
    sectionBdcId: string,
  ): ElceCatalogDropTarget | null {
    return this.targetService.createCatalogDropTarget(document, reference, pageId, sectionBdcId)
  }

  /** Sends the complete drop/edit intention to the XState command boundary. */
  public submitSectionChange(sectionBdcId: string, change: ElceSectionChange): void {
    this.dispatcher.dispatch(sectionBdcId, change)
  }
}
