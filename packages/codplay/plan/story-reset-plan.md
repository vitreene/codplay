# Plan — reset événementiel d’une story

## Statut

> Status: En cours — implémentation autorisée le 2026-09-06
> CodPlay version: V2 foundation

Ce plan est séparé de
[`motion-live-discovery-invalidation-plan.md`](./motion-live-discovery-invalidation-plan.md).
Il ne modifie pas la correction motion en attente et ne transforme pas un
problème de démo en patch opportuniste.

Le plan adopte le patron de démos préconstruites par duplication d’instances :
le carousel présente une instance de démo à la fois, mais CodPlay ne reçoit
pas un cycle de vie `active/inactive` de story. Sighty reste le niveau chargé
de l’orchestration de présentation. Un guard `active/inactive` n’est pas
introduit dans ce plan, afin de ne pas filtrer involontairement des événements.

## Objectif

Ajouter une opération story-scoped `story.reset()` qui :

- ajoute un événement au journal courant à l’horloge courante ;
- projette l’état initial de la story à partir de cette frontière ;
- conserve tous les faits antérieurs dans le journal ;
- laisse l’horloge, la lecture et les autres stories inchangées ;
- retire les présentations motion temporaires de la story réinitialisée ;
- conserve les nœuds auteur montés.

## Hors périmètre

- effacer ou réécrire la timeline ;
- réinitialiser l’horloge ou appeler `telco.rewind()` ;
- modifier la sémantique de `tween:stop` ;
- ajouter une détection DOM de visibilité ou de parentage ;
- déplacer l’overlay vers la scène générale ou vers le layout ;
- faire un remount de la démo pour simuler le résultat ;
- réinitialiser implicitement une autre story ou l’état de scène.

## Décisions retenues pour l’implémentation

1. **Interception et capacité de scène.** Fixer l’eventime dont le contenu
   sans cible déclenche la capacité `story.reset()`, puis respecter le circuit
   `listen` de story et l’évaluation des actions de persos. `story.reset()` est
   une notation de capacité, pas une méthode de façade. La portée vient de
   l’intercepteur concerné, jamais d’un champ `target` ajouté à l’eventime.
   L’adresse séparée éventuellement fournie par l’API d’injection ne fait pas
   partie de cette capacité. La capacité est déclarée sur la règle `listen` de
   la story par `reset: true`; elle reste donc attachée à l’interception et
   peut être associée à n’importe quel nom d’événement.
2. **Événement.** Définir le record de reset, son identifiant interne, sa
   visibilité de trace et son ordre avec les événements compilés ou runtime au
   même temps, sans introduire de ciblage dans l’eventime.
3. **Frontière de projection.** Définir précisément les faits ignorés après
   `R`, les événements de scène propagés à la story et les mises à jour d’état
   concernées. La règle de base est : état initial compilé de la story qui a
   intercepté l’événement, puis application des faits postérieurs à `R`.
4. **Captures temporaires.** Décider comment sont clôturées ou invalidées les
   captures ouvertes et les émissions différées appartenant à la story.
5. **Discontinuité motion.** Un reset ne produit aucune animation
   entre l’ancienne pose et l’état initial ; l’overlay de la story est retiré
   puis le nouvel état est présenté immédiatement.

Ces décisions autorisent l’implémentation dans `packages/codplay/src`. Elles ne
créent ni méthode de façade, ni cycle de vie de story, ni nouveau circuit
événementiel.

## Mise en œuvre ordonnée

### 1. Journal et événement de reset

- enregistrer le résultat de l’interception avec la portée de story, le temps
  courant et l’ordre journalisé ;
- l’inscrire dans l’unique `RuntimeTrackJournal` sans supprimer de faits ;
- faire remonter sa révision par le même mécanisme que les autres append ;
- produire les diagnostics et la trace convenus ;
- couvrir émission immédiate, répétition et événement au même temps.

### 2. Reconstruction de la story

