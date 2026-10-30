# CodPlay V2 — catalogue de presets `replace`

## Rôle

Le catalogue JSON porte les trajectoires numériques partagées par
`replace-text` et `replace-media`. Il décrit une durée par défaut, un easing
facultatif et les poses `intro`/`outro`. Il ne décrit ni un mécanisme de
découpage, ni une origine de propagation, ni une transition CSS du slot.

[`replace-preset-catalog.json`](../src/runtime/capabilities/replace-presets/replace-preset-catalog.json)
est la source canonique. Les types TypeScript des noms et définitions sont
dérivés de ce JSON. La table auteur secondaire associe un type d'effet et une
orientation à l'identifiant canonique exact ; elle ne contient pas de
trajectoire parallèle.

## Catalogue canonique

Le catalogue contient 54 identifiants :

| Type auteur | Orientations disponibles | Identifiants canoniques |
|---|---|---|
| `fade` | `default` | `fade` |
| `swipe` | `left`, `right`, `up`, `down` | `swipe-*` |
| `soft-swipe` | `left`, `right`, `up`, `down` | `swipe-soft-*` |
| `fly` | `left`, `right`, `up`, `down` | `fly-*` |
| `bounce` | `left`, `right`, `up`, `down` | `bounce-*` |
| `swipe-zoom` | `left`, `right`, `up`, `down` | `swipe-zoom-*` |
| `diagonal-swipe` | `left-top`, `right-top`, `left-bottom`, `right-bottom` | `swipe-*` diagonaux |
| `zoom` | `in`, `out`, `pop` | `zoom`, `zoom-out`, `zoom-pop` |
| `scale` | `in`, `out`, `bounce`, `elastic` | `scale-*` |
| `axis-scale` | `x`, `y` | `scale-x`, `scale-y` |
| `stretch` | `x`, `y` | `stretch-x`, `stretch-y` |
| `squash` | `x`, `y`, `stretch` | `squash-*` |
| `rotate` | `in`, `left`, `right` | `rotate-*` |
| `spin` | `left`, `right` | `spin-*` |
| `roll` | `left`, `right`, `top`, `bottom` | `roll-*` |
| `tilt` | `left`, `right` | `tilt-*` |
| `rotate-zoom` | `left`, `right` | `rotate-zoom-*` |
| `glyph-roll` | `up`, `down` | `slot-up`, `slot-down` |

La table exacte est exportée sous `REPLACE_PRESET_CHOICES`. `ReplacePresetName`
est dérivé des clés JSON ; `ReplacePresetType` et
`ReplacePresetOrientation<Type>` sont dérivés de la table secondaire. L'appel
`resolveReplacePresetChoice(type, orientation)` renvoie le nom canonique comme
littéral TypeScript. Un nom inconnu ou une orientation indisponible pour le type
choisi est une erreur de compilation ; aucun défaut implicite n'est utilisé.

`orientation` sert uniquement à sélectionner et à nommer le preset. Le champ
`direction` des commandes reste indépendant : il choisit l'ordre de propagation
sur les unités texte ou la grille média.

## Forme JSON et échantillonnage

Une entrée contient `durationMs`, `intro` et `outro`, avec `ease` facultatif.
Les poses portent des plages numériques `from`/`to` parmi `opacity`, `x`, `y`,
`scale`, `scaleX`, `scaleY` et `rotate`. Les métadonnées `slot` facultatives
définissent `axis`, `bounce` et `chroma` pour les deux presets `glyph-roll`.
Les trajectoires n'embarquent ni code du site source, ni animation CSS, ni
ordonnanceur.

`duration` dans la commande remplace `durationMs`, y compris lorsqu'il vaut
zéro. Les poses et l'easing sont préparés et résolus avec ACE, puis présentés
par la surface HTML du composant. Si `ease` est absent, le profil numérique
utilise l'easing ACE `out(2)`. Le temps d'échantillonnage reste celui de
`ComponentAnimation` et du ticker CodPlay, selon le propriétaire décrit dans
[la spécification de présentation](./replace-presentation-v2-spec.md).

Les options de commande restent définies par la capacité destinataire :

| Capacité | `split` | Autres options propres |
|---|---|---|
| `replace-text` | `letter`, `word`, `line` | `stagger`, `direction`, `skipUnchanged` pour `slot-up` et `slot-down` |
| `replace-media` sur `img` et vidéo | `cells` | `stagger`, `staggerPattern` (`manhattan`, `row-wave`, `column-wave`), `direction` avec Manhattan, `cellX`, `cellY`, `shape` pour `mask-reveal` |
| `replace-slot` | `cells` pour les profils CSS ; les anciens splits texte restent ignorés | Profils CSS `fade`, `fade-in`, `mask-reveal`, `curtain`, `wipe`, `slide-over`, `stack`, réglages de grille partagés |

Les profils slot gardent leur contrat existant ; les options numériques du JSON
ne les remplacent pas. Les règles de segmentation texte sont dans la
[spécification texte](./replace-text-v2-spec.md), et les frames fixes/cellules
dans la [spécification média](./replace-media-v2-spec.md).

## Validation et preuves

- La validation auteur refuse les noms non catalogués, les champs inconnus,
  les valeurs hors type, les découpages qui ne correspondent pas à la capacité,
  et les couples `shape`/transition invalides.
- [`replace-module.spec.ts`](../tests/runtime/capabilities/replace-module.spec.ts)
  vérifie les 54 noms contre la table auteur, leur normalisation texte/média,
  les plages et champs de toutes les entrées JSON et l'échantillonnage ACE à
  cinq progressions dans les deux directions. Il passe également les erreurs
  de configuration par la frontière `SceneBuilder`.
- [`replace-preset-authoring.typecheck.ts`](../tests/scene/authoring/replace-preset-authoring.typecheck.ts)
  compile une scène auteur `SceneDoc` utilisant un preset texte et un preset
  média via les exports publics. Ses cas `@ts-expect-error` vérifient les noms
  et couples inconnus.
- La démo [`replace-carousel`](../../demos/src/v2/demos/replace-carousel/main.ts)
  sélectionne ses exemples par le helper public et les joue dans le layout V2
  partagé. La revue visuelle des familles et paramètres a été menée sur cette
  démo ; l'utilisateur en a validé les transitions proposées.
