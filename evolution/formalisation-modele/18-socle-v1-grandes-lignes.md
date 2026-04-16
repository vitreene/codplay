# Socle V1 - grandes lignes

## Statut

Document de cadrage macro V1.
Il fixe les decisions principales deja validees avant la reecriture detaillee des specs et du player.

Etat courant:

- consolide dans `plan-consolide.md`
- conserve comme note de transition

## Objectif

Stabiliser un socle deterministe et event-based pour le Player, puis derouler ensuite:

1. la reecriture detaillee des specs
2. la reecriture du player runtime
3. l'ouverture progressive du sujet scripting auteur

## Vocabulaire

- `Player`: systeme global compose de `Director + Renderer + Timer + Ticker`
- `Director`: orchestration eventielle et journal canonique
- `Renderer`: execution rendu/media a partir de commits deja resolus
- `Timer`: source de temps commune
- `Ticker`: boucle(s) de tick consommant le `Timer`

## Perimetre V1

- socle deterministe prioritaire
- event public comme mecanisme principal de coordination
- frontiere nette orchestration vs rendu
- scripting auteur reporte (sujet ouvert, non fige)

## Architecture cible (macro)

Flux principal:

1. sources d'events publics -> `Director`
2. `Director` normalise, ordonne, met a jour state/story, produit commits
3. `Director` envoie des commits au `Renderer` (one-way)
4. `Renderer` applique les commits par frame et retourne uniquement les erreurs via canal API prive

Contraintes:

- pas de bus prive story->story
- retour `Renderer -> Director` uniquement pour erreur
- `Timer` partage entre `Director` et `Renderer`

## SceneDoc et frontieres

- en phase socle V1, le modele exploite reste deterministe
- le conteneur de montage est hors `SceneDoc` (fourni par le host)
- `Perso` cote `SceneDoc` reste descriptif (`type`, `initial`, `actions`, refs)
- `node` et media pilotable (`play/pause/seek`) sont runtime
- `Story.init` V1 = phase runtime standard non scriptable

Note:

- la presence future de code auteur dans une scene est admise, mais hors cadre de ce socle V1

## Story, listen, straps

### Story state

- `Story.state` est runtime-only
- le state est conserve par defaut pendant `pause/seek`

### Listen

- `listen` V1 est declaratif et compilable
- mapping possible `1 -> N`
- peut renommer et enrichir les donnees
- sorties `listen` = tokens internes story (non publics)

### Straps

- strap sans state propre
- signature conceptuelle: `(eventOrToken, context) -> { statePatch, events, sideEffects }`
- `context` reste une note ouverte (a preciser plus tard)

## Events et ordonnancement

- tout event est public au niveau scene
- filtrage = responsabilite des stories
- `eventId`: conserve s'il existe, sinon genere par le `Director`
- `eventSeq`: monotone global, source d'ordre canonique du journal
- a egalite temporelle, `eventSeq` tranche

Regle specifique tracks:

- un `tracks:set` de sequence `N` n'affecte que les events de sequence `> N`

## Eventimes et tracks

- format auteur recursif possible
- compilation canonique par track
- ajout dynamique au runtime autorise en append-only
- ajout dynamique uniquement via events publics (pas de mutation directe externe)
- activation/desactivation de track supportee

Event canonique V1:

- `tracks:set`
- payload: `{ activate: string[]; deactivate: string[]; reason?: string }`

Validation V1:

- track inconnue = erreur auteur
- meme `trackId` dans `activate` et `deactivate` = erreur sur cette track
- traitement best-effort ordonne sur le reste

Semantique V1:

- desactivation de track = hard gate immediat
- pas de rattrapage retroactif a la reactivation

## Replay, cache, seek

### Journal canonique

- source de verite replay = journal du `Director`
- ecriture apres normalisation
- journalise tous les events publics traites
- tokens internes non journalises (derivables)

### Modes replay

- `refaire`: nouvelle execution interactive
- `revoir`: relecture journalisee

En `revoir` V1:

- straps generateurs desactives
- side-effects externes bloques

### Invalidation cache

- invalidation possible selon events/choix auteur (ex: langue)
- en V1, suppression physique des entrees invalides
- `eventSeq` et `commitSeq` continuent de croitre (pas de reset)

### Seek et reset

- `seek backward` par defaut = render-only, sans rollback logique
- rollback logique complet via event public `scene:replay-from-zero`
- optimisation: story en etat terminal peut etre exclue de recalcul rendu

## Story end

- fin de story via event explicite `story:end` (idealement emis par la story)
- etat terminal sticky
- reactivation seulement via reset explicite ou replay depuis zero

## Commit contract Director -> Renderer

- commits deja resolus et ordonnes
- `commitSeq` monotone global
- `applyAtMs` base sur le `Timer` commun
- commit en retard: applique a la prochaine frame
- si buffer non vide: report au tick suivant en conservant l'ordre
- au tick renderer: appliquer tous les commits prets
- application atomique par frame
- `causeEventId` autorise pour debug

Payload commit:

- lot d'operations ciblees (patch/diff)
- payload action considere opaque par le `Director`
- interpretation par composant/type cible cote `Renderer`
- logique composee (ex: `list` + mesure/FLIP) portee par les composants, pas par le `Director`

## Configurations et policies

- dossier de configuration dedie, incluant une section `policies`
- aucune regle critique en dur
- couches de priorite:
  1. defaults framework
  2. preset environnement (`author`/`user`)
  3. config projet/scene
  4. patch runtime

Rappels:

- mode `author` et mode `user` sont des presets de config, pas des if hardcodes

## Contraintes implementation cible

- les timers legacy sont proscrits pour la cible finale
- execution cible: boucle dediee type `rAF + queue + commit`
- details d'API tierce (ex: animejs) hors spec macro

## Regles ecriture TypeScript (V1)

- facade d'API formelle requise au niveau `Player` (API host)
- communication interne inter-modules autorisee en mode direct si cela simplifie/performe mieux
- toutes les fonctions et toutes les classes sont documentees
- methodes `register*` reservees aux besoins d'extensibilite explicites
- les noms de fonctions sont de preference symboliques et courts
- preferer les constantes et la configuration aux valeurs en dur
- les fonctions sont verifiees par des tests smoke

## Hors perimetre immediat

- specification complete de l'API de scripting auteur
- details fins des guard internals
- details d'implementation tierce

## Etape suivante

Utiliser ce document comme reference macro pour:

1. reecrire `plan-consolide.md` et les specs detaillees avec le nouveau vocabulaire (`Director`, `Renderer`)
2. aligner les contrats types/runtime
3. preparer la reecriture du player actuel vers un renderer pilote par commits
