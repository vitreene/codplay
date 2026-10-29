import type { PersoDoc, SceneDoc, StoryDoc } from 'codplay/scene/types'
import { ELCE_EVENTS } from '../../config/document-config'
import type { ElceResolvedPlayerSettings } from '../../domain/editor-settings/editor-settings-types'
import type { ElceDocument } from '../../domain/document/document-model'

export type SummaryPresentation = 'menu' | 'root'

/** Builds an Elcé-owned CodPlay scene for either presentation of the same summary. */
export function buildSummaryScene(
  document: ElceDocument,
  presentation: SummaryPresentation,
  drawerMotion: ElceResolvedPlayerSettings['navigation']['summaryDrawerMotion'],
  mediaSources: Readonly<Record<string, string>> = {},
): SceneDoc<string> {
  const summary = document.data.summary
  const prefix = `${document.id}:summary:${presentation}`
  const entries = buildSummaryEntries(document)
  const entryMarkup = createEntryListMarkup(document, prefix, entries, presentation)
  const menuPersos = presentation === 'menu'
    ? createMenuDrawerPersos(
      document.id,
      summary.title,
      summary.description,
      summary.showAtRoot,
      entries.map((entry) => entry.pageId),
      summary.showInMenu ? entryMarkup : '',
      drawerMotion,
    )
    : []
  const story: StoryDoc<string> = {
    id: 'main',
    initial: { move: '@root' },
    listen: [...new Set([
      ELCE_EVENTS.PRESENTATION_MENU,
      ELCE_EVENTS.MENU_DRAWER_OPEN,
      ELCE_EVENTS.MENU_DRAWER_CLOSE,
      ELCE_EVENTS.MENU_SUMMARY,
      ...entries.map((entry) => `${ELCE_EVENTS.PRESENTATION_MENU_PAGE_PREFIX}${entry.pageId}`),
      ...entries.map((entry) => menuEvent(entry.pageId)),
    ])].map((eventName) => ({ on: eventName })),
    persos: [
      {
        id: `${prefix}-root`,
        type: 'layout',
        initial: {
          move: '@root',
          className: presentation === 'root' ? 'elce-summary elce-summary--root' : 'elce-player-menu-scene',
          markup: createSummaryMarkup(prefix, summary.title, summary.description, entryMarkup, presentation),
        },
        ...(presentation === 'menu' ? { actions: { [ELCE_EVENTS.PRESENTATION_MENU]: {} } } : {}),
      },
      ...menuPersos,
      ...entries.map((entry) => createEntryPerso(prefix, entry, presentation)),
      ...(presentation === 'root' && summary.backgroundMediaId !== null && mediaSources[summary.backgroundMediaId] !== undefined
        ? [createBackgroundImage(prefix, mediaSources[summary.backgroundMediaId]!)]
        : []),
    ],
  }
  return { id: `${document.id}-${presentation}-summary-scene`, stories: { main: story } }
}

export type SummaryEntry = Readonly<{
  readonly id: string
  readonly title: string
  readonly pageId: string
  readonly kind: 'chapter' | 'page'
  readonly parentChapterId: string | null
}>

/** Builds menu entries from the same retained chapter and page projection. */
export function buildSummaryEntries(document: ElceDocument): readonly SummaryEntry[] {
  const pages = new Map(document.pages.map((page) => [page.id, page]))
  const entries: SummaryEntry[] = []
  if (document.data.summary.displayMode === 'chapters') {
    for (const entry of document.data.scenarioEntries) {
      if (entry.kind === 'page') {
        const page = pages.get(entry.pageId)
        if (page !== undefined) entries.push({ id: page.id, title: page.name, pageId: page.id, kind: 'page', parentChapterId: null })
        continue
      }
      const chapter = document.chapters.find((candidate) => candidate.id === entry.chapterId)
      const pageId = chapter?.pageIds[0]
      if (chapter !== undefined && pageId !== undefined) entries.push({ id: chapter.id, title: chapter.name, pageId, kind: 'chapter', parentChapterId: null })
    }
    return entries
  }

  for (const entry of document.data.scenarioEntries) {
    if (entry.kind === 'page') {
      const page = pages.get(entry.pageId)
      if (page !== undefined) entries.push({ id: page.id, title: page.name, pageId: page.id, kind: 'page', parentChapterId: null })
      continue
    }
    const chapter = document.chapters.find((candidate) => candidate.id === entry.chapterId)
    if (chapter === undefined) continue
    for (const pageId of chapter.pageIds) {
      const page = pages.get(pageId)
      if (page !== undefined) entries.push({ id: page.id, title: page.name, pageId: page.id, kind: 'page', parentChapterId: chapter.id })
    }
  }
  return entries
}

