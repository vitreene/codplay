# Composants runtime V2

> Status: Fini
> CodPlay version: V2 foundation

Ce dossier présente les éléments visuels que CodPlay sait créer et mettre à
jour pendant la lecture d'une scène. Un composant correspond à un `perso` : un
élément déclaré dans une scène, avec un type et des données initiales.

Le fonctionnement général est simple :

1. les données du `perso` décrivent ce que l'élément doit afficher ;
2. la compilation vérifie ces données et ajoute les valeurs par défaut ;
3. le composant crée sa représentation HTML ou SVG ;
4. pendant la lecture, il reçoit les nouveaux états et les applique à cette
   représentation.

La classe du composant ne décide donc pas si les données auteur sont valides et
ne reconstruit pas les valeurs par défaut. Elle se concentre sur son rôle
visuel : produire un élément, le mettre à jour et conserver les ressources
dont elle a besoin pendant sa durée de vie.

## Les composants disponibles

| Type | Rôle | Représentation |
| --- | --- | --- |
| `tag` | élément HTML générique, par exemple un titre ou un paragraphe | HTML |
| `layout` | structure HTML qui accueille d'autres éléments | HTML |
| `list` | racine d'une liste dont l'ordre est géré par la capacité de liste | HTML |
| `media` | lecture d'une vidéo ou d'un son | HTML (`video` ou `audio`) |
| `img` | affichage d'une image, avec conservation d'une image par source | HTML (`img`) |
| `input` | contrôle de réponse utilisé par les interfaces de quiz | HTML |
| `polygon` | forme géométrique avec contenu et transformation animée éventuelle | SVG |

Les détails propres à chaque composant sont documentés dans son dossier :

- [`tag`](./tag/README.md)
- [`layout`](./layout/README.md)
- [`list`](./list/README.md)
- [`media`](./media/README.md)
- [`image`](./image/README.md)
- [`input`](./input/README.md)
- [`polygon`](./polygon/README.md)

## De la donnée à l'affichage

`SceneDoc` est la description de la scène telle qu'elle est écrite par
l'auteur. Le champ `perso.initial` contient les données de départ d'un
composant. Par exemple, un `polygon` reçoit ses côtés, son rayon et sa rotation
dans ce profil.

Avant la lecture, le compilateur de scène (`SceneBuilder` dans le code)
transforme cette description en `CompiledScene`, la forme préparée pour le
lecteur :

- le fichier `*-types.ts` décrit les données acceptées par le composant et son
  état de fonctionnement ;
- le fichier `*-validation.ts` vérifie les données auteur et applique, lorsque
  le contrat le prévoit, les valeurs par défaut ou les conversions ;
- le composant reçoit ensuite ces données préparées et les applique à son
  affichage HTML ou SVG.

Le type `*Initial` de chaque dossier est la référence la plus directe pour
comprendre ce qu'un `perso.initial` peut contenir. Les validations dynamiques
complètent ce type lorsqu'il faut vérifier des données provenant d'un document
JSON ou d'une source externe.

## Organisation d'un dossier de composant

Chaque composant suit la même organisation afin qu'un lecteur puisse trouver
rapidement chaque responsabilité :

```text
component-name/
  component-name-types.ts       # données acceptées et états utilisés
  component-name-validation.ts  # contrôles et valeurs par défaut à la compilation
  component-name-component.ts   # affichage et comportement pendant la lecture
  index.ts                      # exports publics du composant
```

Les calculs sans effet de bord sont isolés lorsqu'ils deviennent importants.
Par exemple, `polygon-geometry.ts` calcule les sommets et les chemins SVG sans
connaître le DOM ; `input-state.ts` prépare l'état visuel d'un contrôle sans
modifier l'affichage.

## Les bases communes

`BaseComponent` définit le minimum partagé par tous les futurs composants. Il
ne dépend ni du navigateur ni d'un mode d'affichage : un composant Canvas,
Three.js ou Rive pourra donc l'utiliser plus tard.

`BaseHTMLComponent` ajoute ce qui est nécessaire aux composants HTML et SVG :
une méthode `render()` pour décrire leur représentation, la racine créée par
le materializer et l'accès aux parties internes de cette représentation.

Ici, le materializer est la couche qui transforme le HTML ou le SVG produit par
`render()` en nœuds affichés dans la page. Il s'occupe de placer et de retirer
ces nœuds ; le composant s'occupe de leur contenu et de leur état.

Les champs communs sont définis dans [`base-component.ts`](./base-component.ts) :

- `BaseComponentData` contient `content`, `className`, `style` et `attr` ;
- `BaseComponentVisualData` contient les propriétés visuelles communes pour
  les composants dont le contenu est porté par une partie interne. `className`,
  `style` et `attr` correspondent respectivement aux classes CSS, aux styles
  et aux attributs de l'élément.

## Règles de responsabilité

Le catalogue runtime est la liste qui associe chaque type de composant à sa
classe, à ses services (les fonctions qui appliquent les classes, styles et
attributs) et à ses validations. Cette association permet au
compilateur et au lecteur de retrouver le bon composant sans dupliquer sa
définition.

Les responsabilités restent séparées :

- le profil décrit les données ;
- la validation protège la frontière d'entrée ;
- la compilation complète les données ;
- la classe applique l'état au HTML ou au SVG ;
- les fonctions utilitaires calculent les valeurs qui peuvent être testées
  indépendamment du navigateur.

Un module qui doit déclencher une opération particulière — par exemple jouer,
mettre en pause ou changer la position d'un média — passe par une petite
interface publique dédiée, appelée « surface » dans le code. Il n'a pas besoin
de connaître la classe concrète du composant ni ses méthodes internes. La
surface `media` est le premier exemple de ce contrat.

Cette séparation permet de conserver la même logique de scène et de lecture
quand de nouveaux materializers seront ajoutés, sans faire dépendre la base
commune du DOM.
