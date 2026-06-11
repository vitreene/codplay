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

- son type
- sa `timeRange`
- sa configuration de grille
- sa politique de timing
- ses refs par defaut pour les events `intro` et `outro`

### Grille

La grille de capsule est un contexte de premier niveau. Elle est calculee avant les placements enfants.

Le cas principal est le mode manuel base sur le pas de grille:

- `cols: 16`
- `rows: 9`

Si ces valeurs sont omises en mode manuel, `AutoCapsule` utilise les valeurs par defaut du type de capsule.

Champs principaux:

- `mode`
- `rows`
- `cols`
- `orientation`
- `areas`
- `gap`
- `rowGap`
- `columnGap`

Regle de precedence CSS:

- `rowGap` et `columnGap` priment sur `gap`

### Enfants

Chaque enfant peut porter:

- un ordre
- un style inline
- un placement explicite
- des contraintes temporelles
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
- `TIME_MODE.fixed`

Dans le composant lui-meme et dans son usage, on privilegie donc:

```ts
grid.mode === GRID_MODE.derived
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
  setTimeRange(timeRange: AutoCapsuleTimeRangeInput): AutoCapsuleResult

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
  timeRange: { startMs: number; endMs: number }
  grid: AutoCapsuleGridInput
  timing?: {
    mode?: AutoCapsuleTimeMode
    fixedDurationMs?: number
  }
  defaults?: {
    introTransitionRef?: string | null
    outroTransitionRef?: string | null
    generateDefaultOutro?: boolean | null
  }
}

type AutoCapsuleGridInput = {
  mode: AutoCapsuleGridMode
  rows?: number | null
  cols?: number | null
  orientation?: AutoCapsuleOrientation | null
  gap?: string | null
  rowGap?: string | null
  columnGap?: string | null
  areas?: string[] | null
}
```

## Exemple minimal

```ts
import { AutoCapsule, CAPSULE_TYPE, GRID_MODE } from "./src"

const capsule = new AutoCapsule({
  capsule: {
    id: "capsule-1",
    type: CAPSULE_TYPE.grille,
    timeRange: { startMs: 2000, endMs: 8000 },
    grid: {
      mode: GRID_MODE.manual,
      cols: 16,
      rows: 9,
      gap: "16px"
    }
  },
  children: [
    { id: "a", order: 1000 },
    { id: "b", order: 2000 },
    { id: "c", order: 3000 }
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
import { AutoCapsule, CAPSULE_TYPE, GRID_MODE } from "./src"

const capsule = new AutoCapsule({
  capsule: {
    id: "capsule-grid",
    type: CAPSULE_TYPE.grille,
    timeRange: { startMs: 0, endMs: 6000 },
    grid: {
      mode: GRID_MODE.manual,
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
import { AutoCapsule, CAPSULE_TYPE, GRID_MODE } from "./src"

const capsule = new AutoCapsule({
  capsule: {
    id: "capsule-default-grid",
    type: CAPSULE_TYPE.grille,
    timeRange: { startMs: 0, endMs: 4000 },
    grid: {
      mode: GRID_MODE.manual
    }
  },
  children: []
})

const grid = capsule.buildGrid()
console.log(grid.context.rows) // 9
console.log(grid.context.cols) // 16
```

## Exemple avec override enfant

```ts
import { AutoCapsule, CAPSULE_TYPE, GRID_MODE } from "./src"

const capsule = new AutoCapsule({
  capsule: {
    id: "capsule-2",
    type: CAPSULE_TYPE.grille,
    timeRange: { startMs: 0, endMs: 9000 },
    grid: {
      mode: GRID_MODE.manual,
      rows: 2,
      cols: 2
    }
  },
  children: [
    { id: "a", order: 1 },
    { id: "b", order: 2 },
    { id: "c", order: 3 }
  ]
})

capsule.setChildPlacement("b", {
  row: 2,
  col: 1,
  rowSpan: 1,
  colSpan: 2
})

capsule.setChildConstraint("c", {
  lockedTimeRange: { startMs: 6000, endMs: 9000 }
})

const result = capsule.resolve()

console.log(result.children.find((child) => child.id === "b")?.placement)
console.log(result.children.find((child) => child.id === "c")?.timeRange)
```

## Exemple avec `eventTimes`

```ts
import { AutoCapsule, CAPSULE_TYPE, EVENT_ACTION, GRID_MODE } from "./src"

const capsule = new AutoCapsule({
  capsule: {
    id: "capsule-events",
    type: CAPSULE_TYPE.carrousel,
    timeRange: { startMs: 0, endMs: 8000 },
    grid: { mode: GRID_MODE.forced }
  },
  eventTimes: [
    { name: "chapter-a", startMs: 2500, endMs: 2500 },
    { name: "chapter-b", startMs: 5000, endMs: 5000 }
  ],
  children: [
    {
      id: "a",
      order: 1,
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
import { AutoCapsule, CAPSULE_TYPE, EVENT_ACTION, GRID_MODE } from "./src"

const capsule = new AutoCapsule({
  capsule: {
    id: "capsule-defs",
    type: CAPSULE_TYPE.carrousel,
    timeRange: { startMs: 0, endMs: 4000 },
    grid: { mode: GRID_MODE.forced }
  },
  children: [{ id: "a", order: 1 }]
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

Comportement v1 implemente:

- `MANUAL`: mode principal; utilise `rows/cols`, puis fallback sur les defaults du type si omis
- `FORCED`: force `1 x 1`
- `DERIVED`: derive la grille depuis `orientation` et le nombre d'enfants visibles
- `LIST`: une ligne par enfant
- `AREAS`: conserve un contexte grille explicite avec `areas`

Defaults actuels:

- `grille`, `position`, `card`, `legacy`, `rangee`, `liste`: `rows = 9`, `cols = 16` quand le mode est manuel et que les valeurs sont omises
- `carrousel`: `1 x 1`

## Politique de timing actuelle

Deux modes sont disponibles:

- `distributed`
- `fixed`

En `distributed`:

- la `timeRange` capsule est partagee entre les enfants visibles
- un `lockedTimeRange` enfant agit comme un verrou
- le temps restant est redistribue autour de ces verrous

En `fixed`:

- chaque enfant recoit un slot de `fixedDurationMs`
- les verrous individuels restent prioritaires

## Politique d'events actuelle

En v1:

- un event explicite est conserve
- si un event nomme correspond a un `eventTime`, son `triggerMs` vient de cet ancrage
- si un `intro` manque, il est genere au debut de la `timeRange` de l'enfant
- si un `outro` manque et que le type l'autorise, il est genere a la fin de la `timeRange`
- si un event a une `ref`, la definition correspondante est resolue depuis le registre `eventDefinitions`

Limites actuelles:

- les events autres que `intro` et `outro` sans `eventTime` explicite retombent sur le debut de l'enfant
- les contraintes `minDurationMs` et `maxDurationMs` sont modelisees mais pas encore redistribuees sur les voisins
- le futur modele `beforeEvent` / `afterEvent` / `durationMs` explicite entre actions n'est pas encore implemente

## Configuration

Vous pouvez fournir un `config` partiel a l'initialisation pour surcharger:

- le registre de types
- les strategies de nommage
- les refs par defaut `intro/outro`
- les definitions d'events par defaut

Exemple:

```ts
const capsule = new AutoCapsule({
  capsule: {
    id: "capsule-config",
    type: CAPSULE_TYPE.liste,
    timeRange: { startMs: 0, endMs: 4000 },
    grid: { mode: GRID_MODE.list }
  },
  children: [{ id: "a", order: 1 }],
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
