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
      mémoire ;
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

La correction de dérive des médias non master reste une décision distincte à
prendre après cette acceptation : mesurer d'abord les écarts réels et décider
si une correction est requise, avec des garde-fous autour du lancement, de la
pause et du seek. Elle ne s'applique pas au master et n'est pas une règle
certifiée.

## Fermeture

Ce plan reste `En cours` jusqu'à fermeture des preuves de service, validation
Safari du handoff média et décision de livrer ou d'abandonner la façade `run()`.
Les suites liées aux spécifications couvrent seulement leur périmètre certifié ;
elles ne ferment pas les gates listées ici.
