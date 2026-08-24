# CodPlay V2 - tranche materialize, resolve et solve

## Statut

> Status: Fixe
> CodPlay version: V2 foundation
> Review: tranche structurelle validée le 2026-08-20; transforms, mesures et capacités supplémentaires restent ouvertes

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
- derive les steps `ActionSequence` depuis leur occurrence source sans les append dans le journal;
- invalide les steps différés remplacés par une occurrence ultérieure de la même clé;
- traite `tween:stop` comme une frontière logique, jamais comme un patch de perso.

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
La table `perso.actions` est entièrement déclarée dans `CompiledScene` : le
runtime ne crée pas d'action. Un event ou une capture sélectionne une clé
existante et peut seulement lui fournir un payload dynamique selon la policy de
fusion prévue.
Les events globaux marques `cascade` sont inclus dans la materialisation de chaque
story; les events locaux restent limites a leur story. Les outputs de straps et les
patches d'etat suivent exactement la meme selection de journal.

## Resolve

`resolveScene(materialized, functions?)` produit un etat de perso resolu :

- les patches `className` sont appliques dans l'ordre materialise;
- les tweens `style` scalaires sont prepares et resolus par ACE;
- les couleurs sont normalisees par l'adapter avant ACE;
- les `TweenAction` compilées appellent leur fonction extraite avec un progrès
  pur et leur payload retourne passe par la même application d'action;
- les donnees compilees ne sont jamais mutilees.

Resolve ne compose pas encore les ancetres et ne projette pas vers un substrat.

Les patches d'etat portes par `runtime:state:update` sont reconstruits par
`materialize` dans `sceneState` ou `storyStates` selon leur scope. Cette memoire est
derivee du journal et ne devient pas une mutation cachee du renderer.

## Solve

`solveScene(resolved)` etablit la sortie stable de la tranche et preserve les
identites `storyId:persoId`. La premiere extension resout les placements `@root`,
`@off` et `parentId` via le registre interne de cibles. Elle ne resout pas encore
les transforms d'ancetres ou les mesures. Elle construit maintenant le graphe
parent/enfant des persos, propage le detach d'un parent aux descendants, conserve
les racines et produit les enfants par cible dans un ordre deterministe. La
politique pure applique les conflits same-tick et les modes `first`, `last`,
`append`, `prepend` et numeriques bornes. Les diagnostics de conflit sont
exposes dans le rapport de seek ; la
persistance `first/last` est conservee jusqu'au prochain mode non persistant et
`reorderOnMove` est applique depuis la configuration du perso-container. Les
issues sont portees dans `SolvedScene` puis exposees par le resultat structure du
seek. Les politiques `reorderOnMove`, `reorderOnAdd` et `reorderOnRemove` ne sont
pas appliquees par le move core : elles appartiennent a une capacite/service list
enregistre, qui consommera les changements de parent sans etre lie a un composant
unique.

La capacite `list` fournit les politiques `reorderOnMove`, `reorderOnAdd` et
`reorderOnRemove` au calcul des frontières. L'appartenance et l'ordre structurel
restent portes par `SolvedGraph` et `StructuralTimeline`, sans reducer list
concurrent. Le composant `list` possède sa racine auteur ; le materializer
projette ensuite l'ordre complet sur les nodes persistants. Les paramètres de
transition restent ceux du `move.transition` consommé par le circuit FLIP.

Le core expose `diffSolvedScenes(before, after)` pour produire des deltas generiques
`mount`, `unmount` et `move`, avec les cibles et placements avant/apres. Ce delta ne
reordonne aucun enfant et ne depend d'aucun substrat ; une capacite list peut le
consommer pour appliquer sa propre politique. Ces deltas ne determinent pas la
duree de vie des materialisations auteur : `unmount` et detach retirent seulement
le parentage courant, tandis que les elements et ressources restent conserves pour
les seeks et les remontages. La destruction est reservee au teardown final du
player/sequence.

Le solve hiérarchique structurel appartient à cette frontière ; sa politique de
placement consomme les candidats issus de `materialize` pendant `resolve`, sans
effet externe. Les transforms d'ancêtres et les mesures restent dans les
tranches de mouvement et de materialisation. Les IDs de cible sont opaques et uniques dans
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

- invalidation de straps asynchrones et generations obsoletes; ce protocole est
  reporte a V3 et ne fait pas partie de la reconstruction V2;
- `live`, capture et DnD;
- FLIP visuel, matrices dépendantes du substrat et mesures DOM;
- media, preload et services runtime;
- composants et renderer de production.

## Validation

La tranche est couverte par `tests/runtime/player/pipeline.spec.ts`,
`move-state.spec.ts` et `presentation-graph.spec.ts`, puis reste exercée par la
demo temporaire `demos/validation/player`. La demo est un banc visible, pas la
definition du contrat final.
