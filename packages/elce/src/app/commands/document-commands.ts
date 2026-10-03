import {
  BDC_LOCATION,
  BDC_TYPE,
  CHAPTER_TYPE,
  DEFAULT_EVALUATION_THRESHOLD,
  DEFAULT_PRESET_ID,
  MEDIA_TYPE,
  PAGE_LOCATION,
  PAGE_TYPE,
} from '../../config/document-config'
import type { BdcType, MediaType } from '../../config/document-config-types'
import {
  createEmptyRichTextDocument,
  ElceDocument,
  nextChapterName,
  nextPageName,
  createStableId,
} from '../../domain/document-model'
import { ElceAnchorReferenceService } from '../../domain/anchor-reference-service'
import type { Bdc, BdcId, Chapter, ChapterId, MediaId, Page, PageId, RichTextDocument } from '../../domain/document-types'
import type { BdcPlacement, CreatePageCommandInput, DocumentCommand, PagePlacement } from './document-command-types'

const anchorReferenceService = new ElceAnchorReferenceService()

/** Creates a page command while keeping identifier generation outside rendering. */
export function createPageCommand(input: CreatePageCommandInput): Extract<DocumentCommand, { type: 'page.create' }> {
  return { type: 'page.create', ...input }
}

/** Creates the first authoring action exposed by the application scaffold. */
export function createDefaultPageCommand(
  document: ElceDocument,
  name?: string,
): Extract<DocumentCommand, { type: 'page.create' }> {
  const chapter = document.chapters[0]
  if (chapter === undefined) fail('Impossible de créer une page sans chapitre.')
  return createPageCommand({
    pageId: createStableId('page'),
    bdcId: createStableId('bdc-section'),
    name,
    placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: chapter.id },
  })
}

/** Creates a chapter command with a stable generated identifier and a readable fallback name. */
export function createChapterCommand(
  document: ElceDocument,
  name?: string,
): Extract<DocumentCommand, { type: 'chapter.create' }> {
  return {
    type: 'chapter.create',
    chapterId: createStableId('chapter'),
    name: name?.trim() || nextChapterName(document),
  }
}

/** Creates the command used to move a page between the document's page collections. */
export function createPageMoveCommand(
  pageId: PageId,
  placement: PagePlacement,
): Extract<DocumentCommand, { type: 'page.move' }> {
  return { type: 'page.move', pageId, placement }
}

/** Creates the command that sends a page to the catalogue without deleting it. */
export function createPageRemoveCommand(pageId: PageId): Extract<DocumentCommand, { type: 'page.remove' }> {
  return { type: 'page.remove', pageId }
}

/** Creates the command that permanently deletes a page and its bdc. */
export function createPageDeleteCommand(pageId: PageId): Extract<DocumentCommand, { type: 'page.delete' }> {
  return { type: 'page.delete', pageId }
}

function fail(message: string): never {
  throw new Error(message)
}

function indexAtEndOrRequested(length: number, index: number | undefined): number {
  return Math.max(0, Math.min(index ?? length, length))
}

function insertAt<T>(values: readonly T[], value: T, index: number | undefined): readonly T[] {
  const result = [...values]
  result.splice(indexAtEndOrRequested(result.length, index), 0, value)
  return result
}

function removeValue<T>(values: readonly T[], value: T): readonly T[] {
  return values.filter((candidate) => candidate !== value)
}

function sourceIndexForPlacement(
  document: ElceDocument,
  page: Page,
  placement: PagePlacement,
): number | undefined {
  switch (placement.kind) {
    case PAGE_LOCATION.CATALOG:
      return undefined
    case PAGE_LOCATION.SCENARIO: {
      const sourceIndex = document.data.scenarioPageIds.indexOf(page.id)
      return sourceIndex < 0 ? undefined : sourceIndex
    }
    case PAGE_LOCATION.CHAPTER: {
      if (page.chapterId !== placement.chapterId) return undefined
      const chapter = document.chapters.find((candidate) => candidate.id === placement.chapterId)
      if (chapter === undefined) return undefined
      const sourceIndex = chapter.pageIds.indexOf(page.id)
      return sourceIndex < 0 ? undefined : sourceIndex
    }
  }
}

function indexAfterPageRemoval(
  document: ElceDocument,
  page: Page,
  placement: PagePlacement,
): number | undefined {
  const requestedIndex = pageIndexForPlacement(placement)
  const sourceIndex = sourceIndexForPlacement(document, page, placement)
  if (requestedIndex === undefined || sourceIndex === undefined || sourceIndex >= requestedIndex) return requestedIndex
  return requestedIndex - 1
}

