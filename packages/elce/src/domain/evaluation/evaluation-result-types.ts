import type { EvaluationResultAction } from '../../config/document-config-types'
import type { ElceTextValue } from '../document/document-types'

export interface EvaluationResultBranchContent {
  readonly message: ElceTextValue
  readonly action: EvaluationResultAction | null
}

export interface EvaluationResultContent {
  readonly success: EvaluationResultBranchContent
  readonly failure: EvaluationResultBranchContent
}
