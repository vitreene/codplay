# Plan consolide - socle V1 Player event-based

## Objectif

Figer une base V1 deterministe pour le Player, avant d'ouvrir le sujet scripting auteur.

Ce plan consolide la direction de reference pour:

- la reecriture des specs detaillees
- la reecriture du player runtime
- la stabilisation des contrats entre composants

## Perimetre V1

Priorites:

1. socle event-based deterministe
2. separation claire orchestration/rendu
3. replay reproductible
4. policies par configuration

Hors perimetre immediat:

- API de scripting auteur complete
- details d'implementation des bibliotheques tierces
- micro-details de guards internes

## Vocabulaire de reference

- `Player`: systeme global
- `Director`: orchestration eventielle, state, journal canonique
- `Renderer`: execution rendu/media a partir de commits resolus
- `Timer`: source de temps commune
- `Ticker`: boucle(s) de tick consommant le `Timer`

Composition cible:

- `Player = Director + Renderer + Timer + Ticker`

## Principes d'architecture

1. Event public

- tout event est public et visible a l'echelle scene
- pas de canal prive story->story
- le filtrage est de la responsabilite des stories

2. Frontiere Director/Renderer

- flux principal one-way: `Director -> Renderer`
- retour `Renderer -> Director`: erreurs uniquement, via canal API prive
- le `Renderer` n'orchestre pas la logique metier des stories

3. Temps commun

- `Director` et `Renderer` partagent le meme `Timer`
- les tickers restent distincts mais indexes sur ce temps commun

4. Determinisme

- ordre canonique base sur des sequences monotones
- aucun comportement critique hardcode hors policy/config

## Frontiere SceneDoc/runtime

- le socle V1 exploite un modele deterministe
- le conteneur de montage est hors `SceneDoc` (host)
- `Perso` dans `SceneDoc` est descriptif (`type`, `initial`, `actions`, refs)
- `node` et media pilotable (`play/pause/seek`) sont runtime
- `Story.init` V1 est une phase runtime standard non scriptable

Note:

- l'introduction de code auteur dans la scene est admise ensuite, mais non figee en V1

## Story model V1

### State

- `Story.state` est runtime-only
- en `pause/seek`, le state est conserve par defaut

### Fin de story

- fin explicite via event public `story:end` (idealement emis par la story)
- etat terminal sticky
- reactivation uniquement par reset explicite ou replay depuis zero

### Listen

- `listen` est declaratif et compilable
- supporte un mapping `1 -> N`
- peut renommer et enrichir les donnees
- produit des tokens internes story (non publics)
- tokens internes non journalises (derivables)

### Emission

- un token interne peut emettre un event public
- emission immediate dans le meme cycle `Director`

## Strap model V1

- strap sans state propre
- signature conceptuelle:
  - `(eventOrToken, context) -> { statePatch, events, sideEffects }`
- `context` est maintenu comme note ouverte (detail a figer plus tard)

Replay `revoir`:

- straps generateurs desactives
- side-effects externes bloques

## Event model V1

### Identite

- `eventId` conserve s'il existe
- sinon genere par le `Director`

### Ordre

- `eventSeq` monotone global
- source de verite pour l'ordre canonique
- a egalite temporelle, `eventSeq` tranche

### Journal canonique

- ecriture cote `Director`
- ecriture apres normalisation
- tous les events publics traites sont journalises

## Eventime/track model V1

- format auteur recursif possible
- compilation canonique par track
- ajout dynamique runtime autorise en append-only
- ajout dynamique uniquement via events publics

### Controle de tracks

Event canonique:

- `tracks:set`
- payload: `{ activate: string[]; deactivate: string[]; reason?: string }`

Validation:

- track inconnue: erreur auteur
- meme `trackId` dans `activate` et `deactivate`: erreur sur cette track
- traitement best-effort ordonne sur le reste

Semantique:

- desactivation de track = hard gate immediat
- pas de rattrapage retroactif a la reactivation
- un `tracks:set` de sequence `N` n'affecte que les events `> N`

## Replay, cache, seek

### Modes

- `refaire`: nouvelle execution interactive
- `revoir`: relecture des events journalises

### Cache

- cache de lecture autorise
- invalidation possible selon events/choix auteur (ex: changement de langue)
- en V1: suppression physique des entrees invalides
- `eventSeq` et `commitSeq` continuent de croitre apres invalidation

### Seek

- `seek backward` par defaut: render-only
- pas de rollback logique en mode state preserve
- rollback logique complet via event public `scene:replay-from-zero`
- optimisation: une story terminale sticky peut etre exclue de recalcul rendu

## Contrat commit Director -> Renderer

### Contract minimal

- commits deja resolus et ordonnes
- `commitSeq` monotone global
- `applyAtMs` base sur le `Timer` commun
- `causeEventId` autorise pour debug

### Regles d'application

- commit en retard: applique a la prochaine frame
- si buffer non vide: report au tick suivant en conservant l'ordre
- au tick renderer: appliquer tous les commits prets
- application atomique par frame

### Adresse de cible

- adressage composite:
  - `(storyInstanceId, itemId, targetId?)`

### Payload

- lot d'operations ciblees (patch/diff)
- payload d'action opaque pour le `Director`
- interpretation par composant/type cote `Renderer`
- logique specialisee (ex: list + mesure/FLIP) portee par les composants

## Guards runtime (niveau macro)

- garde-fou de cycle (ex: `maxEventsPerCycle`) supporte
- depassement traite selon policy d'execution
- separation claire entre guards runtime et operations metier dans l'organisation du code

## Configuration et policies

### Dossier de configuration

- un dossier dedie centralise la configuration
- une section `policies` est obligatoire dans cette configuration

### Couches de priorite

1. defaults framework
2. preset environnement (`author` / `user`)
3. config projet/scene
4. patch runtime

Regle:

- aucune regle critique en dur
- `author`/`user` sont des presets de config, pas des branches hardcodees

## Regles code TypeScript V1 (recommandees)

Portee:

- ces regles s'appliquent a tout le projet TypeScript
- elles sont des guidelines de reference en V1

Regles:

- la facade d'API formelle est requise au niveau `Player` (API host)
- a l'interieur du `Player`, la communication inter-modules peut etre plus directe et orientee performance
- V1 est canonique: aucune couche de retro-compatibilite n'est conservee
- pour les composants runtime/facades, preferer les classes aux fonctions
- ne pas ajouter de factory de compatibilite autour des classes cibles
- toutes les fonctions et toutes les classes sont documentees
- utiliser `register*` seulement quand c'est utile pour l'extensibilite (non obligatoire partout)
- les noms de fonctions sont de preference symboliques et courts
- preferer les constantes et la configuration aux valeurs en dur
- les fonctions sont verifiees par des tests smoke
- les tests smoke sont organises en sous-ensembles par sujet

Organisation interne des classes:

- methodes metier critiques d'abord
- methodes contextuelles (trace, listeners, telemetrie, debug) ensuite

## Contraintes implementation cible

- `setTimeout` et `setInterval` sont proscrits pour la cible finale
- execution cible: boucle dediee `rAF + queue + commit`
- details d'API tierce hors spec macro

## Trajectoire de reecriture

Ordre recommande:

1. aligner les specs detaillees (`02`, `03`, `04`, `06`, `10`, `11`)
2. aligner les types runtime sur `Director` et `Renderer`
3. transformer le player actuel en `Renderer` pilote par commits
4. ajouter le `Director` comme orchestrateur canonique des events/journal
