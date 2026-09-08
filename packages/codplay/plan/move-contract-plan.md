# CodPlay V2 — contrat auteur de `move`

## Statut

> Status: En cours — migration de la forme auteur et des defaults internes,
> autorisée pour implémentation.
> CodPlay version: V2 foundation
> Référence d’exécution :
> [`motion-live-discovery-invalidation-plan.md`](./motion-live-discovery-invalidation-plan.md)

Les règles de destination, d’ordre, de placement et de transition déjà validées
restent inchangées. La tranche V2 en cours applique la forme cible dans les
types, le compilateur, le runtime, les démos et les tests : `flipMode` est
remplacé par `reparent`, tandis que les deux paramètres de chemin restent des
defaults internes et sortent de la surface auteur.

## Rôle

`move` décrit une destination structurelle et, facultativement, la transition
visuelle qui y conduit. La structure résolue ne dépend jamais de son régime de
présentation HTML.

```ts
type Move = string | MoveObject

type MoveObject = {
  target: string
  mode?: MoveOrderMode
  reparent?: boolean
  reorder?: boolean
  transition?: MoveTransition
}

type MoveTransition = {
  duration?: number
  delay?: number
  ease?: TransitionEase
  path?: string
}
```

La forme courte est équivalente à `{ target }`. `@root` et `@off` restent des
valeurs réservées de `target`. L’absence de `move` ne déduit aucun montage.

## Destination, ordre et présentation

- `target` désigne la destination structurelle, jamais une borne
  d’interpolation ;
- `mode` choisit l’ordre dans cette destination : `auto`, `first`, `last`,
  `append`, `prepend` ou une position numérique ;
- `reorder` indique si l’opération peut réordonner les enfants du conteneur de
  destination ; lors d’un changement de conteneur, le retrait de la source suit
  en plus la policy `reorderOnRemove` de cette source ;
- `reparent` exprime une demande de présentation par overlay ;
- `transition` décrit le trajet visuel après la production de l’état
  structurel.

La déclaration auteur est résolue ainsi :

```text
MoveObject.target
  -> policy de placement
  -> targetId opaque
  -> target logique résolu
```

`targetId` et `parentKey` restent internes. La policy ne connaît ni le DOM ni
la présentation visuelle.

Il n’y a pas de migration de `mode` : cette propriété existe déjà pour l’ordre
de placement et conserve son nom, ses valeurs et sa sémantique. `reparent` est
un axe distinct de présentation.

## `reparent` facultatif

Le régime effectif est déduit des états structurels avant et après l’événement,
puis de la demande explicite de l’auteur.

| Situation | Régime effectif | Présentation HTML |
|---|---|---|
| target et parent logique inchangés, `reparent` absent ou `false` | `local` | élément DOM dans son parent |
| target ou parent logique changé | `reparent` | représentation dans l’overlay |
| `reparent: true` explicite | `reparent` | overlay forcé |

Une liste reste donc locale lorsqu’elle conserve sa target. Le passage entre
deux targets ou deux parents devient automatiquement un reparent. Un auteur peut
forcer l’overlay dans une structure inchangée avec `reparent: true`.

`reparent: false` et l’absence de la propriété ne peuvent jamais annuler un
reparent structurel. La propriété ne modifie ni destination, ni ordre, ni
parentage logique.

Le contrat existant dissocie `reparent` de la capture géométrique. Un `move`
local qui porte une transition temporisée (`duration > 0`) vérifie FIRST/LAST et
les keyframes éventuels, puis reste présenté sur le nœud auteur sans overlay. Les
`className` et `style` de cette même action sont matérialisés avant les mesures ;
un tween de style reconnu engage également FIRST/LAST selon ses bornes. Le but
d’interpoler une position doit être porté par l’un de ces timings ; une
attribution directe sans timing reste immédiate et ne suffit pas à définir une
interpolation. La migration conserve ces règles.

## Transition et path

Les propriétés de `transition` sont facultatives :

- `duration`, en millisecondes ;
- `delay`, en millisecondes avant le début visuel ;
- `ease`, identifiant ou descripteur d'easing ;
- `path`, chaîne SVG `d`.

Lorsqu’un `path` est présent, le compilateur et le graphe appliquent toujours
les mêmes conventions internes :

- progression selon la longueur cumulée du chemin (`arc-length`), pour conserver
  une vitesse spatiale régulière ;
- suivi du centre visuel affine de l’élément (`center`), y compris pendant une
  rotation ou un redimensionnement.

Ces conventions ne sont plus des propriétés auteur. Elles ne modifient ni la
durée, ni l’easing, ni FIRST/LAST, ni la structure ou le parentage du `move`.
Un `path` sans option explicite garde donc le même comportement dans toutes les
démos ; aucun payload ne répète ces détails d’intégration.

Le path accepte `M`, `L` et `A`. Le compilateur normalise son départ en `[0, 0]`,
son arrivée en `[1, 0]`, quantifie les coordonnées au centième et prépare les
longueurs cumulées. La résolution corrige l’écart géométrique résiduel des arcs
quantifiés afin que les deux extrémités restent exactes.

