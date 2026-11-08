import { on, ref, type RemixNode } from 'remix/component'
import { CircleAlert, FileText, Folder, ListChecks, Plus, Trash2 } from 'lucide-static'
import type { RemixRenderHandle } from '../../../app/remix/remix-render-handle'
import { createStableId } from '../../../core/document/stable-id'
import { authoredTextToPlainText } from '../../../core/document/rich-text-utils'
import type { ResourceTextFieldFeature, ResourceTextFieldOptions } from '../../../core/authoring/resource-text-field-feature'
import { renderPageEditorView } from '../../../core/authoring/page/page-editor-view'
import { renderEditorFrame } from '../../../core/authoring/layout/editor-frame'
import type { EditorPanelName, EditorPanelVisibility } from '../../../core/authoring/layout/editor-frame'
import { renderEditorPanelReduceButton } from '../../../core/authoring/layout/editor-panel-controls.tsx'
import { renderLucideIcon } from '../../../core/authoring/lucide-static-icon'
import type { ResourceBdc } from '../../../resources/document/resource-document-types'
import { renderQuestionEditor } from '../../../resources/bdcs/question/authoring/question-editor.tsx'
import { renderRemixCardEditor } from '../../../resources/bdcs/card/authoring/remix-card-editor'
import { SectionEditorSession } from '../../../resources/bdcs/section/authoring/section-editor-session'
import { SectionTiptapAdapter } from '../../../resources/bdcs/section/authoring/section-editor-tiptap-adapter'
import {
  renderSectionEditorToolbar,
} from '../../../resources/bdcs/section/authoring/section-editor-remix-view'
import { EMPTY_SECTION_TOOLBAR_STATE } from '../../../resources/bdcs/section/authoring/section-editor-tiptap'
import { DOT_LEADER_STYLE_SHEET } from '../../../resources/bdcs/section/dot-leader/dot-leader-style'
import { SECTION_BDC_TYPE } from '../../../resources/bdcs/section/section-config'
import { QUESTION_BDC_TYPE } from '../../../resources/bdcs/question/question-config'
import { CARD_BDC_TYPE } from '../../../resources/bdcs/card/card-config'
import { FLUX_PAGE_ICON } from '../../../resources/pages/flux/flux-page-icon'
import { DIAPO_PAGE_ICON } from '../../../resources/pages/diapo/diapo-page-icon'
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import type { SupportedMediaType } from '../../../domain/media/media-resource-service'
import type { QuizHuntChapter, QuizHuntDocument, QuizHuntPage } from '../document/quiz-hunt-document-types'
import { getQuizHuntExtraTriggerCandidates } from '../document/quiz-hunt-extra-trigger'
import { createQuizHuntGameDraw } from '../reading/quiz-hunt-game-draw'
import type { QuizHuntEditorFacade } from './quiz-hunt-editor-facade'
import type { QuizHuntSelection } from './quiz-hunt-controller'
import { SUMMARY_PROFILE_ACCESS_ICON } from '../../../app/remix/summary-profile-access-icon'

type QuizHuntMediaById = Readonly<Record<string, Readonly<{ name: string; type: SupportedMediaType; source: string | null }>>>

export interface QuizHuntWorkspaceView {
  readonly document: QuizHuntDocument
  readonly selection: QuizHuntSelection
  readonly historySelection: QuizHuntSelection | null
  readonly mediaSources: Readonly<Record<string, string>>
  readonly importPending: boolean
  readonly editable: boolean
  readonly exportBusy: boolean
  readonly exportKind: 'sighty' | 'scorm' | null
  readonly exportError: string | null
  readonly exportNotice: string | null
  readonly previewError: string | null
  readonly onPreview: () => void
}

export interface QuizHuntWorkspaceInteraction {
  readonly panelVisibility: EditorPanelVisibility
  readonly summarySettingsOpen: boolean
  readonly introductionFolderOpen: boolean
  readonly resultPage: QuizHuntResultPage
  readonly getDraggedBdcId: () => string | null
  readonly onSetDraggedBdcId: (bdcId: string | null) => void
  readonly dropTarget: string | null
  readonly onSetDropTarget: (targetId: string | null) => void
  readonly isAddContentMenuOpen: boolean
  readonly onSetAddContentMenuOpen: (isOpen: boolean) => void
  readonly trashAnimationToken: number
  readonly onTrashDropSuccess: () => void
  readonly onSetSummarySettingsOpen: (open: boolean) => void
  readonly onSetIntroductionFolderOpen: (open: boolean) => void
  readonly onSelectIntroductionPage: (pageId: string) => void
  readonly onSelectResultPage: (page: QuizHuntResultPage) => void
  readonly onSetPanelVisibility: (panel: EditorPanelName, open: boolean, triggerId?: string) => void
}

export type QuizHuntResultPage = 'overview' | 'success' | 'failure' | null

/** Renders the Quiz Hunt outline, selected page, and author settings. */
export function renderQuizHuntWorkspace(
  view: QuizHuntWorkspaceView,
  actions: QuizHuntEditorFacade,
  sectionSession: SectionEditorSession,
  handle: RemixRenderHandle,
  interaction: QuizHuntWorkspaceInteraction,
): RemixNode {
  const selectedPage = view.document.pages.find((page) => page.id === view.selection.pageId)
  const selectedChapter = view.document.chapters.find((chapter) => (
    chapter.id === (view.selection.chapterId ?? selectedPage?.chapterId)
  ))
  const summarySettingsOpen = interaction.summarySettingsOpen
  const selectedBdcs = selectedPage === undefined
    ? []
    : selectedPage.bdcIds.flatMap((bdcId) => view.document.bdcs.filter((bdc) => bdc.id === bdcId))
  const mediaById: QuizHuntMediaById = Object.fromEntries(view.document.medias.flatMap((media) => {
    const type = mediaTypeFromMimeType(media.mimeType)
    return type === null ? [] : [[media.id, { name: media.name, type, source: view.mediaSources[media.id] ?? null }]]
  }))

  return renderEditorFrame({
    leftPanel: renderQuizHuntScenarioPanel(view, actions, interaction),
    center: interaction.resultPage !== null
      ? <div id="quiz-hunt-result-page-host" className="elce-remix-center-column">
        {interaction.resultPage === 'overview'
          ? renderResultFolderLanding()
          : renderResultPage(view.document, interaction.resultPage, actions, mediaById)}
      </div>
      : interaction.introductionFolderOpen
        ? <div id="quiz-hunt-introduction-page-host" className="elce-remix-center-column">
          {renderIntroductionFolderLanding()}
        </div>
      : summarySettingsOpen
      ? <div id="quiz-hunt-summary-host" className="elce-remix-center-column">
        {renderSummaryWorkspace(view.document, actions)}
      </div>
      : selectedPage === undefined
        ? <div id="elce-remix-chapter-settings-host" className="elce-remix-center-column">
          {renderChapterLanding(selectedChapter, actions)}
        </div>
        : <div id="elce-remix-page-editor-host-container" className="elce-remix-page-editor-host elce-remix-center-column">
          {renderPage(selectedPage, selectedChapter, selectedBdcs, view, actions, sectionSession, handle, interaction)}
        </div>,
    rightPanel: renderQuizHuntPropertiesPanel(view, selectedPage, selectedChapter, actions, interaction),
    workspaceAction: null,
    workspaceOverlay: null,
    panelVisibility: interaction.panelVisibility,
    visible: view.editable,
    editable: view.editable,
    onSetPanelVisibility: interaction.onSetPanelVisibility,
    propertiesPanelLabel: 'Réglages',
    onPreview: view.onPreview,
    previewError: view.previewError,
    exportBusy: view.exportBusy,
    exportKind: view.exportKind,
    exportError: view.exportError,
    exportNotice: view.exportNotice,
  })
}

