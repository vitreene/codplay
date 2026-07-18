import type { Decor, ItemType } from './types'

/**
 * Preset appliqué une fois à `item.initialDecorId` quand le type d'un item est assigné
 * (`assignType`) — un objet JSON simple, pas une couche vivante
 * (`2026-07-17-decor-keyframe-model-notes.md` §3/§4 : « on y reviendra quand on pourra en
 * créer »). Un type absent de cette table démarre sans preset (décor initial vide, comportement
 * inchangé) — seul `'text'` est couvert aujourd'hui, seul type que `buildSceneDoc` sait construire.
 * Valeurs indicatives fournies par l'auteur (2026-07-17) : fond bleu océan, bords cyan épais
 * arrondis, texte centré horizontalement et verticalement, largeur 80% de la scène.
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
      'border-radius': '2cqw',
      'text-align': 'center',
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
    },
    offset: { width: 80 },
  },
}
