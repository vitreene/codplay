import type { PersoDoc } from 'codplay/scene/types'
import type { RichTextDocument, RichTextNode } from '../../core/document/rich-text-types'

export interface ResourceInlineTextSceneParts {
  readonly markup: string
  readonly persos: readonly PersoDoc<string>[]
}

export interface ResourceSectionInlineLinkProjection {
  readonly markup: string
  readonly persos: readonly PersoDoc<string>[]
}

/** Supplies format-specific behavior for promoted text without coupling resources to a mod. */
export interface ResourceInlineTextSceneFeature {
  build(document: RichTextDocument, idPrefix: string): ResourceInlineTextSceneParts
  projectSectionLinks(markup: string, nodes: readonly RichTextNode[], bdcId: string): ResourceSectionInlineLinkProjection
}

/** Wraps one feature's ordered text parts in a semantic resource element. */
export function wrapResourceInlineTextSceneParts(
  parts: ResourceInlineTextSceneParts,
  id: string,
  tag: string,
  className?: string,
): string {
  const classAttribute = className === undefined ? '' : ` class="${escapeAttribute(className)}"`
  return `<${tag} id="${escapeAttribute(id)}"${classAttribute}>${parts.markup}</${tag}>`
}

/** Escapes an authored value before using it as generated HTML. */
function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}