/** Renders Quiz Hunt's Learning-style outline with the summary and nested bank pages. */
function renderQuizHuntScenarioPanel(
  view: QuizHuntWorkspaceView,
  actions: QuizHuntEditorFacade,
  interaction: QuizHuntWorkspaceInteraction,
): RemixNode {
  const chapters = view.document.scenarioEntries.flatMap((entry) => entry.kind === 'chapter'
    ? view.document.chapters.filter((chapter) => chapter.id === entry.chapterId && chapter.type !== 'introduction')
    : [])
  const introductionChapter = view.document.chapters.find((chapter) => chapter.type === 'introduction')
  const summaryPage = view.document.pages.find((page) => page.type === 'summary')
  const summaryPageSelected = summaryPage?.id === view.selection.pageId
  const summarySelected = interaction.resultPage === null
    && !interaction.introductionFolderOpen
    && (interaction.summarySettingsOpen || summaryPageSelected)
  return <section
    id="elce-outline"
    className="elce-panel elce-outline quiz-hunt-outline"
    data-panel-open={interaction.panelVisibility.outline}
    aria-labelledby="elce-outline-title"
  >
    <div id="elce-outline-reduce-row" className="elce-panel-reduce-row">
      {renderEditorPanelReduceButton('outline', () => interaction.onSetPanelVisibility('outline', false))}
    </div>
    <header id="elce-outline-heading" className="elce-panel-heading">
      <h1 id="elce-outline-title">Scénario</h1>
    </header>
    <div id="elce-outline-scroll-content" className="elce-outline-scroll-content">
      <p id="elce-document-name">{view.document.name}</p>
      <ol id="quiz-hunt-root-entry-list" className="elce-outline-list">
        <li id="quiz-hunt-scenario-summary-entry">
          <button
            id="quiz-hunt-scenario-summary-select"
            className={summarySelected ? 'elce-page-button elce-page-button--selected elce-scenario-summary-page' : 'elce-page-button elce-scenario-summary-page'}
            type="button"
            aria-pressed={summarySelected}
            mix={on<HTMLButtonElement, 'click'>('click', () => interaction.onSetSummarySettingsOpen(summaryPageSelected || !interaction.summarySettingsOpen))}
          >
            {renderLucideIcon(SUMMARY_PROFILE_ACCESS_ICON, 'quiz-hunt-scenario-summary-icon')}
            <span id="quiz-hunt-scenario-summary-name">{summaryPage?.name ?? 'Sommaire'}</span>
          </button>
        </li>
        {renderIntroductionFolder(view, introductionChapter, actions, interaction)}
        {chapters.map((chapter) => renderChapterItem(chapter, view, actions, interaction))}
        {renderResultFolder(interaction)}
      </ol>
    </div>
  </section>
}

/** Renders the optional Introduction chapter and its normal game content page. */
function renderIntroductionFolder(
  view: QuizHuntWorkspaceView,
  chapter: QuizHuntChapter | undefined,
  actions: QuizHuntEditorFacade,
  interaction: QuizHuntWorkspaceInteraction,
): RemixNode {
  const page = chapter?.pageIds.flatMap((pageId) => view.document.pages.filter((candidate) => candidate.id === pageId))[0]
  const selected = page?.id === view.selection.pageId || (page === undefined && interaction.introductionFolderOpen)
  return <li id="quiz-hunt-introduction-folder">
    <div id="quiz-hunt-introduction-folder-heading" className="elce-outline-item-heading">
      <button
        id="quiz-hunt-introduction-folder-select"
        className={selected ? 'elce-chapter-select elce-chapter-select--selected' : 'elce-chapter-select'}
        type="button"
        aria-pressed={selected}
        mix={on<HTMLButtonElement, 'click'>('click', () => page === undefined
          ? interaction.onSetIntroductionFolderOpen(true)
          : interaction.onSelectIntroductionPage(page.id))}
      >
        {renderLucideIcon(Folder, 'quiz-hunt-introduction-folder-icon')}
        <strong id="quiz-hunt-introduction-folder-name">Introduction</strong>
      </button>
      {page === undefined
        ? <div id="quiz-hunt-introduction-folder-actions" className="elce-outline-item-actions">
          <button
            id="quiz-hunt-introduction-page-create"
            className="elce-icon-action elce-location-page-action"
            type="button"
            aria-label="Ajouter une page d’introduction"
            title="Ajouter une page d’introduction"
            mix={on<HTMLButtonElement, 'click'>('click', () => createPage(actions, null, 'Introduction', interaction))}
          >{renderLucideIcon(Plus, 'quiz-hunt-introduction-page-create-icon')}</button>
        </div>
        : null}
    </div>
    {page === undefined ? null : <ul id="quiz-hunt-introduction-page-list" className="elce-outline-list">
      <li id={`quiz-hunt-introduction-page-row-${page.id}`}>
        <div
          id={`quiz-hunt-introduction-page-heading-${page.id}`}
          className={selected
            ? 'elce-page-row quiz-hunt-bank-page-row quiz-hunt-bank-page-row--selected'
            : 'elce-page-row quiz-hunt-bank-page-row'}
        >
        <button
          id={`quiz-hunt-introduction-page-select-${page.id}`}
          className={selected ? 'elce-page-button elce-page-button--selected' : 'elce-page-button'}
          type="button"
          aria-pressed={selected}
          mix={on<HTMLButtonElement, 'click'>('click', () => interaction.onSelectIntroductionPage(page.id))}
        >{page.name}</button>
        <div id={`quiz-hunt-introduction-page-actions-${page.id}`} className="elce-page-actions">
          <button
            id={`quiz-hunt-introduction-page-delete-${page.id}`}
            className="elce-danger-action"
            type="button"
            aria-label="Supprimer la page d’introduction"
            title="Supprimer la page d’introduction"
            mix={on<HTMLButtonElement, 'click'>('click', () => actions.deletePage(page.id))}
          >{renderLucideIcon(Trash2, `quiz-hunt-introduction-page-delete-icon-${page.id}`)}</button>
        </div>
        </div>
      </li>
    </ul>}
  </li>
}

