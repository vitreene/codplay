import {
  APP_APPEARANCE_DEFAULTS,
  getAppearancePalette,
  getAppearancePreset,
} from '../../config/appearance/appearance-config'
import type {
  AppearanceBackground,
  AppearanceColor,
  AppearanceSettings,
} from '../../config/appearance/appearance-types'
import type { AppearanceProperty, AppearanceTarget } from '../commands/document-command-types'
import type { ElceDocument } from '../document/document-model'

export type AppearanceSource = AppearanceTarget | Readonly<{ kind: 'application' }>

export interface ResolvedAppearanceValue<Value> {
  readonly value: Value
  readonly source: AppearanceSource
  readonly origin: 'local' | 'preset' | 'inherited' | 'application'
}

export interface ResolvedAppearance {
  readonly presetId: ResolvedAppearanceValue<string>
  readonly paletteId: ResolvedAppearanceValue<string>
  readonly headingFontId: ResolvedAppearanceValue<string>
  readonly bodyFontId: ResolvedAppearanceValue<string>
  readonly density: ResolvedAppearanceValue<NonNullable<AppearanceSettings['density']>>
  readonly background: ResolvedAppearanceValue<Readonly<{ choice: AppearanceBackground; color: string }>>
  readonly textColor: ResolvedAppearanceValue<Readonly<{ choice: AppearanceColor; color: string }>>
  readonly autoContrast: ResolvedAppearanceValue<boolean>
  readonly frame: ResolvedAppearanceValue<boolean>
}

export interface AppearanceContrastContext {
  readonly color: string
  readonly paletteId: string
  readonly choice: AppearanceBackground
}

interface AppearanceLayer {
  readonly source: AppearanceSource
  readonly settings: AppearanceSettings | undefined
}

/** Resolves sparse local appearance values through BDC, page, project and app scopes. */
export function resolveAppearance(document: ElceDocument, target: AppearanceTarget): ResolvedAppearance {
  const layers = [...appearanceLayers(document, target), {
    source: { kind: 'application' } as const,
    settings: APP_APPEARANCE_DEFAULTS,
  }]
  const presetId = resolveValue(layers, 'presetId')
  const paletteId = resolveValue(layers, 'paletteId')
  const headingFontId = resolveValue(layers, 'headingFontId')
  const bodyFontId = resolveValue(layers, 'bodyFontId')
  const density = resolveValue(layers, 'density')
  const backgroundChoice = resolveValue(layers, 'background')
  const backgroundColorChoice = backgroundChoice.value.kind === 'gradient'
    ? resolveSolidBackground(layers.slice(1)).value
    : backgroundChoice.value
  const textColorChoice = resolveValue(layers, 'textColor')
  const autoContrast = resolveValue(layers, 'autoContrast')
  const frame = resolveValue(layers, 'frame')
  const palette = getAppearancePalette(paletteId.value)

  return {
    presetId,
    paletteId,
    headingFontId,
    bodyFontId,
    density,
    background: {
      ...backgroundChoice,
      value: {
        choice: backgroundChoice.value,
        color: appearanceColor(backgroundColorChoice, palette.colors),
      },
    },
    textColor: {
      ...textColorChoice,
      value: {
        choice: textColorChoice.value,
        color: appearanceColor(textColorChoice.value, palette.colors),
      },
    },
    autoContrast,
    frame,
  }
}

/** Identifies whether the resolved color is painted by the target surface itself. */
export function appearanceBackgroundAppliesToSurface(
  resolved: ResolvedAppearance,
  target: AppearanceTarget,
): boolean {
  if (target.kind === 'document') return true

  const source = resolved.background.source
  if (source.kind !== target.kind) return false
  if (target.kind === 'page') return source.kind === 'page' && source.pageId === target.pageId
  return source.kind === 'bdc' && source.bdcId === target.bdcId
}

/** Finds the nearest opaque CSS background behind the target's text surface. */
export function resolveAppearanceContrastBackground(document: ElceDocument, target: AppearanceTarget): string {
  return resolveAppearanceContrastContext(document, target).color
}

/** Resolves the nearest opaque background and keeps its semantic palette reference when available. */
export function resolveAppearanceContrastContext(
  document: ElceDocument,
  target: AppearanceTarget,
): AppearanceContrastContext {
  let current: AppearanceTarget | null = target
  while (current !== null) {
    const resolved = resolveAppearance(document, current)
    const background = resolved.background.value
    if (resolved.density.value !== 'none' && appearanceBackgroundAppliesToSurface(resolved, current)) {
      return { color: background.color, paletteId: resolved.paletteId.value, choice: background.choice }
    }
    current = appearanceParentTarget(document, current)
  }
  const paletteId = 'classic'
  const choice: AppearanceBackground = { kind: 'palette', role: 'background' }
  return { color: getAppearancePalette(paletteId).colors.background, paletteId, choice }
}

