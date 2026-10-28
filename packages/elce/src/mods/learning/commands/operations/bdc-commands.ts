import { BDC_TYPE, DEFAULT_PRESET_ID, PAGE_TYPE } from '../../learning-definition'
import { CARD_LAYOUT_IDS } from '../../../../resources/bdcs/card/card-config'
import { CAROUSEL_CONFIG } from '../../../../resources/bdcs/carousel/carousel-config'
import { STATISTICAL_GRAPH_LAYOUT_IDS } from '../../../../resources/bdcs/statistical-graph/statistical-graph-config'
import { BDC_LOCATION } from '../../../../core/document/content-location'
import type { BdcType } from '../../learning-definition'
import type { CardLayoutId } from '../../../../resources/bdcs/card/card-config'
import type { StatisticalGraphLayoutId } from '../../../../resources/bdcs/statistical-graph/statistical-graph-config'
import { LearningDocument } from '../../document/learning-document'
import { createEmptyRichTextDocument } from '../../../../resources/bdcs/section/domain/section-service'
import type { CardContent } from '../../../../resources/bdcs/card/domain/card-types'
import type { StatisticalGraphContent } from '../../../../resources/bdcs/statistical-graph/domain/statistical-graph-types'
import type { EvaluationResultContent } from '../../evaluation/domain/learning-evaluation-result-types'
import type { CarouselContent } from '../../../../resources/bdcs/carousel/domain/carousel-types'
import type { LearningBdc } from '../../document/learning-document-types'
import type { BdcId } from '../../../../core/document/content-document-types'
import type { LearningDocumentCommand } from '../learning-document-command-types'
import { findBdc, findPage } from '../../../../core/document/content-placement-service'
import { removeValue } from '../../../../core/document/collection-operations'
import { fail, placeBdc, withBdc } from './command-helpers'
import type { LearningCommandResourceServices } from '../learning-command-resource-services'
import { LearningPageCommandService } from '../learning-page-command-service'

