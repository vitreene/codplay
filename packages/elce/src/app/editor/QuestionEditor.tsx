import { Check, GripVertical, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { CATALOG_REFERENCE, QUESTION_TYPE_CONFIG, QUESTION_TYPE_OPTIONS } from '../../config/document-config'
import type { QuestionAnswer } from '../../domain/question-types'
import type { QuestionEditorProps } from './question-editor-types'

/** Renders and edits one Question BDC while sending every change to its facade. */
export function QuestionEditor({ bdcId, question, media, mediaSource, actions, onCatalogReference }: QuestionEditorProps) {
  const typeConfig = QUESTION_TYPE_CONFIG[question.type]
  const showAnswerControls = typeConfig.editableAnswers
  return (
    <article id={`elce-question-editor-${bdcId}`} className="elce-question-editor">
      <div id={`elce-question-editor-heading-${bdcId}`} className="elce-question-editor__heading">
        <select
          id={`elce-question-type-${bdcId}`}
          aria-label="Type de question"
          value={question.type}
          onChange={(event) => actions.setType(event.currentTarget.value as typeof question.type)}
        >
          {QUESTION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button
          id={`elce-question-delete-${bdcId}`}
          className="elce-bdc-icon-button elce-bdc-icon-button--danger"
          type="button"
          aria-label="Supprimer la question"
          title="Supprimer la question"
          onClick={actions.deleteQuestion}
        >
          <Trash2 aria-hidden="true" size={16} />
        </button>
      </div>
      <input
        id={`elce-question-title-${bdcId}`}
        className="elce-question-title"
        aria-label="Titre facultatif de la question"
        placeholder="Titre (facultatif)"
        value={question.title}
        onChange={(event) => actions.setTitle(event.currentTarget.value)}
      />
      <label
        id={`elce-question-illustration-${bdcId}`}
        className="elce-question-illustration"
        onDragOver={(event) => {
          const acceptsFile = Array.from(event.dataTransfer.types).includes('Files')
          const acceptsMedia = Array.from(event.dataTransfer.types).includes(CATALOG_REFERENCE.MIME_TYPE)
          if (acceptsFile || acceptsMedia) {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }
        }}
        onDrop={(event) => {
          const file = event.dataTransfer.files[0]
          if (file !== undefined) {
            event.preventDefault()
            event.stopPropagation()
            actions.importMedia(file)
            return
          }
          const value = event.dataTransfer.getData(CATALOG_REFERENCE.MIME_TYPE)
          if (value.length === 0) return
          event.preventDefault()
          event.stopPropagation()
          onCatalogReference(value)
        }}
      >
        <input
          id={`elce-question-illustration-file-${bdcId}`}
          className="elce-visually-hidden"
          type="file"
          accept="image/*,video/*"
          aria-label="Choisir une illustration"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file !== undefined) actions.importMedia(file)
            event.currentTarget.value = ''
          }}
        />
        {media !== null && mediaSource !== null
          ? media.type === 'image'
            ? <img id={`elce-question-media-image-${bdcId}`} src={mediaSource} alt="" />
            : <video id={`elce-question-media-video-${bdcId}`} src={mediaSource} controls />
          : <span id={`elce-question-illustration-prompt-${bdcId}`}><ImagePlus aria-hidden="true" size={17} />{media?.name ?? 'Illustration facultative · déposer un média ici'}</span>}
        {media !== null
          ? <button
              id={`elce-question-media-clear-${bdcId}`}
              className="elce-bdc-icon-button elce-question-media-clear"
              type="button"
              aria-label="Retirer l’illustration"
              title="Retirer l’illustration"
              onClick={(event) => { event.preventDefault(); actions.clearMedia() }}
            ><X aria-hidden="true" size={15} /></button>
          : null}
      </label>
      <textarea
        id={`elce-question-prompt-${bdcId}`}
        className="elce-question-prompt"
        aria-label="Question"
        placeholder="Écrire la question…"
        rows={2}
        value={question.prompt}
        onChange={(event) => actions.setPrompt(event.currentTarget.value)}
      />
      {typeConfig.note.length > 0
        ? <p id={`elce-question-multiple-note-${bdcId}`} className="elce-question-multiple-note">{typeConfig.note}</p>
        : null}
      <ol id={`elce-question-answers-${bdcId}`} className="elce-question-answers">
        {question.answers.map((answer, index) => (
          <QuestionAnswerEditor
            key={answer.id}
            answer={answer}
            index={index}
            canRemove={showAnswerControls && actions.canRemoveAnswer(answer.id)}
            onLabelChange={(label) => actions.setAnswerLabel(answer.id, label)}
            onCorrectChange={(correct) => actions.setAnswerCorrect(answer.id, correct)}
            onRemove={() => actions.removeAnswer(answer.id)}
            onMove={(draggedAnswerId) => actions.moveAnswer(draggedAnswerId, index)}
          />
        ))}
      </ol>
      {showAnswerControls
        ? <button id={`elce-question-add-answer-${bdcId}`} className="elce-question-add-answer" type="button" onClick={actions.addAnswer}>
            <Plus aria-hidden="true" size={15} /> Ajouter une réponse
          </button>
        : null}
      <button id={`elce-question-validate-preview-${bdcId}`} className="elce-question-validation-preview" type="button" disabled>
        Valider la réponse
      </button>
    </article>
  )
}

