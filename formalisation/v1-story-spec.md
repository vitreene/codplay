# Story spec V1 - contrat normalise

## Statut

Spec normative V1 pour le contrat `Story` dans Codplay.

## Objectif

Figer une base unique pour:

- la structure d'une `Story`
- l'orchestration `listen -> transform -> straps -> emit -> persos`
- la frontiere de publication locale `Story -> Scene`
- la portabilite d'une story independamment de son placement visuel

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

type StoryEventimeNode = {
  name: string
  startAt: number
  data?: Record<string, unknown>
  events?: StoryEventimeNode[]
}

type StoryDef = {
  id: string
  tracks?: Record<string, { active?: boolean }>
  entries: string[]
  initial: Record<string, unknown> | undefined
  persos: Perso[]
  straps: string[] | undefined
  listen: ListenRule[]
  eventimes?: StoryEventimeNode[]
  state?: StoryState
  init: (input?: StoryInitInput) => StoryState
}
```

## Regles normatives

1. Structure

- une `Story` declare `id`, `entries`, `initial`, `persos`, `straps`, `listen`, `init`.
- une `Story` ne porte pas de conteneur de rendu obligatoire propre.
- `entries` reference explicitement les persos places a la racine de la story.
- `entries` est obligatoire dans le contrat et peut etre vide (`[]`).
- une story peut avoir plusieurs elements racine.
- `straps` est obligatoire dans le contrat et peut valoir `undefined` par defaut.
- `listen` est obligatoire dans le contrat, et peut etre vide (`[]`).
- `initial` est obligatoire dans le contrat et peut valoir `undefined` par defaut.
- `state` est runtime-only et optionnel dans la definition.

2. Independance et placement

- une `Story` est une unite independante.
- monter une `Story` consiste a propager le placement vers ses `entries`.
- le contexte de placement d'une `Story` ne vit pas dans `StoryDef`.
- une `Story` reste portable et reutilisable dans des scenes ou contextes visuels differents.
- une story peut etre rendue visuellement dans une autre sans creer de lien structurel hierarchique.
- ce placement inter-stories repose sur les `move` de ses elements et non sur une declaration de hierarchie entre stories.

3. Initialisation

- `init(input)` construit le `state` initial runtime de la `Story`.
- `init` accepte `undefined` en V1.
- `init(undefined)` signifie qu'aucun parametre externe n'est requis pour initialiser la story.
- `initial` porte les donnees statiques de la story.
- `state` peut rester `undefined` s'il n'est pas utilise.
- `initial` des `Perso` sert uniquement a la construction et au placement des elements.
- toutes les stories de la scene sont initialisees a `scene.init`.
- une story initialisee peut exister dans le runtime sans etre visible dans le DOM.
- une story peut declarer statiquement les tracks qu'elle compte utiliser via `tracks`.
- cette declaration n'est pas un registre runtime autonome.
- elle constitue une contribution a la construction finale de `Scene.tracks` a `scene.init`.
- apres `scene.init`, une story ne cree ni ne supprime de track.

4. Listen

- `story.listen` est un ecouteur local de story.
- `story.listen` peut a son tour reemettre.
- `listen` intercepte des events par nom exact (`on`).
- les regles `listen` sont des filtres.
- dans une `Story`, `listen.on` doit etre unique par nom d'event.
- doublon de `listen.on` dans une meme `Story`: erreur auteur.
- `transform` est facultatif et peut contenir plusieurs etapes.
- les etapes `transform` sont executees dans l'ordre de declaration.
- `transform` consomme le meme `ListenRuntimeInput` que les `straps` de la regle.
- `transform` ne renvoie que de la `data`.
- `emit` est facultatif et permet la redistribution native `1 -> N`.
- `straps` est facultatif sur une regle `listen`.
- en absence de `emit`, l'event entrant est redistribue tel quel.
- `listen=[]` n'applique aucun filtrage: tous les events entrants sont redistribues tels quels.
- quand `listen` contient des regles, seuls les events correspondants sont redistribues.

5. Pipeline d'execution

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
- une resolution plus fine des conflits d'actions au meme tick releve d'une policy modulaire de rendu, pas d'une obligation fixe du coeur Story.

6. Portee et propagation

- `cascade` est booleen en V1.
- `cascade: false` ou absent: portee locale a la `Story`.
- `cascade: true`: publication globale vers `Scene`.
- la portee d'un event est decidee au cas par cas comme defini dans la spec.
- un event n'est jamais cible explicitement vers une story par identifiant.
- les interactions inter-stories passent par les events observes au niveau scene et les placements des elements, pas par une adresse de story cible.

7. Convention de nommage

- une `Story` ne porte pas de phase de demarrage runtime implicite propre.
- apres son montage runtime, une story peut recevoir des events comme n'importe quelle autre source de persos/action listeners.
- un event nomme `story:start` peut exister par convention auteur, mais il n'a aucune semantique speciale implicite dans le moteur.

8. Sortie Story

- la `Story` reste l'interlocuteur de `Scene` pour ses emissions globales.
- la publication globale passe par les regles de portee deja definies (`cascade`).

9. Determinisme

- a entree identique et configuration identique, la suite des events est identique.
- en cas d'emissions multiples au meme tick, l'ordre est celui de declaration.

10. Portabilite des eventimes

- les eventimes de synchronisation sont portes par la `Story` via `eventimes`.
- `startAt` est un offset relatif exprime en ms.
- `startAt` est relatif au point zero de la story ou du noeud parent d'eventimes.
- `events` permet l'imbrication d'eventimes enfants.
- la `Scene` orchestre l'instant de depart de la story; elle ne redefinit pas le contenu synchronise portable de la story.
- le montage d'une story ne fixe jamais a lui seul l'ancre temporelle de ses `eventimes`.
- l'inscription des `eventimes` d'une story dans la timeline runtime est une operation distincte du montage de ses persos.
- si le depart est deterministe sans interaction bloquante, les `applyAtMs` peuvent etre calcules au build.
- si le depart depend d'une interaction runtime, les `applyAtMs` sont ancres au moment du trigger runtime.
- le calcul absolu respecte: `applyAtMs = anchorMs + somme des startAt sur le chemin parent -> enfant d'eventimes`.
- si aucun track explicite n'est indique pour un event de story, le fallback est le track `story.id`.

11. Zero temporel de story

- chaque story possede un zero temporel implicite (`t=0`).
- ce zero est decale par l'orchestration scene au moment de l'ancrage.
- le zero de story n'impose pas de seek global player.

## Exemple minimal

```ts
const storyCounter: StoryDef = {
  id: "story-counter",
  entries: ["story-counter__counter-text"],
  persos: [
    {
      id: "story-counter__counter-text",
      name: "counter-text",
      type: "text",
      initial: { content: "20", color: "green" },
      actions: {
        "story-counter__counter-text": null,
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

Reference transversale: `v1-invariants.md`.

- une `Story` orchestre ses `persos` et ses `straps` sans bypass `Scene`.
- `entries` expose les persos d'entree explicites de la story et peut en contenir plusieurs.
- `listen` redistribue nativement les events sans imposer un strap.
- `straps` restent facultatifs dans les regles `listen`.
- la portee des events reste locale story ou globale scene selon `cascade`.
- aucun event n'est adresse a une `Story` cible par identifiant.
- les eventimes restent portables avec la story lors d'une reutilisation inter-scenes.
