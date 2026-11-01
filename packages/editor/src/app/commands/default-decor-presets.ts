import type { Decor, EditorScene, ItemType } from './types'
import { hasExplicitPlacementGeometry, mergePlacementGeometry, missingZoneFillStyle } from './offset-placement'
import { resolveKeyframeChannel } from './types'

const DEFAULT_TEXT_FONT_SIZE = '3cqw'

/**
 * Preset appliqué une fois à `item.initialDecorId` quand le type d'un item est assigné
 * (`assignType`) — un objet JSON simple, pas une couche vivante
 * (`specs/item-presentation-spec.md`). Un type absent de cette table démarre sans preset (décor initial vide, comportement
 * inchangé) — seul `'text'` est couvert aujourd'hui, seul type que `buildSceneDocV2` sait construire.
 * Valeurs indicatives fournies par l'auteur (2026-07-17) : fond bleu océan, bords cyan épais
 * arrondis, texte centré horizontalement et verticalement, largeur 80% de la scène ; la taille
 * responsive de 3cqw reprend celle du preset « Étiquette ».
 * `display:flex` + `align-items:center` pour le centrage vertical — aucune convention existante
 * dans le runtime (`text-component.ts`/`base-component.ts` ne posent aucun display par défaut,
 * vérifié) ; `justify-content:center` gardé en complément de `text-align:center` plutôt qu'en
 * remplacement, les deux ne se contredisent pas.
 */
export const DEFAULT_DECOR_PRESET: Partial<Record<ItemType, Partial<Omit<Decor, 'id'>>>> = {
  text: {
    style: {
      'background-color': 'oklch(0.45 0.12 235)',
      'border-color': 'oklch(0.85 0.15 195)',
      'border-width': '0.6cqw',
      'border-style': 'solid',
      'border-radius': '2cqw',
      'font-size': DEFAULT_TEXT_FONT_SIZE,
      'text-align': 'center',
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
    },
    offset: { width: 80 },
  },
}

/** Adds the responsive text-size default to legacy text items that predate it. */
export function applyDefaultTextFontSize(scene: EditorScene): EditorScene {
  const decors = scene.items.reduce((currentDecors, item) => {
    if (item.type !== 'text') return currentDecors
    const decor = currentDecors[item.initialDecorId]
    if (!decor || decor.style?.['font-size'] !== undefined) return currentDecors

    const hasCustomFontSize = decor.custom?.split(';').some((declaration) => {
      const separator = declaration.indexOf(':')
      return separator >= 0 && declaration.slice(0, separator).trim().toLowerCase() === 'font-size'
    }) ?? false
    if (hasCustomFontSize) return currentDecors

    return {
      ...currentDecors,
      [item.initialDecorId]: {
        ...decor,
        style: { ...decor.style, 'font-size': DEFAULT_TEXT_FONT_SIZE },
      },
    }
  }, scene.decors)

  return decors === scene.decors ? scene : { ...scene, decors }
}

/** Materializes the existing Builder's zone-fill defaults into unique authored Decor records. */
export function applyDefaultZonePlacementStyle(scene: EditorScene): EditorScene {
  const decorUsageCounts = new Map<string, number>()
  for (const item of scene.items) {
    for (const decorId of [item.initialDecorId, ...item.keyframes.map((keyframe) => keyframe.decorId)]) {
      decorUsageCounts.set(decorId, (decorUsageCounts.get(decorId) ?? 0) + 1)
    }
  }

  const nextDecors = { ...scene.decors }
  for (const item of scene.items) {
    const orderedKeyframes = [...item.keyframes].sort((left, right) => left.timeMs - right.timeMs)
    const initialDecor = scene.decors[item.initialDecorId]
    const priorDecors: Decor[] = []
    let effectiveOffset = initialDecor?.offset
    let effectiveZoneId = initialDecor?.zoneId ?? null
    const placementLayers = [
      ...(initialDecor === undefined ? [] : [{ decorId: initialDecor.id, decor: initialDecor, keyframe: undefined }]),
      ...orderedKeyframes.map((keyframe) => ({ decorId: keyframe.decorId, decor: scene.decors[keyframe.decorId], keyframe })),
    ]

    for (const { decorId, decor, keyframe } of placementLayers) {
      if (decor === undefined) continue
      if (keyframe !== undefined && resolveKeyframeChannel(keyframe) === 'pose') {
        effectiveOffset = mergePlacementGeometry(effectiveOffset, decor.offset)
        if (Object.prototype.hasOwnProperty.call(decor, 'zoneId')) effectiveZoneId = decor.zoneId ?? null
      }
      if (effectiveZoneId === null || (decorUsageCounts.get(decorId) ?? 0) > 1
        || hasExplicitPlacementGeometry(effectiveOffset)) {
        if (decor !== undefined) priorDecors.push(decor)
        continue
      }
      const inheritedStyle = priorDecors.reduce((style, prior) => ({ ...style, ...prior.style }), {} as Record<string, string>)
      const inheritedCustom = priorDecors.toReversed().find((prior) => prior.custom !== undefined)?.custom
      const additions = missingZoneFillStyle(
        { ...inheritedStyle, ...decor.style },
        [inheritedCustom, decor.custom].filter((value): value is string => value !== undefined).join(';'),
      )
      if (Object.keys(additions).length > 0) {
        nextDecors[decorId] = { ...decor, style: { ...decor.style, ...additions } }
      }
      priorDecors.push(nextDecors[decorId]!)
    }
  }

  return Object.keys(scene.decors).every((decorId) => nextDecors[decorId] === scene.decors[decorId])
    ? scene
    : { ...scene, decors: nextDecors }
}
