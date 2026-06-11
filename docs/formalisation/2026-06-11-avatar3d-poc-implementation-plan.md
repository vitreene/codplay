# Plan d'implémentation — Avatar 3D POC

Date : 2026-06-11  
Statut : plan actif  
Dépend de : [2026-06-11-avatar3d-component-plan.md](2026-06-11-avatar3d-component-plan.md)

---

## Vue d'ensemble

```
Phase Prep — Transformation données     adapter les fichiers phonèmes/words pour Codplay
Phase 0    — Demo standalone            valider le visuel (TalkingHead seul)
Phase 1    — Intégration Codplay        orchestrer via timeline, straps, sans module
Phase 2    — Variante langue EN         même contenu, bascule de langue
Phase 3    — Module Codplay + ticker    intégration architecture complète
Phase 4    — Extraction lib             composant autonome sans TalkingHead
```

Les phases Prep–2 sont le POC. Les phases 3–4 sont l'évolution si succès.
Chaque phase a un critère de succès avant de passer à la suivante.

---

## Assets de référence

| Asset | Chemin | Usage |
|---|---|---|
| Avatar masculin | `TalkingHead/avatars/avatarsdk.glb` | rendu 3D |
| Audio FR | `phonemes/1_7b_e.mp3` | playback |
| Audio EN | `phonemes/1_7b_e-en.mp3` | variante |
| Words FR | `phonemes/1_7b_e_01/1_7b_e.mp3-words.ts` | timestamps originaux |
| Words EN | `phonemes/1_7b_e_01/1_7b_e.mp3-words-en.ts` | timestamps originaux |
| Phonèmes FR | `phonemes/1_7b_e_01/1_7b_e_fr-phonemes.ts` | cues Preston Blair |
| Phonèmes EN | `phonemes/1_7b_e_01/1_7b_e_en-phonemes.ts` | cues Preston Blair |
| Lipsync FR | `TalkingHead/modules/lipsync-fr.mjs` | module TH |
| Lipsync EN | `TalkingHead/modules/lipsync-en.mjs` | module TH |

---

## Phase Prep — Transformation des données (½ journée)

**Objectif** : produire des fichiers de données directement consommables par Codplay,
sans dépendance aux types de l'ancien projet (Eventime, constantes, channels).

### Contexte des fichiers originaux

Les fichiers `1_7b_e.mp3-words.ts` et `1_7b_e_fr-phonemes.ts` proviennent d'un projet
antérieur avec ses propres conventions (`Eventime`, `MAIN`, `THR3D`, `TRACK_PLAY`…).
Ils ne peuvent pas être importés tels quels dans Codplay.

Les phonèmes utilisent la nomenclature **Preston Blair** (lettres A–H, X), pas Oculus.
TalkingHead attend des codes Oculus (`viseme_PP`, `viseme_aa`…) ou des mots.
La conversion est nécessaire pour la phase 3 (pilotage direct de TH par setFixedValue).

### Fichiers à produire

```
packages/demos/src/scenes/avatar-data/
  phrase-fr.ts        word timestamps FR — format Codplay (ms)
  phrase-en.ts        word timestamps EN — format Codplay (ms)
  phonemes-fr.ts      cues visèmes FR — codes Oculus, timestamps ms
  phonemes-en.ts      cues visèmes EN — codes Oculus, timestamps ms
  NOTE-transformations.md
```

### `phrase-fr.ts` — format cible

Source : `1_7b_e.mp3-words.ts` (timecodes `HH:MM:SS.mmm`)

```ts
// Transformation : timecodeToDuration("00:00:00.180") → 180
// Chaque mot : { word, startMs, endMs, durationMs }
export type WordCue = { word: string; startMs: number; endMs: number; durationMs: number }

export const phraseWordsFR: WordCue[] = [
  { word: 'Vous',    startMs: 180,  endMs: 330,  durationMs: 150  },
  { word: "l'avez", startMs: 330,  endMs: 570,  durationMs: 240  },
  { word: 'donc',   startMs: 570,  endMs: 810,  durationMs: 240  },
  // …
]

// Format speakAudio TalkingHead (dérivé de phraseWordsFR)
export const speakAudioFR = {
  words:      phraseWordsFR.map(w => w.word),
  wtimes:     phraseWordsFR.map(w => w.startMs),
  wdurations: phraseWordsFR.map(w => w.durationMs),
}
```

### `phonemes-fr.ts` — mapping Preston Blair → Oculus

Source : `1_7b_e_fr-phonemes.ts` (codes A–H, X, timestamps en secondes)