function pageIndexForPlacement(placement: PagePlacement): number | undefined {
  switch (placement.kind) {
    case PAGE_LOCATION.CATALOG:
      return undefined
    case PAGE_LOCATION.SCENARIO:
    case PAGE_LOCATION.CHAPTER:
      return placement.index
  }
}

function replaceAt<T>(values: readonly T[], value: T, predicate: (candidate: T) => boolean): readonly T[] {
  return values.map((candidate) => (predicate(candidate) ? value : candidate))
}

function findPage(document: ElceDocument, pageId: PageId): Page {
  return document.pages.find((page) => page.id === pageId) ?? fail(`Page inconnue : ${pageId}`)
}

/** Finds a Flux page, which is the only page type that can own anchored text. */
function findFluxPage(document: ElceDocument, pageId: PageId): Page {
  const page = findPage(document, pageId)
  switch (page.type) {
    case PAGE_TYPE.FLUX:
      return page
    default:
      fail(`La page ${pageId} ne peut pas accueillir une ancre de texte.`)
  }
}

function findBdc(document: ElceDocument, bdcId: BdcId): Bdc {
  return document.bdcs.find((bdc) => bdc.id === bdcId) ?? fail(`Bdc inconnu : ${bdcId}`)
}

function findChapter(document: ElceDocument, chapterId: ChapterId): Chapter {
  return document.chapters.find((chapter) => chapter.id === chapterId) ?? fail(`Chapitre inconnu : ${chapterId}`)
}

function sectionForBdc(type: BdcType, bdcId: BdcId): Bdc['section'] {
  switch (type) {
    case BDC_TYPE.SECTION:
      return { title: '', markup: `<p id="${bdcId}-text"></p>`, content: createEmptyRichTextDocument() }
    default:
      return null
  }
}

function withPage(document: ElceDocument, page: Page): ElceDocument {
  return new ElceDocument({ ...document.data, pages: replaceAt(document.pages, page, (candidate) => candidate.id === page.id) })
}

function withBdc(document: ElceDocument, bdc: Bdc): ElceDocument {
  return new ElceDocument({ ...document.data, bdcs: replaceAt(document.bdcs, bdc, (candidate) => candidate.id === bdc.id) })
}

function placePage(document: ElceDocument, page: Page, placement: PagePlacement): ElceDocument {
  const insertionIndex = indexAfterPageRemoval(document, page, placement)
  const withoutPage = new ElceDocument({
    ...document.data,
    chapters: document.chapters.map((chapter) => ({ ...chapter, pageIds: removeValue(chapter.pageIds, page.id) })),
    scenarioPageIds: removeValue(document.data.scenarioPageIds, page.id),
    catalogPageIds: removeValue(document.data.catalogPageIds, page.id),
  })
  switch (placement.kind) {
    case PAGE_LOCATION.CATALOG:
      return withPage(
        new ElceDocument({ ...withoutPage.data, catalogPageIds: [...withoutPage.data.catalogPageIds, page.id] }),
        { ...page, chapterId: null },
      )
    case PAGE_LOCATION.SCENARIO: {
      const scenarioPageIds = insertAt(withoutPage.data.scenarioPageIds, page.id, insertionIndex)
      return withPage(new ElceDocument({ ...withoutPage.data, scenarioPageIds }), { ...page, chapterId: null })
    }
    case PAGE_LOCATION.CHAPTER: {
      const chapter = findChapter(withoutPage, placement.chapterId)
      const chapters = replaceAt(
        withoutPage.chapters,
        { ...chapter, pageIds: insertAt(chapter.pageIds, page.id, insertionIndex) },
        (candidate) => candidate.id === chapter.id,
      )
      return withPage(new ElceDocument({ ...withoutPage.data, chapters }), { ...page, chapterId: chapter.id })
    }
  }
}

