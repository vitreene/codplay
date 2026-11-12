import type { CardPreset } from './card-preset-types'
import type { CardPresetBuild, CardPresetContentByZone } from './card-preset-builder-types'

/** Resolves one configured Elcé card preset into instance markup and zone ids. */
export class ElceCardPresetBuilder {
  private readonly presets: Readonly<Record<string, CardPreset>>

  /** Creates a preset builder with the registry provided by its composition. */
  public constructor(presets: Readonly<Record<string, CardPreset>>) {
    this.presets = presets
  }

  /** Returns one configured preset for consumers that need its zone metadata. */
  public getPreset(presetId: string): CardPreset | undefined {
    return this.presets[presetId]
  }

  /** Returns fixed markup and the per-instance CodPlay target for each zone. */
  public build(
    presetId: string,
    rootId: string,
    partPrefix: string,
    contentByZone: CardPresetContentByZone = {},
  ): CardPresetBuild {
    const preset = this.presets[presetId]
    if (preset === undefined) throw new Error(`Preset de carte inconnu : ${presetId}`)

    const markup = preset.markupTemplate
      .replaceAll('{{rootId}}', rootId)
      .replaceAll('{{partPrefix}}', partPrefix)
      .replaceAll('{{rootClassName}}', preset.rootClassName)
      .replace(/\{\{content:([^}]+)\}\}/g, (_placeholder, zoneId: string) => contentByZone[zoneId] ?? '')

    return {
      markup,
      rootClassName: preset.rootClassName,
      zonePartIds: Object.fromEntries(preset.zones.map((zone) => [zone.id, `${partPrefix}:${zone.id}`])),
      zoneClassNames: Object.fromEntries(preset.zones.flatMap((zone) => zone.className === undefined
        ? []
        : [[zone.id, zone.className]])),
    }
  }
}
