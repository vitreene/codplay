import { Bold, Italic, Underline, Subscript, Superscript, Pilcrow, AlignLeft, AlignCenter, AlignRight, AlignJustify, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Trash2, X } from 'lucide-static'
import { on, ref, type RemixNode } from 'remix/ui'

import { ANCHOR } from '../../../anchoring/anchor-config'
import { SECTION_EDITOR_HEADING_LEVELS } from '../section-config'
import { SECTION_BDC_TYPE } from '../section-config'
import { CARD_BDC_TYPE, CARD_PRESET_ID } from '../../card/card-config'
import { STATISTICAL_GRAPH_BDC_TYPE } from '../../statistical-graph/statistical-graph-config'
import type { CardLayoutId } from '../../card/card-config'
import type { ResourceBdc, ResourceDocumentData } from '../../../document/resource-document-types'
import type { ContentPage, PageId } from '../../../../core/document/content-document-types'
import type { RichTextNode } from '../domain/section-types'
import type { ElceAnchorCardPreview } from '../../../anchoring/domain/anchor-types'
import type { ElceSectionChange } from '../../../anchoring/domain/anchor-types'
import type { ElceCatalogDropTarget, ElceCatalogReference } from '../../../../core/catalog/catalog-types'
import type { AppearanceTarget } from '../../../../domain/appearance/appearance-target-types'
import { mediaTypeFromMimeType } from '../../../../domain/media/media-resource-service'
import type { MediaType } from '../../../../core/media/media-config'
import type { ElceCardPresetBuilder } from '../../../../core/presets/card-preset-builder'
import type { ElceCardEditorActions } from '../../card/authoring/card-facade-types'
import type { StatisticalGraphEditorActions } from '../../statistical-graph/authoring/statistical-graph-facade-types'
import type { RemixRenderHandle } from '../../../../app/remix/remix-render-handle'
import { renderLucideIcon } from '../../../../core/authoring/lucide-static-icon'
import { RemixCardEditorFields } from '../../card/authoring/remix-card-editor-fields'
import { SectionTiptapAdapter } from './section-editor-tiptap-adapter'
import { EMPTY_SECTION_TOOLBAR_STATE } from './section-editor-tiptap'
import type { SectionToolbarState } from './section-editor-tiptap'
import type { SectionEditorSession } from './section-editor-session'
import type { SectionSelection } from './section-selection-types'
import type { SectionTextFeature } from './section-editor-tiptap-adapter'
import { renderRemixStatisticalGraphEditor } from '../../statistical-graph/authoring/remix-statistical-graph-editor'
import { anchorNameFor } from '../../../../domain/anchor/anchor-position'
import { renderAppearanceTrigger } from '../../../../core/authoring/appearance-trigger'

export type SectionEditorMediaById = Readonly<Record<string, Readonly<{ name: string; type: MediaType; source: string | null }>>>

export interface SectionEditorData {
  readonly document: ResourceDocumentData
  readonly selectedPageId: PageId | null
  readonly historySelection: SectionSelection | null
  readonly mediaSources: Readonly<Record<string, string>>
  readonly mediaById: SectionEditorMediaById
}

export interface SectionEditorActions {
  readonly createCardEditorActions: (bdcs: readonly ResourceBdc[]) => ElceCardEditorActions
  readonly createStatisticalGraphEditorActions: (
    bdcId: string,
    content: NonNullable<ResourceBdc['statisticalGraph']>,
  ) => StatisticalGraphEditorActions
  readonly deleteSection: (bdcId: string) => void
  readonly createSectionFileDropTarget: (
    file: File,
    pageId: PageId,
  ) => import('../../../anchoring/domain/anchor-types').ElceAnchorDropTarget | null
  readonly createSectionCatalogDropTarget: (
    document: ResourceDocumentData,
    reference: ElceCatalogReference,
    pageId: PageId | null,
    sectionBdcId: string,
  ) => ElceCatalogDropTarget | null
  readonly submitSectionChange: (
    bdcId: string,
    change: ElceSectionChange,
    selection?: import('../../../anchoring/authoring/anchor-drop-facade').SectionChangeSelection,
  ) => void
}

