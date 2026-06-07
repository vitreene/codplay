# Guide de diffusion Codplay — mode broadcast

## Vue d'ensemble

La diffusion d'une scène Codplay dans une application hôte implique deux phases
distinctes et deux équipes potentiellement différentes.

```
┌─────────────────────────────────┐     ┌──────────────────────────────────┐
│         CÔTÉ AUTEUR             │     │        CÔTÉ INTÉGRATEUR          │
│  (outil d'authoring Codplay)    │     │  (application React, Vue, etc.)  │
│                                 │     │                                  │
│  SceneDef + straps              │     │  import Player from 'codplay/    │
│       ↓ builder.compile()       │ ──► │    broadcast'                    │
│  scene-bundle/                  │     │  import datascene from           │
│    scene.json                   │     │    'scene-bundle'                │
│    straps.js                    │     │                                  │
│    index.js          ───────────┘     │  const player = new Player(      │
│    [ressources CDN]                   │    '#container', datascene)      │
└─────────────────────────────────┘     └──────────────────────────────────┘
```

---

## 1. Côté auteur — produire le bundle

### 1.1 La scène (SceneDef)

La scène est écrite en TypeScript dans l'outil d'authoring. Elle déclare les
stories, les persos, les actions et les règles d'écoute. Les `src` de médias
sont des chemins **relatifs** — ils seront préfixés par `resourceBaseUrl` au
moment de la diffusion.

```ts
// src/scenes/my-quiz/scene.ts

import type { SceneDef } from 'codplay'

export const myQuizScene: SceneDef = {
  id: 'my-quiz',
  rootStories: ['container-story'],
  listen: [
    {
      on: 'quiz:answered',
      straps: ['onQuizAnswered']
    }
  ],
  straps: undefined,
  initial: undefined,
  tracks: {},
  stories: {
    'container-story': {
      id: 'container-story',
      entries: ['quiz-container'],           // perso racine — sera dans rootNodeIds
      initial: undefined,
      straps: ['onSceneReady'],
      listen: [],
      persos: [
        {
          id: 'quiz-container',
          type: 'layout',
          initial: {
            // Pas de move → perso racine, sera dans rootNodeIds
            style: { position: 'relative', width: '100%' }
          },
          actions: {}
        },
        {
          id: 'intro-video',
          type: 'media',
          initial: {
            move: { parentId: 'quiz-container', mode: 'append' },
            src: 'videos/intro.mp4',    // ← chemin relatif, extrait dans le manifest
            style: { width: '100%' }
          },
          actions: {
            'quiz:start': {
              broadcast: { type: 'START' }
            },
            'quiz:answered': {
              broadcast: { type: 'STOP' }
            }
          }
        },
        {
          id: 'result-banner',
          type: 'text',
          initial: {
            move: { parentId: 'quiz-container', mode: 'append' },
            content: '',
            style: { display: 'none' }
          },
          actions: {
            'quiz:success': {
              content: 'Bravo !',
              style: { display: 'block', color: 'green' }
            },
            'quiz:failure': {
              content: 'Essayez encore.',
              style: { display: 'block', color: 'red' }
            }
          }
        }
      ]
    }
  }
}
```

### 1.2 Les straps

```ts
// src/scenes/my-quiz/straps.ts

import type { StrapCollection } from 'codplay'

export const myQuizStraps: StrapCollection = {
  onSceneReady: ({ event, state }) => {
    console.log('Scène prête', state)
    return undefined
  },

  onQuizAnswered: ({ event, state }) => {
    const score = (state.score as number ?? 0) + (event.data?.correct ? 1 : 0)
    return {
      update: { score },
      events: score >= 3
        ? [{ name: 'quiz:success' }]
        : [{ name: 'quiz:failure' }]
    }
  }
}
```

### 1.3 Compilation et extraction

`extractSceneFunctions` détecte toutes les fonctions JS dans la scène compilée
— qu'elles viennent de `listen.transform` ou de straps inline — les extrait,
leur génère un nom stable, et les ajoute au strapCollection. Le résultat est
une `CompiledScene` sans aucune fonction : JSON pur dans tous les cas.

