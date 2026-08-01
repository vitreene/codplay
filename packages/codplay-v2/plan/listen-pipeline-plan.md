# CodPlay V2 - tranche listen, transform et emit

## Statut

> Status: En cours
> CodPlay version: V2 foundation
> Review: required before async straps

## Frontiere

Cette tranche traite un event runtime sans lire le DOM et sans modifier le journal
des tracks. Elle produit des sorties d'events et signale les straps a executer dans
la tranche asynchrone suivante.

```text
Runtime event
    -> exact listen filter
    -> transform references
    -> declared emit
    -> emitted events + pending straps
```

## Invariants

- `listen.on` est compare par nom exact;
- une liste de regles non vide filtre les events sans correspondance;
- une story sans regle transmet l'event sans transformation;
- les transforms s'executent dans l'ordre de declaration;
- une transform retourne une data ou `undefined`, sans modifier le nom de l'event;
- `emit` peut produire plusieurs events dans l'ordre de declaration;
- les fonctions sont resolues depuis la collection extraite du build;
- les erreurs de fonction sont retournees comme issues et ne font pas tomber le pipeline;
- les straps sont annonces mais pas executes par cette tranche.

## Limite du contrat live

Le contrat `live` a evolue pour rester compatible avec `f(t)`. Il ne doit pas etre
porte depuis la spec V1 ni etre implemente comme une suite d'emissions liees au
rythme des frames. Les compteurs temporels relevent d'un behavior/tween evaluable;
les compteurs d'occurrences relevent d'un etat mis a jour par events.

La tranche actuelle ne definit donc ni `context.live`, ni `onUpdate`, ni helper live.
La forme future devra etre specifiee en V2 avant toute implementation.

## Hors perimetre

- materialisation automatique des sorties de straps dans le journal;
- helpers `live` et emissions liees aux frames;
- materialisation automatique des emissions dans le journal;
- listen scene/story complet et cascade globale;
- effects non rejouables;
- composants et renderer.

La demo temporaire consomme maintenant cette tranche sur un flux de validation
local. Cette orchestration reste un banc visible et ne constitue pas encore le
pipeline runtime general des composants.
