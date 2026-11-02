import { getAppearanceDensity, getAppearanceFont } from '../../config/appearance/appearance-config'
import type { AppearanceTarget } from '../../domain/appearance/appearance-target-types'
import type { ResourceBdc, ResourceDocumentData } from '../../resources/document/resource-document-types'
import type { ContentPage } from '../../core/document/content-document-types'
import { CARD_BDC_TYPE, CARD_PRESET_ID } from '../../resources/bdcs/card/card-config'
import { CAROUSEL_BDC_TYPE } from '../../resources/bdcs/carousel/carousel-config'
import { QUESTION_BDC_TYPE } from '../../resources/bdcs/question/question-config'
import { SECTION_BDC_TYPE } from '../../resources/bdcs/section/section-config'
import { STATISTICAL_GRAPH_BDC_TYPE } from '../../resources/bdcs/statistical-graph/statistical-graph-config'
import { FLUX_PAGE_TYPE } from '../../resources/pages/flux/flux-config'
import { DIAPO_PAGE_TYPE } from '../../resources/pages/diapo/diapo-config'
import {
  appearanceBackgroundAppliesToSurface,
  resolveAppearance,
} from '../../domain/appearance/appearance-resolver'

export type AppearanceSurfaceRole =
  | 'project-layout'
  | 'project-content'
  | 'page-flux'
  | 'page-diapo'
  | 'section'
  | 'card-text-short'
  | 'card-text-image'
  | 'card-image-caption'
  | 'card-image-title'
  | 'card-photo'
  | 'carousel'
  | 'question'
  | 'evaluation-result'
  | 'graph'

export type AppearanceClassNamesByTarget = Readonly<Record<string, string>>
export type ResolveAdditionalAppearanceRole = (bdc: ResourceBdc) => AppearanceSurfaceRole | undefined

/** Returns a stable CSS scope class for one document, page or BDC appearance. */
export function appearanceScopeClassName(document: ResourceDocumentData, target: AppearanceTarget): string {
  const identity = target.kind === 'document'
    ? `project-${document.id}`
    : `${target.kind}-${document.id}-${target.kind === 'page' ? target.pageId : target.bdcId}`
  const token = Array.from(identity, (character) => character.codePointAt(0)?.toString(16) ?? '0').join('-')
  return `appearance-${token}`
}

/** Returns the classes for one page using its business identifier as the lookup key. */
export function appearanceClassNameForPage(
  pageId: string,
  classNamesByTarget: AppearanceClassNamesByTarget = {},
): string {
  return classNamesByTarget[`page:${pageId}`] ?? 'page'
}

/** Returns the classes for one BDC using its business identifier as the lookup key. */
export function appearanceClassNameForBdc(
  bdcId: string,
  classNamesByTarget: AppearanceClassNamesByTarget = {},
): string {
  return classNamesByTarget[`bdc:${bdcId}`] ?? 'bdc'
}

/** Creates project-root classes for its layout background and content typography. */
export function documentAppearanceClassNames(document: ResourceDocumentData): AppearanceClassNamesByTarget {
  const target: AppearanceTarget = { kind: 'document' }
  return {
    'document:layout': appearanceClassNames(document, target, 'project-layout'),
    'document:content': appearanceClassNames(document, target, 'project-content'),
  }
}

/** Creates class names for one page and its rendered BDCs. */
export function pageAppearanceClassNames(
  document: ResourceDocumentData,
  page: ContentPage,
  bdcs: readonly ResourceBdc[],
  resolveAdditionalRole?: ResolveAdditionalAppearanceRole,
): AppearanceClassNamesByTarget {
  const classes: Record<string, string> = {
    [`page:${page.id}`]: appearanceClassNames(
      document,
      { kind: 'page', pageId: page.id },
      appearanceSurfaceRoleForTarget(document, { kind: 'page', pageId: page.id }, resolveAdditionalRole),
    ),
  }

  for (const bdc of bdcs) {
    if (bdc.pageId !== page.id && bdc.parentBdcId === null) continue
    const target = { kind: 'bdc', bdcId: bdc.id } as const
    classes[`bdc:${bdc.id}`] = appearanceClassNames(
      document,
      target,
      appearanceSurfaceRoleForTarget(document, target, resolveAdditionalRole),
    )
  }
  return classes
}

