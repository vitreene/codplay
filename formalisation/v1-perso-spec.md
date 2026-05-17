# Perso spec V1 - contrat normalise

## Statut

Spec normative V1 pour le contrat `Perso` dans Codplay.

## Objectif

Figer une base unique pour:

- la definition d'un `Perso`
- la distinction `name` auteur / `id` runtime
- le typage `actions` par `type`
- la resolution des events vers les actions d'un `Perso`
- la forme provisoire de `emit`

## Contrat canonique

```ts
export interface PersoTypeRegistry {
  text: { initial: TextInitial; action: TextAction }
  img: { initial: ImgInitial; action: ImgAction }
  video: { initial: VideoInitial; action: VideoAction }
  sound: { initial: SoundInitial; action: SoundAction }
  list: { initial: ListInitial; action: ListAction }
  layer: { initial: LayerInitial; action: LayerAction }
}

export type PersoType = keyof PersoTypeRegistry

export type PersoActions<Id extends string, T extends PersoType> =
  Record<string, PersoTypeRegistry[T]["action"]> &
  Record<Id, null>

export type PersoEmitAction = {
  event: { name: string }
  data?: Record<string, unknown>
}

export type PersoEmit = Record<string, PersoEmitAction | PersoEmitAction[]>

export type Perso<Id extends string = string, T extends PersoType = PersoType> = {
  id: Id
  name: string
  type: T
  initial: PersoTypeRegistry[T]["initial"]
  actions: PersoActions<Id, T>
  emit?: PersoEmit
}
```

Extension V1 pour la synchronisation master:

```ts
type PersoInitialCommon = {
  master?: boolean
}

type BroadcastAction = {
  type: "START" | "PAUSE" | "STOP"
  transition?: {
    from?: Record<string, unknown>
    to?: Record<string, unknown>
    duration?: number
  }
}

type PersoActionCommon = {
  broadcast?: BroadcastAction
}

type EmitSelf = {
  id: string
  name: string
  storyId: string
}

type PersoTransitionTiming = {
  duration?: number
  delay?: number
  loopDelay?: number
  reversed?: boolean
  alternate?: boolean
  loop?: boolean | number
  ease?: string
  stagger?: number
  ignoreDuration?: boolean
}
```

## Regles normatives

1. Identite

- `name` est l'identite auteur du `Perso`.
- `name` est indicatif et destine a l'ecriture, a l'edition et a la lecture auteur.
- si aucun `name` n'est fourni a la creation, un `name` est genere.
- `id` est l'identifiant canonique runtime du `Perso`.
- `id` est immuable apres creation.
- `id` est toujours utilise pour les transactions runtime.
- `name` n'est jamais une cle transactionnelle runtime.
- l'unicite effective des `id` d'elements est verifiee a `scene.init`.
- en cas de collision d'`id`, un warning runtime est emis.
- `type` est la denomination unique du type de composant.

2. Nommage generique

- le systeme de creation peut generer des `name` de facon generique.
- pour l'instanciation a partir d'un modele, un schema `name + discriminant genere` est autorise.
- le `discriminant` sert a distinguer plusieurs instances auteur semblables.
- l'auteur doit pouvoir connaitre le `name` effectif et l'`id` effectif apres creation.

3. Extensibilite

- `PersoTypeRegistry` est extensible par augmentation de type.
- tout nouveau `type` declare exactement `initial` et `action`.

4. Initial

- `initial` decrit l'etat de construction du node du `Perso`.
- `initial` ne porte pas le state runtime mutable.

5. Actions

- `actions` est un dictionnaire `eventName -> action` type par `Perso.type`.
- `actions` contient obligatoirement l'auto-reference `actions[id] = null`.
- l'auto-reference est presente en sortie de normalisation.
- quand un event cible directement un perso, le ciblage se fait par `id`, jamais par `name`.
- quand une action `style` decrit une transition animee, elle peut transporter les options de timing compatibles runtime: `duration`, `delay`, `loopDelay`, `reversed`, `alternate`, `loop`, `ease`, `stagger`.
- ces options sont purement descriptives et ne changent pas la semantique de portee ou de propagation des events.
- `ignoreDuration: true` permet d'indiquer explicitement qu'une transition ne contribue pas au calcul de duree de sequence.
- l'absence de `ignoreDuration` signifie que la transition contribue normalement au calcul de duree via sa `duration` et son `delay` quand ils existent.

