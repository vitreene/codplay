import type { BdcId, ChapterId, PageId, ContentBdc, ContentChapter, ContentPage } from './content-document-types'

export interface ContentPlacementDocument {
  readonly pages: readonly ContentPage[]
  readonly bdcs: readonly ContentBdc[]
  readonly catalogPageIds: readonly PageId[]
  readonly catalogBdcIds: readonly BdcId[]
  readonly scenarioPageIds: readonly PageId[]
}

/** Validates unique page and BDC locations and returns their current placements. */
export function assertContentPlacementInvariants(document: ContentPlacementDocument): Set<BdcId> {
  const pageIds = new Set<PageId>()
  const bdcIds = new Set<BdcId>()
  const bdcById = new Map(document.bdcs.map((bdc) => [bdc.id, bdc]))
  for (const page of document.pages) {
    if (pageIds.has(page.id)) fail(`Page dupliquée : ${page.id}`)
    pageIds.add(page.id)
    for (const bdcId of page.bdcIds) {
      const bdc = bdcById.get(bdcId)
      if (bdc === undefined) fail(`Bdc inconnu dans la page ${page.id} : ${bdcId}`)
      if (bdcIds.has(bdcId)) fail(`Bdc placé deux fois dans la page ${page.id}`)
      bdcIds.add(bdcId)
      if (bdc.pageId !== page.id || bdc.parentBdcId !== null) fail(`Affectation de bdc incohérente : ${bdcId}`)
    }
  }
  for (const bdcId of document.catalogBdcIds) {
    const bdc = bdcById.get(bdcId)
    if (bdc === undefined) fail(`Bdc inconnu dans le catalogue : ${bdcId}`)
    if (bdcIds.has(bdcId)) fail(`Bdc placé deux fois : ${bdcId}`)
    bdcIds.add(bdcId)
    if (bdc.pageId !== null || bdc.parentBdcId !== null) fail(`Affectation de catalogue incohérente : ${bdcId}`)
  }
  const scenarioPageIds = document.scenarioPageIds
  const placedPageIds = new Set([...scenarioPageIds, ...document.catalogPageIds])
  if (placedPageIds.size !== scenarioPageIds.length + document.catalogPageIds.length
    || placedPageIds.size !== document.pages.length) {
    fail('Chaque page doit avoir un emplacement unique')
  }
  for (const pageId of scenarioPageIds) {
    if (!pageIds.has(pageId)) fail(`Page de scénario inconnue : ${pageId}`)
  }
  return bdcIds
}

/** Finds a page by its document identifier. */
export function findPage<Page extends ContentPage>(pages: readonly Page[], pageId: PageId): Page {
  return pages.find((page) => page.id === pageId) ?? fail(`Page inconnue : ${pageId}`)
}

/** Finds a BDC by its document identifier. */
export function findBdc<Bdc extends ContentBdc>(bdcs: readonly Bdc[], bdcId: BdcId): Bdc {
  return bdcs.find((bdc) => bdc.id === bdcId) ?? fail(`Bdc inconnu : ${bdcId}`)
}

/** Finds a chapter by its document identifier. */
export function findChapter<Chapter extends ContentChapter>(chapters: readonly Chapter[], chapterId: ChapterId): Chapter {
  return chapters.find((chapter) => chapter.id === chapterId) ?? fail(`Chapitre inconnu : ${chapterId}`)
}

/** Raises a structural placement error with the existing French message. */
function fail(message: string): never {
  throw new Error(message)
}
