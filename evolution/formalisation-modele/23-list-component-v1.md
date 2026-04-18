# List component V1

## Statut

Reference V1 pour le composant `list`.

## Preambule - intention

`list` est un composant conteneur qui maintient l'ordre de ses enfants et applique la logique de placement/replacement via `move`.

Point structurant V1:

- le parent ne "demande" pas ses enfants
- c'est l'enfant qui designe son parent via `move.parentId`

## Portee

Ce document couvre:

- le role du composant `list` dans le modele enfant -> parent
- la logique de placement/reorder/transfer
- l'orchestration FLIP source/cible
- les regles seek pendant transition `move`

## Hors perimetre V1

- virtualisation avancee tres gros volumes
- strategie multi-colonnes/masonry
- modes auteur avances de navigation edition

## Dependances normatives

- `16-base-component-v1.md`
- `17-user-events-emit-v1.md`
- `21-text-micro-animations-v1.md`
- `25-flip-runtime-core-v1.md`
- `06-runtime-contract.md`

## Identite composant

- `persoType`: `list`
- 1 instance composant par `Perso` de type `list`

## Rendu DOM de reference

Fragment DOM cible:

```html
<section class="list-component">
  <ul class="list-items"></ul>
</section>
```

Regles:

- `render()` retourne le root du composant
- le composant conserve ses references internes en state (pas d'adressage par attributs DOM)
- `list` ne cree pas les enfants metier; il attache des nodes enfants deja resolues par `persoId`

## Modele enfant -> parent

Regles V1:

- `move` est valable pour tous les composants
- `move` est le mode d'insertion/replacement dans le DOM runtime
- `parentId` designe le composant parent cible
- un composant peut exister detache (sans parent effectif)

Etat de montage:

- `mounted`: node rattache a un parent list
- `detached`: node conserve hors arbre monte pour reuse runtime (notamment seek)

Cas invalides:

- `parentId` invalide ou non-list => action ignoree + warning auteur + composant detache

## Donnees d'entree auteur (list)

## initial

Champs supportes:

- `id?`, `className?`, `style?`, `attr?` (sur root)
- `config?`:
  - `reorderOnMove` (defaut `true`)
  - `reorderOnAdd` (defaut `true`)
  - `reorderOnRemove` (defaut `true`)
- `move?`: montage initial via `parentId` (optionnel, semantique append)

Important:

- `children` n'existe pas dans le contrat list V1

## actions

Actions list supportees:

- patch base root: `style`, `className`, `attr`
- `move` si la list elle-meme doit se placer dans une list parente

Regle `initial.move`:

- `initial.move` sert uniquement a definir le parent de montage initial
- normalisation en `append`
- `mode` eventuel ignore au chargement

Type recommande:

```ts
type ListMoveMode = 'auto' | 'first' | 'last' | 'append' | 'prepend' | number

type MoveCommand = {
  parentId: string
  mode: ListMoveMode
  flip?: boolean
  reorder?: boolean
}

type ListAction = {
  style?: Record<string, unknown>
  className?: string | { add?: string; remove?: string }
  attr?: Record<string, unknown>
  move?: MoveCommand
}
```

## emit

`emit?` suit `17-user-events-emit-v1.md`.

Regles:

- listeners attaches au `root` au `init`
- aucun event interne emis pendant `update`

## Semantique move appliquee par list

## Resolution de parent

- `move.parentId` designe la list parente cible
- si la cible est differente du parent courant => transfer source -> cible
- si la cible est identique au parent courant => repositionnement local

## Modes

- `auto`: repositionnement visuel/trigger FLIP local
- `first` / `last`: placement relatif persistant
- `append` / `prepend`: placement relatif non persistant
- `number`: placement absolu (index clamp `[0..n]`)

## Conflits

- plusieurs `move` meme item/meme tick => anomalie auteur
- resolution: derniere operation gagne
- warning auteur unique par item/tick
- si derniere operation invalide: serie ignoree

## Persistance

- operation sur l'item lui-meme => nouvelle regle remplace l'ancienne
- item affecte indirectement => persistance conservee
- `mode:auto` sur item => efface persistance `first/last`
- en transfer inter-list, persistance ne suit pas l'item

## Reorder policy

Defauts instance:

- `reorderOnMove=true`
- `reorderOnAdd=true`
- `reorderOnRemove=true`

Override local:

- `move.reorder=false` autorise
- en conflit `mode` vs `reorder:false`, `mode` prime (regle actuelle)

## Transfer inter-list

Sequence canonique:

1. detach source
2. reparenting node enfant
3. attach cible

Regles:

- FLIP source + cible par defaut
- exception ponctuelle via `flip:false`
- si la list cible existe mais n'est pas montee, transfer execute sans FLIP

## Detachement transitionnel (V1)

Cas cible:

- retrait visuel d'un composant avec animation de sortie, puis detachement effectif

Contraintes:

- le node reste disponible pendant la transition de sortie
- detachement final laisse le composant en etat `detached` (node conserve pour reuse/seek)

Regle V1:

- utiliser un event public unique de sortie
- cet event declenche une chaine runtime determinee:
  1. demarrage transition de sortie
  2. maintien temporaire du node pendant la transition
  3. detachement effectif en fin de transition
  4. passage en etat `detached` (node conserve pour seek/reuse)

Justification:

- minimiser le cout operationnel et la volumetrie d'events publics
- eviter la coordination fragile entre deux events distincts

Regle transversale deja validee:

- interruption par nouvelle transition possible, reprise depuis etat courant

## Contrat FLIP

`list` ne marque pas les nodes DOM pour FLIP.

Trigger explicite:

```ts
type ListFlipTrigger = {
  listId: string
  eventId: string
  eventSeq: number
  movedChildId: string
  reason: 'local-move' | 'transfer-in' | 'transfer-out' | 'auto'
  animation?: {
    durationMs?: number
    easing?: string
    trajectory?: 'linear' | 'curve'
  }
  entries: { childId: string; nodeRef: unknown }[] // touched set
  mutate: () => void
}
```

Execution:

- delegation via `ListFlipBridge.run(trigger)`
- bridge relie ensuite `createFlipEngine.run(...)`
- pipeline animation global (`animejs` via adapter runtime)
- traces/logs suivent `24-runtime-log-policy-v1.md`

Note importante:

- les matrices transform sont utilisees pour le calcul FLIP interne uniquement
- `animejs` n'anime pas la propriete `matrix`; les transitions envoyees restent sur des canaux compatibles (`x`, `y`, `width`, `height`)
- `trajectory` est supportee (`linear` par defaut, `curve` optionnelle) selon la spec FLIP core

Regles list V1:

- le calcul `width/height` est toujours actif
- le calcul matrice de transformation (parent/target) est toujours actif
- ces points ne sont pas exposes comme options auteur dans `ListFlipTrigger`

Note implementation:

- si le moteur FLIP conserve des flags bas niveau (`includeSize`, `includeTransformMatrix`), ils restent internes au runtime et ne font pas partie du contrat list V1

## Seek pendant transition move (V1)

Regles:

- `pause`: suspend la transition active via pipeline animation global
- `play`: reprend via pipeline animation global
- `seek`: interrompt la transition active, capture l'etat courant, relance vers l'etat cible du seek

Alignement:

- meme logique que les micro-animations texte

## Comportement runtime

## constructor(input)

- initialise refs, model, policies, bridge FLIP, registry runtime

## init(initial)

1. construit fragment `root/items`
2. applique patch base initial
3. attache `emit` via `handleEvent`

## render()

- retourne `root`

## update({ persoId, eventId, eventSeq, action })

Regle d'execution:

- pas d'ordre dur "move puis patch" par defaut
- construction d'un `mutationPlan` unique incluant move + patch(es) layout-impactants
- execution dans une seule animation composee quand interpolation demandee

Regles:

- action invalide ignoree + warning dedoublonne
- pas d'event interne pendant update

## Registry runtime requis

`list` depend d'un registry minimal:

- `getListById(persoId)`
- `getPersoNodeById(persoId)`
- `getParentListId(persoId)`
- `setParentListId(persoId, parentListId | null)`

## Policy d'erreur

Regle generale:

- runtime permissif
- erreur locale capturee, warning auteur, runtime global continue

Warnings recommandes:

- `RUNTIME_LIST_INIT_FAILED`
- `RUNTIME_LIST_UPDATE_FAILED`
- `RUNTIME_LIST_NOT_INITIALIZED`
- `RUNTIME_LIST_MOVE_TARGET_NOT_FOUND`
- `RUNTIME_LIST_MOVE_TARGET_NOT_LIST`
- `RUNTIME_LIST_MOVE_COMPONENT_DETACHED`
- `AUTHOR_LIST_MOVE_CONFLICT_SAME_TICK`
- `AUTHOR_LIST_MOVE_INVALID_SERIES_DROPPED`

## Invariants V1

- aucun champ `children` dans le contrat list
- `move` objet unique avec `parentId`
- parent designe par l'enfant, jamais l'inverse
- aucun marquage de nodes pour FLIP
- FLIP via trigger explicite + bridge runtime
- ordre runtime deterministe (inputs egaux => meme resultat)

## Exemple auteur

```ts
{
  id: 'list-a',
  type: 'list',
  initial: {
    className: 'gallery-list'
  },
  actions: {
    'list-a:to-main': {
      move: { parentId: 'main-layout-list', mode: 'append' }
    },
    'list-a:pin-top': {
      move: { parentId: 'main-layout-list', mode: 'first' }
    }
  }
}
```

## Tests smoke recommandes

1. composant cree detache puis place via `move.parentId`
2. move local `first/last/append/prepend/number`
3. move `auto` sans changement de parent -> trigger visuel local
4. transfer inter-list `detach -> reparent -> attach`
5. cible invalide/non-list -> detach + warning
6. conflit meme tick -> last op wins + warning unique
7. `flip:false` desactive FLIP source/cible
8. `seek` pendant transition `move` -> interruption immediate et reprise depuis etat courant
9. detachement transitionnel -> node conserve jusqu'a fin transition puis etat `detached`
