import { BDC_LOCATION, BDC_TYPE, CARD_LAYOUT_IDS, CAROUSEL_CONFIG, DEFAULT_PRESET_ID, PAGE_TYPE } from '../../../config/document-config'
import type { BdcType, CardLayoutId } from '../../../config/document-config-types'
import { createEmptyRichTextDocument, ElceDocument } from '../../../domain/document/document-model'
import type { CardContent } from '../../../domain/card/card-types'
import type { EvaluationResultContent } from '../../../domain/evaluation/evaluation-result-types'
import type { CarouselContent } from '../../../domain/carousel/carousel-types'
import type { Bdc, BdcId } from '../../../domain/document/document-types'
import type { DocumentCommand } from '../document-command-types'
import { findBdc, removeValue, fail, findPage, pageBelongsToEvaluationChapter, placeBdc, withBdc } from './command-helpers'
import { questionService, evaluationResultService, carouselService, cardService } from './services'

/** Creates the default Section payload for a new text BDC. */
export function sectionForBdc(type: BdcType, bdcId: BdcId): Bdc['section'] {
  switch (type) {
    case BDC_TYPE.SECTION:
      return {
        title: '',
        markup: `<p id="${bdcId}-text"></p>`,
        content: createEmptyRichTextDocument(),
        revelation: { intro: null, outro: null },
      }
    default:
      return null
  }
}

/** Creates the configured authored Question value for a new Question BDC. */
export function questionForBdc(type: BdcType): Bdc['question'] {
  switch (type) {
    case BDC_TYPE.QUESTION:
      return questionService.createDefault()
    default:
      return null
  }
}

/** Creates the two empty outcome branches for a new result BDC. */
function evaluationResultForBdc(type: BdcType): NonNullable<Bdc['evaluationResult']> | null {
  switch (type) {
    case BDC_TYPE.EVALUATION_RESULT:
      return evaluationResultService.createDefault()
    default:
      return null
  }
}

/** Creates all Card fields for a new Card BDC, regardless of its selected layout. */
function cardForBdc(type: BdcType): CardContent | null {
  switch (type) {
    case BDC_TYPE.CARD:
      return cardService.createDefault(CAROUSEL_CONFIG.defaultImagePosition)
    default:
      return null
  }
}

/** Deletes a BDC and its owned children while preserving separate media resources. */
export function deleteBdc(document: ElceDocument, bdcId: BdcId): ElceDocument {
  const bdc = findBdc(document, bdcId)
  let documentWithoutChildren = document
  if (bdc.type === BDC_TYPE.CAROUSEL && bdc.carousel != null) {
    for (const entry of bdc.carousel.cards) documentWithoutChildren = deleteBdc(documentWithoutChildren, entry.bdcId)
  }
  if (bdc.type === BDC_TYPE.SECTION) {
    for (const child of document.bdcs.filter((candidate) => candidate.parentBdcId === bdc.id)) {
      documentWithoutChildren = deleteBdc(documentWithoutChildren, child.id)
    }
  }
  return new ElceDocument({
    ...documentWithoutChildren.data,
    pages: documentWithoutChildren.pages.map((page) => ({ ...page, bdcIds: removeValue(page.bdcIds, bdc.id) })),
    bdcs: documentWithoutChildren.bdcs
      .filter((candidate) => candidate.id !== bdc.id)
      .map((candidate) => candidate.type === BDC_TYPE.CAROUSEL && candidate.carousel != null
        ? { ...candidate, carousel: { ...candidate.carousel, cards: candidate.carousel.cards.filter((entry) => entry.bdcId !== bdc.id) } }
        : candidate),
    catalogBdcIds: removeValue(documentWithoutChildren.data.catalogBdcIds, bdc.id),
  })
}

