# Ticket 1 — Corriger la trajectoire `overlay-world`

## Priorite

Haute.

## Statut

Implemente.

## Contexte

La demo `?demo=overlay-world-outlet` reproduit maintenant explicitement le bug sur le **cas 2** :

- cible en `list` ;
- changement simultane de `move` ;
- changement simultane de `className` ;
- passage `position: absolute` -> `position: relative`.

Le bug est donc reproductible sans passer par `quiz-hunt`.

## Probleme

Le move `overlay-world` n'anime pas correctement la transition dans cette configuration.

Le point final peut etre correct, mais l'animation intermediaire est absente ou incorrecte.

## Repro de reference

- Demo : `?demo=overlay-world-outlet`
- Cas : `Cas 2 : list`

## Hypothese actuelle

Le module calcule mal le cas ou le node change de contexte de positionnement pendant le move :

- source flottante absolue ;
- destination in-flow relative ;
- FLIP/overlay-world construit sur des photos monde incoherentes ou inexploitables.

## Invariants runtime retenus

Le correctif ne cible pas une demo particuliere. Les demos `overlay-world-outlet`, `quiz-hunt` et
`codplay-poc` ne sont que des revelateurs de classes de bug.

Pour tout `move` avec `flipMode: "overlay-world"` :

1. la photo de depart du perso deplace doit etre prise avant le changement effectif de parent/layout ;
2. la photo d'arrivee doit etre prise apres application du move et des mutations de l'action ;
3. pendant un replay de `seek`, un perso avec `initial.move` statique doit repartir de ce baseline statique,
   pas de son parent resolu a `targetMs`, sinon le `First` est mesure depuis la destination ;
4. pendant un replay de `seek`, l'overlay du perso deplace peut etre reconstruit, mais les FLIP locaux des
   voisins de liste ne doivent pas etre rejoues : l'etat DOM a `targetMs` est deja reconstruit, ces voisins
   ne doivent pas conserver d'etat anime transitoire (`x`/`y`) apres le seek.

Ce dernier point est un invariant de reconstruction, pas un ajustement pour `codplay-poc`.

## Perimetre

Corriger le module runtime pour que `overlay-world` anime correctement ce cas.

## Hors perimetre

- Support des cibles non-list.
- Refactoring global du module `move`.
- Changement du design des demos.

## Fichiers suspects

- `packages/codplay/src/runtime/modules/list-flip/create-list-flip-module.ts`

Zones particulierement suspectes :

- `computeOverlayWorldPhotosFromLocalFlip(...)`
- `createOverlayWorldPhotoClones(...)`
- `buildOverlayWorldTransitions(...)`

## Critere d'acceptation

Pour tout scenario `overlay-world` avec changement de parent/layout, le perso deplace doit :

1. partir exactement de la position visible source ;
2. animer une trajectoire continue ;
3. arriver exactement sur la cible visible ;
4. ne plus teleporter visuellement le node reel.

En replay de `seek`, les voisins non deplaces d'une liste source/cible ne doivent pas recevoir de transform
FLIP residuee.

## Validation

1. Verifier `?demo=overlay-world-outlet`, cas 2.
2. Reverifier `?demo=quiz-hunt` sur le jeton extra.
3. Verifier qu'aucune regression n'apparait sur les demos existantes utilisant `overlay-world` entre `list`.
4. Tests automatises : `tests/v1/overlay-world-seek-baseline.spec.ts`.