```ts
// scripts/build-scene.ts

import { CodPlay } from 'codplay'
import { extractSceneFunctions } from 'codplay/broadcast'
import { myQuizScene } from '../src/scenes/my-quiz/scene'
import { myQuizStraps } from '../src/scenes/my-quiz/straps'
import { writeFileSync } from 'node:fs'

const studio = new CodPlay()
const result = studio.builder.compile({ scene: myQuizScene })

if (!result.ok) {
  throw new Error(`Compilation échouée : ${result.error.code}`)
}

const { compiledScene, diagnostics } = result.data

if (diagnostics.warnings.length > 0) {
  console.warn('Avertissements :', diagnostics.warnings)
}

// Extrait les fonctions JS de la scène (listen.transform, etc.)
// La scène résultante est JSON-safe dans tous les cas
const { serializable, extractedStraps } = extractSceneFunctions(compiledScene)

// Tous les straps : auteur + extraits de la scène
const allStraps = { ...myQuizStraps, ...extractedStraps }

writeFileSync('dist/scene-bundle/scene.json', JSON.stringify(serializable, null, 2))
writeFileSync('dist/scene-bundle/straps-manifest.json', JSON.stringify(Object.keys(allStraps), null, 2))

console.log('rootNodeIds calculés :', serializable.rootNodeIds)
// → ['quiz-container']

console.log('Manifest de ressources :', serializable.resources.entries)
// → [{ url: 'videos/intro.mp4', type: 'video', policy: { cache: 'default', ... } }]

console.log('Straps extraits :', Object.keys(extractedStraps))
// → ['__transform__scene__quiz_answered__0']  si un transform était présent
// → []  si la scène ne contenait aucun transform
```

---

## 2. Les fichiers produits

```
dist/scene-bundle/
│
├── scene.json          ← CompiledScene sérialisée (données pures)
│                         Contient : scene, resources, rootNodeIds, schemaVersion
│
├── straps.js           ← Module ESM : export { myQuizStraps }
│   (ou straps.ts)        Fonctions JS non sérialisables (reducers, helpers)
│
├── index.js            ← Point d'entrée du bundle : assemble DataScene
│
└── [sur CDN séparé]
    videos/
      intro.mp4         ← Ressource référencée dans le manifest
    images/
      ...
```

### index.js — point d'entrée du bundle

Le `index.js` est identique que la scène contienne des `listen.transform` ou non.
`extractSceneFunctions` a déjà tout normalisé au moment du build.

```ts
// dist/scene-bundle/index.ts  (compilé en index.js par le bundler de l'auteur)

import compiledScene from './scene.json'
import { allStraps } from './straps'     // auteur + extraits, fusionnés au build
import type { DataScene } from 'codplay/broadcast'

const datascene: DataScene = {
  compiled: compiledScene,
  straps: allStraps,
  resourceBaseUrl: 'https://cdn.example.com/my-quiz/'
}

export default datascene
```

### scene.json — structure

```json
{
  "schemaVersion": "v1",
  "createdAt": "2026-06-07T10:00:00.000Z",
  "rootNodeIds": ["quiz-container"],
  "resources": {
    "entries": [
      {
        "url": "videos/intro.mp4",
        "type": "video",
        "policy": { "cache": "default", "priority": "normal" }
      }
    ]
  },
  "scene": {
    "id": "my-quiz",
    "rootStories": ["container-story"],
    "listen": [{ "on": "quiz:answered", "straps": ["onQuizAnswered"] }],
    "stories": { "...": "..." },
    "tracks": {},
    "initial": null,
    "straps": null
  }
}
```

---

## 3. Le manifest de ressources

### Ce qui est extrait automatiquement

Le builder scanne tous les persos et collecte les champs `src` déclarés dans
`initial` et dans chaque `action`. L'extension détermine le type :

| Extensions | Type dans le manifest |
|---|---|
| `.mp4` `.webm` `.ogv` | `video` |
| `.mp3` `.wav` `.ogg` `.aac` | `audio` |
| `.png` `.jpg` `.webp` `.svg` `.avif` | `image` |
| `.woff` `.woff2` `.ttf` `.otf` | `font` |
| `.css` | `css` |

