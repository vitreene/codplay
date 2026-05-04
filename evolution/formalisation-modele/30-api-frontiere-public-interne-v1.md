# API frontiere V1 - public host vs runtime interne

## Statut

Document de cadrage Phase 1 (contract-first) pour le chantier API `story` / `tracks` / `eventimes`.

Ce document fixe:

- la frontiere API publique vs API runtime interne
- la table unique des commandes publiques
- la table unique des responsabilites `Player` / `Director` / `Renderer`
- les invariants transverses non negociables

## Objectif de la phase

Avant de figer les contrats detailles (Phases 2-3), etablir un cadre unique pour eviter:

- les bypass entre host et runtime
- les doublons de responsabilites
- les zones grises sur la source de verite (events, journal, commits)

## Frontiere cible

Niveaux:

1. API publique host: surface stable consommable par l application integratrice
2. Facade `Player`: orchestration des appels publics + enforcement des preconditions
3. API runtime interne: details d execution (`Director`, `Renderer`, `Timer`, `Ticker`, compileurs)

Regle directrice:

- toute commande publique traverse la facade `Player`
- aucune commande publique ne cible directement un module interne
- toute mutation metier temporelle passe par le pipeline event canonique

## Table unique des commandes publiques

Convention de resultat (commune):

- succes: `{ ok: true, data?, warnings? }`
- echec: `{ ok: false, error: { code, message, details? } }`

Table:

| Commande publique | Domaine | Effet attendu | Routage interne canonique | Phase cible |
| --- | --- | --- | --- | --- |
| `load(compiledScene, mountTarget, runtimeConfig?)` | lifecycle host | charge une scene et initialise le runtime | `Player -> Director + Renderer + Timer/Ticker` | existant |
| `start()` | lifecycle host | demarre execution depuis `loaded/stopped` | `Player -> Timer/Ticker -> Director loop` | existant |
| `pause()` | lifecycle host | suspend execution sans perdre state runtime | `Player -> Timer/Ticker` | existant |
| `resume()` | lifecycle host | reprend execution depuis `paused` | `Player -> Timer/Ticker` | existant |
| `stop(reason?)` | lifecycle host | arret propre de l execution courante | `Player -> Director + Renderer` | existant |
| `destroy()` | lifecycle host | liberation idempotente des ressources | `Player -> all runtime modules` | existant |
| `emit(event)` | event public | injection d un event public scene-level | `Player -> Director.normalize -> journal -> dispatch` | existant |
| `story.load(input)` | story | enregistre/prepare une story dans le runtime | `Player -> Director.storyRegistry` | phase 2 |
| `story.activate(storyRef)` | story | active une story chargee | `Player -> Director.storyLifecycle` | phase 2 |
| `story.reset(storyRef, reason?)` | story | reset state story runtime | `Player -> Director.storyLifecycle` | phase 2 |
| `story.replay(scope?, fromMs?)` | story | relance logique story selon mode replay | `Player -> Director.replayController` | phase 2 |
| `story.snapshot(scope?)` | story | retourne un snapshot lisible et deterministic | `Player -> Director.storyStateReader` | phase 2 |
| `tracks.set(payload)` | tracks | active/desactive des tracks en lot | `Player -> Director via event canonique tracks:set` | phase 3 |
| `tracks.create(input)` | tracks | cree une track runtime | `Player -> Director.trackStore` | phase 3 |
| `tracks.update(trackId, patch)` | tracks | met a jour metadata/config track | `Player -> Director.trackStore` | phase 3 |
| `tracks.activate(trackRef)` | tracks | active une ou plusieurs tracks | `Player -> Director.trackStore` | phase 3 |
| `tracks.deactivate(trackRef)` | tracks | desactive une ou plusieurs tracks | `Player -> Director.trackStore` | phase 3 |
| `eventimes.add(trackRef, input)` | eventime | ajoute des entries auteur a compiler | `Player -> Director.eventimeCompiler` | phase 3 |
| `eventimes.update(eventimeRef, patch)` | eventime | met a jour une entree eventime existante | `Player -> Director.eventimeCompiler` | phase 3 |
| `eventimes.remove(eventimeRef)` | eventime | retire une entree eventime | `Player -> Director.eventimeCompiler` | phase 3 |
| `eventimes.normalize(scope?)` | eventime | force une normalisation/compilation canonique | `Player -> Director.eventimeCompiler` | phase 3 |
| `timeline.getEventsAt(ms)` | lecture timeline | lecture stable des events a `ms` | `Player -> Director.timelineReader` | phase 5 |
| `timeline.getEventsBetween(startMs, endMs)` | lecture timeline | lecture stable intervalle | `Player -> Director.timelineReader` | phase 5 |
| `timeline.getNextEventAfter(ms)` | lecture timeline | prochain event strictement apres `ms` | `Player -> Director.timelineReader` | phase 5 |
| `timeline.resolveTimelineEndMs()` | lecture timeline | calcule la fin effective timeline | `Player -> Director.timelineReader` | phase 5 |
| `getState()` | observabilite | etat lisible du Player | `Player state facade` | existant |
| `subscribeTrace(listener)` | observabilite | abonnement traces runtime | `Player -> trace bus` | existant |
| `subscribeWarning(listener)` | observabilite | abonnement warnings runtime | `Player -> warning bus` | existant |