/** Permanently deletes an unused catalog bdc while retaining its media resource. */
export function deleteCatalogBdc(document: ElceDocument, bdcId: BdcId): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.pageId) {
    case null:
      break
    default:
      fail(`Le bdc ${bdcId} est utilisé par une page et ne peut pas être supprimé du catalogue.`)
  }
  switch (document.data.catalogBdcIds.includes(bdc.id)) {
    case true:
      return deleteBdc(document, bdc.id)
    case false:
      fail(`Le bdc ${bdcId} n’est pas disponible dans le catalogue.`)
  }
}

/** Creates a BDC in its requested page or container placement. */
export function createBdc(document: ElceDocument, command: Extract<DocumentCommand, { type: 'bdc.create' }>): ElceDocument {
  if (document.bdcs.some((bdc) => bdc.id === command.bdcId)) fail(`Bdc déjà présent : ${command.bdcId}`)
  if (command.initialCardOptions !== undefined && command.bdcType !== BDC_TYPE.CARD) {
    fail('Les options initiales ne concernent que la création d’un BDC Carte.')
  }
  if (command.placement.kind === BDC_LOCATION.PAGE) {
    const page = findPage(document, command.placement.pageId)
    if (page.type === PAGE_TYPE.DIAPO
      && command.bdcType !== BDC_TYPE.CAROUSEL
      && command.bdcType !== BDC_TYPE.QUESTION
      && command.bdcType !== BDC_TYPE.CARD
      && command.bdcType !== BDC_TYPE.EVALUATION_RESULT) {
      fail('Une Diapo accepte un Carousel, un Quiz, une Carte autonome ou un Résultat d’Évaluation.')
    }
  }
  switch (command.bdcType) {
    case BDC_TYPE.CAROUSEL:
      if (command.presetId !== DEFAULT_PRESET_ID.CAROUSEL || command.initialCardBdcId === undefined) {
        fail('Un BDC Carousel utilise son preset configuré et reçoit une première carte identifiée.')
      }
      switch (command.placement.kind) {
        case BDC_LOCATION.PAGE: {
          const page = findPage(document, command.placement.pageId)
          switch (page.type) {
            case PAGE_TYPE.FLUX:
              break
            case PAGE_TYPE.DIAPO:
              if (page.bdcIds.some((bdcId) => findBdc(document, bdcId).type === BDC_TYPE.CAROUSEL)) {
                fail(`La page Diapo possède déjà son BDC Carousel : ${page.id}`)
              }
              break
          }
          break
        }
        case BDC_LOCATION.CATALOG:
          fail('Un BDC Carousel est créé directement dans une page Flux.')
        case BDC_LOCATION.PARENT:
          fail('Un BDC Carousel ne peut pas être créé dans un autre BDC pendant cette tranche.')
      }
      break
    case BDC_TYPE.CARD:
      if (!CARD_LAYOUT_IDS.includes(command.presetId as CardLayoutId)
        || command.initialCardBdcId !== undefined) {
        fail('Un BDC Carte utilise un layout configuré et ne reçoit pas de carte initiale.')
      }
      break
    case BDC_TYPE.EVALUATION_RESULT:
      if (command.presetId !== DEFAULT_PRESET_ID.EVALUATION_RESULT) {
        fail('Un BDC Résultat utilise son preset configuré et ne reçoit pas de média direct.')
      }
      switch (command.placement.kind) {
        case BDC_LOCATION.PAGE: {
          const page = findPage(document, command.placement.pageId)
          if (!pageBelongsToEvaluationChapter(document, page)) {
            fail('Un BDC Résultat ne peut être créé que dans une page d’un chapitre Évaluation.')
          }
          break
        }
        case BDC_LOCATION.CATALOG:
          fail('Un BDC Résultat est créé directement dans une page d’Évaluation.')
        case BDC_LOCATION.PARENT:
          fail('Un BDC Résultat ne peut pas être créé dans un autre BDC.')
      }
      break
    case BDC_TYPE.QUESTION: {
      if (command.presetId !== DEFAULT_PRESET_ID.QUESTION) {
        fail('Une Question utilise son preset configuré et reçoit un média par sa zone Illustration.')
      }
      switch (command.placement.kind) {
        case BDC_LOCATION.PAGE: {
          const page = findPage(document, command.placement.pageId)
          switch (page.type) {
            case PAGE_TYPE.FLUX:
              break
            case PAGE_TYPE.DIAPO:
              break
          }
          break
        }
        case BDC_LOCATION.CATALOG:
          fail('Un bdc Question est créé directement dans une page Flux.')
        case BDC_LOCATION.PARENT:
          fail('Un bdc Question ne peut pas être créé dans un autre BDC pendant cette tranche.')
      }
      break
    }
    default:
      break
  }
  const bdc: Bdc = {
    id: command.bdcId,
    type: command.bdcType,
    presetId: command.presetId,
    pageId: null,
    parentBdcId: null,
    section: sectionForBdc(command.bdcType, command.bdcId),
    question: questionForBdc(command.bdcType),
    evaluationResult: evaluationResultForBdc(command.bdcType),
    carousel: command.bdcType === BDC_TYPE.CAROUSEL && command.initialCardBdcId !== undefined
      ? { ...carouselService.createDefault(command.initialCardBdcId), cards: [] }
      : null,
    card: command.initialCardOptions === undefined
      ? cardForBdc(command.bdcType)
      : cardService.createDefault(command.initialCardOptions.imagePosition, command.initialCardOptions.imageFit),
  }
  const withParent = placeBdc(new ElceDocument({ ...document.data, bdcs: [...document.bdcs, bdc] }), bdc, command.placement)
  if (bdc.type !== BDC_TYPE.CAROUSEL || command.initialCardBdcId === undefined) return withParent
  const initialCard: Bdc = {
    id: command.initialCardBdcId,
    type: BDC_TYPE.CARD,
    presetId: CAROUSEL_CONFIG.initialCardLayoutId,
    pageId: null,
    parentBdcId: null,
    section: null,
    question: null,
    evaluationResult: null,
    carousel: null,
    card: cardService.createDefault(),
  }
  if (withParent.bdcs.some((candidate) => candidate.id === initialCard.id)) fail(`Bdc déjà présent : ${initialCard.id}`)
  const withCard = new ElceDocument({ ...withParent.data, bdcs: [...withParent.bdcs, initialCard] })
  return placeBdc(withCard, initialCard, { kind: BDC_LOCATION.PARENT, parentBdcId: bdc.id })
}

