# Player orchestration V1

## Statut

Reference V1 pour l'orchestration Player des composants runtime.

## Preambule - intention

Le Player orchestre le runtime sans porter de logique metier composant.

Objectifs:

- registre composants stable
- instanciation deterministic par `Perso`
- routage `update` unifie
- routage `move` enfant -> parent
- pilotage animation global (`play/pause/seek`)

## Portee

Ce document couvre:

- cycle de vie runtime Player/composants
- routing `move` global
- etats `mounted` / `detached`
- integration FLIP dans l'orchestration

## Hors perimetre V1

- gestion multi-scene dans une meme instance Player
- hot-reload dynamique de classes composants

## Dependances normatives

- `16-base-component-v1.md`
- `23-list-component-v1.md`
- `25-flip-runtime-core-v1.md`
- `24-runtime-log-policy-v1.md`

## Concepts

## Perso vs composant

- `Perso`: donnee declarative scene
- composant runtime: instance creee par le Player pour un `Perso`

Regle V1:

- 1 instance composant par `Perso` au `load(scene)`

## Etats de montage

- `mounted`: node rattache a un parent runtime
- `detached`: node non monte, conserve pour reuse runtime (ex: seek)

## Registre composants

API:

- `registerComponent(persoType, componentClass)`
- `overrideComponent(persoType, componentClass)`

Regles:

- avant `load(scene)` uniquement
- `register` deja present => warning + ignore
- `override` remplace explicitement

## Chargement scene

Au `load(scene)`:

1. parcourir les `Perso`
2. resoudre `componentClass` via `persoType`
3. instancier composant (si type connu)
4. appeler `init(initial)`
5. enregistrer node/runtime refs
6. appliquer `initial.move` via routeur `move`

Regle `initial.move`:

- au `load(scene)`, `initial.move` est normalise en placement `append`
- l'information de mode explicite est ignoree au montage initial

Type inconnu:

- skip instance
- warning auteur
- runtime global continue

## Registry runtime minimal

```ts
type RuntimeRegistry = {
  getComponentById: (persoId: string) => unknown | null
  getNodeById: (persoId: string) => unknown | null
  getListById: (persoId: string) => unknown | null
  getParentListId: (persoId: string) => string | null
  setParentListId: (persoId: string, parentListId: string | null) => void
  isMounted: (persoId: string) => boolean
  setMounted: (persoId: string, mounted: boolean) => void
}
```

## Routing update

Entree:

- `update({ persoId, eventId, eventSeq, action })`

Regles:

- action deja agregee et dedoublonnee
- Player route vers l'instance cible
- erreurs capturees et converties en warnings

## Routing move (global)

`move` est commun a tous les composants:

```ts
type MoveCommand = {
  parentId: string
  mode: 'auto' | 'first' | 'last' | 'append' | 'prepend' | number
  flip?: boolean
  reorder?: boolean
}
```

Responsabilite:

- routeur `move` cote Player runtime

Note de clarification:

- ne pas confondre `move.parentId` (insertion DOM enfant->parent) avec `targetId` utilise dans d'autres contrats de commit/adressage runtime

Sequence de resolution:

1. lire parent courant via registry
2. resoudre parent cible (`parentId`)
3. cas cible invalide/non-list => detach + warning
4. cas meme parent => repositionnement local
5. cas parent different => transfer source -> cible

## Cible list connue mais non montee

Regle V1:

- si la list cible existe mais n'est pas montee, operation executee en mode sans FLIP
- parentage logique mis a jour
- montage effectif lors de disponibilite du parent monte

## Orchestration FLIP + patch

Regle structurante:

- les patches pouvant impacter position/dimensions doivent etre pris en compte dans le calcul FLIP

Contrat V1:

- construire un `mutationPlan` unique par update touchee
- executer FLIP autour de ce `mutationPlan`
- `mutationPlan` inclut:
  - operations de structure (`move`, attach/detach/reorder)
  - patches layout-impactants

Regle critique:

- quand un meme update combine `move` et interpolation/patche(s) impactant layout, tout est execute dans la meme animation (pas de seconde passe separee)

Note:

- si incertitude sur impact layout, inclure le patch dans `mutationPlan` (safe default)

## Detachement transitionnel

Regle V1:

- un event public unique declenche la sortie (ex: `item:outro`)
- enchainement runtime:
  1. transition de sortie
  2. detachement effectif
  3. etat final `detached`

## Play / pause / seek

Regle V1:

- toute animation passe par le pipeline global
- `play/pause/seek` pilotent uniformement:
  - transitions FLIP
  - micro-animations texte

## Policy warnings

Appliquer `24-runtime-log-policy-v1.md`.

Minimum:

- warning type inconnu composant
- warning move cible invalide/non-list
- warning node introuvable

## Tests smoke recommandes

1. load scene: instanciation 1 composant par `Perso`
2. `initial.move` valide -> montage
3. `initial.move` invalide -> `detached` + warning
4. move local/reparent inter-list
5. target list non montee -> execution sans FLIP
6. update avec patch layout-impactant inclus dans `mutationPlan`
7. update combinant `move` + interpolation -> une seule animation composee
8. outro event unique -> detachement final
9. play/pause/seek pilotent FLIP et micro-animations
