import { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { on, ref, type RemixNode } from 'remix/ui'
import type { LearningPage } from '../document/learning-document-types'
import type { RichTextDocument } from '../../../resources/document/rich-text-types'
import type { ProfileProperty } from '../profile/domain/learning-profile-types'
import type { ElceTextValue } from '../../../resources/document/rich-text-types'
import {
  countTextValueCharacters,
  createRichTextDocumentFromPlainText,
  parseInlineTextTokens,
  type InlineTextSelection,
} from './learning-inline-text-value'
import { createLocalDateLabelExtension, createPageLinkLabelExtension } from './learning-inline-label-extensions'
import { toTiptapContent } from './learning-tiptap-content'
import { createProfileLabelExtension } from '../profile/authoring/profile-label-extension'
import type { ResourceTextFieldFeature } from '../../../core/authoring/resource-text-field-feature'
import {
  INLINE_TEXT_DRAG_TYPE,
  INLINE_TEXT_LABEL_UPDATE_EVENT,
  PROFILE_TOKEN_INSERT_EVENT,
  dispatchInlineTextLabelSelectionEvent,
  inlineTextLabelFromNode,
  inlineTextLabelNodeAttributes,
  sameInlineTextLabel,
  type InlineTextInsertDetail,
  type InlineTextLabelUpdateDetail,
} from '../profile/authoring/profile-token-events'

const activeEditors = new Map<string, InlineTextFieldAdapter>()
const pendingSelections = new Map<string, InlineTextSelection>()
let currentProfileProperties: readonly ProfileProperty[] = []
let currentScenarioPages: readonly LearningPage[] = []

export interface InlineTextFieldOptions {
  readonly id: string
  readonly value: ElceTextValue
  readonly ariaLabel: string
  readonly placeholder?: string
  readonly className?: string
  readonly multiline?: boolean
  readonly deferPlainChanges?: boolean
  readonly required?: boolean
  readonly profileProperties?: readonly ProfileProperty[]
  readonly pages?: readonly LearningPage[]
  readonly allowPageLinks?: boolean
  readonly allowBoldItalic?: boolean
  readonly maxLength?: number
  readonly onFocus?: () => void
  readonly onKeyDown?: (event: KeyboardEvent) => void
  readonly onChange: (value: ElceTextValue) => void
}

type RichInlineTextFieldOptions = Omit<InlineTextFieldOptions, 'value'> & Readonly<{ value: RichTextDocument }>

/** Creates the Learning contribution consumed by reusable resource editors. */
export function createLearningTextFieldFeature(
  profileProperties: readonly ProfileProperty[] = currentProfileProperties,
  pages: readonly LearningPage[] = currentScenarioPages,
): ResourceTextFieldFeature {
  return {
    render: (options) => renderInlineTextField({ ...options, profileProperties, pages }),
  }
}

/** Renders a native field until labels or allowed formatting require Tiptap. */
export function renderInlineTextField(options: InlineTextFieldOptions): RemixNode {
  reconcileActiveEditor(options.id, options.value)
  const contextOptions = {
    ...options,
    profileProperties: options.profileProperties ?? currentProfileProperties,
    pages: options.pages ?? currentScenarioPages,
  }
  if (typeof options.value !== 'string') return renderRichField({ ...contextOptions, value: options.value })
  return renderPlainField(contextOptions, options.value)
}

/** Sets the current document context shared by every Elcé text field. */
export function setLearningInlineTextFieldContext(
  profileProperties: readonly ProfileProperty[],
  scenarioPages: readonly LearningPage[],
): void {
  currentProfileProperties = profileProperties
  currentScenarioPages = scenarioPages
}

/** Renders a plain input or textarea that promotes itself when it receives a label. */
function renderPlainField(options: InlineTextFieldOptions, value: string): RemixNode {
  const handleInput = (input: HTMLInputElement | HTMLTextAreaElement): void => {
    const promoted = parseInlineTextTokens(input.value, { allowPageLinks: options.allowPageLinks !== false })
    if (promoted === null) {
      const pendingTrailingSpace = options.required === true && input.value !== input.value.trimEnd()
      if (options.deferPlainChanges !== true && !pendingTrailingSpace
        && (options.required !== true || input.value.trim().length > 0)) {
        options.onChange(input.value)
      }
      return
    }
    const cursor = inlineCaretPosition(input.value, input.selectionStart ?? input.value.length)
    pendingSelections.set(options.id, { from: cursor, to: cursor })
    options.onChange(promoted)
  }
  const common = {
    id: options.id,
    className: options.className,
    'aria-label': options.ariaLabel,
    placeholder: options.placeholder,
    value,
    required: options.required,
    maxLength: options.maxLength,
    'data-elce-profile-token-target': 'true',
    'data-elce-allow-page-links': options.allowPageLinks === false ? 'false' : 'true',
  }
  const field = options.multiline === true
    ? <textarea
      {...common}
      rows={3}
      mix={[
        on<HTMLTextAreaElement, 'input'>('input', (event) => handleInput(event.currentTarget)),
        on<HTMLTextAreaElement, 'focus'>('focus', options.onFocus ?? (() => undefined)),
        on<HTMLTextAreaElement, 'keydown'>('keydown', (event) => options.onKeyDown?.(event)),
        on<HTMLTextAreaElement, 'dragover'>('dragover', (event) => {
          if (hasInlineTextDrag(event.dataTransfer)) event.preventDefault()
        }),
        on<HTMLTextAreaElement, 'drop'>('drop', (event) => insertDroppedText(event.currentTarget, event)),
        ...(options.deferPlainChanges === true || options.required === true
          ? [on<HTMLTextAreaElement, 'blur'>('blur', (event) => handlePlainFieldBlur(event.currentTarget, value, options))]
          : []),
      ]}
    />
    : <input
      {...common}
      type="text"
      mix={[
        on<HTMLInputElement, 'input'>('input', (event) => handleInput(event.currentTarget)),
        on<HTMLInputElement, 'focus'>('focus', options.onFocus ?? (() => undefined)),
        on<HTMLInputElement, 'keydown'>('keydown', (event) => {
          options.onKeyDown?.(event)
          if (event.key === 'Enter') event.currentTarget.blur()
        }),
        on<HTMLInputElement, 'dragover'>('dragover', (event) => {
          if (hasInlineTextDrag(event.dataTransfer)) event.preventDefault()
        }),
        on<HTMLInputElement, 'drop'>('drop', (event) => insertDroppedText(event.currentTarget, event)),
        ...(options.deferPlainChanges === true || options.required === true
          ? [on<HTMLInputElement, 'blur'>('blur', (event) => handlePlainFieldBlur(event.currentTarget, value, options))]
          : []),
      ]}
    />

  if (options.allowBoldItalic !== true) return field
  const toolbar = <div id={`${options.id}-formatting`} className="elce-inline-text-field__toolbar" role="toolbar" aria-label="Mise en forme">
    {renderFormatButton(options.id, 'bold', 'Gras', (input) => promotePlainField(input, options, 'bold'))}
    {renderFormatButton(options.id, 'italic', 'Italique', (input) => promotePlainField(input, options, 'italic'))}
  </div>
  return <div id={`${options.id}-field`} className="elce-inline-text-field elce-inline-text-field--plain-rich-capable">
    {toolbar}
    {field}
  </div>
}

/** Renders a promoted editor host and optional Message formatting controls. */
function renderRichField(options: RichInlineTextFieldOptions): RemixNode {
  const toolbar = options.allowBoldItalic === true
    ? <div id={`${options.id}-formatting`} className="elce-inline-text-field__toolbar" role="toolbar" aria-label="Mise en forme">
      {renderFormatButton(options.id, 'bold', 'Gras')}
      {renderFormatButton(options.id, 'italic', 'Italique')}
    </div>
    : null
  return <div id={`${options.id}-rich-field`} className="elce-inline-text-field">
    {toolbar}
    <div
      id={`${options.id}-editor-host`}
      className="elce-inline-text-field__editor-host"
      data-rmx-preserve-dom={true}
      mix={ref((host, signal) => {
        const adapter = new InlineTextFieldAdapter(host as HTMLElement, options)
        activeEditors.set(options.id, adapter)
        signal.addEventListener('abort', () => {
          if (activeEditors.get(options.id) === adapter) activeEditors.delete(options.id)
          adapter.destroy()
        }, { once: true })
      })}
    />
  </div>
}

/** Renders one compact formatting command for a promoted Card Message. */
function renderFormatButton(
  id: string,
  mark: 'bold' | 'italic',
  label: string,
  onPromote?: (field: HTMLInputElement | HTMLTextAreaElement) => void,
): RemixNode {
  return <button
    id={`${id}-format-${mark}`}
    type="button"
    aria-label={label}
    aria-pressed={false}
    mix={[
      on<HTMLButtonElement, 'mousedown'>('mousedown', (event) => event.preventDefault()),
      on<HTMLButtonElement, 'click'>('click', () => {
        const adapter = activeEditors.get(id)
        if (adapter !== undefined) adapter.toggleMark(mark)
        else {
          const field = document.getElementById(id)
          if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) onPromote?.(field)
        }
      }),
    ]}
  >
    {label}
  </button>
}

