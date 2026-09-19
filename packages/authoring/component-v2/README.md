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
            id: 'three-scene',
            type: 'three-scene-host',
            initial: { move: '@root', width: 640, height: 480 },
          },
          {
            id: 'camera',
            type: 'three-camera',
            initial: {
              rel: { host: 'three-scene' },
              position: [0, 0, 6],
            },
          },
          {
            id: 'light',
            type: 'three-light',
            initial: {
              rel: { host: 'three-scene' },
              kind: 'ambient',
              intensity: 1,
            },
          },
          {
            id: 'grid',
            type: 'three-instanced-grid',
            initial: {
              rel: { host: 'three-scene' },
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

La relation `rel.host` relie la caméra, la lumière et la grille au contexte
publié par le host Three. `rel.target` peut ensuite sélectionner une capacité
publiée dans ce contexte. Le host Three est le seul composant matérialisé et
le seul à recevoir `move` ; la scène Three.js et le renderer restent propres à
chaque instance. Pour ajouter un composant sur mesure, consultez
[`src/threejs/README.md`](src/threejs/README.md).

## Rive

Le module fournit un host `rive` qui charge et joue un document Rive, ainsi
qu’un composant logique `rive-state-machine` pour piloter une state machine
attachée au host. Le package fournit les capacités et la stratégie de preload :

```ts
import { CodPlay } from 'codplay'
import { RIVE_ENGINE, RIVE_PRELOAD_STRATEGIES } from '@codplay/component-v2'

const codplay = new CodPlay({
  engine: RIVE_ENGINE,
  preload: { strategies: RIVE_PRELOAD_STRATEGIES },
})
```

Le document se déclare avec `type: 'rive'`, un `src` `.riv` et, si besoin, un
nom d’artboard. La state machine se déclare séparément avec
`type: 'rive-state-machine'` et une relation `rel.host` vers le host. Un lip-sync,
une expression ou toute autre fonctionnalité d’application peut utiliser les
valeurs nommées de ce composant pour piloter les inputs de la state machine.
Voir [`src/rive/README.md`](src/rive/README.md).