function placeBdc(document: ElceDocument, bdc: Bdc, placement: BdcPlacement): ElceDocument {
  const withoutBdc = new ElceDocument({
    ...document.data,
    pages: document.pages.map((page) => ({ ...page, bdcIds: removeValue(page.bdcIds, bdc.id) })),
    catalogBdcIds: removeValue(document.data.catalogBdcIds, bdc.id),
  })
  switch (placement.kind) {
    case BDC_LOCATION.CATALOG:
      return withBdc(new ElceDocument({ ...withoutBdc.data, catalogBdcIds: [...withoutBdc.data.catalogBdcIds, bdc.id] }), {
        ...bdc,
        pageId: null,
      })
    case BDC_LOCATION.PAGE: {
      const page = findPage(withoutBdc, placement.pageId)
      const pages = replaceAt(
        withoutBdc.pages,
        { ...page, bdcIds: insertAt(page.bdcIds, bdc.id, placement.index) },
        (candidate) => candidate.id === page.id,
      )
      return withBdc(new ElceDocument({ ...withoutBdc.data, pages }), { ...bdc, pageId: page.id })
    }
  }
}

/** Deletes the unique bdc for a removed anchor and preserves its separate media resource. */
function deleteBdc(document: ElceDocument, bdcId: BdcId): ElceDocument {
  const bdc = findBdc(document, bdcId)
  return new ElceDocument({
    ...document.data,
    pages: document.pages.map((page) => ({ ...page, bdcIds: removeValue(page.bdcIds, bdc.id) })),
    bdcs: document.bdcs.filter((candidate) => candidate.id !== bdc.id),
    catalogBdcIds: removeValue(document.data.catalogBdcIds, bdc.id),
  })
}

/** Permanently deletes an unused catalog bdc while retaining its media resource. */
function deleteCatalogBdc(document: ElceDocument, bdcId: BdcId): ElceDocument {
  const bdc = findBdc(document, bdcId)
  switch (bdc.pageId) {
    case null:
      break
    default:
      fail(`Le bdc ${bdcId} est utilisé par une page et ne peut pas être supprimé du catalogue.`)
  }
  switch (document.data.catalogBdcIds.includes(bdc.id)) {
    case true:
      return deleteBdc(document, bdc.id)
    case false:
      fail(`Le bdc ${bdcId} n’est pas disponible dans le catalogue.`)
  }
}

function createPage(document: ElceDocument, command: Extract<DocumentCommand, { type: 'page.create' }>): ElceDocument {
  if (document.pages.some((page) => page.id === command.pageId)) fail(`Page déjà présente : ${command.pageId}`)
  if (document.bdcs.some((bdc) => bdc.id === command.bdcId)) fail(`Bdc déjà présent : ${command.bdcId}`)
  const page: Page = {
    id: command.pageId,
    name: command.name?.trim() || nextPageName(document),
    type: command.pageType ?? PAGE_TYPE.FLUX,
    chapterId: null,
    bdcIds: [],
  }
  const section: Bdc = {
    id: command.bdcId,
    type: BDC_TYPE.SECTION,
    presetId: DEFAULT_PRESET_ID.SECTION,
    pageId: page.id,
    mediaId: null,
    section: { title: '', markup: `<p id="${command.bdcId}-text"></p>`, content: createEmptyRichTextDocument() },
  }
  const withEntities = new ElceDocument({ ...document.data, pages: [...document.pages, page], bdcs: [...document.bdcs, section] })
  return placeBdc(placePage(withEntities, page, command.placement), section, { kind: BDC_LOCATION.PAGE, pageId: page.id })
}

function createChapter(document: ElceDocument, command: Extract<DocumentCommand, { type: 'chapter.create' }>): ElceDocument {
  if (document.chapters.some((chapter) => chapter.id === command.chapterId)) fail(`Chapitre déjà présent : ${command.chapterId}`)
  const chapter: Chapter = {
    id: command.chapterId,
    name: command.name,
    type: command.chapterType ?? CHAPTER_TYPE.STANDARD,
    pageIds: [],
    ...(command.chapterType === CHAPTER_TYPE.EVALUATION ? { evaluationThreshold: DEFAULT_EVALUATION_THRESHOLD } : {}),
  }
  return new ElceDocument({ ...document.data, chapters: [...document.chapters, chapter] })
}

function deleteChapter(document: ElceDocument, chapterId: ChapterId): ElceDocument {
  const chapter = findChapter(document, chapterId)
  if (chapter.pageIds.length > 0) fail(`Impossible de supprimer un chapitre non vide : ${chapterId}`)
  return new ElceDocument({
    ...document.data,
    chapters: document.chapters.filter((candidate) => candidate.id !== chapter.id),
  })
}

