export type AppearanceColorRole = 'background' | 'surface' | 'text' | 'muted' | 'accent' | 'border'
export type AppearanceDensity = 'none' | 'compact' | 'normal' | 'large'

export type AppearanceColor =
  | Readonly<{ kind: 'palette'; role: AppearanceColorRole }>
  | Readonly<{ kind: 'custom'; value: string }>

export type AppearanceBackground = AppearanceColor

/** Stores the project preset when project-scoped, plus sparse property overrides. */
export interface AppearanceSettings {
  /** The coordinated general preset is available at project scope only. */
  readonly presetId?: string
  readonly paletteId?: string
  readonly headingFontId?: string
  readonly bodyFontId?: string
  readonly density?: AppearanceDensity
  readonly background?: AppearanceBackground
  readonly textColor?: AppearanceColor
  readonly autoContrast?: boolean
}

export interface AppearancePalette {
  readonly id: string
  readonly label: string
  readonly brightness: 'light' | 'dark'
  readonly colors: Readonly<Record<AppearanceColorRole, string>>
  readonly cssFile: string
}

/** Identifies one Google Font family and its source classes. */
export interface AppearanceFont {
  readonly id: string
  readonly label: string
  readonly family: string
  readonly fontDirectory: string
  readonly cssFile: string
  readonly headingClassName: string
  readonly bodyClassName: string
}

/** A picker suggestion that fills two independent document font references. */
export interface AppearanceTypographyPair {
  readonly id: string
  readonly label: string
  readonly headingFontId: string
  readonly bodyFontId: string
}

export interface AppearancePreset {
  readonly id: string
  readonly label: string
  readonly paletteId: string
  readonly headingFontId: string
  readonly bodyFontId: string
  readonly density: AppearanceDensity
}
