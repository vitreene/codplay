export type CardPresetContent = 'text' | 'media' | 'bdc'

export interface CardPreset {
  readonly id: string
  readonly label: string
  readonly rootClassName: string
  readonly allowedContent: readonly CardPresetContent[]
  readonly markupTemplate: string
  readonly zones: readonly {
    readonly id: string
    readonly label: string
    readonly required: boolean
    readonly content: CardPresetContent
  }[]
}
