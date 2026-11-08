import type { PersoDoc, SceneDoc, StoryDoc } from 'codplay/scene/types'
import { ELCE_EVENTS } from '../../reading/learning-reading-events'
import type { ElceResolvedPlayerSettings } from '../../../../domain/editor-settings/editor-settings-types'
import type { LearningDocument } from '../../document/learning-document'
import type { ElceTextValue } from '../../../../resources/document/rich-text-types'
import { plainTextFromValue } from '../../inline-text/learning-inline-text-value'
import { createInlineTextSceneParts, wrapInlineTextSceneParts } from '../../inline-text/learning-inline-text-scene'
import { SCENARIO_ENTRY_KIND } from '../learning-organization-config'
import { scenarioChapterPageIds } from '../learning-scenario-tree'
import type { ScenarioEntry } from '../learning-scenario-entry-types'

export type SummaryPresentation = 'menu' | 'root'
export type SummaryChapterReadingStatus = 'locked' | 'read' | 'partial' | 'unread'

interface InlineMarkupProjection {
  readonly markup: string
  readonly persos: readonly PersoDoc<string>[]
}

type SummaryTreeEntry =
  | Readonly<{ kind: 'page'; entry: SummaryEntry }>
  | Readonly<{ kind: 'chapter'; id: string; title: ElceTextValue; entry?: SummaryEntry; children: readonly SummaryTreeEntry[] }>

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
  const summaryTree = createSummaryTree(document, entries)
  const entryProjection = presentation === 'root'
    ? createRootEntryListMarkup(prefix, summaryTree)
    : createEntryListMarkup(prefix, summaryTree)
  const descriptionProjection = presentation === 'root'
    ? createInlineMarkup(summary.description, `${prefix}-description`, 'p', 'elce-summary__description')
    : { markup: '', persos: [] as readonly PersoDoc<string>[] }
  const entryPersos = presentation === 'root'
    ? entries.map((entry) => createEntryPerso(prefix, entry, 'root'))
    : entries.map((entry) => createEntryPerso(prefix, entry, 'menu'))
  const chapterStatusPersos = presentation === 'root'
    ? summaryChapterIds(summaryTree)
      .filter((chapterId) => !entries.some((entry) => entry.kind === 'chapter' && entry.id === chapterId))
      .map((chapterId) => createChapterStatusPerso(prefix, chapterId))
    : []
  const chapterStatusEvents = presentation === 'root'
    ? summaryChapterIds(summaryTree).flatMap((chapterId) => chapterStatusEventsFor(chapterId))
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

/** Builds flat click targets while preserving depth-first scenario order. */
export function buildSummaryEntries(document: LearningDocument): readonly SummaryEntry[] {
  const pages = new Map(document.pages.map((page) => [page.id, page]))
  const entries: SummaryEntry[] = []
  const chapters = new Map(document.chapters.map((chapter) => [chapter.id, chapter]))
  const visit = (scenarioEntries: readonly ScenarioEntry[], parentChapterId: string | null): void => {
    for (const scenarioEntry of scenarioEntries) {
      switch (scenarioEntry.kind) {
        case SCENARIO_ENTRY_KIND.PAGE: {
          const page = pages.get(scenarioEntry.pageId)
          if (document.data.summary.displayMode === 'pages' && page !== undefined) {
            entries.push({ id: page.id, title: page.name, pageId: page.id, kind: 'page', parentChapterId })
          }
          break
        }
        case SCENARIO_ENTRY_KIND.CHAPTER: {
          const chapter = chapters.get(scenarioEntry.chapterId)
          if (chapter === undefined) break
          if (document.data.summary.displayMode === 'chapters') {
            const pageId = scenarioChapterPageIds(document.data, chapter.id)[0]
            if (pageId !== undefined) entries.push({ id: chapter.id, title: chapter.name, pageId, kind: 'chapter', parentChapterId })
          }
          visit(chapter.entries, chapter.id)
          break
        }
      }
    }
  }
  visit(document.data.scenarioEntries, null)
  return entries
}

