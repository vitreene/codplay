export type AppearanceColorRole = 'background' | 'surface' | 'text' | 'muted' | 'accent' | 'border'
export type AppearanceDensity = 'none' | 'compact' | 'normal' | 'large'

export type AppearanceColor =
  | Readonly<{ kind: 'palette'; role: AppearanceColorRole }>
  | Readonly<{ kind: 'custom'; value: string }>

export type AppearanceBackground = AppearanceColor | Readonly<{ kind: 'transparent' }>

/** Stores the project preset when project-scoped, plus sparse property overrides. */
export interface AppearanceSettings {
  /** The coordinated general preset is available at project scope only. */
  readonly presetId?: string
  readonly paletteId?: string
  readonly typographyPairId?: string
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
}

/** Identifies an editorial pair; font loading and files belong to resource configuration. */
export interface AppearanceTypographyPair {
  readonly id: string
  readonly label: string
  readonly headingLabel: string
  readonly bodyLabel: string
  readonly headingFamily: string
  readonly bodyFamily: string
}

export interface AppearancePreset {
  readonly id: string
  readonly label: string
  readonly paletteId: string
  readonly typographyPairId: string
  readonly density: AppearanceDensity
}
