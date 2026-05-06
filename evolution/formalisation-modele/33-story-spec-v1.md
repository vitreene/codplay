# Story spec V1 - contrat normalise

## Statut

Spec normative V1 pour le contrat `Story` dans Codplay.

## Objectif

Figer une base unique pour:

- la structure d'une `Story`
- l'orchestration `listen -> straps -> persos`
- la propagation hierarchique des events
- la frontiere de publication `Story -> Scene`

## Contrat canonique

```ts
type StoryEvent = {
  name: string
  data?: Record<string, unknown>
  cascade?: boolean
}

type ListenEmit = {
  name: string
  data?: Record<string, unknown>
  cascade?: boolean
}

type ListenTransform = {
  name: string
  options?: Record<string, unknown>
}

type ListenRuntimeInput = {
  event: StoryEvent
  state: StoryState
  meta: Record<string, unknown>
  context: Record<string, unknown>
}

type ListenRule = {
  on: string
  transform?: ListenTransform[]
  emit?: ListenEmit[]
  straps?: string[]
}

type StoryInitInput = Record<string, unknown>
type StoryState = Record<string, unknown> | undefined

type StoryDef = {
  id: string
  children?: string[]
  initial: Record<string, unknown> | undefined
  persos: Perso[]
  straps: string[] | undefined
  listen: ListenRule[]
  state?: StoryState
  init: (input?: StoryInitInput) => StoryState
}
```

## Regles normatives

1. Structure

- une `Story` declare `id`, `initial`, `persos`, `straps`, `listen`, `init`.
- `straps` est obligatoire dans le contrat et peut valoir `undefined` par defaut.
- `listen` est obligatoire dans le contrat, et peut etre vide (`[]`).
- `initial` est obligatoire dans le contrat et peut valoir `undefined` par defaut.
- `children` reference ses stories enfants par identifiant.
- une `Story` enfant ne declare pas son parent dans son contrat auteur.
- le lien parent est determine par la story qui reference l'enfant.
- une story enfant appartient a un seul parent.
- `state` est runtime-only et optionnel dans la definition.

2. Initialisation

- `init(input)` construit le `state` initial runtime de la `Story`.
- `init` accepte `undefined` en V1.
- `init(undefined)` signifie qu'aucun parametre externe n'est requis pour initialiser la story.
- `initial` porte les donnees statiques de la story.
- `init` est la fonction d'initialisation, peut recevoir un `input`, et peut definir un `state` runtime.
- `state` peut rester `undefined` s'il n'est pas utilise.
- `initial` des `Perso` sert uniquement a la construction des nodes.

3. Listen

- `listen` intercepte des events par nom exact (`on`).
- les regles `listen` sont des filtres.
- dans une `Story`, `listen.on` doit etre unique par nom d'event.
- doublon de `listen.on` dans une meme `Story`: erreur auteur.
- `transform` est facultatif et peut contenir plusieurs etapes.
- les etapes `transform` sont executees dans l'ordre de declaration.
- `transform` consomme le meme `ListenRuntimeInput` que les `straps` de la regle.
- `transform` ne renvoie que de la `data` (pas d'event).
- `emit` est facultatif et permet la redistribution native `1 -> N`.
- `straps` est facultatif sur une regle `listen`.
- en absence de `emit`, l'event entrant est redistribue tel quel.
- `listen=[]` n'applique aucun filtrage: tous les events entrants sont redistribues tels quels.
- quand `listen` contient des regles, seuls les events correspondants sont redistribues.

4. Pipeline d'execution

- ordre canonique obligatoire: `listen -> transform -> straps -> emit -> persos`.
- les events produits sont reinjectes dans le pipeline `Story`.
- l'ordre de traitement est stable selon l'ordre de declaration des regles.
- pour une regle `listen`, l'ordre est: `transform` puis `straps` puis `emit`.
- `transform` et `straps` partagent la meme entree runtime; seule la sortie differe.
- dans `straps`, les noms sont executes dans l'ordre de declaration (gauche -> droite).
- les `straps` sont asynchrones par defaut et sont attendus sequentiellement.
- en cas d'erreur strap, le mode par defaut V1 continue la chaine avec warning.
- ce comportement reste pilotable par policy runtime.
- en cas de collision de noms d'events au meme tick (sorties strap + `emit`), l'arbitrage suit `sameTickHandling` de la policy runtime.

5. Propagation

- `cascade` est booleen en V1.
- `cascade: false` ou absent: portee locale de la `Story`.
- un event local emis par un enfant remonte automatiquement vers son parent.
- chaque parent peut intercepter, transformer et republier cet event.
- `cascade: true`: remontee parent par parent jusqu'a `scene`, sans interception intermediaire.
- aucun adressage nominatif de `Story` n'est autorise.

6. Lifecycle standard

- `story:start` et `story:end` sont les events lifecycle standard V1.
- ces noms lifecycle sont reserves par convention pour les events systeme Story.

7. Sortie Story

- la `Story` reste l'interlocuteur unique de la `Scene`.
- la portee de sortie est portee par `cascade`.

8. Determinisme

- a entree identique et configuration identique, la suite des events est identique.
- en cas d'emissions multiples au meme tick, l'ordre est celui de declaration.

## Exemple minimal

```ts
const storyCounter: StoryDef = {
  id: "story-counter",
  children: ["story-counter-birds"],
  persos: [
    {
      id: "counter-text",
      type: "text",
      initial: { content: "20", color: "green" },
      actions: {
        "counter-text": null,
        "counter_color": { color: "green" }
      }
    }
  ],
  straps: ["counter-countdown"],
  listen: [
    {
      on: "start_counter",
      emit: [
        { name: "counter_started" },
        { name: "counter_progress", data: { progress: 0 }, cascade: true }
      ],
      straps: ["counter-countdown"]
    }
  ],
  init: (input) => ({
    running: false,
    start: Number(input.start ?? 20),
    end: Number(input.end ?? 0),
    step: Number(input.step ?? 1)
  })
}
```

## Invariants Story V1

Reference transversale: `102-final-v1-invariants-transverses.md`.

- une `Story` orchestre ses `persos` et ses `straps` sans bypass `Scene`.
- `listen` redistribue nativement les events sans imposer un strap.
- `straps` restent facultatifs dans les regles `listen`.
- la propagation hierarchique combine bubbling parent automatique et `cascade` explicite.
- les stories enfants sont referencees par leur parent et non adressees directement.
- les stories enfants restent agnostiques de leur contexte d'usage.
- aucun event n'est adresse a une `Story` cible par identifiant.
