# Scene V2

> Status: En cours
> CodPlay version: V2 foundation

Ce document décrit la forme auteur d’une scène CodPlay V2 (`SceneDoc`). Une
scène est une description sérialisable d’un scénario : elle regroupe des
stories, leurs persos, leurs données initiales, leurs actions et leur journal
temporel. Elle est ensuite compilée en `CompiledScene` avant d’être remise au
player.

## Forme minimale

```ts
const scene: SceneDoc = {
  id: 'my-scene',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'title',
          type: 'tag',
          initial: { content: 'Hello' },
          actions: { title: null },
        },
      ],
    },
  },
}
```

Les deux propriétés obligatoires sont `id` et `stories`. La clé de chaque
entrée de `stories` doit être identique à `story.id`. Chaque perso doit avoir
un `id`, un `type` et l’auto-référence `actions[perso.id] = null`, qui est la
déclaration de son action propre.

## Propriétés de `SceneDoc`

| Propriété | Obligatoire | Rôle |
| --- | --- | --- |
| `id: string` | Oui | Identité stable de la scène. Elle ne doit pas être vide. |
| `name?: string` | Non | Libellé humain de la scène. Il n’a pas de rôle dans l’identité. |
| `stories: Record<string, StoryDoc>` | Oui | Stories de la scène, indexées par leur identifiant. |
| `initial?: AuthorRecord` | Non | Profil initial au niveau scène, notamment les données de placement ou de présentation communes. |
| `straps?: AuthorStrapDeclarations` | Non | Straps appartenant à la scène : soit une collection `{ nom: fonction }`, soit une liste de noms de straps réutilisables fournis par l’hôte. |
| `listen?: SceneListenRule[]` | Non | Règles d’écoute scène. Une règle indique l’event `on`, puis peut transformer l’event, émettre des données et invoquer des straps. |
| `eventimes?: AuthorRecord[]` | Non | Occurrences temporelles relatives partagées par toutes les stories. C’est ici qu’une factory peut déclarer la borne de la scène avec `{ name: 'sequence:end', startAt }`. |
| `state?: AuthorRecord` | Non | État logique initial porté par la scène et disponible aux mécanismes de capture et de lifecycle. |
| `tracks?: AuthorRecord` | Non | Configuration des tracks de la scène. Si elle est omise, le builder produit `{}`. |
| `init?: SceneLifecycleFunction` | Non | Callback de lifecycle de la scène, exécuté via la frontière de compilation/runtime. |
| `onStart?: SceneLifecycleFunction` | Non | Callback associé au démarrage de la scène. |
| `onSequenceEnd?: SceneLifecycleFunction` | Non | Callback associé à la fin de séquence. Il ne définit pas la durée : la fin temporelle est déclarée par un eventime `sequence:end`. |
| `defaults?: AuthorRecord` | Non | Overrides de propriétés autorisées par le registre du composant. Ce n’est pas un sac de valeurs libre et ce n’est pas une durée. |

Toutes les propriétés sont en lecture seule dans le contrat TypeScript. Les
fonctions des callbacks et des straps ne sont pas placées dans l’artefact JSON :
le builder les extrait dans la collection de fonctions associée à la scène et
conserve seulement leurs références dans `CompiledScene`.

### À quoi sert `defaults` ?

`defaults` sert à fournir, au niveau de la scène, une valeur de remplacement
pour une propriété autorisée par le registre du composant lorsqu’aucun default
universel ne convient. La résolution suit cet ordre : valeur explicite de
`initial`, valeur disponible dans un event ou une action, override de
`scene.defaults`, default du catalogue de propriété/composant, puis diagnostic
si aucune valeur déterministe n’existe.

Le contenu de `defaults` doit donc rester dans les namespaces de propriétés
connus par le registre. Il ne sert ni à configurer le DOM, ni à déclarer des
cibles de montage, ni à définir la longueur de la timeline. Les valeurs de
base communes restent dans le contrat du composant afin que chaque scène n’ait
pas à les recopier.

## `eventimes` : temporalité de la scène

Un eventime est une occurrence relative :

```ts
{
  name: 'sequence:end',
  startAt: 8_000,
  visibility: 'scene',
  data: { reason: 'authored-boundary' },
  events: [
    { name: 'cleanup', startAt: 0 },
  ],
}
```

Les propriétés reconnues sont :

- `name: string` : nom de l’event ;
- `startAt: number` : position relative en millisecondes, supérieure ou égale
  à zéro ;
- `visibility?: 'story' | 'scene' | 'public'` : portée de visibilité ;
- `data?: Record<string, unknown>` : données de l’event ;
- `events?: eventime[]` : occurrences enfants, relatives à l’occurrence
  parente.

`scene.eventimes` est appliqué à chaque story compilée. Une story peut aussi
porter son propre `story.eventimes` pour ses occurrences locales. Les deux
niveaux sont conservés et fusionnés par le runtime selon leur portée ; ils ne
doivent pas être remplacés par un champ `durationMs`.

