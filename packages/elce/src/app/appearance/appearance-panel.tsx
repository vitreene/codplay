import { on, type RemixNode } from 'remix/ui'
import { BDC_TYPE, DEFAULT_PRESET_ID } from '../../config/document-config'
import {
  APPEARANCE_COLOR_ROLES,
  APPEARANCE_BACKGROUND_GRADIENTS,
  APPEARANCE_DENSITIES,
  APPEARANCE_PALETTES,
  APPEARANCE_PRESETS,
  APPEARANCE_TYPOGRAPHY_PAIRS,
  getAppearancePalette,
  appearanceBackgroundGradientCss,
} from '../../config/appearance/appearance-config'
import type {
  AppearanceBackground,
  AppearanceColorRole,
  AppearanceBackgroundGradientId,
  AppearanceGradientColors,
  AppearanceSettings,
} from '../../config/appearance/appearance-types'
import type {
  AppearanceProperty,
  AppearanceTarget,
  AppearanceTargetForProperty,
} from '../../domain/commands/document-command-types'
import type { EditorActionsFacade } from '../facades/editor-actions-facade'
import type { EditorViewModel } from '../selectors/editor-view-model'
import {
  appearanceBackgroundAppliesToSurface,
  resolveAppearance,
} from '../../domain/appearance/appearance-resolver'
import { generateAppearanceColors } from '../../domain/appearance/appearance-color-generator'

interface AppearancePanelProps {
  readonly view: EditorViewModel
  readonly actions: EditorActionsFacade
  readonly target: AppearanceTarget
}

const appearanceRoleLabels: Readonly<Record<AppearanceColorRole, string>> = {
  background: 'Fond',
  surface: 'Surface',
  text: 'Texte',
  muted: 'Atténué',
  accent: 'Accent',
  border: 'Bordure',
}

