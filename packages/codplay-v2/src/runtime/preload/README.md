# Preload runtime V2

> Status: En cours
> CodPlay version: V2 foundation

`RuntimePreload` est une capacité externalisée. Il charge le manifeste fourni
par un appelant et peut être utilisé directement par la diffusion autonome,
Sighty ou l'éditeur.

```ts
const cache = createRuntimePreloadCache()
const preload = createRuntimePreload({ cache })

await preload.load({
  manifest: [currentScene.resources, nextScene.resources],
  options: { mode: 'author', container: mountTarget },
})
```

La diffusion autonome peut ensuite appeler la façade `run` du runner, qui
enchaîne explicitement preload, initialisation et lecture. `RuntimePlayer.init()`
et `HtmlPlayerRunner.init()` ne lancent jamais le preload eux-mêmes.

Les stratégies natives couvrent `image`, `audio`, `video`, `font` et `css`.
Les composants et bibliothèques tierces enregistrent leurs stratégies avec
`registerStrategy`; ils n'ajoutent pas de loader concurrent.

Le résultat de `load()` expose `data.metadata`, indexé par URL. Les stratégies
`audio` et `video` y transmettent leur type et, lorsqu'elle est connue au signal
`canplaythrough`, leur durée en millisecondes. Cette métadonnée est consommée
par `MediaComponent` et `media-sync` ; elle ne remplace pas le manifeste et ne
déclenche aucun chargement implicite.

```ts
if (result.ok) {
  runner.setResourceMetadata(result.data.metadata)
}
```

Le cache est partageable et compte les propriétaires. `release()` ne supprime
une entrée que lorsqu'aucune instance `RuntimePreload` ne la détient encore.