/** Renders the two fixed result-card editors as pages in their authoring folder. */
function renderResultFolder(interaction: QuizHuntWorkspaceInteraction): RemixNode {
  const entries = [
    { id: 'success', label: 'Réussite' },
    { id: 'failure', label: 'Échec' },
  ] as const
  return <li id="quiz-hunt-result-folder">
    <div id="quiz-hunt-result-folder-heading" className="elce-outline-item-heading">
      <button
        id="quiz-hunt-result-folder-select"
        className={interaction.resultPage === 'overview' ? 'elce-chapter-select elce-chapter-select--selected' : 'elce-chapter-select'}
        type="button"
        aria-pressed={interaction.resultPage === 'overview'}
        mix={on<HTMLButtonElement, 'click'>('click', () => interaction.onSelectResultPage('overview'))}
      >
        {renderLucideIcon(Folder, 'quiz-hunt-result-folder-icon')}
        <strong id="quiz-hunt-result-folder-name">Résultat</strong>
      </button>
    </div>
    <ul id="quiz-hunt-result-page-list" className="elce-outline-list">
      {entries.map((entry) => <li key={entry.id} id={`quiz-hunt-result-page-row-${entry.id}`}>
        <button
          id={`quiz-hunt-result-page-select-${entry.id}`}
          className={interaction.resultPage === entry.id ? 'elce-page-button elce-page-button--selected' : 'elce-page-button'}
          type="button"
          aria-pressed={interaction.resultPage === entry.id}
          mix={on<HTMLButtonElement, 'click'>('click', () => interaction.onSelectResultPage(entry.id))}
        >{entry.label}</button>
      </li>)}
    </ul>
  </li>
}

/** Renders one bank as a chapter with its pages nested below the chapter row. */
function renderChapterItem(
  chapter: QuizHuntChapter,
  view: QuizHuntWorkspaceView,
  actions: QuizHuntEditorFacade,
  interaction: QuizHuntWorkspaceInteraction,
): RemixNode {
  const isSelected = view.selection.chapterId === chapter.id
  const chapterName = chapter.name
  const createPageLabel = chapter.type === 'finals' ? 'Ajouter une finale' : 'Ajouter une question'
  return <li id={`quiz-hunt-chapter-${chapter.id}`}>
    <div id={`quiz-hunt-chapter-heading-${chapter.id}`} className="elce-outline-item-heading">
      <button
        id={`quiz-hunt-chapter-select-${chapter.id}`}
        className={isSelected ? 'elce-chapter-select elce-chapter-select--selected' : 'elce-chapter-select'}
        type="button"
        aria-pressed={isSelected}
        mix={on<HTMLButtonElement, 'click'>('click', () => {
          interaction.onSetSummarySettingsOpen(false)
          actions.selectChapter(chapter.id)
        })}
      >
        {renderLucideIcon(Folder, `quiz-hunt-chapter-icon-${chapter.id}`)}
        <strong id={`quiz-hunt-chapter-name-${chapter.id}`}>{chapterName}</strong>
      </button>
      <div id={`quiz-hunt-chapter-actions-${chapter.id}`} className="elce-outline-item-actions">
        <button
          id={`quiz-hunt-bank-page-create-${chapter.id}`}
          className="elce-icon-action elce-location-page-action"
          type="button"
          aria-label={createPageLabel}
          title={createPageLabel}
          mix={on<HTMLButtonElement, 'click'>('click', () => createPage(actions, chapter.id, chapter.type === 'finals' ? 'Nouvelle finale' : 'Nouvelle question', interaction))}
        >{renderLucideIcon(Plus, `quiz-hunt-bank-page-create-icon-${chapter.id}`)}</button>
      </div>
    </div>
    {renderChapterPages(chapter, view, actions, interaction)}
  </li>
}

/** Renders a bank's pages in their persisted order without reorder controls. */
function renderChapterPages(
  chapter: QuizHuntChapter,
  view: QuizHuntWorkspaceView,
  actions: QuizHuntEditorFacade,
  interaction: QuizHuntWorkspaceInteraction,
): RemixNode {
  return <ul id={`quiz-hunt-bank-page-list-${chapter.id}`} className="elce-outline-list">
    {chapter.pageIds.map((pageId) => {
      const page = view.document.pages.find((candidate) => candidate.id === pageId)
      if (page === undefined) return null
      const active = view.selection.pageId === page.id
      const group = view.document.settings.groups.find((candidate) => candidate.id === page.colorId)
      return <li key={page.id} id={`quiz-hunt-bank-page-row-${page.id}`}>
        <div
          id={`quiz-hunt-bank-page-heading-${page.id}`}
          className={active
            ? 'elce-page-row quiz-hunt-bank-page-row quiz-hunt-bank-page-row--selected'
            : 'elce-page-row quiz-hunt-bank-page-row'}
        >
          <button
            id={`quiz-hunt-bank-page-select-${page.id}`}
            className={active ? 'elce-page-button elce-page-button--selected' : 'elce-page-button'}
            type="button"
            aria-pressed={active}
            mix={on<HTMLButtonElement, 'click'>('click', () => {
              interaction.onSetSummarySettingsOpen(false)
              actions.selectPage(page.id)
            })}
          >{page.name}</button>
          {group === undefined && !page.mandatory ? null : <span id={`quiz-hunt-page-indicators-${page.id}`} className="quiz-hunt-page-indicators">
            {page.mandatory ? renderMandatoryIndicator(`quiz-hunt-bank-page-kind-${page.id}`, 'Obligatoire') : null}
            {group === undefined ? null : <span
              id={`quiz-hunt-page-color-${page.id}`}
              className="quiz-hunt-page-color-indicator"
              role="img"
              aria-label={`Couleur ${group.name}`}
              title={group.name}
              style={{ backgroundColor: group.color }}
            />}
          </span>}
        </div>
      </li>
    })}
  </ul>
}

/** Describes the selected bank in the central authoring area. */
function renderChapterLanding(chapter: QuizHuntChapter | undefined, actions: QuizHuntEditorFacade): RemixNode {
  if (chapter === undefined) return <section id="quiz-hunt-empty-selection" className="elce-panel elce-work-area">
    <p id="quiz-hunt-empty-selection-text">Choisissez une page ou une banque.</p>
  </section>
  return <section id={`quiz-hunt-bank-settings-${chapter.id}`} className="elce-panel elce-work-area quiz-hunt-bank-settings">
    <h2 id={`quiz-hunt-bank-settings-title-${chapter.id}`} className="elce-work-area-chapter-title">
      {renderLucideIcon(Folder, `quiz-hunt-bank-settings-icon-${chapter.id}`)}
      <input
        id={`quiz-hunt-bank-settings-name-${chapter.id}`}
        className="elce-inline-title-input"
        aria-label="Nom de la banque"
        value={chapter.name}
        required={true}
        mix={on<HTMLInputElement, 'change'>('change', (event) => actions.renameChapter(chapter.id, event.currentTarget.value))}
      />
    </h2>
    <p id={`quiz-hunt-bank-description-${chapter.id}`} className="elce-muted">
      {chapter.type === 'introduction'
        ? 'La page de contenu Introduction est facultative.'
        : chapter.type === 'finals'
          ? 'Les finales sont tirées parmi les couleurs actives.'
          : 'Les pages de cette banque forment le parcours des questions.'}
    </p>
  </section>
}