/** Updates Question text and response definitions through a single command. */
export function updateQuestion(document: ElceDocument, bdcId: BdcId, question: NonNullable<Bdc['question']>): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.QUESTION:
      if (bdc.question === null) fail(`Bdc Question incomplet : ${bdcId}`)
      break
    default:
      fail(`Le bdc ${bdcId} n’est pas une Question.`)
  }
  questionService.assertValid(question)
  return withBdc(document, { ...bdc, question })
}

/** Updates both outcome branches through the document command path. */
export function updateEvaluationResult(document: ElceDocument, bdcId: BdcId, evaluationResult: EvaluationResultContent): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.EVALUATION_RESULT:
      if (bdc.evaluationResult === null || bdc.evaluationResult === undefined) {
        fail(`Bdc Résultat incomplet : ${bdcId}`)
      }
      break
    default:
      fail(`Le bdc ${bdcId} n’est pas un Résultat d’évaluation.`)
  }
  evaluationResultService.assertValid(evaluationResult)
  return withBdc(document, { ...bdc, evaluationResult })
}

/** Updates Carousel settings and its existing Card order through one command. */
export function updateCarousel(document: ElceDocument, bdcId: BdcId, carousel: CarouselContent): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.CAROUSEL:
      if (bdc.carousel === null || bdc.carousel === undefined) fail(`Bdc Carousel incomplet : ${bdcId}`)
      break
    default:
      fail(`Le bdc ${bdcId} n’est pas un Carousel.`)
  }
  carouselService.assertValid(carousel)
  const currentIds = bdc.carousel.cards.map((entry) => entry.bdcId).sort()
  const nextIds = carousel.cards.map((entry) => entry.bdcId).sort()
  if (currentIds.length !== nextIds.length || currentIds.some((id, index) => id !== nextIds[index])) {
    fail('Une mise à jour Carousel ne peut ni ajouter ni retirer ses BDC Carte.')
  }
  return withBdc(document, { ...bdc, carousel })
}

