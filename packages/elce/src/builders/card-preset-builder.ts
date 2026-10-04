import { CARD_PRESETS } from '../config/presets'
import type { CardPresetBuild, CardPresetContentByZone } from './card-preset-builder-types'

/** Resolves one configured Elcé card preset into instance markup and zone ids. */
export class ElceCardPresetBuilder {
  /** Returns fixed markup and the per-instance CodPlay target for each zone. */
  public build(
    presetId: string,
    rootId: string,
    partPrefix: string,
    contentByZone: CardPresetContentByZone = {},
  ): CardPresetBuild {
    const preset = CARD_PRESETS[presetId]
    if (preset === undefined) throw new Error(`Preset de carte inconnu : ${presetId}`)

    let markup = preset.markupTemplate
      .replaceAll('{{rootId}}', rootId)
      .replaceAll('{{partPrefix}}', partPrefix)
    for (const zone of preset.zones) {
      markup = markup.replaceAll(`{{content:${zone.id}}}`, contentByZone[zone.id] ?? '')
    }

    return {
      markup,
      zonePartIds: Object.fromEntries(preset.zones.map((zone) => [zone.id, `${partPrefix}:${zone.id}`])),
    }
  }
}
