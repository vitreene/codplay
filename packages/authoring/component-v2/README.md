# Composants Three.js V2

Ce package ajoute à CodPlay une première unité Three.js V2. Il fournit un hôte
HTML, une caméra, des lumières et une grille de pavés animée par le temps
CodPlay.

```ts
import { CodPlay } from 'codplay'
import { createThreejsIntegration } from '@codplay/component-v2'

const three = createThreejsIntegration()
const codplay = new CodPlay({ engine: three.engine })

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
le renderer restent propres à chaque instance. L’engine charge Three.js avant
la création de l’instance ; la grille est ensuite mise à jour par le temps
CodPlay et l’hôte effectue le rendu final.
