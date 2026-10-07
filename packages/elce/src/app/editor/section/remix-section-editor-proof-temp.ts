import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Italic,
  Pilcrow,
  Subscript,
  Superscript,
  Trash2,
  Underline,
  X,
} from 'lucide-static'
import { on, ref, type Handle, type RemixNode } from 'remix/ui'
import { jsx } from 'remix/ui/jsx-runtime'
import { BDC_TYPE, SECTION_EDITOR_HEADING_LEVELS } from '../../../config/document-config'
import type { Bdc, Page } from '../../../domain/document/document-types'
import type { ElceAnchorMediaPreview } from '../../../domain/anchor/anchor-types'
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import { selectEditorViewModel } from '../../selectors/editor-view-model'
import type { EditorViewModel } from '../../selectors/editor-view-model'
import { EditorActionsFacade } from '../../facades/editor-actions-facade'
import { EditorContextProvider } from '../../remix/editor-context'
import { renderLucideIcon } from '../../remix/lucide-static-icon'
import { RemixCardEditorFields } from '../card/remix-card-editor-fields'
import { SectionTiptapAdapter } from './section-editor-tiptap-adapter'
import { EMPTY_SECTION_TOOLBAR_STATE } from './section-editor-tiptap'
import type { SectionToolbarState } from './section-editor-tiptap'

/** Temporarily exposes the real Section editor through the Remix SPA runtime. */
export function RemixSectionEditorProofTemp(handle: Handle) {
  const { controller, actions } = handle.context.get(EditorContextProvider)
  if (controller === null || actions === null) {
    throw new Error('The Remix Section proof requires the authoring actor.')
  }

  const current = { view: selectEditorViewModel(controller.getSnapshot()) }
  let editingAnchorBdcId: string | null = null
  const bindings = new Map<string, SectionTiptapAdapter>()
  const toolbarStates = new Map<string, SectionToolbarState>()

  handle.queueTask(() => {
    const subscription = controller.subscribe((snapshot) => {
      current.view = selectEditorViewModel(snapshot)
      for (const bdc of sectionBdcs(current.view)) {
        if (bdc.section === null) continue
        bindings.get(bdc.id)?.updateSection(bdc.section)
      }
      void handle.update()
    })
    handle.signal.addEventListener('abort', () => subscription.unsubscribe(), { once: true })
  })

  return () => renderSectionProof(current.view, actions, bindings, toolbarStates, (bdcId) => {
    editingAnchorBdcId = bdcId
    void handle.update()
  }, () => {
    editingAnchorBdcId = null
    void handle.update()
  }, () => editingAnchorBdcId, handle, current)
}

/** Selects valid Section BDCs from the currently selected page. */
function sectionBdcs(view: EditorViewModel): readonly Bdc[] {
  return view.selectedPageBdcs.filter((bdc) => bdc.type === BDC_TYPE.SECTION && bdc.section !== null)
}

/** Renders the selected page Sections with the real Tiptap and XState boundaries. */
function renderSectionProof(
  view: EditorViewModel,
  actions: EditorActionsFacade,
  bindings: Map<string, SectionTiptapAdapter>,
  toolbarStates: Map<string, SectionToolbarState>,
  openAnchorCard: (bdcId: string) => void,
  closeAnchorCard: () => void,
  selectedAnchorCard: () => string | null,
  handle: Handle,
  current: { view: EditorViewModel },
): RemixNode {
  const page = view.selectedPage
  const sections = sectionBdcs(view)
  return jsx('main', {
    id: 'elce-remix-section-proof',
    'data-remix-section-proof': 'active',
    children: [
      jsx('h1', { id: 'elce-remix-section-proof-title', children: 'Édition de Section dans Remix' }),
      jsx('p', { id: 'elce-remix-section-proof-page', children: `Page : ${page?.name ?? 'aucune'}` }),
      jsx('a', {
        id: 'elce-remix-section-proof-frame-link',
        href: '/?__remixSectionProof=1&frame=2',
        children: 'Recharger la frame',
      }),
      ...sections.map((bdc) => renderSection(
        bdc,
        page,
        view,
        actions,
        bindings,
        toolbarStates,
        toolbarStates.get(bdc.id) ?? EMPTY_SECTION_TOOLBAR_STATE,
        openAnchorCard,
        closeAnchorCard,
        selectedAnchorCard(),
        handle,
        current,
      )),
      sections.length === 0
        ? jsx('p', { id: 'elce-remix-section-proof-empty', children: 'La page sélectionnée ne contient aucune Section.' })
        : null,
    ],
  })
}