export interface RemixSectionEditorBindings {
  readonly session: SectionEditorSession
  readonly selectedAnchorBdcId: string | null
  readonly onEditAnchorBdc: (bdcId: string) => void
  readonly onCloseAnchorBdc: () => void
  readonly onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
  readonly textFeature?: SectionTextFeature
  readonly textFieldAttributes?: Readonly<Record<string, string>>
  readonly presetBuilder: ElceCardPresetBuilder
  readonly appearanceForBdc: (bdcId: string) => Readonly<{ className: string; styleSheet: string }>
  readonly handle: RemixRenderHandle
  readonly current: { data: SectionEditorData }
}

/** Renders one production Section with the shared Tiptap and anchor adapters. */
export function renderRemixSectionEditor(
  bdc: ResourceBdc,
  page: ContentPage,
  data: SectionEditorData,
  actions: SectionEditorActions,
  state: RemixSectionEditorBindings,
): RemixNode {
  const section = bdc.section
  if (bdc.type !== SECTION_BDC_TYPE || section === null) return null
  const anchorIllustrations = data.document.bdcs.filter((candidate) => candidate.parentBdcId === bdc.id
    && (candidate.type === CARD_BDC_TYPE || candidate.type === STATISTICAL_GRAPH_BDC_TYPE))
  const editingAnchorBdc = anchorIllustrations.find((illustration) => illustration.id === state.selectedAnchorBdcId)
  const editingAnchorPartId = editingAnchorBdc === undefined
    ? null
    : findAnchorPartId(section.content.content, editingAnchorBdc.id)
  const cardActions = actions.createCardEditorActions(data.document.bdcs)
  const toolbarState = state.session.toolbarStates.get(bdc.id) ?? EMPTY_SECTION_TOOLBAR_STATE
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
        placeholder="Titre"
        value={section.title}
        {...state.textFieldAttributes}
        mix={on<HTMLInputElement, 'input'>('input', (event) => state.session.adapters.get(bdc.id)?.updateTitle(event.currentTarget.value))}
      />
      <div
        id={`elce-section-header-actions-${bdc.id}`}
        className="elce-bdc-header-actions"
      >
        {renderAppearanceTrigger({
          id: `elce-section-style-${bdc.id}`,
          target: { kind: 'bdc', bdcId: bdc.id },
          label: `Ouvrir le style de la section ${section.title.trim() || ''}`,
          onOpen: state.onOpenAppearanceTarget,
          className: 'elce-appearance-trigger elce-bdc-style-trigger',
        })}
        <button
          id={`elce-section-delete-${bdc.id}`}
          className="elce-bdc-icon-button elce-bdc-icon-button--danger"
          type="button"
          aria-label="Supprimer le bloc texte"
          title="Supprimer le bloc texte"
          mix={on<HTMLButtonElement, 'click'>('click', () => actions.deleteSection(bdc.id))}
        >
          {renderLucideIcon(Trash2, `elce-section-delete-icon-${bdc.id}`)}
        </button>
      </div>
    </div>
    {renderToolbar(bdc.id, toolbarState, state.session.adapters, handle)}
    <div
      key={bdc.id}
      id={`elce-remix-section-editor-host-${bdc.id}`}
      className="elce-section-editor-host"
      data-rmx-preserve-dom={true}
      mix={ref((host, signal) => {
        const adapter = new SectionTiptapAdapter(host as HTMLElement, {
          bdcId: bdc.id,
          section,
          textFeature: state.textFeature,
          anchorOptions: {
            presetBuilder: state.presetBuilder,
            createFileDropTarget: (file) => actions.createSectionFileDropTarget(file, current.data.selectedPageId ?? page.id),
            onCardMediaFileDrop: (targetBdcId, file) => cardActions.importMediaFile(targetBdcId, file),
            createCatalogDropTarget: (reference) => actions.createSectionCatalogDropTarget(
              current.data.document,
              reference,
              current.data.selectedPageId ?? page.id,
              bdc.id,
            ),
            resolveCard: (anchorBdcId) => resolveAnchorCard(current.data, anchorBdcId, state.appearanceForBdc),
            onEditCard: state.onEditAnchorBdc,
          },
          onChange: (change, selection) => actions.submitSectionChange(bdc.id, change, selection),
          onToolbarState: (next) => {
            const previous = state.session.toolbarStates.get(bdc.id) ?? EMPTY_SECTION_TOOLBAR_STATE
            if (sameToolbarState(previous, next)) return
            state.session.toolbarStates.set(bdc.id, next)
            if (!handle.signal.aborted) void handle.update()
          },
        })
        state.session.register(bdc.id, adapter)
        if (current.data.historySelection?.sectionBdcId === bdc.id) {
          adapter.restoreSelection(current.data.historySelection)
        }
        signal.addEventListener('abort', () => {
          state.session.unregister(bdc.id, adapter)
        }, { once: true })
      })}
    />
    {editingAnchorBdc === undefined
      ? null
      : renderAnchorCardEditor(
        editingAnchorBdc,
        data,
        cardActions,
        state.onCloseAnchorBdc,
        actions,
        editingAnchorPartId,
        state.onOpenAppearanceTarget,
        state.textFieldAttributes,
      )}
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
    mix={on<HTMLDivElement, 'mousedown'>('mousedown', (event) => event.preventDefault())}
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
      {renderLucideIcon(icon, `elce-section-${suffix}-icon-${bdcId}`)}
    </button>)}
  </div>
}