/** Builds the nearest-to-farthest document context for one appearance target. */
function appearanceLayers(document: ElceDocument, target: AppearanceTarget): AppearanceLayer[] {
  const layers: AppearanceLayer[] = []
  const addDocument = (): void => {
    layers.push({ source: { kind: 'document' }, settings: document.data.appearance })
  }
  const addPage = (pageId: string): void => {
    const page = document.pages.find((candidate) => candidate.id === pageId)
    if (page === undefined) throw new Error(`Page inconnue pour le style : ${pageId}`)
    layers.push({ source: { kind: 'page', pageId }, settings: page.appearance })
  }

  switch (target.kind) {
    case 'document':
      addDocument()
      return layers
    case 'page':
      addPage(target.pageId)
      addDocument()
      return layers
    case 'bdc': {
      const bdc = document.bdcs.find((candidate) => candidate.id === target.bdcId)
      if (bdc === undefined) throw new Error(`BDC inconnu pour le style : ${target.bdcId}`)
      layers.push({ source: { kind: 'bdc', bdcId: bdc.id }, settings: bdc.appearance })

      if (bdc.parentBdcId !== null) {
        const parent = document.bdcs.find((candidate) => candidate.id === bdc.parentBdcId)
        if (parent === undefined) throw new Error(`Parent BDC inconnu pour le style : ${bdc.parentBdcId}`)
        layers.push({ source: { kind: 'bdc', bdcId: parent.id }, settings: parent.appearance })
        if (parent.pageId !== null) addPage(parent.pageId)
      } else if (bdc.pageId !== null) {
        addPage(bdc.pageId)
      }
      addDocument()
      return layers
    }
  }
}

/** Returns the next semantic ancestor in the appearance inheritance chain. */
function appearanceParentTarget(document: ElceDocument, target: AppearanceTarget): AppearanceTarget | null {
  switch (target.kind) {
    case 'document':
      return null
    case 'page':
      return { kind: 'document' }
    case 'bdc': {
      const bdc = document.bdcs.find((candidate) => candidate.id === target.bdcId)
      if (bdc === undefined) throw new Error(`BDC inconnu pour le style : ${target.bdcId}`)
      if (bdc.parentBdcId !== null) return { kind: 'bdc', bdcId: bdc.parentBdcId }
      return bdc.pageId === null ? { kind: 'document' } : { kind: 'page', pageId: bdc.pageId }
    }
  }
}

/** Resolves the nearest explicit or project-preset value for one appearance property. */
function resolveValue<Property extends AppearanceProperty>(
  layers: readonly AppearanceLayer[],
  property: Property,
): ResolvedAppearanceValue<NonNullable<AppearanceSettings[Property]>> {
  for (const [index, layer] of layers.entries()) {
    const explicit = layer.settings?.[property]
    if (explicit !== undefined) {
      return {
        value: explicit as NonNullable<AppearanceSettings[Property]>,
        source: layer.source,
        origin: originForLayer(index, layer, 'local'),
      }
    }

    const presetValue = presetValueFor(layer.settings, property)
    if (presetValue !== undefined) {
      return {
        value: presetValue as NonNullable<AppearanceSettings[Property]>,
        source: layer.source,
        origin: originForLayer(index, layer, 'preset'),
      }
    }
  }
  throw new Error(`Valeur d’apparence sans défaut : ${String(property)}`)
}

/** Keeps a Card gradient anchored to the nearest inherited solid project background. */
function resolveSolidBackground(layers: readonly AppearanceLayer[]): ResolvedAppearanceValue<AppearanceColor> {
  for (const [index, layer] of layers.entries()) {
    const explicit = layer.settings?.background
    if (explicit !== undefined && explicit.kind !== 'gradient') {
      return {
        value: explicit,
        source: layer.source,
        origin: originForLayer(index, layer, 'local'),
      }
    }

    const presetValue = presetValueFor(layer.settings, 'background')
    if (presetValue !== undefined && presetValue.kind !== 'gradient') {
      return {
        value: presetValue,
        source: layer.source,
        origin: originForLayer(index, layer, 'preset'),
      }
    }
  }
  throw new Error('Couleur de fond solide sans défaut.')
}

/** Returns project-preset values or palette-linked colors for one scope. */
function presetValueFor<Property extends AppearanceProperty>(
  settings: AppearanceSettings | undefined,
  property: Property,
): AppearanceSettings[Property] | undefined {
  if (settings?.presetId !== undefined) {
    const preset = getAppearancePreset(settings.presetId)
    switch (property) {
      case 'paletteId': return preset.paletteId as AppearanceSettings[Property]
      case 'headingFontId': return preset.headingFontId as AppearanceSettings[Property]
      case 'bodyFontId': return preset.bodyFontId as AppearanceSettings[Property]
      case 'density': return preset.density as AppearanceSettings[Property]
      case 'background': return { kind: 'palette', role: 'background' } as AppearanceSettings[Property]
      case 'textColor': return { kind: 'palette', role: 'text' } as AppearanceSettings[Property]
      default: return undefined
    }
  }

  if (settings?.paletteId !== undefined) {
    switch (property) {
      case 'background': return { kind: 'palette', role: 'background' } as AppearanceSettings[Property]
      case 'textColor': return { kind: 'palette', role: 'text' } as AppearanceSettings[Property]
      default: return undefined
    }
  }
  return undefined
}

/** Identifies whether a value comes from this target, an ancestor or app defaults. */
function originForLayer(index: number, layer: AppearanceLayer, localOrigin: 'local' | 'preset'):
  ResolvedAppearanceValue<unknown>['origin'] {
  if (layer.source.kind === 'application') return 'application'
  return index === 0 ? localOrigin : 'inherited'
}

/** Resolves a palette semantic role or a fixed custom color to its CSS value. */
function appearanceColor(
  choice: AppearanceColor,
  palette: Readonly<Record<string, string>>,
): string {
  return choice.kind === 'custom' ? choice.value : palette[choice.role]
}