function createBdc(document: ElceDocument, command: Extract<DocumentCommand, { type: 'bdc.create' }>): ElceDocument {
  if (document.bdcs.some((bdc) => bdc.id === command.bdcId)) fail(`Bdc déjà présent : ${command.bdcId}`)
  const bdc: Bdc = {
    id: command.bdcId,
    type: command.bdcType,
    presetId: command.presetId,
    pageId: null,
    mediaId: command.mediaId ?? null,
    section: sectionForBdc(command.bdcType, command.bdcId),
  }
  return placeBdc(new ElceDocument({ ...document.data, bdcs: [...document.bdcs, bdc] }), bdc, command.placement)
}

/** Rebinds each BDC from duplicate media records to one canonical record. */
function mergeMedia(
  document: ElceDocument,
  canonicalMediaId: MediaId,
  duplicateMediaIds: readonly MediaId[],
): ElceDocument {
  const canonicalMedia = document.medias.find((media) => media.id === canonicalMediaId)
  switch (canonicalMedia) {
    case undefined:
      fail(`Média canonique inconnu : ${canonicalMediaId}`)
    default:
      break
  }
  switch (duplicateMediaIds.length) {
    case 0:
      fail('La fusion doit retirer au moins un média.')
    default:
      break
  }
  switch (new Set(duplicateMediaIds).size === duplicateMediaIds.length) {
    case true:
      break
    default:
      fail('La liste des médias à fusionner contient un doublon.')
  }
  switch (duplicateMediaIds.includes(canonicalMediaId)) {
    case false:
      break
    default:
      fail('Le média canonique ne peut pas être fusionné avec lui-même.')
  }

  const duplicateIds = new Set(duplicateMediaIds)
  for (const mediaId of duplicateMediaIds) {
    const media = document.medias.find((candidate) => candidate.id === mediaId)
    switch (media) {
      case undefined:
        fail(`Média à fusionner inconnu : ${mediaId}`)
      default:
        switch (media.type === canonicalMedia.type && media.mimeType === canonicalMedia.mimeType && media.size === canonicalMedia.size) {
          case true:
            break
          default:
            fail(`Média incompatible avec la ressource canonique : ${mediaId}`)
        }
        break
    }
  }

  return new ElceDocument({
    ...document.data,
    bdcs: document.bdcs.map((bdc) => duplicateIds.has(bdc.mediaId ?? '')
      ? { ...bdc, mediaId: canonicalMediaId }
      : bdc),
    medias: document.medias.filter((media) => !duplicateIds.has(media.id)),
  })
}

/** Returns the Section that owns an anchor edit and checks its page boundary. */
function findAnchorSection(document: ElceDocument, sectionBdcId: BdcId, pageId: PageId): Bdc {
  const section = findBdc(document, sectionBdcId)
  if (section.type !== BDC_TYPE.SECTION || section.pageId !== pageId || section.section === null) {
    fail(`La Section ${sectionBdcId} ne porte pas la page ${pageId}.`)
  }
  return section
}

/** Returns a Section payload after checking the bdc's discriminated type. */
function requireSectionData(bdc: Bdc): NonNullable<Bdc['section']> {
  switch (bdc.type) {
    case BDC_TYPE.SECTION:
      switch (bdc.section) {
        case null:
          fail(`Bdc Section incomplet : ${bdc.id}`)
        default:
          return bdc.section
      }
    default:
      fail(`Bdc non textuel : ${bdc.id}`)
  }
}

/** Updates a Section and deletes each unique bdc whose anchor leaves its text. */
function updateSectionContent(
  document: ElceDocument,
  sectionBdcId: BdcId,
  title: string | undefined,
  markup: string,
  content: RichTextDocument,
  keepUnreferencedBdcIds: readonly BdcId[] = [],
): ElceDocument {
  const section = findBdc(document, sectionBdcId)
  const sectionData = requireSectionData(section)

  const nextAnchorIds = anchorReferenceService.bdcIdsIn(content)
  if (new Set(nextAnchorIds).size !== nextAnchorIds.length) fail('Un même bdc ne peut apparaître qu’une fois dans une Section.')
  for (const anchorBdcId of nextAnchorIds) {
    switch (section.pageId) {
      case null:
        fail(`Une Section hors page ne peut pas porter l’ancre ${anchorBdcId}.`)
      default:
        break
    }
    const anchorBdc = findBdc(document, anchorBdcId)
    switch (anchorBdc.type) {
      case BDC_TYPE.IMAGE:
      case BDC_TYPE.VIDEO:
        switch (anchorBdc.pageId) {
          case section.pageId:
            break
          default:
            fail(`Le bdc ancré ${anchorBdcId} doit rester sur la page de sa Section.`)
        }
        break
      default:
        fail(`Seuls les bdcs image et vidéo peuvent être ancrés : ${anchorBdcId}`)
    }
  }

  let updated = document
  const retainedBdcIds = new Set(keepUnreferencedBdcIds)
  const deletedAnchorBdcIds = anchorReferenceService
    .removedBdcIds(sectionData.content, content)
    .filter((bdcId) => !retainedBdcIds.has(bdcId))
  for (const removedBdcId of deletedAnchorBdcIds) {
    const removedBdc = findBdc(updated, removedBdcId)
    switch (removedBdc.pageId) {
      case section.pageId:
        updated = deleteBdc(updated, removedBdc.id)
        break
      default:
        fail(`Le bdc retiré de l’ancre ${removedBdcId} n’est pas affecté à la page de sa Section.`)
    }
  }

  const updatedSection = findBdc(updated, sectionBdcId)
  const updatedSectionData = requireSectionData(updatedSection)
  return withBdc(updated, {
    ...updatedSection,
    section: { ...updatedSectionData, title: title ?? updatedSectionData.title, markup, content },
  })
}

