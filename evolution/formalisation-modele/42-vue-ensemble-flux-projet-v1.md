# Vue d'ensemble du projet V1

## Objectif de ce document

Donner une lecture simple du projet pour une personne qui le decouvre: organisation globale, circulation des events, role des tracks, et place des side-effects Scene.

Ce document est volontairement pedagogique et ne remplace pas les specs normatives.

## Organisation globale

Le projet s'organise en 3 parties qui s'enchainent:

1. Conception
2. Compilation (Builder)
3. Lecture (Player)

Vue de flux:

`Conception -> Builder -> Player`

## 1) Partie conception

La conception decrit ce qui doit se passer dans la sequence.

En amont de cette conception, la partie auteur peut provenir de contextes de creation haut-niveau externes a ce projet:

- editeur graphique
- editeur textuel
- code direct

Hierarchie principale:

- `Scene`: cadre global
- `Story` de premier niveau dans la scene
- sous-`Story` pour la composition locale
- `Perso` dans chaque story (elements visibles)
- `Strap` dans chaque story/scene (traitement d'events)
- `Tracks` au niveau scene pour la dimension temporelle

Role des blocs:

- `Scene`: coordination globale
- `Story`: orchestration locale
- `Perso`: rendu visuel
- `Strap`: transformation de donnees/events
- `Tracks`: rythme de la sequence

## 2) Partie compilation (Builder)

Le Builder prend la conception et produit des artefacts de diffusion lisibles directement par le Player.

Role principal:

- assembler `Scene`, `Story`, `Perso`, `Strap`, `Tracks`
- clarifier les liens entre modules
- produire une structure compacte de lecture
- produire la liste des ressources a charger

Sorties:

- scene compilee prete a jouer
- manifeste de ressources (media, styles, fonts)
- exports eventuels vers d'autres formats/systemes

## 3) Partie lecture (Player)

Le Player execute la sequence.

Sous-ensembles:

- `Player`: facade de pilotage (`init`, `play`, `pause`, `seek`, ...)
- `Track manager`: lecture des tracks et declenchement des events temporels
- orchestration d'events: circulation scene/story/strap/perso
- composants runtime: rendu des persos
- moteur de rendu: application des mises a jour visuelles
- horloge commune: synchronisation de tout le systeme

## Tracks: principe, role, utilite

Un track est une ligne de temps qui indique quand declencher des events.

- Principe: un track contient des events positionnes dans le temps
- Role: piloter la progression de sequence
- Utilite: separer le "quoi" (narration) du "quand" (timing)
- un track peut aussi gerer des events "live" (declenches pendant l'execution)
- un track peut etre active/desactive selon le contexte de lecture

Le `Track manager` lit les tracks au fil de l'horloge et declenche les events dus.

## Circuit des events

Sources possibles:

- tracks (temps)
- interactions utilisateur
- systeme runtime

Circuit simplifie:

1. un event est declenche
2. il entre dans l'orchestration runtime
3. Scene/Story concernees le recoivent
4. une Story peut filtrer, transformer ou produire d'autres events
5. les Persos concernes appliquent leurs mises a jour
6. les composants affichent le resultat

## Role des straps

Un `Strap` ne rend rien visuellement.

- il transforme un event en un ou plusieurs events
- il enrichit des donnees
- il peut planifier des emissions via les helpers runtime

Resume:

- `Perso` = affichage
- `Strap` = traitement event/donnees

## Side-effects Scene

Les side-effects sont des actions hors rendu visuel (ex: enregistrement, notification externe, action applicative globale).

La Scene est le bon niveau pour les side-effects globaux:

- elle capte les signaux globaux de progression
- elle decide quand declencher un side-effect
- elle centralise ces sorties pour limiter le couplage direct des stories vers l'exterieur

Exemple type:

- une Story locale signale un evenement important
- la Scene le recoit et l'interprete au niveau global
- la Scene declenche le side-effect approprie

## Hierarchie resumee

- `Scene`
  - `Story` (niveau 1)
    - sous-`Story`
    - `Perso`
    - `Strap`
- `Tracks` donnent la chronologie globale
- `Player` execute l'ensemble de facon synchronisee