/** Updates the complete content fields of one Card without changing its layout. */
export function updateCard(document: ElceDocument, bdcId: BdcId, card: CardContent): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.CARD:
      if (bdc.card === null || bdc.card === undefined) fail(`Bdc Carte incomplet : ${bdcId}`)
      break
    default:
      fail(`Le bdc ${bdcId} n’est pas une Carte.`)
  }
  cardService.assertValid(card)
  return withBdc(document, { ...bdc, card })
}

/** Selects one Card layout while preserving every authored Card field. */
export function setCardLayout(document: ElceDocument, bdcId: BdcId, layoutId: CardLayoutId): ElceDocument {
  const bdc = findBdc(document, bdcId)
  if (bdc.type !== BDC_TYPE.CARD || bdc.card == null) fail(`Le bdc ${bdcId} n’est pas une Carte.`)
  if (!CARD_LAYOUT_IDS.includes(layoutId)) fail(`Layout de carte inconnu : ${layoutId}`)
  return withBdc(document, { ...bdc, presetId: layoutId })
}

/** Permanently removes one Card BDC, preserving media and nonempty Carousels. */
export function deleteCard(document: ElceDocument, bdcId: BdcId): ElceDocument {
  const bdc = findBdc(document, bdcId)
  if (bdc.type !== BDC_TYPE.CARD) fail(`Seul un BDC Carte peut être retiré par cette commande : ${bdcId}`)
  if (bdc.parentBdcId === null) {
    const page = bdc.pageId === null ? undefined : findPage(document, bdc.pageId)
    switch (page?.type) {
      case PAGE_TYPE.FLUX:
      case PAGE_TYPE.DIAPO:
      case undefined:
        return deleteBdc(document, bdc.id)
    }
  }
  const parent = findBdc(document, bdc.parentBdcId)
  switch (parent.type) {
    case BDC_TYPE.CAROUSEL:
      if (parent.carousel == null || parent.carousel.cards.length <= 1) {
        fail('Un Carousel doit conserver au moins une carte.')
      }
      return deleteBdc(document, bdc.id)
    case BDC_TYPE.SECTION:
      fail('Une Carte ancrée doit être retirée par son ancre.')
    default:
      fail(`Le parent de la Carte ${bdc.id} ne permet pas sa suppression.`)
  }
}

/** Permanently removes one Carousel BDC while keeping its reusable media resources. */
export function deleteCarousel(document: ElceDocument, bdcId: BdcId): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.CAROUSEL:
      return deleteBdc(document, bdc.id)
    default:
      fail(`Seul un bdc Carousel peut être supprimé par cette commande : ${bdcId}`)
  }
}

/** Permanently removes one Question BDC and preserves its reusable illustration. */
export function deleteQuestion(document: ElceDocument, bdcId: BdcId): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.QUESTION:
      return deleteBdc(document, bdc.id)
    default:
      fail(`Seul un bdc Question peut être supprimé par cette commande : ${bdcId}`)
  }
}

/** Permanently removes one Result BDC from its page. */
export function deleteEvaluationResult(document: ElceDocument, bdcId: BdcId): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.EVALUATION_RESULT:
      return deleteBdc(document, bdc.id)
    default:
      fail(`Seul un bdc Résultat peut être supprimé par cette commande : ${bdcId}`)
  }
}
