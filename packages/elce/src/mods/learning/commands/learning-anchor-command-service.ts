import type { LearningDocument } from '../document/learning-document'
import type { LearningDocumentCommand } from './learning-document-command-types'
import type { LearningCommandResourceServices } from './learning-command-resource-services'
import {
  attachCatalogBdc,
  createAnchoredBdc,
  moveAnchoredBdc,
  moveBdc,
  removeAnchoredBdc,
  returnAnchoredBdc,
} from './operations/anchor-commands'
import { deleteSection, updateSectionContent, updateSectionRevelation } from './operations/section-commands'
import { BDC_LOCATION } from '../../../core/document/content-location'

/** Applies Learning's Section and placement adaptations over shared anchoring. */
export class LearningAnchorCommandService {
  private readonly resources: LearningCommandResourceServices

  public constructor(resources: LearningCommandResourceServices) {
    this.resources = resources
  }

  /** Applies an anchoring or Section command when this service owns its event. */
  public apply(document: LearningDocument, command: LearningDocumentCommand): LearningDocument | null {
    switch (command.type) {
      case 'bdc.move':
        return moveBdc(document, command, this.resources)
      case 'bdc.remove':
        return moveBdc(document, { type: 'bdc.move', bdcId: command.bdcId, placement: { kind: BDC_LOCATION.CATALOG } }, this.resources)
      case 'bdc.section.update':
        return updateSectionContent(document, command.bdcId, command.title, command.markup, command.content, [], this.resources)
      case 'bdc.section.delete':
        return deleteSection(document, command.bdcId, this.resources)
      case 'bdc.section.revelation.update':
        return updateSectionRevelation(document, command.bdcId, command.revelation)
      case 'bdc.anchor.create':
        return createAnchoredBdc(document, command, this.resources)
      case 'bdc.anchor.attach':
        return attachCatalogBdc(document, command, this.resources)
      case 'bdc.anchor.move':
        return moveAnchoredBdc(document, command, this.resources)
      case 'bdc.anchor.remove':
        return removeAnchoredBdc(document, command, this.resources)
      case 'bdc.anchor.return':
        return returnAnchoredBdc(document, command, this.resources)
      default:
        return null
    }
  }
}
