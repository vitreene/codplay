import { BDC_TYPE, DEFAULT_PRESET_ID, PAGE_TYPE } from '../../learning-definition'
import { CARD_LAYOUT_IDS } from '../../../../resources/bdcs/card/card-config'
import { SCENARIO_ENTRY_KIND } from '../../organization/learning-organization-config'
import { STATISTICAL_GRAPH_LAYOUT_IDS } from '../../../../resources/bdcs/statistical-graph/statistical-graph-config'
import type { CardLayoutId } from '../../../../resources/bdcs/card/card-config'
import type { StatisticalGraphLayoutId } from '../../../../resources/bdcs/statistical-graph/statistical-graph-config'
import { LearningDocument } from '../../document/learning-document'
import type { BdcId } from '../../../../core/document/content-document-types'
import { assertContentPlacementInvariants } from '../../../../core/document/content-placement-service'
import type { LearningCommandResourceServices } from '../learning-command-resource-services'
import { LearningPageCommandService } from '../learning-page-command-service'
import { fail, requireSectionData } from './command-helpers'
import { assertQuestionMediaAllowed, assertCardMediaAllowed } from './media-commands'
import { learningProfileService } from '../../profile/domain/learning-profile-service'
import {
  APPEARANCE_COLOR_ROLES,
  getAppearanceBackgroundGradient,
  APPEARANCE_DENSITIES,
  getAppearanceFont,
  getAppearancePalette,
  getAppearancePreset,
} from '../../../../config/appearance/appearance-config'
import type { AppearanceColorRole } from '../../../../config/appearance/appearance-types'