- trouver la dernière frontière de reset applicable à la story pour un temps
  donné ;
- reconstruire la story depuis son état/persos initiaux à cette frontière ;
- appliquer ensuite les événements et mises à jour autorisés, dans l’ordre
  existant ;
- ne pas supprimer ni invalider les événements futurs ; ils continuent d’être
  reçus par le circuit normal d’interception ;
- préserver la reconstruction antérieure lorsqu’un seek se place avant la
  frontière ;
- conserver l’état de scène et les autres stories selon le contrat validé ;
- ne pas introduire de second journal ou de branche de timeline.

### 3. Présentation HTML et motion

- transmettre au runner la portée sémantique du reset après l’interception et
  la reconstruction ;
- invalider le graphe et les frontières motion dépendant de cette story ;
- supprimer les ressources overlay et styles temporaires de cette story dans
  leur conteneur local actuel ;
- laisser les éléments auteur montés et restaurer leur présentation naturelle ;
- présenter l’état initial sans transition ;
- vérifier qu’un `move` ajouté après le reset suit le chemin normal de
  découverte/capture.

Le reset ne déplace pas la couche overlay. Elle reste attachée au conteneur
local de mouvement qui la possède ; l’invalidation retire cette ressource
temporaire à cet endroit. Aucun parentage de la scène générale n’est introduit.

### 4. Capacité de scène et circuit événementiel

- compiler et exécuter `listen.reset: true` uniquement lorsqu’il s’agit d’une
  règle de story sélectionnée par l’événement ;
- laisser les règles `listen` des stories sélectionner l’événement par nom,
  puis laisser les actions des persos l’évaluer sans lui ajouter de cible ;
- l’ancrer sur le temps logique courant sans appeler la télécommande ;
- conserver l’état `playing` ou `paused` et le facteur de vitesse ;
- produire un diagnostic explicite lorsqu’aucun intercepteur de story valide
  n’est disponible ou lorsque le player est inactif ;
- documenter que `story.reset()` est une capacité projetée par événement, pas
  une méthode de façade ni une commande de transport.

La capacité ne doit pas introduire d’état `active/inactive` ou de cycle de vie
CodPlay pour les stories. L’isolation recherchée vient de l’instance
préconstruite de chaque démo et de son journal propre. Le masquage de la démo
sortante ne doit pas filtrer ses événements.

### 5. Validation CodPlay

Ajouter les tests au niveau des frontières réelles :

- journal : le reset augmente la révision et ne supprime aucun événement ;
- projection : état initial après reset, événements postérieurs appliqués,
  événements antérieurs conservés pour un seek avant reset ;
- ordre : plusieurs resets et événements au même temps ;
- isolation : autre story et état de scène inchangés ;
- événements futurs : ils restent dans le journal et suivent le circuit normal
  d’interception malgré le masquage de la démo sortante ;
- player : l’horloge, le play/pause et la vitesse ne changent pas ;
- motion : overlay retiré, graphe rebasé, aucun tween entre ancienne et
  nouvelle pose, éléments auteur toujours montés ;
- replay, seek, persistence et resize après un reset.

La validation navigateur doit exécuter le reset pendant le `move` de la démo,
puis vérifier le DOM présenté et la trace runtime dans Safari. Un test isolé
de materialization ne suffira pas à valider cette intégration.

## État de l’implémentation — 2026-09-06

Le cœur CodPlay V2 est implémenté :

- `listen.reset: true` est compilé et conservé par le codec ;
- `RuntimeTrackJournal` conserve les frontières ordonnées sans supprimer les
  faits antérieurs ;
- la reconstruction applique l’état initial de la story puis les faits
  postérieurs à sa dernière frontière ;
- `RuntimePlayer.emit()` et `RuntimePlayer.emitEventime()` transmettent la
  frontière à la présentation courante ;
- le runner HTML invalide le graphe et les ressources motion de la story
  concernée, sans remount ni modification de l’horloge.