/** Renders one Section and mounts its Tiptap editor through Remix ref lifecycle. */
function renderSection(
  bdc: Bdc,
  page: Page | undefined,
  view: EditorViewModel,
  actions: EditorActionsFacade,
  bindings: Map<string, SectionTiptapAdapter>,
  toolbarStates: Map<string, SectionToolbarState>,
  toolbarState: SectionToolbarState,
  openAnchorCard: (bdcId: string) => void,
  closeAnchorCard: () => void,
  selectedAnchorCardId: string | null,
  handle: Handle,
  current: { view: EditorViewModel },
): RemixNode {
  const section = bdc.section
  if (section === null || page === undefined) return null
  const anchorCards = view.documentModel.bdcs.filter((candidate) => candidate.parentBdcId === bdc.id && candidate.type === BDC_TYPE.CARD)
  const editingAnchorCard = anchorCards.find((card) => card.id === selectedAnchorCardId)
  const cardActions = actions.createCardEditorActions(view.documentModel.bdcs)

  return jsx('section', {
    id: `elce-section-editor-${bdc.id}`,
    className: 'elce-section-editor',
    children: [
      jsx('div', {
        id: `elce-section-heading-${bdc.id}`,
        className: 'elce-section-heading',
        children: [
          jsx('input', {
            id: `elce-section-title-${bdc.id}`,
            className: 'elce-section-title-input',
            'aria-label': 'Titre de section',
            placeholder: 'Titre (facultatif)',
            value: section.title,
            mix: on<HTMLInputElement, 'input'>('input', (event) => bindings.get(bdc.id)?.updateTitle(event.currentTarget.value)),
          }),
          jsx('button', {
            id: `elce-section-delete-${bdc.id}`,
            className: 'elce-bdc-icon-button elce-bdc-icon-button--danger',
            type: 'button',
            'aria-label': 'Supprimer le bloc texte',
            title: 'Supprimer le bloc texte',
            mix: on<HTMLButtonElement, 'click'>('click', () => actions.deleteSection(bdc.id)),
            children: renderLucideIcon(Trash2, `elce-section-delete-icon-${bdc.id}`, 16),
          }),
        ],
      }),
      renderToolbar(bdc.id, toolbarState, bindings, handle),
      jsx('div', {
        id: `elce-remix-section-editor-host-${bdc.id}`,
        className: 'elce-section-editor-host',
        'data-rmx-preserve-dom': true,
        mix: ref((host, signal) => {
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
              onEditCard: openAnchorCard,
            },
            onChange: (change) => actions.submitSectionChange(bdc.id, change),
            onToolbarState: (next) => {
              const current = toolbarStates.get(bdc.id) ?? EMPTY_SECTION_TOOLBAR_STATE
              if (JSON.stringify(current) === JSON.stringify(next)) return
              toolbarStates.set(bdc.id, next)
              if (!handle.signal.aborted) void handle.update()
            },
          })
          bindings.set(bdc.id, adapter)
          signal.addEventListener('abort', () => {
            if (bindings.get(bdc.id) === adapter) bindings.delete(bdc.id)
            toolbarStates.delete(bdc.id)
            adapter.destroy()
          }, { once: true })
        }),
      }, bdc.id),
      editingAnchorCard === undefined
        ? null
        : renderAnchorCardEditor(editingAnchorCard, view, cardActions, closeAnchorCard),
    ],
  }, bdc.id)
}

/** Renders the Section toolbar with Remix event mixins and Lucide assets. */
function renderToolbar(
  bdcId: string,
  state: SectionToolbarState,
  bindings: Map<string, SectionTiptapAdapter>,
  handle: Handle,
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

  return jsx('div', {
    id: `elce-section-toolbar-${bdcId}`,
    className: 'elce-section-toolbar',
    role: 'toolbar',
    'aria-label': 'Mise en forme',
    children: buttons.map(({ suffix, label, icon, active, run }) => jsx('button', {
      id: `elce-section-${suffix}-${bdcId}`,
      type: 'button',
      'aria-label': label,
      'aria-pressed': active,
      'data-active': active,
      title: label,
      mix: on<HTMLButtonElement, 'click'>('click', () => {
        const editor = bindings.get(bdcId)?.editor
        if (editor === undefined) return
        run(editor)
        editor.commands.focus()
        if (!handle.signal.aborted) void handle.update()
      }),
      children: renderLucideIcon(icon, `elce-section-${suffix}-icon-${bdcId}`, 15),
    }, suffix)),
  })
}

/** Renders the existing shared Card fields for an edited anchor. */
function renderAnchorCardEditor(
  card: Bdc,
  view: EditorViewModel,
  actions: ReturnType<EditorActionsFacade['createCardEditorActions']>,
  close: () => void,
): RemixNode {
  return jsx('section', {
    id: `elce-anchor-card-editor-${card.id}`,
    className: 'elce-anchor-card-editor',
    'aria-label': 'Modifier la carte ancrée',
    children: [
      jsx('header', {
        id: `elce-anchor-card-editor-header-${card.id}`,
        className: 'elce-anchor-card-editor__header',
        children: [
          jsx('h3', { id: `elce-anchor-card-editor-title-${card.id}`, children: 'Carte' }),
          jsx('button', {
            id: `elce-anchor-card-editor-close-${card.id}`,
            className: 'elce-bdc-icon-button',
            type: 'button',
            'aria-label': 'Fermer l’édition de la carte',
            title: 'Fermer',
            mix: on<HTMLButtonElement, 'click'>('click', close),
            children: renderLucideIcon(X, `elce-anchor-card-editor-close-icon-${card.id}`, 14),
          }),
        ],
      }),
      jsx(RemixCardEditorFields, {
        bdc: card,
        mediaById: view.mediaById,
        actions,
        idPrefix: 'elce-anchor-card',
        imageAspectRatio: null,
      }),
    ],
  })
}

/** Resolves media presentation for one Card anchor from the current document. */
function resolveAnchorCard(view: EditorViewModel, bdcId: string): ElceAnchorMediaPreview | null {
  const card = view.documentModel.bdcs.find((candidate) => candidate.id === bdcId)
  if (card?.type !== BDC_TYPE.CARD || card.card === null || card.card === undefined || card.card.mediaId === null) return null
  const media = view.documentModel.medias.find((candidate) => candidate.id === card.card?.mediaId)
  const source = view.mediaSources[card.card.mediaId]
  const type = media === undefined ? null : mediaTypeFromMimeType(media.mimeType)
  return media === undefined || source === undefined || type === null
    ? null
    : { source, type, layoutId: card.presetId as ElceAnchorMediaPreview['layoutId'] }
}