/** Returns the same reusable appearance classes for one target outside a page projection. */
export function appearanceClassNameForTarget(
  document: ResourceDocumentData,
  target: AppearanceTarget,
  resolveAdditionalRole?: ResolveAdditionalAppearanceRole,
): string {
  return appearanceClassNames(document, target, appearanceSurfaceRoleForTarget(document, target, resolveAdditionalRole))
}

/** Returns the CSS role assigned to a document, page or BDC surface. */
export function appearanceSurfaceRoleForTarget(
  document: ResourceDocumentData,
  target: AppearanceTarget,
  resolveAdditionalRole?: ResolveAdditionalAppearanceRole,
): AppearanceSurfaceRole {
  switch (target.kind) {
    case 'document':
      return 'project-layout'
    case 'page': {
      const page = document.pages.find((candidate) => candidate.id === target.pageId)
      if (page === undefined) throw new Error(`Page inconnue pour le style : ${target.pageId}`)
      if (page.type === FLUX_PAGE_TYPE) return 'page-flux'
      if (page.type === DIAPO_PAGE_TYPE) return 'page-diapo'
      throw new Error(`Format de page inconnu pour le style : ${page.type}`)
    }
    case 'bdc': {
      const bdc = document.bdcs.find((candidate) => candidate.id === target.bdcId)
      if (bdc === undefined) throw new Error(`BDC inconnu pour le style : ${target.bdcId}`)
      return bdcAppearanceRole(bdc, resolveAdditionalRole)
    }
  }
}

/** Resolves business choices to reusable classes owned by palette, font and density CSS. */
function appearanceClassNames(
  document: ResourceDocumentData,
  target: AppearanceTarget,
  role: AppearanceSurfaceRole,
): string {
  const resolved = resolveAppearance(document, target)
  const classes: string[] = [role, appearanceScopeClassName(document, target)]
  if (target.kind === 'bdc') classes.push('bdc')

  if (
    (role === 'project-layout' || role.startsWith('page-') || target.kind === 'bdc')
    && resolved.density.value !== 'none'
    && appearanceBackgroundAppliesToSurface(resolved, target)
  ) {
    classes.push('has-background')
  }
  if (resolved.frame.value && role !== 'project-content') classes.push('has-frame')

  if (role !== 'project-layout') {
    classes.push(getAppearanceFont(resolved.headingFontId.value).headingClassName)
    classes.push(getAppearanceFont(resolved.bodyFontId.value).bodyClassName)
    classes.push(getAppearanceDensity(resolved.density.value).className)
  } else if (resolved.density.value === 'none') {
    classes.push(getAppearanceDensity(resolved.density.value).className)
  }

  return [...new Set(classes)].join(' ')
}

/** Maps a resource layout to its appearance role and delegates mod extensions. */
function bdcAppearanceRole(
  bdc: ResourceBdc,
  resolveAdditionalRole?: ResolveAdditionalAppearanceRole,
): AppearanceSurfaceRole {
  switch (bdc.type) {
    case SECTION_BDC_TYPE:
      return 'section'
    case CARD_BDC_TYPE:
      switch (bdc.presetId) {
        case CARD_PRESET_ID.TEXT_SHORT: return 'card-text-short'
        case CARD_PRESET_ID.TEXT_IMAGE: return 'card-text-image'
        case CARD_PRESET_ID.IMAGE_CAPTION: return 'card-image-caption'
        case CARD_PRESET_ID.IMAGE_TITLE: return 'card-image-title'
        case CARD_PRESET_ID.PHOTO: return 'card-photo'
        default: throw new Error(`Layout de Carte inconnu : ${bdc.presetId}`)
      }
    case CAROUSEL_BDC_TYPE:
      return 'carousel'
    case QUESTION_BDC_TYPE:
      return 'question'
    case STATISTICAL_GRAPH_BDC_TYPE:
      return 'graph'
    default: {
      const role = resolveAdditionalRole?.(bdc)
      if (role !== undefined) return role
      throw new Error(`Type de BDC sans rôle d’apparence : ${bdc.type}`)
    }
  }
}
