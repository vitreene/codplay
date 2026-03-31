# Specifications - Engine V1

## 1) Vue d'ensemble

Le runtime suit ce flux:

`clock -> collect active events -> transition machines -> resolve actions -> derive transitions -> animate -> commit render`

Le coeur est oriente machine d'etat pour tracer clairement les enchainements d'events.

## 2) Modele de donnees (concept)

```ts
type Id = string
type Ms = number

type SceneDoc = {
  id: Id
  stories: Record<Id, StoryDoc>
  scenario: ScenarioGraph
  tracks: Record<Id, TrackDoc>
}

type StoryRef = {
  storyId: Id
  instanceId?: Id
}

type WaitMode = 'parallel' | 'suspendSource'

type StartWaitOptions = {
  waitStory: StoryRef
  fromStory?: StoryRef
  mode?: WaitMode
  reason?: string
  disableTracks?: 'auto' | Id[]
  hideFromStory?: boolean
  showWaitStory?: boolean
}

type ResolveWaitOptions = {
  waitId: Id
  resumePolicy?: 'fromCursor' | 'fromStart'
  restoreTracks?: boolean
  hideWaitStory?: boolean
  stopWaitStory?: boolean
}

type ScenarioGraph = {
  initialNodeId: Id
  nodes: Record<Id, ScenarioNode>
}

type ScenarioNode = {
  id: Id
  storyRef: StoryRef
  onEnter?: ScenarioCommand[]
  onExit?: ScenarioCommand[]
  transitions: ScenarioTransition[]
}

type ScenarioTransition = {
  toNodeId: Id
  priority: number
  when: {
    event: string
    where?: Record<string, unknown>
  }
}

type ScenarioCommand =
  | { type: 'startStory'; storyRef: StoryRef }
  | { type: 'stopStory'; storyRef: StoryRef }
  | { type: 'showStory'; storyRef: StoryRef }
  | { type: 'hideStory'; storyRef: StoryRef }
  | { type: 'gotoStory'; storyRef: StoryRef }
  | { type: 'startWait'; options: StartWaitOptions }
  | { type: 'resolveWait'; options: ResolveWaitOptions }

type StoryDoc = {
  id: Id
  clockMode?: 'timeline' | 'eventOnly'
  items: Record<Id, ItemDoc>
  straps: Record<Id, StrapDoc>
  eventNodes: EventNode[]
  endPolicy?: 'allChildren' | 'storyDriven'
}

type ItemDoc = {
  id: Id
  type: string
  initial: ItemState
  children?: Id[]
  actions: Record<string, ActionDoc>
  emit?: Record<string, EmitDef>
  listen?: ListenRule[]
  media?: MediaConfig
  list?: ListConfig
  blocksStoryEnd?: boolean
}

type StrapDoc = {
  id: Id
  actions: Record<string, ActionDoc>
}

type ActionDoc = {
  className?: string | { add?: string; remove?: string }
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
  move?: boolean | string | MoveDef
  transition?: TransitionDef
  strap?: string
  media?: MediaCommand
  payload?: Record<string, unknown>
}

type EventNode = {
  name: string
  startAt: Ms
  payload?: Record<string, unknown>
  events?: EventNode[]
}

type TrackDoc = {
  id: Id
  active: boolean
  order: number
  source: 'story' | 'user' | 'system'
  ownerStoryId?: Id
  events: TimelineEvent[]
}

type TimelineEvent = {
  id: Id
  ms: Ms
  name: string
  payload?: Record<string, unknown>
  index: number
  source: 'story' | 'user' | 'system'
  recordable?: boolean
}

type MediaCommand =
  | { type: 'play'; startAt?: Ms }
  | { type: 'pause' }
  | { type: 'seek'; at: Ms }
  | { type: 'rewind' }

type ListConfig = {
  autoAnimate?: {
    insert?: boolean
    remove?: boolean
    move?: boolean
    durationMs?: number
    easing?: string
    staggerMs?: number
  }
}
```

## 3) Machines d'etat (V1)

Reference table complete:

- `evolution/10-table-transitions-v1.md`

### PlayerMachine

