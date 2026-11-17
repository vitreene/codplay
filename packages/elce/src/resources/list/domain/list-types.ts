import type { RevelationTransition } from '../../revelation/revelation-types'

/** Stable authoring choice projected to semantic list markup and CSS. */
export type ListPrefix = 'none' | 'disc' | 'square' | 'dash' | 'lower-alpha' | 'decimal' | 'lower-roman' | 'custom'

/** One independently editable plain-text row in a List module. */
export interface ListRow {
  readonly id: string
  readonly text: string
  /** Null follows the shared interval, including before the first row. */
  readonly delayMs: number | null
}

/** Context-independent List data that an owning resource may persist. */
export interface ListContent {
  readonly rows: readonly ListRow[]
  readonly prefix: ListPrefix
  readonly transition: RevelationTransition
  readonly intervalMs: number
  readonly start: number
  readonly customMarker: string
}
