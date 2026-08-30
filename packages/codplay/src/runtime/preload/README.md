# Préchargement runtime V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Rôle

`RuntimePreload` prépare les ressources nécessaires à une scène avant sa
lecture. C'est une capacité externe : la diffusion autonome ou l'éditeur choisit
quand l'appeler et lui fournit le manifeste à charger. Le contrat pourra être
réutilisé par Sighty lorsqu'il sera raccordé ; ce n'est pas le périmètre actuel.

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
`canplaythrough`, leur durée en millisecondes. Pour ces deux types natifs,
`data.media` peut aussi contenir un handoff opaque vers le nœud déjà prêt :
`resources.register()` le transmet à l'engine, puis le composant `media` adopte
ce nœud avant sa première présentation.

```ts
if (result.ok) {
  runner.setResourceMetadata(result.data.metadata)
  runner.setResourceMedia(result.data.media ?? {})
}
```

## CSS généré et slots

Les ressources CSS référencées par une URL continuent de passer par
`preload.load()`. Pour une feuille générée en mémoire — notamment le
`styleSheet` reconstruit par l'éditeur — la façade expose un canal direct :

```ts
codplay.preload.css.set({
  slot: 'editor-scene',
  cssText: styleSheet,
  container: mountTarget,
})
codplay.preload.css.clear('editor-scene')
```

`set()` remplace le même slot de façon synchrone, applique la portée au
conteneur fourni et ne crée ni URL Blob ni entrée du cache des ressources.
`clear()` sans argument retire tous les slots possédés par ce service. Ce canal
est destiné aux feuilles éphémères d'un hôte ; les médias restent sur le
chemin URL, avec cache partagé, métadonnées et transfert éventuel d'un nœud
prêt.

## Contrat et limites

- la métadonnée complète le manifeste, mais ne le remplace pas ;
- aucune ressource n'est chargée implicitement par un composant ou par
  `media-sync` ;
- le cache est partageable et compte ses propriétaires ;
- `release()` supprime une entrée uniquement lorsqu'aucune instance ne la
  détient encore ;
- un nœud média prêt est transféré à un seul composant, puis libéré avec ce
  composant ; les références du cache et de l'engine prolongent sa durée de vie
  pendant le transfert ;
- les stratégies de preload restent séparées de la logique de lecture.