Les URLs sans extension reconnue sont ignorées silencieusement.

### Politique de cache par entrée

Chaque entrée du manifest reçoit une politique de cache par défaut. L'auteur peut
la surcharger en passant un `ResourceManifest` existant à `extractResourceManifest` :

```ts
{
  url: "videos/intro.mp4",
  type: "video",
  policy: {
    cache: "default"     // 'default' | 'no-store' | 'immutable'
    priority: "normal"   // 'high' | 'normal' | 'low'
    version: "abc123"    // optionnel — paramètre de cache busting
  }
}
```

### Résolution des URLs en diffusion

Quand `resourceBaseUrl: 'https://cdn.example.com/my-quiz/'` est fourni dans
`DataScene`, le BroadcastPlayer préfixe toutes les URLs relatives avant de les
passer au player :

```
'videos/intro.mp4'
  → 'https://cdn.example.com/my-quiz/videos/intro.mp4'
```

Les URLs déjà absolues (`http://`, `https://`, `//`) sont laissées intactes.

### Préchargement (optionnel)

Le préchargement n'est pas automatique. L'intégrateur peut le déclencher
manuellement avant `play()` :

```ts
import { createPreloadModule } from 'codplay/preload'

const preloader = createPreloadModule()

// Le manifest est disponible sur datascene.compiled.resources
// Les URLs sont déjà préfixées si on les calcule soi-même,
// ou on passe par le BroadcastPlayer qui les préfixe à l'init.
const result = await preloader.load({
  manifest: datascene.compiled.resources,
  options: {
    mode: 'broadcast',   // tolérant : avertit sur les ressources manquantes sans bloquer
    timeout: 15000
  }
})

if (!result.ok) {
  console.warn('Certaines ressources non disponibles', result.error)
}
// result.data.loaded  → URLs chargées
// result.data.skipped → URLs déjà en cache
```

> **Mode `broadcast` vs `author`** : en mode `broadcast`, une ressource
> manquante produit un avertissement mais ne bloque pas. En mode `author`
> (outil de création), toute ressource manquante est une erreur bloquante.

---

## 4. Côté intégrateur — utiliser le bundle

### 4.1 Installation dans l'application hôte

```
host-app/
├── package.json
├── src/
│   ├── App.vue (ou App.tsx, etc.)
│   └── quiz-player.ts      ← intégration Codplay
└── node_modules/
    ├── codplay/             ← package Codplay
    └── scene-bundle/        ← bundle de scène (npm ou local)
```

### 4.2 Intégration minimale

```ts
// src/quiz-player.ts

import Player from 'codplay/broadcast'
import datascene from 'scene-bundle'

export async function mountQuizPlayer(containerId: string): Promise<void> {
  const player = new Player(`#${containerId}`, datascene)

  // Lancer la lecture (init + montage + play au premier appel)
  await player.play()
}
```

### 4.3 Intégration complète avec hooks et telco

```ts
// src/quiz-player.ts

import Player, { telco } from 'codplay/broadcast'
import { createPreloadModule } from 'codplay/preload'
import datascene from 'scene-bundle'

