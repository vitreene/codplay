import { Check, GripVertical, ImagePlus, Plus, Trash2, X } from 'lucide-static'
import { CATALOG_REFERENCE, MEDIA_FILE_ACCEPT, QUESTION_TYPE_CONFIG, QUESTION_TYPE_OPTIONS } from '../../../config/document-config'
import type { QuestionAnswer, QuestionType } from '../../../domain/question/question-types'
import { on, type RemixNode } from 'remix/ui'

import type { QuestionEditorProps } from './question-editor-types'
import { renderLucideIcon } from '../../remix/lucide-static-icon'

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
      <button
        id={`elce-question-delete-${bdcId}`}
        className="elce-bdc-icon-button elce-bdc-icon-button--danger"
        type="button"
        aria-label="Supprimer la question"
        title="Supprimer la question"
        mix={on<HTMLButtonElement, 'click'>('click', actions.deleteQuestion)}
      >
        {renderLucideIcon(Trash2, `elce-question-delete-icon-${bdcId}`, 16)}
      </button>
    </div>
    <input
      id={`elce-question-title-${bdcId}`}
      className="elce-question-title"
      aria-label="Titre facultatif de la question"
      placeholder="Titre (facultatif)"
      value={question.title}
      mix={on<HTMLInputElement, 'input'>('input', (event) => actions.setTitle(event.currentTarget.value))}
    />
    {renderQuestionMediaEditor(props)}
    <textarea
      id={`elce-question-prompt-${bdcId}`}
      className="elce-question-prompt"
      aria-label="Question"
      placeholder="Écrire la question…"
      rows={2}
      value={question.prompt}
      mix={on<HTMLTextAreaElement, 'input'>('input', (event) => actions.setPrompt(event.currentTarget.value))}
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
      {question.answers.map((answer, index) => renderQuestionAnswer(answer, index, actions))}
    </ol>
    {typeConfig.editableAnswers
      ? <button
        id={`elce-question-add-answer-${bdcId}`}
        className="elce-question-add-answer"
        type="button"
        mix={on<HTMLButtonElement, 'click'>('click', actions.addAnswer)}
      >
        {renderLucideIcon(Plus, `elce-question-add-answer-icon-${bdcId}`, 15)}
        {' Ajouter une réponse'}
      </button>
      : null}
    <button
      id={`elce-question-validate-preview-${bdcId}`}
      className="elce-question-validation-preview"
      type="button"
      disabled={true}
    >
      Valider la réponse
    </button>
  </article>
}

/** Renders the optional Question media picker, preview and catalogue drop target. */
function renderQuestionMediaEditor(props: QuestionEditorProps): RemixNode {
  const { bdcId, media, mediaType, mediaSource, actions, onCatalogReference } = props
  return <label
    id={`elce-question-illustration-${bdcId}`}
    className="elce-question-illustration"
    mix={[
      on<HTMLLabelElement, 'dragover'>('dragover', (event) => acceptQuestionMediaDrag(event)),
      on<HTMLLabelElement, 'drop'>('drop', (event) => dropQuestionMedia(event, actions.importMedia, onCatalogReference)),
    ]}
  >
    <input
      id={`elce-question-illustration-file-${bdcId}`}
      className="elce-visually-hidden"
      type="file"
      accept={MEDIA_FILE_ACCEPT.IMAGE_AND_VIDEO}
      aria-label="Choisir une illustration"
      mix={on<HTMLInputElement, 'change'>('change', (event) => {
        const file = event.currentTarget.files?.[0]
        if (file !== undefined) actions.importMedia(file)
        event.currentTarget.value = ''
      })}
    />
    {media !== null && mediaSource !== null
      ? mediaType === 'image'
        ? <img
          id={`elce-question-media-image-${bdcId}`}
          src={mediaSource}
          alt=""
        />
        : <video
          id={`elce-question-media-video-${bdcId}`}
          src={mediaSource}
          controls={true}
        />
      : <span
        id={`elce-question-illustration-prompt-${bdcId}`}
      >
        {renderLucideIcon(ImagePlus, `elce-question-illustration-icon-${bdcId}`, 17)}
        {media?.name ?? 'Illustration facultative · déposer un média ici'}
      </span>}
    {media !== null
      ? <button
        id={`elce-question-media-clear-${bdcId}`}
        className="elce-bdc-icon-button elce-question-media-clear"
        type="button"
        aria-label="Retirer l’illustration"
        title="Retirer l’illustration"
        mix={on<HTMLButtonElement, 'click'>('click', (event) => {
          event.preventDefault()
          actions.clearMedia()
        })}
      >
        {renderLucideIcon(X, `elce-question-media-clear-icon-${bdcId}`, 15)}
      </button>
      : null}
  </label>
}

/** Enables native file and catalogue drags over the Question illustration area. */
function acceptQuestionMediaDrag(event: DragEvent): void {
  const transfer = event.dataTransfer
  if (transfer === null) return
  const types = Array.from(transfer.types)
  if (types.includes('Files') || types.includes(CATALOG_REFERENCE.MIME_TYPE)) {
    event.preventDefault()
    transfer.dropEffect = 'copy'
  }
}

/** Routes a Question illustration drop to the existing file or catalogue action. */
function dropQuestionMedia(
  event: DragEvent,
  importMedia: QuestionEditorProps['actions']['importMedia'],
  onCatalogReference: QuestionEditorProps['onCatalogReference'],
): void {
  const transfer = event.dataTransfer
  if (transfer === null) return
  const file = transfer.files[0]
  if (file !== undefined) {
    event.preventDefault()
    event.stopPropagation()
    importMedia(file)
    return
  }
  const reference = transfer.getData(CATALOG_REFERENCE.MIME_TYPE)
  if (reference.length === 0) return
  event.preventDefault()
  event.stopPropagation()
  onCatalogReference(reference)
}

/** Renders one ordered answer with its correction and drag controls. */
function renderQuestionAnswer(
  answer: QuestionAnswer,
  index: number,
  actions: QuestionEditorProps['actions'],
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
      {renderLucideIcon(GripVertical, `elce-question-answer-drag-icon-${answer.id}`, 15)}
    </button>
    <input
      id={`elce-question-answer-label-${answer.id}`}
      aria-label={`Réponse ${answerNumber}`}
      placeholder={`Réponse ${answerNumber}`}
      value={answer.label}
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
      {renderLucideIcon(Check, `elce-question-answer-correct-icon-${answer.id}`, 16)}
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
      {renderLucideIcon(Trash2, `elce-question-answer-delete-icon-${answer.id}`, 15)}
    </button>
  </li>
}
