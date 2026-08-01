# Audit V1 - parts internes des composants

## Statut

Status: En cours  
CodPlay version: V2 foundation  
Review: required before generic parts integration

## Perimetre

Audit de tous les composants V1 qui derivent de `BaseComponent`, dans
`packages/codplay/src/runtime/components/` et les composants tiers authoring qui
utilisent la meme base.

## Tableau des usages

| Composant | Part interne | `data-part` | Outlet externe | Construction interne |
|---|---|---:|---:|---:|
| `tag` | aucune | non | non | racine simple |
| `text` | aucune | non | non | racine simple |
| `list` | enfants geres par le placement | non | non | racine simple |
| `layout` | parts du markup auteur | oui | oui | parser HTML/SVG |
| `input` | controle, label, icons, hint | oui | oui, icons | template injecte apres creation de la racine |
| `media` | video active | non, `setPart` direct | non | nodes media persistants |
| `img` | image active | non, `setPart` direct | non | nodes image persistants |
| `polygon` | path et texte SVG | non | non | nodes SVG construits par le composant |
| `sketch` | paths SVG | non | non | nodes SVG accumules par le composant |
| `threejs` | scene Three.js interne | non | non | canvas et scene Three.js |
| `rive` | runtime Rive interne | non | non | canvas et runtime Rive |
| `avatar3d` | scene Three.js/avatar interne | non | non | canvas et runtime avatar |

## Ce que couvre le BaseComponent V1

`BaseComponent` couvre correctement :

- une reference `node` par instance ;
- la construction ou reutilisation d'une racine ;
- le parsing d'un template passe a `buildNode()` ;
- la collecte des `data-part` presents dans ce template ;
- une map privee `partId -> node` ;
- `getPart()` et `resolveRef()` pour les sous-composants.

Cela suffit pour un composant qui declare une structure statique dans un template
et qui consomme ses parts uniquement en interne.

## Cas input

`InputComponent` utilise bien des `data-part` internes :

```html
<input data-part="control" />
<span data-part="label"></span>
<span data-part="selection-icon"></span>
<span data-part="correction-icon"></span>
<span data-part="hint"></span>
```

Mais il ne passe pas simplement ce template a `buildNode()`. Il construit une
racine `label`, injecte ensuite le markup dans `innerHTML`, puis rappelle
`collectDataParts()` et `setPart()` manuellement.

Conclusion : le socle V1 ne suffit pas seul pour `input`. Le composant doit
connaitre le parser interne et son registre de parts.

`InputComponent` expose en plus deux de ses parts comme cibles de montage via
`getOutletsSnapshot()`. Cela prouve que la publication d'un outlet n'est pas
exclusive au composant `layout`.

## Cas media et image

`MediaComponent` et `ImageComponent` possedent des parts internes, mais ne les
declarent pas dans un template `data-part` :

- `MediaComponent` cree ou reutilise un node video par source puis appelle
  `setPart('media', node)` ;
- `ImageComponent` cree ou reutilise un node image par source puis appelle
  `setPart('media', node)`.

Le registre de parts sert ici de cache de projection interne. Il ne sert pas a
exposer un outlet au runtime de placement.

Leur implementation V1 ne peut pas etre reprise telle quelle dans un exemple V2
qui exige template string ou JSX pour la structure auteur : les nodes media sont
crees directement par le composant et leur cycle de vie est lie au decode natif.
Cela demande un contrat specifique de projection media, pas une extension du
service layout.

## Cas polygon, sketch et composants tiers

`PolygonComponent` construit directement un arbre SVG et conserve ses nodes `path`
et `text` dans des champs prives. `SketchingComponent` accumule des `path` SVG dans
une map privee. `ThreejsBaseComponent`, `RiveBaseComponent` et
`Avatar3DBaseComponent` possedent chacun un canvas et un runtime interne.

Ces composants n'utilisent pas `data-part`, mais ils ont le meme invariant :

```text
le composant possede un substrat interne
le substrat n'est pas un Perso
les updates ecrivent directement dans cette projection
```

Le registre generique `data-part` ne couvre donc pas leur probleme. Ils ont besoin
d'un adapter de projection propre a leur substrat.

## Separation necessaire

V2 doit distinguer trois usages, meme si l'infrastructure de materialisation est
commune :

### Part interne

Un node utilise uniquement par le composant pour appliquer son `PersoState`.

```text
InputComponent.control
MediaComponent.media
PolygonComponent.path
```

Il reste dans le composant et n'est pas publie au placement.

### Outlet de montage

Un part qu'un autre perso peut cibler avec `move.parentId`.

```text
LayoutComponent.content
InputComponent.selection-icon
```

Il doit franchir la frontiere du composant et etre enregistre dans la capacite de
cibles de montage. Cette capacite ne doit pas etre codee comme un comportement
exclusif de `LayoutComponent`.

### Substrat interne specialise

Un canvas, une scene SVG generee ou un graphe Three.js/Rive possede par le
composant. Il ne doit pas etre transforme artificiellement en collection de
`data-part`.

## Verdict

L'implementation V1 actuelle suffit pour les composants simples et fournit une
base reutilisable pour les parts internes. Elle ne suffit pas comme contrat V2
general :

- `BaseComponent` melange part interne et preparation d'outlets ;
- `InputComponent` repete manuellement la materialisation de son template ;
- `getOutletsSnapshot()` est un pont V1 utilise par `layout` et `input` ;
- les composants media/image/SVG/Three/Rive gerent leurs sous-nodes hors du
  mecanisme template ;
- le runtime V2 doit differencier part interne, outlet de montage et substrat
  specialise.

Le service/module de montage doit donc etre generique pour tout composant qui
declare des outlets, tandis que chaque composant reste proprietaire de ses parts
internes et de son substrat.

## Verification des autres composants

La verification des composants V1 donne la repartition suivante :

| Composant | Parts montables vers l'exterieur | Adaptation generique du module layout |
|---|---:|---:|
| `layout` | Oui, parts du markup | Oui, composant proprietaire et declaration de parts |
| `input` | Oui, deux icons | Oui, selection generique d'un sous-ensemble de parts |
| `tag` | Non | Aucune |
| `text` | Non | Aucune |
| `list` | Non, ses enfants relevent du module list | Aucune |
| `media` | Non | Aucune |
| `img` | Non | Aucune |
| `polygon` | Non | Aucune |
| `sketch` | Non | Aucune |
| `threejs` | Non | Aucune |
| `rive` | Non | Aucune |
| `avatar3d` | Non | Aucune |

`media`, `img`, `polygon`, `sketch`, `threejs`, `rive` et `avatar3d` possedent des
parts ou des objets internes, mais aucun n'est publie comme cible de montage par
le runtime V1. Leurs adaptations futures concernent leur substrat propre, pas le
module `layout`.

## Perimetre retenu

La suite du chantier ne reecrit pas `InputComponent`. Elle conserve uniquement les
adaptations generiques eventuelles du module `layout` necessaires pour prendre en
charge des parts montables declares par plusieurs types de composants.
