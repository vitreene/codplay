import type { AppearanceTarget } from '../domain/commands/document-command-types'
import type { Bdc, Page } from '../domain/document/document-types'
import type { ElceDocument } from '../domain/document/document-model'
import {
  appearanceSurfaceRoleForTarget,
  customColorClassName,
} from '../builders/scene-style/appearance-class-names.ts'
import type { AppearanceSurfaceRole } from '../builders/scene-style/appearance-class-names.ts'
import {
  appearanceBackgroundAppliesToSurface,
  resolveAppearance,
  resolveAppearanceContrastContext,
} from '../domain/appearance/appearance-resolver'
import { appearanceFontAssetsForIds, appearanceFontFaceStyleSheet } from './appearance-font-assets'
import {
  appearanceThemeCssAssetPaths,
  appearanceThemeCssImport,
} from './appearance/appearance-theme-styles.ts'

type CssDeclarationMap = Map<string, Set<string>>

/** Builds the one project stylesheet for used theme assets and custom colors. */
export function createDocumentAppearanceStyleSheet(document: ElceDocument, fontSourcePrefix: '/' | './' = '/'): string {
  const targets = appearanceTargetsForDocument(document)
  const resolved = targets.map((target) => resolveAppearance(document, target))
  const fontIds = resolved.flatMap((appearance) => [
    appearance.headingFontId.value,
    appearance.bodyFontId.value,
  ])
  const themeCssPaths = appearanceThemeCssAssetPaths(
    resolved.map((appearance) => appearance.paletteId.value),
    fontIds,
    resolved.map((appearance) => appearance.density.value),
  )
  const fonts = appearanceFontAssetsForIds(fontIds)
  return [
    ...(fontSourcePrefix === './' ? themeCssPaths.map(appearanceThemeCssImport) : []),
    appearanceFontFaceStyleSheet(fonts, fontSourcePrefix),
    customAppearanceStyleSheet(document, targets),
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
    resolved.map((appearance) => appearance.paletteId.value),
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

/** Emits reusable direct color rules once for author-supplied colors in the project. */
function customAppearanceStyleSheet(
  document: ElceDocument,
  targets: readonly AppearanceTarget[],
): string {
  const ordinary: CssDeclarationMap = new Map()
  const contrast: CssDeclarationMap = new Map()

  for (const target of targets) {
    const resolved = resolveAppearance(document, target)
    const role = appearanceSurfaceRoleForTarget(document, target)
    const background = resolved.background.value
    if (
      background.choice.kind === 'custom'
      && resolved.density.value !== 'none'
      && appearanceBackgroundAppliesToSurface(resolved, target)
    ) {
      addDeclaration(
        ordinary,
        'background-color',
        background.color,
        customBackgroundSelector(customColorClassName('background', background.color), role),
      )
    }
    if (resolved.textColor.value.choice.kind === 'custom') {
      addDeclaration(
        ordinary,
        'color',
        resolved.textColor.value.color,
        `.${customColorClassName('text', resolved.textColor.value.color)}`,
      )
    }
    if (resolved.autoContrast.value) {
      const context = resolveAppearanceContrastContext(document, target)
      if (context.choice.kind === 'custom') {
        addDeclaration(
          contrast,
          'color',
          `contrast-color(${context.color})`,
          `.${customColorClassName('contrast-background', context.color)}:is(.${role})`,
        )
      }
    }
  }

  const contrastRules = renderRules(contrast)
  const ordinaryRules = renderRules(ordinary)
  if (ordinaryRules.length === 0 && contrastRules.length === 0) return ''
  return [
    '@scope (.elce-player-layout) {',
    ...ordinaryRules.map((rule) => `  ${rule}`),
    ...(contrastRules.length === 0 ? [] : [
      '  @supports (color: contrast-color(#ffffff)) {',
      ...contrastRules.map((rule) => `    ${rule}`),
      '  }',
    ]),
    '}',
  ].join('\n')
}

/** Adds a selector to a shared direct declaration and avoids repeating its rule. */
function addDeclaration(
  declarations: CssDeclarationMap,
  property: string,
  value: string,
  selector: string,
): void {
  const key = `${property}\u0000${value}`
  const selectors = declarations.get(key) ?? new Set<string>()
  selectors.add(selector)
  declarations.set(key, selectors)
}

/** Renders selector groups that share one direct CSS declaration. */
function renderRules(declarations: CssDeclarationMap): string[] {
  return [...declarations.entries()].flatMap(([key, selectorSet]) => {
    const separator = key.indexOf('\u0000')
    const property = key.slice(0, separator)
    const value = key.slice(separator + 1)
    const selectors = [...selectorSet].sort()
    return [`${selectors.join(',\n')} { ${property}: ${value}; }`]
  })
}

/** Targets the visible background surface for each content role. */
function customBackgroundSelector(className: string, role: AppearanceSurfaceRole): string {
  switch (role) {
    case 'card-text-image':
      return `.${className}.card-text-image > .elce-carousel-text-image__content`
    case 'card-image-caption':
      return `.${className}.card-image-caption > .elce-card-image-caption__caption`
    default:
      return `.${className}:is(.${role})`
  }
}