/** Keeps a mounted editor aligned with history or external document updates. */
function reconcileActiveEditor(id: string, value: ElceTextValue): void {
  activeEditors.get(id)?.updateValue(value)
}

/** Owns one promoted Tiptap value while committing changes through its field facade. */
class InlineTextFieldAdapter {
  private readonly id: string
  private readonly editor: Editor
  private readonly allowBoldItalic: boolean
  private readonly maxLength: number | undefined
  private readonly allowPageLinks: boolean
  private readonly onChange: (value: ElceTextValue) => void
  private lastAcceptedValue: RichTextDocument
  private readonly onLabelInsert = (event: Event): void => {
    const detail = (event as CustomEvent<InlineTextInsertDetail>).detail
    if (detail === undefined) return
    this.insertLabel(detail)
  }
  /** Applies a Variables-panel edit to the still-matching atom in this field. */
  private readonly onLabelUpdate = (event: Event): void => {
    const detail = (event as CustomEvent<InlineTextLabelUpdateDetail>).detail
    if (detail === undefined || !Number.isInteger(detail.position)) return
    const node = this.editor.state.doc.nodeAt(detail.position)
    if (node === null) return
    const currentLabel = inlineTextLabelFromNode(node)
    if (currentLabel === null || !sameInlineTextLabel(currentLabel, detail.expected)
      || currentLabel.kind !== detail.label.kind) return
    const transaction = this.editor.state.tr.setNodeMarkup(
      detail.position,
      node.type,
      inlineTextLabelNodeAttributes(detail.label),
      node.marks,
    )
    transaction.setSelection(NodeSelection.create(transaction.doc, detail.position))
    this.editor.view.dispatch(transaction)
    this.emitSelectedLabel(this.editor)
  }
  private readonly onDrop = (event: DragEvent): void => {
    const transfer = event.dataTransfer
    if (!hasInlineTextDrag(transfer)) return
    const raw = transfer?.getData(INLINE_TEXT_DRAG_TYPE) ?? ''
    if (raw.length === 0) return
    let detail: InlineTextInsertDetail
    try {
      detail = JSON.parse(raw) as InlineTextInsertDetail
    } catch {
      return
    }
    const position = this.editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
    if (position === null) return
    event.preventDefault()
    this.insertLabel(detail, position.pos)
  }

