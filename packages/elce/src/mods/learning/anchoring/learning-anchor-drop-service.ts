import { EVALUATION_RESULT_BDC_TYPE } from '../evaluation/learning-evaluation-config'
import { ElceAnchorDropService } from '../../../resources/anchoring/domain/anchor-drop-service'

/** Creates the anchor service with the catalogue label owned by Learning. */
export function createLearningAnchorDropService(): ElceAnchorDropService {
  return new ElceAnchorDropService({
    resolveAdditionalCatalogBdcName: (bdc) => bdc.type === EVALUATION_RESULT_BDC_TYPE
      ? 'Résultat d’évaluation'
      : undefined,
  })
}
