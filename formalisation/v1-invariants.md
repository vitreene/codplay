# Final V1 - invariants transverses

## Statut

Socle unique des invariants partages par les specs V1.

## Invariants structure

- `Scene.rootStories` est obligatoire et non vide en diffusion
- `Story.listen` et `Scene.listen` sont obligatoires (peuvent etre `[]`)
- `Story.entries` est obligatoire dans le contrat et peut valoir `[]`
- `Story.straps` et `Scene.straps` sont obligatoires comme proprietes et peuvent valoir `undefined`
- `tracks` est obligatoire en diffusion et peut etre `{}`

## Invariants execution

- ordre `listen`: `transform -> straps -> emit`
- ordre global: `listen -> transform -> straps -> emit -> persos`
- `transform` remplace `event.data` et ne modifie pas `name`, `cascade`, `context` ou `meta`
- `listen.on` est unique par scope (`Story` ou `Scene`)
- dans une regle, les `straps` sont executes et attendus dans l'ordre de declaration
- erreur strap par defaut: continuation avec warning
- un seul master actif a la fois; le dernier active est prioritaire
- si master indisponible/inactif: fallback immediat sur ticker standard
- tous les persos sont instancies a `init`
- `init`, `mount` et `start` sont des phases distinctes
- `mount` ne fixe pas l'ancre temporelle d'une story
- `start` ancre les `eventimes` d'une story via le mecanisme existant d'offsets relatifs
- garde-fous runtime par defaut: `maxEventsPerTick=1000`, `maxCascadeDepth=16`
- depassement d'un garde-fou: coupure de la propagation excedentaire + warning trace

## Invariants de donnees

- `transform` partage la meme entree runtime que `strap`
- `transform` retourne de la data uniquement
- `strap` retourne des events (ou `void`), pas de payload metier final
- `applyAtMs` est obligatoire sur `RuntimeEvent`
- les eventimes portables de story utilisent des offsets relatifs (`startAt`)

## Invariants propagation

- bubbling enfant -> parent automatique
- `cascade: true` remonte jusqu'a `Scene` sans interception intermediaire
- multi-parent story: warning, premier parent gagne

## Invariants de diffusion

- `CompiledScene` est immuable au runtime
- meta `CompiledScene`: `schemaVersion` + `createdAt`
- `hash` n'est pas une meta `CompiledScene`; il est reserve a la policy ressource
- `tracks` reste une orchestration scene-level et ne remplace pas la portabilite des eventimes story-level
- `Scene.rootStories` porte une structure de montage scene-level, pas une temporalite implicite

## Invariants d'erreurs

- format minimal: `code` + `message`
- `RUNTIME_UNKNOWN` impose `details` (refs + contexte)
- la taxonomie des codes est centralisee dans `v1-error-catalog.md`