/** Renders the shared author panel for the project, pages and every BDC type. */
export function renderAppearancePanel(props: AppearancePanelProps): RemixNode {
  const { view, actions } = props
  const document = view.documentModel
  const target = appearanceTargetExists(view, props.target) ? props.target : { kind: 'document' as const }
  const targetLabel = appearanceTargetLabel(view, target)
  const localSettings = appearanceSettingsAt(document, target)
  const resolved = resolveAppearance(document, target)
  const palette = getAppearancePalette(resolved.paletteId.value)
  const hasTextSurface = isTextBearingCard(view, target)
  const card = target.kind === 'bdc'
    ? document.bdcs.find((bdc) => bdc.id === target.bdcId && bdc.type === BDC_TYPE.CARD)
    : undefined
  const imageTitleCard = card?.presetId === DEFAULT_PRESET_ID.IMAGE_TITLE
  const gradientColors = gradientColorsFor(resolved)

  return <section
    id="elce-appearance-panel"
    className="elce-appearance-panel"
    aria-labelledby="elce-appearance-title"
  >
    <header
      id="elce-appearance-heading"
      className="elce-appearance-heading"
    >
      <h1
        id="elce-appearance-title"
      >
        Style
      </h1>
    </header>
    <p
      id="elce-appearance-target-context"
      className="elce-appearance-target-context"
    >
      {targetLabel}
    </p>
    <div
      id="elce-appearance-fields"
      className="elce-appearance-fields"
    >
    {target.kind === 'document' ? renderSelectField(
      'elce-appearance-preset',
      'Preset général',
      resolved.presetId.value,
      APPEARANCE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
      (value) => actions.setAppearanceProperty(target, 'presetId', value),
      localSettings,
      'presetId',
      actions,
      target,
    ) : null}
    <fieldset
      id="elce-appearance-color-group"
      className="elce-appearance-color-group"
    >
      <legend id="elce-appearance-color-group-label">Couleurs</legend>
      <div
        id="elce-appearance-color-fields"
        className="elce-appearance-color-fields"
      >
        {renderSelectField(
          'elce-appearance-palette',
          'Palette',
          resolved.paletteId.value,
          APPEARANCE_PALETTES.map((entry) => ({ value: entry.id, label: entry.label })),
          (value) => actions.setAppearanceProperty(target, 'paletteId', value),
          localSettings,
          'paletteId',
          actions,
          target,
        )}
        {renderColorField({
          id: 'elce-appearance-background',
          label: 'Fond',
          color: resolved.background.value.color,
          backgroundChoice: resolved.background.value.choice,
          gradients: card === undefined ? [] : APPEARANCE_BACKGROUND_GRADIENTS,
          gradientColors,
          paletteColors: palette.colors,
          allowTransparent: true,
          transparent: resolved.density.value === 'none'
            || !appearanceBackgroundAppliesToSurface(resolved, target),
          localSettings,
          property: 'background',
          actions,
          target,
        })}
        {hasTextSurface && !imageTitleCard ? renderColorField({
          id: 'elce-appearance-text-color',
          label: 'Couleur du texte',
          color: resolved.textColor.value.color,
          gradients: [],
          gradientColors,
          paletteColors: palette.colors,
          allowTransparent: false,
          transparent: false,
          localSettings,
          property: 'textColor',
          actions,
          target,
        }) : null}
      </div>
    </fieldset>
    <div
      id="elce-appearance-frame-field"
      className="elce-appearance-field"
    >
      <label
        id="elce-appearance-frame-label"
        className="elce-appearance-inline-choice"
        htmlFor="elce-appearance-frame"
      >
        <input
          id="elce-appearance-frame"
          type="checkbox"
          checked={resolved.frame.value}
          mix={on<HTMLInputElement, 'change'>('change', (event) => actions.setAppearanceProperty(
            target,
            'frame',
            event.currentTarget.checked,
          ))}
        />
        Cadre
      </label>
      {renderResetButton('elce-appearance-frame-reset', 'Réinitialiser le cadre', localSettings, 'frame', actions, target)}
    </div>
    {hasTextSurface ? renderTypographyPairField(
      matchingTypographyPairId(resolved.headingFontId.value, resolved.bodyFontId.value),
      (pairId) => {
        const pair = APPEARANCE_TYPOGRAPHY_PAIRS.find((entry) => entry.id === pairId)
        if (pair !== undefined) actions.setAppearanceTypography(target, pair.headingFontId, pair.bodyFontId)
      },
      localSettings,
      actions,
      target,
    ) : null}
    {hasTextSurface ? renderSelectField(
      'elce-appearance-density',
      'Espacement',
      resolved.density.value === 'none' ? 'normal' : resolved.density.value,
      APPEARANCE_DENSITIES
        .filter((entry) => entry.value !== 'none')
        .map((entry) => ({ value: entry.value, label: entry.label })),
      (value) => actions.setAppearanceProperty(target, 'density', value),
      localSettings,
      'density',
      actions,
      target,
    ) : null}
    {hasTextSurface && !imageTitleCard ? <div
      id="elce-appearance-auto-contrast-field"
      className="elce-appearance-field"
    >
      <label
        id="elce-appearance-auto-contrast-label"
        htmlFor="elce-appearance-auto-contrast"
      >
        <input
          id="elce-appearance-auto-contrast"
          type="checkbox"
          checked={resolved.autoContrast.value}
          mix={on<HTMLInputElement, 'change'>('change', (event) => actions.setAppearanceProperty(
            target,
            'autoContrast',
            event.currentTarget.checked,
          ))}
        />
        Contraste auto
      </label>
      {renderResetButton('elce-appearance-auto-contrast-reset', 'Réinitialiser le contraste auto', localSettings, 'autoContrast', actions, target)}
    </div> : null}
    </div>
  </section>
}