`prepareSvgPath` (`src/ace/index.ts`) transforme une chaîne auteur en objet
`Path`. `compileMovePath` l’emploie dans le pipeline normal. Un strap qui crée
plus tard un déplacement dynamique réutilise `prepareSvgPath` et remet l’objet
préparé au pipeline ; il ne réintroduit pas une chaîne SVG dans le runtime. Le
compilateur fixe `arc-length` lors de cette préparation ; aucun appel de
`Move` ne peut sélectionner `parameter`.

Exemple local :

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

Exemple qui force l’overlay sans modifier la destination :

```ts
move: {
  target: 'page-layout:content',
  reparent: true,
  transition: { duration: 320, ease: 'easeOutCubic' }
}
```

## Flux de présentation cible

```text
move auteur
  -> normalisation et compilation
  -> événement traité, action et structure before / after résolues
  -> occurrence interne du move
  -> décision local / reparent
  -> préparation ciblée de la géométrie nécessaire
  -> commit atomique du groupe de mouvement
  -> même frame absolue à t pour Play et Seek
```

La résolution logique `after` demeure immédiate à `startAt`. La préparation de
la présentation ne constitue ni un délai ajouté au fait logique, ni un nouvel
événement journalisé. Pour un `move`, FIRST est la pose juste avant la frontière
logique et LAST est la pose naturelle à l’endpoint
`startAt + delay + duration`.

Pour `endEmit`, FIRST est la pose visible prise avant le commit live. Pour
`endCapture` `persist-only`, FIRST appartient à la frontière rejouable et le
LAST est capturé à l’endpoint du move. Le FIRST live est retiré avant un Seek ;
il ne remplace jamais la trajectoire persistante source → cible.

La préparation détaillée, la transaction coopérative et le choix du conteneur
d’overlay appartiennent au plan motion. `MoveStateDelta` ne devient pas une
source de géométrie et les captures ne créent pas une seconde histoire.

## Migration de `flipMode`

La migration conserve les capacités de `move` (destination, ordre, reflow,
transition et path). Elle remplace `flipMode` par `reparent` et retire de la
surface auteur les deux paramètres d’intégration du path ; leurs valeurs sont
fixées en interne à `arc-length` et `center`.

| Forme actuelle | Forme cible | Sémantique conservée |
|---|---|---|
| `mode: 'append'`, `mode: 'first'`, position numérique, etc. | propriété inchangée | placement et ordre |
| `flipMode: 'local'` | `reparent: false` ou propriété absente | intention locale, sans annuler un reparent structurel |
| `flipMode: 'overlay-world'` | `reparent: true` | présentation par overlay |
| `reorder`, `transition`, `path` | propriétés inchangées | même transition et même calcul de trajectoire, avec les defaults internes |

La migration doit modifier ensemble les types source, validation, compilation,
résolution, données dynamiques, scènes, fixtures et assertions. Aucune méthode
ni capacité de déplacement n’est supprimée ; `flipMode` est migrée vers
`reparent`, tandis que `traversal` et `pathAnchor` sont retirées de la surface
auteur au profit des defaults internes. Il n’y a pas d’alias de syntaxe auteur
entre les formes retirées et la forme cible ; les alias de types internes
conservés pour compatibilité ne valident aucune ancienne propriété.

## Invariants

- `target` est obligatoire dans la forme objet ;
- une chaîne `move` se normalise en `{ target }` ;
- `mode` est réservé à l’ordre de placement ;
- `reparent` ne modifie jamais la structure ;
- un changement de target ou de parent impose `reparent` ;
- un parent inchangé choisit `local` par défaut ;
- un `move` local transitionnel (`duration > 0`) capture FIRST/LAST, y compris lorsqu'il porte
  `className` ou `style`, sans créer d'overlay ;
- un `move` local ne crée pas de ressource overlay ;
- pour `endEmit`, FIRST est la pose visible exacte avant l’événement et LAST sa
  conséquence immédiate ;
- pour `endCapture` `persist-only`, FIRST est l’état logique de sa frontière et
  le runner HTML capture LAST à l’endpoint ;
- Play et Seek évaluent la même présentation absolue au même temps ;
- une target invalide produit un diagnostic sans placement implicite ;
- la policy de placement ne connaît ni le DOM ni la matérialisation ;
- un path préparé est parcouru selon `arc-length` et son centre visuel affine
  suit le chemin ; ces valeurs sont internes et ne sont pas configurables par
  l’auteur.

## Validation de la migration

- compilation et validation de tous les ordres `mode` existants ;
- `reparent: true` dans une structure inchangée ;
- reparent structurel avec propriété absente ou `false` ;
- conservation de `reorder`, de tous les champs `transition` et des payloads
  live ;
- application implicite des defaults `arc-length` et `center`, sans présence de
  `traversal` ni `pathAnchor` dans les payloads auteur ;
- capture FIRST/LAST d’un `move` local avec `className`/`style`, sans overlay ;
- absence de capture pour une attribution directe sans timing d’interpolation ;
- non-régression local, parent/enfant, retarget, `endEmit`, `persist-only`,
  Play, Seek et resize ;
- recherche finale : aucun appel auteur, test ou démo ne conserve `flipMode`
  après le commit de migration.