/** Renders the selected page or bank's Quiz Hunt settings in the shared side panel. */
function renderQuizHuntPropertiesPanel(
  view: QuizHuntWorkspaceView,
  selectedPage: QuizHuntPage | undefined,
  selectedChapter: QuizHuntChapter | undefined,
  actions: QuizHuntEditorFacade,
  interaction: QuizHuntWorkspaceInteraction,
): RemixNode {
  return <aside
    id="elce-properties"
    className="elce-panel elce-properties quiz-hunt-properties"
    data-panel-open={interaction.panelVisibility.properties}
    aria-labelledby="elce-properties-heading-title"
  >
    <div id="elce-properties-reduce-row" className="elce-panel-reduce-row">
      {renderEditorPanelReduceButton('properties', () => interaction.onSetPanelVisibility('properties', false), 'Réglages')}
    </div>
    <header id="elce-properties-heading" className="elce-properties-heading">
      <h1 id="elce-properties-heading-title">Réglages</h1>
    </header>
    {interaction.resultPage !== null
      ? <p id="quiz-hunt-result-settings-location" className="elce-muted">La Carte sélectionnée est éditée dans l’espace central.</p>
      : interaction.introductionFolderOpen
        ? <p id="quiz-hunt-introduction-settings-location" className="elce-muted">L’introduction est facultative et son contenu s’édite comme une page de jeu.</p>
      : interaction.summarySettingsOpen
      ? null
      : selectedPage !== undefined && (selectedChapter?.type === 'questions' || selectedChapter?.type === 'finals')
        ? renderQuestionOptions(selectedPage, view.document, actions)
      : selectedChapter !== undefined && selectedPage === undefined
          ? renderBankInspector(selectedChapter)
          : selectedPage !== undefined
            ? <p id="quiz-hunt-page-settings-location" className="elce-muted">Le contenu de la page est édité dans l’espace central.</p>
            : <p id="quiz-hunt-properties-hint" className="elce-muted">Cette page n’a pas de réglage dans le panneau latéral.</p>}
  </aside>
}

/** Renders the Sommaire and its current deterministic draw. */
function renderSummaryWorkspace(
  document: QuizHuntDocument,
  actions: QuizHuntEditorFacade,
): RemixNode {
  return <section id="quiz-hunt-summary-workspace" className="elce-summary-profile-settings quiz-hunt-summary-workspace">
      <header id="quiz-hunt-summary-workspace-heading" className="elce-summary-profile-settings__heading">
        <h1 id="quiz-hunt-summary-workspace-title">Sommaire</h1>
      </header>
      {renderGameSettings(document, actions)}
      {renderDrawPreview(document, actions)}
  </section>
}

/** Gives the optional Introduction chapter a landing surface when it has no page. */
function renderIntroductionFolderLanding(): RemixNode {
  return <section id="quiz-hunt-introduction-folder-landing" className="elce-panel elce-work-area quiz-hunt-bank-settings">
    <h1 id="quiz-hunt-introduction-folder-landing-title" className="elce-work-area-chapter-title">Introduction</h1>
    <p id="quiz-hunt-introduction-folder-landing-description" className="elce-muted">Cette page de contenu est facultative. Utilisez + dans le dossier Introduction pour l’ajouter.</p>
  </section>
}

/** Renders the fixed game result Card inside its virtual authoring page. */
function renderResultPage(
  document: QuizHuntDocument,
  resultPage: Exclude<QuizHuntResultPage, 'overview' | null>,
  actions: QuizHuntEditorFacade,
  mediaById: QuizHuntMediaById,
): RemixNode {
  const success = resultPage === 'success'
  const title = success ? 'Réussite' : 'Échec'
  const cardId = success ? document.settings.successCardBdcId : document.settings.failureCardBdcId
  const card = document.bdcs.find((bdc) => bdc.id === cardId)
  return <section id={`quiz-hunt-result-editor-${resultPage}`} className="elce-panel elce-work-area quiz-hunt-result-editor">
    <h1 id={`quiz-hunt-result-editor-title-${resultPage}`} className="elce-work-area-chapter-title">{title}</h1>
    {card?.type === CARD_BDC_TYPE
      ? renderRemixCardEditor(card, mediaById, actions.createCardEditorActions())
      : <p id={`quiz-hunt-result-card-missing-${resultPage}`} className="elce-muted">La Carte de résultat est indisponible.</p>}
  </section>
}

/** Gives the Résultat folder a simple landing surface when its parent is selected. */
function renderResultFolderLanding(): RemixNode {
  return <section id="quiz-hunt-result-folder-landing" className="elce-panel elce-work-area quiz-hunt-bank-settings">
    <h1 id="quiz-hunt-result-folder-landing-title" className="elce-work-area-chapter-title">Résultat</h1>
    <p id="quiz-hunt-result-folder-landing-description" className="elce-muted">Choisissez Réussite ou Échec pour régler la Carte correspondante.</p>
  </section>
}

/** Renders the selected bank's rename action and role description. */
function renderBankInspector(chapter: QuizHuntChapter): RemixNode {
  return <section id={`quiz-hunt-bank-inspector-${chapter.id}`} className="quiz-hunt-bank-inspector">
    <h2 id={`quiz-hunt-bank-inspector-title-${chapter.id}`}>{chapter.name}</h2>
    <p id={`quiz-hunt-bank-inspector-description-${chapter.id}`} className="elce-muted">
      {chapter.type === 'finals' ? 'Les finales sont tirées parmi les couleurs actives.' : 'Les pages de cette banque forment le parcours des questions.'}
    </p>
  </section>
}