/** Writes the semantic summary frame and stable button hosts. */
function createSummaryMarkup(
  prefix: string,
  title: string,
  description: string,
  entries: string,
  presentation: SummaryPresentation,
): string {
  if (presentation === 'menu') {
    return `<div id="${prefix}-root" class="elce-player-menu-scene">
      <!-- data-part="${prefix}:drawer:host" -->
    </div>`
  }
  const descriptionMarkup = description.length === 0 ? '' : `<p id="${prefix}-description" class="elce-summary__description">${escapeHtmlText(description)}</p>`
  return `<main id="${prefix}-root" class="elce-summary elce-summary--root" aria-label="Sommaire du document">
    <div id="${prefix}-background-host" class="elce-summary__background-host"><!-- data-part="${prefix}:background" --></div>
    <div id="${prefix}-content" class="elce-summary__content">
      <h1 id="${prefix}-title" class="elce-summary__title">${escapeHtmlText(title)}</h1>
      ${descriptionMarkup}
      <ol id="${prefix}-entries" class="elce-summary__entries">${entries}</ol>
    </div>
  </main>`
}

/** Creates the menu drawer, its controls, and the external summary list host. */
function createMenuDrawerPersos(
  documentId: string,
  title: string,
  description: string,
  showSummaryLink: boolean,
  pageIds: readonly string[],
  entries: string,
  drawerMotion: ElceResolvedPlayerSettings['navigation']['summaryDrawerMotion'],
): readonly PersoDoc<string>[] {
  const prefix = `${documentId}:summary:menu`
  const drawerTarget = `${prefix}:drawer:host`
  const backdropTarget = `${prefix}:drawer:backdrop`
  const panelTarget = `${prefix}:drawer:panel`
  const closeTarget = `${prefix}:drawer:close`
  const summaryTarget = `${prefix}:drawer:summary-link`
  const descriptionMarkup = description.length === 0
    ? ''
    : `<p id="${documentId}-menu-description" class="elce-player-menu__description">${escapeHtmlText(description)}</p>`
  const openDrawer = {
    attr: { 'data-open': 'true', 'aria-hidden': 'false' },
    style: { opacity: drawerMotion.open.opacity },
  }
  const closeDrawer = {
    attr: { 'data-open': 'false', 'aria-hidden': 'true' },
    style: { opacity: drawerMotion.close.opacity },
  }
  const closeEvents = Object.fromEntries([
    ELCE_EVENTS.MENU_DRAWER_CLOSE,
    ELCE_EVENTS.MENU_SUMMARY,
    ...pageIds.map(menuEvent),
  ].map((eventName) => [eventName, closeDrawer]))
  return [
    {
      id: `${documentId}-menu-drawer`,
      type: 'layout',
      initial: {
        move: { target: drawerTarget },
        className: 'elce-player-menu-drawer',
        attr: { 'data-open': 'false', 'aria-hidden': 'true' },
        markup: `<div id="${documentId}-menu-drawer-root" class="elce-player-menu-drawer" role="dialog" aria-label="Sommaire du document" aria-modal="true" aria-hidden="true" tabindex="-1">
          <!-- data-part="${backdropTarget}" -->
          <!-- data-part="${panelTarget}" -->
        </div>`,
      },
      actions: { [ELCE_EVENTS.MENU_DRAWER_OPEN]: openDrawer, ...closeEvents },
      emit: {
        keydown: {
          keyCode: 'Escape',
          preventDefault: true,
          event: { name: ELCE_EVENTS.MENU_DRAWER_CLOSE, visibility: 'public' },
        },
      },
    },
    {
      id: `${documentId}-menu-backdrop`,
      type: 'layout',
      initial: {
        move: { target: backdropTarget },
        className: 'elce-player-menu-backdrop-host',
        markup: `<button id="${documentId}-menu-backdrop" class="elce-player-menu-backdrop" type="button" tabindex="-1" aria-label="Fermer le sommaire"></button>`,
      },
      emit: { click: { event: { name: ELCE_EVENTS.MENU_DRAWER_CLOSE, visibility: 'public' } } },
    },
    {
      id: `${documentId}-menu-panel`,
      type: 'layout',
      initial: {
        move: { target: panelTarget },
        className: 'elce-player-menu-panel',
        markup: `<aside id="${documentId}-menu-panel-root" class="elce-player-menu-panel">
          <!-- data-part="${closeTarget}" -->
          <nav id="${documentId}-menu-root" class="elce-player-menu" aria-label="Chapitres et pages du document">
            <h2 id="${documentId}-menu-title" class="elce-player-menu__title">${escapeHtmlText(title)}</h2>
            ${descriptionMarkup}
            <!-- data-part="${summaryTarget}" -->
            <div id="${documentId}-menu-scroll" class="elce-player-menu__scroll">
              <ol id="${prefix}-entries" class="elce-player-menu__entries">${entries}</ol>
            </div>
          </nav>
        </aside>`,
      },
      actions: {
        [ELCE_EVENTS.MENU_DRAWER_OPEN]: { style: { translateX: drawerMotion.open.translateX } },
        ...Object.fromEntries(Object.keys(closeEvents).map((eventName) => [
          eventName,
          { style: { translateX: drawerMotion.close.translateX } },
        ])),
      },
    },
    createMenuClosePerso(documentId, closeTarget),
    ...(showSummaryLink ? [createMenuSummaryPerso(documentId, summaryTarget)] : []),
  ]
}

