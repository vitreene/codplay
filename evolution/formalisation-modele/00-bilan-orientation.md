# Bilan d'orientation - modele event-driven

## Contexte

Le projet est en construction. Il n'y a pas de legacy a maintenir dans le runtime cible.
La couche adaptateur actuelle est strictement temporaire pour accelerer les tests de conception.

## Decisions validees

1. Bus global

- tous les events externes sont diffuses aux stories actives
- la diffusion globale reste deterministe (ordre runtime stable)

2. Story et `listen`

- `listen` est un convertisseur d'entree, pas un mecanisme d'abonnement
- comportement retenu: alias-only
- une regle `listen` transforme `event` en `as`
- les events internes sont ceux produits intentionnellement par la story

3. Persos

- les persos reagissent aux events via `actions`
- ils ne pilotent pas le routage global
- ils restent passifs vis-a-vis du bus externe

4. Temporalite

- l'orchestration reste event-driven
- les events "times" (eventimes) sont des sources d'events discretes
- un cue est defini dans un repere local (domaine temporel), puis projete dans la session runtime

5. Role de `clockMode`

- `clockMode` au niveau story n'est plus un pivot du modele
- la logique de temps est deplacee vers un scheduler temporel et des domaines de temps

## Ecart principal avec les notes precedentes

L'ecart majeur n'est pas le dispatch, mais le placement de la temporalite:

- avant: orientation story/track avec temps plus implicite
- apres: domaine de temps explicite + scheduler dedie + emission d'events discrets

Le reste reste compatible avec les principes deja poses:

- matching event/action par nom exact
- orchestration scenario par events
- execution deterministe

## Architecture cible (niveau general)

1. Plan contenu

- relations de composition Scene -> Story -> Persos/Straps

2. Plan signal

- emissions d'events et consommation par actions
- ingress story via `listen` (renommage intentionnel)

3. Plan temps

- groupes d'eventimes rattaches a un domaine temporel (media, story, session)
- scheduler qui convertit les cues en events runtime

4. Plan orchestration

- transitions de scene pilotees par le flux d'events resultant

## Position sur la couche adaptateur

- l'adaptateur n'a pas vocation a rester dans le coeur du projet
- il doit etre sorti du runtime principal
- son usage cible est limite aux exemples et tests de demonstration (hors smoke)

## Impacts attendus sur la suite

- formaliser explicitement les concepts Scene/Story/Perso/Strap/Eventime
- fixer les invariants de routing et de temporalite
- specifier un graphe typé multi-liens: contenu, signal, temps, adaptation
- preparer une API unique pour les interfaces (editeur visuel, DSL, scripts)

## Prochaine etape

Produire la formalisation normative du modele sur la base de ce bilan, en commencant par:

1. SceneDoc (structure et invariants)
2. StoryDoc (ingress listen, bus interne, emission)
3. Eventime model (domaines temporels et scheduler)
4. Graphe unifie (types de liens et regles de validation)
