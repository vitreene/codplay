# Strap spec V1 - contrat normalise

## Statut

Spec normative V1 pour le contrat `Strap` dans Codplay.

## Objectif

Figer une base unique pour:

- la definition d'un `Strap`
- sa signature d'execution dans une `Story`
- l'usage des helpers temporels pilotes par runtime
- la production de sorties runtime rejouables via la `Story`

## Definition

Un `Strap` est une fonction stateless enregistree dans une collection partagee.

- un `Strap` est identifie par son `name` (cle de collection)
- un `Strap` est appele par la `Story` sur un event
- un `Strap` ne met jamais a jour de node
- un `Strap` lit le `state` de sa story mais n'en est jamais le lieu de stockage
- le `state` lu par un `Strap` est en lecture seule profonde
- toute mutation de `state` passe uniquement par `update`
- un `Strap` retourne des sorties runtime immediates et/ou des occurrences planifiees
- la transformation pure de `data` est portee par `listen.transform` (pas par la sortie strap)

## Contrat canonique

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

type StrapMeta = {
  originEventName: string
  origin?: {
    persoId?: string
    userEvent?: string
  }
}

type StrapStep = {
  event?: StoryEvent
  update?: Record<string, unknown>
}

type PlannedStrapOccurrence = {
  offsetMs: number
  step: StrapStep
}

type StrapRuntimeOutput = {
  events?: StoryEvent[]
  warnings?: string[]
  update?: Record<string, unknown>
}

type PlannedStrapContext = {
  wait: unknown
  delay: unknown
  repeat: unknown
  stagger: unknown
  loop: unknown
}

type HelperHandle = {
  id: string
  cancel: () => void
}

type LiveStrapContext = {
  wait: unknown
  delay: unknown
  repeat: unknown
  stagger: unknown
  loop: unknown
}

type StrapContext = {
  api: unknown
  planned: PlannedStrapContext
  live: LiveStrapContext
}

type StrapInput = {
  event: StoryEvent
  state: DeepReadonly<Record<string, unknown>>
  meta: StrapMeta
  context: StrapContext
}

type StrapReturnChunk =
  | StrapRuntimeOutput
  | PlannedStrapOccurrence[]

type StrapReturnValue =
  | StrapReturnChunk
  | StrapReturnValue[]
  | void

type StrapFn = (input: StrapInput) => Promise<StrapReturnValue> | StrapReturnValue

