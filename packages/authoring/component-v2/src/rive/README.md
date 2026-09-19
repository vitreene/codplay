# Rive V2

Le module Rive V2 fournit deux composants complémentaires :

- `rive` est le host HTML qui possède le canvas, le document et l’artboard ;
- `rive-state-machine` est un composant logique relié à ce host par `rel` et
  capable d'appliquer des valeurs nommées aux inputs de la state machine.

Le host est le seul composant Rive qui reçoit `move`. Le composant state
machine ne produit pas de DOM : il reçoit la cible publiée par le host et
pilote l’instance native de state machine.

```ts
import { CodPlay } from 'codplay'
import {
  RIVE_ENGINE,
  RIVE_PRELOAD_STRATEGIES,
} from '@codplay/component-v2'

const codplay = new CodPlay({
  engine: RIVE_ENGINE,
  preload: { strategies: RIVE_PRELOAD_STRATEGIES },
})

const scene = {
  id: 'rive-scene',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'avatar',
          type: 'rive',
          initial: {
            src: '/avatars/coach.riv',
            artboard: 'Coach model',
            animations: [],
            move: '@root',
          },
        },
        {
          id: 'state-machine',
          type: 'rive-state-machine',
          initial: {
            stateMachine: 'State Machine 1',
            rel: { host: 'avatar' },
          },
          actions: {
            setMood: { inputs: { mood: 1 } },
          },
        },
      ],
    },
  },
}
```

Le nom de state machine et les noms d’inputs sont des conventions du document
Rive fourni par l’auteur. CodPlay ne prétend pas inspecter la structure
interne du fichier. Le composant state machine transmet uniquement les valeurs
nommées demandées par l’auteur ; une application peut ainsi piloter n’importe
quel input sans imposer une sémantique métier au module.
