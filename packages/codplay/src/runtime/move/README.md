# Déplacer un élément

Utilisez `move` dans l’état initial pour choisir la destination de départ, ou dans une action pour déplacer un élément quand un événement survient. Ajoutez `transition` pour animer le déplacement.

## Exemple

```ts
const scene = {
  id: 'cards',
  stories: {
    main: {
      id: 'main',
      persos: [
        { id: 'source', type: 'list', initial: { move: '@root' } },
        { id: 'target', type: 'list', initial: { move: '@root' } },
        {
          id: 'card',
          type: 'tag',
          initial: { move: 'source', content: 'Carte' },
          actions: {
            transfer: {
              move: { target: 'target', transition: { duration: 400 } },
            },
          },
        },
      ],
      eventimes: [{ name: 'transfer', startAt: 1000 }],
    },
  },
}
```

À 1 000 ms, la carte passe de `source` à `target` pendant 400 ms. Sans `transition`, le changement de place est immédiat. `@root` désigne la racine de montage de la scène ; `@off` détache l’élément.

La [spécification de `move`](../../../specs/move-v2-spec.md) décrit les formes acceptées et les limites vérifiées. Pour l’ordre structurel, consultez la [capacité `list`](../../../specs/list-capability-v2-spec.md) ; la [spécification DnD/list](../../../specs/list-dnd-v2-spec.md) décrit sa preview HTML.
