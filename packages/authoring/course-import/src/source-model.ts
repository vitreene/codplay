import type { SceneDoc } from 'codplay'

/** Identifies one exact source location without resolving its project meaning. */
export type XmlLocation = Readonly<{
  documentId: string
  line: number
  column: number
  path: string
}>

/** Holds source text in document order, including CDATA content. */
export type XmlTextNode = Readonly<{
  kind: 'text'
  value: string
  location: XmlLocation
}>

/** Holds one parsed XML element and its ordered source children. */
export type XmlElement = Readonly<{
  kind: 'element'
  name: string
  attributes: Readonly<Record<string, string>>
  children: readonly XmlNode[]
  location: XmlLocation
}>

/** Represents one element or text node in an XML source tree. */
export type XmlNode = XmlElement | XmlTextNode

/** Represents a parsed XML source document with its root element. */
export type XmlSourceDocument = Readonly<{
  documentId: string
  root: XmlElement
}>

/** Describes a parser error with the source position supplied by saxes. */
export type XmlParseIssue = Readonly<{
  message: string
  line: number
  column: number
}>

/** Returns either one unambiguous source match or its candidates. */
export type SourceResolution<T> = Readonly<{
  status: 'resolved' | 'missing' | 'ambiguous'
  value?: T
  candidates: readonly T[]
}>

/** Gives one conversion finding a stable code, source location, and next step. */
export type ImportIssue = Readonly<{
  id: string
  code: string
  severity: 'info' | 'warning' | 'blocker'
  message: string
  location: XmlLocation
  source?: string
  nextStep?: string
}>

/** Describes repeated source interactions without rewriting their behavior. */
export type InteractionRecipe = Readonly<{
  id: string
  signature: string
  occurrences: readonly Readonly<{
    location: XmlLocation
    trigger: string
    source: string
  }>[]
  varyingPaths: readonly string[]
}>

/** Summarizes converted structure and all unresolved source behavior. */
export type ConversionReport = Readonly<{
  sourceDocument: string
  pageId: string
  convertedStories: number
  convertedPersos: number
  convertedCallbacks: number
  convertedTweens: number
  issues: readonly ImportIssue[]
  recipes: readonly InteractionRecipe[]
}>

/** Returns a partial scene together with its source-oriented conversion report. */
export type PageConversionResult = Readonly<{
  scene?: SceneDoc<string>
  report: ConversionReport
}>

/** Carries one source XML input into the reader without filesystem assumptions. */
export type XmlSourceInput = Readonly<{
  documentId: string
  xml: string
}>

/** Configures the repeated source tags used to index a project summary. */
export type SummarySchema = Readonly<{
  rootTag: string
  chapterTag: string
  pageTag: string
  idAttribute: string
  titleTag: string
}>

/** Identifies one summary page in its chapter and source document. */
export type SummaryPageReference = Readonly<{
  id?: string
  title?: string
  attributes: Readonly<Record<string, string>>
  location: XmlLocation
}>

/** Groups summary page order under one source chapter. */
export type SummaryChapterReference = Readonly<{
  id?: string
  title?: string
  attributes: Readonly<Record<string, string>>
  location: XmlLocation
  pages: readonly SummaryPageReference[]
}>

/** Preserves the summary hierarchy and order without resolving project policy. */
export type SummaryIndex = Readonly<{
  sourceDocument: string
  rootAttributes: Readonly<Record<string, string>>
  chapters: readonly SummaryChapterReference[]
  issues: readonly Readonly<{ code: string; message: string; location: XmlLocation }>[]
}>