Une scène sans event `sequence:end` reste à horizon ouvert : aucune durée de
scène séparée n’est fournie lors de la création de l’instance. Si une durée
fixe est nécessaire, la factory l’exprime dans la scène :

```ts
const SCENE_DURATION_MS = 8_000

return {
  id: 'my-scene',
  eventimes: [{ name: 'sequence:end', startAt: SCENE_DURATION_MS }],
  stories: { /* ... */ },
}
```

## Propriétés d’une `StoryDoc`

Les stories sont les branches d’exécution d’une scène.

| Propriété | Obligatoire | Rôle |
| --- | --- | --- |
| `id: string` | Oui | Identité de la story ; elle doit correspondre à sa clé dans `scene.stories`. |
| `name?: string` | Non | Libellé humain. |
| `trackId?: string` | Non | Track logique auquel la story est rattachée. |
| `initial?: AuthorRecord` | Non | État initial de la story, notamment son placement. |
| `persos: PersoDoc[]` | Oui | Persos matérialisés et pilotés par la story. |
| `tracks?: AuthorRecord` | Non | Configuration des tracks propres à la story. |
| `straps?: AuthorStrapDeclarations` | Non | Straps locaux à la story ou noms de straps réutilisables. |
| `listen?: SceneListenRule[]` | Non | Règles d’écoute limitées à la story. |
| `eventimes?: AuthorRecord[]` | Non | Occurrences temporelles propres à cette story. |
| `state?: AuthorRecord` | Non | État logique de la story. |
| `init?: AuthorFunction` | Non | Fonction d’initialisation de la story. |
| `disabled?: boolean` | Non | Désactive la story lors de la compilation. Ce marqueur auteur n’est pas conservé comme propriété runtime de la story compilée. |

## Propriétés d’un `PersoDoc`

Un perso représente une entité pilotée par un composant.

| Propriété | Obligatoire | Rôle |
| --- | --- | --- |
| `id: string` | Oui | Identité du perso dans sa story. |
| `name?: string` | Non | Libellé humain. |
| `type: string` | Oui | Type de composant (`tag`, `img`, `input`, `layout`, `list`, `media`, `polygon`, ou composant enregistré par l’hôte). |
| `initial?: object` | Non | Profil initial du composant, validé selon `type`. Il peut contenir les champs communs (`className`, `style`, `attr`, `move`) et les champs propres au composant. |
| `actions?: Record<string, ActionValue>` | Oui en pratique | Actions nommées du perso. La forme canonique contient au minimum `actions[perso.id] = null`; les autres clés déclarent les actions ciblables. |
| `list?: object` | Non | Données de rattachement ou de gestion de liste lorsque le composant et le contrat concerné les utilisent. |
| `emit?: AuthorEmitDeclaration` | Non | Déclarations d’émission/capture associées aux entrées ou events du perso. |

La liste exacte des propriétés de `initial` et des actions dépend du composant
déclaré par `type`. La scène ne définit donc pas une grande liste générique de
propriétés de composant : le catalogue V2 du composant porte leur validation,
leurs defaults et leur mode temporel.

## Passage à `CompiledScene`

`SceneDoc` est la forme écrite par l’auteur. Le builder :

1. normalise les absences structurelles (`listen: []`, `tracks: {}` et les
   profils canoniques) ;
2. valide les identités, les références et les propriétés par rapport au
   catalogue des capacités ;
3. extrait les fonctions et prépare les valeurs sérialisables ;
4. compile les `eventimes` scène et story ;
5. produit l’artefact `CompiledScene`.

L’enveloppe compilée ajoute des données dérivées au payload de la scène :

```ts
{
  schemaVersion,
  createdAt,
  scene,              // propriétés de SceneDoc compilées
  resources,          // manifeste déduit des références
  rootNodeIds,        // racines déduites des placements
  requirements,       // composants, services, modules, ressources
  actionTargetIndex,  // index dérivé des actions
}
```

`rootNodeIds`, `resources`, `requirements` et `actionTargetIndex` ne sont donc
pas des propriétés à écrire dans `SceneDoc`. De même, la racine DOM appartient
à l’instance HTML et ne fait pas partie du contrat de la scène.

## Propriétés exclues du contrat V2

Les propriétés suivantes ne doivent plus être ajoutées à une scène ou aux
options publiques de création d’instance :

- `durationMs` : la borne temporelle est un eventime `sequence:end` injecté par
  la factory si nécessaire ;
- `mountTargets` : le montage DOM est résolu par le host/runner à partir des
  racines et des tokens de placement (`@root`, `@off`, etc.) ;
- `rootTargets` : détail interne du runner HTML, pas une propriété auteur ;
- une propriété générique `events` distincte de `eventimes` : les occurrences
  temporelles se déclarent dans `eventimes`, au niveau scène ou story.

Références techniques : [`SceneDoc`](./types.ts),
[`CompiledScene`](./compiled/types.ts) et le
[`plan de compilation de scène`](../../plan/compiled-scene-plan.md).
