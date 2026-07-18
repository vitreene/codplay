# ed2 — Décor par keyframe : preset à la création, cascade en direct à la lecture

Suite de `2026-07-17-decor-keyframe-model-notes.md` (fonctionnement actuel documenté, modèle
validé en discussion). Ce plan traduit le modèle validé en changements de code précis, avant toute
implémentation.

## 0. Rappel du modèle validé

Analogie de l'auteur : feuille de style de paragraphe (preset) / feuille de style de caractère /
remplacement local — un empilement par couches, jamais un diff lu à l'affichage.

- **Preset** : simple objet JSON par type d'item, appliqué UNE fois à la création (assignation du
  type) — pas une couche vivante tant qu'il n'y a pas de système pour en créer/éditer (« on y
  reviendra quand on pourra en créer »).
- **Décor de keyframe** : reste tel qu'aujourd'hui à la création (vide pour `createKeyframe`,
  référence partagée avec le voisin pour `KEYFRAME.ADD`/`adjacentDecorId`) — **aucun changement
  ici**, contrairement à une première piste envisagée (dupliquer les propriétés divergées à la
  création) puis invalidée : elle ne capte qu'un instantané figé au moment de la création, donc ne
  reflète jamais une édition FAITE APRÈS COUP sur un keyframe antérieur (répro de l'auteur : éditer
  le border sur kf1 après que kf2 existe déjà — kf2 doit le voir, un instantané pris avant ne le
  peut pas).
- **Lecture (dedit)** : recalculée EN DIRECT à chaque sélection — jamais stockée, jamais figée à un
  instant donné. Pour un keyframe sélectionné : `item.initialDecorId` ⊕ chaque keyframe antérieur
  dans l'ordre du temps ⊕ le keyframe sélectionné lui-même. Une propriété absente d'un maillon
  reste celle du maillon précédent (persistance visuelle standard d'un keyframe non retouché).
  Sûr vis-à-vis d'un réordonnancement ultérieur : rien n'est stocké en supposant un ordre, tout est
  recalculé depuis l'état courant à chaque fois — même principe que le diff du builder
  (`buildKeyframeDecorActions`), déjà sûr aujourd'hui pour la même raison.
- **Écriture** : inchangée — `setDecor` sur le décor du keyframe ciblé ; le fork-à-l'édition
  (`isDecorSharedByAnotherKeyframe` + `registerDecor` + `assignKeyframeDecor`, déjà codé et testé
  ce jour) reste nécessaire tel quel — il protège l'écriture (éviter qu'éditer un keyframe partagé
  ne mute aussi son voisin), un problème indépendant et non résolu par la cascade de lecture.
- **Builder** : **aucun changement**. Vérifié en lisant `computeStyleDiff`
  (`build-scene.ts:710`) : il ne considère que les clés du style RÉSOLU du keyframe destination, et
  le runtime interpole depuis la valeur COURANTE du perso (jamais une valeur figée du document) —
  un keyframe qui ne touche pas une propriété la laisse déjà persister visuellement depuis le
  keyframe précédent, sans qu'aucun calcul de cascade soit nécessaire côté build. C'est déjà
  exactement le comportement voulu.

## 1. Étape A — Table de preset statique par type d'item

Nouveau fichier `packages/editor/src/app/commands/default-decor-presets.ts` :

```typescript
import type { Decor, ItemType } from './types'

/**
 * Preset appliqué une fois à `item.initialDecorId` quand le type d'un item est assigné — un
 * objet JSON simple, pas une couche vivante (`2026-07-17-decor-keyframe-model-notes.md` §3/§4).
 * Un type absent de cette table démarre sans preset (décor initial vide, comportement actuel
 * inchangé) — seul `'text'` est couvert aujourd'hui, seul type que `buildSceneDoc` sait construire
 * (`build-scene.ts` §6 du plan v1).
 */
export const DEFAULT_DECOR_PRESET: Partial<Record<ItemType, Partial<Omit<Decor, 'id'>>>> = {
  text: {
    style: { /* à définir avec l'auteur — pas de valeur inventée ici */ },
  },
}
```

**Point à trancher avec l'auteur avant de coder cette étape** : quelles valeurs concrètes pour le
preset `text` (taille de police, couleur, police…) — pas de valeur inventée sans validation, même
principe que pour le reste de ce chantier.

## 2. Étape B — Application du preset à l'assignation du type

`base-commands.ts::assignType` (ligne 67) — actuellement :

```typescript
export function assignType(scene: EditorScene, args: { itemId: string; type: ItemType }): EditorScene {
  const item = requireItem(scene, args.itemId)
  if (item.type !== 'bloc') {
    throw new Error(`assignType: item '${args.itemId}' is already type '${item.type}' — type change is only allowed from 'bloc'`)
  }
  ...
}
```

Après le changement de type, si `DEFAULT_DECOR_PRESET[args.type]` existe, fusionner son contenu
dans `item.initialDecorId` via `setDecor` (déjà défini juste au-dessus dans le même fichier,
aucune nouvelle commande nécessaire) :

