# AutoCapsule

`AutoCapsule` est un composant TypeScript pur qui calcule les artefacts necessaires pour une capsule DOM et ses enfants:

- contexte de grille de la capsule
- classes CSS capsule et enfants
- regles CSS a injecter par l'application hote
- plages temporelles des enfants
- events resolves ou synthetiques
- definitions d'events nommes comme `fade`, `zoom`, `swipe-left`

Le composant ne touche jamais au DOM. Il ne depend ni de React, ni d'une autre librairie.

## Perimetre

`AutoCapsule` prend en entree une capsule, ses enfants et des registres portables, puis produit:

- un artefact de grille via `buildGrid()`
- un resultat complet via `resolve()`
- une feuille CSS complete via `renderStyleSheet()`

Hors perimetre:

- application des `className` sur les elements DOM
- insertion de balise `<style>`
- persistance base de donnees
- integration framework

## Point d'entree

```ts
import { AutoCapsule, CAPSULE_TYPE, EVENT_ACTION, GRID_MODE } from "./src"
```

Le dossier est autonome et prevu pour etre deplace plus tard dans un autre projet.

## Idee generale

Le composant manipule quatre familles de donnees:

1. la capsule elle-meme
2. la grille de capsule
3. les enfants
4. les registres d'events

### Capsule

La capsule porte:

- son type — determine seul son `gridMode` (voir Grille), aucun champ de timing
- sa configuration de grille
- ses refs par defaut pour les events `intro` et `outro`

### Grille

La grille de capsule est un contexte de premier niveau. Elle est calculee avant les placements enfants.

Le mode de grille (`GRID_MODE`) n'est pas un champ de `grid` — il est fixe par type de capsule
(`AutoCapsuleTypeBehavior.gridMode`, voir `CAPSULE_TYPE`), jamais un choix de l'appelant.

Le cas principal est le mode manuel base sur le pas de grille:

- `cols: 16`
- `rows: 9`

Si ces valeurs sont omises en mode manuel, `AutoCapsule` utilise les valeurs par defaut du type de capsule.

Champs principaux:

- `rows`
- `cols`
- `orientation`
- `gap`
- `rowGap`
- `columnGap`

Regle de precedence CSS:

- `rowGap` et `columnGap` priment sur `gap`

### Enfants

Chaque enfant peut porter:

- un ordre
- sa `timeRange` resolue (obligatoire, fournie par l'appelant — jamais calculee ici)
- un style inline
- un placement explicite
- des events explicites

### Registres d'events

`AutoCapsule` distingue deux registres portables:

- `eventTimes`: ancrages temporels nommes, generiques, sans vocabulaire applicatif local
- `eventDefinitions`: definitions nommees comme `fade`, `zoom`, `cut`

`cue` ne fait pas partie du contrat public.

## Constantes publiques

Le composant exporte des constantes metier pour eviter les comparaisons sur des chaines litterales.

Exemples:

- `GRID_MODE.derived`
- `CAPSULE_TYPE.grille`
- `EVENT_ACTION.intro`
- `PLACEMENT_POLICY.mixed`

Dans le composant lui-meme et dans son usage, on privilegie donc:

```ts
behavior.gridMode === GRID_MODE.derived
```

et non une chaine litterale en dur.

## API

Classe principale:

```ts
class AutoCapsule {
  constructor(input: AutoCapsuleInput, options?: AutoCapsuleOptions)

  getState(): AutoCapsuleState
  getSerializableState(): AutoCapsuleSerializableState
  getEventTimes(): AutoCapsuleEventTimeInput[]
  getEventDefinitions(): Record<string, AutoCapsuleEventDefinition>

  setCapsule(patch: Partial<AutoCapsuleDefinition>): AutoCapsuleResult
  setGrid(patch: Partial<AutoCapsuleGridInput>): AutoCapsuleResult

  upsertChild(child: AutoCapsuleChildInput): AutoCapsuleResult
  removeChild(childId: string): AutoCapsuleResult
  reorderChildren(childIds: string[]): AutoCapsuleResult
  setChildPlacement(childId: string, placement: AutoCapsuleChildPlacementInput | null): AutoCapsuleResult
  setChildConstraint(childId: string, patch: Partial<AutoCapsuleChildConstraintInput>): AutoCapsuleResult
  setChildEvent(childId: string, action: AutoCapsuleEventAction, event: AutoCapsuleEventInput | null): AutoCapsuleResult

  upsertEventTime(eventTime: AutoCapsuleEventTimeInput): AutoCapsuleResult
  removeEventTime(name: string): AutoCapsuleResult
  upsertEventDefinition(key: string, definition: AutoCapsuleEventDefinition): AutoCapsuleResult
  removeEventDefinition(key: string): AutoCapsuleResult

  buildGrid(): AutoCapsuleGridArtifact
  resolve(): AutoCapsuleResult
  renderStyleSheet(): string
  toJSON(): AutoCapsuleSerializableState
}
```

## Modele d'entree

Extrait des types publics utiles:

```ts
type AutoCapsuleInput = {
  capsule: AutoCapsuleDefinition
  children: AutoCapsuleChildInput[]
  eventTimes?: AutoCapsuleEventTimeInput[]
  eventDefinitions?: Record<string, AutoCapsuleEventDefinition>
  config?: Partial<AutoCapsuleConfig>
}

type AutoCapsuleDefinition = {
  id: string
  type: AutoCapsuleType
  grid: AutoCapsuleGridInput
  defaults?: {
    introTransitionRef?: string | null
    outroTransitionRef?: string | null
    generateDefaultOutro?: boolean | null
  }
}

// `mode` is not part of this input: it is fixed per `AutoCapsuleType`
// (`AutoCapsuleTypeBehavior.gridMode`), never a caller choice.
type AutoCapsuleGridInput = {
  rows?: number | null
  cols?: number | null
  orientation?: AutoCapsuleOrientation | null
  gap?: string | null
  rowGap?: string | null
  columnGap?: string | null
}

type AutoCapsuleChildInput = {
  id: string
  order: number
  // Resolved absolute time range, provided by the caller (e.g. CapsuleDistribution) —
  // never computed by AutoCapsule.
  timeRange: { startMs: number; endMs: number }
  // ...placement, style, events
}
```

## Exemple minimal

```ts
import { AutoCapsule, CAPSULE_TYPE } from "./src"

const capsule = new AutoCapsule({
  capsule: {
    id: "capsule-1",
    type: CAPSULE_TYPE.grille, // gridMode = GRID_MODE.manual, fixe par type
    grid: {
      cols: 16,
      rows: 9,
      gap: "16px"
    }
  },
  children: [
    { id: "a", order: 1000, timeRange: { startMs: 2000, endMs: 4000 } },
    { id: "b", order: 2000, timeRange: { startMs: 4000, endMs: 6000 } },
    { id: "c", order: 3000, timeRange: { startMs: 6000, endMs: 8000 } }
  ]
})

const result = capsule.resolve()

console.log(result.grid.context)
console.log(result.capsule.className)
console.log(result.children.map((child) => ({
  id: child.id,
  className: child.className,
  timeRange: child.timeRange,
  events: child.events
})))
console.log(result.styleSheet)
```

## Exemple `buildGrid()` seul

```ts
import { AutoCapsule, CAPSULE_TYPE } from "./src"

const capsule = new AutoCapsule({
  capsule: {
    id: "capsule-grid",
    type: CAPSULE_TYPE.grille,
    grid: {
      cols: 16,
      rows: 9,
      rowGap: "8px",
      columnGap: "12px"
    }
  },
  children: []
})

const grid = capsule.buildGrid()

console.log(grid.className)
console.log(grid.inlineStyle)
console.log(grid.cssRules)
console.log(grid.context)
```

Utilisez ce mode si votre application veut d'abord construire le conteneur capsule, puis appliquer plus tard les artefacts enfants.

## Exemple avec defaults de grille

```ts
import { AutoCapsule, CAPSULE_TYPE } from "./src"

const capsule = new AutoCapsule({
  capsule: {
    id: "capsule-default-grid",
    type: CAPSULE_TYPE.grille,
    grid: {}
  },
  children: []
})

const grid = capsule.buildGrid()
console.log(grid.context.rows) // 9
console.log(grid.context.cols) // 16
```

## Exemple avec override enfant

```ts
import { AutoCapsule, CAPSULE_TYPE } from "./src"

const capsule = new AutoCapsule({
  capsule: {
    id: "capsule-2",
    type: CAPSULE_TYPE.grille,
    grid: { rows: 2, cols: 2 }
  },
  children: [
    { id: "a", order: 1, timeRange: { startMs: 0, endMs: 3000 } },
    { id: "b", order: 2, timeRange: { startMs: 3000, endMs: 6000 } },
    { id: "c", order: 3, timeRange: { startMs: 6000, endMs: 9000 } }
  ]
})

capsule.setChildPlacement("b", {
  row: 2,
  col: 1,
  rowSpan: 1,
  colSpan: 2
})

const result = capsule.resolve()

console.log(result.children.find((child) => child.id === "b")?.placement)
console.log(result.children.find((child) => child.id === "c")?.timeRange)
```

## Exemple avec `eventTimes`

```ts
import { AutoCapsule, CAPSULE_TYPE, EVENT_ACTION } from "./src"

const capsule = new AutoCapsule({
  capsule: {
    id: "capsule-events",
    type: CAPSULE_TYPE.carousel,
    grid: {}
  },
  eventTimes: [
    { name: "chapter-a", startMs: 2500, endMs: 2500 },
    { name: "chapter-b", startMs: 5000, endMs: 5000 }
  ],
  children: [
    {
      id: "a",
      order: 1,
      timeRange: { startMs: 0, endMs: 8000 },
      events: {
        [EVENT_ACTION.intro]: { action: EVENT_ACTION.intro, name: "chapter-a", ref: "fade" }
      }
    }
  ]
})

const result = capsule.resolve()
console.log(result.children[0].events.intro.triggerMs) // 2500
```

## Exemple avec definitions d'events

`AutoCapsule` embarque par defaut des definitions comme:

- `cut`
- `fade`
- `zoom`
- `swipe-left`
- `swipe-right`
- `swipe-top`
- `swipe-down`

Vous pouvez les lire, les remplacer ou en ajouter.

```ts
import { AutoCapsule, CAPSULE_TYPE, EVENT_ACTION } from "./src"

const capsule = new AutoCapsule({
  capsule: {
    id: "capsule-defs",
    type: CAPSULE_TYPE.carousel,
    grid: {}
  },
  children: [{ id: "a", order: 1, timeRange: { startMs: 0, endMs: 4000 } }]
})

console.log(capsule.getEventDefinitions().fade)

capsule.upsertEventDefinition("fade", {
  label: "fade-custom",
  durationMs: 800,
  style: {
    [EVENT_ACTION.intro]: {
      opacity: { from: 0, to: 1 }
    },
    [EVENT_ACTION.outro]: {
      opacity: { to: 0 }
    }
  }
})

capsule.upsertEventDefinition("flash", {
  label: "flash",
  durationMs: 200,
  style: {
    [EVENT_ACTION.intro]: {
      opacity: { from: 0, to: 1 }
    }
  }
})

capsule.setChildEvent("a", EVENT_ACTION.intro, {
  action: EVENT_ACTION.intro,
  ref: "flash"
})

const result = capsule.resolve()
console.log(result.children[0].events.intro.definition)
```

## Resultat

Le resultat retourne des artefacts DOM-ready:

- `capsule.className`
- `capsule.inlineStyle`
- `children[i].className`
- `children[i].placement`
- `children[i].timeRange`
- `children[i].events`
- `styleSheet`

Chaque event resolu peut maintenant inclure:

- `ref`
- `definition`
- `durationMs`

## Politique de grille actuelle

`GRID_MODE` est fixe par `CAPSULE_TYPE` (`AutoCapsuleTypeBehavior.gridMode`), jamais un champ que l'appelant choisit sur `grid`:

- `carousel` → `FORCED`: force `1 x 1`
- `rangee` → `DERIVED`: derive la grille depuis `orientation` et le nombre d'enfants visibles
- `liste` → `LIST`: une ligne par enfant
- `grille`, `card` → `MANUAL`: utilise `rows/cols`, puis fallback sur les defaults du type si omis

Defaults actuels:

- `grille`, `card`, `rangee`, `liste`: `rows = 9`, `cols = 16` quand le mode est manuel et que les valeurs sont omises
- `carousel`: `1 x 1`

## Politique de timing actuelle

`AutoCapsule` ne calcule aucune distribution temporelle. Chaque enfant porte sa `timeRange`
absolue, deja resolue par l'appelant (typiquement `CapsuleDistribution`, en amont) — un simple
passthrough (`resolveAutoCapsuleTiming`), pas un moteur de repartition.

## Politique d'events actuelle

Comportement V2 actuel:

- un event explicite est conserve
- si un event nomme correspond a un `eventTime`, son `triggerMs` vient de cet ancrage
- si un `intro` manque, il est genere au debut de la `timeRange` de l'enfant
- si un `outro` manque et que le type l'autorise, il est genere a la fin de la `timeRange`
- si un event a une `ref`, la definition correspondante est resolue depuis le registre `eventDefinitions`

Limites actuelles:

- les events autres que `intro` et `outro` sans `eventTime` explicite retombent sur le debut de l'enfant
- le futur modele `beforeEvent` / `afterEvent` / `durationMs` explicite entre actions n'est pas encore implemente

## Configuration

Vous pouvez fournir un `config` partiel a l'initialisation pour surcharger:

- le registre de types
- les strategies de nommage
- les refs par defaut `intro/outro`
- les definitions d'events par defaut
- `resolveAutoCapsuleDefaults(type, overrides?)`, la résolution partagée des refs et de la
  politique de sortie par défaut (utilisable par un appelant qui doit calculer une borne avant
  `AutoCapsule.resolve()`)

Exemple:

```ts
const capsule = new AutoCapsule({
  capsule: {
    id: "capsule-config",
    type: CAPSULE_TYPE.liste, // gridMode = GRID_MODE.list, fixe par type
    grid: {}
  },
  children: [{ id: "a", order: 1, timeRange: { startMs: 0, endMs: 4000 } }],
  config: {
    naming: {
      buildListItemClassName: (index) => `my-list-row-${index}`
    }
  }
})
```

## Etat et export

- `getState()` retourne l'etat runtime interne avec la config resolue
- `getSerializableState()` retourne l'etat exportable sans fonctions
- `toJSON()` retourne le meme payload serialisable

L'etat serialisable contient:

- `capsule`
- `children`
- `eventTimes`
- `eventDefinitions`

## Verification actuelle

Le composant compile actuellement avec:

```bash
npx tsc --noEmit --pretty false --strict --skipLibCheck --target ES2023 --module ESNext --moduleResolution bundler "capsule-automation/src/index.ts"
```

## Evolution prevue

L'architecture a ete laissee ouverte pour les evolutions suivantes:

- event times moins dependants du modele actuel
- support de `beforeEvent` et `afterEvent`
- transitions resolvees comme des events a part entiere
- prise en compte d'une `durationMs` explicite pour borner une transition entre deux actions
