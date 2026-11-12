import type { EvaluationResultAction } from '../learning-evaluation-config'
import type { ElceTextValue } from '../../../../resources/document/rich-text-types'

export interface EvaluationResultBranchContent {
  readonly message: ElceTextValue
  readonly action: EvaluationResultAction | null
}

export interface EvaluationResultContent {
  readonly success: EvaluationResultBranchContent
  readonly failure: EvaluationResultBranchContent
}
