# CodPlay V2 - contrat auteur de `move`

## Statut

Status: Fixe
CodPlay version: V2 foundation
Review: validé le 2026-08-20 pour les moves compilés; extension V2 `pathAnchor`
validée le 2026-09-02 pour l'éditeur ed2, sans réintroduire de circuit V1

La porte d'implémentation de cette extension est limitée à la propagation de la
donnée dans le schedule, le graphe et la capture HTML, puis à la reconstruction
de l'origine affine depuis le centre. L'acceptation repose sur
`tests/runtime/motion/motion-pose.spec.ts`, la non-régression du graphe et le
test builder/runtime de l'éditeur ; aucun changement du sequence-editor ou du
parentage n'est requis.

La présentation HTML distingue l'origine affine capturée de l'origine de la
boîte avant transform (`layoutOrigin`). La feuille de projection remplaçant le
`transform` auteur, le host soustrait cette seconde valeur dans le repère du
parent ; cela conserve le centre affine sur le path sans réappliquer le
`translate` auteur. Cette donnée reste une couture de capture et ne fait pas
partie du document ou du path sérialisé.

## Rôle

`move` décrit une destination structurelle et, facultativement, la transition
visuelle qui y conduit. La structure résolue ne dépend jamais du mode de
présentation HTML.

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
  /** Point mapped by the prepared path during HTML presentation. */
  pathAnchor?: 'aabb' | 'center'
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
présentation visuelle.

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
- `traversal`, avec `arc-length` par défaut et `parameter` en alternative ;
- `pathAnchor`, qui vaut `center` pour une trajectoire calée sur le centre
  visuel affine et `aabb` (ou l'absence du champ) pour les transitions V2 qui
  ne déclarent pas cette extension.

`pathAnchor` ne change ni le parentage ni la structure du `move`. Lorsque sa
valeur est `center`, le runner calcule les deux extrémités depuis
`origin + matrix × (localWidth / 2, localHeight / 2)`, résout le path entre ces
centres, puis reconstruit l'origine affine de la pose à chaque frame. Aucune
mesure de bounding box ni coordonnée de viewport n'est persistée. Le mode
`aabb` conserve le comportement AABB des paths compilés qui ne déclarent pas
l'extension.

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
  -> mesure HTML FIRST / LAST aux bornes de présentation
  -> compilation du graphe de mouvement
  -> évaluation de la même frame à t pour Play et Seek
```

La transition est compilée dans le `MotionSchedule`. Le `MotionGraph` compare les
attachements et poses avant/après, infère `local` ou `reparent`, puis construit
une trajectoire possédée par l'item. `MoveStateDelta` n'est pas une source de
géométrie et aucun cache de captures ne constitue un second historique.

La résolution logique `after` reste immédiate à la frontière `startAt`. Pour la
présentation HTML, le snapshot géométrique LAST d'un move est toutefois capturé
à son endpoint `startAt + delay + duration`. Cette distinction permet d'utiliser
le contexte réel de destination lorsqu'une cible ou un ancêtre n'est monté
qu'après `startAt`; elle ne décale ni l'événement ni l'état logique.

Pour un `move` produit par la fermeture live d'une capture HTML (`endEmit`), le
FIRST géométrique est la photographie visible prise à la fin de la capture,
juste avant le commit de l'événement. Il peut donc différer de la position
logique initiale : le perso peut être en pose fixe au point du drop et ses
voisins peuvent être encore en reflow FLIP. Pour cette remise live, le LAST
reste la conséquence immédiate du `move` résolu par le player visible ; le
runner ne remplace pas cette pose par l'endpoint de la trajectoire persistante.

Lorsqu'une même capture fournit aussi une sortie `endCapture`, celle-ci est
une frontière `persist-only` distincte. À la relecture, son FIRST est l'état
logique mesuré juste avant `end - durée`, et son LAST géométrique est capturé
par le runner à l'endpoint du `move`.
Le FIRST live de `endEmit` est supprimé avant un seek ; il ne peut donc pas
remplacer la trajectoire source → cible persistante. Cette distinction ne
modifie ni la destination, ni le journal, ni la règle de reconstruction ; elle
sépare la remise visuelle au relâchement de la trajectoire historique.

## Invariants

- `target` est obligatoire dans la forme objet ;
- une chaîne `move` se normalise en `{ target }` ;
- `flipMode` est facultatif et ne modifie jamais la structure ;
- un changement de target ou de parent impose `reparent` ;
- un parent inchangé choisit `local` par défaut ;
- pour `endEmit`, FIRST est l'état exact visible avant l'événement (la pose live
  de fin pour une capture continue) et LAST sa conséquence immédiate ;
- pour `endCapture` persist-only, FIRST est l'état logique avant la frontière
  ancrée et le runner HTML capture le LAST géométrique à l'endpoint du move ;
- Play et Seek évaluent le même graphe absolu au même temps ;
- une target invalide produit un diagnostic sans placement implicite ;
- la policy de placement ne connaît ni le DOM ni la materialisation ;
- `pathAnchor: 'center'` est accepté uniquement avec un `path` préparé et
  garantit que le centre affine de la pose présentée suit les extrémités et la
  courbure de ce path ; une valeur inconnue est rejetée comme transition
  invalide.
