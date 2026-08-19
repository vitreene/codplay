# CodPlay V2 - contrat auteur de `move`

## Statut

Status: A relire
CodPlay version: V2 foundation
Review: contrat auteur et inférence du régime visuel implémentés

## Rôle

`move` décrit une destination structurelle et, facultativement, la transition
visuelle qui y conduit. La structure résolue ne dépend jamais du mode de
projection HTML.

```ts
type Move = string | MoveObject

type MoveObject = {
  target: string
  mode?: MoveOrderMode
  flipMode?: 'local' | 'overlay-world'
  reorder?: boolean
  transition?: MoveTransition
}

type MoveTransition = {
  duration?: number
  ease?: TransitionEase
  path?: string
  traversal?: 'parameter' | 'arc-length'
}
```

La forme courte est équivalente à `{ target }`. `@root` et `@off` sont des
valeurs réservées de `target`. Aucun montage implicite n'est déduit de l'absence
de `move`.

## Destination et ordre

- `target` désigne la destination structurelle, jamais une borne
  d'interpolation ;
- `mode` choisit l'ordre dans cette destination : `auto`, `first`, `last`,
  `append`, `prepend` ou une position numérique ;
- `reorder` indique si le déplacement peut modifier l'ordre du container ;
- `transition` décrit le trajet visuel après que l'événement a produit le nouvel
  état structurel.

La déclaration auteur est résolue ainsi :

```text
MoveObject.target
  -> policy de placement
  -> targetId opaque
  -> target logique résolu
```

`targetId` et `parentKey` restent internes. La policy ne connaît ni le DOM ni la
projection visuelle.

## `flipMode` facultatif

Le régime visuel est inféré à partir des états structurels avant et après
l'événement :

| Situation | Régime effectif | Présentation HTML |
|---|---|---|
| target et parent logique inchangés | `local` | élément DOM dans son parent |
| target ou parent logique changé | `reparent` | représentation dans l'overlay |
| `flipMode: 'overlay-world'` explicite | `reparent` | overlay forcé |

Ainsi, une liste utilise naturellement le mode local. Passer d'une liste à une
autre est automatiquement un reparent. L'auteur n'a rien à préciser dans ces
deux cas usuels.

`flipMode: 'local'` peut documenter une intention locale, mais ne peut jamais
forcer un déplacement inter-parent à rester local : le changement structurel
impose `reparent`. `flipMode: 'overlay-world'` reste utile pour forcer l'overlay
alors que la target ne change pas.

Le mode ne change jamais la destination, l'ordre ou le parentage logique.

## Transition et path

Les propriétés de `transition` sont facultatives. Les conventions auteur sont :

- `duration`, en millisecondes ;
- `ease`, identifiant ou descripteur d'easing ;
- `path`, chaîne SVG `d` ;
- `traversal`, avec `arc-length` par défaut et `parameter` en alternative.

Le path accepte `M`, `L` et `A`. Le compilateur normalise son départ en `[0, 0]`,
son arrivée en `[1, 0]`, quantifie les coordonnées au centième et prépare les
longueurs cumulées. La résolution corrige l'écart géométrique résiduel des arcs
quantifiés afin que les deux extrémités restent exactement `[0, 0]` et `[1, 0]`
à toute progression proche de `0` ou `1`. Cette préparation ne dépend pas du
renderer HTML.

La fonction publique `prepareSvgPath` (`src/ace/index.ts`) réalise cette
transformation d'une chaîne auteur vers l'objet `Path` intelligible par CodPlay.
`compileMovePath` l'emploie pour transformer une déclaration `move` complète.
Un strap qui produit plus tard un déplacement dynamique doit réutiliser
`prepareSvgPath` et remettre l'objet préparé au pipeline; il ne doit pas
réintroduire une chaîne SVG dans le runtime.

Exemple où aucune indication de mode n'est nécessaire :

```ts
move: {
  target: 'page-layout:content',
  mode: 'append',
  reorder: true,
  transition: {
    duration: 320,
    ease: 'easeOutCubic',
    path: 'M 0 0 L 0.2 0.5 A 0.2 0.2 0 0 1 0.8 0.5 L 1 0'
  }
}
```

## Flux V2

```text
move auteur
  -> normalisation et compilation
  -> matérialisation de l'état avant la frontière
  -> application de l'événement
  -> résolution de l'état après la frontière
  -> mesure complète FIRST / LAST
  -> compilation du graphe de mouvement
  -> évaluation de la même frame à t pour Play et Seek
```

La transition est compilée dans le `MotionSchedule`. Le `MotionGraph` compare les
attachements et poses avant/après, infère `local` ou `reparent`, puis construit
une trajectoire possédée par l'item. `MoveStateDelta` n'est pas une source de
géométrie et aucun cache de captures ne constitue un second historique.

## Invariants

- `target` est obligatoire dans la forme objet ;
- une chaîne `move` se normalise en `{ target }` ;
- `flipMode` est facultatif et ne modifie jamais la structure ;
- un changement de target ou de parent impose `reparent` ;
- un parent inchangé choisit `local` par défaut ;
- FIRST est l'état exact avant l'événement et LAST sa conséquence immédiate ;
- Play et Seek évaluent le même graphe absolu au même temps ;
- une target invalide produit un diagnostic sans placement implicite ;
- la policy de placement ne connaît ni le DOM ni la projection.
