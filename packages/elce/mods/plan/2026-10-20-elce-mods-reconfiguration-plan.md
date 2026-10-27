# Elcé — Mods : conclusions et décisions

Les études et leurs arguments sont réunis dans [les notes du sujet](../index.md).
Ce document conserve les conclusions et les décisions courantes. Les choix
techniques à valider sont distingués des orientations retenues ; leur présence
ici ne signifie pas qu’ils sont implémentés.

## Périmètre convenu

**Fixe pour l’objectif et les principes ; découpage technique A relire.**

Créer la structure des mods et y faire fonctionner l’application actuelle sous
Learning, à fonctionnalités constantes. La création d’autres mods, dont DGS,
interviendra plus tard. L’extraction limitée des presets constitue un lot
possible de ce chantier, pas son résultat final.

Une ressource porte l’essentiel de son métier dans une ou plusieurs classes
TypeScript indépendantes des mods. Un mod sélectionne et configure les
ressources et fournit les adaptations nécessaires à son document, son parcours
et ses contextes d’usage. Être le premier utilisateur d’une ressource n’en donne
pas la propriété métier au mod.

Le Sommaire suit ce principe dès l’extraction actuelle : distinguer son métier
réutilisable des adaptations Learning. Le scheduler devra suivre le même
principe lors de sa conception future, même si son premier usage est DGS.
Ses règles fonctionnelles et ses interfaces restent à définir.

Learning constitue la composition de base : toutes ses capacités actuelles
sont à examiner comme réutilisables. Le parcours, la progression, le profil
et l’Évaluation ne sont pas réservés à Learning. Chaque mod choisit ses
ressources et leurs réglages ; leur emploi reste facultatif selon sa composition.

## Orientations retenues

- Elcé reste une application auteur unique avec des interfaces cohérentes entre mods.
- Le principe des mods est retenu. Learning est le nom du mod actuel et constitue la première mise en service de cette structure. DGS reste un usage futur prioritaire ; les autres exemples restent secondaires, sans engagement de réalisation.
- Le noyau résout le mod du projet et les ressources nécessaires. Le choix du mod à la création reste une idée d’interface ; le mod reste attaché au projet.
- Le réemploi auteur consiste à copier les contenus et BDC, puis à adapter leur présentation. Le partage éventuel des fichiers image reste à décider.
- Chaque mod possède sa définition et ses assemblages dans son dossier. Les entrées applicatives utilisent ses fonctions publiques.
- Le métier des ressources appartient à des classes TypeScript indépendantes des mods ; machines et façades coordonnent leurs appels ; les interfaces présentent les valeurs et émettent les intentions. Les adaptateurs portent les raccords propres à un mod. Le scheduler et l’affichage emploieront les mêmes classes métier concernées.
- Tous les mods suivent la même chaîne : document auteur persisté, puis génération Elcé du scénario Sighty, des scènes CodPlay, actions et guards. Le schéma BDD et les productions de lecture sont distincts ; preview et player exporté partagent cette génération.
- La composition directe en TypeScript constitue l’approche actuelle. Un mod réduit à une composition de modules reste un cap ; les interactions entièrement déclaratives sont exclues de cette étude.

## Conclusions du découpage étudié

