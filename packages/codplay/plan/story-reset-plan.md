# Plan — reset événementiel chaud d’une story

## Statut

> Status: A relire — coordination du reset avec la migration motion déclenchée
> par occurrence.
> CodPlay version: V2 foundation
> Référence d’exécution :
> [`motion-live-discovery-invalidation-plan.md`](./motion-live-discovery-invalidation-plan.md)

Le reset logique déjà établi conserve son journal et reconstruit l’état de story
à partir de son initial compilé. Ce plan précise la conséquence attendue pour la
présentation motion. Il ne crée ni cycle de vie de story, ni règle fondée sur une
visibilité de démo.

## Objectif

Un événement intercepté par une story avec `listen.reset: true` produit un reset
à l’horloge courante qui :

- ajoute un fait ordonné dans l’unique `RuntimeTrackJournal` ;
- restaure les valeurs initiales compilées de cette story, puis applique les
  faits postérieurs à sa frontière ;
- conserve les faits antérieurs pour un Seek vers un instant précédent ;
- préserve l’horloge, la lecture, les autres stories et l’instance existante ;
- retire les ressources de présentation motion devenues invalides ;
- ne remonte ni ne recrée les nœuds auteur, composants, services, player ou
  runner.

## Hors périmètre

- effacer, réécrire ou compacter la timeline logique ;
- réinitialiser l’horloge ou appeler une commande de transport ;
- modifier les règles de placement, `tween:stop` ou la sémantique de `move` ;
- déduire un reset depuis le DOM ou une propriété visuelle ;
- ajouter une API de story visible, active ou inactive ;
- créer un parcours particulier à une démo.

## Contrat logique conservé

### Événement et portée

`listen.reset: true` appartient à la règle d’interception de la story. Le reset
est donc produit par le circuit normal `listen -> transform -> straps -> emit ->
persos`, avec la portée de la story qui a intercepté l’événement. Il ne demande
ni champ `target` ajouté à l’eventime, ni méthode de façade spéciale.

Le record de reset porte son temps, son ordre et son identité de fait comme tout
autre append. Il augmente la révision du journal mais ne supprime aucun fait.
Les événements reçus ensuite continuent de passer par l’interception normale.

### Reconstruction chaude

Pour une story et un temps donnés, le player trouve la dernière frontière de
reset applicable, repart de l’état compilé de cette story, puis applique les
faits autorisés après cette frontière dans leur ordre. Un Seek avant la frontière
reconstruit les faits antérieurs comme auparavant.

Cette reconstruction applique les valeurs dans les mêmes materialisations. Un
Seek ne devient jamais une source de création d’instances ou de composants.

## Contrat de présentation motion cible

### Retrait réel des groupes capturés

Le reset ne génère ni transition de l’ancienne pose vers la pose initiale, ni
capture géométrique. Le runner présente l’état initial restauré immédiatement.

Les groupes motion sont indexés par leur identité et l’ensemble des stories
qu’ils touchent. À un reset de story, le runner :

1. libère les ressources locales et overlay de chaque groupe qui touche cette
   story ;
2. retire ces groupes, leurs frontières et leurs données géométriques du graphe
   de présentation ;
3. conserve les groupes des stories non touchées ;
4. retire entièrement un groupe inter-story si l’une de ses stories est
   réinitialisée.

Cette règle remplace le masquage de segments avec `resetTimesByItem`. Une
barrière temporelle qui conserve géométrie et dépendances est incompatible avec
le reset chaud visé : le graphe doit réellement oublier les poses invalidées.

### Seek et reset

Le journal reste la seule histoire logique. Après un reset, un Seek vers le passé
réutilise la même instance, rétablit l’état logique correspondant et prépare un
groupe `move` uniquement lorsqu’il doit le présenter. Il ne récupère pas un
graphe précédemment supprimé seulement parce qu’il a été capturé avant le reset.

Le reset lui-même ne produit pas une occurrence `move`, ne déclenche aucune
découverte de journal et ne demande aucune mesure DOM.

### Ordre avec une transaction motion

Si un reset atteint une story pendant la préparation d’un groupe motion, le
reset est ordonné par le même circuit d’instance. Le groupe en préparation ne
peut pas être committé après le reset s’il touche cette story : sa transaction
est annulée, ses ressources provisoires sont libérées et l’état initial est
présenté. Les autres instances conservent leur propre ordre et leur progression.

## Mise en œuvre ordonnée

### 1. Conserver le journal et la reconstruction existants

- Vérifier que le record de reset reste dans `RuntimeTrackJournal` avec son ordre
  aux temps identiques.
- Vérifier la projection depuis l’état initial suivi des faits postérieurs.
- Conserver l’isolation des autres stories et l’absence de remount.

**Gate :** reset, replay et Seek avant/après la frontière donnent les états
logiques attendus sans deuxième journal.

### 2. Introduire le retrait par groupe dans le système motion

- Faire porter à chaque groupe capturé ses stories touchées et ses ressources de
  présentation.
- Ajouter l’opération interne qui retire un groupe et restaure ses ressources
  auteur sans écrire une animation de sortie.
- Remplacer l’application séparée de barrières de reset et de frontières par un
  commit unique de graphe.

**Gate :** aucune géométrie d’un groupe supprimé ne reste accessible au graphe
ou au host HTML.

### 3. Raccorder le reset au runner transactionnel

- Transmettre la portée sémantique du reset après la reconstruction réelle.
- Annuler ou sérialiser toute préparation de groupe qui touche la story.
- Ne lancer aucune préparation motion en réponse au reset seul.

**Gate :** un reset pendant un reparent ne laisse ni ghost, ni masque, ni segment
résiduel.

### 4. Adapter Seek et resize

- Faire reconstruire un groupe passé seulement lorsqu’il est nécessaire à la
  frame visée par Seek.
- Marquer les poses invalides après resize sans recapture anticipée.
- Préserver la destruction finale des ressources temporaires.

**Gate :** Seek ne recrée pas d’instance et resize ne redémarre pas une découverte
globale de moves.

## Validation requise

- reset seul : journal conservé, état initial présenté, aucune mesure ni capture
  motion ;
- plusieurs resets et événements au même temps ;
- isolation entre stories et conservation de l’horloge, play/pause et vitesse ;
- reset avant, pendant et après un move local ou reparent ;
- groupe reparent inter-story retiré lorsqu’une story concernée est réinitialisée ;
- Seek avant et après reset, à froid puis après un groupe capturé ;
- replay, persistence, resize, lifecycle et destruction ;
- vérification navigateur réelle, y compris Safari, sans remount ni ressources
  overlay résiduelles.

## Critère de sortie

Ce plan ne passe à `Fini` qu’après la mise à jour de la spécification du reset,
les tests des frontières player/runner, les parcours navigateur réels et la
validation complète de la migration motion correspondante. Les résultats des
anciennes suites qui reposent sur des barrières de reset ne valident pas ce
nouveau contrat de présentation.
