export type CardPresetContentByZone = Readonly<Record<string, string>>

export interface CardPresetBuild {
  readonly markup: string
  readonly rootClassName: string
  readonly zonePartIds: Readonly<Record<string, string>>
}
