import { Bold, Italic, Underline, Subscript, Superscript, Pilcrow, AlignLeft, AlignCenter, AlignRight, AlignJustify, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Trash2, X } from 'lucide-static'
import { on, ref, type RemixNode } from 'remix/ui'

import { BDC_TYPE, SECTION_EDITOR_HEADING_LEVELS } from '../../../config/document-config'
import type { Bdc, Page } from '../../../domain/document/document-types'
import type { ElceAnchorMediaPreview } from '../../../domain/anchor/anchor-types'
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import type { EditorViewModel } from '../../selectors/editor-view-model'
import type { EditorActionsFacade } from '../../facades/editor-actions-facade'
import type { RemixRenderHandle } from '../../remix/remix-render-handle'
import { renderLucideIcon } from '../../remix/lucide-static-icon'
import { RemixCardEditorFields } from '../card/remix-card-editor-fields'
import { SectionTiptapAdapter } from './section-editor-tiptap-adapter'
import { EMPTY_SECTION_TOOLBAR_STATE } from './section-editor-tiptap'
import type { SectionToolbarState } from './section-editor-tiptap'

export interface RemixSectionEditorBindings {
  readonly adapters: Map<string, SectionTiptapAdapter>
  readonly toolbarStates: Map<string, SectionToolbarState>
  readonly selectedAnchorCardId: string | null
  readonly onEditAnchorCard: (bdcId: string) => void
  readonly onCloseAnchorCard: () => void
  readonly handle: RemixRenderHandle
  readonly current: { view: EditorViewModel }
}

/** Renders one production Section with the shared Tiptap and anchor adapters. */
export function renderRemixSectionEditor(
  bdc: Bdc,
  page: Page,
  view: EditorViewModel,
  actions: EditorActionsFacade,
  state: RemixSectionEditorBindings,
): RemixNode {
  const section = bdc.section
  if (bdc.type !== BDC_TYPE.SECTION || section === null) return null
  const anchorCards = view.documentModel.bdcs.filter((candidate) => candidate.parentBdcId === bdc.id && candidate.type === BDC_TYPE.CARD)
  const editingAnchorCard = anchorCards.find((card) => card.id === state.selectedAnchorCardId)
  const cardActions = actions.createCardEditorActions(view.documentModel.bdcs)
  const toolbarState = state.toolbarStates.get(bdc.id) ?? EMPTY_SECTION_TOOLBAR_STATE
  const handle = state.handle
  const current = state.current

  return <section
    key={bdc.id}
    id={`elce-section-editor-${bdc.id}`}
    className="elce-section-editor"
  >
    <div
      id={`elce-section-heading-${bdc.id}`}
      className="elce-section-heading"
    >
      <input
        id={`elce-section-title-${bdc.id}`}
        className="elce-section-title-input"
        aria-label="Titre de section"
        placeholder="Titre (facultatif)"
        value={section.title}
        mix={on<HTMLInputElement, 'input'>('input', (event) => state.adapters.get(bdc.id)?.updateTitle(event.currentTarget.value))}
      />
      <button
        id={`elce-section-delete-${bdc.id}`}
        className="elce-bdc-icon-button elce-bdc-icon-button--danger"
        type="button"
        aria-label="Supprimer le bloc texte"
        title="Supprimer le bloc texte"
        mix={on<HTMLButtonElement, 'click'>('click', () => actions.deleteSection(bdc.id))}
      >
        {renderLucideIcon(Trash2, `elce-section-delete-icon-${bdc.id}`, 16)}
      </button>
    </div>
    {renderToolbar(bdc.id, toolbarState, state.adapters, handle)}
    <div
      key={bdc.id}
      id={`elce-remix-section-editor-host-${bdc.id}`}
      className="elce-section-editor-host"
      data-rmx-preserve-dom={true}
      mix={ref((host, signal) => {
        const adapter = new SectionTiptapAdapter(host as HTMLElement, {
          bdcId: bdc.id,
          section,
          anchorOptions: {
            createFileDropTarget: (file) => actions.createSectionFileDropTarget(file, current.view.selectedPage?.id ?? page.id),
            createCatalogDropTarget: (reference) => actions.createSectionCatalogDropTarget(
              current.view.documentModel,
              reference,
              current.view.selectedPage?.id ?? page.id,
              bdc.id,
            ),
            resolveCard: (anchorBdcId) => resolveAnchorCard(current.view, anchorBdcId),
            onEditCard: state.onEditAnchorCard,
          },
          onChange: (change) => actions.submitSectionChange(bdc.id, change),
          onToolbarState: (next) => {
            const previous = state.toolbarStates.get(bdc.id) ?? EMPTY_SECTION_TOOLBAR_STATE
            if (sameToolbarState(previous, next)) return
            state.toolbarStates.set(bdc.id, next)
            if (!handle.signal.aborted) void handle.update()
          },
        })
        state.adapters.set(bdc.id, adapter)
        signal.addEventListener('abort', () => {
          if (state.adapters.get(bdc.id) === adapter) state.adapters.delete(bdc.id)
          state.toolbarStates.delete(bdc.id)
          adapter.destroy()
        }, { once: true })
      })}
    />
    {editingAnchorCard === undefined
      ? null
      : renderAnchorCardEditor(editingAnchorCard, view, cardActions, state.onCloseAnchorCard)}
  </section>
}

