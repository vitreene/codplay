import { on, ref, type RemixNode } from 'remix/component'
import type { RemixRenderHandle } from '../../../app/remix/remix-render-handle'
import { createStableId } from '../../../core/document/stable-id'
import { authoredTextToPlainText } from '../../../core/document/rich-text-utils'
import type { ResourceBdc } from '../../../resources/document/resource-document-types'
import { renderRemixQuestionEditor } from '../../../resources/bdcs/question/authoring/remix-question-editor'
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
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import type { SupportedMediaType } from '../../../domain/media/media-resource-service'
import type { QuizHuntChapter, QuizHuntDocument, QuizHuntPage, QuizHuntRootEntry } from '../document/quiz-hunt-document-types'
import { createQuizHuntGameDraw } from '../reading/quiz-hunt-game-draw'
import type { QuizHuntEditorFacade } from './quiz-hunt-editor-facade'
import type { QuizHuntSelection } from './quiz-hunt-controller'

type QuizHuntMediaById = Readonly<Record<string, Readonly<{ name: string; type: SupportedMediaType; source: string | null }>>>

export interface QuizHuntWorkspaceView {
  readonly document: QuizHuntDocument
  readonly selection: QuizHuntSelection
  readonly historySelection: QuizHuntSelection | null
  readonly mediaSources: Readonly<Record<string, string>>
  readonly importPending: boolean
  readonly editable: boolean
  readonly exportBusy: boolean
  readonly exportError: string | null
  readonly exportNotice: string | null
  readonly previewError: string | null
  readonly onPreview: () => void
}

/** Renders the Quiz Hunt outline, selected page, and author settings. */
export function renderQuizHuntWorkspace(
  view: QuizHuntWorkspaceView,
  actions: QuizHuntEditorFacade,
  sectionSession: SectionEditorSession,
  handle: RemixRenderHandle,
): RemixNode {
  const selectedPage = view.document.pages.find((page) => page.id === view.selection.pageId)
  const selectedChapter = view.document.chapters.find((chapter) => chapter.id === view.selection.chapterId)
  const selectedBdcs = selectedPage === undefined
    ? []
    : selectedPage.bdcIds.flatMap((bdcId) => view.document.bdcs.filter((bdc) => bdc.id === bdcId))
  const mediaById: QuizHuntMediaById = Object.fromEntries(view.document.medias.flatMap((media) => {
    const type = mediaTypeFromMimeType(media.mimeType)
    return type === null ? [] : [[media.id, { name: media.name, type, source: view.mediaSources[media.id] ?? null }]]
  }))

  return <main
    id="quiz-hunt-authoring-workspace"
    className="quiz-hunt-authoring-workspace"
    inert={!view.editable}
    aria-readonly={!view.editable}
  >
    <nav id="quiz-hunt-authoring-outline" className="quiz-hunt-authoring-outline" aria-label="Sommaire du projet">
      <header id="quiz-hunt-outline-header" className="quiz-hunt-panel-heading">
        <h1 id="quiz-hunt-outline-title">Parcours</h1>
        <button
          id="quiz-hunt-add-root-page"
          type="button"
          mix={on<HTMLButtonElement, 'click'>('click', () => createPage(actions, null, 'Nouvelle page'))}
        >Ajouter une page racine</button>
      </header>
      <ol id="quiz-hunt-root-entry-list" className="quiz-hunt-root-entry-list">
        {view.document.scenarioEntries.map((entry, index) => renderRootEntry(
          entry,
          index,
          view.document.scenarioEntries.length,
          view.document,
          view.selection,
          actions,
        ))}
      </ol>
      {selectedChapter === undefined ? null : renderChapterPages(selectedChapter, view, actions)}
    </nav>
    <section id="quiz-hunt-authoring-page" className="quiz-hunt-authoring-page">
      <div id="quiz-hunt-authoring-actions" className="quiz-hunt-authoring-actions">
        <button
          id="quiz-hunt-preview-open"
          type="button"
          mix={on<HTMLButtonElement, 'click'>('click', view.onPreview)}
        >Prévisualiser</button>
        {view.previewError === null ? null : <p id="quiz-hunt-preview-open-error" role="alert">{view.previewError}</p>}
      </div>
      {view.exportBusy || view.exportError !== null || view.exportNotice !== null ? <p
        id="quiz-hunt-export-status"
        className={view.exportError === null ? 'quiz-hunt-export-status' : 'quiz-hunt-export-status quiz-hunt-export-status--error'}
        role={view.exportError === null ? 'status' : 'alert'}
        aria-live="polite"
      >{view.exportBusy ? 'Préparation de l’export…' : view.exportError ?? view.exportNotice}</p> : null}
      {selectedPage === undefined
        ? renderChapterLanding(selectedChapter, actions)
        : renderPage(selectedPage, selectedBdcs, view, actions, sectionSession, handle, mediaById)}
    </section>
  </main>
}

