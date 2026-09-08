# CodPlay

CodPlay sert à créer des scènes interactives : des éléments peuvent apparaître,
changer d'état, se déplacer et répondre aux événements d'un utilisateur.

## Démarrer les exemples

```bash
npm install
npm run dev:demos
```

Ouvrir ensuite <http://localhost:5173> et choisir une démo. Par exemple,
`?demo=position` montre un élément qui passe d'un conteneur à un autre avec une
transition ; `?demo=components` montre les composants HTML disponibles.

## Déclarer un déplacement

Une scène décrit la position initiale et l'action qui déclenche le déplacement :

```ts
const item = {
  id: 'card',
  type: 'tag',
  initial: { tag: 'div', move: { target: 'list-a' } },
  actions: {
    drop: {
      move: {
        target: 'list-b',
        transition: { duration: 420, ease: 'out(2)' },
      },
    },
  },
}
```

Lorsque l'événement `drop` est joué, CodPlay conserve la scène logique et
présente le passage de `list-a` à `list-b` pendant 420 ms. Play et Seek donnent
la même image au même instant.

## Autres commandes

```bash
npm run dev:editor   # ouvrir l'éditeur
npm run test         # lancer les tests V1 historiques
npm run test --workspace=codplay  # lancer les tests du runtime V2
```
