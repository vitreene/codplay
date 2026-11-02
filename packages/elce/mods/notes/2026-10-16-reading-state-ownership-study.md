# État de lecture — responsabilité de Sighty et rôle du conteneur

Date : 16 octobre 2026.

Note d’étude sur la définition, la gestion et l’enregistrement de l’état
de lecture ; ce document n’est pas un plan de travail. La proposition plus
large de pilotage de l’état par Sighty reste à décider dans le [plan Mods](../plan/2026-10-20-elce-mods-reconfiguration-plan.md),
décision D8. La séparation entre contenu édité et état de consultation dans la
preview est appliquée et vérifiée dans les spécifications Preview, Question et
Sommaire/profils.

## Un état de lecture, deux contextes d’usage

L’utilisateur précise qu’il n’existe pas de situation métier « test » :
le lecteur s’exécute dans un contexte **auteur** ou **diffusion**. La collecte
du profil, la navigation, la progression, les réponses et les tentatives
d’Évaluation sont des données de lecture. Leur nature ne dépend pas du contexte
d’usage.

Les noms actuels `ProjectTestState`, `onTestStateChange` et
`ProjectTestStateSession` reflètent le contexte auteur dans lequel leur
persistance a été construite. Ils ne correspondent pas à un second circuit
de lecture, distinct d’un circuit général déjà existant.

Certaines possibilités sont propres au contexte auteur, notamment ignorer
les contraintes ou modifier le document puis réconcilier la progression.
Ces possibilités doivent être distinguées de l’état commun qu’elles
affectent ; elles ne justifient pas de qualifier toute la lecture de test.
Le vocabulaire futur reste à choisir après clarification des responsabilités.

## Contenu édité et état de consultation

Les composants et leur configuration sont créés et modifiés par l’auteur ;
ils appartiennent au contenu qui sert à construire la lecture. L’état de
consultation — navigation, profil, progression, réponses et Évaluation —
décrit le parcours d’un lecteur. Dans la preview, il reste dans la session,
séparément des composants, des sources de scène et du cache des ressources ;
il n’est jamais enregistré sur le serveur. Son cycle de vie est distinct de
celui du contenu édité et de ses productions réutilisables.

Le lecteur utilise ces deux ensembles ensemble : il garde l’état courant à part
et le présente dans les composants sans l’intégrer au cache des ressources. Le
raccord vérifié utilise les builders de scène neutres et le rafraîchissement
Sighty existant ; aucun changement du runtime Sighty n’est requis.

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
| [popup-player.tsx](../../src/app/player/popup-player.tsx) | Lit l’état test initial, reçoit les changements dans l’instantané de session et reconstruit le lecteur selon la commande ; les resets modifient aussi cet instantané. La preview ne déclenche aucune écriture serveur. |
| [project-test-state-session.ts](../../src/app/player/project-test-state-session.ts) | Charge l’état serveur initial ; l’API conserve son compare-and-swap pour ses clients d’écriture, mais la preview n’envoie pas de `PUT`. |

La popup présente le lecteur et garde son état de session. La gestion métier
reste partagée entre actions du scénario et conteneur : les réponses et fins de
page passent par Sighty, tandis que les commandes de reset sont conduites
depuis la popup. Aucun de ces changements de preview n’est envoyé au serveur.

La soumission du profil appelle le callback puis dépend du conteneur pour
reconstruire la projection. Le callback actualise l’instantané en mémoire ; il
ne lance pas une sauvegarde serveur. Ce raccord de session est distinct de la
question plus large de propriété Sighty suivie en D8.

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

La proposition de faire piloter par Sighty le chargement, les resets et toute
persistance durable reste à étudier par rapport au circuit actuel. La
spécification preview décrit déjà le contrat appliqué : l’état de consultation
reste en session et n’est pas écrit depuis la preview.

## Conséquences de la répartition étudiée

La question D8 concerne le chargement initial, la restauration, les resets,
la soumission du profil et la réconciliation après modification du document.
Pour tout contexte autorisé à persister, elle doit préciser l’état logique,
les révisions et les conflits. La preview n’a ni écriture en attente ni état
serveur confirmé après ses interactions. Les resets du profil et de la
progression gardent leurs effets distincts.

Les décisions relatives à ce raccord sont réunies dans
le [plan de reconfiguration](../plan/2026-10-20-elce-mods-reconfiguration-plan.md),
décision D8. Les preuves doivent relier les
opérations du même circuit dans les contextes auteur et diffusion.

Le nom des types et fonctions vient après cette clarification. Renommer
`onTestStateChange` sans retirer à la popup ses responsabilités laisserait
le problème architectural intact.

La séparation du cache preview est implémentée et vérifiée ; les spécifications
liées consignent les tests et l’essai Safari. Les autres propositions D8 de
cette note restent à décider dans le plan Mods.
