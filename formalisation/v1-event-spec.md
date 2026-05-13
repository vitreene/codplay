# Event spec V1 - enveloppe canonique

## Statut

Spec normative V1 pour les events dans Codplay.

## Objectif

Figer une enveloppe unique d'event pour la compilation, l'execution runtime, le replay et l'observabilite.

## Contrat canonique

```ts
type EventContext = {
  source: "scene" | "story" | "perso" | "strap" | "system"
  storyId?: string
  persoId?: string
  userEvent?: string
}

type StoryEvent = {
  name: string
  data?: Record<string, unknown>
  cascade?: boolean
  context?: EventContext
}

type RuntimeEvent = {
  eventId: string
  eventSeq: number
  name: string
  data?: Record<string, unknown>
  cascade: boolean
  applyAtMs: number
  context: EventContext
  meta?: Record<string, unknown>
}

type StoryEventimeNode = {
  name: string
  startAt: number
  data?: Record<string, unknown>
  events?: StoryEventimeNode[]
}
```

## Regles normatives

1. Enveloppe unique

- `StoryEvent` est la forme de travail dans le pipeline Story.
- `RuntimeEvent` est la forme normalisee, journalisee par le Director.

2. Nommage

- `name` est obligatoire.
- la convention V1 recommande un namespace explicite: `domaine:entite:action`.
- des conventions telles que `sequence:intro:start` sont valides, sans traitement compile-time special.
- les events qui ciblent directement un perso utilisent l'identifiant runtime du perso en `name`.
- les noms systeme (`scene:*`, `story:*`, `runtime:*`) sont reserves par convention pour le moteur.
- en V1, le nommage reste conventionnel: aucun blocage automatique compile-time n'est impose par cette spec.

3. Propagation

- `cascade` est booleen.
- `cascade: false` ou absent: domaine local story.
- `cascade: true`: publication globale vers `Scene`.
- la portee d'un event est decidee au cas par cas selon la spec locale story / globale scene.
- un event n'adresse jamais une story cible par identifiant.

4. Context

- `context` est rempli et preserve par le runtime.
- `context` est obligatoire dans `RuntimeEvent`.
- un event issu de `Perso.emit` renseigne `context.persoId` et `context.userEvent`.
- les donnees metier et utilisateur (ex: `x`, `y` d'un `mousemove`) sont portees par `event.data`, pas par `context`.

5. Determinisme

- `eventSeq` est assigne uniquement par le Director.
- `applyAtMs` est assigne par le runtime/Director pour tous les events normalises.
- cette regle inclut les events utilisateur haute frequence.
- a entree identique, l'ordre final des `RuntimeEvent` est identique.

6. Payload

- aucune limite normative de taille de payload n'est imposee en V1.

7. Eventimes relatifs

- `StoryEventimeNode` decrit des emissions relatives portables.
- `startAt` est en millisecondes relatives.
- `events` porte les enfants relatifs du noeud parent.
- le runtime ou le build convertit en `RuntimeEvent.applyAtMs` absolu via ancrage.

8. Compatibilite `transform`

- quand un event passe par `Scene.listen.transform` ou `Story.listen.transform`, la valeur retournee remplace `event.data`.
- si un `transform` retourne `undefined`, `event.data` devient `undefined` et un warning runtime est emis.
- `transform` ne modifie jamais `name`, `cascade`, `context` ou `meta`.

## Exemple

```json
{
  "name": "counter_progress",
  "data": { "progress": 42.5 },
  "cascade": true,
  "context": {
    "source": "strap",
    "storyId": "story-counter"
  }
}
```

## Invariants Event V1

- un event n'adresse jamais une story cible par identifiant.
- `context` est present dans les events runtime.
- `eventSeq` est l'autorite unique d'ordre runtime.
