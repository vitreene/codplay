# Sighty

Sighty regroupe le scénario auteur et son exécution CodPlay derrière un seul
point d'entrée. Le scénario décrit un graphe de vues ; le runtime reçoit les
événements et suit les routes déclarées.

```ts
import { Sighty, type SightyFile } from '@codplay/sighty'

const file: SightyFile<'scene-layout' | 'scene-menu' | 'scene-a' | 'scene-b', 'slot-scene'> = {
  views: {
    start: 'view-main',
    views: {
      'view-main': {
        view: {
          scene: 'scene-layout',
          views: {
            start: 'view-chapter',
            views: {
              'view-chapter': {
                actions: {
                  'navigation:next': { go: { direction: 'next' } },
                },
                view: {
                  slots: {
                    'slot-scene': {
                      start: 'view-menu',
                      views: {
                        'view-menu': { view: { scene: 'scene-menu' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

// The scene catalogue is supplied separately from the serializable file.
const scenes = {
  'scene-layout': layout,
  'scene-menu': menu,
  'scene-a': sceneA,
  'scene-b': sceneB,
}

const sighty = new Sighty({
  scenario: { file, scenes },
  runtime: {
    root,
    instanceIds: {
      'scene-layout': 'layout-1',
      'scene-menu': 'menu-1',
      'scene-a': 'scene-a-1',
      'scene-b': 'scene-b-1',
    },
    layout: { sceneKey: 'scene-layout', storyId: 'main' },
  },
})

await sighty.runtime.initialize()
await sighty.runtime.dispatch({ name: 'navigation:next' })
```

Chaque entrée d'une `ViewList` reçoit un `id` stable ; `next` et `previous`
suivent l'ordre déclaré. Le scénario ne crée pas de DOM et ne contient pas les
sources des scènes : `sighty.scenario` les reçoit dans son catalogue, tandis
que `sighty.runtime` pilote les occurrences, les slots et la navigation.

Les contrôles de page et les fonctionnalités propres à une application restent
à l'extérieur.
