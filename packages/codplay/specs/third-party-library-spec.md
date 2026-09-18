# CodPlay V2 — préparation des bibliothèques tierces

## Statut

> En cours — barrière engine/preparation implémentée ; première intégration
> Three.js à construire.

Cette spécification décrit uniquement le chargement préalable de la
bibliothèque qui pilote un composant tiers. Elle ne décrit ni Three.js, ni
Rive, ni Lottie, et ne remplace pas le manifeste de ressources de la scène.

## Deux dépendances différentes

Une scène peut dépendre de deux choses :

- une bibliothèque d'exécution, par exemple Three.js, qui fournit les classes
  et les opérations du moteur ;
- des ressources de scène, par exemple un modèle GLB, une texture, un fichier
  Rive ou une composition Lottie.

La première est déclarée à l'engine et préparée avant l'initialisation de la
scène. Les secondes restent dans `CompiledScene.resources` et passent par
`RuntimePreloadApi`.

## Déclarations

Une bibliothèque est déclarée par son package d'intégration :

```ts
const threeLibrary: RuntimeLibraryDefinition = {
  id: 'three',
  async load() {
    // Le package prépare Three.js dans sa propre closure.
    await loadThreeRuntime()
  },
  release() {
    // Optionnel : libérer une ressource réellement possédée par cet engine.
  },
}
```

Un composant indique l'ID dont il dépend :

```ts
const threeSceneHost: RuntimeComponentDefinition = {
  type: 'three-scene',
  component: ThreeSceneHostComponent,
  modules: [],
  libraries: ['three'],
  validateInitial: validateThreeSceneInitial,
}
```

Le builder dérive alors `requirements.libraries` dans le `CompiledScene`.
Le core ne sérialise ni le module Three.js ni une valeur native : la factory
du package conserve son accès à la bibliothèque, tandis que CodPlay ne garde
que l'ID et l'état de préparation.

Si un composant référence un ID absent du catalogue engine, le build produit
`AUTHOR_LIBRARY_UNKNOWN` comme warning auteur non bloquant. Le codec et le
player ne recalculent pas ce warning.

## Ordre garanti

Le chemin de diffusion HTML suit cet ordre :

```text
build
  -> engine.prepareScene(compiledScene)
  -> preload.load(resources)
  -> player.init()
  -> play()
```

`HtmlPlayerRunner.run()` appelle automatiquement `prepareScene()` en premier.
Un appel direct à `instances.create()` doit être précédé par le même appel
explicite : `init()` ne charge jamais une bibliothèque en différé.

Si une bibliothèque est absente ou si son chargement échoue, le player n'est
pas initialisé et aucun composant n'est monté. Une initialisation directe sans
préparation produit `RUNTIME_LIBRARY_UNAVAILABLE`. Il s'agit d'une précondition
technique d'exécution, pas d'un warning auteur ; le warning `AUTHOR_*` n'est
jamais réémis en diffusion.

## Partage et destruction

La préparation est dédupliquée par engine : deux scènes qui réclament `three`
ne déclenchent qu'un seul `load()`. Deux engines restent indépendants. Lors de
la destruction de l'engine, `release()` est appelé pour les bibliothèques
préparées qui le déclarent.

Le chargement ne doit apparaître ni dans le constructeur d'un composant, ni
dans `initialize()`, ni dans `update()`. Ces phases ne font qu'utiliser une
bibliothèque déjà préparée. Les ressources natives propres à une instance
restent, elles, sous la responsabilité du composant et de son intégration.

## Limites actuelles

Cette tranche ne fournit pas encore la déclaration groupée d'une unité
Three.js/Rive/Lottie ni le composant hôte correspondant. Elle fournit la
barrière engine commune sur laquelle ces unités pourront être enregistrées.