  /** Creates a one-field Tiptap editor with the Elcé inline-label nodes. */
  public constructor(host: HTMLElement, options: RichInlineTextFieldOptions) {
    this.id = options.id
    this.allowBoldItalic = options.allowBoldItalic === true
    this.maxLength = options.maxLength
    this.allowPageLinks = options.allowPageLinks !== false
    this.onChange = options.onChange
    this.lastAcceptedValue = options.value
    this.editor = new Editor({
      element: null,
      extensions: [
        StarterKit.configure({
          bold: this.allowBoldItalic ? {} : false,
          italic: this.allowBoldItalic ? {} : false,
          blockquote: false,
          bulletList: false,
          code: false,
          codeBlock: false,
          heading: false,
          horizontalRule: false,
          link: false,
          listItem: false,
          listKeymap: false,
          orderedList: false,
          strike: false,
          trailingNode: false,
          undoRedo: false,
        }),
        createProfileLabelExtension(options.profileProperties ?? []),
        createPageLinkLabelExtension(options.pages ?? []),
        createLocalDateLabelExtension(),
      ],
      content: toTiptapContent(options.value),
      editorProps: {
        attributes: {
          id: `${options.id}-editor`,
          class: [
            'elce-inline-text-field__editor',
            options.multiline === true ? 'elce-inline-text-field__editor--multiline' : '',
            options.className,
          ].filter(Boolean).join(' '),
          'aria-label': options.ariaLabel,
          'data-placeholder': options.placeholder ?? '',
          'data-elce-profile-token-target': 'true',
          'data-elce-allow-page-links': options.allowPageLinks === false ? 'false' : 'true',
        },
        handleDOMEvents: {
          focus: () => {
            options.onFocus?.()
            return false
          },
          keydown: (_view, event) => {
            options.onKeyDown?.(event)
            return event.defaultPrevented
          },
        },
        ...(this.allowPageLinks ? {} : { transformPastedHTML: stripPastedPageLinks }),
      },
      onUpdate: ({ editor }) => this.acceptEditorUpdate(editor.getJSON() as RichTextDocument),
      onTransaction: ({ editor }) => this.updateFormatButtonStates(editor),
      onSelectionUpdate: ({ editor }) => this.emitSelectedLabel(editor),
    })
    this.editor.mount(host)
    this.editor.view.dom.addEventListener(PROFILE_TOKEN_INSERT_EVENT, this.onLabelInsert)
    this.editor.view.dom.addEventListener(INLINE_TEXT_LABEL_UPDATE_EVENT, this.onLabelUpdate)
    this.editor.view.dom.addEventListener('drop', this.onDrop, true)
    this.restorePendingSelection()
    this.updateFormatButtonStates(this.editor)
  }