Notes de cadrage:

- `emit(event)` reste supporte en compatibilite de facade, mais les operations nommees `story/tracks/eventimes` deviennent la voie recommandee du domaine.
- les operations `tracks.*` et `eventimes.*` peuvent etre implementees comme sugar vers `emit(...)` tant que le contrat de sortie reste identique.

## Table unique des responsabilites runtime

| Module | Responsabilites non delegables | Ne doit pas faire |
| --- | --- | --- |
| `Player` | exposer API publique stable, valider preconditions host, router vers runtime interne, normaliser format de resultat | contenir la logique metier story/track/eventime, appliquer des commits de rendu, maintenir le journal canonique |
| `Director` | source de verite event/time, normalisation events, attribution `eventSeq`, gestion stories/tracks/eventimes, production commits ordonnes, tenue journal canonique | manipuler directement le DOM/node runtime, deleguer l ordre canonique a un module externe, court-circuiter les policies |
| `Renderer` | construire/detruire elements runtime, appliquer commits ordonnes par frame, executer rendu/media, remonter erreurs runtime privees | orchestrer la logique metier des stories, recompiler eventimes/tracks, ecrire le journal canonique |

## API interne (non publique) - regle de stabilite

Les interfaces internes suivantes ne font pas partie du contrat host et restent evolutives:

- `Director` internals: `normalizeEvent`, `assignEventSeq`, `dispatchStories`, `produceCommits`, `timelineReader`, `eventimeCompiler`
- `Renderer` internals: `applyCommitBatch`, `resolveRuntimeElement`, `component adapters`
- `Player` glue internals: mapping d erreurs, mapping traces, adaptations de format

Regle:

- changement interne autorise sans impact host si les commandes publiques et invariants restent respectes.

## Invariants transverses non negociables

1. Source de verite event

- tout event public passe par le `Director`
- `eventSeq` est toujours assigne par le `Director`

2. Journal canonique

- seul le `Director` ecrit le journal canonique
- ecriture apres normalisation uniquement

3. Frontiere rendu

- `Renderer` applique, il ne decide pas la logique metier
- retour `Renderer -> Director` limite aux erreurs privees

4. Determinisme

- meme entree + meme config + meme seed => meme ordre `eventSeq` et `commitSeq`
- tri stable obligatoire en cas d egalite temporelle

5. Traversal API

- aucune mutation metier directe via API interne depuis l host
- toutes les commandes publiques passent par la facade `Player`

6. Eventimes/tracks

- format auteur toujours normalise avant runtime
- ajout dynamique runtime append-only via commandes/events publics

7. Policies

- aucune regle critique en dur
- comportement `author/user` derive de configuration, pas de branches hardcodees

8. Erreurs

- espaces de codes distincts: `HOST_*`, `AUTHOR_*`, `RUNTIME_*`
- aucun code interne brut expose sans mapping stable host

9. Adresse runtime

- adressage composite conserve: `(storyInstanceId, itemId, targetId?)`
- pas d adressage implicite dependant du DOM

10. Compatibilite lifecycle

- `destroy()` idempotent
- `load()` remplace proprement la scene precedente

## Impact direct sur la suite du chantier

- Phase 2 doit definir le contrat `story.*` en restant dans cette frontiere.
- Phase 3 doit definir `tracks.*` et `eventimes.*` sans bypass `Director`.
- Phase 4 doit produire un compileur `author -> runtime` aligne sur ces invariants.

## Lien avec les specs existantes

- `10-api-host-v1.md`
- `06-runtime-contract.md`
- `02-story-model.md`
- `03-event-model.md`
- `04-eventime-model.md`