/** Renders page metadata and shared BDC editors in the central authoring area. */
function renderPage(
  page: QuizHuntPage,
  chapter: QuizHuntChapter | undefined,
  bdcs: readonly ResourceBdc[],
  view: QuizHuntWorkspaceView,
  actions: QuizHuntEditorFacade,
  sectionSession: SectionEditorSession,
  handle: RemixRenderHandle,
  interaction: QuizHuntWorkspaceInteraction,
): RemixNode {
  return renderPageEditorView({
    page,
    sequence: bdcs.map((bdc, index) => {
      const presentation = bdcNavigationPresentation(bdc)
      return {
        bdcId: bdc.id,
        index,
        navigationIcon: renderLucideIcon(presentation.icon, `elce-page-bdc-navigation-icon-${bdc.id}`),
        navigationLabel: presentation.label,
      }
    }),
    addContentMenu: renderAddSectionButton(page, bdcs.length, actions),
    isAddContentMenuOpen: interaction.isAddContentMenuOpen,
    trashAnimationToken: interaction.trashAnimationToken,
    onToggleAddContentMenu: () => interaction.onSetAddContentMenuOpen(!interaction.isAddContentMenuOpen),
    dropTarget: interaction.dropTarget,
    chapterTitle: chapter === undefined || chapter.type === 'introduction' ? null : renderChapterTitle(chapter, actions),
    textFieldFeature: quizHuntTextFieldFeature,
    renderPageTypeMark: (currentPage) => renderLucideIcon(
      currentPage.type === 'diapo' ? DIAPO_PAGE_ICON : FLUX_PAGE_ICON,
      `elce-page-type-icon-${currentPage.id}`,
    ),
    onRenamePage: (pageId, name) => actions.renamePage(pageId, authoredTextToPlainText(name)),
    renderBdcEditor: (bdcId) => {
      const bdc = bdcs.find((candidate) => candidate.id === bdcId)
      if (bdc === undefined) return null
      if (bdc.type === SECTION_BDC_TYPE && bdc.section !== null) {
        return renderQuizHuntSection(bdc, bdc.section, sectionSession, actions, handle, view.historySelection)
      }
      if (bdc.type !== QUESTION_BDC_TYPE || bdc.question === null) return null
      const media = view.document.medias.find((candidate) => candidate.id === bdc.question?.mediaId) ?? null
      return renderQuestionEditor({
        bdcId: bdc.id,
        question: bdc.question,
        canDelete: chapter?.type === 'introduction'
          || page.chapterId === null
          || bdcs.filter((candidate) => candidate.question !== null).length > 1,
        media,
        mediaType: media === null ? null : mediaTypeFromMimeType(media.mimeType),
        mediaSource: media === null ? null : view.mediaSources[media.id] ?? null,
        actions: actions.createQuestionEditorActions(bdc.id),
        onCatalogReference: (value) => actions.attachQuestionMediaReference(bdc.id, value),
      })
    },
    onStartBdcDrag: (event, bdcId) => startPageBdcDrag(event, bdcId, interaction),
    onEndBdcDrag: () => endPageBdcDrag(interaction),
    onDragOverBdcNavigationItem: (event, bdcId, index) => dragOverPageBdcNavigation(event, bdcId, index, page, interaction),
    onDropBdcNavigationItem: (event, bdcId, index) => dropPageBdcOnNavigation(event, bdcId, index, page, actions, interaction),
    onDragOverBdcTrash: (event) => dragOverPageBdcTrash(event, page, bdcs, interaction),
    onDropBdcTrash: (event) => dropPageBdcOnTrash(event, page, bdcs, actions, interaction),
    onDragOverSeparator: (event, targetId, index) => dragOverPageBdcSeparator(event, targetId, index, page, interaction),
    onDragLeaveDropTarget: (event) => leavePageBdcDropTarget(event, interaction),
    onDropBdc: (event, index) => dropPageBdc(event, index, page, actions, interaction),
  })
}

/** Renders the selected bank title with Learning's page-header treatment. */
function renderChapterTitle(chapter: QuizHuntChapter, actions: QuizHuntEditorFacade): RemixNode {
  return <h2
    id="elce-work-area-chapter-title"
    className="elce-work-area-chapter-title"
    role="heading"
    aria-level={2}
  >
    <span id={`quiz-hunt-chapter-type-mark-${chapter.id}`} className="elce-chapter-type-mark">
      {renderLucideIcon(Folder, `quiz-hunt-chapter-type-icon-${chapter.id}`)}
    </span>
    {quizHuntTextFieldFeature.render({
      id: `quiz-hunt-page-chapter-name-${chapter.id}`,
      className: 'elce-inline-title-input',
      ariaLabel: 'Nom de la banque',
      value: chapter.name,
      required: true,
      onChange: (name) => actions.renameChapter(chapter.id, authoredTextToPlainText(name)),
    })}
  </h2>
}

/** Renders the page add-content command using Learning's shared menu style. */
function renderAddSectionButton(page: QuizHuntPage, index: number, actions: QuizHuntEditorFacade): RemixNode {
  return <button
    id={`quiz-hunt-section-create-${page.id}`}
    className="elce-add-content-action"
    type="button"
    aria-label="Ajouter un bloc texte"
    title="Ajouter un bloc texte"
    mix={on<HTMLButtonElement, 'click'>('click', () => actions.createSection(page.id, index))}
  >
    {renderLucideIcon(FileText, `quiz-hunt-section-create-icon-${page.id}`)}
    <span id={`quiz-hunt-section-create-label-${page.id}`} className="elce-add-content-action__label">Texte</span>
  </button>
}

/** Renders the native Quiz Hunt text fields consumed by the shared page layout. */
function renderQuizHuntTextField(options: ResourceTextFieldOptions): RemixNode {
  const value = authoredTextToPlainText(options.value)
  return <input
    id={options.id}
    className={options.className}
    type="text"
    aria-label={options.ariaLabel}
    placeholder={options.placeholder}
    value={value}
    required={options.required}
    maxLength={options.maxLength}
    mix={[
      on<HTMLInputElement, 'change'>('change', (event) => {
        if (options.required && event.currentTarget.value.trim().length === 0) {
          event.currentTarget.value = value
          return
        }
        options.onChange(event.currentTarget.value)
      }),
      on<HTMLInputElement, 'focus'>('focus', options.onFocus ?? (() => undefined)),
      on<HTMLInputElement, 'keydown'>('keydown', (event) => {
        options.onKeyDown?.(event)
        if (event.key === 'Enter') event.currentTarget.blur()
      }),
    ]}
  />
}

/** Returns the page rail icon and label for a Quiz Hunt BDC. */
function bdcNavigationPresentation(bdc: ResourceBdc): Readonly<{ icon: Parameters<typeof renderLucideIcon>[0]; label: string }> {
  if (bdc.type === QUESTION_BDC_TYPE) return { icon: ListChecks, label: 'Quiz' }
  if (bdc.type === SECTION_BDC_TYPE) return { icon: FileText, label: 'Texte' }
  return { icon: FileText, label: 'Bloc' }
}

/** Starts the shared page BDC drag gesture for the selected Quiz Hunt page. */
function startPageBdcDrag(event: DragEvent, bdcId: string, interaction: QuizHuntWorkspaceInteraction): void {
  const transfer = event.dataTransfer
  if (transfer === null) return
  interaction.onSetDraggedBdcId(bdcId)
  transfer.effectAllowed = 'move'
  transfer.setData('text/plain', bdcId)
}

/** Clears the BDC source and insertion target after a page drag ends. */
function endPageBdcDrag(interaction: QuizHuntWorkspaceInteraction): void {
  interaction.onSetDraggedBdcId(null)
  interaction.onSetDropTarget(null)
}

