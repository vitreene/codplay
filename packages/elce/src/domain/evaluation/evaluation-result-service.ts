import {
  EVALUATION_RESULT_ACTION,
  EVALUATION_RESULT_BRANCH,
  EVALUATION_RESULT_CONFIG,
} from '../../config/document-config'
import type { EvaluationResultAction, EvaluationResultBranch } from '../../config/document-config-types'
import type { EvaluationResultBranchContent, EvaluationResultContent } from './evaluation-result-types'

/** Owns the editable messages and button actions for both evaluation outcomes. */
export class ElceEvaluationResultService {
  /** Creates an empty result block that the author can configure. */
  public createDefault(): EvaluationResultContent {
    return {
      success: { message: '', action: null },
      failure: { message: '', action: null },
    }
  }

  /** Validates both result branches against their configured action choices. */
  public assertValid(content: EvaluationResultContent): void {
    for (const branch of Object.values(EVALUATION_RESULT_BRANCH)) {
      const value = content[branch]
      switch (typeof value.message) {
        case 'string':
          break
        default:
          throw new Error(`Le message de la branche ${branch} doit être du texte.`)
      }
      this.assertActionAllowed(branch, value.action)
    }
  }

  /** Replaces one outcome branch without changing the other. */
  public updateBranch(
    content: EvaluationResultContent,
    branch: EvaluationResultBranch,
    value: EvaluationResultBranchContent,
  ): EvaluationResultContent {
    const updated = { ...content, [branch]: value }
    this.assertValid(updated)
    return updated
  }

  /** Returns the author-facing option list for a result branch. */
  public actionsFor(branch: EvaluationResultBranch): readonly Readonly<{ value: EvaluationResultAction; label: string }>[] {
    return EVALUATION_RESULT_CONFIG[branch].actions
  }

  /** Rejects an action that does not match the configured outcome branch. */
  private assertActionAllowed(branch: EvaluationResultBranch, action: EvaluationResultAction | null): void {
    switch (action) {
      case null:
        return
      case EVALUATION_RESULT_ACTION.MENU:
        return
      case EVALUATION_RESULT_ACTION.REPLAY:
        switch (branch) {
          case EVALUATION_RESULT_BRANCH.SUCCESS:
            return
          case EVALUATION_RESULT_BRANCH.FAILURE:
            throw new Error('La relecture des réponses est réservée à la réussite de l’évaluation.')
        }
      case EVALUATION_RESULT_ACTION.RETRY:
        switch (branch) {
          case EVALUATION_RESULT_BRANCH.FAILURE:
            return
          case EVALUATION_RESULT_BRANCH.SUCCESS:
            throw new Error('La reprise est réservée à l’échec de l’évaluation.')
        }
      default:
        throw new Error(`Action inconnue pour la branche ${branch}.`)
    }
  }
}
