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

## Hors perimetre

- execution asynchrone et sequentielle des straps;
- materialisation automatique des emissions dans le journal;
- listen scene/story complet et cascade globale;
- effects non rejouables;
- composants et renderer.

La verticale de validation et la demo restent independantes de cette tranche tant
que son integration runtime n'est pas ouverte.
