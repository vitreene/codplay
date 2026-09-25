# Relevé du fonctionnement du projet et assainissement documentaire

> Statut : **À venir**. Démarrage après la clôture du
> [plan scroll-container](./2026-09-23-scroll-container-integration-plan.md),
> composant et capacités associées compris.

## Objectif

Permettre aux prochaines lectures du dépôt de retrouver rapidement le rôle de
chaque partie, le chemin déjà établi pour un comportement et les frontières à
préserver. Les nouveaux documents serviront deux lecteurs différents :

- une carte interne des composants du projet et de leur fonctionnement, avec
  des liens vers les contrats et le code qui font autorité ;
- un README compréhensible par une personne qui écrit une scène CodPlay.

Ce travail comprend aussi le repérage des contradictions, des comportements
implémentés à plusieurs endroits et des méthodes devenues obsolètes. Les notes,
plans et autres documents obsolètes, ainsi que tous les documents textuels V1,
seront supprimés après vérification de leurs références et transfert des
informations encore nécessaires vers les documents V2 actifs. Cette demande
concerne les textes ; elle ne demande pas la suppression du code V1.

## Condition de démarrage

Ne pas commencer ce plan avant que le plan scroll-container soit terminé :
contrat, composant, observation, capture associée et validations exigées par ce
plan doivent être clos et leur statut mis à jour.

À la date de rédaction, le plan scroll-container indique encore une
implémentation en cours et des validations navigateur à réaliser. Il constitue
donc le préalable direct de ce travail.

## Étape 1 — inventaire et ordre de lecture

Inventorier les packages et les textes existants avant de rédiger. La carte
couvrira au minimum :

- `codplay-v1` et `codplay` V2, en gardant leur séparation visible ;
- les composants et bibliothèques d'authoring facultatifs ;
- les démos, l'éditeur et Sighty ;
- les autres packages présents et les liens qu'ils ont réellement avec
  CodPlay.

Pour chaque document de référence, relever son rôle, son statut, son périmètre,
les documents qui le citent et les décisions qu'il porte. Établir un ordre de
lecture simple : règles de travail, plan général applicable, plan détaillé,
spécification du comportement, puis code et preuve d'acceptation. Une note
d'étude ou un document marqué obsolète ne remplace jamais une décision du
plan ou de la spécification en vigueur.

Éléments déjà connus à vérifier au début de cette étape :

- l'index général V2 et le guide de découverte doivent rester cohérents avec
  le statut du plan détaillé et les validations réellement passées ;
- le guide de découverte CodPlay V2 est le point d'entrée demandé aux agents,
  mais son état détaillé date principalement d'août et septembre 2026 ; le
  mettre à jour à partir des plans et du code actuels ;
- le dépôt contient une carte historique V2 et une note scroll explicitement
  obsolète ; vérifier leurs liens avant de les conserver ou de les supprimer.

## Étape 2 — carte interne du fonctionnement

Créer une carte interne destinée aux futures lectures de code. Elle sera
rangée sous `packages/codplay/projet/notes/` et liée depuis le guide de
découverte V2. Elle ne recopiera pas les règles des spécifications ; elle
expliquera où les trouver et comment les différentes parties se raccordent.

La carte décrira :

1. le rôle des packages et le sens réel de leurs dépendances ;
2. le parcours d'une scène, de sa déclaration à sa compilation, sa lecture et
   son affichage ;
3. le parcours d'un événement, de son arrivée à son inscription dans le journal
   et à la mise à jour de l'état ;
4. le rôle du player, de l'engine, des composants, des services, des modules et
   des adaptateurs HTML, avec leurs principaux points d'entrée dans le code ;
5. pour chaque grande capacité, le circuit existant, son propriétaire et les
   tests ou démos qui l'exercent.

La frontière du cœur CodPlay devra être démontrée avec les dépendances et le
code : le moteur d'événements du cœur traite et journalise les événements sans
connaître le DOM, le runner HTML ni le materializer. Le materializer reçoit
l'état logique calculé et le présente ; il ne définit pas l'état logique et ne
sert pas de source au moteur d'événements. Les adaptateurs propres à un
environnement relient ses entrées et son affichage au player par les ports
existants.

La carte donnera aussi des exemples concrets de décisions d'extension déjà
tranchées, dont le rôle du module runtime scroll-container et celui de sa
factory HTML. Chaque explication renverra vers le plan, la spécification, le
code et, lorsqu'elle existe, la validation correspondante.

## Étape 3 — README pour les auteurs de scènes

Créer `packages/codplay/README.md` comme guide d'usage V2. Il décrira en langage
courant ce qu'un auteur déclare et ce qu'il observe pendant la lecture : scènes,
stories, éléments, état initial, actions et événements. Il expliquera le
parcours général d'une scène à partir d'exemples que l'on peut adapter, puis
renverra aux démos et aux spécifications auteur pour les détails.

Ce README aura au moins un exemple complet de scène. Il décrira l'usage et les
effets visibles pour l'auteur, sans exposer les détails internes du moteur.
Mettre à jour le README racine pour diriger les lecteurs vers ce guide et les
commandes de démarrage adaptées.

## Étape 4 — audit des contradictions, doublons et méthodes obsolètes

Pour chaque sujet retenu :

- comparer le texte normatif, le plan accepté, le code et sa validation ;
- relever les affirmations incompatibles, les règles répétées dans plusieurs
  circuits et les méthodes présentes sans rôle actuel établi ;
- distinguer une méthode réellement abandonnée d'une méthode peu référencée,
  interne, publique ou encore appelée par un parcours indirect ;
- inscrire chaque constat avec ses fichiers de preuve et l'action proposée :
  garder, corriger, regrouper, remplacer ou supprimer.

Faire ce contrôle après chaque étape du plan, puis une dernière fois après le
nettoyage des textes. Dans le suivi du plan, chaque constat garde son lien vers
les documents ou fichiers concernés, la décision prise et le travail restant.
Une contradiction qui change le comportement attendu bloque les modifications
qui en dépendent jusqu'à ce que le contrat soit éclairci.

Ne pas déduire qu'une méthode est obsolète à partir d'une seule recherche de
texte. Vérifier ses appels, exports, adaptateurs, tests et contrats. Toute
modification de comportement ou suppression d'API qui dépasse les décisions
déjà acceptées reçoit son propre plan avant le code.

## Étape 5 — nettoyage des textes

Après l'audit :

- transférer dans les documents V2 actifs les comportements V1 qui doivent
  encore être préservés ;
- remplacer les liens vers les documents V1 par les références V2 retenues ;
- supprimer les textes documentaires V1 de tout le dépôt ;
- supprimer les notes et plans obsolètes après avoir repris les décisions
  encore utiles ;
- corriger les liens, index et statuts affectés par les suppressions.

Cette étape retire la documentation V1. Le code, les assets et les fixtures V1
restent en place tant qu'un plan distinct ne décide pas de leur sort.

## Acceptation finale

Le plan peut être clos lorsque :

- la carte interne permet de retrouver le propriétaire, le code, le contrat et
  la preuve de chaque circuit important ;
- la séparation entre le moteur d'événements du cœur et la présentation HTML
  est expliquée à partir des dépendances réelles ;
- le README aide un auteur à comprendre et écrire une scène à partir d'un
  exemple complet ;
- les contradictions, doublons et méthodes examinés ont un statut et une suite
  décidée ;
- les documents V1 et les textes obsolètes ciblés ont été retirés, et aucun lien
  actif ne pointe vers un document supprimé ;
- les plans et spécifications actifs indiquent les statuts correspondant à
  l'implémentation et aux validations réellement effectuées.