L’[analyse du code actuel](../notes/2026-10-20-learning-extraction-study.md#analyse-des-frontières-sur-le-code-actuel)
étaye la répartition suivante. Les signatures détaillées de l’étude restent
à valider dans le périmètre qui en aura besoin.

| Propriétaire | Responsabilités |
| --- | --- |
| Noyau | Structures communes, références, admission et file de changements, commit, historique, sessions, synchronisation, transport, gestion technique des médias et cycle Sighty/CodPlay d’une composition fournie. |
| Ressources | Classes métier indépendantes des mods et contributions réutilisables : contenus et formats, organisation du parcours, Sommaire, profil/formulaire, conditions/prérequis, progression/navigation, Évaluation/Résultat, personnalisation des textes, état de lecture et apparence. Les frontières précises restent à relire. |
| Learning | Définition, sélection, configuration et assemblage des ressources actuelles ; création initiale et raccords à l’agrégat v7, son codec, ses invariants et son adaptateur SQLite. `scenarioEntries` et `PagePlacement` décrivent aujourd’hui l’organisation choisie ; leur métier est candidat au réemploi. |
| Assemblages du mod | Contributions des ressources, services, façades et machines sous `src/mods/learning/`. Aucun fichier Learning dans un dossier global de composition. |
| Lecture Learning | Même préparation par profil, mêmes builders et mêmes règles pour preview et player exporté. Entrées et raccords de contexte distincts ; le lecteur partagé est indépendant des services auteur. |
| Interface auteur | Cadre et gestes communs ; organisation du parcours, réglages et choix des contributions possédés par le mod. |

Le stockage commun peut transporter le document complet : son codec et les
services qui interprètent les données Learning restent fournis par ce mod.
L’historique reçoit la transformation de fusion média du service de commandes.
La préparation de lecture par profil appartient au lecteur partagé preview/export.
La cartographie des études doit être réévaluée selon cette séparation : une
fonctionnalité actuellement rangée dans Learning peut fournir une ressource
autonome et un adaptateur Learning, sans dupliquer son métier.

L’[examen des candidats](../notes/2026-10-27-learning-reusable-resources-study.md)
précise les capacités, leurs circuits actuels et les couplages à séparer.
Cette analyse remplace l’attribution exclusive à Learning des fonctionnalités
dans la cartographie du 20 octobre ; elle ne certifie pas leur indépendance.

L’[audit du 27 octobre](../notes/2026-10-27-learning-independence-audit.md)
actualise ce constat sur 196 sources : les règles de profil, le formulaire,
les identités et l’historique conservent notamment des chemins vers l’agrégat.
Il distingue les couplages de types des dépendances de valeurs. Aucun lot
d’extraction n’est appliqué ; D10–D13 restent **A relire**.

## Décisions de refactorisation

- Extraire Learning à fonctionnalités constantes : comportements, limitations connues et contrats vérifiés sont conservés.
- Préserver un seul acteur propriétaire du document, une seule file, un historique et les circuits existants de persistance, médias et synchronisation.
- Procéder par petits périmètres, avec comparaison avant/après. Chaque partie commune extraite doit aussi fonctionner avec des données et services indépendants de Learning, sans champs Learning factices.
- Démontrer l’indépendance pendant l’extraction Learning. DGS validera ensuite ses besoins particuliers.
- Vérifier les intégrations affectées et les consommateurs réels d’une évolution commune. Le partage du code et les tests isolés ne suffisent pas à démontrer cette équivalence.
- Conserver le format dans un lot de refactorisation pour permettre sa comparaison ; toute évolution de format constitue une décision distincte.
- L’isolation du moteur de presets par injection du registre est le premier découpage limité envisagé ; les variantes plus larges de l’étude ne valent pas engagement global.

## Actions proposées — A relire

1. Reprendre la cartographie de l’[étude d’extraction](../notes/2026-10-20-learning-extraction-study.md) avec l’[examen des ressources candidates](../notes/2026-10-27-learning-reusable-resources-study.md) et l’[audit des dépendances](../notes/2026-10-27-learning-independence-audit.md) : pour chaque fonctionnalité actuelle, identifier les classes métier réutilisables, les adaptations de l’agrégat et les circuits communs conservés. Examiner aussi parcours, navigation, progression, profil et Évaluation ; Learning en sélectionne la composition actuelle.
2. Préciser les entrées et dépendances de `src/core/`, `src/resources/` et `src/mods/learning/`, les raccords auteur/lecture/serveur et la résolution du mod. Les signatures et l’identification persistée restent à valider en D1, D2, D3, D10 et D13.
3. Découper et appliquer la migration en lots acceptés : déplacer et adapter les circuits existants, puis raccorder les entrées applicatives aux compositions Learning. Chaque lot nomme ses fichiers et sa comparaison avant/après ; les presets seuls ne clôturent pas le chantier.
4. Vérifier l’application actuelle dans cette structure : édition, historique, médias, persistance/synchronisation, preview et exports existants. Mettre à jour les spécifications avec les seuls comportements implémentés et vérifiés.

Acceptation : Learning fonctionne par ses compositions dans la structure mods,
avec les comportements et limitations actuels. Les ressources extraites
n’importent pas Learning et leurs classes métier sont éprouvées avec des données
propres aux tests, sans champs Learning factices. Les raccords réels concernés
sont validés en complément des tests métier, du typecheck et du build. Aucun
autre mod ni scheduler n’est à construire pour obtenir cette acceptation.

## Format documentaire

Le v7 est le format actuel de départ, selon la
[spécification documentaire](../../specs/document-model-spec.md). La
refactorisation conserve ce format ; l’identification persistée du mod reste
une décision distincte en D1/D3. Avant fixation explicite du
format de référence après les derniers tests du périmètre retenu, les données
d’essai peuvent être effacées et recréées lors d’un changement accepté.
Après fixation, chaque évolution demandera une réécriture/migration de base
et/ou une montée de version avec traitement des données existantes.

## Décisions techniques à préciser

Ces points restent **A relire** pour leurs choix techniques non arrêtés.

| Réf. | Décision restante |
| --- | --- |
| D1 | Identification persistée du mod et résolution avant lecture de ses données ; traitement d’un mod inconnu. |
| D2 | Raccord minimal d’un mod : identité, version, ressources, création, validations et contributions auteur/lecture. |
| D3 | Forme persistée des données propres aux mods, fixation du format de référence et traitement des formats inconnus. |
| D4 | Informations et dépendances nécessaires pour interpréter un contenu repris dans un autre mod. |
| D5 | Identités et références après copie : BDC composites, enfants, ancres, profil et types indisponibles ; articulation avec copier/couper/coller. |
| D6 | Acquisition et rétention des médias copiés, Undo/Redo et éventuel partage des fichiers image. |
| D7 | Contributions d’interface propres aux mods, configuration des outils communs et interface de détermination du mod. |
| D8 | Raccord du pilotage de l’état de lecture demandé au niveau du scénario Sighty : chargement, restauration, resets et confirmations d’enregistrement. |
| D9 | Pour plus tard : premier périmètre fonctionnel DGS et capacités runtime nécessaires. |
| D10 | Frontières des ressources candidates, classes métier, dépendances, adaptations documentaires et signatures ; réviser la cartographie et l’arborescence du 20 octobre avant les lots concernés. |
| D11 | Configurations réellement proposées, dépendances facultatives entre ressources et couverture de leurs interactions, sans imposer la composition complète Learning. |
| D12 | Objectif fixé : structure mods avec l’application actuelle sous Learning ; ordre et contenu technique des lots, composition des fonctionnalités effectivement utilisées à préciser. |
| D13 | Échanges internes nécessaires : intentions, résultats, erreurs, propriétaires d’état et cycle de vie. |

Cache preview : état de consultation, navigation comprise, séparé du contenu
édité et du cache des ressources. **Appliqué et vérifié sur `develop`, puis
intégré à `elce-mods`.** La preview garde cet état dans sa session, ne l’écrit
pas sur le serveur et restitue la page active lors d’une reconstruction ;
« Synchroniser » utilise la page sélectionnée dans l’éditeur. Le contrat et
les preuves sont dans la [spécification Preview](../../specs/player-preview-spec.md).
D8 reste **A relire** pour la proposition plus large de pilotage Sighty,
chargement/restauration et persistance selon les contextes.

Le comportement actuel de Sighty n’établit pas encore toutes les possibilités
de reprise, d’interruption et de concurrence envisagées pour DGS.

## Sequence et scheduler

Le point de départ de l’[étude dédiée](../notes/2026-10-20-sequence-scheduler-study.md)
distingue les enchaînements locaux de `sequence` et leur programmation temporelle
par `scheduler`. Le métier de ces ressources doit pouvoir être employé par
plusieurs mods ; leurs adaptations DGS appartiendront à ce mod. La possibilité
d’utiliser `sequence` sans scheduler reste ouverte. Leur réalisation est hors
du chantier actuel.

Les séquences et calendriers sont des données auteur à persister. Les builders
et contributions du mod les transforment en scénario, scènes, actions et guards.
La lecture suit ce scénario Sighty ; le format documentaire ne devient pas un
second langage d’exécution interprété par un lecteur DGS.

Une séquence peut présenter des scènes en parallèle dans les zones d’un même
layout. Sa fin naturelle exige la fin de chacune des occurrences attendues.
Cette condition collective appartient aux règles de `sequence` ; le raccord
aux signaux de lecture et aux transitions Sighty reste à préciser.

La diffusion est définie en heure locale du récepteur. La variante serveur
étudiée calcule les occurrences adaptées à son contexte et lui fournit les
données de diffusion à exécuter.

Un projet DGS peut associer ses récepteurs à des adresses de schedulers
distinctes pour diffuser, sur un réseau local, des parties complémentaires
d’un même propos. L’étude reste dans un mod DGS ; « diffusion uniforme » et
« diffusion par destination » restent des déclinaisons commerciales possibles.

L’affectation demande une interface pour nommer les diffuseurs, leur attribuer
un programme et connaître leur présence observée. Le formulaire local,
l’association depuis l’administration et la préparation avant installation
sont des pistes étudiées ; aucun parcours n’est encore retenu.

| Réf. | Décision ouverte |
| --- | --- |
| SQ1 | Usage de `sequence` sans calendrier et découpage physique du métier réutilisable et des adaptations propres aux mods. |
| SQ2 | Format documentaire et projection BDD des séquences ; génération distincte des passages successifs et compositions par zones en vues et scènes Sighty/CodPlay, avec correspondance des identités. |
| SQ3 | Durées, contrat des signaux de fin et raccord de la fin collective, cas des chapitres, transitions, chargement et dépassement. |
| SQ4 | Projection temporelle des passages successifs et scènes parallèles : durée finie, inconnue ou boucle. |
| SQ5 | Contexte local du récepteur, calendriers, récurrences datées, plages traversant minuit et choix du calendrier actif ; protocole de la projection serveur et retour des fins constatées si une décision serveur en dépend. |
| SQ6 | Arrivée tardive, reprise, horloge corrigée, chevauchement, interruptions, interludes et comportement hors plage. |
| SQ7 | Génération des routes, actions et guards ; admission Sighty, confirmation/refus et arbitrage entre échéance et fin locale. |
| SQ8 | Document auteur, productions de lecture et état de diffusion distincts ; conservation éventuelle des artefacts et réconciliation après modification auteur. |
| SQ9 | Contributions des modules, intégrité des références et suppression d’un contenu ou d’une séquence utilisée. |
| SQ10 | Identification durable et nommage des diffuseurs ; installation locale, déclaration/appairage ou préparation préalable ; conservation des affectations aux programmes, présence et confirmation de lecture, réassociation après remplacement ; éventuel besoin de découverte réseau ou de destinations logiques. |
| SQ11 | Identification des programmations servies et besoin éventuel de coordination temporelle entre les récepteurs. |

## Limites du chantier

DGS reste une diffusion TV collective et autonome, sans interaction directe
du public. Les mods hors DGS visent un player exporté pour LMS ; le LMS
conserve apprenants et résultats. La fabrication de l’export, SCORM et le
déploiement relèvent d’un chantier distinct.

Le diffuseur web est supposé lancé dans un environnement kiosque déjà configuré.
La configuration du mode kiosque et de l’équipement est un prérequis extérieur
au périmètre de cette étude.

Utilisateurs, catalogues personnels ou partagés, ACL et commercialisation
restent hors de cette étude. Les BDC intégrant des composants externes ou des
scènes préconçues restent deux exemples d’extensions à concevoir, sans réalisation
engagée. Les évolutions CodPlay/Sighty nécessaires gardent leurs décisions
et autorisations chez leurs propriétaires.