type QuestionAnswerEditorProps = Readonly<{
  answer: QuestionAnswer
  index: number
  canRemove: boolean
  onLabelChange: (label: string) => void
  onCorrectChange: (correct: boolean) => void
  onRemove: () => void
  onMove: (answerId: string) => void
}>

/** Renders one answer with a keyboard-accessible correction toggle and drag handle. */
function QuestionAnswerEditor({ answer, index, canRemove, onLabelChange, onCorrectChange, onRemove, onMove }: QuestionAnswerEditorProps) {
  const answerMimeType = `application/x-elce-question-answer+json`
  return (
    <li
      id={`elce-question-answer-row-${answer.id}`}
      className="elce-question-answer-row"
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.types).includes(answerMimeType)) event.preventDefault()
      }}
      onDrop={(event) => {
        const source = event.dataTransfer.getData(answerMimeType)
        if (source.length === 0) return
        event.preventDefault()
        onMove(source)
      }}
    >
      <button
        id={`elce-question-answer-drag-${answer.id}`}
        className="elce-bdc-icon-button elce-question-answer-drag"
        type="button"
        draggable
        aria-label={`Réordonner la réponse ${index + 1}`}
        title="Glisser pour réordonner"
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData(answerMimeType, answer.id)
        }}
      ><GripVertical aria-hidden="true" size={15} /></button>
      <input
        id={`elce-question-answer-label-${answer.id}`}
        aria-label={`Réponse ${index + 1}`}
        placeholder={`Réponse ${index + 1}`}
        value={answer.label}
        onChange={(event) => onLabelChange(event.currentTarget.value)}
      />
      <button
        id={`elce-question-answer-correct-${answer.id}`}
        className={answer.correct ? 'elce-bdc-icon-button elce-question-answer-correct is-correct' : 'elce-bdc-icon-button elce-question-answer-correct'}
        type="button"
        aria-label={answer.correct ? `Réponse ${index + 1} juste` : `Marquer la réponse ${index + 1} juste`}
        aria-pressed={answer.correct}
        title={answer.correct ? 'Réponse juste' : 'Marquer juste'}
        onClick={() => onCorrectChange(!answer.correct)}
      ><Check aria-hidden="true" size={16} /></button>
      <button
        id={`elce-question-answer-delete-${answer.id}`}
        className="elce-bdc-icon-button elce-bdc-icon-button--danger"
        type="button"
        aria-label={`Supprimer la réponse ${index + 1}`}
        title="Supprimer la réponse"
        disabled={!canRemove}
        onClick={onRemove}
      ><Trash2 aria-hidden="true" size={15} /></button>
    </li>
  )
}
