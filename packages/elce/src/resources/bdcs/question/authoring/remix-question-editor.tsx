import { Check, GripVertical, Plus, Trash2 } from 'lucide-static'
import {
  QUESTION_DEFAULTS,
  QUESTION_TYPE_CONFIG,
  QUESTION_TYPE_OPTIONS,
} from '../question-config'
import { MEDIA_FILE_ACCEPT } from '../../../../core/media/media-config'
import type { QuestionAnswer, QuestionType } from '../domain/question-types'
import { on, type RemixNode } from 'remix/ui'

import type { QuestionEditorProps } from './question-editor-types'
import { renderRemixMediaPicker } from '../../../../core/authoring/media/remix-media-picker'
import { renderLucideIcon } from '../../../../core/authoring/lucide-static-icon'
import { renderAppearanceTrigger } from '../../../../core/authoring/appearance-trigger'

const ANSWER_DRAG_MIME_TYPE = 'application/x-elce-question-answer+json'

/** Renders one Question BDC in Remix and routes edits through its existing facade. */
export function renderRemixQuestionEditor(props: QuestionEditorProps): RemixNode {
  const { bdcId, question, actions } = props
  const typeConfig = QUESTION_TYPE_CONFIG[question.type]

  return <article
    id={`elce-question-editor-${bdcId}`}
    className="elce-question-editor"
  >
    <div
      id={`elce-question-editor-heading-${bdcId}`}
      className="elce-question-editor__heading"
    >
      <select
        id={`elce-question-type-${bdcId}`}
        aria-label="Type de question"
        mix={on<HTMLSelectElement, 'change'>('change', (event) => actions.setType(event.currentTarget.value as QuestionType))}
      >
        {QUESTION_TYPE_OPTIONS.map((option) => <option
          id={`elce-question-type-option-${bdcId}-${option.value}`}
          key={option.value}
          value={option.value}
          selected={option.value === question.type}
        >
          {option.label}
        </option>)}
      </select>
      <div
        id={`elce-question-header-actions-${bdcId}`}
        className="elce-bdc-header-actions"
      >
        {renderAppearanceTrigger({
          id: `elce-question-style-${bdcId}`,
          target: { kind: 'bdc', bdcId },
          label: 'Ouvrir le style de la question',
          onOpen: props.onOpenAppearanceTarget,
          className: 'elce-appearance-trigger elce-bdc-style-trigger',
        })}
        <button
          id={`elce-question-delete-${bdcId}`}
          className="elce-bdc-icon-button elce-bdc-icon-button--danger"
          type="button"
          aria-label="Supprimer la question"
          title="Supprimer la question"
          mix={on<HTMLButtonElement, 'click'>('click', actions.deleteQuestion)}
        >
          {renderLucideIcon(Trash2, `elce-question-delete-icon-${bdcId}`)}
        </button>
      </div>
    </div>
    <div
      id={`elce-question-workspace-${bdcId}`}
      className="elce-question-workspace"
    >
      {renderQuestionMediaEditor(props)}
      <div
        id={`elce-question-content-${bdcId}`}
        className="elce-question-content"
      >
        <input
          id={`elce-question-title-${bdcId}`}
          className="elce-question-title"
          aria-label="Titre facultatif de la question"
          placeholder="Titre"
          value={question.title}
          {...props.textFieldAttributes}
          mix={on<HTMLInputElement, 'input'>('input', (event) => actions.setTitle(event.currentTarget.value))}
        />
        <textarea
          id={`elce-question-prompt-${bdcId}`}
          className="elce-question-prompt"
          aria-label="Question"
          placeholder="Écrire la question…"
          rows={2}
          value={question.prompt}
          {...props.textFieldAttributes}
          mix={on<HTMLTextAreaElement, 'input'>('input', (event) => actions.setPrompt(event.currentTarget.value))}
        />
        <input
          id={`elce-question-validation-label-${bdcId}`}
          className="elce-question-validation-label"
          type="text"
          aria-label="Texte du bouton de validation"
          placeholder="Texte du bouton de validation"
          value={question.validationLabel ?? QUESTION_DEFAULTS.VALIDATE_LABEL}
          {...props.textFieldAttributes}
          mix={on<HTMLInputElement, 'input'>('input', (event) => actions.setValidationLabel(event.currentTarget.value))}
        />
        {typeConfig.note.length > 0
          ? <p
            id={`elce-question-multiple-note-${bdcId}`}
            className="elce-question-multiple-note"
          >
            {typeConfig.note}
          </p>
          : null}
        <ol
          id={`elce-question-answers-${bdcId}`}
          className="elce-question-answers"
        >
          {question.answers.map((answer, index) => renderQuestionAnswer(answer, index, actions, props.textFieldAttributes))}
        </ol>
        {typeConfig.editableAnswers
          ? <button
            id={`elce-question-add-answer-${bdcId}`}
            className="elce-question-add-answer elce-add-content-action"
            type="button"
            aria-label="Ajouter une réponse"
            title="Ajouter une réponse"
            mix={on<HTMLButtonElement, 'click'>('click', actions.addAnswer)}
          >
            {renderLucideIcon(Plus, `elce-question-add-answer-icon-${bdcId}`)}
            <span
              id={`elce-question-add-answer-label-${bdcId}`}
              className="elce-add-content-action__label"
            >
              Réponse
            </span>
          </button>
          : null}
      </div>
    </div>
  </article>
}

