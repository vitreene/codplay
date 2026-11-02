import type { AppearanceTarget } from '../mods/learning/commands/learning-document-command-types'
import type { AppearanceDensity } from '../config/appearance/appearance-types'
import type { LearningBdc, LearningPage } from '../mods/learning/document/learning-document-types'
import type { LearningDocument } from '../mods/learning/document/learning-document'
import { BDC_TYPE } from '../mods/learning/learning-definition'
import {
  appearanceScopeClassName,
  appearanceSurfaceRoleForTarget,
} from '../builders/scene-style/appearance-class-names'
import {
  appearanceBackgroundAppliesToSurface,
  resolveAppearance,
  resolveAppearanceContrastContext,
} from '../domain/appearance/appearance-resolver'
import { generateAppearanceColors } from '../domain/appearance/appearance-color-generator'
import { appearanceFontAssetsForIds, appearanceFontFaceStyleSheet } from './appearance-font-assets'
import { appearanceBackgroundGradientCss } from '../config/appearance/appearance-config'
import {
  appearanceThemeCssAssetPaths,
  appearanceThemeCssImport,
} from './appearance/appearance-theme-styles'

/** Builds the shared stylesheet for fonts, density rules and generated color tokens. */
export function createDocumentAppearanceStyleSheet(document: LearningDocument, fontSourcePrefix: '/' | './' = '/'): string {
  const targets = appearanceTargetsForDocument(document)
  const resolved = targets.map((target) => resolveAppearance(document.data, target))
  const fontIds = resolved.flatMap((appearance) => [
    appearance.headingFontId.value,
    appearance.bodyFontId.value,
  ])
  const themeCssPaths = appearanceThemeCssAssetPaths(
    fontIds,
    appearanceDensities(resolved),
  )
  const fonts = appearanceFontAssetsForIds(fontIds)
  return [
    ...(fontSourcePrefix === './' ? themeCssPaths.map(appearanceThemeCssImport) : []),
    appearanceFontFaceStyleSheet(fonts, fontSourcePrefix),
    generatedAppearanceStyleSheet(document, targets),
  ].filter((styleSheet) => styleSheet.length > 0).join('\n')
}

/** Builds only one target's generated color rules for a scoped author preview. */
export function createAppearanceTargetStyleSheet(document: LearningDocument, target: AppearanceTarget): string {
  return generatedAppearanceStyleSheet(document, [target], false)
}

/** Returns each used project, page and BDC theme stylesheet once. */
export function appearanceThemeCssAssetPathsForDocument(document: LearningDocument): readonly string[] {
  const resolved = appearanceTargetsForDocument(document).map((target) => resolveAppearance(document.data, target))
  const fontIds = resolved.flatMap((appearance) => [
    appearance.headingFontId.value,
    appearance.bodyFontId.value,
  ])
  return appearanceThemeCssAssetPaths(
    fontIds,
    appearanceDensities(resolved),
  )
}

/** Returns the font files referenced by the common project stylesheet. */
export function appearanceFontAssetsForDocument(document: LearningDocument) {
  const fontIds = appearanceTargetsForDocument(document).flatMap((target) => {
    const resolved = resolveAppearance(document.data, target)
    return [resolved.headingFontId.value, resolved.bodyFontId.value]
  })
  return appearanceFontAssetsForIds(fontIds)
}

/** Collects all project, scenario page and scene BDC appearance targets. */
function appearanceTargetsForDocument(document: LearningDocument): readonly AppearanceTarget[] {
  const targets: AppearanceTarget[] = [{ kind: 'document' }]
  for (const pageId of document.scenarioPageIds) {
    const page = document.pages.find((candidate) => candidate.id === pageId)
    if (page === undefined) throw new Error(`Page absente du document : ${pageId}`)
    const pageBdcs = page.bdcIds.flatMap((bdcId) => document.bdcs.filter((bdc) => bdc.id === bdcId))
    const pageBdcIds = new Set(pageBdcs.map((bdc) => bdc.id))
    const childBdcs = document.bdcs.filter((bdc) => bdc.parentBdcId !== null && pageBdcIds.has(bdc.parentBdcId))
    targets.push(...pageAppearanceTargets(page, [...pageBdcs, ...childBdcs]))
  }
  return targets
}

/** Returns a page and its direct scene BDC targets. */
function pageAppearanceTargets(page: LearningPage, bdcs: readonly LearningBdc[]): readonly AppearanceTarget[] {
  return [
    { kind: 'page', pageId: page.id },
    ...bdcs.flatMap((bdc) => bdc.pageId === page.id || bdc.parentBdcId !== null
      ? [{ kind: 'bdc' as const, bdcId: bdc.id }]
      : []),
  ]
}

