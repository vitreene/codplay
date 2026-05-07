# API host V1 - facade de pilotage Player

## Statut

Reference V1 minimale pour l'integration du Player dans une application hote.

Note de lecture V1 actuelle:

- document de transition (non normatif face au corpus `31-38` et `43-50`)
- la terminologie historique `events publics` se lit `events runtime`

Cette API pilote un `Player` compose de:

- `Director`
- `Renderer`
- `Timer`
- `Ticker`

## Objectif

Permettre a l'hote de:

- charger une scene compilee
- demarrer / pauser / reprendre / stopper
- injecter des events publics
- observer l'etat et les traces
- detruire proprement l'instance

L'API reste identique entre presets `author` et `user`.

## Etats de fonctionnement

- `idle`: aucune scene chargee
- `loaded`: scene chargee, non demarree
- `running`: scene en execution
- `paused`: execution suspendue
- `stopped`: execution arretee, scene encore chargee
- `destroyed`: instance liberee

## Commandes V1

### `load(compiledScene, mountTarget, runtimeConfig?)`

Role:

- charge la scene compilee
- initialise le Player avec la configuration d'execution

Regles:

- `mountTarget` est fourni par l'hote (hors `SceneDoc`)
- `runtimeConfig` alimente policies et presets (`author`/`user`)
- remplace proprement la scene precedente si necessaire

### `start()`

Role:

- demarre l'execution depuis `loaded` ou `stopped`

### `pause()`

Role:

- suspend l'execution sans perdre l'etat runtime

### `resume()`

Role:

- reprend l'execution depuis `paused`

### `stop(reason?)`

Role:

- arrete l'execution courante

### `emit(event)`

Role:

- injecte un event public dans le `Director`

Regles:

- event normalise et ordonne dans le flux canonique
- `eventId` conserve s'il existe, sinon genere
- `eventSeq` assigne par le `Director`

### `replayFromZero(reason?)`

Role:

- raccourci de pilotage pour emettre `scene:replay-from-zero`

Note:

- equivalent possible via `emit({ name: 'scene:replay-from-zero', ... })`

### `getState()`

Role:

- retourne un etat lisible du Player

Contenu minimum:

- `status`
- `sceneId?`
- stories actives
- compteurs runtime utiles (`eventSeq`, `commitSeq`) si exposes par policy

### `subscribeTrace(listener)`

Role:

- ecouter les traces runtime

### `subscribeWarning(listener)`

Role:

- ecouter les warnings runtime

### `destroy()`

Role:

- libere scene et ressources runtime

Regle:

- idempotent

## Commandes via events publics

Le pilotage metier passe preferentiellement par `emit(event)`.

Events canoniques V1 deja fixes:

- `tracks:set`
  - payload: `{ activate: string[]; deactivate: string[]; reason?: string }`
- `scene:replay-from-zero`

## Contrat de resultat des commandes

Format recommande:

- succes: `{ ok: true, warnings?: [...] }`
- echec: `{ ok: false, error: { code, message, details? } }`

## Codes d'erreur minimaux

- `HOST_INVALID_STATE`
- `HOST_SCENE_INVALID`
- `HOST_MOUNT_TARGET_INVALID`
- `HOST_DESTROYED`

## Erreurs auteur minimales exposees

- `AUTHOR_TRACK_UNKNOWN`
- `AUTHOR_TRACK_CONFLICT_ACTIVATE_DEACTIVATE`
- `AUTHOR_EVENT_INVALID`

La reaction runtime depend de la policy d'execution active.

## Idempotence minimale

- `destroy()` idempotent
- `load()` remplace proprement la scene precedente
- `stop()` peut etre no-op hors `running` selon policy

## Policies et configuration

`runtimeConfig` s'appuie sur un dossier de configuration dedie.

Couches de priorite:

1. defaults framework
2. preset environnement (`author` / `user`)
3. config projet/scene
4. patch runtime

Regle:

- aucune decision critique en dur

## Invariants V1

- `mountTarget` reste externe au modele scene
- `CompiledScene` reste la source compilee
- le `Director` tient le journal canonique replay
- le `Renderer` ne retourne vers `Director` que les erreurs (canal prive)
- l'API host ne bypass pas le contrat event/commit interne

## Sequence type

1. `load(...)`
2. `start()`
3. `emit(...)` (ex: `tracks:set`)
4. `pause()` / `resume()` selon besoin
5. `replayFromZero()` ou `emit(scene:replay-from-zero)` si necessaire
6. `stop()`
7. `destroy()`
