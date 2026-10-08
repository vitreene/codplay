import { on, type RemixNode } from 'remix/ui'

import { ClipboardCheck, Folder } from 'lucide-static'
import { CHAPTER_TYPE, CHAPTER_TYPE_CONFIG, DEFAULT_EVALUATION_SETTINGS, EVALUATION_RETRY_SCOPE } from '../../../config/document-config'
import type { EvaluationRetryScope } from '../../../config/document-config-types'
import type { Chapter } from '../../../domain/document/document-types'
import type { EditorActionsFacade } from '../../facades/editor-actions-facade'
import { renderLucideIcon } from '../lucide-static-icon'
import type { RemixChapterSettingsProps } from './chapter-settings-types'

/** Renders the selected chapter title and its author settings in Remix. */
export function renderChapterSettings({ chapter, actions, onPreview, previewError }: RemixChapterSettingsProps): RemixNode {
  const title = <div
    id={`elce-remix-chapter-title-${chapter.id}`}
    className="elce-work-area-chapter-title elce-work-area-chapter-title--active"
  >
    {renderChapterTypeIcon(chapter)}
    <input
      id={`elce-remix-chapter-name-${chapter.id}`}
      className="elce-inline-title-input"
      type="text"
      aria-label={CHAPTER_TYPE_CONFIG[chapter.type].titleLabel}
      title={CHAPTER_TYPE_CONFIG[chapter.type].editTitleLabel}
      defaultValue={chapter.name}
      key={`${chapter.id}:${chapter.name}`}
      mix={[
        on<HTMLInputElement, 'blur'>('blur', (event) => commitChapterName(event.currentTarget, chapter, actions)),
        on<HTMLInputElement, 'keydown'>('keydown', (event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }),
      ]}
    />
  </div>

  switch (chapter.type) {
    case CHAPTER_TYPE.STANDARD:
      return <section
        id={`elce-remix-standard-chapter-settings-${chapter.id}`}
        className="elce-panel elce-work-area"
        aria-label={CHAPTER_TYPE_CONFIG[chapter.type].titleLabel}
      >
        {renderPreviewControls(onPreview, previewError)}
        {title}
      </section>
    case CHAPTER_TYPE.EVALUATION:
      return <section
        id={`elce-remix-evaluation-chapter-settings-${chapter.id}`}
        className="elce-panel elce-work-area"
        aria-label={CHAPTER_TYPE_CONFIG[chapter.type].titleLabel}
      >
        {renderPreviewControls(onPreview, previewError)}
        {title}
        {renderEvaluationSettings(chapter, actions)}
      </section>
    default:
      return assertNever(chapter.type)
  }
}

/** Renders the page preview command above the selected chapter title. */
function renderPreviewControls(onPreview: () => void, previewError: string | null): RemixNode {
  return <div
    id="elce-remix-work-area-preview-row"
    className="elce-work-area-preview-row"
  >
    <button
      id="elce-remix-preview-open"
      type="button"
      mix={on<HTMLButtonElement, 'click'>('click', onPreview)}
    >
      Prévisualiser
    </button>
    {previewError === null ? null : <p
      id="elce-remix-preview-open-error"
      role="alert"
    >
      {previewError}
    </p>}
  </div>
}

