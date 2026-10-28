import type { LearningDocument } from '../document/learning-document'
import { LearningDocument as LearningDocumentModel } from '../document/learning-document'
import type { LearningDocumentCommand } from './learning-document-command-types'
import {
  attachCardMedia,
  attachQuestionMedia,
  attachSummaryBackgroundMedia,
  mergeMedia,
  setCardMedia,
  setQuestionMedia,
} from './operations/media-commands'
import { fail } from './operations/command-helpers'

/** Applies Learning media references and serialized media-import commands. */
export class LearningMediaCommandService {
  /** Applies a media command when this service owns its event. */
  public apply(document: LearningDocument, command: LearningDocumentCommand): LearningDocument | null {
    switch (command.type) {
      case 'media.add':
        if (document.medias.some((media) => media.id === command.media.id)) fail(`Média déjà présent : ${command.media.id}`)
        return new LearningDocumentModel({ ...document.data, medias: [...document.medias, command.media] })
      case 'media.merge':
        return mergeMedia(document, command.canonicalMediaId, command.duplicateMediaIds)
      case 'bdc.card.media.set':
        return setCardMedia(document, command.bdcId, command.mediaId)
      case 'bdc.card.media.attach':
        return attachCardMedia(document, command.bdcId, command.media)
      case 'bdc.question.media.set':
        return setQuestionMedia(document, command.bdcId, command.mediaId)
      case 'bdc.question.media.attach':
        return attachQuestionMedia(document, command.bdcId, command.media)
      case 'summary.background.media.attach':
        return attachSummaryBackgroundMedia(document, command.media)
      default:
        return null
    }
  }
}