/** Creates the menu close button that returns focus to the layout toggle. */
function createMenuClosePerso(documentId: string, target: string): PersoDoc<string> {
  return {
    id: `${documentId}-menu-close`,
    type: 'layout',
    initial: {
      move: { target },
      markup: `<button id="${documentId}-menu-close" class="elce-player-menu-close" type="button" aria-label="Fermer le sommaire">
        <svg id="${documentId}-menu-close-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path id="${documentId}-menu-close-icon-path" d="M6 6l12 12M18 6L6 18" /></svg>
      </button>`,
    },
    emit: { click: { event: { name: ELCE_EVENTS.MENU_DRAWER_CLOSE, visibility: 'public' } } },
  }
}

/** Creates the optional menu button that routes to the dedicated root summary. */
function createMenuSummaryPerso(documentId: string, target: string): PersoDoc<string> {
  return {
    id: `${documentId}-menu-summary-button`,
    type: 'tag',
    initial: { tag: 'button', content: 'Sommaire', attr: { type: 'button' }, className: 'elce-player-menu__chapter-button', move: { target } },
    emit: { click: { event: { name: ELCE_EVENTS.MENU_SUMMARY, visibility: 'public' } } },
  }
}

/** Formats the public page route used by menu buttons. */
function menuEvent(pageId: string): string {
  return `${ELCE_EVENTS.MENU_PREFIX}${pageId}`
}

