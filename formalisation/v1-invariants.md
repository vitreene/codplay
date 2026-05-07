# Final V1 - invariants transverses

## Statut

Socle unique des invariants partages par les specs V1.

## Invariants structure

- `Scene.topLevelStories` est obligatoire et non vide en diffusion
- `Scene.initialStoryId` est obligatoire, existe dans `stories`, et appartient a `topLevelStories`
- `Story.listen` et `Scene.listen` sont obligatoires (peuvent etre `[]`)
- `Story.straps` et `Scene.straps` sont obligatoires comme proprietes et peuvent valoir `undefined`
- `tracks` est obligatoire en diffusion et peut etre `{}`

## Invariants execution

- ordre `listen`: `transform -> straps -> emit`
- ordre global: `listen -> transform -> straps -> emit -> persos`
- `listen.on` est unique par scope (`Story` ou `Scene`)
- dans une regle, les `straps` sont executes et attendus dans l'ordre de declaration
- erreur strap par defaut: continuation avec warning
- un seul master actif a la fois; le dernier active est prioritaire
- si master indisponible/inactif: fallback immediat sur ticker standard

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

## Invariants d'erreurs

- format minimal: `code` + `message`
- `RUNTIME_UNKNOWN` impose `details` (refs + contexte)
- la taxonomie des codes est centralisee dans `48-error-catalog-v1.md`
