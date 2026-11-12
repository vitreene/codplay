# Rive core

The shared core loads `.riv` resources through the CodPlay preload strategy and
provides the `rive` document host used by attached Rive components.

```ts
import { CodPlay } from 'codplay'
import { RIVE_ENGINE, RIVE_PRELOAD_STRATEGIES } from '@codplay/component-v2'

const codplay = new CodPlay({
  engine: RIVE_ENGINE,
  preload: { strategies: RIVE_PRELOAD_STRATEGIES },
})

const story = {
  id: 'main',
  persos: [
    {
      id: 'avatar',
      type: 'rive',
      initial: {
        src: '/avatars/guide.riv',
        artboard: 'Guide',
        move: '@root',
      },
    },
  ],
}
```

Attach the separate [state machine](../state-machine/README.md) or
[ViewModel](../view-model/README.md) component to `avatar` to control it.