La navigation du carousel `position` est maintenant raccordée :

- chaque story `position-story-one` à `position-story-six` écoute son événement
  reset de sortie avec `listen: [{ on, reset: true }]` ;
- le strap de navigation diffuse cet événement reset avant l’outro de la vue,
  puis diffuse l’outro et l’intro ;
- les événements reset de sortie sont des événements de portée `scene`, sans
  `storyId`, et sont isolés par leur nom ; `main` ne déclare aucune règle reset ;
- l’outro reste séparé du reset afin de conserver le masquage horizontal de la
  vue sortante.

Le runtime reconnaît cette forme diffusée : un événement de portée `scene` sans
`storyId` est comparé aux règles `listen.reset` de chaque story, et seule la
story dont le nom d’événement correspond reçoit une frontière.

Le bouton de reload de la télécommande reste inchangé et hors de cette feature.
La validation Safari Technology Preview du reset dans le carousel reste à
faire sur le chemin navigateur complet. Le plan reste donc `En cours`.

### Validation de la tranche — 2026-09-06

- `position-demo.spec.ts` : **6 tests passants** ; les assertions vérifient le
  carousel manuel, les six resets de sortie, l’overlay local et la
  reconstruction après seek ;
- suite ciblée runtime/facade/scene : **8 fichiers, 134 tests passants** ;
- suite complète du package CodPlay : **89 fichiers, 565 tests passants** ;
- build `@codplay/demos` : passant ;
- audit de la source V2 `position` et de ses assertions : aucune occurrence de
  `cascade`, aucune trace de debug et aucun ancien symbole `viewFiveMove` ; les
  événements de la démo portent la visibilité V2 nommée `scene` ;
- `git diff --check` : passant ;
- typecheck CodPlay : encore bloqué par les imports V1 absents de
  `packages/authoring/scene-factory` ; le typecheck des démos remonte en plus
  des erreurs déjà présentes dans `packages/codplay-v1` et `packages/demos/src/v1` ;
- Safari Technology Preview : la page V2 charge, le bouton `Lire` puis
  `ArrowRight` font passer le carousel à `02 / 06`, sans erreur console ni
  requête HTTP en échec ; l’exercice détaillé du reset dans le journal
  navigateur reste à faire, donc le plan reste `En cours`.

### 6. Application au carousel de la démo `position`

- avant l’action utilisateur `précédent`, `suivant` ou `Entrée`, identifier
  l’instance de démo actuellement présentée ;
- diffuser l’eventime de navigation sans cible dans son contenu ; les règles
  `listen` et les actions de la démo courante déclenchent la capacité
  `story.reset()` ;
- seulement après le reset, exécuter la sortie de la story courante et l’entrée
  de la story suivante ou précédente ;
- ne pas déclencher ce reset avec Espace, qui reste réservé au comportement de
  lecture de la story courante ;
- vérifier le reset depuis chacune des instances de démo, notamment pendant un
  reparenting ;
- vérifier que chaque instance est préconstruite et que `play(t)` et `seek(t)`
  produisent le même état dans cette instance ;
- conserver le bouton « Recharger la scène » de la telco et son circuit actuel
  sans le raccorder à la capacité `story.reset()` ;
- ne pas rediriger cet événement vers une story globale `main` : la portée est
  déterminée par l’interception dans l’instance de démo courante.

## Critères de sortie

Le plan ne pourra passer à `Fini` qu’après :

- spécification du contrat story reset mise à jour ;
- tests runtime, circuit événementiel, motion et navigateur passants ;
- application dans la navigation de la démo par événement, sans remount ni
  rewind ; le reload de scène de la telco reste hors de cette feature ;
- démos isolées par instance préconstruite, avec égalité vérifiée entre
  `play(t)` et `seek(t)` pour chaque instance ;
- mesure Safari avant/après reset ajoutée au relevé de scène ;
- absence de régression Play, Seek, replay, persistence, resize et lifecycle.
