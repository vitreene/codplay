import type { EvaluationResultAction } from '../learning-evaluation-config'

export interface EvaluationResultBranchContent {
  readonly message: string
  readonly action: EvaluationResultAction | null
}

export interface EvaluationResultContent {
  readonly success: EvaluationResultBranchContent
  readonly failure: EvaluationResultBranchContent
}