/** Renders one movable root page or bank. */
function renderRootEntry(
  entry: QuizHuntRootEntry,
  index: number,
  count: number,
  document: QuizHuntDocument,
  selection: QuizHuntSelection,
  actions: QuizHuntEditorFacade,
): RemixNode {
  const page = entry.kind === 'page' ? document.pages.find((candidate) => candidate.id === entry.pageId) : undefined
  const chapter = entry.kind === 'chapter' ? document.chapters.find((candidate) => candidate.id === entry.chapterId) : undefined
  const id = entry.kind === 'page' ? entry.pageId : entry.chapterId
  const active = entry.kind === 'page' ? selection.pageId === entry.pageId : selection.chapterId === entry.chapterId
  const label = page?.name ?? chapter?.name ?? 'Entrée absente'
  return <li key={`${entry.kind}:${id}`} id={`quiz-hunt-root-entry-${id}`} className={active ? 'quiz-hunt-outline-entry is-active' : 'quiz-hunt-outline-entry'}>
    <button
      id={`quiz-hunt-root-select-${id}`}
      className="quiz-hunt-outline-entry__select"
      type="button"
      aria-current={active ? 'page' : undefined}
      mix={on<HTMLButtonElement, 'click'>('click', () => entry.kind === 'page'
        ? actions.selectPage(entry.pageId)
        : actions.selectChapter(entry.chapterId))}
    >{label}</button>
    <div id={`quiz-hunt-root-order-${id}`} className="quiz-hunt-outline-entry__order">
      <button
        id={`quiz-hunt-root-up-${id}`}
        type="button"
        aria-label={`Monter ${label}`}
        disabled={index === 0}
        mix={on<HTMLButtonElement, 'click'>('click', () => actions.moveRootEntry(entry, index - 1))}
      >↑</button>
      <button
        id={`quiz-hunt-root-down-${id}`}
        type="button"
        aria-label={`Descendre ${label}`}
        disabled={index === count - 1}
        mix={on<HTMLButtonElement, 'click'>('click', () => actions.moveRootEntry(entry, index + 1))}
      >↓</button>
    </div>
  </li>
}

