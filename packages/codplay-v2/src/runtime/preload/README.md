# Préchargement runtime V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Rôle

`RuntimePreload` prépare les ressources nécessaires à une scène avant sa
lecture. C'est une capacité externe : la diffusion autonome, Sighty ou l'éditeur
choisit quand l'appeler et lui fournit le manifeste à charger.

## Fonctionnement

```ts
const cache = createRuntimePreloadCache()
const preload = createRuntimePreload({ cache })

await preload.load({
  manifest: [currentScene.resources, nextScene.resources],
  options: { mode: 'author', container: mountTarget },
})
```

La façade `run()` du runner peut ensuite enchaîner explicitement preload,
initialisation et lecture. `RuntimePlayer.init()` et
`HtmlPlayerRunner.init()` ne lancent jamais le preload eux-mêmes.

## Organisation interne

Les stratégies natives couvrent `image`, `audio`, `video`, `font` et `css`. Un
composant ou une bibliothèque tierce peut ajouter une stratégie avec
`registerStrategy`, sans créer un loader concurrent.

Le résultat de `load()` expose `data.metadata`, indexé par URL. Les stratégies
audio et vidéo y indiquent leur type et, lorsqu'elle est connue au signal
`canplaythrough`, leur durée en millisecondes.

```ts
if (result.ok) {
  runner.setResourceMetadata(result.data.metadata)
}
```

## Contrat et limites

- la métadonnée complète le manifeste, mais ne le remplace pas ;
- aucune ressource n'est chargée implicitement par un composant ou par
  `media-sync` ;
- le cache est partageable et compte ses propriétaires ;
- `release()` supprime une entrée uniquement lorsqu'aucune instance ne la
  détient encore ;
- les stratégies de preload restent séparées de la logique de lecture.
