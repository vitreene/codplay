import { BDC_TYPE, DEFAULT_PRESET_ID, PAGE_TYPE } from '../../config/document-config'
import type { AppearanceColor } from '../../config/appearance/appearance-types'
import type { AppearanceTarget } from '../../domain/commands/document-command-types'
import type { Bdc, Page } from '../../domain/document/document-types'
import type { ElceDocument } from '../../domain/document/document-model'
import { resolveAppearance, resolveAppearanceContrastContext } from '../../domain/appearance/appearance-resolver'
import { sceneStyleClassName } from './scene-style-classes'

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

/** Returns a precomputed semantic target class or the stable hashed target class. */
export function appearanceClassNameForTarget(
  targetId: string,
  classNamesByTarget: AppearanceClassNamesByTarget = {},
): string {
  return classNamesByTarget[targetId] ?? sceneStyleClassName('appearance-surface', targetId)
}

/** Creates project-root classes for the layout background and document content. */
export function documentAppearanceClassNames(document: ElceDocument): AppearanceClassNamesByTarget {
  const target: AppearanceTarget = { kind: 'document' }
  return {
    [`${document.id}-layout-root`]: appearanceClassNames(document, target, `${document.id}-layout-root`, 'project-layout'),
    [`${document.id}-content-region`]: appearanceClassNames(document, target, `${document.id}-content-region`, 'project-content'),
  }
}

/** Creates class names for the page and BDC targets rendered by one page scene. */
export function pageAppearanceClassNames(
  document: ElceDocument,
  page: Page,
  bdcs: readonly Bdc[],
): AppearanceClassNamesByTarget {
  const pageRootId = page.type === PAGE_TYPE.FLUX ? `${page.id}-article` : `${page.id}-diapo-content`
  const classes: Record<string, string> = {
    [pageRootId]: appearanceClassNames(
      document,
      { kind: 'page', pageId: page.id },
      pageRootId,
      page.type === PAGE_TYPE.FLUX ? 'page-flux' : 'page-diapo',
    ),
  }

  for (const bdc of bdcs) {
    if (bdc.pageId !== page.id && bdc.parentBdcId === null) continue
    const target: AppearanceTarget = { kind: 'bdc', bdcId: bdc.id }
    const rootId = bdcAppearanceRootId(page, bdc)
    classes[rootId] = appearanceClassNames(document, target, rootId, bdcAppearanceRole(bdc))
  }
  return classes
}

/** Creates the target class list from resolved choices and authored CSS tokens. */
function appearanceClassNames(
  document: ElceDocument,
  target: AppearanceTarget,
  targetId: string,
  role: AppearanceSurfaceRole,
): string {
  const resolved = resolveAppearance(document, target)
  const classes = [sceneStyleClassName('appearance-surface', targetId), `elce-appearance-role-${role}`]
  if (role !== 'project-layout') classes.push('elce-appearance-surface')
  classes.push(
    `elce-appearance-palette-${resolved.paletteId.value}`,
    `elce-appearance-typography-${resolved.typographyPairId.value}`,
    backgroundClassName(resolved.background.value.choice),
    textClassName(resolved.textColor.value.choice),
    contrastBackgroundClassName(document, target),
  )
  if (hasDensityRule(role) && shouldApplyBdcDensity(target, resolved.density.origin, resolved.background.value.color)) {
    classes.push(`elce-appearance-density-${resolved.density.value}`)
  }
  if (role !== 'project-layout' && resolved.autoContrast.value && resolved.textColor.value.choice.kind === 'palette') {
    classes.push('elce-appearance-contrast-auto')
  }
  return classes.join(' ')
}

/** Maps the BDC layout to its role-specific appearance surface. */
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

/** Maps one BDC to the style target ID already used by its scene class. */
function bdcAppearanceRootId(page: Page, bdc: Bdc): string {
  if (bdc.type === BDC_TYPE.SECTION) return `${page.id}-${bdc.id}`
  if (bdc.type === BDC_TYPE.CARD) return `${page.id}-${bdc.parentBdcId ?? bdc.id}-card-${bdc.id}`
  return bdc.id
}

/** Returns the class for a palette-linked or transparent background choice. */
function backgroundClassName(background: Readonly<{ kind: string; role?: string; value?: string }>): string {
  if (background.kind === 'transparent') return 'elce-appearance-background-transparent'
  if (background.kind === 'palette') return `elce-appearance-background-palette-${background.role}`
  if (background.kind === 'custom') return customColorClassName('background', background.value ?? '')
  throw new Error('Choix de fond d’apparence invalide.')
}

/** Returns the class for a palette-linked or custom text color choice. */
function textClassName(color: AppearanceColor): string {
  if (color.kind === 'palette') return `elce-appearance-text-palette-${color.role}`
  return customColorClassName('text', color.value)
}

/** Selects a static contrast context or a generated rule for an author color. */
function contrastBackgroundClassName(document: ElceDocument, target: AppearanceTarget): string {
  const context = resolveAppearanceContrastContext(document, target)
  if (context.choice.kind === 'palette') {
    return `elce-appearance-contrast-background-${context.paletteId}-${context.choice.role}`
  }
  return customColorClassName('contrast-background', context.color)
}

/** Generates a reusable compact class for one author-supplied color. */
export function customColorClassName(role: 'background' | 'text' | 'contrast-background', color: string): string {
  return sceneStyleClassName(`appearance-custom-${role}`, color)
}

/** Returns whether a BDC target has an authored density rule. */
function hasDensityRule(role: AppearanceSurfaceRole): boolean {
  return role === 'page-flux'
    || role === 'page-diapo'
    || role === 'section'
    || role === 'card-text-short'
    || role === 'card-text-image'
    || role === 'card-image-caption'
    || role === 'question'
    || role === 'evaluation-result'
}

/** Suppresses automatic BDC inset while its resolved background remains transparent. */
function shouldApplyBdcDensity(
  target: AppearanceTarget,
  densityOrigin: string,
  backgroundColor: string,
): boolean {
  return target.kind !== 'bdc' || backgroundColor !== 'transparent' || densityOrigin !== 'application'
}
