import { BDC_TYPE, DEFAULT_PRESET_ID, PAGE_TYPE } from '../../config/document-config'
import { getAppearanceDensity, getAppearanceFont } from '../../config/appearance/appearance-config'
import type { AppearanceTarget } from '../../domain/commands/document-command-types'
import type { Bdc, Page } from '../../domain/document/document-types'
import type { ElceDocument } from '../../domain/document/document-model'
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
  | 'card-photo'
  | 'carousel'
  | 'question'
  | 'evaluation-result'
  | 'graph'

export type AppearanceClassNamesByTarget = Readonly<Record<string, string>>

/** Returns a stable CSS scope class for one document, page or BDC appearance. */
export function appearanceScopeClassName(document: ElceDocument, target: AppearanceTarget): string {
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
export function documentAppearanceClassNames(document: ElceDocument): AppearanceClassNamesByTarget {
  const target: AppearanceTarget = { kind: 'document' }
  return {
    'document:layout': appearanceClassNames(document, target, 'project-layout'),
    'document:content': appearanceClassNames(document, target, 'project-content'),
  }
}

/** Creates class names for one page and its rendered BDCs. */
export function pageAppearanceClassNames(
  document: ElceDocument,
  page: Page,
  bdcs: readonly Bdc[],
): AppearanceClassNamesByTarget {
  const classes: Record<string, string> = {
    [`page:${page.id}`]: appearanceClassNames(
      document,
      { kind: 'page', pageId: page.id },
      appearanceSurfaceRoleForTarget(document, { kind: 'page', pageId: page.id }),
    ),
  }

  for (const bdc of bdcs) {
    if (bdc.pageId !== page.id && bdc.parentBdcId === null) continue
    classes[`bdc:${bdc.id}`] = appearanceClassNames(
      document,
      { kind: 'bdc', bdcId: bdc.id },
      appearanceSurfaceRoleForTarget(document, { kind: 'bdc', bdcId: bdc.id }),
    )
  }
  return classes
}

/** Returns the CSS role assigned to a document, page or BDC surface. */
export function appearanceSurfaceRoleForTarget(
  document: ElceDocument,
  target: AppearanceTarget,
): AppearanceSurfaceRole {
  switch (target.kind) {
    case 'document':
      return 'project-layout'
    case 'page': {
      const page = document.pages.find((candidate) => candidate.id === target.pageId)
      if (page === undefined) throw new Error(`Page inconnue pour le style : ${target.pageId}`)
      return page.type === PAGE_TYPE.FLUX ? 'page-flux' : 'page-diapo'
    }
    case 'bdc': {
      const bdc = document.bdcs.find((candidate) => candidate.id === target.bdcId)
      if (bdc === undefined) throw new Error(`BDC inconnu pour le style : ${target.bdcId}`)
      return bdcAppearanceRole(bdc)
    }
  }
}

/** Resolves business choices to reusable classes owned by palette, font and density CSS. */
function appearanceClassNames(
  document: ElceDocument,
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

  if (role !== 'project-layout') {
    classes.push(getAppearanceFont(resolved.headingFontId.value).headingClassName)
    classes.push(getAppearanceFont(resolved.bodyFontId.value).bodyClassName)
    classes.push(getAppearanceDensity(resolved.density.value).className)
  } else if (resolved.density.value === 'none') {
    classes.push(getAppearanceDensity(resolved.density.value).className)
  }

  return [...new Set(classes)].join(' ')
}

/** Maps one BDC layout to its styling role. */
function bdcAppearanceRole(bdc: Bdc): AppearanceSurfaceRole {
  switch (bdc.type) {
    case BDC_TYPE.SECTION:
      return 'section'
    case BDC_TYPE.CARD:
      switch (bdc.presetId) {
        case DEFAULT_PRESET_ID.TEXT_SHORT: return 'card-text-short'
        case DEFAULT_PRESET_ID.TEXT_IMAGE: return 'card-text-image'
        case DEFAULT_PRESET_ID.IMAGE_CAPTION: return 'card-image-caption'
        case DEFAULT_PRESET_ID.PHOTO: return 'card-photo'
        default: throw new Error(`Layout de Carte inconnu : ${bdc.presetId}`)
      }
    case BDC_TYPE.CAROUSEL:
      return 'carousel'
    case BDC_TYPE.QUESTION:
      return 'question'
    case BDC_TYPE.EVALUATION_RESULT:
      return 'evaluation-result'
    case BDC_TYPE.STATISTICAL_GRAPH:
      return 'graph'
  }
}