`idle -> preloading -> ready -> playing <-> paused`

Transitions speciales:

- `seeking` (etat transitoire)
- `rewinding` (etat transitoire)
- `error`

### ScenarioMachine

`idle -> running <-> waiting -> error`

Regles:

- `running`: orchestration narrative normale
- `waiting`: un gate d'attente est actif, sans imposer l'arret global du player
- en `waiting`, d'autres stories/events peuvent continuer selon la policy du gate
- reprise de `waiting` est pilotee par `resolveWait`

### StoryMachine

`idle -> ready -> playing <-> paused -> ended`

Regles:

- `story ended` force `ended` sur tous les enfants
- `allChildren` termine la story quand tous les enfants bloquants sont `ended`
- `storyDriven` termine la story sur commande scenario

### PlayableMachine (story ou media)

`idle | playing | paused | ended | error`

Regles:

- commandes globales sequence prioritaires
- `seek` ne force pas `play`
- `rewind` remet a l'etat initial logique

## 4) Flatten des event nodes

Regle:

- `startAt` enfant est relatif au parent
- runtime produit un tableau plat `TimelineEvent[]`
- chaque event recupere un `index` stable (ordre d'ecriture)

Pseudo-regle:

`finalMs = parentMs + localStartAt`

## 5) Ordonnancement runtime

Tri global des events executes:

1. `ms` croissant
2. `track.order` croissant
3. `index` croissant
4. `source = user` apres les autres a `ms/order/index` equivalent

Reference conflits meme tick:

- `evolution/11-resolution-conflits-tick-v1.md`

Matching V1 event/action:

- egalite exacte (`event.name === actionKey`)
- pas de wildcard

## 6) Clock, ticker, fenetre de rattrapage

- resolution cible: 10 ms
- ticker raf: ~16.6 ms
- extraction des events dans `(prevMs, nowMs + margin]`

`margin` couvre jitter et pertes raf.

## 7) Event utilisateur et enregistrement

Flux:

1. UI emet un event dans le `bus`
2. conversion en `TimelineEvent` si `recordable=true`
3. insertion dans `userTrack`
4. traitement immediat

Politique V1:

- `recordable` par defaut: `false`
- mode d'enregistrement par defaut: `finalOnly`
- la piste user est activable/desactivable comme les autres

## 8) Preload et rebuild

Preload:

- obligatoire avant `play`
- tous les medias doivent etre disponibles avant demarrage

Politique erreur preload:

- mode editor: demarrage degrade autorise
- mode player: blocage

Rebuild:

- le mode (`state` ou `full`) est decide par l'hote via l'API
- aucun rebuild `full` implicite: toujours demande explicitement par l'editeur/hote
- `rebuild='state'` conserve les handles medias et l'identite des nodes (`nodeRef` stable)
- `rebuild='full'` autorise reset complet, recreation des nodes/plugins et preload complet

## 9) Sync media

Principes:

- les medias suivent le playhead sequence
- seuil de correction derive: 80 ms
- media `master` prioritaire pour la synchronisation (ex: voix)
- un seul master actif a la fois dans une scene

Regle seek media:

- calculer d'abord l'etat logique a `seekMs`
- appliquer `currentTime` seulement si etat logique compatible
- si etat logique `paused`, rester en pause

## 10) Instances de story

Convention id runtime:

`storyId#n/itemId`

Regles:

- isolation des etats par instance
- instances conservees pendant la vie de la sequence
- propagation d'event sans collision d'ids

## 11) Fin story et enfants infinis

Regle par defaut:

- `loop: infinite` => `blocksStoryEnd=false`

Ainsi, un element decoratif infini n'empeche pas la fin de story.

## 12) Pipeline action -> transition -> rendu

Etapes:

1. `transitionMachine`: calcul des transitions d'etat
2. `resolveTargets`: trouver les cibles action (items + straps)
3. `deriveTransition`: construire transitions auto (FLIP, liste, micro-anims)
4. `runAnimation`: transmettre transitions a animejs
5. `commitState`: appliquer etats finaux en queue de rendu

## 13) Contrat plugin (V1)

But plugin: side-effects et ajustement de transition.

Autorise:

- lire le contexte
- enrichir/adapter une transition
- produire des effets locaux

Interdit:

- emettre un event
- annuler une action

```ts
type Plugin = {
  name: string
  onAction?: (ctx: ActionCtx) => void
  onTransition?: (ctx: TransitionCtx, tr: TransitionDef) => TransitionDef
  onCommit?: (ctx: CommitCtx) => void
}
```

## 14) Trace machine (debug)

Chaque transition d'etat doit etre tracee:

```ts
type MachineTraceRow = {
  traceMs: Ms
  machine: 'player' | 'scenario' | 'story' | 'playable'
  id: Id
  from: string
  event: string
  to: string
  payload?: Record<string, unknown>
}
```

Objectif:

- comprendre pourquoi un event a produit un etat
- reproduire les enchainements en mode debug

## 15) Listen conditionnel (proposition)

```ts
type ListenRule = {
  event: string
  where?: Record<string, unknown>
  run: string
}
```

Version V1: filtre simple par egalite de champs.

## 16) Modes runtime

### Mode player

- logs minimum
- perf prioritaire

### Mode debug

- trace tick/events/actions/transitions machine
- inspection des tracks actives
- export du journal de rejeu

## 17) Librairies externes (hors animejs)

V1 propose: aucune obligatoire.

Options pertinentes (facultatives):

- `zod` (validation schema scene en entree)
- `vitest` (tests de determinisme et transitions)

Ces options ne sont pas requises dans le runtime final.

## 18) Creation de nodes par type

Chaque item runtime est cree via une factory unique `createElement`.

Regles V1:

- la creation initiale des nodes se fait a `init`
- un `rebuild='full'` recree les nodes
- un `rebuild='state'` ne recree pas les nodes
- la logique plugin locale est instanciee au meme endroit que le node

Contrat conceptuel:

```ts
type NodeRef = unknown

type RuntimeElement = {
  runtimeItemId: string
  nodeRef: NodeRef
  plugins?: Plugin[]
}

type CreateElement = (item: ItemDoc, ctx: CreateElementCtx) => RuntimeElement
```

## 19) Type `list` (conteneur enfants)

`type='list'` represente un conteneur qui ordonne des enfants et peut auto-animer:

- insertion d'enfant
- suppression d'enfant
- deplacement d'enfant

Regles V1:

- la detection `add/remove/move` est basee sur les IDs enfants stables
- le plugin de liste est cree dans `createElement` puis enregistre au runtime
- le plugin de liste ajuste les transitions mais n'emet pas de nouvel event runtime
- le placement visuel (`layout`, espacement, grille) reste pilote par CSS/editeur
- `ListConfig` V1 ne contient que `autoAnimate` (pas de `gap`, pas de hint layout)

Reference contrat plugin:

- `evolution/12-contrat-plugin-list-v1.md`

## 20) Plan d'events separe

Deux plans d'events coexistent sans se melanger:

- plan controle runtime (reserve): `player:*`, `runtime:*`, `track:*`, `media:*`, `system:*`
- plan contenu sequence (libre): noms metier choisis par l'auteur/editeur

Regle V1:

- matching event/action reste en egalite exacte
- les events de sequence ne doivent pas utiliser les prefixes reserves du controle runtime

Reference catalogue:

- `evolution/09-catalogue-events-techniques-v1.md`

## 21) Responsabilite hote sur le mode rebuild

Le moteur n'infere pas le mode rebuild a partir du contexte.

- l'hote fournit le mode a chaque commande (`state` ou `full`)
- l'hote configure les modes autorises
- en cas de mode non autorise, la commande est refusee (`REJECTED`)

Exemple d'intention:

- integration editeur: `state` et `full` autorises
- integration player final: `state` uniquement

## 22) Points de vigilance et traitement V1

### Suppression animee d'enfant (`remove`)

- un enfant a supprimer passe en etat `leaving`
- animation de sortie
- retrait physique du DOM/node en fin d'animation

### Reorder massif (`move`)

- strategie FLIP recommandee pour limiter les sauts visuels
- fallback degrade possible si la liste est trop grande (perf)

### Mesure layout fiable

- snapshot `before` avant commit
- snapshot `after` apres commit logique
- derive des deltas de position pour construire la transition `move`

### Enfants media dans une liste

- l'auto-layout ne doit pas casser les regles de synchro media
- les commandes globales player restent prioritaires
- une animation de deplacement ne modifie pas l'intent logique media (`playing/paused/ended`)

## 23) Compatibilite legacy (hors runtime)

Le runtime V1 ne consomme pas directement les objets legacy `persos` + `eventtimes`.

Regle V1:

- la compatibilite legacy est externalisee dans un convertisseur
- le moteur consomme uniquement `SceneDoc`

Reference normative:

- `evolution/07-compat-legacy-convertisseur-v1.md`

## 24) Story `eventOnly` (attente sans timeline)

Une story peut fonctionner sans timeline continue.

Regles V1:

- `clockMode='timeline'` (defaut): la story suit son playhead temporel
- `clockMode='eventOnly'`: la story n'avance pas seule dans le temps
- en `eventOnly`, la story reagit seulement aux events (souvent utilisateur)
- une story `eventOnly` peut servir de story d'attente/interruption

## 25) Suspension/reprise de story (usage frequent)

Cas cible:

- une story principale en lecture recoit un click utilisateur
- une story d'attente `eventOnly` est ouverte
- un autre click restaure la story principale

Invariants V1:

- le flux passe par une API scenario dediee (`startWait` / `resolveWait`)
- deux modes sont supportes:
  - `parallel` (defaut): la story source continue pendant l'attente
  - `suspendSource`: la story source est mise en pause et reprise ensuite
- en mode `suspendSource`, la reprise se fait au curseur gele (pas au `now` global)
- en mode `suspendSource`, les tracks source peuvent etre desactivees puis restaurees

## 26) Domaines de duree (a distinguer)

Le runtime distingue trois durees:

- `storyDurationMs`: duree propre d'une story `timeline`
- `timelineElapsedMs`: temps cumule de lecture timeline (augmente quand la timeline joue)
- `sessionElapsedMs`: temps reel de session (inclut les phases `eventOnly`)

Regles V1:

- une story `eventOnly` n'impose pas de `storyDurationMs`
- en mode `parallel`, `timelineElapsedMs` continue normalement
- en mode `suspendSource`, `timelineElapsedMs` de la story source est gele
- sortir d'une story d'attente applique la policy de reprise (`fromCursor` par defaut en `suspendSource`)

## 27) Form submit backend via strap (cas courant)

Cas cible:

- un formulaire est rendu dans une story d'attente
- le bouton valider declenche un submit
- un strap execute l'effet asynchrone (appel backend)
- en succes: la story courante se termine et le scenario poursuit
- en echec: la story d'attente reste active (retry possible)

Regles V1:

- la logique metier et les side-effects restent dans le strap
- le player ne passe pas en pause globale pour ce cas
- tant que l'effet est `pending`, le gate d'attente reste actif
- un succes d'effet peut declencher `resolveWait` puis `gotoStory`/`stopStory`
- un echec d'effet n'entraine pas de transition implicite (decision explicite du strap)

## 28) ScenarioGraph minimal V1 (norme)

Le graphe scenario est declaratif et serialisable (aucune fonction runtime dans le document scene).

Regles V1:

- `initialNodeId` doit exister dans `nodes`
- chaque `ScenarioNode.id` doit matcher sa cle dans `nodes`
- chaque `ScenarioTransition.toNodeId` doit exister dans `nodes`
- `when.event` est obligatoire et matche les events par egalite exacte
- `when.where` applique un filtre simple par egalite de champs
- evaluation des transitions: `priority` decroissante, puis ordre de declaration
- en absence de transition valide: node courant conserve

Validation au chargement (bloquante):

- `SCENARIO_INITIAL_NODE_NOT_FOUND`
- `SCENARIO_NODE_ID_MISMATCH`
- `SCENARIO_TRANSITION_TARGET_NOT_FOUND`
- `SCENARIO_INVALID_WHEN_EVENT`
