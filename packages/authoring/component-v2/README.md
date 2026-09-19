# Composants Three.js V2

Ce package fournit les composants génériques nécessaires à une scène Three.js
V2 : un hôte HTML, une caméra et une lumière. Il fournit aussi des composants
sur mesure, comme `three-instanced-grid`, qui sont enregistrés séparément.

L'engine prépare Three.js avant de créer les composants. Les classes reçoivent
ensuite le runtime préparé ; elles ne chargent pas la bibliothèque et ne
possèdent pas de boucle de rendu privée.

```ts
import { CodPlay } from 'codplay'
import {
  THREE_INSTANCED_GRID_DEFINITION,
  THREEJS_CORE_ENGINE,
} from '@codplay/component-v2'

const engine = {
  ...THREEJS_CORE_ENGINE,
  components: {
    register: [
      ...(THREEJS_CORE_ENGINE.components?.register ?? []),
      THREE_INSTANCED_GRID_DEFINITION,
    ],
  },
}

const codplay = new CodPlay({ engine })
const build = codplay.build({
  scene: {
    id: 'three-grid',
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: 'scene',
            type: 'three-scene-host',
            initial: { move: '@root', width: 640, height: 480 },
          },
          {
            id: 'camera',
            type: 'three-camera',
            initial: {
              rel: { target: { scene: 'three-grid' } },
              position: [0, 0, 6],
            },
          },
          {
            id: 'light',
            type: 'three-light',
            initial: {
              rel: { target: { scene: 'three-grid' } },
              kind: 'ambient',
              intensity: 1,
            },
          },
          {
            id: 'grid',
            type: 'three-instanced-grid',
            initial: {
              rel: { target: { scene: 'three-grid' } },
              gridSize: 4,
            },
            actions: { start: { animate: true } },
          },
        ],
        eventimes: [{ name: 'start', startAt: 0 }],
      },
    },
  },
})

if (!build.ok) throw new Error('The scene is invalid.')

await codplay.engine.prepareScene(build.compiledScene)
const instance = codplay.instances.create({
  instanceId: 'three-grid-instance',
  compiledScene: build.compiledScene,
  functions: build.functions,
  root: document.querySelector('main')!,
})

await instance.telco.play()
```

`rel` relie la caméra, la lumière et la grille à l’hôte. La scène Three.js et
le renderer restent propres à chaque instance. Pour ajouter un composant sur
mesure, consultez [`src/threejs/README.md`](src/threejs/README.md).
