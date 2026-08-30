# Composant media V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Rôle

Le composant `media` affiche et pilote une vidéo ou un son. Il conserve les
nœuds natifs nécessaires aux différentes sources déclarées par le `perso`.

## Fonctionnement

Le profil `MediaInitial` décrit la source, la balise éventuelle, les contrôles
et le rôle de source temporelle. Les propriétés communes (`className`, `style`,
`attr`) ciblent le wrapper ; `video` cible la node native persistante, qu'elle
soit une `video` ou une `audio`. Cette forme conserve le contrat de la partie
interne V1 :

```ts
initial: {
  src: '/assets/movie.mp4',
  video: {
    attr: { controls: true },
    style: { objectFit: 'cover' },
  },
}
```

`media-validation.ts` vérifie le profil et les actions de diffusion. Les
métadonnées de durée viennent du preload ; elles ne sont pas inventées par le
composant.

## Organisation interne

- `media-types.ts` décrit les profils et l'état média ;
- `media-validation.ts` porte les diagnostics de source et de diffusion ;
- `media-component.ts` conserve les nœuds, le temps natif, la lecture et les
  transitions ;
- `index.ts` expose le composant et sa surface de types.

La synchronisation avec l'horloge CodPlay est déléguée à la capacité
`media-sync`, via la surface publique du composant.

Lorsqu'un preload natif a conservé un nœud `audio` ou `video`, le composant
adopte le handoff correspondant à l'URL avant sa première présentation. Il
réutilise alors ce nœud et sa ressource prête ; il ne réassigne pas `src` et ne
relance pas `load()`.

## Contrat et limites

- une source n'est jamais réassignée à un nœud déjà créé ;
- un nœud conservé par le preload n'est adopté qu'une fois ;
- un seek ou un detach ne détruit pas les nœuds persistants ;
- les nœuds sont libérés à la destruction finale du player ;
- le composant ne déclenche pas de preload implicite ;
- les contrôles de données auteur restent dans le fichier de validation.