```ts
// Mapping Preston Blair → nom TalkingHead setFixedValue
// null = silence (tous les visèmes à zéro)
const PRESTON_TO_OCULUS: Record<string, string | null> = {
  A: 'viseme_PP',   // bilabial fermé
  B: null,          // repos / neutre
  C: 'viseme_aa',   // bouche ouverte "ah"
  D: 'viseme_aa',   // schwa ≈ aa
  E: 'viseme_E',    // voyelle antérieure
  F: 'viseme_O',    // voyelle arrondie
  G: 'viseme_FF',   // labiodental
  H: 'viseme_DD',   // dental/alvéolaire
  X: null,          // silence
}

export type VisemeCue = {
  startMs: number
  endMs: number
  durationMs: number
  viseme: string | null   // null = silence
}

// Résultat : cues convertis, prêts pour setFixedValue ou piste Codplay
export const phonemesFR: VisemeCue[] = [ /* mouthCues convertis */ ]
```

### `NOTE-transformations.md`

Documente les transformations effectuées :
- Conversion timecode → ms
- Mapping Preston Blair → Oculus (table complète + justification)
- Pourquoi `B` et `X` sont mappés à `null` (position neutre)
- Cas limites : apostrophes dans les mots (`l'avez`), ponctuation
- Durée totale de la phrase FR vs EN (pour aligner les eventimes Codplay)

### Critère de succès Phase Prep

- [ ] `phraseWordsFR` couvre tous les mots de la piste audio
- [ ] Durée totale vérifiée contre la durée réelle du MP3
- [ ] `phonemesFR` couvre la durée complète (pas de trous non intentionnels)
- [ ] `NOTE-transformations.md` rédigé

---

## Phase 0 — Demo standalone (1 jour)

**Objectif** : valider que TalkingHead + `avatarsdk.glb` + audio FR donnent un résultat
visuel acceptable. Pas de Codplay. Pas de gestion audio par Codplay — TalkingHead
gère l'audio en interne dans cette phase uniquement.

### Fichier cible

```
packages/demos/src/codplay/avatar-poc-0.html
```

### Implémentation

```js
head = new TalkingHead(nodeAvatar, {
  ttsEndpoint: null,
  lipsyncModules: ['fr', 'en'],
  cameraView: 'upper'
})

await head.showAvatar({
  url: '/avatars/avatarsdk.glb',
  body: 'M',
  avatarMood: 'neutral',
  lipsyncLang: 'fr',
  retarget: {
    Neck: { z: -0.01, rx: -0.15 }, Neck1: { z: -0.01, rx: -0.15 },
    Neck2: { z: -0.01, rx: -0.15 },
    LeftShoulder: { rz: -0.3 }, RightShoulder: { rz: 0.3 },
    scaleToEyesLevel: 1.0, origin: { y: -0.1 }
  }
})

// Audio géré par TH en interne (Web Audio API)
const audioBuffer = await head.audioCtx.decodeAudioData(
  await (await fetch('/audio/1_7b_e.mp3')).arrayBuffer()
)

document.getElementById('play').onclick = () => {
  head.speakAudio({
    audio: audioBuffer,
    ...speakAudioFR    // depuis phrase-fr.ts
  })
}
```

