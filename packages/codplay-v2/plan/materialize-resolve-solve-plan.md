# CodPlay V2 - tranche materialize, resolve et solve

## Statut

> Status: En cours
> CodPlay version: V2 foundation
> Review: required before components

## Frontiere

Cette tranche consomme uniquement un `CompiledScene` et une position temporelle.
Elle ne lit pas le DOM, ne cree pas de composant et ne produit aucun effet externe.

```text
CompiledScene + timeMs
        -> materialize
        -> MaterializedScene
        -> resolve
        -> ResolvedScene
        -> solve
        -> SolvedScene
```

## Materialize

`materializeScene(scene, timeMs)` construit d'abord le registre statique des tracks,
puis selectionne les occurrences discretes actives dont `startAt <= timeMs` et les
associe aux persos concernes. Il conserve l'ordre chronologique, l'ordre des tracks,
puis l'ordre de declaration pour les occurrences au meme instant.

Materialize :

- ne modifie pas `CompiledScene`;
- ne prepare pas de tween;
- ne lit pas le DOM;
- ne rejoue pas de strap;
- porte l'elapsed time de chaque action active vers l'etape suivante.
- ignore les occurrences des tracks desactivees;
- preserve les metadonnees de track et le chemin de declaration dans l'action materialisee.

La premiere tranche reconnait les declarations statiques `global`, story, `story.trackId`,
scene et story. Elle ne permet pas encore d'ajouter une track pendant la lecture.
Elle reconnait les eventimes `{ name, startAt, data?, events? }`.

Le `RuntimeTrackJournal` porte les events live hors de `CompiledScene`. Il refuse une
track inconnue, attribue un `eventSeq` monotone, accepte les controles scene-level
`track:activate`, `track:deactivate` et `track:toggle` sans creer de track, et ancre
les eventimes relatifs runtime sur une position absolue.
Les enfants portent des temps relatifs et sont aplatis en temps absolus. Le chemin
de declaration sert de tie-breaker stable pour les occurrences au meme instant.
Une action `null` peut utiliser `event.data` comme payload d'action selon la regle
canonique V1.

## Resolve

`resolveScene(materialized)` produit un etat de perso resolu :

- les patches `className` sont appliques dans l'ordre materialise;
- les tweens `style` scalaires sont prepares et resolus par ACE;
- les couleurs sont normalisees par l'adapter avant ACE;
- les donnees compilees ne sont jamais mutilees.

Resolve ne compose pas encore les ancetres et ne projette pas vers un substrat.

Les patches d'etat portes par `runtime:state:update` sont reconstruits par
`materialize` dans `sceneState` ou `storyStates` selon leur scope. Cette memoire est
derivee du journal et ne devient pas une mutation cachee du renderer.

## Solve

`solveScene(resolved)` etablit la sortie stable de la tranche et preserve les
identites `storyId:persoId`. La premiere extension resout les placements `@root`,
`@off` et `parentId` via le registre interne de cibles. Elle ne resout pas encore
le graphe parent/enfant, l'ordre des descendants, les transforms d'ancetres ou les mesures.

Le solve hierarchique sera une extension de cette frontiere, pas une modification
de `materialize` ou de `resolve`. Les IDs de cible sont opaques et uniques dans
une scene ; leur origine (`perso`, `host`, `outlet` ou racine de story) provient
d'un registre interne de cibles, jamais de la forme du nom. Les conventions de
nommage auteur ne sont donc pas un discriminant. Les factories externes qui
instancient des stories ou des persos doivent garantir l'unicite des IDs avant
leur entree dans ce registre.

## Invariants

- Une evaluation depend uniquement de `CompiledScene` et `timeMs`.
- Un temps invalide est refuse avant l'evaluation.
- Aucun traitement de cette tranche n'ecrit dans le DOM ou dans un composant.
- Aucun event discret n'est transforme en effet externe.
- Les valeurs ACE sont preparees avant leur resolution.
- Les sorties portent des types de tranche nommes, pas un `CompiledRecord` ambigu au
  niveau de la frontiere complete.

## Hors perimetre

- tracks et listen complets;
- straps et listen complets;
- straps et emissions;
- `live`, capture et DnD;
- hierarchie, move, FLIP et matrices d'ancetres;
- media, preload et services runtime;
- composants et renderer de production.

## Validation

La tranche est couverte par `tests/runtime/player/pipeline.spec.ts` et reste exercee
par la demo temporaire `demos/validation/player`. La demo est un banc visible, pas
la definition du contrat final.
