import {
  EVALUATION_RESULT_BRANCH,
  EVALUATION_RESULT_CONFIG,
} from '../evaluation/learning-evaluation-config'
import type {
  EvaluationResultAction,
  EvaluationResultBranch,
} from '../evaluation/learning-evaluation-config'
import { ElceEvaluationResultService } from '../evaluation/domain/learning-evaluation-result-service'
import type { EvaluationResultContent } from '../evaluation/domain/learning-evaluation-result-types'
import type { AppearanceTarget } from '../../../domain/appearance/appearance-target-types'
import { on, type RemixNode } from 'remix/component'

import { renderAppearanceTrigger } from '../../../core/authoring/appearance-trigger'
import type { ElceTextValue } from '../../../resources/document/rich-text-types'
import type { ResourceTextFieldFeature } from '../../../core/authoring/resource-text-field-feature'

const resultService = new ElceEvaluationResultService()

/** Renders and edits both outcomes of one Result BDC in Remix. */
export function renderRemixEvaluationResultEditor(
  bdcId: string,
  content: EvaluationResultContent,
  onChange: (content: EvaluationResultContent) => void,
  onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void,
  textFieldFeature: ResourceTextFieldFeature,
): RemixNode {
  return <section
    id={`elce-evaluation-result-editor-${bdcId}`}
    className="elce-evaluation-result-editor"
    aria-label="Résultat de l’évaluation"
  >
    {[
      <div
        id={`elce-evaluation-result-heading-${bdcId}`}
        className="elce-evaluation-result-editor__heading"
      >
        <span
          id={`elce-evaluation-result-title-${bdcId}`}
        >
          Résultat
        </span>
        <div
          id={`elce-evaluation-result-header-actions-${bdcId}`}
          className="elce-bdc-header-actions"
        >
          {renderAppearanceTrigger({
            id: `elce-evaluation-result-style-${bdcId}`,
            target: { kind: 'bdc', bdcId },
            label: 'Ouvrir le style du résultat',
            onOpen: onOpenAppearanceTarget,
          })}
        </div>
      </div>,
      ...Object.values(EVALUATION_RESULT_BRANCH).map((branch) => renderResultBranch(bdcId, branch, content, onChange, textFieldFeature)),
    ]}
  </section>
}

/** Renders a result branch and keeps its action list constrained by the service. */
function renderResultBranch(
  bdcId: string,
  branch: EvaluationResultBranch,
  content: EvaluationResultContent,
  onChange: (content: EvaluationResultContent) => void,
  textFieldFeature: ResourceTextFieldFeature,
): RemixNode {
  const branchConfig = EVALUATION_RESULT_CONFIG[branch]
  const selectedAction = content[branch].action ?? ''
  return <fieldset
    key={branch}
    id={`elce-evaluation-result-branch-${bdcId}-${branch}`}
    className="elce-evaluation-result-editor__branch"
  >
    <legend
      id={`elce-evaluation-result-legend-${bdcId}-${branch}`}
    >
      {branchConfig.label}
    </legend>
    {textFieldFeature.render({
      id: `elce-evaluation-result-message-${bdcId}-${branch}`,
      ariaLabel: branchConfig.messagePlaceholder,
      placeholder: branchConfig.messagePlaceholder,
      multiline: true,
      value: content[branch].message,
      onChange: (message) => updateMessage(content, branch, message, onChange),
    })}
    <select
      id={`elce-evaluation-result-action-${bdcId}-${branch}`}
      aria-label={`${branchConfig.label} : ${branchConfig.actionLabel}`}
      mix={on<HTMLSelectElement, 'change'>('change', (event) => updateAction(content, branch, event.currentTarget.value, onChange))}
    >
      {[
        <option
          id={`elce-evaluation-result-action-option-none-${bdcId}-${branch}`}
          key="none"
          value=""
          selected={selectedAction === ''}
        >
          Aucune action
        </option>,
        ...resultService.actionsFor(branch).map((action) => <option
          id={`elce-evaluation-result-action-option-${bdcId}-${branch}-${action.value}`}
          key={action.value}
          value={action.value}
          selected={action.value === selectedAction}
        >
          {action.label}
        </option>),
      ]}
    </select>
  </fieldset>
}

/** Sends one branch message edit through the established evaluation service. */
function updateMessage(
  content: EvaluationResultContent,
  branch: EvaluationResultBranch,
  message: ElceTextValue,
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
