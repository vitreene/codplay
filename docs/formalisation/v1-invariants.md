# Final V1 - invariants transverses

## Statut

Socle unique des invariants partages par les specs V1.

## Invariants structure

- `Scene.rootStories` est obligatoire et non vide en diffusion
- `Scene.rootStories` designe les stories autorisees a la racine de la scene
- `Story.listen` et `Scene.listen` sont obligatoires (peuvent etre `[]`)
- une `Story` peut avoir plusieurs elements racine, chacun declare par son propre `move: '@root'` (`v1-perso-spec.md` 4bis)
- `Story.straps` et `Scene.straps` sont obligatoires comme proprietes et peuvent valoir `undefined`
- `tracks` est obligatoire en diffusion et peut etre `{}`
- le registre des tracks est fige apres `scene.init`
- le track `global` existe toujours
- chaque story dispose aussi par defaut d'un track `story.id`
- `Perso.name` est auteur-visible; `Perso.id` est runtime-canonique et immuable

## Invariants execution

- ordre `listen`: `transform -> straps -> emit`
- ordre global: `listen -> transform -> straps -> emit -> persos`
- `transform` remplace `event.data` et ne modifie pas `name`, `cascade`, `context` ou `meta`
- `listen.on` est unique par scope (`Story` ou `Scene`)
- dans une regle, les `straps` sont executes et attendus dans l'ordre de declaration
- erreur strap par defaut: continuation avec warning
- un seul master actif a la fois; le dernier active est prioritaire
- si master indisponible/inactif: fallback immediat sur ticker standard
- toutes les stories sont initialisees a `scene.init`
- tous les persos sont instancies a `init`
- `init`, placement DOM et `start` sont des phases distinctes
- le placement d'une story ne fixe pas l'ancre temporelle de ses `eventimes`
- `start` ancre les `eventimes` d'une story via le mecanisme existant d'offsets relatifs
- garde-fous runtime par defaut: `maxEventsPerTick=1000`, `maxCascadeDepth=16`
- depassement d'un garde-fou: coupure de la propagation excedentaire + warning trace
- les elements peuvent quitter le DOM sans etre purges du runtime avant l'arret definitif de la scene
- la resolution same-tick est une policy modulaire et facultative; elle n'est pas une obligation du coeur independamment du renderer

## Invariants de donnees

- `transform` partage la meme entree runtime que `strap`
- `transform` retourne de la data uniquement
- `strap` retourne `events`, `update`, `effects` (ou `void`)
- `effects` ne sont jamais rejoues au `seek`
- `applyAtMs` est obligatoire sur `RuntimeEvent`
- les eventimes portables de story utilisent des offsets relatifs (`startAt`)
- le runtime transige sur les `id`, pas sur les `name`
- les metadata auteur normatives d'un track sont `active` et `role`

## Invariants propagation

- la portee d'un event reste locale story ou globale scene selon `cascade`
- `scene.listen` recueille les events scene-level et `effects` sans ciblage explicite de story
- aucun event n'est adresse a une `Story` cible par identifiant
- les events de controle track sont toujours scene-level

## Invariants de diffusion

- `CompiledScene` est immuable au runtime
- meta `CompiledScene`: `schemaVersion` + `createdAt`
- `hash` n'est pas une meta `CompiledScene`; il est reserve a la policy ressource
- `tracks` reste une orchestration scene-level et ne remplace pas la portabilite des eventimes story-level
- `Scene.rootStories` porte une structure d'autorisation scene-level, pas une temporalite implicite
- si aucun track explicite n'est indique pour un event de story, le fallback est le track `story.id`
- si `story.trackId` existe, il devient le fallback prioritaire des events de story

## Invariants d'erreurs

- format minimal: `code` + `message`
- `RUNTIME_UNKNOWN` impose `details` (refs + contexte)
- la taxonomie des codes est centralisee dans `v1-error-catalog.md`
- l'unicite effective des `id` d'elements est verifiee a `scene.init` avec warning en cas de collision
