# Strap spec V1 - contrat normalise

## Statut

Spec normative V1 pour le contrat `Strap` dans Codplay.

## Objectif

Figer une base unique pour:

- la definition d'un `Strap`
- sa signature d'execution dans une `Story`
- l'usage des helpers temporels pilotes par runtime
- la production d'events internes/publics via la `Story`

## Definition

Un `Strap` est une fonction stateless enregistree dans une collection partagee.

- un `Strap` est identifie par son `name` (cle de collection)
- un `Strap` est appele par la `Story` sur un event
- un `Strap` ne met jamais a jour de node
- un `Strap` retourne ou planifie des events a reinjecter dans le pipeline `Story`

## Contrat canonique

```ts
type StoryEvent = {
  name: string
  data?: Record<string, unknown>
}

type StrapMeta = {
  originEventName: string
  origin?: {
    persoId?: string
    userEvent?: string
  }
}

type StrapHelpers = {
  delay: (ms: number, event: StoryEvent) => void
  repeat: (opts: { everyMs: number; times: number }, factory: (index: number) => StoryEvent[]) => void
  loop: (opts: { everyMs: number }, factory: (index: number) => StoryEvent[]) => void
  stagger: (opts: { stepMs: number }, events: StoryEvent[]) => void
}

type StrapContext = {
  api: unknown
  helpers: StrapHelpers
}

type StrapInput = {
  event: StoryEvent
  state: Record<string, unknown>
  meta: StrapMeta
  context: StrapContext
}

type StrapOutput = {
  events?: StoryEvent[]
  warnings?: string[]
}

type StrapFn = (input: StrapInput) => StrapOutput | void

type StrapCollection = Record<string, StrapFn>
```

## Regles normatives

1. Identite

- un `Strap` est adresse par son `name` dans la `StrapCollection`
- un `name` est unique dans la collection active

2. Execution

- l'appel au `Strap` est declenche par la `Story`
- le `Strap` est execute dans le cycle runtime courant
- les emissions differees passent uniquement par `helpers` (runtime/ticker)

3. Sorties

- un `Strap` produit des events via `events` (immediat) ou `helpers` (differe)
- la `Story` determine la portee finale (`internal` ou `public`) selon son pipeline

4. Side-effects

- les side-effects externes passent par des events adresses a l'API Scene/runtime
- un `Strap` n'accede pas directement a des IO externes hors API runtime exposee

## Exemple applique - counter

Use case:

- event entrant: `start_counter` avec `start=20`, `end=0`, `step=1`
- emissions attendues:
  - `counter-text` toutes les 1 seconde (`content`)
  - `counter_progress` toutes les 100 ms
  - `counter_color` exactement 3 fois (`green`, `orange`, `red`)

```ts
const straps: StrapCollection = {
  "counter-countdown": ({ event, context, meta }) => {
    if (event.name !== "start_counter") return

    const start = Number(event.data?.start ?? 20)
    const end = Number(event.data?.end ?? 0)
    const step = Number(event.data?.step ?? 1)

    const totalSteps = Math.abs((start - end) / step)
    const durationMs = totalSteps * 1000

    context.helpers.delay(0, { name: "counter_color", data: { color: "green" } })
    context.helpers.delay(Math.floor(durationMs / 3), { name: "counter_color", data: { color: "orange" } })
    context.helpers.delay(Math.floor((2 * durationMs) / 3), { name: "counter_color", data: { color: "red" } })

    context.helpers.repeat({ everyMs: 1000, times: totalSteps + 1 }, (index) => {
      const value = start > end ? Math.max(end, start - index * step) : Math.min(end, start + index * step)
      return [{ name: "counter-text", data: { content: String(value) } }]
    })

    const progressTimes = Math.max(1, Math.floor(durationMs / 100) + 1)
    context.helpers.repeat({ everyMs: 100, times: progressTimes }, (index) => {
      const elapsedMs = index * 100
      const progress = Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100))
      return [{ name: "counter_progress", data: { progress: Number(progress.toFixed(1)) } }]
    })

    context.helpers.delay(0, {
      name: "scene_api_call",
      data: {
        action: "runtime.db.counter_started",
        payload: { start, end, step, meta }
      }
    })
  }
}
```

## Lien de reference

- `37-strap-helpers-spec-v1.md`: contrat detaille des helpers runtime

## Invariants Strap V1

- un `Strap` est stateless par design
- un `Strap` est reference par `name` dans une collection partagee
- les emissions temporelles passent uniquement par les helpers runtime
- la `Story` reste l'interlocuteur unique de la `Scene`