/** Creates the default Section payload for a new text BDC. */
export function sectionForBdc(type: BdcType, bdcId: BdcId): LearningBdc['section'] {
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
export function questionForBdc(type: BdcType, resources: LearningCommandResourceServices): LearningBdc['question'] {
  switch (type) {
    case BDC_TYPE.QUESTION:
      return resources.questionService.createDefault()
    default:
      return null
  }
}

/** Creates the two empty outcome branches for a new result BDC. */
function evaluationResultForBdc(type: BdcType, resources: LearningCommandResourceServices): NonNullable<LearningBdc['evaluationResult']> | null {
  switch (type) {
    case BDC_TYPE.EVALUATION_RESULT:
      return resources.evaluationResultService.createDefault()
    default:
      return null
  }
}

/** Creates all Card fields for a new Card BDC, regardless of its selected layout. */
function cardForBdc(type: BdcType, resources: LearningCommandResourceServices): CardContent | null {
  switch (type) {
    case BDC_TYPE.CARD:
      return resources.cardService.createDefault(CAROUSEL_CONFIG.defaultImagePosition)
    default:
      return null
  }
}

/** Creates the default statistical graph data for its BDC type. */
function statisticalGraphForBdc(type: BdcType, resources: LearningCommandResourceServices): StatisticalGraphContent | null {
  return type === BDC_TYPE.STATISTICAL_GRAPH ? resources.statisticalGraphService.createDefaultStatisticalGraphContent() : null
}

/** Deletes a BDC and its owned children while preserving separate media resources. */
export function deleteBdc(document: LearningDocument, bdcId: BdcId): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
  let documentWithoutChildren = document
  if (bdc.type === BDC_TYPE.CAROUSEL && bdc.carousel != null) {
    for (const entry of bdc.carousel.cards) documentWithoutChildren = deleteBdc(documentWithoutChildren, entry.bdcId)
  }
  if (bdc.type === BDC_TYPE.SECTION) {
    for (const child of document.bdcs.filter((candidate) => candidate.parentBdcId === bdc.id)) {
      documentWithoutChildren = deleteBdc(documentWithoutChildren, child.id)
    }
  }
  return new LearningDocument({
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
export function deleteCatalogBdc(document: LearningDocument, bdcId: BdcId): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
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
export function createBdc(
  document: LearningDocument,
  command: Extract<LearningDocumentCommand, { type: 'bdc.create' }>,
  resources: LearningCommandResourceServices,
): LearningDocument {
  if (document.bdcs.some((bdc) => bdc.id === command.bdcId)) fail(`Bdc déjà présent : ${command.bdcId}`)
  if ('initialCardOptions' in command && command.initialCardOptions !== undefined && command.bdcType !== BDC_TYPE.CARD) {
    fail('Les options initiales ne concernent que la création d’un BDC Carte.')
  }
  if (command.placement.kind === BDC_LOCATION.PAGE) {
    const page = findPage(document.pages, command.placement.pageId)
    if (page.type === PAGE_TYPE.DIAPO
      && command.bdcType !== BDC_TYPE.CAROUSEL
      && command.bdcType !== BDC_TYPE.QUESTION
      && command.bdcType !== BDC_TYPE.CARD
      && command.bdcType !== BDC_TYPE.EVALUATION_RESULT
      && command.bdcType !== BDC_TYPE.STATISTICAL_GRAPH) {
      fail('Une Diapo accepte un Carousel, un Quiz, une Carte, un Graphe ou un Résultat d’Évaluation.')
    }
  }
  switch (command.bdcType) {
    case BDC_TYPE.CAROUSEL:
      if (command.presetId !== DEFAULT_PRESET_ID.CAROUSEL || command.initialCardBdcId === undefined) {
        fail('Un BDC Carousel utilise son preset configuré et reçoit une première carte identifiée.')
      }
      switch (command.placement.kind) {
        case BDC_LOCATION.PAGE: {
          const page = findPage(document.pages, command.placement.pageId)
          switch (page.type) {
            case PAGE_TYPE.FLUX:
              break
            case PAGE_TYPE.DIAPO:
              if (page.bdcIds.some((bdcId) => findBdc(document.bdcs, bdcId).type === BDC_TYPE.CAROUSEL)) {
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
      if (!CARD_LAYOUT_IDS.includes(command.presetId as CardLayoutId)) {
        fail('Un BDC Carte utilise un layout configuré.')
      }
      break
    case BDC_TYPE.STATISTICAL_GRAPH:
      if (!STATISTICAL_GRAPH_LAYOUT_IDS.includes(command.presetId as StatisticalGraphLayoutId)) {
        fail('Un BDC Graphe utilise un layout configuré.')
      }
      break
    case BDC_TYPE.EVALUATION_RESULT:
      if (command.presetId !== DEFAULT_PRESET_ID.EVALUATION_RESULT) {
        fail('Un BDC Résultat utilise son preset configuré et ne reçoit pas de média direct.')
      }
      switch (command.placement.kind) {
        case BDC_LOCATION.PAGE: {
          const page = findPage(document.pages, command.placement.pageId)
          if (!LearningPageCommandService.pageBelongsToEvaluationChapter(document, page)) {
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
          const page = findPage(document.pages, command.placement.pageId)
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
  const statisticalGraph = statisticalGraphForBdc(command.bdcType, resources)
  const bdc: LearningBdc = {
    id: command.bdcId,
    type: command.bdcType,
    presetId: command.presetId,
    pageId: null,
    parentBdcId: null,
    section: sectionForBdc(command.bdcType, command.bdcId),
    question: questionForBdc(command.bdcType, resources),
    evaluationResult: evaluationResultForBdc(command.bdcType, resources),
    carousel: command.bdcType === BDC_TYPE.CAROUSEL && command.initialCardBdcId !== undefined
      ? { ...resources.carouselService.createDefault(command.initialCardBdcId), cards: [] }
      : null,
    card: !('initialCardOptions' in command) || command.initialCardOptions === undefined
      ? cardForBdc(command.bdcType, resources)
      : resources.cardService.createDefault(command.initialCardOptions.imagePosition, command.initialCardOptions.imageFit),
    ...(statisticalGraph === null ? {} : { statisticalGraph }),
  }
  const withParent = placeBdc(new LearningDocument({ ...document.data, bdcs: [...document.bdcs, bdc] }), bdc, command.placement)
  if (command.bdcType !== BDC_TYPE.CAROUSEL) return withParent
  const initialCardBdcId = command.initialCardBdcId
  const initialCard: LearningBdc = {
    id: initialCardBdcId,
    type: BDC_TYPE.CARD,
    presetId: CAROUSEL_CONFIG.initialCardLayoutId,
    pageId: null,
    parentBdcId: null,
    section: null,
    question: null,
    evaluationResult: null,
    carousel: null,
    card: resources.cardService.createDefault(),
  }
  if (withParent.bdcs.some((candidate) => candidate.id === initialCard.id)) fail(`Bdc déjà présent : ${initialCard.id}`)
  const withCard = new LearningDocument({ ...withParent.data, bdcs: [...withParent.bdcs, initialCard] })
  return placeBdc(withCard, initialCard, { kind: BDC_LOCATION.PARENT, parentBdcId: bdc.id })
}

/** Updates all authored statistical graph fields through the document command path. */
export function updateStatisticalGraph(
  document: LearningDocument,
  bdcId: BdcId,
  statisticalGraph: StatisticalGraphContent,
  resources: LearningCommandResourceServices,
): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
  if (bdc.type !== BDC_TYPE.STATISTICAL_GRAPH || bdc.statisticalGraph == null) {
    fail(`Le bdc ${bdcId} n’est pas un Graphe complet.`)
  }
  resources.statisticalGraphService.assertStatisticalGraphContent(statisticalGraph)
  return withBdc(document, { ...bdc, statisticalGraph })
}

/** Selects one configured Statistical Graph layout without changing its data. */
export function setStatisticalGraphLayout(
  document: LearningDocument,
  bdcId: BdcId,
  layoutId: StatisticalGraphLayoutId,
): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
  if (bdc.type !== BDC_TYPE.STATISTICAL_GRAPH || bdc.statisticalGraph == null) {
    fail(`Le bdc ${bdcId} n’est pas un Graphe complet.`)
  }
  if (!STATISTICAL_GRAPH_LAYOUT_IDS.includes(layoutId)) fail(`Layout de graphe inconnu : ${layoutId}`)
  return withBdc(document, { ...bdc, presetId: layoutId })
}

/** Permanently removes one Graph BDC, preserving the parent placement rules. */
export function deleteStatisticalGraph(document: LearningDocument, bdcId: BdcId): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
  if (bdc.type !== BDC_TYPE.STATISTICAL_GRAPH) fail(`Seul un BDC Graphe peut être supprimé par cette commande : ${bdcId}`)
  if (bdc.parentBdcId !== null) {
    const parent = findBdc(document.bdcs, bdc.parentBdcId)
    if (parent.type === BDC_TYPE.SECTION) fail('Un Graphe ancré doit être retiré par son ancre.')
    if (parent.type === BDC_TYPE.CAROUSEL && (parent.carousel?.cards.length ?? 0) <= 1) {
      fail('Un Carousel doit conserver au moins une vue.')
    }
    if (parent.type !== BDC_TYPE.CAROUSEL) fail(`Le parent du Graphe ${bdc.id} ne permet pas sa suppression.`)
  }
  return deleteBdc(document, bdc.id)
}

/** Updates Question text and response definitions through a single command. */
export function updateQuestion(
  document: LearningDocument,
  bdcId: BdcId,
  question: NonNullable<LearningBdc['question']>,
  resources: LearningCommandResourceServices,
): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.QUESTION:
      if (bdc.question === null) fail(`Bdc Question incomplet : ${bdcId}`)
      break
    default:
      fail(`Le bdc ${bdcId} n’est pas une Question.`)
  }
  resources.questionService.assertValid(question)
  return withBdc(document, { ...bdc, question })
}

/** Updates both outcome branches through the document command path. */
export function updateEvaluationResult(
  document: LearningDocument,
  bdcId: BdcId,
  evaluationResult: EvaluationResultContent,
  resources: LearningCommandResourceServices,
): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.EVALUATION_RESULT:
      if (bdc.evaluationResult === null || bdc.evaluationResult === undefined) {
        fail(`Bdc Résultat incomplet : ${bdcId}`)
      }
      break
    default:
      fail(`Le bdc ${bdcId} n’est pas un Résultat d’évaluation.`)
  }
  resources.evaluationResultService.assertValid(evaluationResult)
  return withBdc(document, { ...bdc, evaluationResult })
}

/** Updates Carousel settings and its existing Card order through one command. */
export function updateCarousel(
  document: LearningDocument,
  bdcId: BdcId,
  carousel: CarouselContent,
  resources: LearningCommandResourceServices,
): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.CAROUSEL:
      if (bdc.carousel === null || bdc.carousel === undefined) fail(`Bdc Carousel incomplet : ${bdcId}`)
      break
    default:
      fail(`Le bdc ${bdcId} n’est pas un Carousel.`)
  }
  resources.carouselService.assertValid(carousel)
  const currentIds = bdc.carousel.cards.map((entry) => entry.bdcId).sort()
  const nextIds = carousel.cards.map((entry) => entry.bdcId).sort()
  if (currentIds.length !== nextIds.length || currentIds.some((id, index) => id !== nextIds[index])) {
    fail('Une mise à jour Carousel ne peut ni ajouter ni retirer ses BDC enfants.')
  }
  return withBdc(document, { ...bdc, carousel })
}

/** Updates the complete content fields of one Card without changing its layout. */
export function updateCard(
  document: LearningDocument,
  bdcId: BdcId,
  card: CardContent,
  resources: LearningCommandResourceServices,
): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.CARD:
      if (bdc.card === null || bdc.card === undefined) fail(`Bdc Carte incomplet : ${bdcId}`)
      break
    default:
      fail(`Le bdc ${bdcId} n’est pas une Carte.`)
  }
  resources.cardService.assertValid(card)
  return withBdc(document, { ...bdc, card })
}

