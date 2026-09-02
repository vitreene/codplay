# Diagnostic V2 — reprise après seek dans `test position`

**Date : 2026-09-02**  
**Portée :** verticale éditeur position/taille V2 uniquement.

Cette note conserve la cause et la preuve du premier bug d’usage observé dans
la démo « Test position + couleur ». Elle ne crée pas une API publique et ne
change pas le contrat CodPlay V2.

## Symptôme

Après une lecture, un seek arrière dans `sequence-editor`, puis une reprise et
un second seek/reprise, la progression affichée continue tandis que les items
peuvent reprendre une pose déjà observée. Le comportement est particulièrement
visible lorsque la durée écoulée après la reprise est la même que celle de la
reprise précédente.

## Cause

Le `scene-player-bridge` V2 reconstruit une instance lorsqu'il entre dans
`playing`. Il conserve `authorTimeMs` et demande ensuite à la nouvelle
instance un seek à ce temps. Une instance fraîche expose toutefois un horizon
runtime découvert à `0 ms` tant qu'aucune frame n'a avancé. La façade de
pilotage bornait la demande auteur sur cet horizon (`getProgress().durationMs`)
au lieu de la durée connue de l'`EditorScene`.

La demande auteur non nulle était donc ramenée à `0 ms` sans échec de commande.
Le player avançait ensuite normalement depuis zéro ; le temps et la pose
observée n'étaient plus le même rendez-vous auteur, donnant l'impression d'un
item figé.

## Correction V2

- `buildSceneDocV2` fournit la durée auteur déjà validée ;
- `scene-player-bridge` la transmet avec chaque binding d'instance ;
- `EditorPlayerCommandFacade` borne les seeks auteur sur cette durée, puis
  ajoute le `preRollMs` pour appeler l'instance V2 ;
- l'horizon découvert du runtime reste une information de transport et ne
  décide pas de la validité d'un seek auteur.

Le pipeline reste unique : `playheadMs` auteur → `SEEK` → façade de pilotage →
`instance.telco.seek()` → `SEEK_APPLIED`, puis lecture V2 par le même chemin de
matérialisation/résolution/présentation.

## Preuves

- test de façade : un seek à `1250 ms` reste à `1250 ms` après remplacement
  par une instance fraîche dont l'horizon initial vaut zéro ;
- test d'intégration DOM V2 : Play → seek arrière → reprise → second seek →
  reprise, avec `1500 ms` puis `1250 ms` observés après les mêmes frames et une
  pose distincte ;
- suite éditeur : 30 fichiers, 342 tests passés ;
- typecheck `packages/editor` passé ;
- build `@codplay/editor` passé.

La matrice navigateur complète, notamment Safari, reste ouverte conformément au
plan actif.
