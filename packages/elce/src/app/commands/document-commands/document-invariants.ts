import { BDC_TYPE, CARD_LAYOUT_IDS, DEFAULT_PRESET_ID, PAGE_TYPE, SCENARIO_ENTRY_KIND } from '../../../config/document-config'
import type { CardLayoutId } from '../../../config/document-config-types'
import { ElceDocument } from '../../../domain/document/document-model'
import type { BdcId, PageId } from '../../../domain/document/document-types'
import { fail, pageBelongsToEvaluationChapter, requireSectionData } from './command-helpers'
import { assertQuestionMediaAllowed, assertCardMediaAllowed } from './media-commands'
import { anchorReferenceService, questionService, evaluationResultService, carouselService, cardService } from './services'

/** Checks placement and anchor-reference invariants for a document value. */
export function assertDocumentInvariants(document: ElceDocument): void {
  const pageIds = new Set<PageId>()
  const bdcIds = new Set<BdcId>()
  const bdcById = new Map(document.bdcs.map((bdc) => [bdc.id, bdc]))
  for (const page of document.pages) {
    if (pageIds.has(page.id)) fail(`Page dupliquée : ${page.id}`)
    pageIds.add(page.id)
    for (const bdcId of page.bdcIds) {
      const bdc = bdcById.get(bdcId)
      if (bdc === undefined) fail(`Bdc inconnu dans la page ${page.id} : ${bdcId}`)
      if (bdcIds.has(bdcId)) fail(`Bdc placé deux fois dans la page ${page.id}`)
      bdcIds.add(bdcId)
      if (bdc.pageId !== page.id || bdc.parentBdcId !== null) fail(`Affectation de bdc incohérente : ${bdcId}`)
    }
  }
  for (const parent of document.bdcs) {
    if (parent.type !== BDC_TYPE.CAROUSEL || parent.carousel == null) continue
    for (const entry of parent.carousel.cards) {
      const child = bdcById.get(entry.bdcId)
      if (child === undefined) fail(`Bdc Carte inconnue dans le Carousel ${parent.id} : ${entry.bdcId}`)
      if (bdcIds.has(child.id)) fail(`Bdc placé deux fois : ${child.id}`)
      bdcIds.add(child.id)
      if (child.type !== BDC_TYPE.CARD || child.parentBdcId !== parent.id || child.pageId !== null) {
        fail(`Affectation de carte incohérente : ${child.id}`)
      }
    }
  }
  for (const section of document.bdcs) {
    if (section.type !== BDC_TYPE.SECTION || section.section == null) continue
    const anchorBdcIds = anchorReferenceService.bdcIdsIn(section.section.content)
    if (new Set(anchorBdcIds).size !== anchorBdcIds.length) fail(`Une ancre est dupliquée dans la Section ${section.id}.`)
    for (const anchorBdcId of anchorBdcIds) {
      const child = bdcById.get(anchorBdcId)
      if (child === undefined) fail(`Ancre sans BDC Carte associé : ${anchorBdcId}`)
      if (bdcIds.has(child.id)) fail(`BDC placé deux fois : ${child.id}`)
      bdcIds.add(child.id)
      if (child.type !== BDC_TYPE.CARD || child.parentBdcId !== section.id || child.pageId !== null) {
        fail(`Affectation de Carte inline incohérente : ${child.id}`)
      }
    }
  }
  for (const bdcId of document.data.catalogBdcIds) {
    const bdc = bdcById.get(bdcId)
    if (bdc === undefined) fail(`Bdc inconnu dans le catalogue : ${bdcId}`)
    if (bdcIds.has(bdcId)) fail(`Bdc placé deux fois : ${bdcId}`)
    bdcIds.add(bdcId)
    if (bdc.pageId !== null || bdc.parentBdcId !== null) fail(`Affectation de catalogue incohérente : ${bdcId}`)
  }
  if (bdcIds.size !== document.bdcs.length) fail('Chaque bdc doit avoir un emplacement unique')
  const scenarioEntryChapterIds = document.data.scenarioEntries.flatMap((entry) => {
    switch (entry.kind) {
      case SCENARIO_ENTRY_KIND.PAGE: {
        const page = document.pages.find((candidate) => candidate.id === entry.pageId)
        switch (page) {
          case undefined:
            fail(`Page racine inconnue : ${entry.pageId}`)
          default:
            switch (page.chapterId) {
              case null:
                break
              default:
                fail(`Une page racine ne peut pas appartenir au chapitre ${page.chapterId} : ${page.id}`)
            }
        }
        return []
      }
      case SCENARIO_ENTRY_KIND.CHAPTER:
        return [entry.chapterId]
    }
  })
  const uniqueScenarioChapterIds = new Set(scenarioEntryChapterIds)
  if (scenarioEntryChapterIds.length !== document.chapters.length
    || uniqueScenarioChapterIds.size !== scenarioEntryChapterIds.length) {
    fail('Chaque chapitre doit avoir une entrée racine unique')
  }
  for (const chapterId of scenarioEntryChapterIds) {
    switch (document.chapters.find((chapter) => chapter.id === chapterId)) {
      case undefined:
        fail(`Entrée de chapitre inconnue : ${chapterId}`)
      default:
        break
    }
  }
  const scenarioPageIds = document.scenarioPageIds
  const placedPageIds = new Set([...scenarioPageIds, ...document.data.catalogPageIds])
  if (placedPageIds.size !== scenarioPageIds.length + document.data.catalogPageIds.length
    || placedPageIds.size !== document.pages.length) {
    fail('Chaque page doit avoir un emplacement unique')
  }
  for (const pageId of scenarioPageIds) {
    if (!pageIds.has(pageId)) fail(`Page de scénario inconnue : ${pageId}`)
  }
  for (const chapter of document.chapters) {
    for (const pageId of chapter.pageIds) {
      if (document.pages.find((page) => page.id === pageId)?.chapterId !== chapter.id) fail(`Affectation de chapitre incohérente : ${pageId}`)
    }
  }
  for (const page of document.pages) {
    if (page.chapterId === null && document.chapters.some((chapter) => chapter.pageIds.includes(page.id))) fail(`Page affectée à un chapitre sans référence : ${page.id}`)
    if (page.chapterId !== null && !document.chapters.some((chapter) => chapter.id === page.chapterId && chapter.pageIds.includes(page.id))) fail(`Page hors chapitre incohérente : ${page.id}`)
  }

  for (const page of document.pages) {
    const questions = page.bdcIds.flatMap((bdcId) => {
      const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
      switch (bdc?.type) {
        case BDC_TYPE.QUESTION:
          return [bdc]
        default:
          return []
      }
    })
    if (questions.length > 1) fail(`Une page ne peut contenir qu’une Question : ${page.id}`)
    switch (page.type) {
      case PAGE_TYPE.FLUX:
        break
      case PAGE_TYPE.DIAPO: {
        if (page.bdcIds.length > 1) fail(`Une Diapo ne peut contenir qu’un seul BDC direct : ${page.id}`)
        const carouselCount = page.bdcIds.filter((bdcId) => bdcById.get(bdcId)?.type === BDC_TYPE.CAROUSEL).length
        const unsupportedBdc = page.bdcIds.find((bdcId) => {
          const type = bdcById.get(bdcId)?.type
          switch (type) {
            case BDC_TYPE.CAROUSEL:
            case BDC_TYPE.QUESTION:
            case BDC_TYPE.CARD:
              return false
            case BDC_TYPE.EVALUATION_RESULT:
              return !pageBelongsToEvaluationChapter(document, page)
            default:
              return true
          }
        })
        if (carouselCount > 1) fail(`Une page Diapo ne peut contenir qu’un BDC Carousel : ${page.id}`)
        if (unsupportedBdc !== undefined) fail(`Le BDC ${unsupportedBdc} n’est pas pris en charge dans une page Diapo.`)
        continue
      }
    }
    for (const bdc of questions) {
      if (bdc.question === null) fail(`Bdc Question incomplet : ${bdc.id}`)
      questionService.assertValid(bdc.question)
      if (bdc.question?.mediaId != null) assertQuestionMediaAllowed(document, bdc.question.mediaId)
    }
  }

  for (const bdc of document.bdcs) {
    switch (bdc.type) {
      case BDC_TYPE.QUESTION: {
        if (bdc.question === null || bdc.section !== null) fail(`Bdc Question incomplet : ${bdc.id}`)
        questionService.assertValid(bdc.question)
        if (bdc.pageId === null) fail(`Un bdc Question doit rester affecté à une page : ${bdc.id}`)
        if (bdc.question.mediaId !== null) assertQuestionMediaAllowed(document, bdc.question.mediaId)
        break
      }
      case BDC_TYPE.EVALUATION_RESULT: {
        if (bdc.presetId !== DEFAULT_PRESET_ID.EVALUATION_RESULT
          || bdc.evaluationResult == null
          || bdc.section !== null
          || bdc.question !== null
          || bdc.carousel != null
          || bdc.card != null) {
          fail(`Bdc Résultat incomplet : ${bdc.id}`)
        }
        const page = bdc.pageId === null ? undefined : document.pages.find((candidate) => candidate.id === bdc.pageId)
        if (page === undefined || !pageBelongsToEvaluationChapter(document, page)) {
          fail(`Le BDC Résultat ${bdc.id} doit appartenir à une page d’un chapitre Évaluation.`)
        }
        evaluationResultService.assertValid(bdc.evaluationResult)
        break
      }
      case BDC_TYPE.CAROUSEL: {
        if (bdc.carousel === null || bdc.carousel === undefined || bdc.section !== null || bdc.question !== null || bdc.card != null) {
          fail(`Bdc Carousel incomplet : ${bdc.id}`)
        }
        carouselService.assertValid(bdc.carousel)
        if (bdc.pageId === null || bdc.parentBdcId !== null) fail(`Un bdc Carousel doit rester affecté à une page : ${bdc.id}`)
        break
      }
      case BDC_TYPE.CARD: {
        if (bdc.card === null || bdc.card === undefined || bdc.section !== null || bdc.question !== null
          || bdc.evaluationResult != null
          || bdc.carousel != null || (bdc.pageId !== null && bdc.parentBdcId !== null)) {
          fail(`Bdc Carte incomplet : ${bdc.id}`)
        }
        if (bdc.parentBdcId !== null) {
          const parent = bdcById.get(bdc.parentBdcId)
          switch (parent?.type) {
            case BDC_TYPE.CAROUSEL:
            case BDC_TYPE.SECTION:
              break
            default:
              fail(`Le parent de la Carte ${bdc.id} doit être un Carousel ou une Section.`)
          }
        }
        if (bdc.pageId !== null && document.pages.find((page) => page.id === bdc.pageId) === undefined) {
          fail(`La page de la Carte ${bdc.id} est absente.`)
        }
        if (!CARD_LAYOUT_IDS.includes(bdc.presetId as CardLayoutId)) fail(`Layout de carte inconnu : ${bdc.presetId}`)
        cardService.assertValid(bdc.card)
        if (bdc.card.mediaId !== null) assertCardMediaAllowed(document, bdc.card.mediaId)
        break
      }
      default:
        if (bdc.card != null || bdc.parentBdcId !== null) fail(`Un bdc ${bdc.type} ne peut pas être un enfant de conteneur : ${bdc.id}`)
        if (bdc.question !== null) fail(`Un bdc ${bdc.type} ne peut pas porter de Question : ${bdc.id}`)
        if (bdc.carousel != null) fail(`Un bdc ${bdc.type} ne peut pas porter un Carousel : ${bdc.id}`)
    }
  }

  const referencedAnchorBdcIds = new Set<BdcId>()
  for (const sectionBdc of document.bdcs) {
    switch (sectionBdc.type) {
      case BDC_TYPE.SECTION: {
        const section = requireSectionData(sectionBdc)
        const anchorBdcIds = anchorReferenceService.bdcIdsIn(section.content)
        if (new Set(anchorBdcIds).size !== anchorBdcIds.length) fail(`Une ancre est dupliquée dans la Section ${sectionBdc.id}.`)
        for (const anchorBdcId of anchorBdcIds) {
          if (referencedAnchorBdcIds.has(anchorBdcId)) fail(`Le bdc ancré ${anchorBdcId} est référencé plusieurs fois.`)
          const anchorBdc = document.bdcs.find((bdc) => bdc.id === anchorBdcId)
          switch (anchorBdc) {
            case undefined:
              fail(`Ancre sans bdc associé : ${anchorBdcId}`)
            default:
              switch (anchorBdc.type) {
                case BDC_TYPE.CARD:
                  switch (sectionBdc.pageId) {
                    case null:
                      fail(`Une Section hors page ne peut pas porter l’ancre ${anchorBdcId}.`)
                    default:
                      break
                  }
                  switch (anchorBdc.parentBdcId) {
                    case sectionBdc.id:
                      break
                    default:
                      fail(`La Carte ancrée ${anchorBdcId} doit rester enfant de sa Section.`)
                  }
                  if (anchorBdc.pageId !== null) fail(`La Carte ancrée ${anchorBdcId} ne peut pas être placée directement dans une page.`)
                  break
                default:
                  fail(`Seules les Cartes peuvent être ancrées : ${anchorBdcId}`)
              }
          }
          referencedAnchorBdcIds.add(anchorBdcId)
        }
        break
      }
      default:
        break
    }
  }
}
