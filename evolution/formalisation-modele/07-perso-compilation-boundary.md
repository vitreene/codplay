# Perso compilation boundary - scene vs plateforme

## But

Fixer une frontiere claire pour la construction des persos:

- la scene reste independante de la plateforme
- le player reste majoritairement portable
- les specifics de rendu sont deferes a une couche plateforme

Ce document ne definit pas les details d'implementation. Il pose la logique de separation.

## Constat

La construction d'un perso melange naturellement deux familles d'information:

1. Informations scene (metier, narratif, orchestration)

- type logique de perso
- etat initial attendu
- actions declenchees par events
- role dans la story/scenario

2. Informations plateforme (rendu, perf, limitations)

- representation concrete (DOM/canvas/native)
- styles/classes/layout concrets
- capacites animation disponibles (ex: FLIP)
- contraintes runtime (mesure layout, z-order, media backend)

La difficulte mentionnee est normale: une meme entite "perso" traverse ces deux plans.

## Separation cible en 3 etages

1. Etage Scene/Core (portable)

- produit une specification abstraite de perso (`PersoSpec`)
- aucune hypothese de rendu concret
- aucun champ specifique DOM/CSS/canvas

2. Etage Platform Binding (adaptation)

- transforme `PersoSpec` selon un profil de plateforme
- produit un plan runtime concret (`RuntimePersoPlan`)
- applique les strategies/fallbacks selon capacites

3. Etage Runtime Player (execution)

- instancie/exploite `RuntimePersoPlan`
- orchestre actions/events/transitions
- expose traces et diagnostics

## Objets de contrat (niveau conceptuel)

1. `PersoSpec` (sortie builder core)

- identite et type logique
- etat initial logique
- actions logiques par event
- contraintes non-fonctionnelles eventuelles (ex: priorite perf)

2. `PlatformProfile` (entree platform binding)

- liste des capacites supportees
- policies de fallback
- limites techniques connues

3. `RuntimePersoPlan` (sortie platform binding)

- strategy de rendu retenue
- mapping final des actions vers primitives plateforme
- metadata de diagnostic (degradation, substitutions)

## Regle directrice

Le coeur scene exprime **l'intention**.
La couche plateforme decide **la mecanique**.

Exemple type:

- intention scene: "deplacement anime"
- mecanique plateforme:
  - si FLIP supporte: utiliser FLIP
  - sinon: transition transform classique
  - sinon: fallback sans animation (degrade explicite)

## Gestion des capacites

Le platform binding doit s'appuyer sur une matrice de capacites explicite.

Exemples de capacites:

- support transitions transform
- support mesure layout fiable
- support media seek frame-accurate
- support composition blend avancee

Cette matrice est une entree compile-time/runtime config, pas une deduction implicite.

## Politique de fallback

Pour chaque capacite absente:

- choisir une alternative deterministe
- tracer la degradation
- ne jamais casser le flux event-driven

Le fallback fait partie du contrat, pas d'un comportement cache.

## Place de FLIP

FLIP est une technique de rendu.

- ce n'est pas un concept du modele scene
- ce n'est pas une obligation du player core
- c'est une option d'implementation de la couche plateforme

Le modele scene ne parle que de transition/intention de mouvement.

## Responsabilites reparties

Builder core:

- compile les persos en specs portables
- ne choisit pas de primitives de rendu concretes

Builder platform binding:

- choisit les strategies concretes de rendu/action
- applique les mapping/fallbacks

Player runtime:

- execute les plans concrets fournis
- maintient l'etat et l'ordonnancement event-driven

## Diagnostics attendus

Le systeme doit exposer deux niveaux de diagnostics:

1. Compilation scene

- coherence logique des persos/actions

2. Adaptation plateforme

- capacites non disponibles
- substitutions appliquees
- impacts potentiels (qualite/perf)

Ainsi, l'editeur et l'integrateur voient clairement ce qui est perdu ou adapte selon la cible.

## Decision architecturale recommandee

Formaliser un module dedie de "perso compilation" compose de:

- `perso-core-compiler` (scene -> PersoSpec)
- `perso-platform-compiler` (PersoSpec + PlatformProfile -> RuntimePersoPlan)

Cette separation limite le couplage et garde le modele scene portable.

## Implication pour la suite des specs

Les prochains travaux devront:

- preciser les champs minimaux d'un `PersoSpec`
- preciser le contrat d'un `PlatformProfile`
- lister les capacites critiques par cible
- fixer les regles de fallback et le format des diagnostics

L'objectif est d'industrialiser la compatibilite multi-plateforme sans polluer le modele scene.