6. Master clock

- `initial.master` est autorise pour tout `Perso` au niveau contrat.
- en pratique V1, `master` est attendu principalement sur des persos media (`sound`, `video`).
- `master: true` marque une source temporelle candidate pour l'horloge runtime.
- un seul master peut etre actif a un instant donne.
- quand plusieurs masters sont actives, le dernier active devient prioritaire.
- l'arbitrage des masters precedents suit `masterClock.previousMasterAction` (policy runtime).

7. Broadcast

- `broadcast` est une action du `Perso` et non une API parallele.
- `broadcast.type` accepte `START`, `PAUSE`, `STOP`.
- `broadcast.transition` decrit une transition de lecture (ex: volume) appliquee au composant cible.
- `broadcast` pilote l'etat de lecture du composant sans imposer une decision de propagation event.

## Contrat event applique a un Perso

Forme event:

```ts
type StoryEvent = {
  name: string
  data?: unknown
}
```

Regles d'application:

- un `Perso` traite un event seulement si `event.name` existe dans `perso.actions`.
- event sans data: `{ name: "actionName" }`.
- event cible perso: `{ name: "persoId", data: PersoActionType }`.
- quand `event.name === perso.id`, la valeur `event.data` est l'action appliquee au `Perso`.

Exemple canonique:

```json
{ "name": "story-counter__counter-text", "data": { "content": "19" } }
```

## Emit (provisoire)

`emit` est une propriete racine de `Perso`.

Regles:

- la cle principale est le nom d'event utilisateur (`click`, `input`, `mouseenter`, ...).
- chaque entree decrit l'event cree via `event.name` et `data`.
- la sortie runtime ajoute une origine normalisee via `origin`.
- au moment de l'emission, un contexte minimal `self` est disponible.
- `self.id` expose l'identifiant runtime courant du perso emetteur.
- `self.name` expose le `name` auteur courant du perso emetteur.
- `self.storyId` expose l'identifiant de la story qui porte le perso emetteur.
- `self` sert a enrichir un payload ou a relier un event a son emetteur sans introduire de ciblage explicite d'event.

Forme runtime de sortie:

```ts
type RuntimeEvent = {
  name: string
  data?: Record<string, unknown>
  origin: {
    persoId: string
    userEvent: string
  }
}
```

Exemple:

```ts
emit: {
  click: {
    event: { name: "click01" },
    data: {
      id: "telco",
      strap: {
        type: "toggle",
        initial: {
          valueA: "on",
          valueB: "off"
        }
      }
    }
  }
}
```

Sortie runtime correspondante:

```json
{
  "name": "click01",
  "data": {
    "id": "telco",
    "strap": {
      "type": "toggle",
      "initial": {
        "valueA": "on",
        "valueB": "off"
      }
    }
  },
  "origin": {
    "persoId": "story-main__text3",
    "userEvent": "click"
  }
}
```

## Invariants Perso V1

- un `Perso` expose un `id` runtime canonique et un `name` auteur.
- `id` est immuable et transactionnel; `name` est indicatif.
- `actions[id] = null` est obligatoire apres normalisation.
- un event cible perso transporte l'action dans `data` et utilise `id` en `name`.
- `emit` reste provisoire et produit des events runtime traces par `origin`.
- `self.id`, `self.name` et `self.storyId` sont disponibles lors d'un `emit` perso.
- `master` est une propriete `initial` de `Perso`.
- l'unicite de master actif est garantie par policy runtime.

## Exemple action master

```ts
action02: {
  move: { to: ROOT, order: 10 },
  broadcast: {
    type: START,
    transition: {
      from: { volume: 0.2 },
      to: { volume: 1 },
      duration: 1000
    }
  }
}
```