/** Selects one Card layout while preserving every authored Card field. */
export function setCardLayout(document: LearningDocument, bdcId: BdcId, layoutId: CardLayoutId): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
  if (bdc.type !== BDC_TYPE.CARD || bdc.card == null) fail(`Le bdc ${bdcId} n’est pas une Carte.`)
  if (!CARD_LAYOUT_IDS.includes(layoutId)) fail(`Layout de carte inconnu : ${layoutId}`)
  return withBdc(document, { ...bdc, presetId: layoutId })
}

/** Permanently removes one Card BDC, preserving media and nonempty Carousels. */
export function deleteCard(document: LearningDocument, bdcId: BdcId): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
  if (bdc.type !== BDC_TYPE.CARD) fail(`Seul un BDC Carte peut être retiré par cette commande : ${bdcId}`)
  if (bdc.parentBdcId === null) {
    const page = bdc.pageId === null ? undefined : findPage(document.pages, bdc.pageId)
    switch (page?.type) {
      case PAGE_TYPE.FLUX:
      case PAGE_TYPE.DIAPO:
      case undefined:
        return deleteBdc(document, bdc.id)
    }
  }
  const parent = findBdc(document.bdcs, bdc.parentBdcId)
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
export function deleteCarousel(document: LearningDocument, bdcId: BdcId): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.CAROUSEL:
      return deleteBdc(document, bdc.id)
    default:
      fail(`Seul un bdc Carousel peut être supprimé par cette commande : ${bdcId}`)
  }
}

/** Permanently removes one Question BDC and preserves its reusable illustration. */
export function deleteQuestion(document: LearningDocument, bdcId: BdcId): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.QUESTION:
      return deleteBdc(document, bdc.id)
    default:
      fail(`Seul un bdc Question peut être supprimé par cette commande : ${bdcId}`)
  }
}

/** Permanently removes one Result BDC from its page. */
export function deleteEvaluationResult(document: LearningDocument, bdcId: BdcId): LearningDocument {
  const bdc = findBdc(document.bdcs, bdcId)
  switch (bdc.type) {
    case BDC_TYPE.EVALUATION_RESULT:
      return deleteBdc(document, bdc.id)
    default:
      fail(`Seul un bdc Résultat peut être supprimé par cette commande : ${bdcId}`)
  }
}