/** Maps generated semantic colors to CSS variables and paints each effective background. */
function generatedAppearanceStyleSheet(
  document: LearningDocument,
  targets: readonly AppearanceTarget[],
  includeStage = true,
): string {
  const rules = targets.flatMap((target) => {
    const resolved = resolveAppearance(document.data, target)
    const role = appearanceSurfaceRoleForTarget(document.data, target, (bdc) =>
      bdc.type === BDC_TYPE.EVALUATION_RESULT ? 'evaluation-result' : undefined)
    const contrastBackground = resolveAppearanceContrastContext(document.data, target).color
    const colors = generateAppearanceColors(resolved, contrastBackground)
    const className = appearanceScopeClassName(document.data, target)
    const variables = Object.entries({
      background: colors.background,
      text: colors.text,
      title: colors.title,
      intertitle: colors.intertitle,
      accent: colors.accent,
      'accent-foreground': colors.accentForeground,
      'accent-secondary': colors.accentSecondary,
      'accent-secondary-foreground': colors.accentSecondaryForeground,
      surface: colors.surface,
      'surface-foreground': colors.surfaceForeground,
      muted: colors.muted,
      border: colors.border,
      frame: colors.frame,
      'menu-background': colors.menuBackground,
      'menu-foreground': colors.menuForeground,
      'navigation-background': colors.navigationBackground,
      'navigation-foreground': colors.navigationForeground,
    }).map(([name, value]) => `  --elce-appearance-${name}: ${value};`)
    const selectors = paintedSurfaceSelectors(className, role)
    const paintRule = resolved.density.value !== 'none'
      && appearanceBackgroundAppliesToSurface(resolved, target)
      ? [`${selectors.join(',\n')} { background-color: var(--elce-appearance-background); }`]
      : []
    const backgroundChoice = resolved.background.value.choice
    const gradientRule = backgroundChoice.kind === 'gradient'
      && resolved.density.value !== 'none'
      && appearanceBackgroundAppliesToSurface(resolved, target)
      ? [`${selectors.join(',\n')} { background-image: ${appearanceBackgroundGradientCss(backgroundChoice.id, {
        background: 'var(--elce-appearance-background)',
        surface: 'var(--elce-appearance-surface)',
        accent: 'var(--elce-appearance-accent)',
        'accent-secondary': 'var(--elce-appearance-accent-secondary)',
      })}; }`]
      : []
    const frameRule = resolved.frame.value
      ? [`${frameSurfaceSelector(className, role)} { box-sizing: border-box; border: thin solid var(--elce-appearance-frame); }`]
      : []
    return [
      `.${className} {\n${variables.join('\n')}\n}`,
      `.${className} { color: var(--elce-appearance-text); }`,
      ...paintRule,
      ...gradientRule,
      ...frameRule,
    ]
  })
  if (!includeStage) return rules.join('\n')

  const project = resolveAppearance(document.data, { kind: 'document' })
  const projectColors = generateAppearanceColors(
    project,
    resolveAppearanceContrastContext(document.data, { kind: 'document' }).color,
  )
  const stageBackground = project.density.value === 'none' ? 'transparent' : projectColors.background
  // CodPlay wraps this sheet in @scope rooted at .elce-player-stage.
  // :scope paints the preview frame itself.
  return [
    ...rules,
    `:scope {\n  background-color: ${stageBackground};\n}`,
  ].join('\n')
}

/** Selects the visible painted element for a page or BDC role. */
function paintedSurfaceSelectors(className: string, role: string): string[] {
  switch (role) {
    case 'card-text-image':
      return [`.${className}.card-text-image.has-background > .elce-carousel-text-image__content`]
    case 'card-image-caption':
      return [`.${className}.card-image-caption.has-background > .elce-card__caption`]
    default:
      return [`.${className}.${role}.has-background`]
  }
}

/** Loads Normal last when a frame needs its role-specific padding. */
function appearanceDensities(appearances: readonly ReturnType<typeof resolveAppearance>[]): readonly AppearanceDensity[] {
  const densities = appearances.map((appearance) => appearance.density.value)
  if (!appearances.some((appearance) => appearance.frame.value)) return densities
  return [...densities.filter((density) => density !== 'normal'), 'normal']
}

/** Selects the authored target root that receives a frame. */
function frameSurfaceSelector(className: string, role: string): string {
  return `.${className}.${role}.has-frame`
}
