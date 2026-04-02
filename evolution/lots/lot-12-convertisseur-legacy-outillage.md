# Lot 12 - convertisseur legacy outillage

## Objectif

Ajouter un convertisseur externe deterministe du format legacy (`persos` + `eventtimes`) vers un `SceneDoc` V1 serialisable, sans introduire de logique legacy dans le runtime principal.

## Fonctions noyau

- `convertLegacyToV1(input)`
  - normalise `Map | Record`
  - convertit les persos legacy en items V1
  - convertit/ordonne/dedup les events legacy
  - fabrique `story-main`, `track-story-main` et `scenario` minimal
  - produit un rapport `warnings + stats`

## Contrat runtime

- id canonique item: `initial.id` prioritaire, sinon cle legacy
- mapping de type legacy (`LIST/IMG/TEXT/...`) vers types V1 connus
- marker action legacy `true` -> `{}` (conservation de la cle action)
- event matching conserve (`event.name` copie a l'identique)
- events tries `ms` ascendant + index global monotone
- dedupe `(ms,name)` obligatoire, warning par doublon supprime
- parent manquant (`initial.move`) -> creation d'un `list` synthetique
- `children[]` derives des attaches initiales pour les items `list`
- metadata media legacy preservee en `item.media.legacy`
- scenario minimal garanti (`node-main` -> `story-main`)

## Scenarios de test (DoD)

- `L12-T1` determinisme du resultat JSON
- `L12-T2` ordre et index events conformes
- `L12-T3` dedupe events + warnings
- `L12-T4` creation parent synthetique
- `L12-T5` preservation de `move: { mode: 'auto' }`
- `L12-T6` story/scenario minimaux toujours generes

## Critere de passage

- 6 tests verts (`tests/lot12`)
- non-regression lots 1 a 11