/** Applies the one-command file/catalogue drop that creates and anchors a media bdc. */
function createAnchoredBdc(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'bdc.anchor.create' }>,
): ElceDocument {
  const page = findFluxPage(document, command.pageId)
  findAnchorSection(document, command.sectionBdcId, command.pageId)
  if (document.bdcs.some((bdc) => bdc.id === command.bdcId)) fail(`Bdc déjà présent : ${command.bdcId}`)
  if (!anchorReferenceService.bdcIdsIn(command.content).includes(command.bdcId)) fail(`L’ancre du bdc ${command.bdcId} manque dans la Section.`)

  const existingMedia = document.medias.find((media) => media.id === command.media.id)
  const media = existingMedia ?? command.media
  assertAnchorMediaType(command.bdcType, media.type)
  const withMedia = existingMedia === undefined
    ? new ElceDocument({ ...document.data, medias: [...document.medias, media] })
    : document
  const bdc: Bdc = {
    id: command.bdcId,
    type: command.bdcType,
    presetId: command.presetId,
    pageId: page.id,
    mediaId: command.media.id,
    section: null,
  }
  const pageWithBdc = replaceAt(
    withMedia.pages,
    { ...page, bdcIds: [...page.bdcIds, bdc.id] },
    (candidate) => candidate.id === page.id,
  )
  const withEntities = new ElceDocument({
    ...withMedia.data,
    pages: pageWithBdc,
    bdcs: [...withMedia.bdcs, bdc],
  })
  return updateSectionContent(withEntities, command.sectionBdcId, undefined, command.markup, command.content)
}

/** Verifies the type relationship before an image or video is attached to a bdc. */
function assertAnchorMediaType(bdcType: BdcType, mediaType: MediaType): void {
  switch (bdcType) {
    case BDC_TYPE.IMAGE:
      switch (mediaType) {
        case MEDIA_TYPE.IMAGE:
          return
        default:
          fail('Un bdc image doit référencer un média image.')
      }
    case BDC_TYPE.VIDEO:
      switch (mediaType) {
        case MEDIA_TYPE.VIDEO:
          return
        default:
          fail('Un bdc vidéo doit référencer un média vidéo.')
      }
    default:
      fail(`Type de bdc média non accepté : ${bdcType}`)
  }
}

/** Moves one unused unique media bdc from the catalogue into a Flux anchor. */
function attachCatalogBdc(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'bdc.anchor.attach' }>,
): ElceDocument {
  const page = findFluxPage(document, command.pageId)
  const section = findAnchorSection(document, command.sectionBdcId, page.id)
  const bdc = findBdc(document, command.bdcId)
  switch (bdc.pageId) {
    case null:
      break
    default:
      fail(`Le bdc ${bdc.id} n’est plus disponible dans le catalogue.`)
  }
  switch (document.data.catalogBdcIds.includes(bdc.id)) {
    case true:
      break
    default:
      fail(`Le bdc ${bdc.id} n’est pas dans le catalogue.`)
  }
  switch (bdc.type) {
    case BDC_TYPE.IMAGE:
    case BDC_TYPE.VIDEO:
      break
    default:
      fail(`Le bdc ${bdc.id} ne peut pas être inséré dans le texte.`)
  }
  switch (bdc.mediaId) {
    case null:
      fail(`Le bdc ${bdc.id} ne référence aucun média.`)
    default:
      break
  }
  const media = document.medias.find((candidate) => candidate.id === bdc.mediaId)
  switch (media) {
    case undefined:
      fail(`Le média du bdc ${bdc.id} est introuvable.`)
    default:
      assertAnchorMediaType(bdc.type, media.type)
  }
  switch (anchorReferenceService.bdcIdsIn(command.content).includes(bdc.id)) {
    case true:
      break
    default:
      fail(`L’ancre du bdc ${bdc.id} manque dans la Section.`)
  }
  switch (anchorReferenceService.bdcIdsIn(requireSectionData(section).content).includes(bdc.id)) {
    case false:
      break
    default:
      fail(`Le bdc ${bdc.id} est déjà ancré dans cette Section.`)
  }
  const placed = placeBdc(document, bdc, { kind: BDC_LOCATION.PAGE, pageId: page.id })
  return updateSectionContent(placed, command.sectionBdcId, undefined, command.markup, command.content)
}