/** Creates one explicitly identified list row and CodPlay button target. */
function createEntryMarkup(prefix: string, entry: SummaryEntry, presentation: SummaryPresentation): string {
  const rowId = `${prefix}-row-${entry.id}`
  const partId = `${prefix}:entry:${entry.id}`
  const className = presentation === 'root'
    ? 'elce-summary__entry'
    : entry.kind === 'chapter' ? 'elce-player-menu__group' : 'elce-player-menu__page-row'
  return `<li id="${rowId}" class="${className}" data-chapter-id="${entry.parentChapterId ?? ''}"><!-- data-part="${partId}" --></li>`
}

/** Groups retained pages under their retained chapter while preserving root order. */
function createEntryListMarkup(
  document: ElceDocument,
  prefix: string,
  entries: readonly SummaryEntry[],
  presentation: SummaryPresentation,
): string {
  if (document.data.summary.displayMode === 'chapters') {
    return entries.map((entry) => createEntryMarkup(prefix, entry, presentation)).join('')
  }
  const pagesById = new Map(document.pages.map((page) => [page.id, page]))
  return document.data.scenarioEntries.map((scenarioEntry) => {
    if (scenarioEntry.kind === 'page') {
      const entry = entries.find((candidate) => candidate.id === scenarioEntry.pageId)
      return entry === undefined ? '' : createEntryMarkup(prefix, entry, presentation)
    }
    const chapter = document.chapters.find((candidate) => candidate.id === scenarioEntry.chapterId)
    if (chapter === undefined) return ''
    const chapterPages = chapter.pageIds.flatMap((pageId) => {
      if (!pagesById.has(pageId)) return []
      const entry = entries.find((candidate) => candidate.id === pageId)
      return entry === undefined ? [] : [createEntryMarkup(prefix, entry, presentation)]
    }).join('')
    if (chapterPages.length === 0) return ''
    const listClass = presentation === 'root' ? 'elce-summary__chapter-pages' : 'elce-player-menu__pages'
    const groupClass = presentation === 'root' ? 'elce-summary__chapter' : 'elce-player-menu__group'
    const titleClass = presentation === 'root' ? 'elce-summary__chapter-title' : 'elce-player-menu__group-title'
    return `<li id="${prefix}-chapter-${chapter.id}" class="${groupClass}">
      <h2 id="${prefix}-chapter-heading-${chapter.id}" class="${titleClass}">${escapeHtmlText(chapter.name)}</h2>
      <ol id="${prefix}-chapter-pages-${chapter.id}" class="${listClass}">${chapterPages}</ol>
    </li>`
  }).join('')
}

/** Creates the button that routes through the existing Sighty menu event. */
function createEntryPerso(prefix: string, entry: SummaryEntry, presentation: SummaryPresentation): PersoDoc<string> {
  const chapter = entry.kind === 'chapter'
  const className = presentation === 'root'
    ? `elce-summary__entry-button elce-summary__entry-button--${entry.kind}`
    : chapter ? 'elce-player-menu__chapter-button' : 'elce-player-menu__page-button'
  const stateEvent = `${ELCE_EVENTS.PRESENTATION_MENU_PAGE_PREFIX}${entry.pageId}`
  return {
    id: `${prefix}-button-${entry.id}`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: entry.title,
      className,
      attr: { type: 'button', 'data-page-id': entry.pageId, 'data-locked': 'false', 'data-active': 'false', 'aria-label': entry.title },
      move: { target: `${prefix}:entry:${entry.id}` },
    },
    emit: { click: { event: { name: `${ELCE_EVENTS.MENU_PREFIX}${entry.pageId}`, visibility: 'public' } } },
    actions: {
      [stateEvent]: { attr: { 'data-active': 'false', 'data-locked': 'false', disabled: false, 'aria-label': entry.title } },
    },
  }
}

/** Places a decorative image behind the viewport summary content. */
function createBackgroundImage(prefix: string, source: string): PersoDoc<string> {
  return {
    id: `${prefix}-background-image`,
    type: 'img',
    initial: {
      src: source,
      alt: '',
      className: 'elce-summary__background-image',
      move: { target: `${prefix}:background` },
    },
  }
}

/** Escapes author text before embedding it in CodPlay scene markup. */
function escapeHtmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}
