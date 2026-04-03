# API host V1

## Statut

Version de reference V1 pour l'API d'integration du player dans une application hote.

## 1) Idee simple

L'application hote doit pouvoir:

- charger une scene
- la demarrer et l'arreter
- envoyer des events/parametres
- lire l'etat courant
- ecouter les traces et warnings
- liberer les ressources

Le but est d'avoir la meme API en mode normal et en mode debug.

## 2) Etats de fonctionnement

Noms techniques proposes:

- `idle`: aucune scene chargee
- `loaded`: scene chargee, pas encore demarree
- `running`: scene en lecture
- `stopped`: scene arretee mais encore chargee
- `destroyed`: instance player liberee

## 3) Commandes V1

## 3.1 `load(compiledScene, mountTarget, runtimeContext?)`

Role:

- charge la scene compilee
- prepare les parametres initiaux depuis `runtimeContext`
- valide les modules necessaires

Regles:

- `mountTarget` est fourni par l'hote (hors `SceneDoc`)
- les types de perso inconnus sont ignores avec warning (pas de blocage)
- si une scene etait deja chargee, elle est remplacee proprement

## 3.2 `start()`

Role:

- demarre la scene chargee

Regles:

- valide depuis `loaded` ou `stopped`
- invalide depuis `idle` ou `destroyed`

## 3.3 `stop(reason?)`

Role:

- arrete la lecture de la scene courante

Regles:

- valide depuis `running`
- depuis un autre etat: no-op autorise

## 3.4 `emit(event)`

Role:

- envoie un event externe au bus scene

Regles:

- event ordonne de facon deterministe avec les autres sources
- invalide si aucune scene n'est chargee

## 3.5 `setSceneParams(params)`

Role:

- remplace l'etat des params scene (equivalent `scene:param:set`)

## 3.6 `patchSceneParams(patch)`

Role:

- applique une mise a jour partielle (equivalent `scene:param:patch`)

## 3.7 `dispatchTechnicalEvent(event)`

Role:

- transmet un evenement technique aux modules actifs

Exemples V1:

- `viewport:resize`
- `viewport:orientation`
- `viewport:safe-area`

## 3.8 `getState()`

Role:

- retourne un etat lisible de la scene

Contenu minimum:

- etat API (`idle/loaded/running/stopped/destroyed`)
- stories actives
- node scenario courant
- contexte scene courant

## 3.9 `subscribeTrace(listener)`

Role:

- ecouter les traces runtime

## 3.10 `subscribeWarning(listener)`

Role:

- ecouter les warnings runtime

## 3.11 `destroy()`

Role:

- libere scene et ressources runtime

Regles:

- idempotent (peut etre appele plusieurs fois)

## 4) Regles d'idempotence

- `destroy()` est idempotent
- `stop()` est no-op hors `running`
- `load()` remplace proprement la scene precedente

## 5) Format de resultat (commande)

Format simple recommande:

- succes: `{ ok: true, warnings?: [...] }`
- echec: `{ ok: false, error: { code, message } }`

## 6) Codes d'erreur minimum

- `HOST_INVALID_STATE`
- `HOST_SCENE_INVALID`
- `HOST_MOUNT_TARGET_INVALID`
- `HOST_DESTROYED`

## 7) Warnings minimum

- `W_MODULE_TYPE_NOT_FOUND`
- `W_TARGET_FORBIDDEN_BY_ROUTE`
- `W_TARGET_NOT_FOUND`
- `W_CMD_REJECTED`

## 8) Sequence type

1. `load(...)`
2. `start()`
3. `emit(...)`
4. `patchSceneParams(...)`
5. `stop()`
6. `destroy()`

## 9) Invariants V1

- `mountTarget` reste externe au modele de scene
- `CompiledScene` reste source de verite compilee
- les commandes sont predictibles selon l'etat courant
- les warnings n'arretent pas la scene