/** Applies an anchor repositioning while keeping its bdc assignment unchanged. */
function moveAnchoredBdc(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'bdc.anchor.move' }>,
): ElceDocument {
  const anchorBdc = findBdc(document, command.anchorBdcId)
  if (anchorBdc.pageId === null) fail(`Le bdc ancré est hors page : ${command.anchorBdcId}`)
  findAnchorSection(document, command.sectionBdcId, anchorBdc.pageId)
  if (!anchorReferenceService.bdcIdsIn(command.content).includes(command.anchorBdcId)) fail(`Le déplacement a perdu l’ancre ${command.anchorBdcId}.`)
  return updateSectionContent(document, command.sectionBdcId, undefined, command.markup, command.content)
}

/** Removes an anchor and deletes its unique bdc while preserving its media. */
function removeAnchoredBdc(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'bdc.anchor.remove' }>,
): ElceDocument {
  const anchorBdc = findBdc(document, command.anchorBdcId)
  if (anchorBdc.pageId === null) fail(`Le bdc ancré est hors page : ${command.anchorBdcId}`)
  const section = findAnchorSection(document, command.sectionBdcId, anchorBdc.pageId)
  if (!anchorReferenceService.bdcIdsIn(requireSectionData(section).content).includes(command.anchorBdcId)) {
    fail(`L’ancre ${command.anchorBdcId} est introuvable dans sa Section.`)
  }
  if (anchorReferenceService.bdcIdsIn(command.content).includes(command.anchorBdcId)) fail(`La nouvelle Section conserve l’ancre ${command.anchorBdcId}.`)
  return updateSectionContent(document, command.sectionBdcId, undefined, command.markup, command.content)
}

/** Returns an anchored bdc to the catalogue while removing its unique anchor. */
function returnAnchoredBdc(
  document: ElceDocument,
  command: Extract<DocumentCommand, { type: 'bdc.anchor.return' }>,
): ElceDocument {
  const anchorBdc = findBdc(document, command.anchorBdcId)
  const pageId = anchorBdc.pageId ?? fail(`Le bdc ancré est hors page : ${command.anchorBdcId}`)
  const section = findAnchorSection(document, command.sectionBdcId, pageId)
  if (!anchorReferenceService.bdcIdsIn(requireSectionData(section).content).includes(anchorBdc.id)) {
    fail(`L’ancre ${anchorBdc.id} est introuvable dans sa Section.`)
  }
  if (anchorReferenceService.bdcIdsIn(command.content).includes(anchorBdc.id)) {
    fail(`La nouvelle Section conserve l’ancre ${anchorBdc.id}.`)
  }

  const withoutAnchor = updateSectionContent(
    document,
    command.sectionBdcId,
    undefined,
    command.markup,
    command.content,
    [anchorBdc.id],
  )
  return placeBdc(withoutAnchor, findBdc(withoutAnchor, anchorBdc.id), { kind: BDC_LOCATION.CATALOG })
}

function movePage(document: ElceDocument, command: Extract<DocumentCommand, { type: 'page.move' }>): ElceDocument {
  return placePage(document, findPage(document, command.pageId), command.placement)
}

function moveBdc(document: ElceDocument, command: Extract<DocumentCommand, { type: 'bdc.move' }>): ElceDocument {
  const bdc = findBdc(document, command.bdcId)
  if (anchorReferenceService.isReferenced(document, bdc.id)) {
    switch (command.placement.kind) {
      case BDC_LOCATION.CATALOG:
        fail(`Le retour au catalogue du bdc ancré ${bdc.id} exige le retrait de son ancre.`)
      case BDC_LOCATION.PAGE:
        switch (command.placement.pageId) {
          case bdc.pageId:
            break
          default:
            fail(`Déplacer le bdc ancré ${bdc.id} exige de déplacer aussi son ancre.`)
        }
        break
    }
  }
  return placeBdc(document, bdc, command.placement)
}

