import type { AuthorStrapCollection, PersoDoc, SceneListenRule } from 'codplay/scene/types'
import type { RichTextDocument, RichTextNode } from '../../core/document/rich-text-types'
import type { ListEntryTriggerMode } from '../list/reading/list-scene-builder'

export interface ResourceInlineTextSceneParts {
  readonly markup: string
  readonly persos: readonly PersoDoc<string>[]
  readonly hasBlockContent?: boolean
  readonly straps?: AuthorStrapCollection
  readonly listen?: readonly SceneListenRule[]
  readonly revealEventimes?: readonly Readonly<{ name: string; startAt: number }>[]
}

export interface ResourceInlineTextSceneBuildOptions {
  readonly entryEventName?: string
  readonly entryTriggerMode?: ListEntryTriggerMode
  readonly exitEventName?: string
  readonly initiallyVisible?: boolean
}

export interface ResourceSectionInlineLinkProjection {
  readonly markup: string
  readonly persos: readonly PersoDoc<string>[]
  readonly listPersos: readonly PersoDoc<string>[]
  readonly listStraps: AuthorStrapCollection
  readonly listListen: readonly SceneListenRule[]
}

export interface ResourceSectionInlineLinkProjectionOptions {
  readonly scrollPortId: string
  readonly observationZone: Readonly<{ threshold: number }>
}

/** Supplies format-specific behavior for promoted text without coupling resources to a mod. */
export interface ResourceInlineTextSceneFeature {
  build(document: RichTextDocument, idPrefix: string, options?: ResourceInlineTextSceneBuildOptions): ResourceInlineTextSceneParts
  /** Projects supported interactive labels and block references in Section markup. */
  projectSectionLinks(
    markup: string,
    nodes: readonly RichTextNode[],
    bdcId: string,
    options?: ResourceSectionInlineLinkProjectionOptions,
  ): ResourceSectionInlineLinkProjection
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