/** Renders the Section toolbar with Remix event mixins and Lucide assets. */
function renderToolbar(
  bdcId: string,
  state: SectionToolbarState,
  adapters: Map<string, SectionTiptapAdapter>,
  handle: RemixRenderHandle,
): RemixNode {
  const buttons = [
    { suffix: 'bold', label: 'Gras', icon: Bold, active: state.bold, run: (editor: SectionTiptapAdapter['editor']) => editor.chain().toggleBold().run() },
    { suffix: 'italic', label: 'Italique', icon: Italic, active: state.italic, run: (editor: SectionTiptapAdapter['editor']) => editor.chain().toggleItalic().run() },
    { suffix: 'underline', label: 'Souligné', icon: Underline, active: state.underline, run: (editor: SectionTiptapAdapter['editor']) => editor.chain().toggleUnderline().run() },
    { suffix: 'subscript', label: 'Indice', icon: Subscript, active: state.subscript, run: (editor: SectionTiptapAdapter['editor']) => editor.chain().toggleSubscript().run() },
    { suffix: 'superscript', label: 'Exposant', icon: Superscript, active: state.superscript, run: (editor: SectionTiptapAdapter['editor']) => editor.chain().toggleSuperscript().run() },
    ...SECTION_EDITOR_HEADING_LEVELS.map((level) => ({
      suffix: `heading-${level}`,
      label: `Titre H${level}`,
      icon: [Heading1, Heading2, Heading3, Heading4, Heading5, Heading6][level - 1]!,
      active: state.headingLevel === level,
      run: (editor: SectionTiptapAdapter['editor']) => editor.chain().toggleHeading({ level }).run(),
    })),
    { suffix: 'paragraph', label: 'Paragraphe', icon: Pilcrow, active: state.paragraph, run: (editor: SectionTiptapAdapter['editor']) => editor.chain().setParagraph().run() },
    { suffix: 'align-left', label: 'Aligner à gauche', icon: AlignLeft, active: state.textAlign === 'left', run: (editor: SectionTiptapAdapter['editor']) => editor.chain().setTextAlign('left').run() },
    { suffix: 'align-center', label: 'Centrer', icon: AlignCenter, active: state.textAlign === 'center', run: (editor: SectionTiptapAdapter['editor']) => editor.chain().setTextAlign('center').run() },
    { suffix: 'align-right', label: 'Aligner à droite', icon: AlignRight, active: state.textAlign === 'right', run: (editor: SectionTiptapAdapter['editor']) => editor.chain().setTextAlign('right').run() },
    { suffix: 'align-justify', label: 'Justifier', icon: AlignJustify, active: state.textAlign === 'justify', run: (editor: SectionTiptapAdapter['editor']) => editor.chain().setTextAlign('justify').run() },
  ]

  return <div
    id={`elce-section-toolbar-${bdcId}`}
    className="elce-section-toolbar"
    role="toolbar"
    aria-label="Mise en forme"
  >
    {buttons.map(({ suffix, label, icon, active, run }) => <button
      key={suffix}
      id={`elce-section-${suffix}-${bdcId}`}
      type="button"
      aria-label={label}
      aria-pressed={active}
      data-active={active}
      title={label}
      mix={on<HTMLButtonElement, 'click'>('click', () => {
        const editor = adapters.get(bdcId)?.editor
        if (editor === undefined) return
        run(editor)
        editor.commands.focus()
        if (!handle.signal.aborted) void handle.update()
      })}
    >
      {renderLucideIcon(icon, `elce-section-${suffix}-icon-${bdcId}`, 15)}
    </button>)}
  </div>
}

/** Renders the existing shared Card fields for an edited anchor. */
function renderAnchorCardEditor(
  card: Bdc,
  view: EditorViewModel,
  actions: ReturnType<EditorActionsFacade['createCardEditorActions']>,
  close: () => void,
): RemixNode {
  return <section
    id={`elce-anchor-card-editor-${card.id}`}
    className="elce-anchor-card-editor"
    aria-label="Modifier la carte ancrée"
  >
    <header
      id={`elce-anchor-card-editor-header-${card.id}`}
      className="elce-anchor-card-editor__header"
    >
      <h3
        id={`elce-anchor-card-editor-title-${card.id}`}
      >
        Carte
      </h3>
      <button
        id={`elce-anchor-card-editor-close-${card.id}`}
        className="elce-bdc-icon-button"
        type="button"
        aria-label="Fermer l’édition de la carte"
        title="Fermer"
        mix={on<HTMLButtonElement, 'click'>('click', close)}
      >
        {renderLucideIcon(X, `elce-anchor-card-editor-close-icon-${card.id}`, 14)}
      </button>
    </header>
    <RemixCardEditorFields
      bdc={card}
      mediaById={view.mediaById}
      actions={actions}
      idPrefix="elce-anchor-card"
      imageAspectRatio={null}
    />
  </section>
}

/** Resolves media presentation for an anchor from the current actor snapshot. */
function resolveAnchorCard(view: EditorViewModel, bdcId: string): ElceAnchorMediaPreview | null {
  const card = view.documentModel.bdcs.find((candidate) => candidate.id === bdcId)
  if (card?.type !== BDC_TYPE.CARD || card.card == null || card.card.mediaId === null) return null
  const media = view.documentModel.medias.find((candidate) => candidate.id === card.card?.mediaId)
  const source = view.mediaSources[card.card.mediaId]
  const type = media === undefined ? null : mediaTypeFromMimeType(media.mimeType)
  return media === undefined || source === undefined || type === null
    ? null
    : { source, type, layoutId: card.presetId as ElceAnchorMediaPreview['layoutId'] }
}

/** Compares finite toolbar state without allocating a reactive store. */
function sameToolbarState(left: SectionToolbarState, right: SectionToolbarState): boolean {
  return left.bold === right.bold
    && left.italic === right.italic
    && left.underline === right.underline
    && left.subscript === right.subscript
    && left.superscript === right.superscript
    && left.headingLevel === right.headingLevel
    && left.paragraph === right.paragraph
    && left.textAlign === right.textAlign
}