function deletePage(document: ElceDocument, pageId: PageId): ElceDocument {
  const page = findPage(document, pageId)
  const bdcIds = new Set(page.bdcIds)
  const detached = movePage(document, { type: 'page.move', pageId, placement: { kind: PAGE_LOCATION.CATALOG } })
  return new ElceDocument({
    ...detached.data,
    chapters: detached.chapters.map((chapter) => ({ ...chapter, pageIds: removeValue(chapter.pageIds, pageId) })),
    pages: detached.pages.filter((candidate) => candidate.id !== pageId),
    scenarioPageIds: removeValue(detached.data.scenarioPageIds, pageId),
    catalogPageIds: removeValue(detached.data.catalogPageIds, pageId),
    bdcs: detached.bdcs.filter((bdc) => !bdcIds.has(bdc.id)),
    catalogBdcIds: detached.data.catalogBdcIds.filter((bdcId) => !bdcIds.has(bdcId)),
  })
}

/** Renames one page without changing its placement or content. */
function renamePage(document: ElceDocument, pageId: PageId, requestedName: string): ElceDocument {
  const page = findPage(document, pageId)
  const name = requestedName.trim()
  if (name.length === 0) fail(`Le nom de la page ne peut pas être vide : ${pageId}`)
  return withPage(document, { ...page, name })
}

/** Renames one chapter without changing its type or page order. */
function renameChapter(document: ElceDocument, chapterId: ChapterId, requestedName: string): ElceDocument {
  const chapter = findChapter(document, chapterId)
  const name = requestedName.trim()
  if (name.length === 0) fail(`Le nom du chapitre ne peut pas être vide : ${chapterId}`)
  return new ElceDocument({
    ...document.data,
    chapters: document.chapters.map((candidate) => candidate.id === chapter.id
      ? { ...chapter, name }
      : candidate),
  })
}

/** Applies one document command and returns a new immutable model value. */
function applyCommand(document: ElceDocument, command: DocumentCommand): ElceDocument {
  switch (command.type) {
    case 'chapter.create':
      return createChapter(document, command)
    case 'chapter.rename':
      return renameChapter(document, command.chapterId, command.name)
    case 'chapter.delete':
      return deleteChapter(document, command.chapterId)
    case 'page.create':
      return createPage(document, command)
    case 'page.rename':
      return renamePage(document, command.pageId, command.name)
    case 'page.move':
      return movePage(document, command)
    case 'page.remove':
      return movePage(document, { type: 'page.move', pageId: command.pageId, placement: { kind: PAGE_LOCATION.CATALOG } })
    case 'page.delete':
      return deletePage(document, command.pageId)
    case 'bdc.create':
      return createBdc(document, command)
    case 'bdc.move':
      return moveBdc(document, command)
    case 'bdc.remove':
      return moveBdc(document, { type: 'bdc.move', bdcId: command.bdcId, placement: { kind: BDC_LOCATION.CATALOG } })
    case 'bdc.delete':
      return deleteCatalogBdc(document, command.bdcId)
    case 'bdc.section.update': {
      const bdc = findBdc(document, command.bdcId)
      switch (bdc.type) {
        case BDC_TYPE.SECTION:
          return updateSectionContent(document, command.bdcId, command.title, command.markup, command.content)
        default:
          fail(`Bdc non textuel : ${command.bdcId}`)
      }
    }
    case 'bdc.anchor.create':
      return createAnchoredBdc(document, command)
    case 'bdc.anchor.attach':
      return attachCatalogBdc(document, command)
    case 'bdc.anchor.move':
      return moveAnchoredBdc(document, command)
    case 'bdc.anchor.remove':
      return removeAnchoredBdc(document, command)
    case 'bdc.anchor.return':
      return returnAnchoredBdc(document, command)
    case 'media.add':
      if (document.medias.some((media) => media.id === command.media.id)) fail(`Média déjà présent : ${command.media.id}`)
      return new ElceDocument({ ...document.data, medias: [...document.medias, command.media] })
    case 'media.merge':
      return mergeMedia(document, command.canonicalMediaId, command.duplicateMediaIds)
    case 'document.rename':
      return new ElceDocument({ ...document.data, name: command.name })
  }
}

