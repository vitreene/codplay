# Analyse de reprise - seek, master et horizons

## Point de reprise

Le modele cible se base sur une separation nette entre:

- ce qui a deja ete effectivement lu
- ce qui est garanti par des tracks `master`
- ce qui est connu en mode auteur
- ce qui n'est qu'une borne de progress ou de segment

## Contrat seek

- `seek` relit uniquement les events deja materialises dans les tracks.
- `seek` ne rejoue pas les straps.
- `seek` ne rejoue pas les `effects`.
- `sequence:end` n'est pas execute en seek; il borne seulement la projection.

## Horizons

- `playedEndMs`
- `projectedMasterEndMs`
- `authorEndMs`
- `progressEndMs`
- `seekEndMs`

## Role du master

- une track non master peut nourrir `playedEndMs` si ses events ont deja ete lus.
- une track non master ne doit pas etendre `projectedMasterEndMs`.
- une track `master` peut faire avancer la projection future autorisee.

## Notes

- le mode segment est utile en mode auteur pour borner une fenetre d'edition.
- les details normatifs sont portes par `formalisation/v1-seek-spec.md` et `formalisation/v1-horizon-spec.md`.