interface ColorFieldProps {
  readonly id: string
  readonly label: string
  readonly color: string
  readonly backgroundChoice?: AppearanceBackground
  readonly paletteColors: Readonly<Record<AppearanceColorRole, string>>
  readonly gradients: typeof APPEARANCE_BACKGROUND_GRADIENTS | readonly []
  readonly gradientColors: AppearanceGradientColors
  readonly allowTransparent: boolean
  readonly transparent: boolean
  readonly localSettings: AppearanceSettings | undefined
  readonly property: 'background' | 'textColor'
  readonly actions: EditorActionsFacade
  readonly target: AppearanceTarget
}

/** Renders a native color picker with semantic palette swatches and a per-property reset. */
function renderColorField(props: ColorFieldProps): RemixNode {
  const {
    id,
    label,
    color,
    backgroundChoice,
    paletteColors,
    gradients,
    gradientColors,
    allowTransparent,
    transparent,
    localSettings,
    property,
    actions,
    target,
  } = props
  return <fieldset
    id={`${id}-field`}
    className="elce-appearance-field"
  >
    <legend
      id={`${id}-legend`}
    >
      {label}
    </legend>
    {allowTransparent ? <label
      id={`${id}-transparent-label`}
      className="elce-appearance-inline-choice"
      htmlFor={`${id}-transparent`}
    >
      <input
        id={`${id}-transparent`}
        type="checkbox"
        checked={transparent}
        mix={on<HTMLInputElement, 'change'>('change', (event) => {
          if (event.currentTarget.checked) {
            actions.setAppearanceProperty(target, 'density', 'none')
          } else if (property === 'background' && backgroundChoice !== undefined) {
            actions.setAppearanceProperty(target, 'background', backgroundChoice)
          } else {
            actions.setAppearanceProperty(target, 'density', 'normal')
          }
        })}
      />
      Transparent
    </label> : null}
    <label
      id={`${id}-picker-label`}
      htmlFor={`${id}-picker`}
    >
      Couleur personnalisée
    </label>
    <input
      id={`${id}-picker`}
      type="color"
      value={color}
      mix={on<HTMLInputElement, 'change'>('change', (event) => {
        const value = event.currentTarget.value
        if (property === 'background') actions.setAppearanceProperty(target, 'background', { kind: 'custom', value })
        else actions.setAppearanceProperty(target, 'textColor', { kind: 'custom', value })
      })}
    />
    <div
      id={`${id}-swatches`}
      className="elce-appearance-swatches"
      role="group"
      aria-label={`Teintes prédéfinies pour ${label.toLowerCase()}`}
    >
      {APPEARANCE_COLOR_ROLES.map((role) => renderPaletteSwatch(id, label, role, paletteColors[role], property, actions, target))}
      {property === 'background' ? gradients.map((gradient) => renderGradientSwatch(
        id,
        gradient.id,
        gradient.label,
        appearanceBackgroundGradientCss(gradient.id, gradientColors),
        backgroundChoice,
        actions,
        target,
      )) : null}
    </div>
    {renderResetButton(`${id}-reset`, `Réinitialiser ${label.toLowerCase()}`, localSettings, property, actions, target)}
  </fieldset>
}

/** Projects the shared generated palette roles into the gradient stops. */
function gradientColorsFor(resolved: ReturnType<typeof resolveAppearance>): AppearanceGradientColors {
  const colors = generateAppearanceColors(resolved)
  return {
    background: colors.background,
    surface: colors.surface,
    accent: colors.accent,
    'accent-secondary': colors.accentSecondary,
  }
}

/** Renders a Card-only gradient choice using the shared generated stops. */
function renderGradientSwatch(
  id: string,
  gradientId: AppearanceBackgroundGradientId,
  label: string,
  gradient: string,
  backgroundChoice: AppearanceBackground | undefined,
  actions: EditorActionsFacade,
  target: AppearanceTarget,
): RemixNode {
  return <button
    id={`${id}-gradient-${gradientId}`}
    className="elce-appearance-swatch"
    type="button"
    style={{ backgroundImage: gradient }}
    aria-label={`Utiliser le dégradé ${label.toLowerCase()}`}
    aria-pressed={backgroundChoice?.kind === 'gradient' && backgroundChoice.id === gradientId}
    title={label}
    mix={on<HTMLButtonElement, 'click'>('click', () => actions.setAppearanceProperty(target, 'background', {
      kind: 'gradient',
      id: gradientId,
    }))}
  />
}