/** Renders the existing shared Card fields for an edited anchor. */
function renderAnchorCardEditor(
  card: ResourceBdc,
  data: SectionEditorData,
  cardActions: ElceCardEditorActions,
  close: () => void,
  editorActions: SectionEditorActions,
  anchorPartId: string | null,
  onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void,
  textFieldAttributes?: Readonly<Record<string, string>>,
): RemixNode {
  const positionStyle = anchorPartId === null ? undefined : {
    position: 'absolute' as const,
    positionAnchor: anchorNameFor(`${anchorPartId}-editor-frame`),
    insetInlineStart: 'anchor(left)',
    insetBlockStart: 'anchor(top)',
    marginBlockStart: 0,
    zIndex: 4,
  }
  if (card.type === STATISTICAL_GRAPH_BDC_TYPE && card.statisticalGraph != null) {
    return <section
      id={`elce-anchor-card-editor-${card.id}`}
      className="elce-anchor-card-editor"
      data-anchor-part-id={anchorPartId ?? undefined}
      style={positionStyle}
      aria-label="Modifier le graphe ancré"
    >
      <header
        id={`elce-anchor-card-editor-header-${card.id}`}
        className="elce-anchor-card-editor__header"
      >
        <h3
          id={`elce-anchor-card-editor-title-${card.id}`}
        >
          Graphe
        </h3>
        {renderAppearanceTrigger({
          id: `elce-anchor-graph-style-${card.id}`,
          target: { kind: 'bdc', bdcId: card.id },
          label: 'Ouvrir le style du graphe',
          onOpen: onOpenAppearanceTarget,
          className: 'elce-appearance-trigger elce-anchor-appearance-trigger',
        })}
        <button
          id={`elce-anchor-card-editor-close-${card.id}`}
          className="elce-bdc-icon-button"
          type="button"
          aria-label="Fermer l’édition du graphe"
          title="Fermer"
          mix={on<HTMLButtonElement, 'click'>('click', close)}
        >
          {renderLucideIcon(X, `elce-anchor-card-editor-close-icon-${card.id}`)}
        </button>
      </header>
      {renderRemixStatisticalGraphEditor(
        card,
        editorActions.createStatisticalGraphEditorActions(card.id, card.statisticalGraph),
        undefined,
        undefined,
        undefined,
        textFieldAttributes,
      )}
    </section>
  }
  return <section
    id={`elce-anchor-card-editor-${card.id}`}
    className="elce-anchor-card-editor"
    data-anchor-part-id={anchorPartId ?? undefined}
    style={positionStyle}
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
      {renderAppearanceTrigger({
        id: `elce-anchor-card-style-${card.id}`,
        target: { kind: 'bdc', bdcId: card.id },
        label: `Ouvrir le style de la carte ${card.card?.title.trim() || ''}`,
        onOpen: onOpenAppearanceTarget,
        className: 'elce-appearance-trigger elce-anchor-appearance-trigger',
      })}
      <button
        id={`elce-anchor-card-editor-close-${card.id}`}
        className="elce-bdc-icon-button"
        type="button"
        aria-label="Fermer l’édition de la carte"
        title="Fermer"
        mix={on<HTMLButtonElement, 'click'>('click', close)}
      >
        {renderLucideIcon(X, `elce-anchor-card-editor-close-icon-${card.id}`)}
      </button>
    </header>
    <RemixCardEditorFields
      bdc={card}
      mediaById={data.mediaById}
      actions={cardActions}
      textFieldAttributes={textFieldAttributes}
      idPrefix="elce-anchor-card"
      imageAspectRatio={null}
    />
  </section>
}