  /** Replaces document content only when the authoritative snapshot changed. */
  public updateValue(value: ElceTextValue): void {
    if (typeof value === 'string') return
    const serialized = JSON.stringify(value)
    if (serialized === JSON.stringify(this.editor.getJSON())) {
      this.lastAcceptedValue = value
      return
    }
    this.lastAcceptedValue = value
    this.editor.commands.setContent(toTiptapContent(value), { emitUpdate: false })
  }

  /** Toggles one permitted mark and restores editor focus after toolbar use. */
  public toggleMark(mark: 'bold' | 'italic'): void {
    if (!this.allowBoldItalic) return
    this.editor.chain().focus().toggleMark(mark).run()
  }

  /** Removes listeners and destroys the ProseMirror view when the field unmounts. */
  public destroy(): void {
    this.editor.view.dom.removeEventListener(PROFILE_TOKEN_INSERT_EVENT, this.onLabelInsert)
    this.editor.view.dom.removeEventListener(INLINE_TEXT_LABEL_UPDATE_EVENT, this.onLabelUpdate)
    this.editor.view.dom.removeEventListener('drop', this.onDrop, true)
    this.editor.destroy()
  }

  /** Commits a valid rich update or restores the previous value at its selection. */
  private acceptEditorUpdate(value: RichTextDocument): void {
    if (this.maxLength !== undefined && countTextValueCharacters(value) > this.maxLength) {
      const selection = this.editor.state.selection
      this.editor.commands.setContent(toTiptapContent(this.lastAcceptedValue), { emitUpdate: false })
      const max = this.editor.state.doc.content.size
      this.editor.commands.setTextSelection({
        from: Math.min(selection.from, max - 1),
        to: Math.min(selection.to, max - 1),
      })
      return
    }
    this.lastAcceptedValue = value
    this.onChange(value)
  }

  /** Inserts the selected profile, page, or date reference as its stable atom. */
  private insertLabel(detail: InlineTextInsertDetail, position?: number): void {
    if (detail.kind === 'page-link' && !this.allowPageLinks) return
    let node: Readonly<{ type: string; attrs: Record<string, string | number | boolean | null> }>
    switch (detail.kind) {
      case 'profile':
        node = { type: 'profileLabel', attrs: { profilePropertyId: detail.propertyId } }
        break
      case 'page-link':
        node = { type: 'pageLinkLabel', attrs: {
          pageId: detail.pageId,
          label: detail.label,
          fallbackLabel: detail.fallbackLabel,
          presentation: detail.presentation,
        } }
        break
      case 'local-date':
        node = { type: 'localDateLabel', attrs: { kind: detail.dateKind, offsetDays: detail.offsetDays } }
        break
    }
    const chain = this.editor.chain().focus()
    if (position === undefined) chain.insertContent(node).run()
    else chain.insertContentAt(position, node).run()
  }