/** Renders the page list and creation action for one selected bank. */
function renderChapterPages(
  chapter: QuizHuntChapter,
  view: QuizHuntWorkspaceView,
  actions: QuizHuntEditorFacade,
): RemixNode {
  return <section id={`quiz-hunt-bank-pages-${chapter.id}`} className="quiz-hunt-bank-pages">
    <header id={`quiz-hunt-bank-pages-heading-${chapter.id}`} className="quiz-hunt-panel-heading">
      <h2 id={`quiz-hunt-bank-pages-title-${chapter.id}`}>{chapter.name}</h2>
      <button
        id={`quiz-hunt-bank-page-create-${chapter.id}`}
        type="button"
        mix={on<HTMLButtonElement, 'click'>('click', () => createPage(actions, chapter.id, chapter.type === 'finals' ? 'Nouvelle finale' : 'Nouvelle question'))}
      >Ajouter une question</button>
    </header>
    <ol id={`quiz-hunt-bank-page-list-${chapter.id}`} className="quiz-hunt-bank-page-list">
      {chapter.pageIds.map((pageId) => {
        const page = view.document.pages.find((candidate) => candidate.id === pageId)
        if (page === undefined) return null
        const active = view.selection.pageId === page.id
        return <li key={page.id} id={`quiz-hunt-bank-page-row-${page.id}`}>
          <button
            id={`quiz-hunt-bank-page-select-${page.id}`}
            className={active ? 'quiz-hunt-outline-entry__select is-active' : 'quiz-hunt-outline-entry__select'}
            type="button"
            aria-current={active ? 'page' : undefined}
            mix={on<HTMLButtonElement, 'click'>('click', () => actions.selectPage(page.id))}
          >{page.name}</button>
        </li>
      })}
    </ol>
  </section>
}

/** Gives a selected bank its rename action without rendering it as a page. */
function renderChapterLanding(chapter: QuizHuntChapter | undefined, actions: QuizHuntEditorFacade): RemixNode {
  if (chapter === undefined) return <section id="quiz-hunt-empty-selection"><p id="quiz-hunt-empty-selection-text">Choisissez une page ou une banque.</p></section>
  return <section id={`quiz-hunt-bank-settings-${chapter.id}`} className="quiz-hunt-bank-settings">
    <h1 id={`quiz-hunt-bank-settings-title-${chapter.id}`}>{chapter.name}</h1>
    <button
      id={`quiz-hunt-bank-rename-${chapter.id}`}
      type="button"
      mix={on<HTMLButtonElement, 'click'>('click', () => {
        const name = window.prompt('Nom de la banque', chapter.name)
        if (name?.trim()) actions.renameChapter(chapter.id, name.trim())
      })}
    >Renommer la banque</button>
  </section>
}

/** Renders page metadata, shared BDC editors, and the Sommaire's game controls. */
function renderPage(
  page: QuizHuntPage,
  bdcs: readonly ResourceBdc[],
  view: QuizHuntWorkspaceView,
  actions: QuizHuntEditorFacade,
  sectionSession: SectionEditorSession,
  handle: RemixRenderHandle,
  mediaById: QuizHuntMediaById,
): RemixNode {
  const renamePage = (): void => {
    const name = window.prompt('Nom de la page', page.name)
    if (name?.trim()) actions.renamePage(page.id, name.trim())
  }
  return <div id={`quiz-hunt-page-${page.id}`} className="quiz-hunt-page">
    <header id={`quiz-hunt-page-header-${page.id}`} className="quiz-hunt-page-header">
      <div id={`quiz-hunt-page-title-area-${page.id}`}>
        <h1 id={`quiz-hunt-page-title-${page.id}`}>{page.name}</h1>
        <button id={`quiz-hunt-page-rename-${page.id}`} type="button" mix={on<HTMLButtonElement, 'click'>('click', renamePage)}>Renommer</button>
      </div>
      {page.chapterId === null ? null : renderQuestionOptions(page, view.document, actions)}
    </header>
    <div id={`quiz-hunt-page-bdcs-${page.id}`} className="quiz-hunt-page-bdcs">
      {bdcs.map((bdc) => {
        if (bdc.type === SECTION_BDC_TYPE && bdc.section !== null) {
          return renderQuizHuntSection(bdc, bdc.section, sectionSession, actions, handle, view.historySelection)
        }
        if (bdc.type === QUESTION_BDC_TYPE && bdc.question !== null) {
          const media = view.document.medias.find((candidate) => candidate.id === bdc.question?.mediaId) ?? null
          return renderRemixQuestionEditor({
            bdcId: bdc.id,
            question: bdc.question,
            canDelete: page.chapterId === null || bdcs.filter((candidate) => candidate.question !== null).length > 1,
            media,
            mediaType: media === null ? null : mediaTypeFromMimeType(media.mimeType),
            mediaSource: media === null ? null : view.mediaSources[media.id] ?? null,
            actions: actions.createQuestionEditorActions(bdc.id),
            onCatalogReference: (value) => actions.attachQuestionMediaReference(bdc.id, value),
          })
        }
        return null
      })}
      {bdcs.some((bdc) => bdc.type === SECTION_BDC_TYPE) ? null : <button
        id={`quiz-hunt-section-create-${page.id}`}
        className="quiz-hunt-add-section"
        type="button"
        mix={on<HTMLButtonElement, 'click'>('click', () => actions.createSection(page.id, bdcs.length))}
      >Ajouter un bloc texte</button>}
    </div>
    {page.type === 'summary' ? renderSummarySettings(view.document, actions, mediaById) : null}
  </div>
}

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
    <header id={`quiz-hunt-section-heading-${bdc.id}`} className="quiz-hunt-section-heading">
      <label id={`quiz-hunt-section-title-label-${bdc.id}`} htmlFor={`quiz-hunt-section-title-${bdc.id}`}>Titre du bloc texte</label>
      <input
        id={`quiz-hunt-section-title-${bdc.id}`}
        value={authoredTextToPlainText(section.title)}
        mix={on<HTMLInputElement, 'change'>('change', (event) => actions.updateSection(bdc.id, { ...section, title: event.currentTarget.value }))}
      />
    </header>
    {renderSectionEditorToolbar(bdc.id, toolbarState, session.adapters, handle)}
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