/** Computes the index and highlight for dropping a BDC beside a page rail item. */
function pageBdcNavigationDropPosition(
  event: DragEvent,
  targetBdcId: string,
  targetIndex: number,
  page: QuizHuntPage,
  interaction: QuizHuntWorkspaceInteraction,
): Readonly<{ index: number; targetId: string }> | null {
  const draggedBdcId = interaction.getDraggedBdcId()
  const target = event.currentTarget
  if (event.dataTransfer === null || draggedBdcId === null || draggedBdcId === targetBdcId
    || !(target instanceof HTMLElement) || page.bdcIds[targetIndex] !== targetBdcId) return null
  const sourceIndex = page.bdcIds.indexOf(draggedBdcId)
  if (sourceIndex < 0) return null
  const bounds = target.getBoundingClientRect()
  const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
  const targetInsertionIndex = targetIndex + (position === 'after' ? 1 : 0)
  const index = sourceIndex < targetInsertionIndex ? targetInsertionIndex - 1 : targetInsertionIndex
  if (!canMovePageBdc(page, draggedBdcId, index)) return null
  return { index, targetId: `elce-page-bdc-navigation-drop-${targetBdcId}-${position}` }
}

/** Highlights a valid insertion edge beside one BDC navigation item. */
function dragOverPageBdcNavigation(
  event: DragEvent,
  targetBdcId: string,
  targetIndex: number,
  page: QuizHuntPage,
  interaction: QuizHuntWorkspaceInteraction,
): void {
  const transfer = event.dataTransfer
  const position = pageBdcNavigationDropPosition(event, targetBdcId, targetIndex, page, interaction)
  if (transfer === null || position === null) return
  event.preventDefault()
  event.stopPropagation()
  transfer.dropEffect = 'move'
  interaction.onSetDropTarget(position.targetId)
}

/** Drops a BDC at the valid position beside a navigation item. */
function dropPageBdcOnNavigation(
  event: DragEvent,
  targetBdcId: string,
  targetIndex: number,
  page: QuizHuntPage,
  actions: QuizHuntEditorFacade,
  interaction: QuizHuntWorkspaceInteraction,
): void {
  const position = pageBdcNavigationDropPosition(event, targetBdcId, targetIndex, page, interaction)
  if (position !== null) dropPageBdc(event, position.index, page, actions, interaction)
}

/** Highlights a page insertion separator while a direct BDC is being dragged. */
function dragOverPageBdcSeparator(
  event: DragEvent,
  targetId: string,
  index: number,
  page: QuizHuntPage,
  interaction: QuizHuntWorkspaceInteraction,
): void {
  const transfer = event.dataTransfer
  const draggedBdcId = interaction.getDraggedBdcId()
  if (transfer === null || draggedBdcId === null || !canMovePageBdc(page, draggedBdcId, index)) return
  event.preventDefault()
  event.stopPropagation()
  transfer.dropEffect = 'move'
  interaction.onSetDropTarget(targetId)
}

/** Clears an insertion highlight when the pointer leaves its drop target. */
function leavePageBdcDropTarget(event: DragEvent, interaction: QuizHuntWorkspaceInteraction): void {
  const currentTarget = event.currentTarget
  if (currentTarget instanceof Node && event.relatedTarget instanceof Node && currentTarget.contains(event.relatedTarget)) return
  interaction.onSetDropTarget(null)
}

