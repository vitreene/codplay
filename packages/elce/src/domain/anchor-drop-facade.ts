import type { ElceSectionChange, ElceAnchorDropTarget } from './anchor-types'
import { ElceAnchorDropService } from './anchor-drop-service'
import type { ElceDocument } from './document-model'
import type { ElceCatalogContents, ElceCatalogDropTarget, ElceCatalogReference } from './catalog-types'
import type { PageId } from './document-types'

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

  /** Creates the business target for one accepted file without touching React state. */
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
