# Spec — Mode diffusion (Broadcast Player)

## Contexte

Le mode diffusion permet d'intégrer une scène Codplay compilée dans une application
hôte sans exposer la chaîne d'authoring (builder, creator). L'intégrateur reçoit un
artefact `DataScene` (module JS autonome) et un sélecteur de conteneur.

---

## Décisions

### 1. Point d'entrée

```ts
import Player, { telco } from 'codplay/broadcast'

const player = new Player('#container', datascene)
await player.play()
```

- Le constructeur est **synchrone**. Il ne touche pas encore le DOM.
- `play()` est **lazy** : au premier appel, il exécute `init()` + montage des noeuds
  racines, puis démarre la lecture. Les appels suivants (après pause) reprennent
  directement.
- Le sélecteur peut être une `string` CSS ou un `HTMLElement`.

---

### 2. Type DataScene

```ts
type DataScene = {
  compiled: CompiledScene       // artefact JSON produit par le builder
  straps?: StrapCollection      // fonctions JS (straps + transform fns)
  resourceBaseUrl?: string      // préfixe appliqué à toutes les URLs du manifest
}
```

`compiled` peut être importé depuis un fichier JSON. `straps` est le seul fichier JS
nécessaire en diffusion. `resourceBaseUrl` est optionnel si les URLs sont déjà
absolues dans le manifest.

---

### 3. Animation adapter

`anime.js` est bundlé en interne dans le BroadcastPlayer. L'intégrateur n'y touche
pas. La boucle RAF d'anime est désactivée (`engine.useDefaultMainLoop = false`) et
synchronisée avec le ticker du player (`renderFrame: () => engine.update()`).

---

### 4. Câblage DOM events

`createElementOptions.emitRuntimeEvent` est câblé en interne : les interactions DOM
des persos (click, pointerdown, capture) sont automatiquement routées vers
`inner.emit()`. L'intégrateur n'a rien à déclarer.

`getCurrentTimelineMs` est également câblé vers `inner.getState().timelineMs`.

---

### 5. Montage des noeuds racines

Le builder calcule `rootNodeIds: string[]` à la compilation et l'inscrit dans
`CompiledScene`. Cette liste contient les IDs des persos dont `initial.move`
cible l'alias `@root`, à l'intérieur d'une story dont `initial.move` cible lui
aussi l'alias `@root` (`v1-perso-spec.md` 4bis, `v1-story-spec.md`).

Le BroadcastPlayer appelle `getRuntimeRegistry().getNodeById(id)` après `init()` et
appende les noeuds dans le conteneur hôte. L'intégrateur ne déclare rien.

**Règle de dérivation dans le builder :**
Pour chaque story dont `initial.move === '@root'`, prendre ses persos dont
`initial.move` cible aussi l'alias `@root`. Ces IDs constituent `rootNodeIds`.
Une story sans `move`, ou dont le `move` cible un outlet d'une autre story
(`{ parentId }`), ne contribue jamais à `rootNodeIds`.

---

### 6. Ressources

Les URLs du `ResourceManifest` sont préfixées par `resourceBaseUrl` avant le passage
à `init()`. La transformation est une simple concaténation :
`resourceBaseUrl + entry.url`. Les URLs déjà absolues (`http://`, `https://`) sont
laissées intactes.

---

### 7. API publique du BroadcastPlayer

```ts
interface BroadcastPlayerApi {
  // Lecture (lazy init au premier appel)
  play(): Promise<void>
  pause(): Promise<void>
  seek(ms: number): Promise<void>
  
  // Événements scène
  emit(event: StoryEvent): Promise<void>
  
  // Observation
  getState(): PlayerStateSnapshot
  onChange(listener: (state: PlayerStateSnapshot) => void): () => void
  
  // Hooks externes (voir §8)
  on(eventName: string, fn: PlayerHookFn): () => void
  
  // Nettoyage
  destroy(): Promise<void>
}
```

`resume()` et `stop()` ne sont pas exposés : `play()` fait les deux rôles
(démarrage et reprise). `stop()` est réservé au cycle interne.

---

### 8. Telco — service complémentaire optionnel

```ts
import Player, { telco } from 'codplay/broadcast'

const player = new Player('#container', datascene)
const tlc = telco(player)

tlc.togglePlay()
tlc.onProgress(state => { bar.value = state.timelineMs })
tlc.onChange(state => { btn.disabled = tlc.commandInFlight })
tlc.rewind()
```

`telco` est la fonction `createTelco` existante, ré-exportée sous ce nom. Elle
accepte tout `BroadcastPlayerApi` car celui-ci est compatible avec `PlayerApi`
pour les méthodes qu'utilise le telco.

Le `subscribeOnTick` (boucle RAF pour `onProgress`) est bundlé par défaut dans
`telco`. Un deuxième argument optionnel permet de le surcharger pour les
environnements non-browser.

```ts
const tlc = telco(player, { subscribeOnTick: myTicker })
```

---

