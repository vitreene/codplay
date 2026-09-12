# Sighty

Sighty est l'unique point d'entrée du projet. Une instance regroupe son
scénario auteur et son runtime CodPlay sous deux propriétés explicites :
`sighty.scenario` et `sighty.runtime`.

```ts
import { Sighty } from '@codplay/sighty'

const sighty = new Sighty({
  scenario: {
    file: sightyFile,
    scenes: { layout: layoutScene, sceneB },
    data: { locale: 'fr' },
  },
  runtime: {
    root,
    instanceIds: { layout: 'layout-1', sceneB: 'scene-b-1' },
    layout: { sceneKey: 'layout', storyId: 'main' },
  },
})

const { scenario, runtime } = sighty
const diagnostics = scenario.validate()
const layoutView = scenario.getView('layout')
const slotNames = scenario.getSlotNames('layout')

await runtime.initialize()
await runtime.playAll()
```

`scenario` expose le fichier, les scènes, les données et les requêtes de
validation. `runtime` exécute les scènes via CodPlay. Les contrôles, le journal,
le statut et la présentation restent à la charge de la page ou de la démo.
