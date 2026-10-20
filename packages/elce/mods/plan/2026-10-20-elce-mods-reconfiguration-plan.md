# Elcé — Mods : conclusions et décisions

Les études et leurs arguments sont réunis dans [les notes du sujet](../index.md).
Ce document conserve les conclusions et les décisions courantes. Les choix
techniques à valider sont distingués des orientations retenues ; leur présence
ici ne signifie pas qu’ils sont implémentés.

## Orientations retenues

- Elcé reste une application auteur unique avec des interfaces cohérentes entre mods.
- Le principe des mods est retenu. Learning est le nom du mod actuel ; Learning et DGS sont prioritaires. Les autres exemples restent secondaires, sans engagement de réalisation.
- Le noyau résout le mod du projet et les ressources nécessaires. Le choix du mod à la création reste une idée d’interface ; le mod reste attaché au projet.
- Le réemploi auteur consiste à copier les contenus et BDC, puis à adapter leur présentation. Le partage éventuel des fichiers image reste à décider.
- Chaque mod possède sa définition et ses assemblages dans son dossier. Les entrées applicatives utilisent ses fonctions publiques.
- Le métier appartient aux classes TypeScript ; machines et façades coordonnent leurs appels ; les interfaces présentent les valeurs et émettent les intentions. Le scheduler et l’affichage emploieront les mêmes classes métier concernées.
- Tous les mods suivent la même chaîne : document auteur persisté, puis génération Elcé du scénario Sighty, des scènes CodPlay, actions et guards. Le schéma BDD et les productions de lecture sont distincts ; preview et player exporté partagent cette génération.
- La composition directe en TypeScript constitue l’approche actuelle. Un mod réduit à une composition de modules reste un cap ; les interactions entièrement déclaratives sont exclues de cette étude.

## Conclusions du découpage étudié

L’[analyse du code actuel](../notes/2026-10-20-learning-extraction-study.md#analyse-des-frontières-sur-le-code-actuel)
étaye la répartition suivante. Les signatures détaillées de l’étude restent
à valider dans le périmètre qui en aura besoin.

| Propriétaire | Responsabilités |
| --- | --- |
| Noyau | Structures communes, références, admission et file de changements, commit, historique, sessions, synchronisation, transport, gestion technique des médias et cycle Sighty/CodPlay d’une composition fournie. |
| Ressources | Données, règles de contenu, éditeurs, presets et rendu des BDC ; formats Flux/Diapo et mécanismes réutilisables identifiés. |
| Learning | Document complet et codec actuels, création initiale, `scenarioEntries`, `PagePlacement`, Sommaire, profil, Évaluation, scénario, progression, navigation et adaptateur SQLite actuel. |
| Assemblages du mod | Contributions des ressources, services, façades et machines sous `src/mods/learning/`. Aucun fichier Learning dans un dossier global de composition. |
| Lecture Learning | Même préparation par profil, mêmes builders et mêmes règles pour preview et player exporté. Entrées et raccords de contexte distincts ; le lecteur partagé est indépendant des services auteur. |
| Interface auteur | Cadre et gestes communs ; organisation du parcours, réglages et choix des contributions possédés par le mod. |

Le stockage commun peut transporter le document complet : son codec et les
services qui interprètent les données Learning restent fournis par ce mod.
L’historique reçoit la transformation de fusion média du service de commandes.
La préparation de lecture par profil appartient au lecteur partagé preview/export.

## Décisions de refactorisation

- Extraire Learning à fonctionnalités constantes : comportements, limitations connues et contrats vérifiés sont conservés.
- Préserver un seul acteur propriétaire du document, une seule file, un historique et les circuits existants de persistance, médias et synchronisation.
- Procéder par petits périmètres, avec comparaison avant/après. Chaque partie commune extraite doit aussi fonctionner avec des données et services indépendants de Learning, sans champs Learning factices.
- Démontrer l’indépendance pendant l’extraction Learning. DGS validera ensuite ses besoins particuliers.
- Vérifier les intégrations affectées et les consommateurs réels d’une évolution commune. Le partage du code et les tests isolés ne suffisent pas à démontrer cette équivalence.
- Conserver le format dans un lot de refactorisation pour permettre sa comparaison ; toute évolution de format constitue une décision distincte.
- L’isolation du moteur de presets par injection du registre est le premier découpage limité envisagé ; les variantes plus larges de l’étude ne valent pas engagement global.

## Format documentaire

Le v5 est le format de départ, encore provisoire. Avant fixation explicite du
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
| D9 | Premier périmètre fonctionnel DGS et capacités runtime nécessaires. |
| D10 | Raccords physiques et signatures exactes du découpage étudié, selon le périmètre concerné. |
| D11 | Configurations réellement proposées et couverture des interactions de leurs ressources. |
| D12 | Périmètre de la première extraction et composition des fonctionnalités effectivement utilisées. |
| D13 | Échanges internes nécessaires : intentions, résultats, erreurs, propriétaires d’état et cycle de vie. |

Le point de cache des réponses Question relevé dans l’étude reste à qualifier.
Le comportement actuel de Sighty n’établit pas encore toutes les possibilités
de reprise, d’interruption et de concurrence envisagées pour DGS.

## Sequence et scheduler

Le point de départ de l’[étude dédiée](../notes/2026-10-20-sequence-scheduler-study.md)
distingue les enchaînements locaux de `sequence` et leur programmation temporelle
par `scheduler`. L’autonomie de `sequence` hors DGS reste ouverte.

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
| SQ1 | Usage de `sequence` sans calendrier et propriétaire du module. |
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
