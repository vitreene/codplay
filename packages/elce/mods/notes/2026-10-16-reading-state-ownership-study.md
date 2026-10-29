# État de lecture — responsabilité de Sighty et rôle du conteneur

Date : 16 octobre 2026.

Note d’étude sur la définition, la gestion et l’enregistrement de l’état
de lecture. Les orientations ci-dessous ne sont pas encore implémentées.
Cette note ne décide ni renommage, ni API, ni modification de code.

## Un état de lecture, deux contextes d’usage

L’utilisateur précise qu’il n’existe pas de situation métier « test » :
le lecteur s’exécute dans un contexte **auteur** ou **diffusion**. La collecte
du profil, la progression, les réponses et les tentatives d’Évaluation sont
des données de lecture. Leur nature ne dépend pas du contexte d’usage.

Les noms actuels `ProjectTestState`, `onTestStateChange` et
`ProjectTestStateSession` reflètent le contexte auteur dans lequel leur
persistance a été construite. Ils ne correspondent pas à un second circuit
de lecture, distinct d’un circuit général déjà existant.

Certaines possibilités sont propres au contexte auteur, notamment ignorer
les contraintes ou modifier le document puis réconcilier la progression.
Ces possibilités doivent être distinguées de l’état commun qu’elles
affectent ; elles ne justifient pas de qualifier toute la lecture de test.
Le vocabulaire futur reste à choisir après clarification des responsabilités.

## Circuit actuellement observé

Les spécifications de
l’[état enregistré](../../specs/summary-profile-spec.md#état-test-auteur-et-serveur),
de l’[Évaluation](../../specs/evaluation-machine-spec.md) et de la
[preview](../../specs/player-preview-spec.md) décrivent le comportement actuel.
Les fichiers suivants précisent sa répartition concrète :

| Point | Rôle actuel |
| --- | --- |
| [test-state-types.ts](../../src/domain/summary-profile/test-state-types.ts) | Valeur sérialisable : version, activation/validation du profil, valeurs, pages terminées, réponses et états d’Évaluation. |
| [scenario-builder.ts](../../src/builders/scenario/scenario-builder.ts) | Les actions Sighty actualisent le contexte, appliquent les transitions métier et notifient `onTestStateChange`. |
| [player-composition-types.ts](../../src/player/player-composition-types.ts) | La composition reçoit une valeur initiale et le callback exposé au conteneur. |
| [popup-player.tsx](../../src/app/player/popup-player.tsx) | Ouvre la session de persistance, reçoit les états, déclenche leur sauvegarde et gère le résultat. Ses commandes de reset modifient aussi directement l’instantané avant sauvegarde/reconstruction. |
| [project-test-state-session.ts](../../src/app/player/project-test-state-session.ts) | Charge la valeur serveur, sérialise les écritures et traite les révisions et conflits. |

La popup ne se limite donc pas aujourd’hui à présenter le lecteur. La
gestion métier est partagée entre actions du scénario et conteneur : les
réponses et fins de page passent par Sighty, tandis que des remises à zéro
et opérations de persistance sont conduites depuis la popup.

La soumission du profil appelle actuellement le callback puis dépend du
conteneur pour reconstruire la projection. Plusieurs autres actions
notifient sans attendre la sauvegarde. Ces raccords doivent être examinés
ensemble ; déplacer seulement un appel d’écriture ne règle pas leur cycle.

## Responsabilité demandée

L’utilisateur demande que **la gestion de l’état de lecture, sa restauration,
son enregistrement et sa transmission soient pilotés au niveau de Sighty,
sans délégation à la popup**.

Dans cette approche, les actions du scénario conduisent les opérations et
appellent les modules nécessaires. Le modèle métier conserve ses calculs,
comme `EvaluationMachine`, qui retourne un état sérialisable sans stockage.
Le module de persistance réalise ses échanges techniques et retourne leur
résultat au circuit piloté par Sighty. Cela n’impose pas de placer un pilote
de base de données dans le cœur générique du moteur.

La popup peut monter le lecteur, afficher des contrôles et présenter des
informations. Un contrôle qui modifie la lecture doit demander une opération
au scénario ; il ne fabrique pas lui-même un nouvel état à enregistrer.
Elle n’a pas à posséder la session métier de persistance ni à reconstruire
sa logique dans des callbacks de sauvegarde.

La différence auteur/diffusion détermine les possibilités et la configuration
du contexte d’exécution. Elle ne crée pas deux propriétaires des mêmes
données. Ce contexte d’usage est à distinguer du `context` Sighty, qui
contient l’état métier courant.

## Appui et limites des contrats existants

La [spécification Sighty](../../../sighty/specs/authoring-library-spec.md)
autorise déjà les fonctions dans `scenario.actions`, enregistrées ou inline.
Elles peuvent appeler des modules et utiliser `updateContext`. Il existe
donc un circuit pour porter les opérations métier ; un nouveau dispatcher
ou un second acteur de lecture n’est pas justifié par ce besoin.

Le contexte Sighty et l’état durable à enregistrer ne sont pas nécessairement
identiques champ pour champ. Il faut définir la projection sérialisable,
sans y mettre les handles, références de services ou montages. L’état local
des scènes CodPlay et leur temporalité ne deviennent pas automatiquement
persistés avec les réponses et la progression.

Le runtime Sighty ne fournit pas actuellement une restauration sérialisée
complète d’un parcours. Son reset restaure le contexte initial et traite
les occurrences selon son contrat. L’initialisation de la session, la
restauration, la réconciliation et les resets métier doivent donc être
raccordés explicitement aux ports et cycles disponibles. Aucune nouvelle
phase ou méthode du moteur n’est supposée acquise.

La répartition demandée est une évolution à étudier par rapport au circuit
actuel. Elle ne doit pas être présentée comme une divergence de code avec
une spécification qui exige déjà cette répartition : les contrats vérifiés
décrivent encore l’organisation actuelle.

## Conséquences de la répartition étudiée

La répartition concerne le chargement initial, la restauration, les resets,
la soumission du profil et la réconciliation après modification du document.
Elle doit distinguer l’état logique courant, l’état confirmé par la destination
et les changements en attente, en réutilisant révisions et conflits existants.
Les resets du profil et de la progression conservent leurs effets distincts.

Les décisions relatives à ce raccord sont réunies dans
le [plan de reconfiguration](../plan/2026-10-20-elce-mods-reconfiguration-plan.md),
décision D8. Les preuves doivent relier les
opérations du même circuit dans les contextes auteur et diffusion.

Le nom des types et fonctions vient après cette clarification. Renommer
`onTestStateChange` sans retirer à la popup ses responsabilités laisserait
le problème architectural intact.

Cette note résulte de la lecture des contrats et des raccords cités. Aucun
code modifié et aucune validation d’intégration exécutée pour sa rédaction.