/** Applies a document command and verifies its cross-entity invariants before returning. */
export function applyDocumentCommand(document: ElceDocument, command: DocumentCommand): ElceDocument {
  const updated = applyCommand(document, command)
  assertDocumentInvariants(updated)
  return updated
}

/** Checks placement and anchor-reference invariants for a document value. */
export function assertDocumentInvariants(document: ElceDocument): void {
  const pageIds = new Set<PageId>()
  const bdcIds = new Set<BdcId>()
  const knownBdcIds = new Set(document.bdcs.map((bdc) => bdc.id))
  for (const page of document.pages) {
    if (pageIds.has(page.id)) fail(`Page dupliquée : ${page.id}`)
    pageIds.add(page.id)
    for (const bdcId of page.bdcIds) {
      if (!knownBdcIds.has(bdcId)) fail(`Bdc inconnu dans la page ${page.id} : ${bdcId}`)
      if (bdcIds.has(bdcId)) fail(`Bdc placé deux fois dans la page ${page.id}`)
      bdcIds.add(bdcId)
      if (document.bdcs.find((bdc) => bdc.id === bdcId)?.pageId !== page.id) fail(`Affectation de bdc incohérente : ${bdcId}`)
    }
  }
  const placedPageIds = new Set([
    ...document.data.scenarioPageIds,
    ...document.data.catalogPageIds,
    ...document.chapters.flatMap((chapter) => chapter.pageIds),
  ])
  if (placedPageIds.size !== document.pages.length) fail('Chaque page doit avoir un emplacement unique')
  for (const bdc of document.bdcs) {
    if (bdcIds.has(bdc.id)) continue
    if (!document.data.catalogBdcIds.includes(bdc.id) || bdc.pageId !== null) fail(`Bdc sans emplacement : ${bdc.id}`)
    bdcIds.add(bdc.id)
  }
  if (bdcIds.size !== document.bdcs.length) fail('Chaque bdc doit avoir un emplacement unique')
  for (const chapter of document.chapters) {
    for (const pageId of chapter.pageIds) {
      if (document.pages.find((page) => page.id === pageId)?.chapterId !== chapter.id) fail(`Affectation de chapitre incohérente : ${pageId}`)
    }
  }
  for (const page of document.pages) {
    if (page.chapterId === null && document.chapters.some((chapter) => chapter.pageIds.includes(page.id))) fail(`Page affectée à un chapitre sans référence : ${page.id}`)
    if (page.chapterId !== null && !document.chapters.some((chapter) => chapter.id === page.chapterId && chapter.pageIds.includes(page.id))) fail(`Page hors chapitre incohérente : ${page.id}`)
  }

  const referencedAnchorBdcIds = new Set<BdcId>()
  for (const sectionBdc of document.bdcs) {
    switch (sectionBdc.type) {
      case BDC_TYPE.SECTION: {
        const section = requireSectionData(sectionBdc)
        const anchorBdcIds = anchorReferenceService.bdcIdsIn(section.content)
        if (new Set(anchorBdcIds).size !== anchorBdcIds.length) fail(`Une ancre est dupliquée dans la Section ${sectionBdc.id}.`)
        for (const anchorBdcId of anchorBdcIds) {
          if (referencedAnchorBdcIds.has(anchorBdcId)) fail(`Le bdc ancré ${anchorBdcId} est référencé plusieurs fois.`)
          const anchorBdc = document.bdcs.find((bdc) => bdc.id === anchorBdcId)
          switch (anchorBdc) {
            case undefined:
              fail(`Ancre sans bdc associé : ${anchorBdcId}`)
            default:
              switch (anchorBdc.type) {
                case BDC_TYPE.IMAGE:
                case BDC_TYPE.VIDEO:
                  switch (sectionBdc.pageId) {
                    case null:
                      fail(`Une Section hors page ne peut pas porter l’ancre ${anchorBdcId}.`)
                    default:
                      break
                  }
                  switch (anchorBdc.pageId) {
                    case sectionBdc.pageId:
                      break
                    default:
                      fail(`Le bdc ancré ${anchorBdcId} doit rester sur la page de sa Section.`)
                  }
                  break
                default:
                  fail(`Seuls les bdcs image et vidéo peuvent être ancrés : ${anchorBdcId}`)
              }
          }
          referencedAnchorBdcIds.add(anchorBdcId)
        }
        break
      }
      default:
        break
    }
  }
}