/** Applies a valid same-page BDC reorder through Quiz Hunt's document facade. */
function dropPageBdc(
  event: DragEvent,
  index: number,
  page: QuizHuntPage,
  actions: QuizHuntEditorFacade,
  interaction: QuizHuntWorkspaceInteraction,
): void {
  const draggedBdcId = interaction.getDraggedBdcId()
  const transfer = event.dataTransfer
  if (transfer === null || draggedBdcId === null) {
    interaction.onSetDropTarget(null)
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (canMovePageBdc(page, draggedBdcId, index)) actions.moveBdc(draggedBdcId, page.id, index)
  endPageBdcDrag(interaction)
}

/** Checks whether one current page BDC can move to the requested insertion slot. */
function canMovePageBdc(page: QuizHuntPage, bdcId: string, index: number): boolean {
  const sourceIndex = page.bdcIds.indexOf(bdcId)
  return sourceIndex >= 0 && Number.isInteger(index) && index >= 0 && index <= page.bdcIds.length
}

/** Highlights the page trash only for a BDC that Quiz Hunt can delete. */
function dragOverPageBdcTrash(
  event: DragEvent,
  page: QuizHuntPage,
  bdcs: readonly ResourceBdc[],
  interaction: QuizHuntWorkspaceInteraction,
): void {
  const draggedBdcId = interaction.getDraggedBdcId()
  const transfer = event.dataTransfer
  const bdc = bdcs.find((candidate) => candidate.id === draggedBdcId)
  if (transfer === null || draggedBdcId === null || bdc === undefined || !canDeletePageBdc(page, bdcs, bdc)) return
  event.preventDefault()
  event.stopPropagation()
  transfer.dropEffect = 'move'
  interaction.onSetDropTarget(`elce-page-bdc-trash-${page.id}-drop`)
}

/** Deletes a Section or a non-required Question dropped on the shared trash. */
function dropPageBdcOnTrash(
  event: DragEvent,
  page: QuizHuntPage,
  bdcs: readonly ResourceBdc[],
  actions: QuizHuntEditorFacade,
  interaction: QuizHuntWorkspaceInteraction,
): void {
  const transfer = event.dataTransfer
  const draggedBdcId = interaction.getDraggedBdcId()
  const bdc = bdcs.find((candidate) => candidate.id === draggedBdcId)
  if (transfer === null || draggedBdcId === null || bdc === undefined || !canDeletePageBdc(page, bdcs, bdc)) {
    interaction.onSetDropTarget(null)
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (bdc.type === SECTION_BDC_TYPE) actions.deleteSection(bdc.id)
  if (bdc.type === QUESTION_BDC_TYPE) actions.createQuestionEditorActions(bdc.id).deleteQuestion()
  interaction.onTrashDropSuccess()
  endPageBdcDrag(interaction)
}

/** Keeps a bank page's required Question out of the delete target. */
function canDeletePageBdc(page: QuizHuntPage, bdcs: readonly ResourceBdc[], bdc: ResourceBdc): boolean {
  if (bdc.type === SECTION_BDC_TYPE) return true
  return bdc.type === QUESTION_BDC_TYPE && (page.chapterId === null
    || bdcs.filter((candidate) => candidate.type === QUESTION_BDC_TYPE).length > 1)
}

const quizHuntTextFieldFeature: ResourceTextFieldFeature = { render: renderQuizHuntTextField }

/** Renders the shared Section editor with only its text extension and actor path. */
function renderQuizHuntSection(
  bdc: ResourceBdc,
  section: NonNullable<ResourceBdc['section']>,
  session: SectionEditorSession,
  actions: QuizHuntEditorFacade,
  handle: RemixRenderHandle,
  historySelection: QuizHuntSelection | null,
): RemixNode {
  const toolbarState = session.toolbarStates.get(bdc.id) ?? EMPTY_SECTION_TOOLBAR_STATE
  return <article id={`quiz-hunt-section-editor-${bdc.id}`} className="elce-section-editor">
    <style id={`quiz-hunt-section-dot-leader-style-${bdc.id}`}>{DOT_LEADER_STYLE_SHEET}</style>
    <div id={`elce-section-sticky-header-${bdc.id}`} className="elce-section-sticky-header">
      <div id={`elce-section-heading-${bdc.id}`} className="elce-section-heading">
      <input
        id={`quiz-hunt-section-title-${bdc.id}`}
        className="elce-section-title-input"
        aria-label="Titre du bloc texte"
        value={authoredTextToPlainText(section.title)}
        mix={on<HTMLInputElement, 'input'>('input', (event) => session.adapters.get(bdc.id)?.updateTitle(event.currentTarget.value))}
      />
      <div id={`elce-section-header-actions-${bdc.id}`} className="elce-bdc-header-actions">
        <button
          id={`elce-section-delete-${bdc.id}`}
          className="elce-bdc-icon-button elce-bdc-icon-button--danger"
          type="button"
          aria-label="Supprimer le bloc texte"
          title="Supprimer le bloc texte"
          mix={on<HTMLButtonElement, 'click'>('click', () => actions.deleteSection(bdc.id))}
        >{renderLucideIcon(Trash2, `elce-section-delete-icon-${bdc.id}`)}</button>
      </div>
      </div>
      {renderSectionEditorToolbar(bdc.id, toolbarState, session.adapters, handle)}
    </div>
    <div
      id={`quiz-hunt-section-content-host-${bdc.id}`}
      className="elce-section-editor-host"
      data-rmx-preserve-dom={true}
      mix={ref((host, signal) => {
        const adapter = new SectionTiptapAdapter(host as HTMLElement, {
          bdcId: bdc.id,
          section,
          onChange: (change, selection) => actions.submitSectionChange(bdc.id, change, selection),
          onToolbarState: (next) => {
            session.toolbarStates.set(bdc.id, next)
            if (!handle.signal.aborted) void handle.update()
          },
        })
        session.register(bdc.id, adapter)
        const saved = historySelection?.sectionSelection
        if (saved?.sectionBdcId === bdc.id) adapter.restoreSelection(saved)
        signal.addEventListener('abort', () => session.unregister(bdc.id, adapter), { once: true })
      })}
    />
  </article>
}

/** Renders game timing, extra, and color settings in the Sommaire. */
function renderGameSettings(
  document: QuizHuntDocument,
  actions: QuizHuntEditorFacade,
): RemixNode {
  const settings = document.settings
  const updateNumber = (key: 'timeBudgetMs' | 'clueDelayMs' | 'feedbackDelayMs', value: string): void => {
    const seconds = Number(value)
    if (Number.isFinite(seconds)) actions.updateSettings({ [key]: Math.round(seconds * 1_000) })
  }
  return <section id="quiz-hunt-game-settings" className="quiz-hunt-summary-settings elce-summary-profile-settings__group">
    <header id="quiz-hunt-game-settings-heading" className="quiz-hunt-panel-heading">
      <h2 id="quiz-hunt-game-settings-title">Configuration du jeu</h2>
    </header>
    <div id="quiz-hunt-game-settings-fields" className="elce-summary-profile-settings__fields">
      {renderNumberSetting('timeBudgetMs', 'Durée du jeu (s)', settings.timeBudgetMs / 1_000, updateNumber, 'any')}
      {renderNumberSetting('clueDelayMs', 'Délai avant indice (s)', settings.clueDelayMs / 1_000, updateNumber, 'any')}
      {renderNumberSetting('feedbackDelayMs', 'Durée du retour (s)', settings.feedbackDelayMs / 1_000, updateNumber, 'any')}
    </div>
    {renderGroups(settings.groups, actions)}
  </section>
}

/** Renders seed, distribution policy and extra-trigger settings in the Sommaire. */
function renderDrawPreview(
  document: QuizHuntDocument,
  actions: QuizHuntEditorFacade,
): RemixNode {
  const draw = createQuizHuntGameDraw(document, document.settings.seed)
  const extraTriggerCandidates = getQuizHuntExtraTriggerCandidates(document)
  const extraTriggerCandidateIds = new Set(extraTriggerCandidates.map((page) => page.id))
  const configuredTriggerPage = extraTriggerCandidates.find((page) => page.id === document.settings.extraTriggerPageId)
  const selectedTriggerIsUnavailable = document.settings.extraTriggerPageId !== null
    && !extraTriggerCandidateIds.has(document.settings.extraTriggerPageId)
  const updateSeed = (value: string): void => {
    const seed = Number(value)
    if (Number.isFinite(seed)) actions.updateSettings({ seed })
  }
  return <section id="quiz-hunt-draw-preview" className="quiz-hunt-draw-preview elce-summary-profile-settings__group">
    <header id="quiz-hunt-draw-preview-heading">
      <h3 id="quiz-hunt-draw-preview-title">Aperçu</h3>
      <div id="quiz-hunt-draw-preview-settings" className="elce-summary-profile-settings__fields">
        {renderNumberSetting('seed', 'Seed stable', document.settings.seed, updateSeed)}
        <label id="quiz-hunt-random-label" className="elce-summary-profile-settings__checkbox">
          <input id="quiz-hunt-random" type="checkbox" checked={document.settings.random} mix={on<HTMLInputElement, 'change'>('change', (event) => actions.updateSettings({ random: event.currentTarget.checked }))} />
          Tirage aléatoire en diffusion
        </label>
        <label id="quiz-hunt-authoring-grid-debug-label" className="elce-summary-profile-settings__checkbox">
          <input id="quiz-hunt-authoring-grid-debug" type="checkbox" checked={document.settings.authoringGridDebug} mix={on<HTMLInputElement, 'change'>('change', (event) => actions.updateSettings({ authoringGridDebug: event.currentTarget.checked }))} />
          Debug auteur : noms dans la grille
        </label>
        <label id="quiz-hunt-extra-trigger-label" className="elce-summary-profile-settings__field elce-summary-profile-settings__field--wide">
          <span id="quiz-hunt-extra-trigger-caption">Question qui déclenche le jeton</span>
          <select
            id="quiz-hunt-extra-trigger"
            value={document.settings.extraTriggerPageId ?? ''}
            mix={on<HTMLSelectElement, 'change'>('change', (event) => actions.updateSettings({ extraTriggerPageId: event.currentTarget.value || null }))}
          >
            <option id="quiz-hunt-extra-trigger-seeded" value="">Selon le seed</option>
            {selectedTriggerIsUnavailable && document.settings.extraTriggerPageId !== null
              ? <option id="quiz-hunt-extra-trigger-unavailable" value={document.settings.extraTriggerPageId} disabled>Question indisponible</option>
              : null}
            {extraTriggerCandidates.map((page) => <option id={`quiz-hunt-extra-trigger-option-${page.id}`} key={page.id} value={page.id}>{page.name}</option>)}
          </select>
        </label>
        <label id="quiz-hunt-extra-enabled-label" className="elce-summary-profile-settings__checkbox">
          <input id="quiz-hunt-extra-enabled" type="checkbox" checked={document.settings.extraEnabled} mix={on<HTMLInputElement, 'change'>('change', (event) => actions.updateSettings({ extraEnabled: event.currentTarget.checked }))} />
          Activer l’extra
        </label>
      </div>
      <p id="quiz-hunt-draw-preview-seed">Finale {document.pages.find((page) => page.id === draw.finalPageId)?.name ?? 'désactivée'} ({document.settings.groups.find((group) => group.id === draw.finalColorId)?.name ?? 'couleur indisponible'})</p>
      <p id="quiz-hunt-draw-preview-extra">{document.settings.extraTriggerPageId === null
        ? `Question du jeton choisie par le seed : ${document.pages.find((page) => page.id === draw.extraPageId)?.name ?? 'aucune question tirée'}`
        : selectedTriggerIsUnavailable
          ? 'Question déclencheuse du jeton indisponible'
          : `Question déclencheuse du jeton : ${configuredTriggerPage?.name ?? 'aucune'}`} · délai après l’ouverture de la Question : {draw.extraOffsetMs / 1_000} s</p>
    </header>
  </section>
}

/** Renders one numeric setting field. */
function renderNumberSetting<Key extends 'seed' | 'timeBudgetMs' | 'clueDelayMs' | 'feedbackDelayMs'>(
  key: Key,
  label: string,
  value: number,
  update: (key: Key, value: string) => void,
  step = '1',
): RemixNode {
  return <label id={`quiz-hunt-setting-label-${key}`} className="elce-summary-profile-settings__field" htmlFor={`quiz-hunt-setting-${key}`}>
    <span id={`quiz-hunt-setting-caption-${key}`}>{label}</span>
    <input id={`quiz-hunt-setting-${key}`} type="number" step={step} value={value} mix={on<HTMLInputElement, 'change'>('change', (event) => update(key, event.currentTarget.value))} />
  </label>
}

/** Renders editable color groups while retaining pages when a group is removed. */
function renderGroups(
  groups: QuizHuntDocument['settings']['groups'],
  actions: QuizHuntEditorFacade,
): RemixNode {
  return <section id="quiz-hunt-color-groups" className="quiz-hunt-color-groups">
    <header id="quiz-hunt-color-groups-heading" className="quiz-hunt-panel-heading">
      <h3 id="quiz-hunt-color-groups-title">Couleurs</h3>
      <button
        id="quiz-hunt-color-add"
        className="elce-add-content-action"
        type="button"
        aria-label="Ajouter une couleur"
        title="Ajouter une couleur"
        mix={on<HTMLButtonElement, 'click'>('click', () => actions.setGroup({
          id: createStableId('color'),
          name: 'Nouvelle couleur',
          color: '#55706a',
        }))}
      >
        {renderLucideIcon(Plus, 'quiz-hunt-color-add-icon')}
        <span id="quiz-hunt-color-add-label" className="elce-add-content-action__label">Couleur</span>
      </button>
    </header>
    <ul id="quiz-hunt-color-group-list" className="quiz-hunt-color-group-list">
      {groups.map((group) => <li key={group.id} id={`quiz-hunt-color-group-${group.id}`} className="quiz-hunt-color-group">
        <label id={`quiz-hunt-color-name-label-${group.id}`} htmlFor={`quiz-hunt-color-name-${group.id}`}>Nom</label>
        <input id={`quiz-hunt-color-name-${group.id}`} value={group.name} mix={on<HTMLInputElement, 'change'>('change', (event) => actions.setGroup({ ...group, name: event.currentTarget.value }))} />
        <label id={`quiz-hunt-color-value-label-${group.id}`} htmlFor={`quiz-hunt-color-value-${group.id}`}>Couleur</label>
        <input id={`quiz-hunt-color-value-${group.id}`} type="color" value={group.color} mix={on<HTMLInputElement, 'change'>('change', (event) => actions.setGroup({ ...group, color: event.currentTarget.value }))} />
        <button
          id={`quiz-hunt-color-remove-${group.id}`}
          className="elce-danger-action"
          type="button"
          aria-label={`Supprimer la couleur ${group.name}`}
          title={`Supprimer la couleur ${group.name}`}
          mix={on<HTMLButtonElement, 'click'>('click', () => actions.removeGroup(group.id))}
        >{renderLucideIcon(Trash2, `quiz-hunt-color-remove-icon-${group.id}`)}</button>
      </li>)}
    </ul>
  </section>
}

/** Renders the Sommaire color select and guaranteed-presence option for a bank page. */
function renderQuestionOptions(page: QuizHuntPage, document: QuizHuntDocument, actions: QuizHuntEditorFacade): RemixNode {
  return <fieldset id={`quiz-hunt-page-options-${page.id}`} className="quiz-hunt-page-options">
    <legend id={`quiz-hunt-page-options-title-${page.id}`}>Question du jeu</legend>
    <label id={`quiz-hunt-page-color-label-${page.id}`} htmlFor={`quiz-hunt-page-color-${page.id}`}>Couleur</label>
    <select
      id={`quiz-hunt-page-color-${page.id}`}
      value={page.colorId ?? ''}
      mix={on<HTMLSelectElement, 'change'>('change', (event) => actions.setPageColor(page.id, event.currentTarget.value || null))}
    >
      <option id={`quiz-hunt-page-color-none-${page.id}`} value="" selected={page.colorId === null}>Aucune</option>
      {document.settings.groups.map((group) => <option
        id={`quiz-hunt-page-color-option-${page.id}-${group.id}`}
        key={group.id}
        value={group.id}
        selected={group.id === page.colorId}
      >{group.name}</option>)}
    </select>
    <label id={`quiz-hunt-page-mandatory-label-${page.id}`} htmlFor={`quiz-hunt-page-mandatory-${page.id}`}>Obligatoire</label>
    <input id={`quiz-hunt-page-mandatory-${page.id}`} type="checkbox" checked={page.mandatory} mix={on<HTMLInputElement, 'change'>('change', (event) => actions.setMandatory(page.id, event.currentTarget.checked))} />
    {renderMandatoryIndicator(`quiz-hunt-page-mandatory-icon-${page.id}`, null)}
  </fieldset>
}

/** Renders the mandatory exclamation marker as an accessible label or decoration. */
function renderMandatoryIndicator(id: string, accessibleLabel: string | null): RemixNode {
  const decorative = accessibleLabel === null
  return <span
    id={id}
    className="quiz-hunt-mandatory-indicator elce-muted"
    role={decorative ? undefined : 'img'}
    aria-label={accessibleLabel ?? undefined}
    aria-hidden={decorative}
    title={accessibleLabel ?? undefined}
  >{renderLucideIcon(CircleAlert, `${id}-icon`)}</span>
}

/** Creates a page inside its Questions or Finales bank. */
function createPage(
  actions: QuizHuntEditorFacade,
  chapterId: string | null,
  fallbackName: string,
  interaction: QuizHuntWorkspaceInteraction,
): void {
  const name = window.prompt('Nom de la page', fallbackName)
  if (!name?.trim()) return
  interaction.onSetSummarySettingsOpen(false)
  interaction.onSetIntroductionFolderOpen(false)
  actions.createPage(chapterId, name.trim())
}
