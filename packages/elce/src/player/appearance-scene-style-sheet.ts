import type { AppearanceTarget } from '../domain/commands/document-command-types'
import type { Bdc, Page } from '../domain/document/document-types'
import type { ElceDocument } from '../domain/document/document-model'
import {
  appearanceScopeClassName,
  appearanceSurfaceRoleForTarget,
} from '../builders/scene-style/appearance-class-names.ts'
import {
  appearanceBackgroundAppliesToSurface,
  resolveAppearance,
  resolveAppearanceContrastContext,
} from '../domain/appearance/appearance-resolver'
import { generateAppearanceColors } from '../domain/appearance/appearance-color-generator'
import { appearanceFontAssetsForIds, appearanceFontFaceStyleSheet } from './appearance-font-assets'
import {
  appearanceThemeCssAssetPaths,
  appearanceThemeCssImport,
} from './appearance/appearance-theme-styles.ts'

/** Builds the shared stylesheet for fonts, density rules and generated color tokens. */
export function createDocumentAppearanceStyleSheet(document: ElceDocument, fontSourcePrefix: '/' | './' = '/'): string {
  const targets = appearanceTargetsForDocument(document)
  const resolved = targets.map((target) => resolveAppearance(document, target))
  const fontIds = resolved.flatMap((appearance) => [
    appearance.headingFontId.value,
    appearance.bodyFontId.value,
  ])
  const themeCssPaths = appearanceThemeCssAssetPaths(
    fontIds,
    resolved.map((appearance) => appearance.density.value),
  )
  const fonts = appearanceFontAssetsForIds(fontIds)
  return [
    ...(fontSourcePrefix === './' ? themeCssPaths.map(appearanceThemeCssImport) : []),
    appearanceFontFaceStyleSheet(fonts, fontSourcePrefix),
    generatedAppearanceStyleSheet(document, targets),
  ].filter((styleSheet) => styleSheet.length > 0).join('\n')
}

/** Returns each used project, page and BDC theme stylesheet once. */
export function appearanceThemeCssAssetPathsForDocument(document: ElceDocument): readonly string[] {
  const resolved = appearanceTargetsForDocument(document).map((target) => resolveAppearance(document, target))
  const fontIds = resolved.flatMap((appearance) => [
    appearance.headingFontId.value,
    appearance.bodyFontId.value,
  ])
  return appearanceThemeCssAssetPaths(
    fontIds,
    resolved.map((appearance) => appearance.density.value),
  )
}

/** Returns the font files referenced by the common project stylesheet. */
export function appearanceFontAssetsForDocument(document: ElceDocument) {
  const fontIds = appearanceTargetsForDocument(document).flatMap((target) => {
    const resolved = resolveAppearance(document, target)
    return [resolved.headingFontId.value, resolved.bodyFontId.value]
  })
  return appearanceFontAssetsForIds(fontIds)
}

/** Collects all project, scenario page and scene BDC appearance targets. */
function appearanceTargetsForDocument(document: ElceDocument): readonly AppearanceTarget[] {
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
function pageAppearanceTargets(page: Page, bdcs: readonly Bdc[]): readonly AppearanceTarget[] {
  return [
    { kind: 'page', pageId: page.id },
    ...bdcs.flatMap((bdc) => bdc.pageId === page.id || bdc.parentBdcId !== null
      ? [{ kind: 'bdc' as const, bdcId: bdc.id }]
      : []),
  ]
}

/** Maps generated semantic colors to CSS variables and paints each effective background. */
function generatedAppearanceStyleSheet(
  document: ElceDocument,
  targets: readonly AppearanceTarget[],
): string {
  const rules = targets.flatMap((target) => {
    const resolved = resolveAppearance(document, target)
    const role = appearanceSurfaceRoleForTarget(document, target)
    const contrastBackground = resolveAppearanceContrastContext(document, target).color
    const colors = generateAppearanceColors(resolved, contrastBackground)
    const className = appearanceScopeClassName(document, target)
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
    return [
      `.${className} {\n${variables.join('\n')}\n}`,
      `.${className} { color: var(--elce-appearance-text); }`,
      ...paintRule,
    ]
  })
  const project = resolveAppearance(document, { kind: 'document' })
  const projectColors = generateAppearanceColors(
    project,
    resolveAppearanceContrastContext(document, { kind: 'document' }).color,
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