/** Renders a picker suggestion that writes both stored font references together. */
function renderTypographyPairField(
  value: string,
  onValueChange: (value: string) => void,
  localSettings: AppearanceSettings | undefined,
  actions: EditorActionsFacade,
  target: AppearanceTarget,
): RemixNode {
  const hasLocalOverride = localSettings?.headingFontId !== undefined || localSettings?.bodyFontId !== undefined
  const options = [
    { value: '', label: 'Duo personnalisé' },
    ...APPEARANCE_TYPOGRAPHY_PAIRS.map((entry) => ({ value: entry.id, label: entry.label })),
  ]
  return <div id="elce-appearance-typography-pair-field" className="elce-appearance-field">
    <label id="elce-appearance-typography-pair-label" htmlFor="elce-appearance-typography-pair-select">
      Duo typographique
    </label>
    <select
      id="elce-appearance-typography-pair-select"
      value={value}
      mix={on<HTMLSelectElement, 'change'>('change', (event) => onValueChange(event.currentTarget.value))}
    >
      {options.map((option) => <option
        key={option.value}
        id={`elce-appearance-typography-pair-option-${option.value || 'custom'}`}
        value={option.value}
        selected={option.value === value}
        disabled={option.value === ''}
      >
        {option.label}
      </option>)}
    </select>
    {hasLocalOverride ? <button
      id="elce-appearance-typography-pair-reset"
      className="elce-appearance-reset"
      type="button"
      aria-label="Réinitialiser le duo typographique"
      title="Réinitialiser le duo typographique"
      mix={on<HTMLButtonElement, 'click'>('click', () => {
        if (localSettings?.headingFontId !== undefined) actions.resetAppearanceProperty(target, 'headingFontId')
        if (localSettings?.bodyFontId !== undefined) actions.resetAppearanceProperty(target, 'bodyFontId')
      })}
    >
      Réinitialiser
    </button> : null}
  </div>
}

/** Returns a UI pairing only when both selected font families match it. */
function matchingTypographyPairId(headingFontId: string, bodyFontId: string): string {
  return APPEARANCE_TYPOGRAPHY_PAIRS.find((pair) =>
    pair.headingFontId === headingFontId && pair.bodyFontId === bodyFontId)?.id ?? ''
}

/** Renders one accessible semantic swatch that tracks the active palette. */
function renderPaletteSwatch(
  id: string,
  label: string,
  role: AppearanceColorRole,
  color: string,
  property: 'background' | 'textColor',
  actions: EditorActionsFacade,
  target: AppearanceTarget,
): RemixNode {
  return <button
    id={`${id}-swatch-${role}`}
    className="elce-appearance-swatch"
    type="button"
    style={{ backgroundColor: color }}
    aria-label={`Utiliser la teinte ${appearanceRoleLabels[role]} pour ${label.toLowerCase()}`}
    title={`${appearanceRoleLabels[role]} · ${color}`}
    mix={on<HTMLButtonElement, 'click'>('click', () => {
      const choice = { kind: 'palette', role } as const
      if (property === 'background') actions.setAppearanceProperty(target, 'background', choice)
      else actions.setAppearanceProperty(target, 'textColor', choice)
    })}
  />
}

