# CodPlay V2 - contrat auteur de `move`

## Statut

Status: En cours  
CodPlay version: V2 foundation  
Review: base auteur fixée ; path SVG compilé ; bridge player/FLIP en place

## Périmètre

Cette spec fixe la forme auteur de la propriété `move`. Le path auteur est une
chaîne SVG `d`, normalisée par le compilateur de scène avant d'entrer dans le
runtime.

Le contrat concerne la déclaration du placement d'un perso ou d'une story. La
policy de placement, la résolution des cibles et la projection sont des étapes
distinctes.

## Forme auteur canonique

Une déclaration `move` accepte une forme courte ou une forme objet :

```ts
type Move = string | MoveObject

type MoveObject = {
  target: string
  mode?: MoveOrderMode
  flipMode?: FlipMode
  reorder?: boolean
  transition?: MoveTransition
}

type MoveTransition = {
  duration?: number
  ease?: TransitionEase
  path?: string
  traversal?: "parameter" | "arc-length"
}
```

La forme courte est équivalente à une forme objet ne contenant que `target` :

```ts
move: "page-layout:content"
```

```ts
move: {
  target: "page-layout:content"
}
```

Les tokens réservés restent des valeurs de `target` :

```ts
move: "@root"
move: "@off"
```

La chaîne peut donc désigner un identifiant auteur ou un token réservé. Aucun
montage implicite n'est déduit de l'absence de `move`.

## Sens des propriétés

`target` désigne la destination structurelle du placement. Il ne désigne pas une
borne d'interpolation.

`mode` conserve les modes de placement existants : `auto`, `first`, `last`,
`append`, `prepend` ou une position numérique.

`flipMode` choisit le régime de projection visuelle lorsque la capacité FLIP est
employée, notamment `overlay-world`. Il ne change pas la destination structurelle.

`reorder` conserve la possibilité d'indiquer si le déplacement doit modifier
l'ordre du container.

`transition` porte les informations de déplacement visuel associées à ce
placement. Toutes ses propriétés sont optionnelles : la présence de `target` est
la seule obligation de la forme objet.

## Conventions de transition

Les noms suivent les conventions déjà employées dans les contrats de transition
CodPlay :

- `duration`, et non `durationMs`, pour la durée auteur en millisecondes ;
- `ease`, et non `easing`, pour l'identifiant ou le descripteur d'easing ;
- `path` pour une trajectoire spatiale préparée par l'étage approprié.

Le mot `to` reste réservé à une borne finale de transition lorsque la transition
porte elle-même des valeurs `from` et `to`. Il ne désigne pas la destination d'un
placement `move`.

Exemple :

```ts
move: {
  target: "page-layout:content",
  mode: "append",
  flipMode: "overlay-world",
  reorder: true,
  transition: {
    duration: 320,
    ease: "easeOutCubic",
    path: "M 0 0 L 0.2 0.5 A 0.2 0.2 0 0 1 0.8 0.5 L 1 0",
    traversal: "arc-length"
  }
}
```

`path` utilise une chaîne SVG `d` limitée aux commandes `M`, `L` et `A`. Le
départ est normalisé en `[0, 0]`, l'arrivée en `[1, 0]`, et les coordonnées
normalisées sont quantifiées au centième. Le compilateur produit une forme
interne compacte composée d'arcs et de droites, avec les longueurs cumulées
nécessaires au parcours. `arc-length` est la valeur par défaut ; `parameter`
conserve le paramétrage naturel des segments.

## Séparation auteur / résolution

La déclaration auteur utilise `target`. La résolution interne peut conserver une
forme différente :

```text
MoveObject.target
  -> policy de placement
  -> targetId opaque
  -> target logique résolu
```

`targetId` et `parentKey` sont des champs de résolution interne. Ils ne remplacent
pas `target` dans la forme auteur.

La normalisation doit convertir la forme courte en forme objet avant l'exécution
de la policy :

```text
"@root"
  -> { target: "@root" }
```

La policy ne doit pas inventer de destination et doit conserver les diagnostics
existants pour les targets invalides, les conflits same-tick et les targets
introuvables.

## Place de la transition dans le flux

La transition appartient à l'action ou à l'état de `move`, mais son exécution ne
doit pas être ajoutée à la policy structurelle :

```text
move auteur
   -> normalisation
   -> sélection de la destination et du mode
   -> compilation et normalisation du path SVG
   -> MoveStateDelta
   -> ACE pour l'easing et la trajectoire
  -> FLIP ou autre projection
```

Le `move` structurel décide où l'item est monté. La transition décrit comment la
projection visuelle rejoint cette destination. Une projection autre que HTML peut
consommer la même transition sans entrer dans le module FLIP.

## API et intégration

Les éléments suivants sont intégrés :

- conservation de `transition` dans la donnée résolue d'une action `move` ;
- forme de `MoveStateDelta` portant une transition éventuelle ;
- compilation du path SVG en segments normalisés quantifiés au centième ;
- transmission de la transition au consommateur FLIP via `MoveFlipCaptureBuilder`.

Les éléments suivants restent à fixer ou intégrer :

- valeurs par défaut de transition et comportement d'une transition sans `duration` ;
- résolution de `ease` par ACE sans dépendance à une bibliothèque tierce ;
- comportement d'une transition lors d'un remplacement ou d'un detach ;
- diagnostics pour les transitions invalides ou incomplètes.

## Invariants

- `target` est obligatoire dans la forme objet ;
- une chaîne `move` est toujours normalisable en `{ target }` ;
- `target` désigne une destination, jamais une borne d'interpolation ;
- `to` reste un nom de borne de transition ;
- `duration` et `ease` reprennent les conventions de transition existantes ;
- le path auteur commence à `[0, 0]`, se termine à `[1, 0]` et accepte `M`, `L` et `A` ;
- les valeurs géométriques compilées sont quantifiées au centième ;
- les options de transition ne changent pas la policy de parentage ;
- la policy de placement ne connaît ni le DOM ni la projection FLIP ;
- les fonctions et les formes non sérialisables sont préparées hors du chemin chaud ;
- un target invalide produit un diagnostic et ne crée pas de placement implicite.
