# Contexte de session - 2026-04-02

Ce document capture l'etat de la reflexion pour pouvoir reprendre rapidement.

## Perimetre de travail

- focus principal: modele Scene / Story / Event / Eventime / Runtime
- focus secondaire: frontiere builder vs player
- sujet export/conversion: note mais non prioritaire a court terme

## Decisions actees

1. Orchestration globale

- architecture event-driven
- `Scene` peut recevoir/emette des events (I/O scene)
- `Scene` peut etre orchestree par un niveau parent (ex: `Chapter`, non formalise)

2. Scene I/O (vocabulaire V1)

- entrees: `scene:start`, `scene:stop`, `scene:param:set`, `scene:param:patch`
- sorties: `scene:ready`, `scene:end`, `scene:request-next`, `scene:error`

3. Stories actives

- plusieurs stories actives en parallele (mode nominal)
- transitions scenario additives par defaut
- arret de story explicite (pas de stop implicite)

4. Persos et instanciation

- un perso appartient a une seule story a la fois
- une instance de story duplique ses persos (pas de partage)
- convention IDs runtime:
  - `storyInstanceId`: `<storyId>#<n>`
  - `persoRuntimeId`: `<storyInstanceId>/<persoId>`
  - `strapRuntimeId` local: `<storyInstanceId>/<strapId>`
  - `strapRuntimeId` global: `global/<strapId>`
- compteur d'instance reinitialise au `scene:start`

5. Straps

- deux modes explicites:
  - global partage (etat commun)
  - local copie (etat separe)
- strap global: reset par defaut au `scene:start`

6. Eventime runtime

- `seek forward`: emet les cues franchis une fois
- `seek backward`: ne reemet pas automatiquement les cues deja tires
- `rewind`: rearme les cues
- `loop`: reemet les cues a chaque boucle

7. Replay utilisateur

- mode par defaut: `refaire`
- mode effectif (`refaire`/`revoir`) pilote par contexte runtime

8. RuntimeContext

- fourni par player/environnement apres compilation
- n'est ni dans `SceneDoc`, ni dans les valeurs de `CompiledScene`
- minimal V1:
  - `replayMode`: `refaire | revoir`
  - `locale` (optionnel)
  - `sessionKind`: `live | replay` (optionnel)
  - `inputProfile`: `web | mobile | kiosk` (optionnel)
  - `seed` (optionnel)
- mapping V1 vers scene:
  - vers `scene.params.runtime.*`
  - applique via `scene:param:set` avant `scene:start`
  - updates runtime via `scene:param:patch`

9. CompiledScene minimal V1

- manifeste minimal
- contrat scene I/O compile
- registres compiles (stories/persos/straps/medias/eventimeGroups)
- plans compiles (content/signal/time)
- scenario compile
- plan d'instanciation
- defaults runtime

10. API host minimale V1

- `load(compiledScene, runtimeContext?)`
- `start()`
- `stop(reason?)`
- `emit(event)`
- `setSceneParams(params)`
- `patchSceneParams(patch)`
- `getState()`
- `subscribeTrace(listener)`
- `destroy()`

## Point clarifie explicitement

- `load()` est une action du host/player, pas d'une scene vers une autre scene

## Note importante (non decidee)

- transition inter-scenes (niveau `Chapter`) hors scope pour l'instant
- emplacement de l'etat de transition (dans scene ou entre scenes): non tranche
- decision a prendre plus tard dans le cadre projet auteur

## Ou reprendre ensuite

Priorite recommandee:

1. details du contrat API host (codes erreurs, idempotence, lifecycle)
2. contrat scene I/O parent (schemas params, validation, erreurs)
3. format des diagnostics compilation/execution

Sujets reportes:

- export diffusion/legacy (hors priorite immediate)
