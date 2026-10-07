import { Trash2 } from 'lucide-react'
import { EVALUATION_RESULT_BRANCH, EVALUATION_RESULT_CONFIG } from '../../../config/document-config'
import type { EvaluationResultAction, EvaluationResultBranch } from '../../../config/document-config-types'
import { ElceEvaluationResultService } from '../../../domain/evaluation/evaluation-result-service'
import type { EvaluationResultContent } from '../../../domain/evaluation/evaluation-result-types'

type EvaluationResultEditorProps = Readonly<{
  readonly bdcId: string
  readonly content: EvaluationResultContent
  readonly onChange: (content: EvaluationResultContent) => void
  readonly onDelete: () => void
}>

const resultService = new ElceEvaluationResultService()

/** Edits both possible outcomes inside one Result BDC. */
export function EvaluationResultEditor({ bdcId, content, onChange, onDelete }: EvaluationResultEditorProps) {
  return (
    <section id={`elce-evaluation-result-editor-${bdcId}`} className="elce-evaluation-result-editor" aria-label="Résultat de l’évaluation">
      <div id={`elce-evaluation-result-heading-${bdcId}`} className="elce-evaluation-result-editor__heading">
        <span>Résultat</span>
        <button
          id={`elce-evaluation-result-delete-${bdcId}`}
          className="elce-danger-action"
          type="button"
          aria-label="Supprimer le bloc résultat"
          title="Supprimer le bloc résultat"
          onClick={onDelete}
        ><Trash2 aria-hidden="true" size={14} strokeWidth={2} /></button>
      </div>
      {Object.values(EVALUATION_RESULT_BRANCH).map((branch) => (
        <fieldset id={`elce-evaluation-result-branch-${bdcId}-${branch}`} key={branch} className="elce-evaluation-result-editor__branch">
          <legend>{EVALUATION_RESULT_CONFIG[branch].label}</legend>
          <textarea
            id={`elce-evaluation-result-message-${bdcId}-${branch}`}
            aria-label={EVALUATION_RESULT_CONFIG[branch].messagePlaceholder}
            placeholder={EVALUATION_RESULT_CONFIG[branch].messagePlaceholder}
            rows={2}
            value={content[branch].message}
            onChange={(event) => changeMessage(content, branch, event.currentTarget.value, onChange)}
          />
          <select
            id={`elce-evaluation-result-action-${bdcId}-${branch}`}
            aria-label={`${EVALUATION_RESULT_CONFIG[branch].label} : ${EVALUATION_RESULT_CONFIG[branch].actionLabel}`}
            value={content[branch].action ?? ''}
            onChange={(event) => changeAction(content, branch, event.currentTarget.value, onChange)}
          >
            <option value="">Aucune action</option>
            {resultService.actionsFor(branch).map((action) => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </select>
        </fieldset>
      ))}
    </section>
  )
}

/** Sends one message edit through the domain service and its XState command callback. */
function changeMessage(
  content: EvaluationResultContent,
  branch: EvaluationResultBranch,
  message: string,
  onChange: EvaluationResultEditorProps['onChange'],
): void {
  onChange(resultService.updateBranch(content, branch, { ...content[branch], message }))
}

/** Sends one action choice through the domain service and its XState command callback. */
function changeAction(
  content: EvaluationResultContent,
  branch: EvaluationResultBranch,
  value: string,
  onChange: EvaluationResultEditorProps['onChange'],
): void {
  const action = value === '' ? null : value as EvaluationResultAction
  onChange(resultService.updateBranch(content, branch, { ...content[branch], action }))
}