/** Renders the Sommaire-owned game setup and its two fixed result Cards. */
function renderSummarySettings(
  document: QuizHuntDocument,
  actions: QuizHuntEditorFacade,
  mediaById: QuizHuntMediaById,
): RemixNode {
  const settings = document.settings
  const cardActions = actions.createCardEditorActions()
  const successCard = document.bdcs.find((bdc) => bdc.id === settings.successCardBdcId)
  const failureCard = document.bdcs.find((bdc) => bdc.id === settings.failureCardBdcId)
  const updateNumber = (key: 'seed' | 'timeBudgetMs' | 'clueDelayMs' | 'feedbackDelayMs', value: string): void => {
    const number = Number(value)
    if (Number.isFinite(number)) actions.updateSettings({ [key]: number })
  }
  return <section id="quiz-hunt-summary-settings" className="quiz-hunt-summary-settings">
    <header id="quiz-hunt-summary-settings-heading" className="quiz-hunt-panel-heading">
      <h2 id="quiz-hunt-summary-settings-title">Configuration du jeu</h2>
    </header>
    <div id="quiz-hunt-game-settings" className="quiz-hunt-settings-grid">
      <label id="quiz-hunt-menu-presentation-label" htmlFor="quiz-hunt-menu-presentation">Présentation du sommaire</label>
      <select
        id="quiz-hunt-menu-presentation"
        value={settings.menuPresentation}
        mix={on<HTMLSelectElement, 'change'>('change', (event) => actions.updateSettings({ menuPresentation: event.currentTarget.value as 'grid' | 'diapo' }))}
      >
        <option id="quiz-hunt-menu-presentation-grid" value="grid">Grille</option>
        <option id="quiz-hunt-menu-presentation-diapo" value="diapo">Diapo</option>
      </select>
      {renderNumberSetting('seed', 'Seed stable', settings.seed, updateNumber)}
      <label id="quiz-hunt-random-label" htmlFor="quiz-hunt-random">Tirage aléatoire en diffusion</label>
      <input id="quiz-hunt-random" type="checkbox" checked={settings.random} mix={on<HTMLInputElement, 'change'>('change', (event) => actions.updateSettings({ random: event.currentTarget.checked }))} />
      {renderNumberSetting('timeBudgetMs', 'Durée du jeu (ms)', settings.timeBudgetMs, updateNumber)}
      {renderNumberSetting('clueDelayMs', 'Délai avant indice (ms)', settings.clueDelayMs, updateNumber)}
      {renderNumberSetting('feedbackDelayMs', 'Durée du retour (ms)', settings.feedbackDelayMs, updateNumber)}
      <label id="quiz-hunt-extra-enabled-label" htmlFor="quiz-hunt-extra-enabled">Activer l’extra</label>
      <input id="quiz-hunt-extra-enabled" type="checkbox" checked={settings.extraEnabled} mix={on<HTMLInputElement, 'change'>('change', (event) => actions.updateSettings({ extraEnabled: event.currentTarget.checked }))} />
    </div>
    {renderDrawPreview(document, actions)}
    {renderGroups(settings.groups, actions)}
    <section id="quiz-hunt-result-card-settings" className="quiz-hunt-result-card-settings">
      <h3 id="quiz-hunt-result-card-settings-title">Cartes des animations de résultat</h3>
      {successCard?.type === CARD_BDC_TYPE ? <section id="quiz-hunt-success-card-config" className="quiz-hunt-result-card-config">
        <h4 id="quiz-hunt-success-card-config-title">Réussite</h4>
        {renderRemixCardEditor(successCard, mediaById, cardActions)}
      </section> : null}
      {failureCard?.type === CARD_BDC_TYPE ? <section id="quiz-hunt-failure-card-config" className="quiz-hunt-result-card-config">
        <h4 id="quiz-hunt-failure-card-config-title">Échec</h4>
        {renderRemixCardEditor(failureCard, mediaById, cardActions)}
      </section> : null}
    </section>
  </section>
}