/** Renders the fixed threshold and the two editable Evaluation settings. */
function renderEvaluationSettings(chapter: Chapter, actions: EditorActionsFacade): RemixNode {
  const attemptLimit = chapter.evaluationAttemptLimit ?? DEFAULT_EVALUATION_SETTINGS.attemptLimit
  const retryScope = chapter.evaluationRetryScope ?? DEFAULT_EVALUATION_SETTINGS.retryScope

  return <form
    id={`elce-remix-evaluation-settings-form-${chapter.id}`}
    className="elce-evaluation-settings"
    mix={on<HTMLFormElement, 'submit'>('submit', (event) => event.preventDefault())}
  >
    <label
      id={`elce-remix-evaluation-threshold-label-${chapter.id}`}
      className="elce-evaluation-setting"
    >
      <span
        id={`elce-remix-evaluation-threshold-text-${chapter.id}`}
      >
        Seuil de réussite
      </span>
      <output
        id={`elce-remix-evaluation-threshold-${chapter.id}`}
      >
        {`${DEFAULT_EVALUATION_SETTINGS.threshold * 100} %`}
      </output>
      <small
        id={`elce-remix-evaluation-threshold-note-${chapter.id}`}
      >
        Fixé pour le POC.
      </small>
    </label>
    <label
      id={`elce-remix-evaluation-attempt-label-${chapter.id}`}
      className="elce-evaluation-setting"
    >
      <span
        id={`elce-remix-evaluation-attempt-text-${chapter.id}`}
      >
        Nombre maximal de tentatives
      </span>
      <input
        id={`elce-remix-evaluation-attempt-limit-${chapter.id}`}
        key={`${chapter.id}:${attemptLimit ?? 'unlimited'}`}
        type="number"
        min={1}
        step={1}
        placeholder="Illimité"
        defaultValue={attemptLimit ?? ''}
        mix={[
          on<HTMLInputElement, 'blur'>('blur', (event) => commitAttemptLimit(
            event.currentTarget,
            attemptLimit,
            (value) => actions.updateEvaluationChapterSettings(chapter.id, value, retryScope),
          )),
          on<HTMLInputElement, 'keydown'>('keydown', (event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }),
        ]}
      />
      <small
        id={`elce-remix-evaluation-attempt-note-${chapter.id}`}
      >
        Laisser vide pour autoriser un nombre illimité de tentatives.
      </small>
    </label>
    <label
      id={`elce-remix-evaluation-retry-label-${chapter.id}`}
      className="elce-evaluation-setting"
    >
      <span
        id={`elce-remix-evaluation-retry-text-${chapter.id}`}
      >
        Questions à reprendre après un échec
      </span>
      <select
        id={`elce-remix-evaluation-retry-scope-${chapter.id}`}
        mix={on<HTMLSelectElement, 'change'>('change', (event) => actions.updateEvaluationChapterSettings(
          chapter.id,
          attemptLimit,
          event.currentTarget.value as EvaluationRetryScope,
        ))}
      >
        <option
          id={`elce-remix-evaluation-retry-all-${chapter.id}`}
          value={EVALUATION_RETRY_SCOPE.ALL_QUESTIONS}
          selected={retryScope === EVALUATION_RETRY_SCOPE.ALL_QUESTIONS}
        >
          Toutes les questions
        </option>
        <option
          id={`elce-remix-evaluation-retry-incorrect-${chapter.id}`}
          value={EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS}
          selected={retryScope === EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS}
        >
          Les réponses incorrectes seulement
        </option>
      </select>
    </label>
  </form>
}

/** Renders the configured chapter icon as a native SVG view. */
function renderChapterTypeIcon(chapter: Chapter): RemixNode {
  switch (chapter.type) {
    case CHAPTER_TYPE.STANDARD:
      return renderLucideIcon(Folder, `elce-remix-chapter-icon-${chapter.id}`, 14)
    case CHAPTER_TYPE.EVALUATION:
      return renderLucideIcon(ClipboardCheck, `elce-remix-chapter-icon-${chapter.id}`, 14)
    default:
      return assertNever(chapter.type)
  }
}

/** Commits a non-empty chapter name through the existing XState command facade. */
function commitChapterName(input: HTMLInputElement, chapter: Chapter, actions: EditorActionsFacade): void {
  const name = input.value.trim()
  if (name === '' || name === chapter.name) {
    input.value = chapter.name
    return
  }
  actions.renameChapter(chapter.id, name)
}

/** Commits a positive attempt limit or restores the current unlimited/default value. */
function commitAttemptLimit(input: HTMLInputElement, currentValue: number | null, commit: (value: number | null) => void): void {
  const value = input.value.trim() === '' ? null : Number(input.value)
  if (value !== null && (!Number.isInteger(value) || value < 1)) {
    input.value = currentValue === null ? '' : String(currentValue)
    return
  }
  if (value !== currentValue) commit(value)
}

/** Forces each chapter type to have an explicit renderer. */
function assertNever(value: never): never {
  throw new Error(`Type de chapitre non pris en charge : ${String(value)}`)
}
