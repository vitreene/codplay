export { CourseSourceReader } from './course-source-reader'
export { factorRepeatedInteractions } from './interaction-factor'
export type { SourceInteraction } from './interaction-factor'
export { isJavaScriptArray, isJavaScriptCall, isJavaScriptObject, parseJavaScriptCalls } from './javascript-call-reader'
export type {
  JavaScriptArray,
  JavaScriptCall,
  JavaScriptCallParse,
  JavaScriptExpression,
  JavaScriptIdentifier,
  JavaScriptObject,
  JavaScriptPrimitive,
} from './javascript-call-reader'
export { PageConverter } from './page-converter'
export type { PageConversionContext, ResolvedCallbackTrigger, ResolvedSourceTween } from './page-converter'
export { SourceStyleReader } from './source-style-reader'
export type { SourceStyleIssue, SourceStyleResolution, SourceStyleSheet } from './source-style-reader'
export type {
  ConversionReport,
  ImportIssue,
  InteractionRecipe,
  PageConversionResult,
  SourceResolution,
  SummaryChapterReference,
  SummaryIndex,
  SummaryPageReference,
  SummarySchema,
  XmlElement,
  XmlLocation,
  XmlNode,
  XmlParseIssue,
  XmlSourceDocument,
  XmlSourceInput,
  XmlTextNode,
} from './source-model'
export { findElements, getElementChildren, parseXmlDocument, readTextContent } from './xml-document-reader'
