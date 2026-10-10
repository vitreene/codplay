# Acceptation restante — média et preload V2

> Status: En cours — les contrats vérifiés du service preload et de la
> synchronisation média sont dans leurs spécifications ; les gates ci-dessous
> restent ouvertes.
> CodPlay version: V2 foundation

- Service de ressources : [spécification preload](../specs/preload-v2-spec.md).
- Lecture et synchronisation natives : [spécification media-sync](../specs/media-sync-v2-spec.md).

Ce plan garde les décisions acceptées mais non appliquées, les points à
trancher et leurs critères d'acceptation. Il ne recopie pas les contrats déjà
vérifiés.

## Décision acquise, implémentation ouverte

Une future façade `run()` de diffusion autonome enchaîne le chargement explicite
des ressources, l'initialisation synchrone du player, puis `play()` :

```text
preload.load(manifest) -> player.init() -> player.play()
```

Elle ne rend pas le preload implicite dans `init()` et ne modifie pas la
surface du service `RuntimePreload`. La façade `run()` n'est pas encore exposée
par `CodPlay`.

## Décision acceptée, application non planifiée — source média en direct

Une source déclarée comme direct reste au temps réel (`now`) ; un Seek ne la
rembobine pas. Le `rate` logique est ignoré pour son contenu, et pause/reprise
ne figent pas puis ne rattrapent pas la source : la reprise retrouve l'instant
courant. Le mode doit être déclaré par l'auteur, car l'adresse d'une source ne
permet pas de distinguer sûrement un direct d'un média enregistré.

La déclaration auteur, l'interaction avec le rôle de master, les effets visibles
de pause et de masquage, ainsi que la propriété et la libération de la source
restent à définir. Aucune API `live` n'est adoptée. Avant implémentation, arrêter
ces choix puis valider le média, son hôte et le module de synchronisation sur
Seek, rate, pause/reprise, reset, teardown et navigateur réel. Le comportement
actuel de média enregistré reste celui de la
[spécification media-sync](../specs/media-sync-v2-spec.md).

## Preuves de service à compléter

La spec preload est limitée aux comportements déjà couverts. Les surfaces
suivantes existent dans le code ou les types, mais aucune preuve ciblée n'a été
trouvée pendant cette revue :

- [ ] état et compteurs d'une opération, résultat `skipped` sur cache déjà
      prêt, timeout par ressource et valeur par défaut ;
- [ ] `cancel()` pendant un chargement partagé, sans interrompre le propriétaire
      restant, et annulation par `CodPlay.destroy()` ;
- [ ] nettoyage par destruction des handles média non adoptés ou déjà
      transférés ;
- [ ] chemin public `registerStrategy()` et stratégies natives `audio`, `font`
      et CSS par URL ; le test CSS existant porte seulement sur le slot CSS en
      mémoire. Le CSS du paquet de diffusion dépend aussi du
      [plan de scène compilée](./compiled-scene-plan.md) ;
- [ ] seek et teardown après adoption d'une node préchargée, sans relancer son
      chargement.

## Acceptance navigateur restante

- [ ] Dans Safari, confirmer qu'une vidéo préchargée garde sa première frame
      visible avant `play()` lorsqu'elle est adoptée par le composant `media`.
- [ ] Vérifier le parcours réel lecture, pause, seek puis reprise après
      l'adoption du nœud préchargé, sans réassignation de `src`, appel à
      `load()` ni lecture native redondante à la matérialisation.
- [ ] Mettre à jour la spécification media-sync uniquement si le parcours
      navigateur confirme un comportement supplémentaire.

### Observation Safari — 2026-10-09

Une nouvelle navigation de Quiz Hunt Sighty a échoué avant le montage initial.
Un appel direct au service `createRuntimePreload()` avec la stratégie native
`video`, l'URL Nostromo et le mode `author` a renvoyé
`RUNTIME_PRELOAD_RESOURCES_UNAVAILABLE`, détail : `Preload timeout after
10000ms`. Sur la même origine, l'URL répond `200` avec `video/mp4` et une
requête Range répond `206`. Une sonde native `<video>` est restée à
`readyState=0`, `networkState=3`, `currentSrc` vide, sans événement `canplay`
ou `error` pendant 12 s. Deux nouvelles navigations ont reproduit l'échec sur
`127.0.0.1` et `localhost`; un onglet antérieur garde un nœud préchargé à
`readyState=4`.

Cette preuve établit une divergence entre le handoff déjà observé sur un
parcours préparé et une nouvelle initialisation Safari ; elle ne révèle pas
encore la cause ni ne certifie un cache froid. Garder l'acceptation navigateur
ouverte et déterminer pourquoi la sélection native de la ressource ne démarre
pas. Ne pas contourner le résultat avec un mode `broadcast`, un preload HTML ou
un changement local à la démo. Toute correction du cœur exige une décision
acceptée dans ce plan et une autorisation explicite de l'utilisateur.

La correction de dérive des médias non master reste une décision distincte à
prendre après cette acceptation : mesurer d'abord les écarts réels et décider
si une correction est requise, avec des garde-fous autour du lancement, de la
pause et du seek. Elle ne s'applique pas au master et n'est pas une règle
certifiée.

## Fermeture

Ce plan reste `En cours` jusqu'à fermeture des preuves de service, validation
Safari du handoff média pour les usages CodPlay qui conservent le composant
`media`, et décision de livrer ou d'abandonner la façade `run()`. Le parcours
Quiz Hunt Nostromo en `tag` vidéo est suivi par son plan de démo.
Les suites liées aux spécifications couvrent seulement leur périmètre certifié ;
elles ne ferment pas les gates listées ici.
