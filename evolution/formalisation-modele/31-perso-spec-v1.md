# Perso spec V1 - contrat normalise

## Statut

Spec normative V1 pour le contrat `Perso` dans Codplay.

## Objectif

Figer une base unique pour:

- la definition d'un `Perso`
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
  type: T
  initial: PersoTypeRegistry[T]["initial"]
  actions: PersoActions<Id, T>
  emit?: PersoEmit
}
```

## Regles normatives

1. Identite

- `id` est unique dans une instance de `Story`.
- `type` est la denomination unique du type de composant.

2. Extensibilite

- `PersoTypeRegistry` est extensible par augmentation de type.
- tout nouveau `type` declare exactement `initial` et `action`.

3. Initial

- `initial` decrit l'etat de construction du node du `Perso`.
- `initial` ne porte pas le state runtime mutable.

4. Actions

- `actions` est un dictionnaire `eventName -> action` type par `Perso.type`.
- `actions` contient obligatoirement l'auto-reference `actions[id] = null`.
- l'auto-reference est presente en sortie de normalisation.

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
{ "name": "counter-text", "data": { "content": "19" } }
```

## Emit (provisoire)

`emit` est une propriete racine de `Perso`.

Regles:

- la cle principale est le nom d'event utilisateur (`click`, `input`, `mouseenter`, ...).
- chaque entree decrit l'event cree via `event.name` et `data`.
- la sortie runtime ajoute une origine normalisee via `origin`.

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
    "persoId": "text3",
    "userEvent": "click"
  }
}
```

## Invariants Perso V1

- un `Perso` expose un `type` unique et type ses `actions` sur ce `type`.
- `actions[id] = null` est obligatoire apres normalisation.
- un event cible perso transporte l'action dans `data`.
- `emit` reste provisoire et produit des events runtime traces par `origin`.
