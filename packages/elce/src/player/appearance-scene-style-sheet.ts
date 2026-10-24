import type { AppearanceTarget } from '../domain/commands/document-command-types'
import type { Bdc, Page } from '../domain/document/document-types'
import type { ElceDocument } from '../domain/document/document-model'
import { resolveAppearance, resolveAppearanceContrastContext } from '../domain/appearance/appearance-resolver'
import { customColorClassName } from '../builders/scene-style/appearance-class-names.ts'
import {
  appearanceThemeCssAssetPaths,
  appearanceThemeCssImport,
} from './appearance/appearance-theme-styles.ts'
import { appearanceFontAssetsForPairs, appearanceFontFaceStyleSheet } from './appearance-font-assets'

/** Builds used theme CSS, custom color classes and fonts for the document layout. */
export function createDocumentAppearanceStyleSheet(document: ElceDocument, fontSourcePrefix: '/' | './' = '/'): string {
  const targets = appearanceTargetsForDocument(document)
  const resolved = targets.map((target) => resolveAppearance(document, target))
  const pairIds = resolved.map((appearance) => appearance.typographyPairId.value)
  const themeCssPaths = appearanceThemeCssAssetPaths(
    resolved.map((appearance) => appearance.paletteId.value),
    pairIds,
    resolved.map((appearance) => appearance.density.value),
  )
  const fonts = appearanceFontAssetsForPairs(pairIds)
  return [
    ...(fontSourcePrefix === './' ? themeCssPaths.map(appearanceThemeCssImport) : []),
    appearanceFontFaceStyleSheet(fonts, fontSourcePrefix),
    customAppearanceStyleSheet(document, targets),
  ].filter((styleSheet) => styleSheet.length > 0).join('\n')
}

/** Returns the distinct authored theme CSS assets used by any rendered document surface. */
export function appearanceThemeCssAssetPathsForDocument(document: ElceDocument): readonly string[] {
  const resolved = appearanceTargetsForDocument(document).map((target) => resolveAppearance(document, target))
  return appearanceThemeCssAssetPaths(
    resolved.map((appearance) => appearance.paletteId.value),
    resolved.map((appearance) => appearance.typographyPairId.value),
    resolved.map((appearance) => appearance.density.value),
  )
}

/** Builds custom color classes for the appearance targets in one real page scene. */
export function createPageAppearanceStyleSheet(
  document: ElceDocument,
  page: Page,
  bdcs: readonly Bdc[],
): string {
  return customAppearanceStyleSheet(document, pageAppearanceTargets(page, bdcs))
}

/** Returns fonts referenced by the generated layout and scenario page styles. */
export function appearanceFontAssetsForDocument(document: ElceDocument) {
  const pairIds = appearanceTargetsForDocument(document)
    .map((target) => resolveAppearance(document, target).typographyPairId.value)
  return appearanceFontAssetsForPairs(pairIds)
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

/** Returns the page and styled BDC targets using the page scene's real source set. */
function pageAppearanceTargets(page: Page, bdcs: readonly Bdc[]): readonly AppearanceTarget[] {
  return [
    { kind: 'page', pageId: page.id },
    ...bdcs.flatMap((bdc) => bdc.pageId === page.id || bdc.parentBdcId !== null
      ? [{ kind: 'bdc' as const, bdcId: bdc.id }]
      : []),
  ]
}

/** Emits only class rules required by author-supplied colors in these targets. */
function customAppearanceStyleSheet(
  document: ElceDocument,
  targets: readonly AppearanceTarget[],
): string {
  const declarations = new Map<string, Map<string, string>>()
  for (const target of targets) {
    const resolved = resolveAppearance(document, target)
    if (resolved.background.value.choice.kind === 'custom') {
      addCustomDeclaration(
        declarations,
        customColorClassName('background', resolved.background.value.color),
        '--elce-appearance-background-color',
        resolved.background.value.color,
      )
    }
    if (resolved.textColor.value.choice.kind === 'custom') {
      const className = customColorClassName('text', resolved.textColor.value.color)
      addCustomDeclaration(declarations, className, '--elce-appearance-text-color', resolved.textColor.value.color)
      addCustomDeclaration(declarations, className, '--elce-appearance-muted-color', resolved.textColor.value.color)
    }
    const contrastBackground = resolveAppearanceContrastContext(document, target)
    if (contrastBackground.choice.kind === 'custom') {
      addCustomDeclaration(
        declarations,
        customColorClassName('contrast-background', contrastBackground.color),
        '--elce-appearance-contrast-background',
        contrastBackground.color,
      )
    }
  }
  return [...declarations.entries()].map(([className, properties]) => [
    `.${className} {`,
    ...[...properties.entries()].map(([property, value]) => `  ${property}: ${value};`),
    '}',
  ].join('\n')).join('\n')
}

/** Adds one custom color declaration and deduplicates its reusable class. */
function addCustomDeclaration(
  declarations: Map<string, Map<string, string>>,
  className: string,
  property: string,
  value: string,
): void {
  const properties = declarations.get(className) ?? new Map<string, string>()
  properties.set(property, value)
  declarations.set(className, properties)
}