/** Shows the stable authoring draw and keeps unfilled game places visible. */
function renderDrawPreview(document: QuizHuntDocument, actions: QuizHuntEditorFacade): RemixNode {
  const draw = createQuizHuntGameDraw(document, document.settings.seed)
  const renderBank = (
    bankKey: 'questions' | 'finals',
    title: string,
    slotsByColor: typeof draw.trialSlotsByColor,
  ): RemixNode => <section id={`quiz-hunt-draw-${bankKey}`} className="quiz-hunt-draw-bank">
    <h4 id={`quiz-hunt-draw-${bankKey}-title`}>{title}</h4>
    {document.settings.groups.map((group) => <section key={group.id} id={`quiz-hunt-draw-color-${bankKey}-${group.id}`} className="quiz-hunt-draw-color">
      <h5 id={`quiz-hunt-draw-color-title-${bankKey}-${group.id}`}>{group.name}</h5>
      <ol id={`quiz-hunt-draw-slots-${bankKey}-${group.id}`} className="quiz-hunt-draw-slots">
        {(slotsByColor[group.id] ?? []).map((page, index) => <li key={`${group.id}-${index}`} id={`quiz-hunt-draw-slot-${bankKey}-${group.id}-${index}`}>
          <button
            id={`quiz-hunt-draw-select-${bankKey}-${group.id}-${index}`}
            type="button"
            disabled={page === null}
            mix={on<HTMLButtonElement, 'click'>('click', () => { if (page !== null) actions.selectPage(page.id) })}
          >{page?.name ?? 'Emplacement vide'}</button>
        </li>)}
      </ol>
    </section>)}
  </section>
  return <section id="quiz-hunt-draw-preview" className="quiz-hunt-draw-preview">
    <header id="quiz-hunt-draw-preview-heading">
      <h3 id="quiz-hunt-draw-preview-title">Tirage d’aperçu</h3>
      <p id="quiz-hunt-draw-preview-seed">Seed {draw.seed} · finale {document.pages.find((page) => page.id === draw.finalPageId)?.name ?? 'désactivée'} ({document.settings.groups.find((group) => group.id === draw.finalColorId)?.name ?? 'couleur indisponible'})</p>
      <p id="quiz-hunt-draw-preview-extra">Extra : {document.pages.find((page) => page.id === draw.extraPageId)?.name ?? 'aucune question tirée'} · délai après l’ouverture de l’épreuve : {draw.extraOffsetMs} ms</p>
    </header>
    <div id="quiz-hunt-draw-preview-banks" className="quiz-hunt-draw-preview-banks">
      {renderBank('questions', 'Questions', draw.trialSlotsByColor)}
      {renderBank('finals', 'Finales', draw.finalSlotsByColor)}
    </div>
  </section>
}

