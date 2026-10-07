import { BDC_LOCATION, BDC_TYPE, PAGE_LOCATION } from '../../../config/document-config'
import { ElceDocument } from '../../../domain/document/document-model'
import type { DocumentCommand } from '../document-command-types'
import { createChapter, renameChapter, updateChapterEvaluationSettings, moveChapter, deleteChapter, createPage, renamePage, movePage, deletePage } from './page-commands'
import { createBdc, deleteCatalogBdc, updateQuestion, updateEvaluationResult, updateCarousel, updateCard, setCardLayout, deleteCard, deleteQuestion, deleteEvaluationResult, deleteCarousel } from './bdc-commands'
import { moveBdc, createAnchoredBdc, attachCatalogBdc, moveAnchoredBdc, removeAnchoredBdc, returnAnchoredBdc } from './anchor-commands'
import { findBdc, fail } from './command-helpers'
import { updateSectionContent, deleteSection, updateSectionRevelation } from './section-commands'
import { setCardMedia, attachCardMedia, setQuestionMedia, attachQuestionMedia, mergeMedia } from './media-commands'
import { updateDocumentRevelation } from './revelation-commands'
import { assertDocumentInvariants } from './document-invariants'

/** Applies one document command and returns a new immutable model value. */
function applyCommand(document: ElceDocument, command: DocumentCommand): ElceDocument {
  switch (command.type) {
    case 'chapter.create':
      return createChapter(document, command)
    case 'chapter.rename':
      return renameChapter(document, command.chapterId, command.name)
    case 'chapter.evaluation.settings.update':
      return updateChapterEvaluationSettings(document, command)
    case 'chapter.move':
      return moveChapter(document, command.chapterId, command.index)
    case 'chapter.delete':
      return deleteChapter(document, command.chapterId)
    case 'page.create':
      return createPage(document, command)
    case 'page.rename':
      return renamePage(document, command.pageId, command.name)
    case 'page.move':
      return movePage(document, command)
    case 'page.remove':
      return movePage(document, { type: 'page.move', pageId: command.pageId, placement: { kind: PAGE_LOCATION.CATALOG } })
    case 'page.delete':
      return deletePage(document, command.pageId)
    case 'bdc.create':
      return createBdc(document, command)
    case 'bdc.move':
      return moveBdc(document, command)
    case 'bdc.remove':
      return moveBdc(document, { type: 'bdc.move', bdcId: command.bdcId, placement: { kind: BDC_LOCATION.CATALOG } })
    case 'bdc.delete':
      return deleteCatalogBdc(document, command.bdcId)
    case 'bdc.section.update': {
      const bdc = findBdc(document, command.bdcId)
      switch (bdc.type) {
        case BDC_TYPE.SECTION:
          return updateSectionContent(document, command.bdcId, command.title, command.markup, command.content)
        default:
          fail(`Bdc non textuel : ${command.bdcId}`)
      }
    }
    case 'bdc.question.update':
      return updateQuestion(document, command.bdcId, command.question)
    case 'bdc.evaluation-result.update':
      return updateEvaluationResult(document, command.bdcId, command.evaluationResult)
    case 'bdc.carousel.update':
      return updateCarousel(document, command.bdcId, command.carousel)
    case 'bdc.card.update':
      return updateCard(document, command.bdcId, command.card)
    case 'bdc.card.layout.set':
      return setCardLayout(document, command.bdcId, command.layoutId)
    case 'bdc.card.media.set':
      return setCardMedia(document, command.bdcId, command.mediaId)
    case 'bdc.card.media.attach':
      return attachCardMedia(document, command.bdcId, command.media)
    case 'bdc.card.delete':
      return deleteCard(document, command.bdcId)
    case 'bdc.question.media.set':
      return setQuestionMedia(document, command.bdcId, command.mediaId)
    case 'bdc.question.media.attach':
      return attachQuestionMedia(document, command.bdcId, command.media)
    case 'bdc.question.delete':
      return deleteQuestion(document, command.bdcId)
    case 'bdc.section.delete':
      return deleteSection(document, command.bdcId)
    case 'bdc.section.revelation.update':
      return updateSectionRevelation(document, command.bdcId, command.revelation)
    case 'bdc.evaluation-result.delete':
      return deleteEvaluationResult(document, command.bdcId)
    case 'bdc.carousel.delete':
      return deleteCarousel(document, command.bdcId)
    case 'bdc.anchor.create':
      return createAnchoredBdc(document, command)
    case 'bdc.anchor.attach':
      return attachCatalogBdc(document, command)
    case 'bdc.anchor.move':
      return moveAnchoredBdc(document, command)
    case 'bdc.anchor.remove':
      return removeAnchoredBdc(document, command)
    case 'bdc.anchor.return':
      return returnAnchoredBdc(document, command)
    case 'media.add':
      if (document.medias.some((media) => media.id === command.media.id)) fail(`Média déjà présent : ${command.media.id}`)
      return new ElceDocument({ ...document.data, medias: [...document.medias, command.media] })
    case 'media.merge':
      return mergeMedia(document, command.canonicalMediaId, command.duplicateMediaIds)
    case 'document.revelation.update':
      return updateDocumentRevelation(document, command.revelationDefaults)
    case 'document.rename':
      return new ElceDocument({ ...document.data, name: command.name })
  }
}

/** Applies a document command and verifies its cross-entity invariants before returning. */
export function applyDocumentCommand(document: ElceDocument, command: DocumentCommand): ElceDocument {
  const updated = applyCommand(document, command)
  assertDocumentInvariants(updated)
  return updated
}
