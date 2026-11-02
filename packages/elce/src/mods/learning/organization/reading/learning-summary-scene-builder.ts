import type { PersoDoc, SceneDoc, StoryDoc } from 'codplay/scene/types'
import { ELCE_EVENTS } from '../../reading/learning-reading-events'
import type { ElceResolvedPlayerSettings } from '../../../../domain/editor-settings/editor-settings-types'
import type { LearningDocument } from '../../document/learning-document'
import type { ElceTextValue } from '../../../../resources/document/rich-text-types'
import { plainTextFromValue } from '../../inline-text/learning-inline-text-value'
import { createInlineTextSceneParts, wrapInlineTextSceneParts } from '../../inline-text/learning-inline-text-scene'

export type SummaryPresentation = 'menu' | 'root'
export type SummaryChapterReadingStatus = 'locked' | 'read' | 'partial' | 'unread'

interface InlineMarkupProjection {
  readonly markup: string
  readonly persos: readonly PersoDoc<string>[]
}

interface SummaryRootGroup {
  readonly id: string
  readonly chapterTitle: ElceTextValue | null
  readonly chapterEntry?: SummaryEntry
  readonly pages: readonly SummaryEntry[]
}

/** Builds an Elcé-owned CodPlay scene for either presentation of the same summary. */
export function buildSummaryScene(
  document: LearningDocument,
  presentation: SummaryPresentation,
  drawerMotion: ElceResolvedPlayerSettings['navigation']['summaryDrawerMotion'],
  mediaSources: Readonly<Record<string, string>> = {},
): SceneDoc<string> {
  const summary = document.data.summary
  const prefix = `${document.id}:summary:${presentation}`
  const entries = buildSummaryEntries(document)
  const rootGroups = presentation === 'root' ? createRootSummaryGroups(document, entries) : []
  const entryProjection = presentation === 'root'
    ? createRootEntryListMarkup(prefix, rootGroups, summary.displayMode === 'pages')
    : createEntryListMarkup(document, prefix, entries)
  const descriptionProjection = presentation === 'root'
    ? createInlineMarkup(summary.description, `${prefix}-description`, 'p', 'elce-summary__description')
    : { markup: '', persos: [] as readonly PersoDoc<string>[] }
  const entryPersos = presentation === 'root'
    ? rootGroups.flatMap((group) => [
      ...(group.chapterEntry === undefined ? [] : [createEntryPerso(prefix, group.chapterEntry, 'root')]),
      ...group.pages.map((entry) => createEntryPerso(prefix, entry, 'root')),
    ])
    : entries.map((entry) => createEntryPerso(prefix, entry, 'menu'))
  const chapterStatusPersos = presentation === 'root'
    ? rootGroups
      .filter((group) => group.chapterTitle !== null && group.chapterEntry === undefined)
      .map((group) => createChapterStatusPerso(prefix, group.id))
    : []
  const chapterStatusEvents = presentation === 'root'
    ? rootGroups
      .filter((group) => group.chapterTitle !== null)
      .flatMap((group) => chapterStatusEventsFor(group.id))
    : []
  const menuPersos = presentation === 'menu'
    ? createMenuDrawerPersos(
      document.id,
      summary.title,
      summary.description,
      summary.showAtRoot,
      entries.map((entry) => entry.pageId),
      entryProjection,
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
      ...chapterStatusEvents,
      ...entries.map((entry) => menuEvent(entry.pageId)),
    ])].map((eventName) => ({ on: eventName })),
    persos: [
      {
        id: `${prefix}-root`,
        type: 'layout',
        initial: {
          move: '@root',
          className: presentation === 'root' ? 'elce-summary elce-summary--root' : 'elce-player-menu-scene',
          markup: createSummaryMarkup(prefix, descriptionProjection.markup, entryProjection.markup, presentation),
        },
        ...(presentation === 'menu' ? { actions: { [ELCE_EVENTS.PRESENTATION_MENU]: {} } } : {}),
      },
      ...menuPersos,
      ...(presentation === 'root' ? entryProjection.persos : []),
      ...descriptionProjection.persos,
      ...chapterStatusPersos,
      ...entryPersos,
      ...(presentation === 'root' && summary.backgroundMediaId !== null && mediaSources[summary.backgroundMediaId] !== undefined
        ? [createBackgroundImage(prefix, mediaSources[summary.backgroundMediaId]!)]
        : []),
    ],
  }
  return { id: `${document.id}-${presentation}-summary-scene`, stories: { main: story } }
}

export type SummaryEntry = Readonly<{
  readonly id: string
  readonly title: ElceTextValue
  readonly pageId: string
  readonly kind: 'chapter' | 'page'
  readonly parentChapterId: string | null
}>

