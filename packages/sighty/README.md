# Sighty

Sighty fait avancer un parcours de scènes CodPlay selon les événements reçus.
Le scénario réunit les vues, les conditions de navigation, les actions et les
scènes disponibles.

```ts
import { Sighty, type SightyScenarioDefinition } from '@codplay/sighty'

const scenario: SightyScenarioDefinition<'layout' | 'intro' | 'suite', 'content'> = {
  views: [{
    id: 'layout',
    view: {
      scene: 'layout',
      slots: {
        content: [
          {
            id: 'intro',
            actions: {
              'course:complete': { action: 'action:course:remember-progress' },
              'course:continue': { go: { direction: 'next' } },
            },
            view: { scene: 'intro' },
          },
          {
            id: 'suite',
            accessBy: 'guard:course:has-progress',
            view: { scene: 'suite' },
          },
        ],
      },
    },
  }],
  guards: {
    'guard:course:has-progress': ({ context }) => context.progress === true,
  },
  actions: {
    'action:course:remember-progress': ({ updateContext }) => updateContext({ progress: true }),
  },
  scenes: { layout: layoutScene, intro: introScene, suite: suiteScene },
}

const sighty = new Sighty({
  scenario,
  runtime: {
    root: document.querySelector('#course')!,
    instanceIds: { layout: 'layout-1', intro: 'intro-1', suite: 'suite-1' },
    context: { progress: false },
  },
})

await sighty.runtime.initialize()
await sighty.runtime.dispatch({ name: 'course:complete' })
await sighty.runtime.dispatch({ name: 'course:continue' })
```

Les scènes peuvent aussi émettre leurs événements publics vers Sighty.
`sighty.runtime.destroy()` libère l’exécution lorsqu’elle n’est plus utilisée.

Les références enregistrées utilisent les préfixes `action:` et `guard:` pour
rester distinctes des identifiants de scène. Une vue peut aussi recevoir une
fonction d’action ou de guard inline, sans clé dans `scenario.actions` ou
`scenario.guards`.

## Rejouer un parcours

Une action peut restaurer le contexte Sighty et demander aux scènes de remettre
à zéro leur propre état. Dans une scène de quiz, `onReset` traduit les clés en
un événement que le circuit `listen`/`straps` du quiz traite :

```ts
const restartAction = {
  go: { path: 'layout/content/intro' },
  reset: ['all'],
  action: 'action:course:refresh-presentation',
}

const quizSource = {
  sceneDoc: quizScene,
  onReset: (keys: readonly string[]) =>
    keys.includes('all') || keys.includes('quiz')
      ? { name: 'course-quiz:reset' }
      : undefined,
}
```

`all` restaure le contexte initial ; le quiz reçoit ensuite `course-quiz:reset`
et vide ses réponses. La scène reste propriétaire de ses corrections et de son
feedback. Demo 5 utilise ce parcours dans
[`scenario.ts`](../demos/src/sighty/demo5/scenario.ts).
