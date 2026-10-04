import type { EvaluationResultAction } from '../../config/document-config-types'

export interface EvaluationResultBranchContent {
  readonly message: string
  readonly action: EvaluationResultAction | null
}

export interface EvaluationResultContent {
  readonly success: EvaluationResultBranchContent
  readonly failure: EvaluationResultBranchContent
}
