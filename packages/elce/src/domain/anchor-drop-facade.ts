import type { ElceSectionChange, ElceAnchorDropTarget } from './anchor-types'
import { ElceAnchorDropService } from './anchor-drop-service'
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

  /** Sends the complete drop/edit intention to the XState command boundary. */
  public submitSectionChange(sectionBdcId: string, change: ElceSectionChange): void {
    this.dispatcher.dispatch(sectionBdcId, change)
  }
}