### 9. Hooks externes — player.on()

Mécanisme permettant à l'application hôte d'attacher des effets de bord à des
événements scène, sans faire partie de l'authoring.

```ts
player.on('quiz:question-answered', async ({ event, state, meta }) => {
  await db.save(event.data)
  return { status: 'success' }   // ou undefined
})
```

**Signature du handler :**

```ts
type PlayerHookFn = (input: {
  event: StoryEvent
  state: DeepReadonly<Record<string, unknown>>
  meta: StrapMeta
}) => Promise<PlayerHookResult> | PlayerHookResult

type PlayerHookResult =
  | undefined
  | { status: 'success' }
  | { status: 'error'; code?: string }
```

Le handler n'a pas accès à `context` (pas de helpers, pas d'émission directe).

**Return value :**
- `undefined` → aucun effet
- `{ status: 'success' }` → le player émet `{ name: 'hook:success', data: { on: eventName } }`
- `{ status: 'error' }` → le player émet `{ name: 'hook:error', data: { on: eventName, code? } }`

Ces événements ne portent aucune donnée issue du handler. La scène peut les écouter
via `listen` si elle a été prévue pour, mais rien ne l'y oblige.

**Implémentation :**
Les hooks sont transformés en straps synthétiques avant `init()`. Pour chaque
`eventName` enregistré, le BroadcastPlayer :
1. Crée un strap nommé `__hook__<eventName>` dans le strapCollection augmenté.
2. Ajoute une règle `{ on: eventName, straps: ['__hook__<eventName>'] }` dans
   `compiledScene.scene.listen` avant de passer à `init()`.

Les hooks doivent être enregistrés avant le premier appel à `play()`. Un
enregistrement après `init()` lève une erreur.

**Isolation :** si la scène a déjà une règle `listen` sur le même événement, les
deux règles coexistent (le pipeline itère toutes les règles correspondantes).

---

### 10. extractSceneFunctions — sérialisation universelle

`listen.transform` et les straps sont de la même famille : des fonctions JS non
sérialisables en JSON. `extractSceneFunctions` unifie leur traitement au moment
du build, avant de produire le `scene.json`.

```ts
import { extractSceneFunctions } from 'codplay/broadcast'

const { serializable, extractedStraps } = extractSceneFunctions(compiledScene)
// serializable  → CompiledScene sans aucune fonction (JSON-safe)
// extractedStraps → StrapCollection des fonctions extraites
```

**Ce que le helper traite :**

| Source | Nom généré | Comportement |
|---|---|---|
| `scene.listen[].transform[i]` | `__transform__scene__<on>__<i>` | Retourne `{ events: transform(event) }` |
| `story.listen[].transform[i]` | `__transform__<storyId>__<on>__<i>` | Idem, scoped à la story |

Les fonctions extraites sont placées en **tête de `rule.straps`** pour préserver
l'ordre d'exécution original (transforms avant straps).

**Transforms et straps sont de la même famille.**
Rien n'interdit de déclarer une transform comme une constante nommée — exactement
comme un strap. Inline ou nommée, la fonction est traitée de la même façon par
`extractSceneFunctions`. La distinction `transform` / `strap` est un détail
d'implémentation du schéma `ListenRule`, pas une contrainte d'authoring.

```ts
// Transform nommée — tout à fait valide
const normalizeAnswer: TransformFn = (event) => [
  { name: 'quiz:answer-normalized', data: { value: String(event.data?.raw).trim() } }
]

// Utilisée exactement comme un strap dans la règle
story.listen = [{ on: 'quiz:raw-answer', transform: [normalizeAnswer] }]
```

**Script de build type :**

```ts
const compiled = builder.compile({ scene }).data.compiledScene
const { serializable, extractedStraps } = extractSceneFunctions(compiled)

writeFileSync('scene.json', JSON.stringify(serializable, null, 2))
// straps.js exporte : { ...myStraps, ...extractedStraps }
```

**`index.js` du bundle — cas général unique :**

```ts
import compiledScene from './scene.json'       // JSON pur, toujours
import { straps } from './straps.js'           // auteur + extraits, toujours

export default { compiled: compiledScene, straps, resourceBaseUrl: '...' }
```

Pas de cas particulier selon que la scène contient des transforms ou non.
Le `index.js` est identique dans tous les cas.

---

## Flux complet

```
[Authoring]
  SceneDef.ts + straps.ts
    → builder.compile()
    → compiledScene.json   (rootNodeIds inclus)
    → strapBundle.js       (straps + transform fns)

[Diffusion]
  import Player from 'codplay/broadcast'
  import datascene from './my-scene'         // { compiled, straps, resourceBaseUrl }

  const player = new Player('#container', datascene)

  player.on('quiz:answered', async ({ event }) => {
    await db.save(event.data)
    return { status: 'success' }
  })

  await player.play()
  // → init interne (anime, emitRuntimeEvent, rootNodeIds)
  // → montage dans #container
  // → lecture
```