type StrapCollection = Record<string, StrapFn>
```

## Regles normatives

1. Identite

- un `Strap` est adresse par son `name` dans la `StrapCollection`
- un `name` est unique dans la collection active

2. Appartenance et résolution

- les straps sont divisés en deux niveaux d'appartenance : story-straps et scene-straps
- un **story-strap** appartient exclusivement à une story ; il est portable avec elle et ne peut être invoqué que depuis `story.listen`
- un **scene-strap** appartient à la scène ; il est destiné à l'orchestration cross-stories et aux side-effects globaux ; il est invocable depuis `scene.listen`
- les story-straps sont injectés via `PlayerInitInput.storyStraps: Record<string, StrapCollection>`, indexés par `storyId`
- les scene-straps sont injectés via `PlayerInitInput.strapCollection`
- lors de la résolution d'un strap déclenché par `story.listen`, seule la collection `storyStraps[storyId]` est consultée — il n'y a pas de fallback vers `strapCollection`
- un strap story-niveau déclaré dans `storyStraps` n'est pas accessible depuis `scene.listen`
- lors de la résolution d'un strap déclenché par `scene.listen`, seule `strapCollection` est consultée
- si un strap story-niveau est référencé dans `story.listen` mais absent de `storyStraps[storyId]`, le runtime émet un warning et ignore l'appel (comportement V1 : continue avec warning)
- `StoryDef.straps: string[]` déclare les noms des straps appartenant à la story ; ces noms doivent correspondre aux clés de `storyStraps[storyId]` fournis au player
- le player vérifie à l'init que toute clé déclarée dans `story.straps` est présente dans `storyStraps[storyId]` et émet un warning auteur si une clé est manquante

3. Execution

- l'appel au `Strap` est declenche par la `Story`
- le `Strap` est execute dans le cycle runtime courant
- un `Strap` est asynchrone par defaut
- les emissions differees passent uniquement par `context.planned` ou `context.live`
- les helpers exposes dans un strap suivent le contrat de `v1-strap-helpers-spec.md`
- un `Strap` renvoie des sorties runtime immediates et/ou des occurrences planifiees, pas une donnee de retour metier directe
- un `Strap` dispose d'une track dediee pour ses sorties rejouables

3. Ordre d'execution

- dans une meme regle, les `straps` sont executes et attends dans l'ordre de declaration
- `emit` est evalue apres completion des `straps` de la regle

4. Sorties

- un `Strap` peut produire des `events`, des `update`, et des occurrences planifiees datees
- `events` et `update` sont persistables/rejouables via les tracks
- les occurrences planifiees sont materialisees en `event` et `update` sur la track dediee du strap
- en V1, la granularite retenue est une seule track dediee par nom de strap et par story; pour `Scene.listen`, la granularite equivalente est une track par nom de strap et par scene
- une fois materialises dans une track, ces `events` et `update` appartiennent au journal canonique et sont faits pour etre lus
- un strap ne contribue aux bornes master que si sa track dediee est explicitement `role: "master"`
- la `Story` determine la portee finale selon `cascade` et son pipeline
- au niveau `Scene`, un strap d'entree peut participer au bootstrap en declenchant des operations de montage indirectes puis des events de sequence
- la valeur de retour accepte des tableaux imbriques de `StrapReturnChunk`
- le runtime aplatit recursivement ces tableaux avant materialisation

5. Scene conventions

- il n'existe pas de propriete canonique `effects` dans la sortie d'un `Strap`
- les emissions externes asynchrones sont des conventions de `Scene`, adressees par des `events`
- un `event` n'est jamais un `effect` "en soi"
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
  "counter-countdown": ({ event, context, meta, state }) => {
    if (event.name !== "start_counter") return

    const start = Number(event.data?.start ?? 20)
    const end = Number(event.data?.end ?? 0)
    const step = Number(event.data?.step ?? 1)

    const totalSteps = Math.abs((start - end) / step)
    const durationMs = totalSteps * 1000
    const progressTimes = Math.max(1, Math.floor(durationMs / 100) + 1)

    return [
      context.planned.wait(0, { event: { name: "counter_color", data: { color: "green" } } }),
      context.planned.wait(Math.floor(durationMs / 3), { event: { name: "counter_color", data: { color: "orange" } } }),
      context.planned.wait(Math.floor((2 * durationMs) / 3), { event: { name: "counter_color", data: { color: "red" } } }),
      context.planned.repeat({ eachMs: 1000, times: totalSteps + 1 }, ({ index, elapsedMs }) => {
        const value = start > end ? Math.max(end, start - index * step) : Math.min(end, start + index * step)
        return {
          event: {
            name: "counter-text",
            data: {
              content: String(value),
              elapsedMs,
              armed: state.armed
            }
          },
          update: { count: value }
        }
      }),
      context.planned.repeat({ eachMs: 100, times: progressTimes }, ({ elapsedMs }) => {
        const progress = Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100))
        return {
          event: { name: "counter_progress", data: { progress: Number(progress.toFixed(1)) } }
        }
      }),
      {
        events: [
          {
            name: "scene:effect:runtime.db.counter_started",
            data: { start, end, step, meta }
          }
        ]
      }
    ]
  }
}
```

## Lien de reference

- `v1-strap-helpers-spec.md`: contrat detaille des helpers runtime

## Invariants Strap V1

- un `Strap` est stateless par design
- un `Strap` est reference par `name` dans une collection partagee
- le `state` visible depuis un `Strap` est `DeepReadonly`
- toute mutation d'etat passe par `update`
- les emissions temporelles finies passent uniquement par `context.planned` ou `context.live` et sont materialisees en tracks rejouables
- les conventions `Scene` d'emission externe passent par `event`, jamais par une propriete `effects`
- la `Story` reste l'interlocuteur unique de la `Scene`
- un story-strap n'est jamais accessible depuis `scene.listen` ; l'isolation est stricte
- un scene-strap n'est jamais un fallback pour un story-strap manquant
