/** Identifies a rich-text selection owned by one Section editor instance. */
export interface SectionSelection {
  readonly sectionBdcId: string
  readonly anchor: number
  readonly head: number
}
