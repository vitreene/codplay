# Strap helpers spec V1 - scheduling runtime

## Statut

Spec normative V1 pour les helpers temporels internes, leurs wrappers publics `player.schedule`, et leurs wrappers auteur `context.helpers` dans les `Strap`.

## Objectif

- separer strictement le noyau temporel interne de l'emission runtime
- conserver `player.schedule` comme surface runtime active
- definir `context.helpers` comme surface auteur adaptee aux `Strap`
- supporter deux modes d'execution:
  - `planned`
  - `jit`
- garantir le replay et le seek sans reexecution imperative des `Strap`

## Architecture

Il existe 3 couches distinctes.

1. Helpers internes

- noyau temporel neutre
- gerent cadence, repetition, interruption, cancel, mode
- ne publient aucun event
- ne connaissent ni `player`, ni `scene`, ni `strap`

2. Wrapper `player.schedule`

- adapte les helpers internes au runtime actif
- callback retourne des `StoryEvent`
- emission au fil de l'eau via le runtime

3. Wrapper `context.helpers`

- adapte les helpers internes au runtime strap
- callback retourne des `StrapStep`
- materialisation en tracks
- aucun emit imperatif direct dans le corps du strap

## Exposition facade Player

La facade `player.schedule` est destructurable.

```ts
const { wait, delay, repeat, loop, stagger } = player.schedule
```

Les helpers peuvent aussi etre exposes en import direct.

```ts
import { wait, delay, repeat, loop, stagger } from "codplay/schedule"
```

L'import direct est un alias de la facade runtime `player.schedule`.

## Types partages

```ts
type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T :
  T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T

type StoryEvent = {
  name: string
  data?: Record<string, unknown>
  cascade?: boolean
}

type StrapStep = {
  event?: StoryEvent
  update?: Record<string, unknown>
}

type HelperHandle = {
  id: string
  cancel: () => void
}

type HelperMode = "planned" | "jit"

type HelperTickContext = {
  currentTimeMs: number
  startedAtMs: number
  elapsedMs: number
  index: number
  state: DeepReadonly<Record<string, unknown>>
}
```

## Contrat de lecture d'etat

- le `state` lu depuis un `Strap` est en lecture seule
- le `state` lu dans les callbacks helper est en lecture seule
- le `state` doit etre resolu a chaque invocation de callback
- le `state` ne doit pas etre un snapshot stale capture a la creation du helper
- toute mutation de `state` passe uniquement par `update`

## Entrees et sorties callbacks

Un helper peut accepter:

- une valeur directe
- une liste directe
- une fonction

### Runtime actif

```ts
type EventResult =
  | StoryEvent
  | StoryEvent[]
  | void

type EventFactory = (context: HelperTickContext) => EventResult

type EventInput =
  | StoryEvent
  | StoryEvent[]
  | EventFactory
```

### Runtime strap

```ts
type StrapStepResult =
  | StrapStep
  | StrapStep[]
  | void

type StrapStepFactory = (context: HelperTickContext) => StrapStepResult

type StrapStepInput =
  | StrapStep
  | StrapStep[]
  | StrapStepFactory
```

## API exposee

### `player.schedule`

```ts
type RuntimeScheduleHelpers = {
  wait: (
    ms: number,
    input: EventInput,
    options?: { mode?: HelperMode }
  ) => HelperHandle

  delay: RuntimeScheduleHelpers["wait"]

  repeat: (
    options: { eachMs: number; times: number; mode?: HelperMode },
    input: EventInput
  ) => HelperHandle

  stagger: (
    options: { stepMs: number; mode?: HelperMode },
    input: EventInput
  ) => HelperHandle[]

  loop: (
    options: LoopOptions,
    input: EventInput
  ) => HelperHandle
}
```

### `context.helpers`

```ts
type StrapScheduleHelpers = {
  wait: (
    ms: number,
    input: StrapStepInput,
    options?: { mode?: HelperMode }
  ) => HelperHandle

  delay: StrapScheduleHelpers["wait"]

  repeat: (
    options: { eachMs: number; times: number; mode?: HelperMode },
    input: StrapStepInput
  ) => HelperHandle

  stagger: (
    options: { stepMs: number; mode?: HelperMode },
    input: StrapStepInput
  ) => HelperHandle[]

  loop: (
    options: LoopOptions,
    input: StrapStepInput
  ) => HelperHandle
}
```

## Helpers V1

### `wait`

- produit une occurrence unique a `startedAtMs + ms`
- `delay` est un alias de `wait`

### `repeat`

- produit `times` occurrences
- cadence `eachMs`
- occurrence `0` a `t0`
- occurrence `n` a `t0 + n * eachMs`

### `stagger`

- produit une suite de sorties decalees par `stepMs`
- supporte valeur directe, liste directe, ou factory
- si factory, chaque resolution se fait avec `HelperTickContext`

### `loop`

- produit une suite repetitive cadencee
- doit obligatoirement avoir une condition de sortie
- n'est jamais infini par construction

## Spec `loop`

```ts
type LoopStopCondition =
  | { type: "times"; max: number }
  | { type: "duration"; maxMs: number }
  | { type: "event"; name: string }

type LoopOptions = {
  eachMs: number
  until: LoopStopCondition | LoopStopCondition[]
  mode?: HelperMode
}
```

### Regles normatives