/** Finds the selected BDC's saved insertion point in the Section rich-text tree. */
function findAnchorPartId(nodes: readonly RichTextNode[], bdcId: string): string | null {
  for (const node of nodes) {
    if (node.type === ANCHOR.NODE_NAME && node.attrs?.bdcId === bdcId && typeof node.attrs.partId === 'string') {
      return node.attrs.partId
    }
    const nestedPartId = node.content === undefined ? null : findAnchorPartId(node.content, bdcId)
    if (nestedPartId !== null) return nestedPartId
  }
  return null
}

/** Resolves the Card layout, text and available media from the current actor snapshot. */
function resolveAnchorCard(
  data: SectionEditorData,
  bdcId: string,
  appearanceForBdc: RemixSectionEditorBindings['appearanceForBdc'],
): ElceAnchorCardPreview | null {
  const card = data.document.bdcs.find((candidate) => candidate.id === bdcId)
  if (card?.type === STATISTICAL_GRAPH_BDC_TYPE && card.statisticalGraph != null) {
    return {
      kind: 'statistical-graph',
      content: card.statisticalGraph,
      layoutId: card.presetId as Extract<ElceAnchorCardPreview, { kind: 'statistical-graph' }>['layoutId'],
    }
  }
  if (card?.type !== CARD_BDC_TYPE || card.card == null) return null
  const mediaMetadata = card.card.mediaId === null
    ? undefined
    : data.document.medias.find((candidate) => candidate.id === card.card?.mediaId)
  const source = card.card.mediaId === null ? undefined : data.mediaSources[card.card.mediaId]
  const mediaType = mediaMetadata === undefined ? null : mediaTypeFromMimeType(mediaMetadata.mimeType)
  const usesImageTitle = card.presetId === CARD_PRESET_ID.IMAGE_TITLE
  const appearance = usesImageTitle ? appearanceForBdc(card.id) : undefined
  return {
    content: card.card,
    layoutId: card.presetId as CardLayoutId,
    media: mediaMetadata === undefined || source === undefined || mediaType === null
      ? null
      : { source, type: mediaType },
    ...(usesImageTitle ? {
      appearanceClassName: appearance?.className,
      appearanceStyleSheet: appearance?.styleSheet,
    } : {}),
  }
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
