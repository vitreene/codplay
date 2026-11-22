import type { SourceResolution, SummaryIndex, SummarySchema, SummaryChapterReference, SummaryPageReference, XmlElement, XmlSourceDocument, XmlSourceInput } from './source-model'
import { findElements, getElementChildren, parseXmlDocument, readTextContent } from './xml-document-reader'

const DEFAULT_SUMMARY_SCHEMA: SummarySchema = {
  rootTag: 'menu',
  chapterTag: 'chap',
  pageTag: 'page',
  idAttribute: 'id',
  titleTag: 'title',
}

/** Provides reusable XML parsing and exact source-reference lookup methods. */
export class CourseSourceReader {
  /** Parses one supplied XML input and preserves its document identity. */
  readDocument(input: XmlSourceInput): XmlSourceDocument {
    return parseXmlDocument(input.documentId, input.xml)
  }

  /** Parses several source documents and rejects duplicate document identities. */
  readDocuments(inputs: readonly XmlSourceInput[]): readonly XmlSourceDocument[] {
    const identities = new Set<string>()
    return inputs.map((input) => {
      if (identities.has(input.documentId)) throw new Error(`Duplicate source document identity: ${input.documentId}.`)
      identities.add(input.documentId)
      return this.readDocument(input)
    })
  }

  /** Indexes chapter and page order from a summary using explicit source tags. */
  readSummary(document: XmlSourceDocument, schema: SummarySchema = DEFAULT_SUMMARY_SCHEMA): SummaryIndex {
    const issues: { code: string; message: string; location: XmlElement['location'] }[] = []
    if (document.root.name !== schema.rootTag) {
      issues.push({
        code: 'summary-root-unrecognized',
        message: `Expected <${schema.rootTag}> as the summary root, found <${document.root.name}>.`,
        location: document.root.location,
      })
      return { sourceDocument: document.documentId, rootAttributes: document.root.attributes, chapters: [], issues }
    }
    const chapters = getElementChildren(document.root).filter(({ name }) => name === schema.chapterTag).map((chapter): SummaryChapterReference => {
      const id = chapter.attributes[schema.idAttribute]
      const title = getElementChildren(chapter).find(({ name }) => name === schema.titleTag)
      if (id === undefined) issues.push({ code: 'summary-chapter-id-missing', message: `A <${schema.chapterTag}> entry has no ${schema.idAttribute} attribute.`, location: chapter.location })
      const pages = findElements(chapter, schema.pageTag).map((page): SummaryPageReference => {
        const pageId = page.attributes[schema.idAttribute]
        const pageTitle = getElementChildren(page).find(({ name }) => name === schema.titleTag)
        if (pageId === undefined) issues.push({ code: 'summary-page-id-missing', message: `A <${schema.pageTag}> entry has no ${schema.idAttribute} attribute.`, location: page.location })
        return {
          ...(pageId === undefined ? {} : { id: pageId }),
          ...(pageTitle === undefined ? {} : { title: readTextContent(pageTitle) }),
          attributes: page.attributes,
          location: page.location,
        }
      })
      return {
        ...(id === undefined ? {} : { id }),
        ...(title === undefined ? {} : { title: readTextContent(title) }),
        attributes: chapter.attributes,
        location: chapter.location,
        pages,
      }
    })
    return { sourceDocument: document.documentId, rootAttributes: document.root.attributes, chapters, issues }
  }

  /** Resolves a page ID within one chapter document without crossing chapters. */
  resolvePage(chapter: XmlSourceDocument, pageId: string): SourceResolution<XmlElement> {
    const pages = chapter.root.name === 'page' ? [chapter.root] : findElements(chapter.root, 'page')
    return resolveUnique(pages.filter((page) => page.attributes.id === pageId))
  }

  /** Resolves a summary page ID within one chapter and keeps chapter collisions separate. */
  resolveSummaryPage(summary: SummaryIndex, chapterId: string, pageId: string): SourceResolution<SummaryPageReference> {
    const candidates = summary.chapters.filter((chapter) => chapter.id === chapterId).flatMap((chapter) =>
      chapter.pages.filter((page) => page.id === pageId))
    return resolveUnique(candidates)
  }

  /** Resolves one named source property while retaining duplicate candidates. */
  resolveProperty(documents: readonly XmlSourceDocument[], reference: string): SourceResolution<XmlElement> {
    const candidates = documents.flatMap((document) => {
      const elements = document.root.name === 'properties'
        ? [document.root, ...findElements(document.root, 'properties')]
        : findElements(document.root, 'properties')
      return elements.filter((element) => element.attributes.name === reference || element.attributes.id === reference)
    })
    return resolveUnique(deduplicate(candidates))
  }

  /** Resolves a translation using an explicit source tag and key attribute. */
  resolveText(
    documents: readonly XmlSourceDocument[],
    input: Readonly<{
      reference: string
      elementNames: readonly string[]
      keyAttribute: string
      languageId?: string
      languageAttribute?: string
    }>,
  ): SourceResolution<Readonly<{ value: string; location: XmlElement['location']; elementName: string }>> {
    const candidates = documents.flatMap((document) => {
      const elements = input.elementNames.flatMap((name) =>
        document.root.name === name ? [document.root, ...findElements(document.root, name)] : findElements(document.root, name))
      return elements
        .filter((element) => element.attributes[input.keyAttribute] === input.reference)
        .filter((element) => input.languageId === undefined
          || input.languageAttribute === undefined
          || hasAncestorLanguage(document.root, element, input.languageAttribute, input.languageId))
        .map((element) => ({ value: readTextContent(element), location: element.location, elementName: element.name }))
    })
    return resolveUnique(candidates)
  }

  /** Resolves a declared media path through an explicit source-to-output map. */
  resolveResource(sourcePath: string, resources: Readonly<Record<string, string>>): SourceResolution<string> {
    const resolved = resources[sourcePath]
    return resolved === undefined
      ? { status: 'missing', candidates: [] }
      : { status: 'resolved', value: resolved, candidates: [resolved] }
  }
}

/** Returns the unique candidate status without choosing between duplicates. */
function resolveUnique<T>(candidates: readonly T[]): SourceResolution<T> {
  if (candidates.length === 0) return { status: 'missing', candidates }
  if (candidates.length > 1) return { status: 'ambiguous', candidates }
  return { status: 'resolved', value: candidates[0], candidates }
}

/** Removes repeated references to the same XML element object. */
function deduplicate<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)]
}

/** Checks whether one element is nested under a matching language declaration. */
function hasAncestorLanguage(
  root: XmlElement,
  target: XmlElement,
  languageAttribute: string,
  languageId: string,
): boolean {
  if (root === target) return root.attributes[languageAttribute] === languageId
  return root.children.some((child) => child.kind === 'element'
    && (child === target
      ? child.attributes[languageAttribute] === languageId
      : hasAncestorLanguage(child, target, languageAttribute, languageId)))
}
