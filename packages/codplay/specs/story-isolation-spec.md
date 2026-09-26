# CodPlay V2 — isolation exclusive déclarative des stories

## Périmètre vérifié

Le contrat ci-dessous couvre l'activation déclarative d'une story, la
conservation des faits dans le journal, la clôture de période et le routage
ciblé. Les chemins de compilation et de lecture sont couverts par les tests
ciblés ; le parcours réel de la démo `position`, y compris Seek, a été exercé
dans Safari. Le parcours complet d'acceptation est décrit dans le
[plan d'isolation](../plan/story-isolation-plan.md).

## Objet

Une instance CodPlay peut jouer plusieurs stories successivement dans le même
journal et la même scène. L'isolation contrôle les effets produits par les
événements adressés aux stories inactives.

Une instance possède au plus une zone d'isolation active. Une activation ouvre
une nouvelle période de projection pour une story ; une désactivation clôt la
période courante. Les faits déjà inscrits dans le journal ne sont jamais
effacés.

Cette capacité n'est pas :

- `StoryDoc.disabled`, qui retire statiquement une story avant la compilation ;
- l'activation ou la désactivation d'une `RuntimeTrack` ;
- un changement de visibilité, un montage ou un démontage DOM ;
- un reset logique ;
- un manager de stories ou une API publique parallèle.

## Déclaration auteur

Une règle `listen` portée par une story accepte une propriété booléenne
`active` :

- `active: true` ouvre une nouvelle période d'isolation ;
- `active: false` clôt la période de la story adressée ;
- l'absence de `active` ne modifie pas l'isolation.

Le nom et les données de l'événement restent opaques. L'effet est porté par la
règle déclarative, pas par une propriété ajoutée à l'événement.

```ts
const POSITION_STORY_FIVE_ENTER = 'position:story-five:enter'
const POSITION_STORY_FIVE_LEAVE = 'position:story-five:leave'

const positionStoryFiveListen = [
  {
    on: POSITION_STORY_FIVE_ENTER,
    active: true,
    reset: true,
  },
  {
    on: POSITION_STORY_FIVE_LEAVE,
    active: false,
  },
]
```

L'activation et la désactivation sont uniquement des règles de `story.listen`.
Une règle `active` déclarée au niveau de la scène est invalide : une émission
de scène ne choisit pas implicitement la story qui doit être réveillée.

La cible reste séparée de l'événement :

```ts
instance.events.emit(
  { name: POSITION_STORY_FIVE_ENTER },
  { scope: 'story', storyId: 'position-story-five' },
)
```

## Index d'activation

La compilation construit, pour chaque story, un index exact
`eventName -> activation rule` à partir des règles dont `active === true`.
L'index est interne au `CompiledScene` et au runtime ; il n'est pas exposé à
l'auteur.

La lecture ne sonde donc pas `event.data`, ne devine pas la présence d'une
propriété et ne parcourt pas toutes les règles : pour une story inactive, le
dispatcher fait une recherche exacte dans cet index. Deux règles d'activation
pour le même événement et la même story constituent une déclaration ambiguë et
doivent produire un diagnostic de compilation.

## Routage d'une story inactive

Une story inactive n'est pas supprimée du journal et n'est pas désabonnée de
la scène. Le dispatcher applique la séquence suivante pour un événement qui
lui est adressé :

1. l'événement source est ajouté une seule fois au journal ;
2. l'index d'activation de la story est consulté ;
3. le test vérifie qu'un événement story ordinaire reste au journal sans
   projeter l'action de la story inactive ; la suppression des autres effets
   `listen` n'est pas certifiée par ce test et reste au plan ;
4. avec une règle `active: true`, la nouvelle période est ouverte avant les
   événements story suivants, qui peuvent alors être projetés.

`active: true` est donc une règle de réveil évaluée avant le filtre appliqué
aux stories inactives. Une story inactive peut toujours recevoir l'événement
qui la réactive.

Une règle `active: false` clôt la période si la story adressée en est la
propriétaire. Si elle ne l'est pas, l'opération est idempotente et ne touche
pas la période d'une autre story.

## Transition atomique et reset

`active: true` peut être combiné avec `reset: true` dans la même règle. Les deux
opérations appartiennent à la même frontière `(applyAtMs, eventSeq)` :

- l'ancienne période éventuelle est clôturée ;
- la nouvelle période reçoit une nouvelle identité interne ;
- le reset établit la frontière de projection de la story ;
- les effets de la règle sont évalués sans état intermédiaire observable.

Une nouvelle activation de la même story ferme donc son activation précédente
et ne réutilise jamais son identité.

Les autres mécanismes de `listen` restent dans le pipeline existant
`listen -> transform -> straps -> emit`.

## Invariants

- une nouvelle activation ferme la période précédente ;
- aucune donnée n'est supprimée ou compactée lors d'une clôture ;
- l'action ordinaire de la story inactive n'est pas projetée, comme le vérifie
  le test de routage ; la suppression des transforms/straps/emits/reset reste
  une gate du plan ;
- `active: true` et `reset: true` forment une transition unique ;
- une clôture par `active: false` est idempotente ;
- les événements de portée `scene` restent indépendants de l'isolation.

## Hors périmètre

- API publique `story.active()` ou gestionnaire de stories ;
- instanciation d'une scène supplémentaire ;
- activation implicite par un événement de scène non ciblé ;
- scheduler supplémentaire ;
- suppression, réécriture ou compaction du journal ;
- changement automatique de visibilité ou de montage DOM.

## Preuves du contrat

- `tests/scene/compiled/scene-builder.spec.ts` couvre l'index d'activation,
  les règles en doublon et le refus des déclarations au niveau scène ;
- `tests/runtime/player/story-isolation.spec.ts` couvre le réveil, les faits
  conservés au journal, la transition atomique avec reset, la clôture
  idempotente et l'indépendance des événements de scène ;
- les réactivations successives sont aussi exercées dans
  `tests/facade/position-demo.spec.ts`.