  /** Shares a selected atom with the Variables panel without losing its editor position. */
  private emitSelectedLabel(editor: Editor): void {
    const selection = editor.state.selection
    const label = selection instanceof NodeSelection ? inlineTextLabelFromNode(selection.node) : null
    dispatchInlineTextLabelSelectionEvent(editor.view.dom, label === null
      ? null
      : { position: selection.from, label })
  }

  /** Restores the insertion point captured when a native field was promoted. */
  private restorePendingSelection(): void {
    const selection = pendingSelections.get(this.id)
    if (selection === undefined) return
    pendingSelections.delete(this.id)
    const max = this.editor.state.doc.content.size
    const from = Math.max(1, Math.min(selection.from, max - 1))
    const to = Math.max(from, Math.min(selection.to, max - 1))
    this.editor.commands.setTextSelection({ from, to })
    this.editor.commands.focus()
    if (selection.mark !== undefined) this.toggleMark(selection.mark)
  }

  /** Updates compact toolbar pressed states without rebuilding the editor host. */
  private updateFormatButtonStates(editor: Editor): void {
    if (!this.allowBoldItalic) return
    for (const mark of ['bold', 'italic'] as const) {
      document.getElementById(`${this.id}-format-${mark}`)?.setAttribute('aria-pressed', String(editor.isActive(mark)))
    }
  }
}

/** Converts copied page links to their visible text in fields that forbid navigation. */
function stripPastedPageLinks(html: string): string {
  return html.replace(
    /<span\b(?=[^>]*\bdata-elce-page-id\s*=\s*(?:"[^"]*"|'[^']*'))[^>]*>([\s\S]*?)<\/span>/gi,
    '$1',
  )
}

/** Promotes a plain Message field when the author requests inline formatting. */
function promotePlainField(
  field: HTMLInputElement | HTMLTextAreaElement,
  options: InlineTextFieldOptions,
  mark: 'bold' | 'italic',
): void {
  const from = inlineCaretPosition(field.value, field.selectionStart ?? field.value.length)
  const to = inlineCaretPosition(field.value, field.selectionEnd ?? field.selectionStart ?? field.value.length)
  pendingSelections.set(options.id, { from, to, mark })
  options.onChange(createRichTextDocumentFromPlainText(field.value))
}

/** Detects the Elcé label drag format without intercepting unrelated drops. */
function hasInlineTextDrag(transfer: DataTransfer | null): boolean {
  return transfer !== null && Array.from(transfer.types).includes(INLINE_TEXT_DRAG_TYPE)
}

/** Inserts a catalog token at a native field's current selection. */
function insertDroppedText(input: HTMLInputElement | HTMLTextAreaElement, event: DragEvent): void {
  if (!hasInlineTextDrag(event.dataTransfer)) return
  const token = event.dataTransfer?.getData('text/plain') ?? ''
  if (token.length === 0) return
  event.preventDefault()
  const start = input.selectionStart ?? input.value.length
  const end = input.selectionEnd ?? start
  input.setRangeText(token, start, end, 'end')
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Commits deferred text or normalizes a required live value when focus leaves it. */
function handlePlainFieldBlur(
  input: HTMLInputElement | HTMLTextAreaElement,
  previousValue: string,
  options: InlineTextFieldOptions,
): void {
  if (options.deferPlainChanges !== true && options.required !== true) return
  if (input.value.trim().length === 0) {
    input.value = previousValue
    return
  }
  const nextValue = options.required === true ? input.value.trim() : input.value
  input.value = nextValue
  if (nextValue !== previousValue) options.onChange(nextValue)
}

/** Converts a native token offset to the one-character-per-atom Tiptap cursor. */
function inlineCaretPosition(value: string, offset: number): number {
  const prefix = value.slice(0, offset).replace(/\{\{profile:[^{}]+\}\}|\{\{page-link:[^{}]+\}\}|\{\{local-date:(?:today|time|relative:-?\d+)\}\}/g, 'x')
  return prefix.length + 1
}
