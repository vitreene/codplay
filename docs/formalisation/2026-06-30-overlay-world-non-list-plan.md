# Overlay-World vers outlet non-list

## Contexte

Le besoin produit courant n'est pas un transfert entre deux `list`, mais un deplacement visuel d'un perso entre deux zones de layout classiques :

- une zone source dans le contenu principal ;
- une zone cible dans le footer ;
- avec animation `move` en `flipMode: "overlay-world"`.

Le cas concret actuel est le jeton extra de `quiz-hunt`, qui doit aller d'une epreuve vers une zone intermediaire situee entre panier et chrono.

## Constat code

Le support `overlay-world` est aujourd'hui adosse au module `list-flip`.

References :

- `packages/codplay/src/runtime/modules/move/index.ts`
- `packages/codplay/src/runtime/modules/list-flip/create-list-flip-module.ts`

Point bloquant structurel :

- `collectFlipEntriesForMove(...)` resolve `targetList = this.context.getListById(move.parentId)`.
- Si `targetList === null`, la fonction retourne `[]` immediatement.
- Donc aucun plan FLIP n'est construit pour un move vers un outlet DOM classique.

Ligne cle :

- `create-list-flip-module.ts:218-220`

```ts
const targetList = this.context.getListById(targetListId)
if (targetList === null) {
  return []
}
```

## Conclusion

Le non-support des moves `overlay-world` vers des outlets non-list est une limitation module, pas un probleme de demo.

## Objectif du chantier

Permettre :

- `move: { parentId: <outlet-id>, flipMode: "overlay-world" }`

quand `<outlet-id>` resolve un node DOM cible valide, pas seulement une `list` runtime.

## Perimetre minimal

1. Autoriser la collecte FLIP quand la cible est un outlet/node DOM.
2. Construire les snapshots `first/last` du perso deplace meme sans `targetList`.
3. Produire l'overlay-world transition sur ce cas.
4. Conserver le comportement existant sur les moves list->list.

## Hors perimetre

- Refonte generale de tous les moves.
- Changement de semantique de `move` hors `overlay-world`.
- Refonte CSS ou layout de `quiz-hunt`.

## Strategie proposee

1. Decoupler `overlay-world` de l'hypothese "cible = list".
2. Dans `prepareMove`, accepter deux familles de cibles :
   - `targetList !== null`
   - `targetNode !== null`
3. Construire une collection minimale d'entrees FLIP pour le cas `targetNode` :
   - le perso deplace au minimum ;
   - pas besoin de siblings de list si la cible n'est pas une list.
4. Laisser la construction overlay-world reutiliser les memes primitives de photos monde.

## Critere d'acceptation

La demo de repro dediee doit montrer une animation continue quand un perso passe :

- d'un outlet de la zone principale
- vers un outlet du footer
- avec `flipMode: "overlay-world"`

sans wrapper `list` artificiel.

## Demo de repro cible

- `?demo=overlay-world-outlet`

Cette demo doit rester minimale, deterministe, et servir de test visuel pour la correction.
