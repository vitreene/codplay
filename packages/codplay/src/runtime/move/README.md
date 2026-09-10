# `move`

> Status: Fini — contrat auteur V2 implémenté, testé et documenté.
> CodPlay version: V2 foundation

`move` indique où un élément doit être placé. Il peut être utilisé dans
`initial` pour le placement de départ et dans une action pour déplacer
l’élément lorsqu’un événement est joué.

## Exemple simple

```ts
const scene = {
  id: 'cards',
  stories: {
    main: {
      id: 'main',
      persos: [
        { id: 'source', type: 'list', initial: { move: '@root', className: 'cards' } },
        { id: 'target', type: 'list', initial: { move: '@root', className: 'cards' } },
        {
          id: 'card',
          type: 'tag',
          initial: { move: 'source', content: 'Carte' },
          actions: {
            transfer: {
              move: {
                target: 'target',
                transition: { duration: 400, ease: 'linear' },
              },
            },
          },
        },
      ],
      eventimes: [{ name: 'transfer', startAt: 1000 }],
    },
  },
}
```

À `1000 ms`, la carte passe de `source` à `target` pendant `400 ms`. Sans
`transition`, le changement de place est immédiat.

La forme courte `move: 'target'` équivaut à `move: { target: 'target' }`.
`@root` place l’élément à la racine de la scène et `@off` le retire de la
présentation.

## Les propriétés

| Propriété | Rôle | Valeur par défaut |
| --- | --- | --- |
| `target` | Identifie le conteneur de destination. | Obligatoire dans la forme objet. |
| `mode` | Choisit la place de l’élément dans le conteneur de destination. | `auto` pour une action. |
| `reorder` | Autorise ou interdit le changement d’ordre des enfants dans le conteneur de destination pour ce `move`. | Autorisé. |
| `reparent` | Demande une présentation temporaire au-dessus de la page pendant le déplacement. Cela ne change pas la destination logique. | Automatique quand le conteneur change ; sinon local. |
| `resize` | Règle la largeur et la hauteur de l’élément pendant la transition. | `auto` sur chaque axe. |
| `transition` | Définit la durée, le délai, l’easing et éventuellement le chemin. | Pas de transition si absent. |

### `mode`

`mode` concerne uniquement l’ordre dans le conteneur de destination :

- `auto` : ordre normal du conteneur ;
- `first` ou `prepend` : première place ;
- `last` ou `append` : dernière place ;
- un nombre : index de la place souhaitée, à partir de `0`.

`mode` ne décrit ni la durée ni le trajet visuel.

### `reparent`

Un changement de conteneur est automatiquement présenté comme un reparent.
Dans ce cas, laisser la propriété absente suffit généralement. Utiliser
`reparent: true` force cette présentation même si la destination logique ne
change pas.

`reparent: false` ne peut pas empêcher le reparent nécessaire lorsqu’un `move`
change réellement de conteneur.

### `resize`

La règle peut être donnée séparément pour `width` et `height` :

```ts
move: {
  target: 'target',
  resize: {
    width: 'auto',
    height: 'preserve',
  },
  transition: { duration: 400 },
}
```

- `auto` : l’élément suit les dimensions produites par son CSS, interpolées
  entre le départ et l’arrivée ;
- `preserve` : l’élément garde sa dimension naturelle sur cet axe pendant le
  déplacement, afin que le conteneur ne le comprime pas ;
- `container` : l’élément prend la place disponible sur cet axe dans le
  conteneur de destination.

Une dimension absente vaut `auto`. `resize` ne règle que l’élément déplacé ;
la taille et le débordement du conteneur restent des règles CSS.

### `transition`

```ts
transition: {
  duration: 400,                         // millisecondes
  delay: 50,                             // optionnel
  ease: 'linear',                        // courbe de vitesse, optionnel
  path: 'M 0 0 L 0.5 0.8 L 1 0',        // optionnel
}
```

Le chemin est une chaîne SVG. CodPlay applique ses conventions de parcours et
de centrage automatiquement ; `traversal` et `pathAnchor` ne sont pas des
propriétés à fournir.

`flipMode` n’est plus une propriété auteur : utiliser `reparent`.

Une action peut aussi ajouter une classe ou modifier un style. Avec une
`transition`, ces changements sont pris en compte dans le même déplacement.

## Annexe — `list`

`list` est un conteneur. Il reçoit ses dimensions, ses espacements et son
débordement par le CSS. Lorsqu’un `move` avec transition ajoute, retire ou
réordonne un enfant, CodPlay mesure l’état naturel de la liste avant et après
le changement et interpole ses dimensions. Aucune propriété `list` n’est
nécessaire pour `width`, `height`, `min-*`, `max-*`, `gap`, flex, grid ou
`overflow`.

```ts
{
  id: 'target',
  type: 'list',
  initial: {
    move: '@root',
    tag: 'ul',
    className: 'cards',
    config: { reorderOnMove: false },
  },
}
```

```css
.cards {
  display: flex;
  gap: 8px;
  overflow: auto;
}
```

Les seules options propres à `list` règlent l’ordre automatique :

| Option | Effet | Défaut |
| --- | --- | --- |
| `reorderOnMove` | Autorise le réordonnancement automatique lors d’un `move` en `mode: 'auto'`. | `true` |
| `reorderOnAdd` | Autorise le réordonnancement automatique lors de l’ajout d’un enfant en `mode: 'auto'`. | `true` |
| `reorderOnRemove` | Autorise le réordonnancement automatique lors du retrait d’un enfant en `mode: 'auto'`. | `true` |

Une règle CSS comme `overflow: auto` ou `overflow: scroll` reste donc dans la
feuille de style. Un `mode` explicite choisit directement la position et
`reorder: false` désactive le réordonnancement de ce `move`. `move.resize`
appartient à l’élément déplacé, pas au conteneur `list`.
