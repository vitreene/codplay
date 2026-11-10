/** Stable authoring choice projected to semantic list markup and CSS. */
export type ListPrefix = 'none' | 'disc' | 'square' | 'dash' | 'lower-alpha' | 'decimal' | 'lower-roman' | 'custom'

/** One independently editable plain-text row in a List module. */
export interface ListRow {
  readonly id: string
  readonly text: string
  /** Null follows the Card interval, except the first row which starts immediately. */
  readonly delayMs: number | null
}

/** Context-independent List data that an owning resource may persist. */
export interface ListContent {
  readonly rows: readonly ListRow[]
  readonly prefix: ListPrefix
  readonly intervalMs: number
  readonly start: number
  readonly customMarker: string
}