/** Builds the presentation tree from ordered entries and their retained click targets. */
function createSummaryTree(
  document: LearningDocument,
  entries: readonly SummaryEntry[],
): readonly SummaryTreeEntry[] {
  const chapters = new Map(document.chapters.map((chapter) => [chapter.id, chapter]))
  const pages = new Map(entries.filter((entry) => entry.kind === 'page').map((entry) => [entry.pageId, entry]))
  const chapterEntries = new Map(entries.filter((entry) => entry.kind === 'chapter').map((entry) => [entry.id, entry]))
  const visit = (scenarioEntries: readonly ScenarioEntry[]): readonly SummaryTreeEntry[] => scenarioEntries.flatMap<SummaryTreeEntry>((scenarioEntry) => {
    switch (scenarioEntry.kind) {
      case SCENARIO_ENTRY_KIND.PAGE: {
        const page = pages.get(scenarioEntry.pageId)
        return page === undefined ? [] : [{ kind: 'page', entry: page }]
      }
      case SCENARIO_ENTRY_KIND.CHAPTER: {
        const chapter = chapters.get(scenarioEntry.chapterId)
        if (chapter === undefined) return []
        const children = visit(chapter.entries)
        const entry = chapterEntries.get(chapter.id)
        if (entry === undefined && children.length === 0) return []
        return [{ kind: 'chapter', id: chapter.id, title: chapter.name, ...(entry === undefined ? {} : { entry }), children }]
      }
    }
  })
  return visit(document.data.scenarioEntries)
}

/** Returns all retained chapter identifiers in their visible tree order. */
function summaryChapterIds(entries: readonly SummaryTreeEntry[]): readonly string[] {
  return entries.flatMap((entry) => entry.kind === 'page' ? [] : [entry.id, ...summaryChapterIds(entry.children)])
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

/** Writes the ordered summary tree with chapter links or page links as configured. */
function createRootEntryListMarkup(
  prefix: string,
  entries: readonly SummaryTreeEntry[],
): InlineMarkupProjection {
  const persos: PersoDoc<string>[] = []
  const renderEntry = (entry: SummaryTreeEntry, depth: number): string => {
    if (entry.kind === 'page') {
      const pageMarkup = createEntryMarkup(prefix, entry.entry, 'root')
      if (depth > 0) return pageMarkup
      return `<li id="${prefix}-chapter-row-${entry.entry.id}" class="elce-summary__chapter-row elce-summary__chapter-row--standalone"><span id="${prefix}-chapter-spacer-${entry.entry.id}" class="elce-summary__chapter-spacer" aria-hidden="true"></span><ol id="${prefix}-chapter-pages-${entry.entry.id}" class="elce-summary__chapter-pages">${pageMarkup}</ol></li>`
    }
    const title = entry.entry === undefined
      ? createInlineMarkup(entry.title, `${prefix}-chapter-title-${entry.id}`, 'span')
      : undefined
    if (title !== undefined) persos.push(...title.persos)
    const heading = entry.entry === undefined
      ? `<h2 id="${prefix}-chapter-heading-${entry.id}" class="elce-summary__chapter-title elce-summary__chapter-title--with-status">${createChapterStatusHostMarkup(prefix, entry.id)}${title?.markup ?? ''}</h2>`
      : `<h2 id="${prefix}-chapter-heading-${entry.id}" class="elce-summary__chapter-title"><!-- data-part="${prefix}:entry:${entry.entry.id}" --></h2>`
    const childMarkup = entry.children.map((child) => renderEntry(child, depth + 1)).join('')
    const children = childMarkup.length === 0 ? '' : `<ol id="${prefix}-chapter-pages-${entry.id}" class="elce-summary__chapter-pages">${childMarkup}</ol>`
    const rowClassName = depth === 0 ? 'elce-summary__chapter-row' : 'elce-summary__chapter-row elce-summary__chapter-row--nested'
    return `<li id="${prefix}-chapter-row-${entry.id}" class="${rowClassName}">${heading}${children}</li>`
  }
  const markup = entries.map((entry) => renderEntry(entry, 0)).join('')
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

/** Writes nested menu entries in the same order as the root summary. */
function createEntryListMarkup(
  prefix: string,
  entries: readonly SummaryTreeEntry[],
): InlineMarkupProjection {
  const persos: PersoDoc<string>[] = []
  const renderEntry = (entry: SummaryTreeEntry): string => {
    if (entry.kind === 'page') return createEntryMarkup(prefix, entry.entry, 'menu')
    const title = entry.entry === undefined
      ? createInlineMarkup(entry.title, `${prefix}-chapter-heading-${entry.id}`, 'h2', 'elce-player-menu__group-title')
      : undefined
    if (title !== undefined) persos.push(...title.persos)
    const heading = entry.entry === undefined
      ? title?.markup ?? ''
      : `<h2 id="${prefix}-chapter-heading-${entry.id}" class="elce-player-menu__group-title"><!-- data-part="${prefix}:entry:${entry.entry.id}" --></h2>`
    const children = entry.children.map(renderEntry).join('')
    const list = children.length === 0 ? '' : `<ol id="${prefix}-chapter-pages-${entry.id}" class="elce-player-menu__pages">${children}</ol>`
    return `<li id="${prefix}-chapter-${entry.id}" class="elce-player-menu__group">${heading}${list}</li>`
  }
  const markup = entries.map(renderEntry).join('')
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