/** Renders a labeled select whose current effective value remains editable. */
function renderSelectField<Value extends string, Property extends AppearanceProperty>(
  id: string,
  label: string,
  value: Value,
  options: readonly Readonly<{ value: Value; label: string }>[],
  onValueChange: (value: Value) => void,
  localSettings: import('../../config/appearance/appearance-types').AppearanceSettings | undefined,
  property: Property,
  actions: EditorActionsFacade,
  target: AppearanceTargetForProperty<Property>,
): RemixNode {
  return <div
    id={`${id}-field`}
    className="elce-appearance-field"
  >
    <label
      id={`${id}-label`}
      htmlFor={`${id}-select`}
    >
      {label}
    </label>
    <select
      id={`${id}-select`}
      mix={on<HTMLSelectElement, 'change'>('change', (event) => onValueChange(event.currentTarget.value as Value))}
    >
      {options.map((option) => <option
        key={option.value}
        id={`${id}-option-${option.value}`}
        value={option.value}
        selected={option.value === value}
      >
        {option.label}
      </option>)}
    </select>
    {renderResetButton(`${id}-reset`, `Réinitialiser ${label.toLowerCase()}`, localSettings, property, actions, target)}
  </div>
}

/** Renders reset only when the selected scope owns an explicit value. */
function renderResetButton<Property extends AppearanceProperty>(
  id: string,
  label: string,
  settings: import('../../config/appearance/appearance-types').AppearanceSettings | undefined,
  property: Property,
  actions: EditorActionsFacade,
  target: AppearanceTargetForProperty<Property>,
): RemixNode {
  if (settings?.[property] === undefined) return null
  return <button
    id={id}
    className="elce-appearance-reset"
    type="button"
    aria-label={label}
    title={label}
    mix={on<HTMLButtonElement, 'click'>('click', () => actions.resetAppearanceProperty(target, property))}
  >
    Réinitialiser
  </button>
}

/** Checks that a selected appearance scope still belongs to the active document. */
function appearanceTargetExists(view: EditorViewModel, target: AppearanceTarget): boolean {
  switch (target.kind) {
    case 'document': return true
    case 'page': return view.documentModel.pages.some((page) => page.id === target.pageId)
    case 'bdc': return view.documentModel.bdcs.some((bdc) => bdc.id === target.bdcId)
  }
}

/** Names the selected scope in the panel without exposing a second target control. */
function appearanceTargetLabel(view: EditorViewModel, target: AppearanceTarget): string {
  if (target.kind === 'document') return 'Projet'
  if (target.kind === 'page') {
    const index = view.documentModel.pages.findIndex((page) => page.id === target.pageId)
    const page = view.documentModel.pages[index]
    return `Page · ${page?.name || `Page ${index + 1}`}`
  }
  const bdc = view.documentModel.bdcs.find((candidate) => candidate.id === target.bdcId)
  if (bdc === undefined) return 'Projet'
  if (bdc.type === BDC_TYPE.SECTION) return `Section · ${bdc.section?.title.trim() || 'Sans titre'}`
  if (bdc.type === BDC_TYPE.CARD) return `Carte · ${bdc.card?.title.trim() || 'Sans titre'}`
  switch (bdc.type) {
    case BDC_TYPE.CAROUSEL: return 'Carousel'
    case BDC_TYPE.QUESTION: return 'Question'
    case BDC_TYPE.EVALUATION_RESULT: return 'Résultat'
    case BDC_TYPE.STATISTICAL_GRAPH: return 'Graphe'
    default: return 'Bloc'
  }
}

/** Returns the sparse settings stored directly on the selected target. */
function appearanceSettingsAt(
  document: EditorViewModel['documentModel'],
  target: AppearanceTarget,
): import('../../config/appearance/appearance-types').AppearanceSettings | undefined {
  switch (target.kind) {
    case 'document': return document.data.appearance
    case 'page': return document.pages.find((page) => page.id === target.pageId)?.appearance
    case 'bdc': return document.bdcs.find((bdc) => bdc.id === target.bdcId)?.appearance
  }
}

/** Hides text and spacing options for a Photo Card that has no text surface. */
function isTextBearingCard(view: EditorViewModel, target: AppearanceTarget): boolean {
  if (target.kind !== 'bdc') return true
  const bdc = view.documentModel.bdcs.find((candidate) => candidate.id === target.bdcId)
  return bdc?.type !== BDC_TYPE.CARD || bdc.presetId !== DEFAULT_PRESET_ID.PHOTO
}