export async function mountQuizPlayer(container: HTMLElement): Promise<() => void> {
  const player = new Player(container, datascene)

  // ── Hooks externes (avant play) ──────────────────────────────────────
  // Enregistrement en BDD quand une réponse est soumise
  player.on('quiz:answered', async ({ event, state }) => {
    try {
      await fetch('/api/quiz/answer', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: state.sessionId,
          answer: event.data?.selected,
          correct: event.data?.correct
        })
      })
      return { status: 'success' }
      // → émet 'hook:success' dans la scène (data: { on: 'quiz:answered' })
    } catch {
      return { status: 'error', code: 'API_UNAVAILABLE' }
      // → émet 'hook:error' dans la scène (data: { on: 'quiz:answered', code: ... })
    }
  })

  // Analytics sans signal de retour
  player.on('quiz:success', async ({ state }) => {
    analytics.track('quiz_completed', { score: state.score })
    // retour undefined → aucun événement réinjecté
  })

  // ── Préchargement (optionnel mais recommandé) ─────────────────────────
  const preloader = createPreloadModule()
  const preloadResult = await preloader.load({
    manifest: datascene.compiled.resources,
    options: { mode: 'broadcast', timeout: 10000 }
  })
  if (!preloadResult.ok) {
    console.warn('[quiz] ressources partiellement disponibles')
  }

  // ── Lancement ─────────────────────────────────────────────────────────
  // play() gère init interne + montage des rootNodeIds + démarrage
  await player.play()

  // ── Contrôle UI via telco (optionnel) ─────────────────────────────────
  const tlc = telco(player)

  // Barre de progression
  const unsubscribeProgress = tlc.onProgress((state) => {
    progressBar.value = state.timelineMs
    timeLabel.textContent = `${Math.round(state.timelineMs / 1000)}s`
  })

  // État des boutons
  const unsubscribeChange = tlc.onChange((state) => {
    playBtn.disabled = tlc.commandInFlight
    playBtn.textContent = state.status === 'playing' ? 'Pause' : 'Play'
  })

  // Connexion des boutons
  playBtn.addEventListener('click', () => tlc.togglePlay())
  rewindBtn.addEventListener('click', () => tlc.rewind())
  seekRange.addEventListener('input', () => tlc.seek(Number(seekRange.value)))

  // ── Pilotage de la scène depuis l'application hôte ───────────────────
  // Démarrer le quiz quand l'utilisateur clique sur un bouton externe
  startBtn.addEventListener('click', () => {
    void player.emit({ name: 'quiz:start' })
  })

  // ── Nettoyage ─────────────────────────────────────────────────────────
  return async () => {
    unsubscribeProgress()
    unsubscribeChange()
    await player.destroy()
  }
}
```

### 4.4 Signal hook:success dans la scène

Si la scène a été prévue pour réagir à l'acquittement du hook :

```ts
// Dans SceneDef.listen (côté auteur)
{
  on: 'hook:success',
  transform: [(event) =>
    event.data?.on === 'quiz:answered'
      ? [{ name: 'quiz:sync-confirmed' }]
      : []
  ]
}
```

La scène reste maître : elle décide si `hook:success` a une signification pour
elle. Si elle n'a pas de règle sur `hook:success`, l'événement est ignoré.

---

## 5. Récapitulatif des fichiers

| Fichier | Producteur | Consommateur | Contenu |
|---|---|---|---|
| `scene.json` | builder (auteur) | BroadcastPlayer | CompiledScene sérialisée (données + rootNodeIds + manifest) |
| `straps.js` | auteur | BroadcastPlayer | Fonctions JS (StrapCollection) |
| `index.js` | auteur | intégrateur | DataScene assemblée (compiled + straps + resourceBaseUrl) |
| `[CDN]/videos/…` | auteur | browser | Ressources média référencées dans le manifest |

---

## 6. Nommage des fonctions extraites

`extractSceneFunctions` génère des noms stables et prévisibles :

| Origine | Nom généré |
|---|---|
| `scene.listen` `on: 'quiz:answered'`, transform index 0 | `__transform__scene__quiz_answered__0` |
| `story['container-story'].listen` `on: 'quiz:start'`, transform index 1 | `__transform__container_story__quiz_start__1` |

Les caractères non alphanumériques du nom d'événement sont remplacés par `_`.

Ces noms apparaissent dans `rule.straps` de la `serializable` scene et dans les
clés de `extractedStraps`. Ils sont opaques pour l'intégrateur — il n'a pas à
les connaître.

> **Transforms et straps : même famille.** Une transform peut être une constante
> nommée comme un strap — inline ou déclarée, peu importe. `extractSceneFunctions`
> traite les deux de façon identique. La distinction `transform` / `strap` dans
> le schéma `ListenRule` est un détail d'implémentation, pas une contrainte
> d'authoring. L'auteur choisit librement la forme qui convient au contexte.