```typescript
export function assignType(scene: EditorScene, args: { itemId: string; type: ItemType }): EditorScene {
  const item = requireItem(scene, args.itemId)
  if (item.type !== 'bloc') {
    throw new Error(`assignType: item '${args.itemId}' is already type '${item.type}' — type change is only allowed from 'bloc'`)
  }
  const withType = updateItem(scene, args.itemId, (i) => ({ ...i, type: args.type }))
  const preset = DEFAULT_DECOR_PRESET[args.type]
  return preset ? setDecor(withType, { decorId: item.initialDecorId, patch: preset }) : withType
}
```

Bundlé DANS `assignType` (pas une commande séparée que l'appelant devrait penser à enchaîner) —
garantit qu'aucun appelant ne peut oublier le preset, sans ajouter de vocabulaire de commande.

## 3. Étape C — Cascade en direct côté lecture (`decor-editor-bridge.ts`)

Le seul fichier qui change pour la lecture. Nouvelle fonction, à côté de `resolveTarget` :

```typescript
/**
 * Décor effectif d'un keyframe sélectionné — cascade en DIRECT (jamais stockée, jamais figée à un
 * instant donné) : `item.initialDecorId`, puis chaque keyframe antérieur dans l'ordre du temps,
 * puis le keyframe lui-même. Une propriété absente d'un maillon reste celle du maillon précédent
 * (persistance visuelle standard d'un keyframe non retouché) — recalculée à CHAQUE sélection,
 * jamais mémorisée : un réordonnancement ultérieur ou une édition faite après coup sur un
 * keyframe antérieur se reflètent immédiatement, sans jamais devenir « faux »
 * (`2026-07-17-decor-keyframe-model-notes.md` §3, réponse à la question du 2026-07-17 sur le
 * border édité sur kf1 après la création de kf2). Réutilise `resolveCurrentPatch` (conversion
 * décor→patch déjà existante) et `mergePatch` (`decor-editor/merge.ts`, déjà existant) — aucune
 * nouvelle logique de fusion écrite ici.
 */
function resolveEffectiveKeyframePatch(
  scene: EditorScene,
  item: Item,
  keyframeId: string,
  content: Content | undefined,
): DecorPatch {
  const kf = item.keyframes.find((k) => k.id === keyframeId)
  const initial = scene.decors[item.initialDecorId] ?? { id: item.initialDecorId }
  if (!kf) return resolveCurrentPatch(initial, content, scene)

  const precedingDecors = item.keyframes
    .filter((k) => k.timeMs < kf.timeMs)
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((k) => scene.decors[k.decorId])
    .filter((d): d is Decor => d !== undefined)

  const ownDecor = scene.decors[kf.decorId] ?? { id: kf.decorId }
  const layers = [initial, ...precedingDecors, ownDecor]
  return layers
    .map((d) => resolveCurrentPatch(d, content, scene))
    .reduce((acc, patch) => mergePatch(acc, patch), {} as DecorPatch)
}
```

`syncSelection` (ligne ~195) — remplace l'appel direct à `resolveCurrentPatch(decor, ...)` par
`resolveEffectiveKeyframePatch(...)` quand `target.keyframeId` est défini ; comportement actuel
inchangé quand aucun keyframe n'est sélectionné (édition de `item.initialDecorId` directement).

Import à ajouter : `mergePatch` depuis `../../decor-editor/merge`.

**Ce qui NE change PAS** : `resolveTarget` (le `target.decorId` résolu reste celui du keyframe
sélectionné — c'est toujours lui qui reçoit l'écriture) ; `unsubscribeDecorChange` et son
fork-à-l'édition (§0, écriture inchangée) ; toute la mécanique de commit de fin de phase
(`2026-07-17-phase-commit-selection-recovery-plan.md`).

## 4. Ce qui ne bouge pas (vérifié, pas juste supposé)

- `createKeyframe`/`createNamedKeyframe`/`KEYFRAME.ADD`/`adjacentDecorId` — aucun changement. Le
  partage de référence à la création reste une optimisation valide (évite de dupliquer des décors
  identiques) : sûr côté écriture grâce au fork déjà en place, sûr côté lecture grâce à la cascade
  de cette étape — aucune des deux protections ne dépendait de l'autre.
- `build-scene.ts` — aucun changement (§0).
- Les tests déjà ajoutés ce jour (`decor-editor-bridge.spec.ts` — copy-on-write) restent valides
  tels quels : ce plan ajoute une couche de lecture, ne touche à aucun mécanisme d'écriture déjà
  testé.

## 5. Tests à ajouter

- `assignType` applique le preset à `item.initialDecorId` (nouveau test, `base-commands` ou
  équivalent) — et laisse le décor initial inchangé pour un type sans entrée dans la table.
- `decor-editor-bridge.spec.ts` — nouvelle scène à 2 keyframes, kf1 avec une couleur réglée, kf2
  vide : sélectionner kf2 doit afficher la couleur de kf1 dans le patch résolu (dedit).
- **Le test qui valide directement la question de l'auteur** : kf1 vide → kf2 créé (vide) →
  ÉDITER kf1 APRÈS COUP (ajouter un `border`) → re-sélectionner kf2 → le patch résolu doit
  maintenant inclure ce border, alors que kf2 lui-même n'a jamais été touché.
- Réordonnancement (`moveKeyframe`) suivi d'une re-sélection : la cascade doit refléter le NOUVEL
  ordre, jamais l'ancien — confirme l'absence de distorsion.

## 6. Ordre d'exécution proposé

A (table de preset — valeurs à confirmer avec l'auteur avant d'écrire le fichier) → B
(`assignType`) → C (`decor-editor-bridge.ts`, la cascade) → tests → validation Safari (répro exacte
de l'auteur : border sur kf1 après coup, visible en resélectionnant kf2) → nettoyage (si quelque
chose s'avère inutilisé une fois validé, à identifier après coup, pas anticipé ici).

---

**Ce plan est soumis pour relecture avant toute implémentation.**

## 7. Statut d'implémentation (2026-07-17)

Implémenté tel quel — étapes A/B/C, dans l'ordre. `tsc --noEmit` propre, 1052 tests verts (dont les
5 tests ajoutés : preset appliqué/absent sur `assignType`, cascade de base, retour direct de la
question de l'auteur — border ajouté sur kf1 après coup, visible en resélectionnant kf2 — et
comportement inchangé sans keyframe sélectionné).

Valeurs concrètes du preset `text` (fournies par l'auteur, puis complétées d'un ajout demandé en
cours de validation — centrage vertical) :
- Fond `oklch(0.45 0.12 235)` (bleu océan), bord `oklch(0.85 0.15 195)` (cyan),
  `border-width: 0.6cqw`, `border-radius: 2cqw` — épais et arrondis.
- `text-align: center` + `display:flex; align-items:center; justify-content:center` — centrage
  horizontal ET vertical (aucune convention de centrage vertical trouvée dans le runtime
  `text-component.ts`/`base-component.ts`, vérifié — ajouté explicitement dans le preset).
- `offset.width: 80` (cqw) — 80% de la largeur de la scène.

Validé en Safari, répro exacte de l'auteur reconstituée en direct : création d'item (preset visible
immédiatement — fond bleu, bord cyan, texte centré), édition d'un padding sur kf1 APRÈS que kf2
existe déjà, resélection de kf2 → le padding y apparaît (`12`), jamais figé à la création de kf2.
Aucune erreur console.

**Bug de fixture rencontré et corrigé en cours de test (pas un bug de code)** : `toHexForPicker`
(`render.ts:239`) ne reconnaît que le format `oklch(...)` via une regex stricte — un nom de couleur
CSS brut (`'red'`) dans une fixture de test retombe silencieusement sur le gris par défaut
(`#808080`), donnant l'illusion d'un échec de la cascade alors que la fonction calculait déjà la
bonne valeur (vérifié par instrumentation temporaire, retirée après diagnostic). Fixtures
corrigées pour utiliser le même format que le picker réel écrit.

Rien dans `packages/codplay` touché. Fichiers modifiés : `default-decor-presets.ts` (nouveau),
`base-commands.ts` (`assignType`), `decor-editor-bridge.ts` (cascade), tests associés.

## 8. CSS libre (`Decor.custom`) — même traitement qu'`offset`, gap fermé (2026-07-17)

En vérifiant le preset (`display`/`align-items`/`justify-content` n'ont pas de champ dédié dans la
palette), l'auteur signale que « Custom » (panneau CSS libre, `render.ts::renderCustomCodePanel`)
devrait déjà router — un gap flaggé plus tôt cette session (`patch.custom non routé`), pas un choix
assumé. Le flex/centrage vertical lui-même reste hors-scope (futur module Flex dédié) — seul le
routage `custom` était à corriger.

Direction donnée par l'auteur : « custom est du même type de traitement que offset, bien plus
simple, mais identique de nature » — un champ structuré du décor, résolu en style au build via une
fonction dédiée (miroir exact de `resolveOffsetAsStyle`), converti 1:1 (même type des deux côtés,
`string`, pas de cast) côté bridge.

Implémenté :
- `Decor.custom?: string` (`app/commands/types.ts`).
- `decor-editor-bridge.ts` : `resolveCurrentPatch`/`patchToDecorArgs` lisent/écrivent `custom` au
  même endroit qu'`offset` ; le `console.warn` `.custom` retiré (celui pour `.capsule` reste, gap
  distinct et réel).
- `build-scene.ts::resolveCustomAsStyle` — parse les déclarations `propriété: valeur` séparées par
  `;`, une déclaration mal formée est ignorée (jamais levée — « CSS libre, responsabilité auteur »),
  fusionné dans `resolveDecorStyle` après `style`/`offset` (le custom l'emporte en cas de conflit).
  Un seul point d'insertion : `resolveDecorStyle` alimente déjà `common.style` ET le diff
  inter-keyframes, donc le CSS libre profite automatiquement de l'interpolation existante.

Tests ajoutés : diff/interpolation d'une propriété custom entre deux keyframes, fusion dans
`initial.style` du premier keyframe, déclaration mal formée ignorée (builder) ; round-trip
lecture/écriture via le textarea réel du panneau Custom, plus de warn (bridge). `tsc` propre, 1057
tests verts.
