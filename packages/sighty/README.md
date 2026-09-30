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
