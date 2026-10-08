import { on, type RemixNode } from 'remix/ui'
import { jsx } from 'remix/ui/jsx-runtime'
import { ClipboardCheck, Folder } from 'lucide-static'
import { CHAPTER_TYPE, CHAPTER_TYPE_CONFIG, DEFAULT_EVALUATION_SETTINGS, EVALUATION_RETRY_SCOPE } from '../../../config/document-config'
import type { EvaluationRetryScope } from '../../../config/document-config-types'
import type { Chapter } from '../../../domain/document/document-types'
import type { EditorActionsFacade } from '../../facades/editor-actions-facade'
import { renderLucideIcon } from '../lucide-static-icon'
import type { RemixChapterSettingsProps } from './chapter-settings-types'

/** Renders the selected chapter title and its author settings in Remix. */
export function renderChapterSettings({ chapter, actions, onPreview, previewError }: RemixChapterSettingsProps): RemixNode {
  const title = jsx('div', {
    id: `elce-remix-chapter-title-${chapter.id}`,
    className: 'elce-work-area-chapter-title elce-work-area-chapter-title--active',
    children: [
      renderChapterTypeIcon(chapter),
      jsx('input', {
        id: `elce-remix-chapter-name-${chapter.id}`,
        className: 'elce-inline-title-input',
        type: 'text',
        'aria-label': CHAPTER_TYPE_CONFIG[chapter.type].titleLabel,
        title: CHAPTER_TYPE_CONFIG[chapter.type].editTitleLabel,
        defaultValue: chapter.name,
        key: `${chapter.id}:${chapter.name}`,
        mix: [
          on<HTMLInputElement, 'blur'>('blur', (event) => commitChapterName(event.currentTarget, chapter, actions)),
          on<HTMLInputElement, 'keydown'>('keydown', (event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }),
        ],
      }),
    ],
  })

  switch (chapter.type) {
    case CHAPTER_TYPE.STANDARD:
      return jsx('section', {
        id: `elce-remix-standard-chapter-settings-${chapter.id}`,
        className: 'elce-panel elce-work-area',
        'aria-label': CHAPTER_TYPE_CONFIG[chapter.type].titleLabel,
        children: [renderPreviewControls(onPreview, previewError), title],
      })
    case CHAPTER_TYPE.EVALUATION:
      return jsx('section', {
        id: `elce-remix-evaluation-chapter-settings-${chapter.id}`,
        className: 'elce-panel elce-work-area',
        'aria-label': CHAPTER_TYPE_CONFIG[chapter.type].titleLabel,
        children: [
          renderPreviewControls(onPreview, previewError),
          title,
          renderEvaluationSettings(chapter, actions),
        ],
      })
    default:
      return assertNever(chapter.type)
  }
}

/** Renders the page preview command above the selected chapter title. */
function renderPreviewControls(onPreview: () => void, previewError: string | null): RemixNode {
  return jsx('div', {
    id: 'elce-remix-work-area-preview-row',
    className: 'elce-work-area-preview-row',
    children: [
      jsx('button', {
        id: 'elce-remix-preview-open',
        type: 'button',
        mix: on<HTMLButtonElement, 'click'>('click', onPreview),
        children: 'Prévisualiser',
      }),
      previewError === null ? null : jsx('p', { id: 'elce-remix-preview-open-error', role: 'alert', children: previewError }),
    ],
  })
}

/** Renders the fixed threshold and the two editable Evaluation settings. */
function renderEvaluationSettings(chapter: Chapter, actions: EditorActionsFacade): RemixNode {
  const attemptLimit = chapter.evaluationAttemptLimit ?? DEFAULT_EVALUATION_SETTINGS.attemptLimit
  const retryScope = chapter.evaluationRetryScope ?? DEFAULT_EVALUATION_SETTINGS.retryScope

  return jsx('form', {
    id: `elce-remix-evaluation-settings-form-${chapter.id}`,
    className: 'elce-evaluation-settings',
    mix: on<HTMLFormElement, 'submit'>('submit', (event) => event.preventDefault()),
    children: [
      jsx('label', {
        id: `elce-remix-evaluation-threshold-label-${chapter.id}`,
        className: 'elce-evaluation-setting',
        children: [
          jsx('span', { id: `elce-remix-evaluation-threshold-text-${chapter.id}`, children: 'Seuil de réussite' }),
          jsx('output', { id: `elce-remix-evaluation-threshold-${chapter.id}`, children: `${DEFAULT_EVALUATION_SETTINGS.threshold * 100} %` }),
          jsx('small', { id: `elce-remix-evaluation-threshold-note-${chapter.id}`, children: 'Fixé pour le POC.' }),
        ],
      }),
      jsx('label', {
        id: `elce-remix-evaluation-attempt-label-${chapter.id}`,
        className: 'elce-evaluation-setting',
        children: [
          jsx('span', { id: `elce-remix-evaluation-attempt-text-${chapter.id}`, children: 'Nombre maximal de tentatives' }),
          jsx('input', {
            id: `elce-remix-evaluation-attempt-limit-${chapter.id}`,
            key: `${chapter.id}:${attemptLimit ?? 'unlimited'}`,
            type: 'number',
            min: 1,
            step: 1,
            placeholder: 'Illimité',
            defaultValue: attemptLimit ?? '',
            mix: [
              on<HTMLInputElement, 'blur'>('blur', (event) => commitAttemptLimit(
                event.currentTarget,
                attemptLimit,
                (value) => actions.updateEvaluationChapterSettings(chapter.id, value, retryScope),
              )),
              on<HTMLInputElement, 'keydown'>('keydown', (event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }),
            ],
          }),
          jsx('small', {
            id: `elce-remix-evaluation-attempt-note-${chapter.id}`,
            children: 'Laisser vide pour autoriser un nombre illimité de tentatives.',
          }),
        ],
      }),
      jsx('label', {
        id: `elce-remix-evaluation-retry-label-${chapter.id}`,
        className: 'elce-evaluation-setting',
        children: [
          jsx('span', { id: `elce-remix-evaluation-retry-text-${chapter.id}`, children: 'Questions à reprendre après un échec' }),
          jsx('select', {
            id: `elce-remix-evaluation-retry-scope-${chapter.id}`,
            mix: on<HTMLSelectElement, 'change'>('change', (event) => actions.updateEvaluationChapterSettings(
              chapter.id,
              attemptLimit,
              event.currentTarget.value as EvaluationRetryScope,
            )),
            children: [
              jsx('option', {
                id: `elce-remix-evaluation-retry-all-${chapter.id}`,
                value: EVALUATION_RETRY_SCOPE.ALL_QUESTIONS,
                selected: retryScope === EVALUATION_RETRY_SCOPE.ALL_QUESTIONS,
                children: 'Toutes les questions',
              }),
              jsx('option', {
                id: `elce-remix-evaluation-retry-incorrect-${chapter.id}`,
                value: EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS,
                selected: retryScope === EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS,
                children: 'Les réponses incorrectes seulement',
              }),
            ],
          }),
        ],
      }),
    ],
  })
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