- `eachMs` est obligatoire et strictement `> 0`
- `until` est obligatoire
- premiere occurrence a `t0`
- si `until` est un tableau, le loop s'arrete a la premiere condition satisfaite
- `duration.maxMs` est inclusive
- une occurrence est autorisee si `occurrenceMs <= maxMs`
- `until: { type: "event", name }` n'interrompt que ce loop
- l'event interceptant peut etre traite ailleurs normalement
- `sequence:end` interrompt toujours tous les loops actifs
- `pause` gele
- `resume` et `play` reprennent
- `stop`, `destroy`, `seek`, `rewind` interrompent les loops actifs

## Modes d'execution

Deux modes existent.

### `planned`

- le runtime calcule tout le plan a l'avance
- adapte aux suites finies et resolvables statiquement

### `jit`

- le runtime produit les occurrences au fur et a mesure
- adapte aux suites longues, interrompables, ou dependantes d'un event futur

## Mode par defaut

- `wait`: `planned`
- `repeat`: `planned`
- `stagger`: `planned`
- `loop`: `jit`

## Incompatibilite de mode

Si un mode demande est incompatible:

- le runtime emet un warning explicite
- le runtime applique un fallback vers le mode compatible par defaut
- dans un `Strap`, ce warning est:
  - trace au runtime
  - ajoute aux `warnings` agreges du strap

Exemple:

- `loop` avec `until.event` et `mode: "planned"`
- warning
- fallback vers `jit`

## Cancelation

- chaque helper retourne un `HelperHandle`
- `cancel()` empeche uniquement les occurrences futures
- `cancel()` ne supprime pas les occurrences deja materialisees
- en `jit`, `cancel()` arrete la production future
- en `planned`, `cancel()` neutralise les occurrences futures non encore materialisees si le runtime materialise progressivement
- en V1, `wait`, `repeat`, `stagger` en `jit` sont interrompables par handle uniquement
- `until.event` est reserve a `loop`

## Regles normatives globales

1. Horloge

- tous les helpers utilisent la meme reference temporelle runtime
- aucune implementation helper ne s'appuie sur `setTimeout` ou `setInterval` applicatifs

2. Couplage lifecycle Player

- le scheduler helper est synchronise avec le cycle de vie `Player`
- en `play` et `resume`, les plans helper continuent selon l'horloge runtime
- en `pause`, les plans helper sont geles sans perte d'ordre
- en `stop`, les plans helper en attente sont annules
- en `destroy`, les plans helper en attente sont annules
- en `seek`, les helpers de strap ne sont pas rejoues comme execution de code
- en `seek`, le runtime relit les `event` et `update` deja materialises dans les tracks

3. Ordre

- emissions a timestamp egal: ordre de declaration stable
- emissions d'un meme helper: ordre d'index croissant

4. Policy runtime

- les emissions helper passent par les policies runtime events actives
- les garde-fous `maxEventsPerTick`, `maxCascadeDepth` et validation payload s'appliquent a l'identique

## Semantique runtime `player.schedule`

- les callbacks produisent des `StoryEvent`
- les events sont emis activement au fil de l'eau
- les policies runtime s'appliquent normalement
- `player.schedule` reste un wrapper des helpers internes, pas le noyau lui-meme

## Semantique runtime `context.helpers`

- les callbacks produisent des `StrapStep`
- aucune emission imperative directe n'est autorisee depuis le helper
- chaque occurrence helper est materialisee en sortie runtime rejouable
- `event` devient un event tracke
- `update` devient une mutation trackee
- en `jit`, la materialisation se fait occurrence par occurrence au fil de l'eau

## Replay, seek, rewind

- `seek` ne reexecute jamais le code des helpers
- le runtime rejoue uniquement les sorties deja materialisees
- `rewind` et `seek` interrompent les loops actifs
- les `effects` ne sont jamais rejoues
- en V1, les helpers ne produisent pas d'`effect`

## Regles V1 sur `effect`

- `effect` est interdit dans les sorties helper V1
- seuls `event` et `update` sont autorises
- extension future possible, hors present scope

## Validation

- `ms >= 0` pour `wait`
- `eachMs > 0` pour `repeat` et `loop`
- `stepMs >= 0` pour `stagger`
- `times >= 1`
- `until.times.max >= 1`
- `until.duration.maxMs >= 0`
- `until.event.name` non vide
- mode invalide: warning + fallback si possible, sinon erreur auteur
- argument invalide: erreur auteur explicite

## Exemples

### Runtime actif

```ts
player.schedule.loop(
  {
    eachMs: 1000,
    until: [
      { type: "times", max: 11 },
      { type: "event", name: "quiz:stop" }
    ]
  },
  ({ currentTimeMs, elapsedMs, index, state }) => ({
    name: "quiz-count",
    data: {
      content: String(10 - index),
      currentTimeMs,
      elapsedMs,
      armed: state.armed
    }
  })
)
```

### Strap

```ts
context.helpers.repeat(
  { eachMs: 1000, times: 11 },
  ({ currentTimeMs, elapsedMs, index, state }) => ({
    event: {
      name: "quiz-count",
      data: {
        content: String(10 - index),
        currentTimeMs,
        elapsedMs
      }
    },
    update: {
      lastIndex: index,
      lastValue: 10 - index,
      armed: state.armed
    }
  })
)
```

## Invariants helpers V1

- source unique d'horloge runtime
- comportement deterministe a entree identique
- annulation explicite par handle
- `player.schedule` reste un wrapper runtime actif, sans devenir le noyau helper
- `context.helpers` reste un wrapper auteur materialisable, sans side effect helper direct
- le `state` lu dans un `Strap` ou un callback helper est `DeepReadonly`
- toute mutation de `state` passe par `update`