/** Renders one typed game duration field. */
function renderNumberSetting(
  key: 'seed' | 'timeBudgetMs' | 'clueDelayMs' | 'feedbackDelayMs',
  label: string,
  value: number,
  update: (key: 'seed' | 'timeBudgetMs' | 'clueDelayMs' | 'feedbackDelayMs', value: string) => void,
): RemixNode {
  return <label id={`quiz-hunt-setting-label-${key}`} className="quiz-hunt-number-setting" htmlFor={`quiz-hunt-setting-${key}`}>
    <span id={`quiz-hunt-setting-caption-${key}`}>{label}</span>
    <input id={`quiz-hunt-setting-${key}`} type="number" value={value} mix={on<HTMLInputElement, 'change'>('change', (event) => update(key, event.currentTarget.value))} />
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
      <button id="quiz-hunt-color-add" type="button" mix={on<HTMLButtonElement, 'click'>('click', () => actions.setGroup({
        id: createStableId('color'),
        name: 'Nouvelle couleur',
        color: '#55706a',
      }))}>Ajouter une couleur</button>
    </header>
    <ul id="quiz-hunt-color-group-list" className="quiz-hunt-color-group-list">
      {groups.map((group) => <li key={group.id} id={`quiz-hunt-color-group-${group.id}`} className="quiz-hunt-color-group">
        <label id={`quiz-hunt-color-name-label-${group.id}`} htmlFor={`quiz-hunt-color-name-${group.id}`}>Nom</label>
        <input id={`quiz-hunt-color-name-${group.id}`} value={group.name} mix={on<HTMLInputElement, 'change'>('change', (event) => actions.setGroup({ ...group, name: event.currentTarget.value }))} />
        <label id={`quiz-hunt-color-value-label-${group.id}`} htmlFor={`quiz-hunt-color-value-${group.id}`}>Couleur</label>
        <input id={`quiz-hunt-color-value-${group.id}`} type="color" value={group.color} mix={on<HTMLInputElement, 'change'>('change', (event) => actions.setGroup({ ...group, color: event.currentTarget.value }))} />
        <button id={`quiz-hunt-color-remove-${group.id}`} type="button" mix={on<HTMLButtonElement, 'click'>('click', () => actions.removeGroup(group.id))}>Supprimer</button>
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
      <option id={`quiz-hunt-page-color-none-${page.id}`} value="">Aucune</option>
      {document.settings.groups.map((group) => <option id={`quiz-hunt-page-color-option-${page.id}-${group.id}`} key={group.id} value={group.id}>{group.name}</option>)}
    </select>
    <label id={`quiz-hunt-page-mandatory-label-${page.id}`} htmlFor={`quiz-hunt-page-mandatory-${page.id}`}>Obligatoire</label>
    <input id={`quiz-hunt-page-mandatory-${page.id}`} type="checkbox" checked={page.mandatory} mix={on<HTMLInputElement, 'change'>('change', (event) => actions.setMandatory(page.id, event.currentTarget.checked))} />
  </fieldset>
}

/** Creates one bank page or a root text page through the mod facade. */
function createPage(actions: QuizHuntEditorFacade, chapterId: string | null, fallbackName: string): void {
  const name = window.prompt('Nom de la page', fallbackName)
  if (name?.trim()) actions.createPage(chapterId, name.trim())
}
