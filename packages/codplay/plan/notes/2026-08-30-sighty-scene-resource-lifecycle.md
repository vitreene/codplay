# Cycle de vie des ressources de scène pour Sighty

**Statut : note de contexte — Sighty n’est pas encore raccordé.**  
**Version visée : CodPlay V2.**  
**Portée : futur hôte Sighty ; cette note ne modifie pas le chantier éditeur.**

## Exigence

La fin temporelle d’une scène ne suffit pas à déclencher son nettoyage : une
scène peut atteindre sa dernière frame tout en restant montée pour être rejouée
ou réutilisée. En revanche, lorsqu’elle est effectivement démontée, Sighty doit
libérer les ressources qui appartiennent à cette occurrence de scène.

La priorité concerne la feuille CSS générée pour la scène. Elle est installée
dans un slot CSS propre à l’occurrence via le canal direct de preload ; le
démontage doit vider ce slot, notamment avec la primitive existante :

```ts
codplay.preload.css.clear(sceneCssSlot)
```

Le nettoyage doit intervenir avant ou pendant le teardown du host, afin que le
service ne conserve pas de slot ou de nœud de style devenu inaccessible. Il
doit être idempotent : un démontage répété ne doit ni lever d’erreur ni toucher
une autre scène.

## Ressources concernées

- **CSS de scène** : un slot stable et propre à chaque montage ; seul ce slot
  est vidé au démontage.
- **Médias et autres URLs preloadées** : libération des URLs détenues par cette
  scène avec le mécanisme de release du preload ; une ressource partagée reste
  en cache tant qu’un autre propriétaire l’utilise.
- **Ressources de l’instance et de sa materialization** : destruction par le
  cycle de vie de l’instance, sans seconde logique de nettoyage propre à
  Sighty.

Le chemin CSS reste donc distinct du chemin média : la CSS éphémère est gérée
par son slot immédiat, tandis que les médias suivent le cache et le comptage de
propriétaires du preload.

## Ce qui reste à fixer avec Sighty

Cette note ne crée pas encore d’API Sighty. Le contrat devra préciser :

- l’identité d’une occurrence de scène et la dérivation de son slot CSS ;
- les ressources URL effectivement possédées par cette occurrence ;
- l’ordre entre arrêt des mises à jour, nettoyage CSS, release média,
  destruction de l’instance et retrait du host ;
- le comportement en cas de démontage partiel ou d’échec pendant le teardown.

Le principe à conserver est néanmoins fixé : **pas de clear automatique à la
fin de lecture ; clear et release explicites lors du démontage effectif, limités
aux ressources appartenant à la scène démontée.**