**Note** : dans cette phase, TalkingHead gère l'audio via son propre `audioCtx`.
Ce sera inversé en Phase 3 (Codplay gère l'audio, TH ne fait que Three.js).

### Critère de succès Phase 0

- [ ] Avatar masculin s'affiche (proportions, texture, cheveux)
- [ ] Audio FR joue
- [ ] Mouvements de bouche synchronisés
- [ ] Idle naturel (clignements, micro-expressions)
- [ ] Aucune erreur console critique

---

## Phase 1 — Intégration Codplay (2 jours)

**Objectif** : une scène Codplay orchestre l'avatar via sa timeline. TalkingHead
tourne dans sa propre boucle. La scène pilote : démarrage de la parole, sous-titres,
changement d'humeur. Pas encore de module Codplay — intégration par closure.

**Audio** : toujours géré par TalkingHead en interne (comme Phase 0).

### Fichiers cibles

```
packages/demos/src/scenes/avatar-poc-scene.ts
packages/demos/src/codplay/avatar-poc-1.html
```

### Scène Codplay

```ts
// avatar-poc-scene.ts
const phraseEndMs = Math.max(...phraseWordsFR.map(w => w.endMs)) + 500

const scene: SceneDoc = {
  rootStories: ['avatar', 'subtitles'],
  stories: {
    avatar: {
      persos: {},
      eventimes: [
        { at: 200,           event: 'avatar:speak'             },
        { at: phraseEndMs,   event: 'avatar:mood',
          payload: { mood: 'happy' }                           },
      ]
    },
    subtitles: {
      persos: {
        caption: { type: 'text', initial: { content: '' }, actions: {} }
      },
      eventimes: phraseWordsFR.map(w => ({
        at: w.startMs,
        event: 'subtitle:word',
        payload: { word: w.word, durationMs: w.durationMs }
      }))
    }
  }
}
```

### Straps (intégration par closure)

```ts
// buildAvatarStraps(head, audioBuffer)
function buildAvatarStraps(head: TalkingHead, audioBuffer: AudioBuffer) {
  return {
    'avatar:speak': () => {
      head.speakAudio({ audio: audioBuffer, ...speakAudioFR })
      return {}
    },
    'avatar:mood': ({ event }) => {
      head.setMood(event.payload.mood as string)
      return {}
    },
    'subtitle:word': ({ event, state }) => ({
      update: { caption: { content: event.payload.word } }
    })
  }
}
```

**Point de vigilance** : TalkingHead a sa propre boucle indépendante. La pause Codplay
ne stoppe pas l'audio TH automatiquement. À gérer via les hooks lifecycle du player
ou en exposant `head.stop()` / `head.start()` depuis la strapCollection.

### Critère de succès Phase 1

- [ ] Player Codplay déclenche `speakAudio` au bon moment
- [ ] Sous-titres synchronisés avec les mots de `phraseWordsFR`
- [ ] Humeur change en fin de phrase
- [ ] Seek Codplay (repositionnement de la timeline) ne décale pas l'audio TH
- [ ] Documentation des limites : pause, seek, audio non coordonnés avec TH

---

## Phase 2 — Variante EN (1 jour)

**Objectif** : bascule vers la version anglaise sans rechargement de l'avatar.
Valide que l'architecture est multilingue.

### Paramétrage

```ts
type AvatarLang = 'fr' | 'en'

const DATA: Record<AvatarLang, { speakAudio: SpeakAudioData, words: WordCue[] }> = {
  fr: { speakAudio: speakAudioFR, words: phraseWordsFR },
  en: { speakAudio: speakAudioEN, words: phraseWordsEN },
}
```

À `showAvatar`, `lipsyncLang` est passé dynamiquement. La scène est reconstruite
avec les words de la langue sélectionnée.

### Critère de succès Phase 2

- [ ] Bascule FR/EN sans rechargement avatar
- [ ] Lip-sync correct dans les deux langues (visuellement vérifiable)
- [ ] Sous-titres dans la bonne langue
- [ ] Même durée de scène (les deux audios sont ≈ 17.8s)

---

## Phase 3 — Module Codplay + Ticker (si succès POC, 4-5 jours)

**Objectif** : intégration architecture complète. Codplay devient souverain sur le temps
et sur l'audio. TalkingHead ne fait que Three.js.

### Séparation audio / Three.js

**Avant (phases 0–2)** : TalkingHead gère audio + Three.js.
**Après (phase 3)** : Codplay gère l'audio (perso `media` natif).
TalkingHead est initialisé en mode `avatarOnly` — Three.js uniquement.

```
Codplay player
  ├── perso audio (type: 'media') ← gère 1_7b_e.mp3
  └── perso avatar3d (type: 'avatar3d', module: Avatar3DModule)
        └── TalkingHead en mode avatarOnly (Three.js seul)
```

### Connexion au ticker Codplay — pattern `renderFrame`

TalkingHead en mode `avatarOnly` ne lance pas de `requestAnimationFrame` propre.
Sa méthode `animate(deltaMs)` doit être appelée à chaque frame depuis Codplay.

**Patron observé dans le codebase** (`broadcast-player.ts`) :
```ts
// BroadcastPlayer désactive la boucle propre d'anime.js
engine.useDefaultMainLoop = false

const animationAdapter = createAnimationAdapter(anime, {
  renderFrame: () => { engine.update() }   // ← tick anime.js depuis Codplay
})
```

`renderFrame(frameNowMs: number)` est le seul callback de frame sur `AnimationAdapter`.
Il est appelé depuis `RendererFacade.renderFrame()` → `create-player.ts` à chaque tick.

**Patron pour TalkingHead** — même mécanisme, delta calculé localement :
```ts
let prevFrameMs: number | null = null

const animationAdapter = createAnimationAdapter(anime, {
  renderFrame: (nowMs: number) => {
    engine.update()                                       // anime.js
    const delta = prevFrameMs !== null ? nowMs - prevFrameMs : 0
    if (talkingHead !== null) talkingHead.animate(delta)  // Three.js avatar
    prevFrameMs = nowMs
  }
})
```

Ce câblage se fait au niveau de la démo (avant `player.init`), pas dans un module.
Le module Avatar3D expose la référence à `talkingHead` pour que la closure s'y connecte.

**Pour la production (post-POC)** : étendre `RuntimeModuleHost` avec :
```ts
host.subscribeToRenderFrame(cb: (frameNowMs: number) => void): () => void
```
Le module souscrit lui-même au frame lors de `install()` — propre, pas de closure extérieure.
C'est la généralisation du pattern animejs au niveau module. À concevoir avec l'architecture
Codplay avant implémentation (impact sur `renderer/create-renderer.ts` et `RuntimeModuleHost`).

### Canvas Three.js

Le composant `Avatar3DComponent` crée et possède le canvas Three.js.
La méthode `render()` du composant retourne ce canvas (un `HTMLCanvasElement`).
Codplay monte ce nœud dans le DOM comme pour tout autre perso.

### Comportement PAUSE vs STOP

TalkingHead en mode `avatarOnly` est piloté exclusivement via `animate(delta)` :
- **PAUSE** : cesser d'appeler `animate(delta)` — le rendu Three.js gèle, l'état
  (morph targets, position) est conservé en mémoire. Reprise immédiate sans réinit.
- **STOP** : appeler `head.stopSpeaking()` + remettre l'avatar en idle — le canvas
  reste actif, TalkingHead reste chargé pour un prochain `START`.

`PAUSE` est préféré à `STOP` pour la commande telco "pause" : aucune perte d'état,
reprise transparente. `STOP` est réservé à la fin explicite de la séquence.

### `lipsyncLang` dans l'action START

La langue n'est pas figée à la config du perso : elle est transportée dans le payload
du broadcast `START`, ce qui permet une modification dynamique pendant la lecture.

```ts
// Depuis une eventimes ou un strap :
update: { avatar: { broadcast: { type: 'START', lipsyncLang: 'fr' } } }
update: { avatar: { broadcast: { type: 'START', lipsyncLang: 'en' } } }
```

Le module lit `resolvedAction.broadcast.lipsyncLang` dans le hook `afterUpdate`.

### Déclaration du module avatar3d

Un perso `type: 'avatar3d'` dans la scène déclare son module :

```ts
persos: {
  avatar: {
    type: 'avatar3d',
    module: {
      avatarUrl: '/avatars/avatarsdk.glb',
      body: 'M',
      cameraView: 'upper',
      retarget: {
        Neck: { z: -0.01, rx: -0.15 },
        LeftShoulder: { rz: -0.3 }, RightShoulder: { rz: 0.3 },
        scaleToEyesLevel: 1.0, origin: { y: -0.1 }
      }
    },
    initial: {},
    actions: {
      start:  { broadcast: { type: 'START' } },
      stop:   { broadcast: { type: 'STOP'  } },
      pause:  { broadcast: { type: 'PAUSE' } },
    }
  }
}
```

### Implémentation du module

```ts
// Avatar3DModule : RuntimeModule
const Avatar3DModule: RuntimeModule = {
  install(host: RuntimeModuleHost): RuntimeModuleBinding {
    let head: TalkingHead | null = null
    let isRunning = false

    // Post-POC : remplacer par host.subscribeToRenderFrame(...)
    // Pour Phase 3, head est exposé pour câblage dans la closure renderFrame (voir ci-dessus)
    Avatar3DModule._headRef = () => head

    return {
      runtime: {
        match: { componentCapabilities: ['avatar3d'] },
        hooks: {
          onInitialPerso: ({ perso }) => {
            const cfg = perso?.module as Record<string, unknown>
            head = new TalkingHead(null, {
              avatarOnly: true,
              avatarOnlyScene: threeScene,
              avatarOnlyCamera: threeCamera,
            })
            void head.showAvatar({ url: cfg.avatarUrl as string, body: cfg.body as string, retarget: cfg.retarget })
          },
          afterUpdate: ({ resolvedAction }) => {
            const broadcast = resolvedAction?.broadcast as { type: string; lipsyncLang?: string } | undefined
            if (!broadcast) return
            if (broadcast.type === 'START') {
              if (broadcast.lipsyncLang) head?.setLipsyncLanguage(broadcast.lipsyncLang)
              isRunning = true
            }
            if (broadcast.type === 'PAUSE') { isRunning = false }
            if (broadcast.type === 'STOP')  { isRunning = false; head?.stopSpeaking() }
          },
          onDestroy: () => {
            head?.stopSpeaking()
            head = null
          }
        }
      },
      events: {
        'avatar:viseme':     (p) => head?.setFixedValue('viseme_' + p.payload.name, p.payload.weight as number),
        'avatar:expression': (p) => head?.setFixedValue(p.payload.name as string, p.payload.weight as number),
        'avatar:mood':       (p) => head?.setMood(p.payload.mood as string),
      }
    }
  }
}
```

### Enregistrement et câblage

```ts
// Dans la démo, avant player.init :
renderer.module.register({ name: 'avatar3d', module: Avatar3DModule })

// renderFrame : chaîner anime.js + TalkingHead (closure)
let prevFrameMs: number | null = null
const animationAdapter = createAnimationAdapter(anime, {
  renderFrame: (nowMs) => {
    engine.update()
    const head = Avatar3DModule._headRef?.()
    if (head) head.animate(prevFrameMs !== null ? nowMs - prevFrameMs : 0)
    prevFrameMs = nowMs
  }
})
```

### Contrôle "comme les autres médias" (telco)

Le perso `avatar3d` répond aux broadcasts `START`/`STOP`/`PAUSE` exactement comme
un perso `media`. Il peut être piloté par la telco Codplay sans logique spéciale.

### Critère de succès Phase 3

- [ ] TalkingHead tické par Codplay via `renderFrame`, aucun `requestAnimationFrame` propre
- [ ] PAUSE Codplay fige l'avatar (rendu Three.js et animations) sans perte d'état
- [ ] Audio géré par le perso `media` Codplay — synchronisé avec l'avatar
- [ ] Seek Codplay reconstruit les morph targets visème/expression
- [ ] Broadcast `START`/`STOP` depuis la timeline pilote l'avatar
- [ ] `lipsyncLang` passé dans le payload `START`, bascule sans rechargement

---

## Phase 4 — Extraction lib (si succès Phase 3, 3-4 semaines)

**Objectif** : supprimer la dépendance TalkingHead. Extraire dans `packages/avatar3d/`
uniquement ce dont Codplay a besoin.

### Ce qu'on extrait (voir plan architectural)

| Module | Source TH | Notes |
|---|---|---|
| `avatar-loader.ts` | `showAvatar()` | GLB, retarget, morph discovery |
| `morph-target-controller.ts` | `updateMorphTargets()` | priority, smoothing |
| `animation-controller.ts` | AnimationMixer wrapper | tick externe |
| `lipsync-processor.ts` | `lipsync-fr.mjs` + `lipsync-en.mjs` | copie MIT |
| `avatar-authoring.ts` | algorithmique | `wordsToVisemeTracks()` |

### Ce qu'on jette

- Boucle `animate()` interne (remplacée par ticker Codplay)
- Pipeline TTS / Google / Azure
- `speakAudio` / `speakText`
- `audioCtx` / Web Audio pipeline
- Queue `animQueue` (remplacée par les pistes Codplay)
- Toute la logique de listening (microphone)

### Critère de succès Phase 4

- [ ] Demo Phase 1 reproductible sans importer TalkingHead
- [ ] Seek complet : morph targets et expressions reconstruits
- [ ] Pistes Codplay : visème, expression, gesture, word
- [ ] Tests unitaires sur `LipsyncProcessor` et normalisation timestamps

---

## Décisions architecturales — Q1–Q5 (résolues)

| Question | Décision | Détails |
|---|---|---|
| **Q1** — Tick hook | `renderFrame` sur `AnimationAdapter` | Pattern animejs : `{ renderFrame: (nowMs) => { engine.update(); head.animate(dt) } }`. Production : `host.subscribeToRenderFrame()` dans `RuntimeModuleHost`. |
| **Q2** — Canvas Three.js | `render()` du composant crée le canvas | Codplay monte le nœud comme tout autre perso. |
| **Q3** — PAUSE vs STOP | PAUSE = arrêt du tick (état conservé) | Three.js gèle sans perte. STOP = `stopSpeaking()` + reset idle. Préférence Three.js confirmée. |
| **Q4** — Seek gestes | Non défini pour Phase 3 | `AnimationMixer.setTime()` ou reset à idle — à trancher en Phase 3. |
| **Q5** — `lipsyncLang` | Payload du broadcast `START` | `{ type: 'START', lipsyncLang: 'fr' }` — bascule dynamique en cours de séquence. |

## Question ouverte pour Phase 3

| Question | Impact |
|---|---|
| Seek des gestes (AnimationMixer) : reset à idle ou lecture partielle ? | Fidélité seek Phase 3 |