/** Builds menu entries from the same retained chapter and page projection. */
export function buildSummaryEntries(document: LearningDocument): readonly SummaryEntry[] {
  const pages = new Map(document.pages.map((page) => [page.id, page]))
  const entries: SummaryEntry[] = []
  if (document.data.summary.displayMode === 'chapters') {
    for (const entry of document.data.scenarioEntries) {
      if (entry.kind !== 'chapter') continue
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

/** Groups root summary links into chapter and page columns using the display option. */
function createRootSummaryGroups(
  document: LearningDocument,
  entries: readonly SummaryEntry[],
): readonly SummaryRootGroup[] {
  const showPageTitles = document.data.summary.displayMode === 'pages'
  const pageEntries = new Map(entries.filter((entry) => entry.kind === 'page').map((entry) => [entry.pageId, entry]))
  const chapterEntries = new Map(entries.filter((entry) => entry.kind === 'chapter').map((entry) => [entry.id, entry]))
  const groups: SummaryRootGroup[] = []

  for (const scenarioEntry of document.data.scenarioEntries) {
    if (scenarioEntry.kind === 'page') {
      const page = pageEntries.get(scenarioEntry.pageId)
      if (showPageTitles && page !== undefined) groups.push({ id: page.id, chapterTitle: null, pages: [page] })
      continue
    }

    const chapter = document.chapters.find((candidate) => candidate.id === scenarioEntry.chapterId)
    if (chapter === undefined) continue
    const pages = chapter.pageIds.flatMap((pageId) => {
      const page = pageEntries.get(pageId)
      return page?.parentChapterId === chapter.id ? [page] : []
    })
    const chapterEntry = chapterEntries.get(chapter.id)
    if (chapterEntry === undefined && pages.length === 0) continue
    groups.push({
      id: chapter.id,
      chapterTitle: chapter.name,
      ...(chapterEntry === undefined ? {} : { chapterEntry }),
      pages: showPageTitles ? pages : [],
    })
  }

  return groups
}

/** Writes the semantic summary frame and stable entry hosts. */
function createSummaryMarkup(
  prefix: string,
  descriptionMarkup: string,
  entries: string,
  presentation: SummaryPresentation,
): string {
  if (presentation === 'menu') {
    return `<div id="${prefix}-root" class="elce-player-menu-scene">
      <!-- data-part="${prefix}:drawer:host" -->
    </div>`
  }
  return `<main id="${prefix}-root" class="elce-summary elce-summary--root" aria-label="Sommaire du document">
    <div id="${prefix}-background-host" class="elce-summary__background-host"><!-- data-part="${prefix}:background" --></div>
    <div id="${prefix}-content" class="elce-summary__content">
      ${descriptionMarkup}
      <ol id="${prefix}-entries" class="elce-summary__entries">${entries}</ol>
    </div>
  </main>`
}

/** Creates the menu drawer, its controls, and the external summary list host. */
function createMenuDrawerPersos(
  documentId: string,
  title: ElceTextValue,
  description: ElceTextValue,
  showSummaryLink: boolean,
  pageIds: readonly string[],
  entryProjection: InlineMarkupProjection,
  drawerMotion: ElceResolvedPlayerSettings['navigation']['summaryDrawerMotion'],
): readonly PersoDoc<string>[] {
  const prefix = `${documentId}:summary:menu`
  const drawerTarget = `${prefix}:drawer:host`
  const backdropTarget = `${prefix}:drawer:backdrop`
  const panelTarget = `${prefix}:drawer:panel`
  const closeTarget = `${prefix}:drawer:close`
  const summaryTarget = `${prefix}:drawer:summary-link`
  const titleProjection = createInlineMarkup(title, `${documentId}-menu-title`, 'h2', 'elce-player-menu__title')
  const descriptionProjection = createInlineMarkup(description, `${documentId}-menu-description`, 'p', 'elce-player-menu__description')
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
            ${titleProjection.markup}
            ${descriptionProjection.markup}
            <!-- data-part="${summaryTarget}" -->
            <div id="${documentId}-menu-scroll" class="elce-player-menu__scroll">
              <ol id="${prefix}-entries" class="elce-player-menu__entries">${entryProjection.markup}</ol>
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
    ...titleProjection.persos,
    ...descriptionProjection.persos,
    ...entryProjection.persos,
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

/** Creates one explicitly identified list row and CodPlay entry target. */
function createEntryMarkup(prefix: string, entry: SummaryEntry, presentation: SummaryPresentation): string {
  const rowId = `${prefix}-row-${entry.id}`
  const partId = `${prefix}:entry:${entry.id}`
  const className = presentation === 'root'
    ? 'elce-summary__entry'
    : entry.kind === 'chapter' ? 'elce-player-menu__group' : 'elce-player-menu__page-row'
  return `<li id="${rowId}" class="${className}" data-chapter-id="${entry.parentChapterId ?? ''}"><!-- data-part="${partId}" --></li>`
}

/** Writes root summary rows with separate chapter and page title columns. */
function createRootEntryListMarkup(
  prefix: string,
  groups: readonly SummaryRootGroup[],
  showPageTitles: boolean,
): InlineMarkupProjection {
  const persos: PersoDoc<string>[] = []
  const markup = groups.map((group) => {
    let chapterMarkup: string
    if (group.chapterTitle === null) {
      chapterMarkup = `<span id="${prefix}-chapter-spacer-${group.id}" class="elce-summary__chapter-spacer" aria-hidden="true"></span>`
    } else if (group.chapterEntry === undefined) {
      const title = createInlineMarkup(group.chapterTitle, `${prefix}-chapter-title-${group.id}`, 'span')
      persos.push(...title.persos)
      chapterMarkup = `<h2 id="${prefix}-chapter-heading-${group.id}" class="elce-summary__chapter-title elce-summary__chapter-title--with-status">${createChapterStatusHostMarkup(prefix, group.id)}${title.markup}</h2>`
    } else {
      chapterMarkup = `<h2 id="${prefix}-chapter-heading-${group.id}" class="elce-summary__chapter-title"><!-- data-part="${prefix}:entry:${group.chapterEntry.id}" --></h2>`
    }
    const pagesMarkup = showPageTitles && group.pages.length > 0
      ? `<ol id="${prefix}-chapter-pages-${group.id}" class="elce-summary__chapter-pages">${group.pages.map((entry) => createEntryMarkup(prefix, entry, 'root')).join('')}</ol>`
      : ''
    const rowClassName = [
      'elce-summary__chapter-row',
      group.chapterTitle === null ? 'elce-summary__chapter-row--standalone' : '',
      showPageTitles ? '' : 'elce-summary__chapter-row--levels-only',
    ].filter(Boolean).join(' ')
    return `<li id="${prefix}-chapter-row-${group.id}" class="${rowClassName}">${chapterMarkup}${pagesMarkup}</li>`
  }).join('')
  return { markup, persos }
}

/** Creates the status icon mount point beside a static chapter heading. */
function createChapterStatusHostMarkup(prefix: string, chapterId: string): string {
  return `<span id="${prefix}-chapter-status-host-${chapterId}" class="elce-summary__chapter-status-host"><!-- data-part="${prefix}:chapter-status:${chapterId}" --></span>`
}

/** Creates the chapter status icon whose label and state follow reader progress. */
function createChapterStatusPerso(prefix: string, chapterId: string): PersoDoc<string> {
  return {
    id: `${prefix}-chapter-status-${chapterId}`,
    type: 'tag',
    initial: {
      tag: 'span',
      content: '',
      className: 'elce-summary__chapter-status',
      attr: { 'data-reading-status': 'unread', role: 'img', 'aria-label': 'Non lu' },
      move: { target: `${prefix}:chapter-status:${chapterId}` },
    },
    actions: createChapterStatusActions(chapterId),
  }
}

/** Maps every chapter reading state to a stable private presentation event. */
function chapterStatusEventsFor(chapterId: string): readonly string[] {
  return (['locked', 'read', 'partial', 'unread'] as const)
    .map((status) => summaryChapterStatusEvent(chapterId, status))
}

/** Formats the private event used to update one chapter's visible state. */
export function summaryChapterStatusEvent(chapterId: string, status: SummaryChapterReadingStatus): string {
  return `${ELCE_EVENTS.PRESENTATION_CHAPTER_STATUS_PREFIX}${chapterId}:${status}`
}

/** Keeps chapter state actions on the existing presentation event circuit. */
function createChapterStatusActions(
  chapterId: string,
  chapterTitle?: string,
  pageId?: string,
): NonNullable<PersoDoc<string>['actions']> {
  const label = (status: string): string => chapterTitle === undefined ? status : `${chapterTitle}, ${status.toLocaleLowerCase('fr-FR')}`
  const attrs = (status: SummaryChapterReadingStatus) => ({
    ...(pageId === undefined ? {} : {
      href: '#',
      'data-page-id': pageId,
      'data-active': 'false',
      'data-locked': String(status === 'locked'),
      'aria-disabled': String(status === 'locked'),
    }),
    'data-reading-status': status,
    'aria-label': label(status === 'locked' ? 'Verrouillé' : status === 'read' ? 'Lu' : status === 'partial' ? 'Lu partiellement' : 'Non lu'),
  })
  return {
    [summaryChapterStatusEvent(chapterId, 'locked')]: { attr: attrs('locked') },
    [summaryChapterStatusEvent(chapterId, 'read')]: { attr: attrs('read') },
    [summaryChapterStatusEvent(chapterId, 'partial')]: { attr: attrs('partial') },
    [summaryChapterStatusEvent(chapterId, 'unread')]: { attr: attrs('unread') },
  }
}

/** Groups menu page buttons under their retained chapter while preserving scenario order. */
function createEntryListMarkup(
  document: LearningDocument,
  prefix: string,
  entries: readonly SummaryEntry[],
): InlineMarkupProjection {
  const persos: PersoDoc<string>[] = []
  if (document.data.summary.displayMode === 'chapters') {
    return { markup: entries.map((entry) => createEntryMarkup(prefix, entry, 'menu')).join(''), persos }
  }
  const pagesById = new Map(document.pages.map((page) => [page.id, page]))
  const markup = document.data.scenarioEntries.map((scenarioEntry) => {
    if (scenarioEntry.kind === 'page') {
      const entry = entries.find((candidate) => candidate.id === scenarioEntry.pageId)
      return entry === undefined ? '' : createEntryMarkup(prefix, entry, 'menu')
    }
    const chapter = document.chapters.find((candidate) => candidate.id === scenarioEntry.chapterId)
    if (chapter === undefined) return ''
    const chapterPages = chapter.pageIds.flatMap((pageId) => {
      if (!pagesById.has(pageId)) return []
      const entry = entries.find((candidate) => candidate.id === pageId)
      return entry === undefined ? [] : [createEntryMarkup(prefix, entry, 'menu')]
    }).join('')
    if (chapterPages.length === 0) return ''
    const listClass = 'elce-player-menu__pages'
    const groupClass = 'elce-player-menu__group'
    const titleClass = 'elce-player-menu__group-title'
    const title = createInlineMarkup(chapter.name, `${prefix}-chapter-heading-${chapter.id}`, 'h2', titleClass)
    persos.push(...title.persos)
    return `<li id="${prefix}-chapter-${chapter.id}" class="${groupClass}">
      ${title.markup}
      <ol id="${prefix}-chapter-pages-${chapter.id}" class="${listClass}">${chapterPages}</ol>
    </li>`
  }).join('')
  return { markup, persos }
}

/** Creates a root summary link or a menu button on the existing Sighty page event. */
function createEntryPerso(prefix: string, entry: SummaryEntry, presentation: SummaryPresentation): PersoDoc<string> {
  const rootLink = presentation === 'root'
  const chapter = entry.kind === 'chapter'
  const title = plainTextFromValue(entry.title)
  const className = rootLink
    ? `elce-summary__entry-link elce-summary__entry-link--${entry.kind}`
    : chapter ? 'elce-player-menu__chapter-button' : 'elce-player-menu__page-button'
  const stateEvent = `${ELCE_EVENTS.PRESENTATION_MENU_PAGE_PREFIX}${entry.pageId}`
  return {
    id: `${prefix}-${rootLink ? 'link' : 'button'}-${entry.id}`,
    type: 'tag',
    initial: {
      tag: rootLink ? 'a' : 'button',
      content: title,
      className,
      attr: rootLink
        ? {
          href: '#',
          'data-page-id': entry.pageId,
          'data-locked': 'false',
          'data-active': 'false',
          ...(entry.kind === 'chapter' ? { 'data-reading-status': 'unread' } : {}),
          'aria-disabled': 'false',
          'aria-label': title,
        }
        : { type: 'button', 'data-page-id': entry.pageId, 'data-locked': 'false', 'data-active': 'false', 'aria-disabled': 'false', 'aria-label': title },
      move: { target: `${prefix}:entry:${entry.id}` },
    },
    emit: {
      click: {
        ...(rootLink ? { preventDefault: true } : {}),
        event: { name: `${ELCE_EVENTS.MENU_PREFIX}${entry.pageId}`, visibility: 'public' },
      },
    },
    actions: {
      [stateEvent]: {
        attr: {
          'data-active': 'false',
          'data-locked': 'false',
          'aria-disabled': 'false',
          'aria-label': title,
          ...(rootLink ? {} : { disabled: false }),
        },
      },
      ...(rootLink && chapter ? createChapterStatusActions(entry.id, title, entry.pageId) : {}),
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

/** Creates safe static markup or ordered CodPlay targets for one text value. */
function createInlineMarkup(
  value: ElceTextValue,
  id: string,
  tag: string,
  className?: string,
): InlineMarkupProjection {
  if (plainTextFromValue(value).length === 0) return { markup: '', persos: [] }
  if (typeof value === 'string') {
    const classAttribute = className === undefined ? '' : ` class="${escapeHtmlText(className)}"`
    return { markup: `<${tag} id="${escapeHtmlText(id)}"${classAttribute}>${escapeHtmlText(value)}</${tag}>`, persos: [] }
  }
  const parts = createInlineTextSceneParts(value, id)
  return { markup: wrapInlineTextSceneParts(parts, id, tag, className), persos: parts.persos }
}

/** Escapes author text before embedding it in CodPlay scene markup. */
function escapeHtmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}
