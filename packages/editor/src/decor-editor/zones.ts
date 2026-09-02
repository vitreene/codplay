import type { OrientationContext, ZoneCoords, ZoneDef, ZoneTable } from './types'

/** Ratio largeur/hauteur ≥ 1 → horizontal, sinon vertical (spec §3.4, sans hystérésis). */
export function orientationFromRatio(widthPx: number, heightPx: number): OrientationContext {
  return widthPx / heightPx >= 1 ? 'horizontal' : 'vertical'
}

export function coordsForContext(zone: ZoneDef, context: OrientationContext): ZoneCoords {
  return 'coords' in zone ? zone.coords : zone.contexts[context]
}

/**
 * Met à jour les coordonnées d'une zone pour un contexte donné. Si la zone est déjà
 * partagée (`coords`) et que le contexte visé diffère du contexte courant de résolution,
 * elle bascule en forme explicite par contexte : la valeur partagée sert de base aux
 * deux contextes, puis la modification s'applique au contexte ciblé (spec §3.4).
 */
export function updateZoneCoords(
  table: ZoneTable,
  zoneName: string,
  context: OrientationContext,
  coords: ZoneCoords,
): ZoneTable {
  return table.map((zone) => {
    if (zone.name !== zoneName) return zone

    if ('contexts' in zone) {
      return { name: zone.name, contexts: { ...zone.contexts, [context]: coords } }
    }

    const otherContext: OrientationContext = context === 'horizontal' ? 'vertical' : 'horizontal'
    return {
      name: zone.name,
      contexts: {
        [context]: coords,
        [otherContext]: zone.coords,
      } as Record<OrientationContext, ZoneCoords>,
    }
  })
}
