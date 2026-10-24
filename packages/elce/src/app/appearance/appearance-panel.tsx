import { on, type RemixNode } from 'remix/ui'
import { BDC_TYPE, DEFAULT_PRESET_ID } from '../../config/document-config'
import {
  APPEARANCE_COLOR_ROLES,
  APPEARANCE_DENSITIES,
  APPEARANCE_PALETTES,
  APPEARANCE_PRESETS,
  APPEARANCE_TYPOGRAPHY_PAIRS,
  getAppearancePalette,
} from '../../config/appearance/appearance-config'
import type { AppearanceColorRole } from '../../config/appearance/appearance-types'
import type {
  AppearanceProperty,
  AppearanceTarget,
  AppearanceTargetForProperty,
} from '../../domain/commands/document-command-types'
import type { EditorActionsFacade } from '../facades/editor-actions-facade'
import type { EditorViewModel } from '../selectors/editor-view-model'
import { resolveAppearance } from '../../domain/appearance/appearance-resolver'

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
  const textCard = isTextBearingCard(view, target)

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
          color: resolved.background.value.color === 'transparent' ? palette.colors.background : resolved.background.value.color,
          choice: resolved.background.value.choice,
          paletteColors: palette.colors,
          allowTransparent: true,
          localSettings,
          property: 'background',
          actions,
          target,
        })}
        {textCard ? renderColorField({
          id: 'elce-appearance-text-color',
          label: 'Couleur du texte',
          color: resolved.textColor.value.color,
          choice: resolved.textColor.value.choice,
          paletteColors: palette.colors,
          allowTransparent: false,
          localSettings,
          property: 'textColor',
          actions,
          target,
        }) : null}
      </div>
    </fieldset>
    {textCard ? renderSelectField(
      'elce-appearance-typography',
      'Duo typographique',
      resolved.typographyPairId.value,
      APPEARANCE_TYPOGRAPHY_PAIRS.map((entry) => ({ value: entry.id, label: entry.label })),
      (value) => actions.setAppearanceProperty(target, 'typographyPairId', value),
      localSettings,
      'typographyPairId',
      actions,
      target,
    ) : null}
    {textCard ? renderSelectField(
      'elce-appearance-density',
      'Espacement',
      resolved.density.value,
      APPEARANCE_DENSITIES.map((entry) => ({ value: entry.value, label: entry.label })),
      (value) => actions.setAppearanceProperty(target, 'density', value as 'none' | 'compact' | 'normal' | 'large'),
      localSettings,
      'density',
      actions,
      target,
    ) : null}
    {textCard ? <div
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
  readonly choice: import('../../config/appearance/appearance-types').AppearanceBackground | import('../../config/appearance/appearance-types').AppearanceColor
  readonly paletteColors: Readonly<Record<AppearanceColorRole, string>>
  readonly allowTransparent: boolean
  readonly localSettings: import('../../config/appearance/appearance-types').AppearanceSettings | undefined
  readonly property: 'background' | 'textColor'
  readonly actions: EditorActionsFacade
  readonly target: AppearanceTarget
}

/** Renders a native color picker with semantic palette swatches and a per-property reset. */
function renderColorField(props: ColorFieldProps): RemixNode {
  const { id, label, color, choice, paletteColors, allowTransparent, localSettings, property, actions, target } = props
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
        checked={choice.kind === 'transparent'}
        mix={on<HTMLInputElement, 'change'>('change', (event) => {
          if (event.currentTarget.checked) {
            actions.setAppearanceProperty(target, 'background', { kind: 'transparent' })
          } else {
            actions.setAppearanceProperty(target, 'background', { kind: 'palette', role: 'background' })
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
    </div>
    {renderResetButton(`${id}-reset`, `Réinitialiser ${label.toLowerCase()}`, localSettings, property, actions, target)}
  </fieldset>
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

