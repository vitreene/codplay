# Ticket 2 — Autoriser `overlay-world` vers une cible non-list

## Priorite

Moyenne, a traiter apres le ticket trajectoire.

## Statut

Implemente.

## Contexte

La demo `?demo=overlay-world-outlet` montre sur le **cas 1** qu'un move :

```ts
move: { parentId: '<outlet-id>', flipMode: 'overlay-world' }
```

ne produit aujourd'hui aucun deplacement anime quand la cible est un outlet classique et non une `list` runtime.

## Probleme

Le support `overlay-world` est actuellement couple a la presence d'une `targetList`.

Le module coupe avant de construire un plan FLIP si la cible n'est pas une `list`.

## Invariant runtime retenu

`overlay-world` est une animation en coordonnees monde du perso deplace. Elle ne doit donc pas dependre
structurellement d'une cible `list` quand le parent cible est deja un node runtime resolu par l'orchestrateur
(outlet de layout, node de composant, etc.).

Le module FLIP reste decouple du layout : il ne connait pas les outlets. Il demande seulement a son contexte
runtime si `parentId` correspond a une `list` ou a un node runtime mesureable. L'orchestrateur reste seul
responsable de la resolution des ids de layout/outlet vers des nodes.

## Repro de reference

- Demo : `?demo=overlay-world-outlet`
- Cas : `Cas 1 : outlet`

## Dependance

Ce ticket ne depend pas fonctionnellement du ticket trajectoire, mais il doit etre traite **apres** lui pour eviter d'elargir un comportement encore faux.

## Perimetre

Permettre un `overlay-world` correct quand la cible est un outlet/node DOM non-list.

## Hors perimetre

- Refonte complete de `move`.
- Changement du contrat auteur hors `overlay-world`.

## Fichiers suspects

- `packages/codplay/src/runtime/modules/move/index.ts`
- `packages/codplay/src/runtime/modules/list-flip/create-list-flip-module.ts`

Point bloquant actuel :

- `collectFlipEntriesForMove(...)` retourne immediatement si `targetList === null`.

Correction retenue :

- conserver le comportement FLIP local list-to-list existant ;
- autoriser uniquement le chemin `flipMode: "overlay-world"` quand `targetList === null` mais que
  `context.getNodeById(parentId)` resout un node runtime ;
- ne pas introduire de dependance du module `list-flip` vers les concepts de layout/outlet.

## Critere d'acceptation

Dans `?demo=overlay-world-outlet`, le **cas 1** doit :

1. produire un vrai deplacement anime ;
2. suivre une trajectoire continue ;
3. arriver exactement sur l'outlet cible ;
4. fonctionner sans wrapper `list` artificiel.

## Validation

1. Verifier `?demo=overlay-world-outlet`, cas 1.
2. Reverifier le cas 2 de la meme demo.
3. Reverifier `quiz-hunt` si on decide ensuite de supprimer le contournement par `list` pour le jeton extra.
4. Test automatise : `tests/v1/overlay-world-seek-baseline.spec.ts`, cas target runtime node non-list.
