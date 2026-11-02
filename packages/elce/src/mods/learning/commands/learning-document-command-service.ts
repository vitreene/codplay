import { BDC_LOCATION } from '../../../core/document/content-location'
import { LearningDocument } from '../document/learning-document'
import type { LearningDocumentCommand } from './learning-document-command-types'
import type { LearningDocumentService } from '../document/learning-document-service'
import type { LearningCommandResourceServices } from './learning-command-resource-services'
import { LearningAnchorCommandService } from './learning-anchor-command-service'
import { LearningBdcCommandService } from './learning-bdc-command-service'
import { LearningMediaCommandService } from './learning-media-command-service'
import { LearningPageCommandService } from './learning-page-command-service'
import { LearningRevelationCommandService } from './learning-revelation-command-service'
import {
  resetAppearanceProperty,
  setAppearanceBackground,
  setAppearanceProperty,
  setAppearanceTypography,
} from './operations/appearance-commands'

/** Dispatches Learning document commands through their owning domain services. */
export class LearningDocumentCommandService {
  private readonly documentService: LearningDocumentService
  private readonly resources: LearningCommandResourceServices
  private readonly pageCommands: LearningPageCommandService
  private readonly bdcCommands: LearningBdcCommandService
  private readonly anchorCommands: LearningAnchorCommandService
  private readonly mediaCommands: LearningMediaCommandService
  private readonly revelationCommands: LearningRevelationCommandService

  public constructor(
    documentService: LearningDocumentService,
    resources: LearningCommandResourceServices,
    pageCommands: LearningPageCommandService,
    bdcCommands: LearningBdcCommandService,
    anchorCommands: LearningAnchorCommandService,
    mediaCommands: LearningMediaCommandService,
    revelationCommands: LearningRevelationCommandService,
  ) {
    this.documentService = documentService
    this.resources = resources
    this.pageCommands = pageCommands
    this.bdcCommands = bdcCommands
    this.anchorCommands = anchorCommands
    this.mediaCommands = mediaCommands
    this.revelationCommands = revelationCommands
  }

  /** Applies one command, then checks the Learning aggregate invariants. */
  public applyCommand(document: LearningDocument, command: LearningDocumentCommand): LearningDocument {
    const updated = this.pageCommands.apply(document, command)
      ?? this.bdcCommands.apply(document, command)
      ?? this.anchorCommands.apply(document, command)
      ?? this.mediaCommands.apply(document, command)
      ?? this.revelationCommands.apply(document, command)
      ?? this.applyDocumentCommand(document, command)
    this.assertDocumentInvariants(updated)
    return updated
  }

  /** Verifies the full invariant chain with the resource services in this composition. */
  public assertDocumentInvariants(document: LearningDocument): void {
    this.documentService.assertDocumentInvariants(document, this.resources)
  }

  /** Applies document-level summary, profile, appearance and naming commands. */
  private applyDocumentCommand(document: LearningDocument, command: LearningDocumentCommand): LearningDocument {
    switch (command.type) {
      case 'summary.settings.update':
        return new LearningDocument({ ...document.data, summary: command.summary })
      case 'profile.definition.update':
        return new LearningDocument({ ...document.data, profile: command.profile })
      case 'appearance.background.set':
        return setAppearanceBackground(document, command.target, command.value)
      case 'appearance.typography.set':
        return setAppearanceTypography(document, command.target, command.headingFontId, command.bodyFontId)
      case 'appearance.property.set':
        return setAppearanceProperty(document, command.target, command.property, command.value)
      case 'appearance.property.reset':
        return resetAppearanceProperty(document, command.target, command.property)
      case 'document.rename':
        return new LearningDocument({ ...document.data, name: command.name })
      default:
        throw new Error(`Commande Learning sans propriétaire : ${command.type}`)
    }
  }

  /** Checks whether the authoritative move command accepts a destination page. */
  public canMoveBdcToPage(document: LearningDocument, bdcId: string, pageId: string, index: number): boolean {
    try {
      this.applyCommand(document, {
        type: 'bdc.move',
        bdcId,
        placement: { kind: BDC_LOCATION.PAGE, pageId, index },
      })
      return true
    } catch {
      return false
    }
  }
}
