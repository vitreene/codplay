# Plan — `@codplay/avatar-engine` : extraction des couches pertinentes de TalkingHead

Date : 2026-06-13  
Statut : étude — prêt à planifier  
Branche cible : à créer  
Référence : [2026-06-11-avatar3d-component-plan.md](2026-06-11-avatar3d-component-plan.md) (phase 1 = wrapper TH)

---

## Objectif

Remplacer l'utilisation de TalkingHead (met4citizen) comme bibliothèque externe par l'extraction directe de ses couches pertinentes dans un package CodPlay-owned : `@codplay/avatar-engine`.

**Motivations :**
- CodPlay souverain sur le state machine d'animation → seek trivial et sans effets de bord.
- Architecture data-driven : chaque couche d'animation = un track CodPlay distinct.
- Les animations idle sont pilotées par des straps CodPlay, pas par TH.
- TTS, chat, lipsync live restent hors périmètre (futur : editor).
- Package séparé (`avatar-engine`) facilite la conception de variantes d'avatar.

**Format modèle retenu : GLB + rig Mixamo.** (VRM écarté — raisons de compatibilité.)

---

## Attribution

Les éléments suivants sont extraits de TalkingHead par Mika Suominen (met4citizen), licence MIT :
- Moteur morph target (`mtAvatar`, boucle d'easing, `setFixedValue`)
- Presets expressions / humeurs (`animMoods`)
- Templates gestures (`gestureTemplates`)
- Modules lipsync (`lipsync-fr.mjs`, `lipsync-en.mjs`, etc.)
- Retargeter Mixamo (`retargeter.mjs`)

Source originale : https://github.com/met4citizen/TalkingHead  
Chaque fichier extrait portera un en-tête de crédit.

---

## Périmètre extrait vs écarté

| Couche TH | Décision | Notes |
|---|---|---|
| Moteur morph target | **Extrait** | Propriété CodPlay → seek propre |
| `animMoods` (baselines expressions) | **Extrait** | Déclenché par event, pas par TH |
| `gestureTemplates` + bones Mixamo | **Extrait** | Track gesture CodPlay |
| Modules lipsync (`lipsync-*.mjs`) | **Conservés tels quels** | Authoring uniquement |
| `retargeter.mjs` | **Conservé tel quel** | Chargement GLB Mixamo |
| `dynamicbones.mjs` | **Écarté pour l'instant** | Optionnel (cheveux, vêtements) |
| Animations idle internes TH | **Remplacées** | Straps CodPlay (voir §Idle) |
| Pipeline TTS / WebAudio / WorkletNode | **Écarté** | Future : editor |
| Chat / stream pipeline | **Écarté** | Future : editor |

---

## Pré-requis modèle GLB — documentation détaillée

### Format et structure

- **Format** : GLB (binaire glTF 2.0), fichier unique auto-suffisant (textures embarquées).
- **Unité** : 1 unité = 1 mètre (standard glTF).
- **Orientation** : Y-up, Z-forward (standard glTF).
- **Pivot** : à l'origine (0,0,0) au niveau des pieds (convention Mixamo).

### Rig squelettique — Mixamo

Le modèle doit être riggué avec le squelette standard Mixamo. Bones requis (noms exacts) :

```
Hips, Spine, Spine1, Spine2
Neck, Neck1, Neck2, Head
LeftShoulder, LeftArm, LeftForeArm, LeftHand
RightShoulder, RightArm, RightForeArm, RightHand
LeftUpLeg, LeftLeg, LeftFoot, LeftToeBase
RightUpLeg, RightLeg, RightFoot, RightToeBase
```

Le retargeter TH ajuste les rotations de repos et rebinde le skin ; les noms exacts sont requis.

### Morph targets faciaux — convention ARKit

Le mesh de tête doit exposer les morph targets suivants via `morphTargetDictionary` Three.js.

**14 visèmes (obligatoires) :**

| Nom | Phonème représenté |
|---|---|
| `viseme_PP` | /p/, /b/, /m/ |
| `viseme_FF` | /f/, /v/ |
| `viseme_TH` | /th/ |
| `viseme_DD` | /t/, /d/ |
| `viseme_kk` | /k/, /g/ |
| `viseme_CH` | /tʃ/, /dʒ/, /ʃ/ |
| `viseme_SS` | /s/, /z/ |
| `viseme_nn` | /n/, /l/, /r/ |
| `viseme_RR` | /r/ (variante) |
| `viseme_aa` | /a/, /ʌ/ |
| `viseme_E` | /ɛ/, /e/ |
| `viseme_I` | /i/ |
| `viseme_O` | /o/, /ɔ/ |
| `viseme_U` | /u/ |

Note : certains modèles (dont `avatarsdk.glb`) incluent `viseme_sil` (silence) comme 15e morph — ignoré par le moteur, non requis.

**Expressions faciales — ARKit 52 complet (obligatoire)**

Les modèles fournis exposent l'ARKit 52 en totalité. Le moteur est conçu pour utiliser l'ensemble complet.

```
eyeBlinkLeft, eyeBlinkRight
eyeLookDownLeft, eyeLookDownRight
eyeLookInLeft, eyeLookInRight
eyeLookOutLeft, eyeLookOutRight
eyeLookUpLeft, eyeLookUpRight
eyeSquintLeft, eyeSquintRight
eyeWideLeft, eyeWideRight
jawForward, jawLeft, jawOpen, jawRight
mouthClose
mouthDimpleLeft, mouthDimpleRight
mouthFrownLeft, mouthFrownRight
mouthFunnel
mouthLeft, mouthRight
mouthLowerDownLeft, mouthLowerDownRight
mouthPressLeft, mouthPressRight
mouthPucker
mouthRollLower, mouthRollUpper
mouthShrugLower, mouthShrugUpper
mouthSmileLeft, mouthSmileRight
mouthStretchLeft, mouthStretchRight
mouthUpperUpLeft, mouthUpperUpRight
browDownLeft, browDownRight
browInnerUp
browOuterUpLeft, browOuterUpRight
cheekPuff
cheekSquintLeft, cheekSquintRight
noseSneerLeft, noseSneerRight
tongueOut
```

Total attendu : 14 visèmes + 38 expressions = 52 morph targets (+ éventuellement `viseme_sil`, ignoré). Le moteur initialise `mtAvatar` depuis `morphTargetDictionary` — un morph absent du modèle est simplement ignoré sans erreur.

### Config retarget par modèle

Chaque modèle nécessite une config de retarget documentée (ajustements de pose de repos Mixamo) :

```ts
type RetargetConfig = {
  // Par bone : overrides de rotation (radians) et translation
  [boneName: string]: { rx?: number; ry?: number; rz?: number; x?: number; y?: number; z?: number }
  // Mise à l'échelle vers hauteur des yeux cible (en unités)
  scaleToEyesLevel?: number
  // Décalage d'origine (en unités)
  origin?: { x?: number; y?: number; z?: number }
}
```

**Config `avatarsdk.glb` (modèle masculin) :**
```ts
{
  Neck:  { z: -0.01, rx: -0.15 },
  Neck1: { z: -0.01, rx: -0.15 },
  Neck2: { z: -0.01, rx: -0.15 },
  LeftShoulder:  { rz: -0.3 },
  RightShoulder: { rz:  0.3 },
  scaleToEyesLevel: 1.0,
  origin: { y: -0.1 },
}
```

**Config `brunette.glb` (modèle féminin) :**  
À documenter lors du premier chargement — même procédure que le modèle masculin.

### Paramètres caméra de référence

Pour un cadrage tête-tronc (bust shot) :
```
FOV     : 10° (perspective comprimée — évite la distorsion grand-angle sur le visage)
Aspect  : 1:1 (600×600 pour la démo)
Near    : 0.1, Far : 2000
Position : (0, 1.5, 3)   ← camY=1.5 (hauteur de poitrine), camZ=3
LookAt  : (0, 1.5, 0)
```

---

## Architecture `@codplay/avatar-engine`

### Structure du package

```
packages/
  avatar-engine/
    src/
      morph-engine.ts       ← mtAvatar + boucle easing (extrait TH, crédité)
      expression-engine.ts  ← animMoods / baselines (extrait TH, crédité)
      gesture-engine.ts     ← gestureTemplates + bones Mixamo (extrait TH, crédité)
      model-loader.ts       ← chargement GLB + init mtAvatar depuis morphTargetDictionary
      avatar-engine.ts      ← façade principale : init, animate(dt), resetForSeek()
    lipsync/
      lipsync-fr.mjs        ← copié de TH (MIT, en-tête crédit)
      lipsync-en.mjs
      lipsync-de.mjs
      lipsync-fi.mjs
      lipsync-lt.mjs
    retargeter.mjs          ← copié de TH (MIT, en-tête crédit)
    package.json
    tsconfig.json

  avatar3d/                 ← package existant, devient une fine couche
    src/
      avatar3d-component.ts ← composant CodPlay utilisant avatar-engine
      talking-head-render-adapter.ts  ← remplacé par l'adapter natif engine
    package.json
```

### API publique de `avatar-engine`

```ts
// Initialisation
const engine = await createAvatarEngine({
  glbUrl: '/avatars/avatarsdk.glb',
  scene: threeScene,
  retarget: { Neck: { z: -0.01, rx: -0.15 }, … },
  initialMood: 'neutral',
})

// Tick — appelé par CodPlay à chaque frame
engine.animate(deltaMs: number): void

// Seek — appelé par CodPlay avant/après replay
engine.resetForSeek(): void   // remet tous les morphes à baseline

// Pilotage depuis les tracks
engine.setViseme(name: string, weight: number): void
engine.setExpression(name: string, weight: number): void
engine.setMood(name: string): void
engine.playGesture(name: string): void
engine.releaseVisemes(): void
```

### Seek — résolution triviale

CodPlay est propriétaire du state machine. `resetForSeek()` :

```ts
resetForSeek(): void {
  for (const mt of Object.values(this.mtAvatar)) {
    mt.fixed = null
    mt.value = mt.baseline ?? 0
    mt.applied = mt.baseline ?? 0
    mt.v = 0
    mt.needsUpdate = true
  }
  this.animate(0)  // applique les baselines instantanément
}
```

`snapVisemeMorphs` disparaît. Le render adapter se réduit à `tick` + `seek` (qui appelle `engine.resetForSeek()` puis `render()`).

---

## Tracks CodPlay — 3 couches indépendantes

### Track `viseme`

```ts
// Entry de track
{ viseme: 'PP' | 'FF' | 'TH' | 'DD' | 'kk' | 'CH' | 'SS' | 'nn' | 'RR' | 'aa' | 'E' | 'I' | 'O' | 'U' | null,
  weight: number }  // weight ∈ [0, 1]
```

`viseme: null` = relâche (bouche neutre). Runtime : `engine.setViseme(v, weight)`.

Génération authoring (via modules lipsync) :
1. `lipsync-fr.mjs` : `wordsToVisemes(word)` → `{ visemes[], times[], durations[] }` (unités relatives)
2. Normalisation : `scaleFactor = wordDurationMs / sum(durations)`
3. `keyframeMs = wordStartMs + times[i] * scaleFactor`
4. Chaque keyframe → entry track `{ ms, viseme, weight }`

### Track `expression`

```ts
{ expression: string, weight: number }
// expression : nom ARKit ('mouthSmileLeft', 'eyeBlinkLeft'…) ou alias mood ('happy', 'sad'…)
```

Runtime : `engine.setExpression(name, weight)`.

### Track `gesture`

```ts
{ gesture: string }
// gesture : nom de template ('wave', 'nod', 'shrug'…)
```

Runtime : `engine.playGesture(name)`.

---

## Idle — modèle basé sur les règles TH

Les animations idle NE sont PAS gérées par le moteur interne. Elles sont pilotées par un **strap CodPlay** qui émet des events sur une piste dédiée selon une **pseudo-random déterministe seedée**.

### Pseudo-random seedé — exigence

Le caractère aléatoire des animations idle doit être **reproductible** : à seed identique, la séquence d'events est identique. Cela garantit que seek peut reconstruire l'état idle par replay de track sans surprise.

**Contrainte** : le strap n'utilise pas `Math.random()`. Il utilise un générateur PRNG seedé, instancié avec un seed fourni à l'init. Exemples non prescriptifs de bibliothèques adaptées : `prando`, `pure-rand`. Le seed peut être un entier arbitraire fixé par config de la scène.

### Règles de timing — basées sur TH

À documenter formellement dans un doc séparé. Valeurs de référence TH :

| Animation | Intervalle | Durée | Morph targets |
|---|---|---|---|
| Blink | 3–6 s | 150 ms (fermeture) + 100 ms (ouverture) | `eyeBlinkLeft`, `eyeBlinkRight` |
| Micro-move tête | 0.5–2 s | 500–2000 ms | `headRotateX/Y/Z` (bones) |
| Respiration | 3–5 s | 1000 ms | `mouthShrugLower` + body subtil |
| Eye look-around | 8–15 s | 800 ms | `eyeLookInLeft/Right`, `eyeLookOutLeft/Right` |

Le strap idle reçoit à l'init une config de fréquences et d'intensités (doc séparée à formaliser). Les valeurs par défaut reproduisent le comportement TH.

---

## Ce qui reste dans `@codplay/avatar3d`

`@codplay/avatar3d` devient une fine couche d'intégration CodPlay :
- `Avatar3DComponent` — reçoit `AvatarEngine` dans ses deps, translate les events CodPlay vers les appels engine
- Render adapter simplifié (`tick` + `seek` via `engine.resetForSeek()`)
- Export des types CodPlay-facing

`@codplay/avatar-engine` ne connaît pas CodPlay — réutilisable indépendamment pour des variantes.

---

## Séquence d'implémentation

### Étape 1 — `model-loader.ts` + `morph-engine.ts`

- Chargement GLB via `THREE.GLTFLoader`
- Extraction `morphTargetDictionary` → initialisation `mtAvatar`
- Boucle d'easing extraite de TH (lignes 1654–1812 de `talkinghead.mjs`)
- Test : `engine.animate(dt)` met à jour les morph targets Three.js
- Documentation des pré-requis modèle validée sur `avatarsdk.glb` + modèle féminin

### Étape 2 — `expression-engine.ts` + seek

- Extraction `animMoods` de TH
- `engine.setMood()`, `engine.setExpression()`
- `engine.resetForSeek()` → seek propre validé

### Étape 3 — `gesture-engine.ts`

- Extraction `gestureTemplates` + animation Mixamo bones
- `engine.playGesture()`

### Étape 4 — Lipsync authoring

- Copie + crédit des modules lipsync
- Helper `wordsToVisemeTracks(wordTimestamps, lang)` dans `@codplay/avatar3d`

### Étape 5 — Idle strap

- Strap CodPlay avec config fréquences (formalisée séparément)
- Intégration dans la démo

### Étape 6 — Démo intégrée

- Migration `avatar-poc-1-demo.ts` de TH → avatar-engine
- Test seek, seek→play, rewind
- Validation avec modèle féminin alternatif

---

## Packages TTS et Stream — isolation pour l'editor

Ces deux couches sont hors périmètre du player mais font partie de l'extraction TH. Elles sont documentées ici pour figer leur périmètre et leur interface avant qu'elles soient nécessaires.

### `@codplay/tts`

**Rôle** : wrapper autour d'un endpoint TTS externe. Reçoit du texte, retourne audio + word-timestamps.

**Source TH** : `speakText()` (lignes 2856–3105), gestion `ttsEndpoint`, `ttsApikey`, options langue/voix/rate/pitch.

**API cible :**
```ts
type TTSRequest = {
  text: string
  lang?: string       // 'fr', 'en', …
  voice?: string
  rate?: number       // 0.5–2.0
  pitch?: number
}

type TTSResult = {
  audio: ArrayBuffer
  words: string[]
  wtimes: number[]        // ms, start de chaque mot
  wdurations: number[]    // ms
}

async function ttsSpeak(request: TTSRequest, endpointUrl: string, apiKey?: string): Promise<TTSResult>
```

**Ce qu'il fait dans l'editor :**
1. Envoie le texte au TTS endpoint
2. Reçoit l'audio + les timestamps
3. Passe le résultat au helper lipsync → génère le track visème CodPlay

**Ce qu'il ne fait pas :** lire l'audio, animer l'avatar. Ce sont des couches en aval.

---

### `@codplay/stream`

**Rôle** : pipeline audio temps-réel pour le mode chat/LLM de l'editor. Reçoit des chunks PCM + données lipsync en streaming, joue l'audio avec latence minimale, anime l'avatar en live.

**Source TH** :
- `streamStart()` / `streamStop()` / `streamAudio()` (lignes 3523–3877)
- `playback-worklet.js` — AudioWorkletNode pour lecture PCM low-latency
- `streamLipsyncQueue` — queue asynchrone traitement lipsync
- `pcmToAudioBuffer()` (ligne 1071)

**API cible :**
```ts
type StreamSession = {
  // Push un chunk audio PCM + données lipsync optionnelles
  push(chunk: { pcm: ArrayBuffer; visemes?: VisemeEvent[]; words?: WordEvent[] }): void
  // Terminer proprement la session
  stop(): void
  // Annuler immédiatement
  abort(): void
}

type StreamCallbacks = {
  onAudioStart?: () => void
  onAudioEnd?: () => void
  onSubtitle?: (word: string, ms: number) => void
  onViseme?: (viseme: string, weight: number) => void  // → engine.setViseme()
}

function createStreamSession(
  audioCtx: AudioContext,
  callbacks: StreamCallbacks,
  opt?: { lipsyncLang?: string; waitForAudioChunks?: boolean }
): StreamSession
```

**Ce qu'il fait dans l'editor :**
1. Reçoit les chunks PCM du LLM/TTS en streaming (SSE ou WebSocket)
2. Joue l'audio via `AudioWorkletNode` (`playback-worklet.js`) sans buffering complet
3. Génère les visèmes en temps réel et appelle `onViseme` → `engine.setViseme()`
4. Émet les sous-titres mot par mot

**Dépendances :**
- `@codplay/avatar-engine` (via callbacks — pas de couplage direct)
- `lipsync-*.mjs` (pour visèmes temps réel depuis mots streamés)
- `playback-worklet.js` (extrait de TH tel quel, crédité)

---

### Relation entre les packages

```
[Editor]
    │
    ├── @codplay/tts          → TTSResult (audio + timestamps)
    │       │
    │       └── helper lipsync → track visème CodPlay (player)
    │
    └── @codplay/stream       → visemes temps réel
            │
            └── @codplay/avatar-engine (via callbacks)

[Player / runtime CodPlay]
    │
    └── @codplay/avatar-engine
            │
            └── tracks visème / expression / gesture (data-driven)
```

Les packages `tts` et `stream` connaissent `avatar-engine` mais pas CodPlay player. L'editor crée la passerelle entre les deux.

---

## Points ouverts

1. ~~Nom exact du modèle féminin~~ → **`brunette.glb`** (confirmé). Config retarget à documenter au premier chargement.
2. **Paramétrage easing visème** : `acc` et `maxv` sont patchés directement sur `mtAvatar` dans la démo actuelle (`VISEME_ACC = 0.004`, `VISEME_MAXV = 1`). À exposer proprement dans l'API engine — résolu.
3. **Formalisation idle strap** : fréquences, intensités, interruption par event visème, intensité selon mood — doc séparée à créer. Valeurs de référence : celles de TH (voir tableau §Idle).
4. **Scope gestures V1** : templates proceduraux TH (ce que fait TH actuellement). Support de clips d'animation corps via `playAnimation()` à ajouter ultérieurement — voir §Enrichissement par clips ci-dessous.

---

## Enrichissement par clips d'animation

Les `gestureTemplates` couvrent les poses statiques (handup, shrug, namaste…). Pour des animations corpo continues (marche, danse, geste étendu), TH charge des clips **FBX** via `FBXLoader` + `THREE.AnimationMixer`.

### Mécanisme TH existant (extractible tel quel)

```
playAnimation(url, onprogress, dur, ndx, scale)
  → FBXLoader.load(url)
  → fbx.animations[ndx]  — clip Animation Three.js
  → THREE.AnimationMixer(armature).clipAction(clip).play()
  → fade-in sur `dur` secondes, fade-out automatique
```

Source TH : `talkinghead.mjs` ligne 4357. Extractible directement dans `gesture-engine.ts`.

### Contrat dans `@codplay/avatar-engine`

```ts
// À l'init — chargement des clips nommés
const engine = await createAvatarEngine({
  …,
  clips: {
    'walk':  '/animations/walking.fbx',
    'dance': '/animations/dance.fbx',
    // GLB avec animations embarquées aussi supporté :
    // 'wave': '/animations/wave.glb'
  }
})

// Pendant le playback — depuis le track gesture
engine.playClip(name: string, options?: {
  dur?: number     // durée du fade-in (s), défaut 1
  loop?: boolean   // loop ou one-shot, défaut false
  scale?: number   // scale des translations (FBX Mixamo → unités scène)
}): void

engine.stopClip(name?: string): void  // stop un clip ou tous
```

### Comment ajouter un clip

1. Exporter le clip depuis Blender ou Mixamo au format **FBX** (Mixamo rig, T-pose, 30fps).
2. Vérifier que les noms de bones correspondent au rig Mixamo standard (same as le modèle).
3. Déclarer le clip dans la config `clips` à l'init de l'engine.
4. Émettre l'event `{ gesture: 'walk' }` sur le track `gesture` dans la scène CodPlay.

**Note GLB** : `GLTFLoader` supporte aussi les animations embarquées (`gltf.animations`). Si le clip est dans un GLB, le même mécanisme s'applique via `THREE.AnimationMixer.clipAction(gltf.animations[0])`. L'engine auto-détecte l'extension (`.fbx` vs `.glb`).

### Seekabilité des clips

Les clips `AnimationMixer` ne sont pas nativement seekables par la timeline CodPlay : `mixer.time` est absolu et découplé de `timelineMs`. Pour le seek, on peut soit :
- **Accepter la limite** : au seek, le clip repart de t=0 (comportement V1).
- **Seek partiel** : stocker `clipStartTimelineMs` et calculer `mixer.setTime(timelineMs - clipStartTimelineMs)` dans `resetForSeek()` — faisable en V2.

En V1 : comportement V1 accepté (clip repart au seek). Le track gesture note le `ms` de déclenchement, ce qui permet d'implémenter le seek partiel ultérieurement.

---

## Références

- TalkingHead source : `/Users/hervesaintmacary/Projets/Talking-head/modules/`
- MorphTargetController TH : `talkinghead.mjs` lignes 694–748 (init), 1652–1812 (update), 2201–2216 (`setFixedValue`)
- `animMoods` TH : `talkinghead.mjs` lignes 418–621
- `gestureTemplates` TH : `talkinghead.mjs` ligne 281
- `retargeter.mjs` : `retarget()` ligne 253
- Config modèle masculin : `avatar-poc-1-demo.ts` + plan [2026-06-11-avatar3d-component-plan.md](2026-06-11-avatar3d-component-plan.md)
