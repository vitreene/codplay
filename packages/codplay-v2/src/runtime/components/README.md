# Composants runtime V2

> Statut : Fini
> Version CodPlay : V2 foundation

## Rôle

Ce dossier présente les éléments visuels que CodPlay sait créer et mettre à
jour pendant la lecture d'une scène. Un composant correspond à un `perso` : un
élément déclaré dans une scène, avec un type et des données initiales.

La classe du composant produit l'affichage, le met à jour et conserve les
ressources nécessaires pendant sa durée de vie. Elle ne décide pas si les
données auteur sont valides et ne reconstruit pas les valeurs par défaut.

## Fonctionnement

Le parcours général est le suivant :

1. les données du `perso` décrivent ce que l'élément doit afficher ;
2. la compilation vérifie ces données et ajoute les valeurs par défaut ;
3. le composant crée sa représentation HTML ou SVG ;
4. pendant la lecture, il reçoit les nouveaux états et les applique à cette
   représentation.

`SceneDoc` est la description de la scène écrite par l'auteur. Le champ
`perso.initial` contient les données de départ d'un composant. Avant la lecture,
le compilateur de scène (`SceneBuilder` dans le code) transforme cette
description en `CompiledScene`, la forme préparée pour le lecteur.

Le type `*Initial` de chaque dossier est la référence la plus directe pour
comprendre ce qu'un `perso.initial` peut contenir. Les validations dynamiques
complètent ce type lorsqu'il faut vérifier des données provenant d'un document
JSON ou d'une source externe.

## Composants disponibles

| Type | Rôle | Représentation |
| --- | --- | --- |
| `tag` | élément HTML générique, par exemple un titre ou un paragraphe | HTML |
| `layout` | structure HTML qui accueille d'autres éléments | HTML |
| `list` | racine d'une liste dont l'ordre est géré par la capacité de liste | HTML |
| `media` | lecture d'une vidéo ou d'un son | HTML (`video` ou `audio`) |
| `img` | affichage d'une image, avec conservation d'une image par source | HTML (`img`) |
| `input` | contrôle de réponse utilisé par les interfaces de quiz | HTML |
| `polygon` | forme géométrique avec contenu et transformation animée éventuelle | SVG |

Les détails propres à chaque composant se trouvent dans son dossier :

- [`tag`](./tag/README.md)
- [`layout`](./layout/README.md)
- [`list`](./list/README.md)
- [`media`](./media/README.md)
- [`image`](./image/README.md)
- [`input`](./input/README.md)
- [`polygon`](./polygon/README.md)

## Organisation interne

Chaque composant suit la même organisation :

```text
component-name/
  component-name-types.ts       # données acceptées et états utilisés
  component-name-validation.ts  # contrôles et valeurs par défaut à la compilation
  component-name-component.ts   # affichage et comportement pendant la lecture
  index.ts                      # exports publics du composant
```

Les responsabilités sont séparées :

- le fichier de types décrit le profil du composant et ses états ;
- le fichier de validation protège la frontière d'entrée et complète les
  données pendant la compilation ;
- la classe runtime applique l'état à HTML ou SVG ;
- les fonctions sans effet de bord portent les calculs testables sans navigateur.

Par exemple, `polygon-geometry.ts` calcule les sommets et les chemins SVG sans
connaître le DOM ; `input-state.ts` prépare l'état visuel d'un contrôle sans
modifier l'affichage.

## Base commune et affichage

`BaseComponent` définit le socle partagé par tous les composants. Il ne dépend
ni du navigateur ni d'un mode d'affichage. Il reçoit une facade de services
substrat-neutre ; chaque composant déclare lui-même les services qu'il emploie,
et le materializer fournit leur implementation adaptée.

`BaseHTMLComponent` ajoute ce qui est nécessaire aux composants HTML et SVG :
une méthode `render()` pour décrire leur représentation, la racine créée par
le materializer et l'accès aux parties internes de cette représentation.

Le materializer est la couche qui transforme le HTML ou le SVG produit par
`render()` en nœuds affichés dans la page. Il s'occupe de placer et de retirer
ces nœuds ; le composant s'occupe de leur contenu et de leur état.

Les champs communs sont définis dans [`base-component.ts`](./base-component.ts) :

- `BaseComponentData` contient `content`, `className`, `style` et `attr` ;
- `BaseComponentVisualData` contient les propriétés visuelles communes pour
  les composants dont le contenu est porté par une partie interne. `className`,
  `style` et `attr` correspondent respectivement aux classes CSS, aux styles
  et aux attributs de l'élément.

## Contrat et limites

Le catalogue runtime associe chaque type de composant à sa classe, à ses
modules et à ses validations. Les services restent enregistrés dans ce même
catalogue pour leurs contrats et leurs adapters de materializer, mais leur liste
d'utilisation est déclarée par la classe du composant via
`this.services.declare([...])`. Il n'existe pas de seconde liste imposée par le
catalogue.

Un module qui doit déclencher une opération particulière, comme jouer ou mettre
en pause un média, passe par une petite interface publique dédiée, appelée
« surface » dans le code. Il n'a pas besoin de connaître la classe concrète du
composant ni ses méthodes internes.

Cette séparation permet de conserver la même logique de scène et de lecture
quand de nouveaux materializers seront ajoutés, sans faire dépendre la base
commune du DOM.