/** Checks placement and anchor-reference invariants for a document value. */
export function assertDocumentInvariants(document: LearningDocument, resources: LearningCommandResourceServices): void {
  assertAppearanceSettings(document.data.appearance, true, false)
  for (const page of document.pages) assertAppearanceSettings(page.appearance, false, false)
  for (const bdc of document.bdcs) {
    assertAppearanceSettings(bdc.appearance, false, bdc.type === BDC_TYPE.CARD)
  }

  const bdcIds = assertContentPlacementInvariants({
    pages: document.pages,
    bdcs: document.bdcs,
    catalogPageIds: document.data.catalogPageIds,
    catalogBdcIds: document.data.catalogBdcIds,
    scenarioPageIds: document.scenarioPageIds,
  })
  const bdcById = new Map(document.bdcs.map((bdc) => [bdc.id, bdc]))
  for (const parent of document.bdcs) {
    if (parent.type !== BDC_TYPE.CAROUSEL || parent.carousel == null) continue
    for (const entry of parent.carousel.cards) {
      const child = bdcById.get(entry.bdcId)
      if (child === undefined) fail(`Bdc Carte inconnue dans le Carousel ${parent.id} : ${entry.bdcId}`)
      if (bdcIds.has(child.id)) fail(`Bdc placé deux fois : ${child.id}`)
      bdcIds.add(child.id)
      if ((child.type !== BDC_TYPE.CARD && child.type !== BDC_TYPE.STATISTICAL_GRAPH)
        || child.parentBdcId !== parent.id || child.pageId !== null) {
        fail(`Affectation de vue Carousel incohérente : ${child.id}`)
      }
    }
  }
  for (const section of document.bdcs) {
    if (section.type !== BDC_TYPE.SECTION || section.section == null) continue
    const anchorBdcIds = resources.anchorReferenceService.bdcIdsIn(section.section.content)
    if (new Set(anchorBdcIds).size !== anchorBdcIds.length) fail(`Une ancre est dupliquée dans la Section ${section.id}.`)
    for (const anchorBdcId of anchorBdcIds) {
      const child = bdcById.get(anchorBdcId)
      if (child === undefined) fail(`Ancre sans BDC Carte associé : ${anchorBdcId}`)
      if (bdcIds.has(child.id)) fail(`BDC placé deux fois : ${child.id}`)
      bdcIds.add(child.id)
      if ((child.type !== BDC_TYPE.CARD && child.type !== BDC_TYPE.STATISTICAL_GRAPH)
        || child.parentBdcId !== section.id || child.pageId !== null) {
        fail(`Affectation de BDC illustratif inline incohérente : ${child.id}`)
      }
    }
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
            case BDC_TYPE.STATISTICAL_GRAPH:
              return false
            case BDC_TYPE.EVALUATION_RESULT:
              return !LearningPageCommandService.pageBelongsToEvaluationChapter(document, page)
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
      resources.questionService.assertValid(bdc.question)
      if (bdc.question?.mediaId != null) assertQuestionMediaAllowed(document, bdc.question.mediaId)
    }
  }

  for (const bdc of document.bdcs) {
    switch (bdc.type) {
      case BDC_TYPE.QUESTION: {
        if (bdc.question === null || bdc.section !== null || bdc.parentBdcId !== null || bdc.statisticalGraph != null) fail(`Bdc Question incomplet : ${bdc.id}`)
        resources.questionService.assertValid(bdc.question)
        if (bdc.question.mediaId !== null) assertQuestionMediaAllowed(document, bdc.question.mediaId)
        break
      }
      case BDC_TYPE.EVALUATION_RESULT: {
        if (bdc.presetId !== DEFAULT_PRESET_ID.EVALUATION_RESULT
          || bdc.evaluationResult == null
          || bdc.section !== null
          || bdc.question !== null
          || bdc.carousel != null
          || bdc.card != null
          || bdc.statisticalGraph != null) {
          fail(`Bdc Résultat incomplet : ${bdc.id}`)
        }
        if (bdc.parentBdcId !== null) fail(`Le BDC Résultat ${bdc.id} ne peut pas être enfant d’un autre BDC.`)
        if (bdc.pageId !== null) {
          const page = document.pages.find((candidate) => candidate.id === bdc.pageId)
          if (page === undefined || !LearningPageCommandService.pageBelongsToEvaluationChapter(document, page)) {
            fail(`Le BDC Résultat ${bdc.id} doit appartenir à une page d’un chapitre Évaluation.`)
          }
        }
        resources.evaluationResultService.assertValid(bdc.evaluationResult)
        break
      }
      case BDC_TYPE.CAROUSEL: {
        if (bdc.carousel === null || bdc.carousel === undefined || bdc.section !== null || bdc.question !== null || bdc.card != null || bdc.statisticalGraph != null) {
          fail(`Bdc Carousel incomplet : ${bdc.id}`)
        }
        resources.carouselService.assertValid(bdc.carousel)
        if (bdc.parentBdcId !== null) fail(`Un bdc Carousel ne peut pas être enfant d’un autre BDC : ${bdc.id}`)
        break
      }
      case BDC_TYPE.CARD: {
        if (bdc.card === null || bdc.card === undefined || bdc.section !== null || bdc.question !== null
          || bdc.evaluationResult != null
          || bdc.carousel != null || bdc.statisticalGraph != null || (bdc.pageId !== null && bdc.parentBdcId !== null)) {
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
        resources.cardService.assertValid(bdc.card)
        if (bdc.card.mediaId !== null) assertCardMediaAllowed(document, bdc.card.mediaId)
        break
      }
      case BDC_TYPE.STATISTICAL_GRAPH: {
        if (bdc.statisticalGraph == null || bdc.section !== null || bdc.question !== null
          || bdc.evaluationResult != null || bdc.carousel != null || bdc.card != null) {
          fail(`Bdc Graphe incomplet : ${bdc.id}`)
        }
        if (!STATISTICAL_GRAPH_LAYOUT_IDS.includes(bdc.presetId as StatisticalGraphLayoutId)) {
          fail(`Layout de graphe inconnu : ${bdc.presetId}`)
        }
        if (bdc.parentBdcId !== null) {
          const parent = bdcById.get(bdc.parentBdcId)
          switch (parent?.type) {
            case BDC_TYPE.CAROUSEL:
            case BDC_TYPE.SECTION:
              break
            default:
              fail(`Le parent du Graphe ${bdc.id} doit être un Carousel ou une Section.`)
          }
        }
        if (bdc.pageId !== null && document.pages.find((page) => page.id === bdc.pageId) === undefined) {
          fail(`La page du Graphe ${bdc.id} est absente.`)
        }
        resources.statisticalGraphService.assertStatisticalGraphContent(bdc.statisticalGraph)
        break
      }
      default:
        if (bdc.card != null || bdc.parentBdcId !== null) fail(`Un bdc ${bdc.type} ne peut pas être un enfant de conteneur : ${bdc.id}`)
        if (bdc.question !== null) fail(`Un bdc ${bdc.type} ne peut pas porter de Question : ${bdc.id}`)
        if (bdc.carousel != null) fail(`Un bdc ${bdc.type} ne peut pas porter un Carousel : ${bdc.id}`)
        if (bdc.statisticalGraph != null) fail(`Un bdc ${bdc.type} ne peut pas porter un Graphe : ${bdc.id}`)
    }
  }

  const referencedAnchorBdcIds = new Set<BdcId>()
  for (const sectionBdc of document.bdcs) {
    switch (sectionBdc.type) {
      case BDC_TYPE.SECTION: {
        const section = requireSectionData(sectionBdc)
        const anchorBdcIds = resources.anchorReferenceService.bdcIdsIn(section.content)
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
                case BDC_TYPE.STATISTICAL_GRAPH:
                  switch (anchorBdc.parentBdcId) {
                    case sectionBdc.id:
                      break
                    default:
                      fail(`Le BDC illustratif ancré ${anchorBdcId} doit rester enfant de sa Section.`)
                  }
                  if (anchorBdc.pageId !== null) fail(`Le BDC illustratif ancré ${anchorBdcId} ne peut pas être placé directement dans une page.`)
                  break
                default:
                  fail(`Seules les Cartes et les Graphes statistiques peuvent être ancrés : ${anchorBdcId}`)
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
  learningProfileService.assertSummaryProfileInvariants(document)
}

/** Rejects unknown appearance references and malformed sparse settings at any document scope. */
function assertAppearanceSettings(
  value: unknown,
  allowGeneralPreset: boolean,
  allowGradientBackground: boolean,
): void {
  if (value === undefined) return
  if (!isAppearanceRecord(value)) fail('Réglages d’apparence invalides.')

  const allowedProperties = new Set([
    'presetId', 'paletteId', 'headingFontId', 'bodyFontId', 'density', 'background', 'textColor', 'autoContrast', 'frame',
  ])
  if (Object.keys(value).some((property) => !allowedProperties.has(property))) {
    fail('Réglages d’apparence : propriété inconnue.')
  }

  if ('presetId' in value && !allowGeneralPreset) {
    fail('Le preset général d’apparence est réservé au projet.')
  }
  if ('presetId' in value) assertAppearanceReference(value.presetId, getAppearancePreset, 'preset')
  if ('paletteId' in value) assertAppearanceReference(value.paletteId, getAppearancePalette, 'palette')
  if ('headingFontId' in value) assertAppearanceReference(value.headingFontId, getAppearanceFont, 'police de titre')
  if ('bodyFontId' in value) assertAppearanceReference(value.bodyFontId, getAppearanceFont, 'police de corps')
  if ('density' in value && !APPEARANCE_DENSITIES.some((entry) => entry.value === value.density)) {
    fail('Densité d’apparence inconnue.')
  }
  if ('background' in value) {
    if (!isAppearanceRecord(value.background)) fail('Fond d’apparence invalide.')
    if (value.background.kind === 'gradient') {
      if (!allowGradientBackground) fail('Les fonds dégradés sont réservés aux Cartes.')
      if (typeof value.background.id !== 'string') fail('Dégradé de fond invalide.')
      assertAppearanceReference(value.background.id, getAppearanceBackgroundGradient, 'dégradé')
    } else {
      assertAppearanceColor(value.background)
    }
  }
  if ('textColor' in value) assertAppearanceColor(value.textColor)
  if ('autoContrast' in value && typeof value.autoContrast !== 'boolean') {
    fail('Le contraste automatique doit être un booléen.')
  }
  if ('frame' in value && typeof value.frame !== 'boolean') {
    fail('Le cadre doit être un booléen.')
  }
}

/** Verifies that a local palette or custom color choice is a valid value. */
function assertAppearanceColor(value: unknown): void {
  if (!isAppearanceRecord(value)) fail('Couleur d’apparence invalide.')
  switch (value.kind) {
    case 'palette':
      if (typeof value.role !== 'string'
        || !APPEARANCE_COLOR_ROLES.includes(value.role as AppearanceColorRole)) {
        fail('Rôle de couleur de palette inconnu.')
      }
      return
    case 'custom':
      if (typeof value.value !== 'string' || !/^#[\da-f]{6}$/i.test(value.value)) {
        fail('Une couleur personnalisée doit être un hexadécimal #RRGGBB.')
      }
      return
    default:
      fail('Source de couleur d’apparence inconnue.')
  }
}

/** Resolves one stable catalog reference and translates missing entries into a document invariant. */
function assertAppearanceReference<T>(
  value: unknown,
  lookup: (id: string) => T,
  label: string,
): void {
  if (typeof value !== 'string') fail(`Référence de ${label} invalide.`)
  try {
    lookup(value)
  } catch {
    fail(`Référence de ${label} inconnue : ${value}`)
  }
}

/** Narrows JSON values to an object record for appearance validation. */
function isAppearanceRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
