# Defaut overlay-world : trajectoire incorrecte

## Resume

Le move `overlay-world` peut arriver au bon point final mais calculer une mauvaise trajectoire d'animation.

Cas observe :

- le jeton extra de `quiz-hunt` part visuellement vers le haut de l'ecran ;
- puis le vrai node apparait directement a la bonne destination sans transition coherente.

## Classement

Defaut module.

## Pourquoi ce n'est pas un probleme de demo

La demo ne fournit aucune trajectoire manuelle. Elle ne fait que :

- demander un `move` avec `flipMode: "overlay-world"` ;
- fournir une source et une destination valides.

Le calcul des positions animees est entierement produit par le module runtime.

## Zone suspecte

References :

- `packages/codplay/src/runtime/modules/list-flip/create-list-flip-module.ts`

Pipeline concerne :

1. `computeOverlayWorldPhotosFromLocalFlip(...)`
2. `createOverlayWorldPhotoClones(...)`
3. `buildOverlayWorldTransitions(...)`

Le point critique est la construction des photos monde `old` / `next` et leur calibration :

- `computeOverlayWorldPhotosFromLocalFlip(...):619-707`
- `createOverlayWorldPhotoClones(...):757-835`
- `buildOverlayWorldTransitions(...):359-425`

## Symptome exact

- la destination finale est correcte ;
- l'overlay anime ne suit pas la bonne trajectoire ;
- cela indique un mauvais calcul des coordonnees monde de l'overlay, pas un mauvais `parentId` final.

## Hypothese de cause

La photo monde de depart ou d'arrivee est mal transposee depuis l'etat FLIP local vers le repere viewport/fixed.

Les suspects principaux sont :

- la calibration `from` / `to` dans `captureWorldPhotoFromLocalFlipState(...)` ;
- la restauration du `style` inline autour de `computeOverlayWorldPhotosFromLocalFlip(...)` ;
- la conversion en clones `position: fixed` avec matrice appliquee.

## Attendu de correction

Quand `overlay-world` est demande :

- l'overlay clone doit partir exactement du rect source visible ;
- l'overlay clone doit arriver exactement sur le rect cible visible ;
- le vrai node ne doit pas sembler teleporter apres une fausse trajectoire.

## Validation visuelle

Deux demos doivent servir de verification :

1. `?demo=overlay-world-outlet`
   - repro minimale du besoin produit actuel ;
2. `?demo=quiz-hunt`
   - cas reel du jeton extra.

La correction est validee seulement si les deux cas ont :

- un depart correct ;
- une trajectoire coherente ;
- une arrivee correcte.
