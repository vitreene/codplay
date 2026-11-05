# Story d’avatar Rive parlant

`createRiveTalkingAvatarStory` construit une story avec un avatar Rive, sa voix
et des sous-titres facultatifs. Fournissez le profil du rig et les valeurs à
présenter à chaque instant. Tous les temps sont exprimés en millisecondes.

```ts
import { createRiveTalkingAvatarStory } from '@codplay/story/rive-talking-avatar'

const voice = { src: '/voice/introduction.mp3', durationMs: 1_000 }
const avatarStory = createRiveTalkingAvatarStory({
  id: 'introduction',
  profile: {
    document: { src: '/avatars/guide.riv', artboard: 'Guide' },
    viewModel: {
      stateMachine: 'Guide machine',
      viewModel: 'Expression',
      instance: 'Default',
      blendSpeed: 18,
      values: { rest: 100, vowel: 0, isTalking: false },
    },
  },
  voice,
  frames: [
    { startAt: 100, values: { rest: 0, vowel: 100 } },
    { startAt: 700, values: { rest: 100, vowel: 0 } },
  ],
  captions: {
    cues: [{ startAt: 100, endAt: 700, text: 'Bonjour !' }],
  },
  frame: {
    style: { width: '28cqw' },
  },
})

const scene = {
  id: 'welcome',
  stories: { [avatarStory.id]: avatarStory },
  eventimes: [{ name: 'sequence:end', startAt: voice.durationMs }],
}
```

Le ViewModel du rig doit fournir le booléen `isTalking`. La story le met à
`true` au début de la voix et à `false` à sa fin. `frames` peut porter les poids
de bouche et d’autres propriétés numériques ou booléennes du ViewModel.

Pour placer l’avatar dans une page, fournissez sa cible CodPlay avec
`frame.move`. `frame.style` et `frame.className` règlent son apparence et ses
dimensions. Les mêmes options sont disponibles sur `captions` pour le texte.
Omettez `captions` pour construire l’avatar sans sous-titres.

La story s’arrête au temps choisi par le constructeur de la page. Pour
préparer le moteur Rive et ses ressources, configurez le package
`@codplay/component-v2`.