/** Renders the optional Question media picker, preview and catalogue drop target. */
function renderQuestionMediaEditor(props: QuestionEditorProps): RemixNode {
  const { bdcId, media, mediaType, mediaSource, actions, onCatalogReference } = props
  return renderRemixMediaPicker({
    idPrefix: 'elce-question',
    idKey: bdcId,
    className: 'elce-question-illustration',
    accept: MEDIA_FILE_ACCEPT.IMAGE_AND_VIDEO,
    ariaLabel: 'Choisir une illustration',
    promptLabel: 'Illustration',
    emptyHint: 'Déposer ici',
    removeLabel: 'Retirer l’illustration',
    media,
    mediaType,
    mediaSource,
    onImport: actions.importMedia,
    onClear: actions.clearMedia,
    onCatalogReference,
  })
}

/** Renders one ordered answer with its correction and drag controls. */
function renderQuestionAnswer(
  answer: QuestionAnswer,
  index: number,
  actions: QuestionEditorProps['actions'],
  textFieldAttributes: QuestionEditorProps['textFieldAttributes'],
): RemixNode {
  const answerNumber = index + 1
  return <li
    key={answer.id}
    id={`elce-question-answer-row-${answer.id}`}
    className="elce-question-answer-row"
    mix={[
      on<HTMLLIElement, 'dragover'>('dragover', (event) => {
        const transfer = event.dataTransfer
        if (transfer !== null && Array.from(transfer.types).includes(ANSWER_DRAG_MIME_TYPE)) event.preventDefault()
      }),
      on<HTMLLIElement, 'drop'>('drop', (event) => {
        const transfer = event.dataTransfer
        if (transfer === null) return
        const sourceId = transfer.getData(ANSWER_DRAG_MIME_TYPE)
        if (sourceId.length === 0) return
        event.preventDefault()
        actions.moveAnswer(sourceId, index)
      }),
    ]}
  >
    <button
      id={`elce-question-answer-drag-${answer.id}`}
      className="elce-bdc-icon-button elce-question-answer-drag"
      type="button"
      draggable={true}
      aria-label={`Réordonner la réponse ${answerNumber}`}
      title="Glisser pour réordonner"
      mix={on<HTMLButtonElement, 'dragstart'>('dragstart', (event) => {
        const transfer = event.dataTransfer
        if (transfer === null) return
        transfer.effectAllowed = 'move'
        transfer.setData(ANSWER_DRAG_MIME_TYPE, answer.id)
      })}
    >
      {renderLucideIcon(GripVertical, `elce-question-answer-drag-icon-${answer.id}`)}
    </button>
    <input
      id={`elce-question-answer-label-${answer.id}`}
      aria-label={`Réponse ${answerNumber}`}
      placeholder={`Réponse ${answerNumber}`}
      value={answer.label}
      {...textFieldAttributes}
      mix={on<HTMLInputElement, 'input'>('input', (event) => actions.setAnswerLabel(answer.id, event.currentTarget.value))}
    />
    <button
      id={`elce-question-answer-correct-${answer.id}`}
      className={answer.correct ? 'elce-bdc-icon-button elce-question-answer-correct is-correct' : 'elce-bdc-icon-button elce-question-answer-correct'}
      type="button"
      aria-label={answer.correct ? `Réponse ${answerNumber} juste` : `Marquer la réponse ${answerNumber} juste`}
      aria-pressed={answer.correct}
      title={answer.correct ? 'Réponse juste' : 'Marquer juste'}
      mix={on<HTMLButtonElement, 'click'>('click', () => actions.setAnswerCorrect(answer.id, !answer.correct))}
    >
      {renderLucideIcon(Check, `elce-question-answer-correct-icon-${answer.id}`)}
    </button>
    <button
      id={`elce-question-answer-delete-${answer.id}`}
      className="elce-bdc-icon-button elce-bdc-icon-button--danger"
      type="button"
      aria-label={`Supprimer la réponse ${answerNumber}`}
      title="Supprimer la réponse"
      disabled={!actions.canRemoveAnswer(answer.id)}
      mix={on<HTMLButtonElement, 'click'>('click', () => actions.removeAnswer(answer.id))}
    >
      {renderLucideIcon(Trash2, `elce-question-answer-delete-icon-${answer.id}`)}
    </button>
  </li>
}
