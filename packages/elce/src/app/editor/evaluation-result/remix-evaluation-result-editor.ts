import { Trash2 } from 'lucide-static'
import { EVALUATION_RESULT_BRANCH, EVALUATION_RESULT_CONFIG } from '../../../config/document-config'
import type { EvaluationResultAction, EvaluationResultBranch } from '../../../config/document-config-types'
import { ElceEvaluationResultService } from '../../../domain/evaluation/evaluation-result-service'
import type { EvaluationResultContent } from '../../../domain/evaluation/evaluation-result-types'
import { on, type RemixNode } from 'remix/ui'
import { jsx } from 'remix/ui/jsx-runtime'
import { renderLucideIcon } from '../../remix/lucide-static-icon'

const resultService = new ElceEvaluationResultService()

/** Renders and edits both outcomes of one Result BDC in Remix. */
export function renderRemixEvaluationResultEditor(
  bdcId: string,
  content: EvaluationResultContent,
  onChange: (content: EvaluationResultContent) => void,
  onDelete: () => void,
): RemixNode {
  return jsx('section', {
    id: `elce-evaluation-result-editor-${bdcId}`,
    className: 'elce-evaluation-result-editor',
    'aria-label': 'Résultat de l’évaluation',
    children: [
      jsx('div', {
        id: `elce-evaluation-result-heading-${bdcId}`,
        className: 'elce-evaluation-result-editor__heading',
        children: [
          jsx('span', { id: `elce-evaluation-result-title-${bdcId}`, children: 'Résultat' }),
          jsx('button', {
            id: `elce-evaluation-result-delete-${bdcId}`,
            className: 'elce-danger-action',
            type: 'button',
            'aria-label': 'Supprimer le bloc résultat',
            title: 'Supprimer le bloc résultat',
            mix: on<HTMLButtonElement, 'click'>('click', onDelete),
            children: renderLucideIcon(Trash2, `elce-evaluation-result-delete-icon-${bdcId}`, 14),
          }),
        ],
      }),
      ...Object.values(EVALUATION_RESULT_BRANCH).map((branch) => renderResultBranch(bdcId, branch, content, onChange)),
    ],
  })
}

/** Renders a result branch and keeps its action list constrained by the service. */
function renderResultBranch(
  bdcId: string,
  branch: EvaluationResultBranch,
  content: EvaluationResultContent,
  onChange: (content: EvaluationResultContent) => void,
): RemixNode {
  const branchConfig = EVALUATION_RESULT_CONFIG[branch]
  const selectedAction = content[branch].action ?? ''
  return jsx('fieldset', {
    id: `elce-evaluation-result-branch-${bdcId}-${branch}`,
    className: 'elce-evaluation-result-editor__branch',
    children: [
      jsx('legend', { id: `elce-evaluation-result-legend-${bdcId}-${branch}`, children: branchConfig.label }),
      jsx('textarea', {
        id: `elce-evaluation-result-message-${bdcId}-${branch}`,
        'aria-label': branchConfig.messagePlaceholder,
        placeholder: branchConfig.messagePlaceholder,
        rows: 2,
        value: content[branch].message,
        mix: on<HTMLTextAreaElement, 'input'>('input', (event) => updateMessage(content, branch, event.currentTarget.value, onChange)),
      }),
      jsx('select', {
        id: `elce-evaluation-result-action-${bdcId}-${branch}`,
        'aria-label': `${branchConfig.label} : ${branchConfig.actionLabel}`,
        mix: on<HTMLSelectElement, 'change'>('change', (event) => updateAction(content, branch, event.currentTarget.value, onChange)),
        children: [
          jsx('option', { value: '', selected: selectedAction === '', children: 'Aucune action' }, 'none'),
          ...resultService.actionsFor(branch).map((action) => jsx('option', {
            value: action.value,
            selected: action.value === selectedAction,
            children: action.label,
          }, action.value)),
        ],
      }),
    ],
  }, branch)
}

/** Sends one branch message edit through the established evaluation service. */
function updateMessage(
  content: EvaluationResultContent,
  branch: EvaluationResultBranch,
  message: string,
  onChange: (content: EvaluationResultContent) => void,
): void {
  onChange(resultService.updateBranch(content, branch, { ...content[branch], message }))
}

/** Sends one branch action choice through the established evaluation service. */
function updateAction(
  content: EvaluationResultContent,
  branch: EvaluationResultBranch,
  value: string,
  onChange: (content: EvaluationResultContent) => void,
): void {
  const action = value === '' ? null : value as EvaluationResultAction
  onChange(resultService.updateBranch(content, branch, { ...content[branch], action }))
}
