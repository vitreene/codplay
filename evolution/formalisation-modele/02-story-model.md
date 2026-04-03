# Story model - orchestration locale event-driven

## But

Definir la Story comme unite d'orchestration locale:

- elle recoit des events externes (broadcast global)
- elle convertit intentionnellement des events entrants via `listen`
- elle expose un bus interne pour ses persos/straps
- elle emet des events vers l'exterieur

La story ne porte pas la temporalite globale. Le temps est traite par les producteurs d'events (eventimes, media, timer, etc.).

## Role de la story

1. Frontiere locale

- delimite un contenu logique (persos + straps)
- isole le vocabulaire interne de la story

2. Adaptation d'entree

- `listen` est un convertisseur alias-only
- il mappe des noms externes vers des noms internes
- il n'est pas un systeme de filtrage avance

3. Routage interne

- les persos reagissent via `actions[eventName]`
- les straps de story reagissent selon le meme principe

4. Emission

- la story peut emettre des events metier (`story:*`, `quiz:*`, etc.)
- ces events repartent sur le bus global

## Semantique `listen`

Contrat retenu:

- une regle = `{ event, as }`
- quand `event` externe est recu, la story emet l'event interne `as`
- mode alias-only: l'event externe original n'est pas re-emis dans le bus interne

Exemple d'intention:

- externe: `pointer:click`
- interne: `form.submit.request`
- ce sont les persos qui decident quoi faire sur `form.submit.request`

## Structure conceptuelle de StoryDoc

Une story est composee de:

- identite
  - `id`

- ingress
  - `listen[]` (regles `event -> as`)

- contenu
  - references vers persos
  - references vers straps locaux

Regles de contenu:

- les persos references par une story lui sont exclusifs
- un meme perso ne peut pas etre monte dans deux stories en parallele
- les straps peuvent etre locaux (copie par story) ou globaux (instance partagee)
- un perso peut etre de type standard ou custom (`item.type`)
- pour un type custom, le module player definit le schema de `item.module` et de `actions[*].cmd`
- les events emis par le module repassent sur le bus global via `emit(event)` injecte par le player
- les actions standard du perso s'appliquent au noeud racine; les mises a jour internes restent dans le module
- pour un module `exposed-targets`, `targetId` peut viser une cible interne exposee par le module

- orchestration locale
  - actions de story (optionnel)
  - emission d'events sortants (optionnel)

Note: pas de `clockMode` requis dans ce modele de base.

## Pipeline d'execution local (story)

1. reception externe

- un event global arrive depuis le bus runtime

2. conversion ingress

- evaluation des regles `listen` en ordre de declaration
- production de zero, un, ou plusieurs events internes alias

3. dispatch interne

- matching exact sur `actionsByEventName`
- application aux persos et straps de la story

4. emission externe

- les consequences peuvent emettre des events globaux
- le scenario peut alors transitionner

## Regles de determinisme

- ordre de declaration des regles `listen` preserve
- matching interne par egalite exacte de nom
- ordre stable des listeners internes preserve
- aucune evaluation implicite hors pipeline

## Invariants de validation Story

1. Integrite des regles

- `listen.event` non vide
- `listen.as` non vide

2. Integrite du contenu

- chaque reference de perso/strap doit exister
- pas d'ID duplique dans l'espace local de story

3. Hygiene events

- pas d'usage involontaire des prefixes reserves runtime
- conventions de nommage event appliquees de facon uniforme

4. Coherence alias-only

- le runtime ne reinjecte pas automatiquement l'event externe original dans le bus interne

## Relation avec le scenario

Le scenario observe les events globaux emis par stories/straps/player.

- la story reste locale
- le scenario reste global
- la transition narrative ne depend pas d'une horloge de story, mais du flux d'events

Dans une scene multi-stories actives:

- plusieurs stories peuvent recevoir/emettre en parallele
- le scenario peut maintenir des overlays et des interruptions sans changer de modele
- par defaut, une transition scenario ajoute/active sans stopper implicitement les autres stories
- l'arret d'une story reste une intention explicite
- chaque instance conserve sa propre copie de persos, sans partage entre instances

## Diagramme de flux (story)

```mermaid
flowchart LR
  EXT[Bus global externe] --> IN[Story ingress]
  IN --> L[listen: event -> as]
  L --> IBUS[Bus interne story]
  IBUS --> P[Persos actions[eventName]]
  IBUS --> R[Straps locaux actions[eventName]]
  P --> OUT[Events sortants]
  R --> OUT
  OUT --> EXT
```

## Points ouverts (a traiter dans les prochains docs)

- politique si plusieurs regles `listen` produisent le meme alias au meme tick
- format canonique de l'enveloppe event (meta, correlation, trace)
- regles de nommage et namespaces metier/technique
