# Rive V2

Affichez un personnage Rive dans une scène CodPlay et animez ses propriétés
avec les événements de votre story. Utilisez `rive-view-model` pour un fichier
avec data binding, ou `rive-state-machine` pour ses inputs classiques.

L’exemple suivant ouvre la bouche du personnage à 100 ms et la remet au repos
à 600 ms. Adaptez les noms à ceux exportés par votre fichier `.riv`.

```ts
import { CodPlay } from 'codplay'
import { RIVE_ENGINE, RIVE_PRELOAD_STRATEGIES } from '@codplay/component-v2'

const codplay = new CodPlay({
  engine: RIVE_ENGINE,
  preload: { strategies: RIVE_PRELOAD_STRATEGIES },
})

const scene = {
  id: 'speaking-avatar',
  stories: {
    main: {
      id: 'main',
      initial: { move: '@root' },
      persos: [
        {
          id: 'avatar',
          type: 'rive',
          initial: {
            src: '/avatars/my-matt-visemes.riv',
            artboard: 'Matt Visemes',
            animations: [],
            move: '@root',
          },
        },
        {
          id: 'expression',
          type: 'rive-view-model',
          initial: {
            rel: { host: 'avatar' },
            stateMachine: 'Matt_Visemes_SM',
            viewModel: 'VisemesVM',
            instance: 'Instance',
            blendSpeed: 18,
          },
          actions: {
            speak: { values: { v100: 0, v102: 100, isTalking: true } },
            rest: { values: { v100: 100, v102: 0, isTalking: false } },
          },
        },
      ],
      eventimes: [
        { name: 'speak', startAt: 100 },
        { name: 'rest', startAt: 600 },
        { name: 'sequence:end', startAt: 1_000 },
      ],
    },
  },
}
```

`blendSpeed` lisse les propriétés numériques du ViewModel sur le temps du
player. Omettez ce réglage pour conserver une application immédiate ; les
booléens restent immédiats dans tous les cas.

Pour un fichier qui utilise des inputs classiques, remplacez le perso
`expression` par exemple par :

```ts
{
  id: 'expression',
  type: 'rive-state-machine',
  initial: {
    rel: { host: 'avatar' },
    stateMachine: 'State Machine 1',
  },
  actions: {
    speak: { inputs: { mood: 1 } },
    rest: { inputs: { mood: 0 } },
  },
}
```
