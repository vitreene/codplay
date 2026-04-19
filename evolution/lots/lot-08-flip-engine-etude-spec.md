# Lot 08 - moteur FLIP generique (etude + implementation)

## Objectif

Definir un moteur FLIP unique, reutilisable et agnostique runtime pour eviter plusieurs implementations concurrentes dans le player.

Ce lot couvre:

- etude technique
- spec d'architecture
- contrat API
- plan de validation
- implementation runtime du moteur FLIP
- integration animejs via le pipeline animation existant
- exemple DOM reel historique (supprime)

## Pourquoi un lot dedie

Le FLIP actuel du lot 07 couvre un sous-ensemble volontairement simple.

Le besoin cible est plus large:

- reordonner/transformer sans saut visuel
- interpoler `x`, `y`, `width`, `height`
- prendre en compte `transform` avant/apres (lecture matrix)
- preparer des transitions que le pipeline animation existant anime via animejs

Note de cadrage:

- GSAP est une reference d'etude algorithmique FLIP uniquement
- aucune dependance GSAP n'est introduite dans le projet

## Perimetre fonctionnel cible

1. Capture `FIRST` (avant mutation)
2. Mutation logique/layout (`LAST`)
3. Capture `LAST`
4. Calcul `INVERT` (delta geometrique + transform)
5. Lecture animation (`PLAY`) via le pipeline animejs existant

## Etude technique retenue

### 1) Donnees de capture minimales

Par element anime:

- `rect`: `left`, `top`, `width`, `height`
- `matrix`: `DOMMatrixReadOnly` de `transform`
- `transformOrigin`
- contexte: scroll containers + viewport offset

Remarque:

- si `transform='none'`, utiliser matrice identite
- parser via `new DOMMatrixReadOnly(computedStyle.transform)`

### 2) Calcul des deltas

- delta position: `dx = first.left - last.left`, `dy = first.top - last.top`
- delta taille: `sx = first.width / last.width`, `sy = first.height / last.height` (avec garde zero)
- delta matrice: `M_delta = inverse(M_last) * M_first`

Strategie recommandee:

- combiner deltas rect + matrice dans un model unique
- priorite a la matrice quand presente pour eviter les sauts sur elements deja transformes

### 3) Interpolation

- interpolation temporelle sur `translate/scale` + decomposition matrix
- fallback:
  - si decomposition stable impossible => interpolation sur `matrix(...)`
  - sinon => fallback position/opacity simple

### 4) Integration animation (animejs)

Le moteur FLIP produit des transitions structurees et les injecte dans le pipeline animation deja en place.

Connexion cible:

- conversion `FlipTransitionRequest -> TransitionRequest`
- execution via `runAnimationBatch(..., createAnimationAdapter(animeImplementation))`

Contrainte:

- aucune couche multi-librairie dediee n'est creee pour le lot FLIP

### 5) Orchestration frame (anti-flicker)

Objectif:

- garantir que les mesures et l'inversion FLIP sont placees entre deux repaints pour eviter un flash visuel.

Sequence cible:

1. `FIRST/read` (frame N): lire tous les snapshots avant mutation.
2. `LAST/write`: appliquer la mutation logique (reorder/layout final) sans animation visible.
3. `LAST/read`: relire tous les snapshots apres mutation.
4. `INVERT/write`: appliquer immediatement la transform d'inversion (etat visuel equivalent a FIRST).
5. `flush`: forcer un read unique (ex: `getBoundingClientRect`) pour verrouiller le style.
6. `PLAY/write` (frame N+1 via `requestAnimationFrame`): demarrer animejs vers l'etat neutre.

Note de compatibilite animejs (validee en implementation):

- avec des transitions `x/y` animejs gere les transform channels (`translateX`, `translateY`).
- pour eviter les conflits d'ecriture (`transform` inline vs channels animejs), le moteur expose `applyInvertTransformToTarget`.
- en integration animejs DOM, la valeur recommandee est `false` pour laisser animejs piloter le transform final.

Regles de discipline:

- batcher les reads ensemble puis les writes ensemble (pas d'alternance read/write par element).
- une seule barriere `requestAnimationFrame` entre `INVERT` et `PLAY`.
- aucun repaint intermediaire expose entre `LAST` et `INVERT`.

## Spec API proposee (draft)

```ts
type FlipNodeRef = unknown

type FlipSnapshot = {
  id: string
  nodeRef: FlipNodeRef
  left: number
  top: number
  width: number
  height: number
  parentMatrix: DOMMatrixReadOnly
  matrix: DOMMatrixReadOnly
  transformOrigin: string
}

type FlipPlanInput = {
  first: FlipSnapshot[]
  last: FlipSnapshot[]
  options?: {
    includeSize?: boolean
    includeTransformMatrix?: boolean
    durationMs?: number
    easing?: string
    staggerMs?: number
  }
}

type FlipTransitionRequest = {
  transitionId: string
  nodeRef: FlipNodeRef
  from: {
    x?: number
    y?: number
    width?: number
    height?: number
    scaleX?: number
    scaleY?: number
  }
  to: {
    x?: number
    y?: number
    width?: number
    height?: number
    scaleX?: number
    scaleY?: number
  }
  duration: number
  easing?: string
  delayMs?: number
}

type FlipEngine = {
  capture: (entries: Array<{ id: string; nodeRef: FlipNodeRef }>) => FlipSnapshot[]
  plan: (first: FlipSnapshot[], last: FlipSnapshot[], options?: FlipPlanInput['options']) => {
    transitions: FlipTransitionRequest[]
  }
  toAnimationTransitions: (transitions: FlipTransitionRequest[]) => TransitionRequest[]
  run: (options: {
    entries: Array<{ id: string; nodeRef: FlipNodeRef }>
    mutate: () => void
    animationAdapter: AnimationAdapter
    options?: FlipPlanInput['options']
  }) => Promise<{
    transitions: FlipTransitionRequest[]
    animationTransitions: TransitionRequest[]
  }>
}
```

## Points sensibles

- decomposition matrix 2D/3D et cas non inversibles
- `transform-origin` heterogene
- elements dans des conteneurs scrolles/nestes
- `position: fixed` vs flux normal
- performance quand cardinalite elevee (batch/fallback)
- ordre read/write incorrect pouvant provoquer un flicker

## Traces minimales attendues

- `flip:capture:first`
- `flip:capture:last`
- `flip:plan:computed`
- `flip:plan:fallback` (si degradation)
- `flip:invert:applied`
- `flip:play:started` / `flip:play:done`

## Implementation livree

- `src/runtime/flip-engine/create-flip-engine.ts`
  - `capture(entries)`
  - `plan(first, last, options)`
  - `toAnimationTransitions(transitions)`
  - `run({ entries, mutate, animationAdapter, options })`
- `src/runtime/flip-engine/matrix-2d.ts`
  - parse/multiply/invert/serialize matrices 2D
- `src/runtime/flip-engine/types.ts`
  - contrat public du moteur FLIP
- `src/examples/flip-engine-dom-example.ts`
  - demo historique sur vrais nodes (non utilisee dans la demo active)
  - scenarios interactifs: `reorder`, `add`, `delete`
  - mode test `with transforms` (parent + cards) activable

## DoD du lot 08

- spec FLIP generique et sequence anti-flicker explicites
- moteur runtime FLIP implemente
- integration animejs via `runAnimationBatch(..., createAnimationAdapter(...))`
- tests lot 8 verts (`tests/lot8`)
- validation manuelle actuelle via demo player (`npm run dev:demo`)

## Scenarios de test (DoD)

- `L8-T1` capture FLIP lit rect + matrix + transform-origin
- `L8-T2` plan FLIP prepare interpolation `x/y/width/height`
- `L8-T3` orchestration anti-flicker applique bien `FIRST/LAST/INVERT/rAF/PLAY`
- `L8-T4` delta FLIP monde->local tient compte du transform parent
- `L8-T5` conversion animejs utilise des canaux transform (pas animation directe de matrix)
- `L8-T6` integration animejs reelle valide une valeur intermediaire en cours d'animation
- `L8-T7` mode optionnel sans pre-inversion transform valide l'animation via `from/to`
- `L8-T8` delta FLIP tient compte du pre-transform de l'item cible
- `L8-T9` en mode sans pre-inversion, le transform de base est conserve
- `L8-T10` les reorders repetes n'introduisent pas de derive

## Critere de passage

- lot documente, teste et executable en exemple DOM
