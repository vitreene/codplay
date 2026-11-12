import { DIAPO_PAGE_TYPE } from '../../../../resources/pages/diapo/diapo-config'
import type { BuildAdditionalBdc } from '../../../../resources/pages/additional-bdc-types'
import type { AppearanceClassNamesByTarget } from '../../../../builders/scene-style/appearance-class-names'
import { buildEvaluationResultBdcScene } from './evaluation-result-bdc-scene-builder'
import { EVALUATION_RESULT_BDC_TYPE } from '../learning-evaluation-config'
import { CHAPTER_TYPE } from '../../organization/learning-organization-config'
import type { LearningDocument } from '../../document/learning-document'
import type { ElceCardPresetBuilder } from '../../../../core/presets/card-preset-builder'
import type { ResourceInlineTextSceneFeature } from '../../../../resources/document/resource-inline-text-feature'
import { SUMMARY_BDC_TYPE } from '../../../../resources/bdcs/summary/summary-config'
import { buildSummaryBdcScene } from '../../organization/reading/learning-summary-scene-builder'
import { appearanceClassNameForBdc } from '../../../../builders/scene-style/appearance-class-names'

/** Builds the Learning Result contribution for shared page-format builders. */
export function createLearningAdditionalBdcBuilder(
  document: LearningDocument,
  presetBuilder: ElceCardPresetBuilder,
  appearanceClassNamesByTarget?: AppearanceClassNamesByTarget,
  inlineTextSceneFeature?: ResourceInlineTextSceneFeature,
): BuildAdditionalBdc {
  return (contentPage, resourceBdc) => {
    const page = document.pages.find((candidate) => candidate.id === contentPage.id)
    const bdc = document.bdcs.find((candidate) => candidate.id === resourceBdc.id)
    if (resourceBdc.type === SUMMARY_BDC_TYPE) {
      if (page === undefined || bdc?.type !== SUMMARY_BDC_TYPE) {
        throw new Error(`Le BDC Sommaire ${resourceBdc.id} est incomplet dans le document Learning.`)
      }
      return buildSummaryBdcScene(
        document,
        page,
        bdc.id,
        appearanceClassNameForBdc(bdc.id, appearanceClassNamesByTarget),
      )
    }
    if (resourceBdc.type !== EVALUATION_RESULT_BDC_TYPE) return null
    if (page === undefined || bdc?.evaluationResult == null) {
      throw new Error(`Le BDC Résultat ${resourceBdc.id} est incomplet dans le document Learning.`)
    }
    if (page.type === DIAPO_PAGE_TYPE) {
      const chapter = page.chapterId === null ? undefined : document.chapters.find((candidate) => candidate.id === page.chapterId)
      if (chapter?.type !== CHAPTER_TYPE.EVALUATION) {
        throw new Error(`Le BDC Résultat ${bdc.id} ne peut être projeté que dans une Diapo d’Évaluation.`)
      }
    }
    return buildEvaluationResultBdcScene(
      page,
      bdc,
      presetBuilder,
      appearanceClassNamesByTarget?.[`bdc:${bdc.id}`],
      inlineTextSceneFeature,
    )
  }
}
