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

## Exporter et charger un parcours

Exportez le scénario pour produire son module et un paquet CodPlay autonome par
scène directe, puis construisez la bibliothèque Sighty séparément :

```sh
npm run export --workspace=@codplay/sighty -- \
  --scenario ./src/scenario.ts \
  --export ./public/exports/course
npm run build --workspace=@codplay/sighty
```

Pour remettre un paquet complet à une application sans player déjà installé,
ajoutez la configuration de l’engine et `--standalone` :

```sh
npm run export --workspace=@codplay/sighty -- \
  --scenario ./src/scenario.ts \
  --engine-config ./src/engine.ts \
  --standalone \
  --export ./public/exports/course
```

Le dossier produit contient `loader.mjs`, une seule copie de CodPlay, Sighty et
de l’engine, puis le scénario et ses paquets scène intacts. Déployez ce dossier
sur un serveur HTTP et chargez-le ainsi :

```js
import { loadSightyPackage } from './exports/course/loader.mjs'

const course = await loadSightyPackage({ root: '#course' })
await course.runtime.initialize()
```

Le loader prépare le scénario et les ressources. L’appel à
`runtime.initialize()` reste l’étape distincte qui crée les occurrences.

Avec l’export de scénario seul, l’application importe `sighty.js` et configure
l’owner CodPlay. Le chargement prépare les ressources du parcours ; appelez
ensuite explicitement `runtime.initialize()` pour créer la composition :

```ts
import { Sighty } from '@codplay/sighty'

const owner = new Sighty({ codplay: { engine: engineCapabilities } })
const course = await owner.load('/exports/course/', { root: '#course' })
await course.runtime.initialize()
await course.runtime.play('layout')
owner.destroy()
```

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
