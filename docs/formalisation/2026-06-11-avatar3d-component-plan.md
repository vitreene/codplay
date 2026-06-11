# Plan — Composant Avatar 3D pour Codplay

Date : 2026-06-11  
Statut : POC en cours de définition — TalkingHead tel quel avant extraction  
Branche cible : à créer

---

## Contexte et objectif

Composant non-core `Avatar3D` qui pilote un avatar humanoïde 3D depuis les pistes
et le système réactif de Codplay. Chargé dans une démo, pas dans le runtime core.

Contraintes :
- Codplay souverain sur le temps (tick, pause, seek) — pas de loop concurrent.
- Aucune dépendance React/Zustand.
- Format avatar : GLB + animations Mixamo FBX.
- Source technique : TalkingHead (met4citizen) — MIT ✓

---

## Observations directes du code source

### `modules/lipsync-en.mjs`
- **Aucun import** — classe `LipsyncEn` totalement autosuffisante.
- `preProcessText(s)` — normalise le texte (nombres, symboles, caractères).
- `wordsToVisemes(w)` → `{ words, visemes[], times[], durations[], i }`.
- Les `times` et `durations` sont en **unités relatives** (pas en ms).  
  `visemeDurations` : `{ aa: 0.95, E: 0.90, PP: 1.08, SS: 1.23, … }`.  
  Pour convertir en timestamps absolus : normaliser par la somme des durées × durée réelle du mot.
- 15 visèmes Oculus : `PP FF TH DD TT kk CH SS nn RR aa E I O U`.
- `lipsync-fr.mjs` présent également.

### `modules/retargeter.mjs`
- Import `THREE` uniquement. Exporte une seule fonction `retarget(root, transforms)`.
- Stateless — opère sur l'objet Three.js passé en paramètre.
- Gère : normalisation squelette Mixamo, rebind de skin, scale vers hauteur cible, origin shift.
- **Extractible tel quel.**

### `modules/dynamicbones.mjs`
- Import `THREE` uniquement. Physique cheveux/vêtements. Optionnel pour le prototype.

### `talkinghead.mjs` — mode `isAvatarOnly`

**Découverte clé** : paramètre de construction `{ avatarOnly: true, avatarOnlyScene, avatarOnlyCamera }`.

En mode `avatarOnly` :
- Pas de `requestAnimationFrame` interne (la boucle rAF n'est pas lancée).
- `animate(dt)` reçoit directement un **delta en ms** — appelable depuis un tick externe.
- `render()` skippé — la scène Three.js est fournie et rendue de l'extérieur.
- `opt.update(dt)` callback optionnel appelé à chaque frame (ligne 2740).
- TalkingHead gère encore : morph targets, animation queue, smoothing, gestes.

**Conséquence** : pas besoin de démonter TalkingHead pour un premier prototype.
Codplay appelle `talkinghead.animate(dt)` à chaque frame — TalkingHead fait le reste.

### MorphTargetController (dans talkinghead.mjs)
- Système de priorité : `fixed > realtime > system > newvalue > base > baseline`.
- Smoothing exponentiel avec vitesse/accélération configurables par morph target.
- API externe : `setFixedValue(mt, val)` — directement exploitable depuis les straps.
- Interdépendances gérées : `eyeBlinkLeft/Right` dépendent de `eyesLookDown` + `browDown`.
- `mtRandomized` : liste de morph targets randomisés à chaque frame (micro-expressions naturelles).
- Les cas `headRotateX/Y/Z` et `bodyRotateX/Y/Z` écrivent dans `poseDelta.props` (bone rotations)
  en plus des blend shapes — comportement à conserver tel quel.

---

## Architecture — deux approches

### Approche A : Wrapper avec `isAvatarOnly` (retenue pour le prototype)

TalkingHead utilisé comme moteur interne, Codplay fournit le tick et pilote les valeurs.

```
Codplay runtime tick
  → avatar3d.update(dt, timelineMs)
      → talkinghead.animate(dt)           ← seul appel TalkingHead
      → Three.js renderer.render(...)     ← Codplay rend la scène

Piste visème   → strap → talkinghead.setFixedValue('viseme_aa', weight)
Piste expression → strap → talkinghead.setFixedValue('mouthSmile', weight)
Piste gesture  → strap → talkinghead.playGesture(name) ou playAnimation(url)
Piste word     → event Codplay (sous-titres, déclencheurs)

Authoring : LipsyncEn.wordsToVisemes(word) → normalisation → keyframes de piste visème
```

**Avantages :**
- Prototype fonctionnel en 1-2 semaines.
- Réutilise le smoothing, les micro-expressions, les gestes de TalkingHead sans réécriture.
- TalkingHead maintenu = corrections de bugs gratuites.

**Limites :**
- Seek partiel : morph targets reconstruits via `setFixedValue`, gestes (AnimationMixer) non seekables.
- `animClock` de TalkingHead est relatif — incompatible avec un seek absolu de la timeline.
- Animations gestuelles non rejouables frame-par-frame depuis le track.

### Approche B : Extraction complète (si seek total requis)

Démonter TalkingHead en sous-systèmes indépendants avec `animClock` remplacé par `timelineMs`.
Seek total possible. Coût : 3-4 semaines supplémentaires. À envisager en phase 2 si besoin.

---

## Pistes Codplay

### Piste `viseme`

Entry : `{ viseme: string, weight: number }`

15 visèmes Oculus : `PP FF TH DD TT kk CH SS nn RR aa E I O U`  
Runtime : `talkinghead.setFixedValue('viseme_' + viseme, weight)`

Génération authoring :
```ts
// 1. Pour chaque mot, LipsyncEn.wordsToVisemes(word) → { visemes[], times[], durations[] }
// 2. Normaliser les times/durations (unités relatives) vers la durée réelle du mot :
//    scaleFactor = wordDurationMs / sum(durations)
//    keyframeMs = wordStartMs + times[i] * scaleFactor
// 3. Émettre les entries de piste
```

### Piste `expression`

Entry : `{ expression: string, weight: number }`

Noms : morph targets ARKit (ex. `mouthSmile`, `eyesClosed`, `browInnerUp`…)  
+ aliases TalkingHead : `neutral`, `happy`, `angry`, `sad`, `fear`, `disgust`, `love`, `sleep`  
Runtime : `talkinghead.setFixedValue(expression, weight)`

### Piste `gesture`

Entry : `{ name: string }` (nom d'un clip pré-chargé) ou `{ url: string, duration?: number }`  
Runtime : `talkinghead.playGesture(name)` ou `talkinghead.playAnimation(url, …)`  
Note : les clips sont bufferisés par TalkingHead après le premier chargement.

### Piste `word`

Entry : `{ word: string, start: number, end: number }`  
Sert à piloter des sous-titres ou déclencher des events Codplay au mot.  
Ne touche pas l'avatar directement.

---

## API d'init du composant

```ts
type Avatar3DConfig = {
  avatarUrl: string             // URL du GLB
  mountTarget: HTMLElement      // Conteneur DOM — TalkingHead crée le canvas
  scene?: THREE.Scene           // Si avatarOnly: true, scène Three.js externe
  camera?: THREE.Camera         // Si avatarOnly: true, caméra externe
  animations?: Record<string, string>  // Clips nommés pré-chargés { idle: url, ... }
  talkingHeadOptions?: object   // Options passées directement à TalkingHead
}
```

Si `scene` + `camera` sont fournis → mode `avatarOnly: true` (tick externe).  
Sinon → TalkingHead crée son propre canvas + renderer (mode autonome, sans seek).

---

## Authoring helpers

```ts
// Génère les keyframes de piste visème + word depuis les word-timestamps
AvatarAuthoring.wordsToVisemeTracks(
  wordTimestamps: { word: string, start: number, end: number }[],
  lang?: 'en' | 'fr'
): {
  visemeEntries: TrackEntry[],   // → piste 'viseme'
  wordEntries: TrackEntry[]      // → piste 'word'
}
```

Cette fonction est appelée à la composition de la scène, pas au playback.

---

## Structure de fichiers

```
packages/
  avatar3d/                          ← nouveau package non-core
    src/
      avatar3d-component.ts          ← composant Codplay, orchestre le tout
      avatar-authoring.ts            ← wordsToVisemeTracks + helpers authoring
    lipsync/
      lipsync-en.mjs                 ← copié depuis TalkingHead (MIT, crédit conservé)
      lipsync-fr.mjs
    package.json
    tsconfig.json
  demos/
    src/scenes/
      avatar-demo.ts                 ← scène de démo
    src/codplay/
      avatar-demo.html
```

Note : `retargeter.mjs` et `dynamicbones.mjs` restent dans TalkingHead (peer dep ou lien direct).

---

## Stratégie POC — TalkingHead tel quel

Avant tout composant Codplay, valider le résultat visuel et la faisabilité de l'intégration
en utilisant TalkingHead dans son mode natif (boucle propre, canvas propre).
Si le POC est concluant → extraire les éléments dans un composant Codplay.

### `speakAudio` — deux interfaces disponibles

**Interface 1 — word timestamps** (fichier `mp3.html`) :
```js
head.speakAudio({
  audio: AudioBuffer,
  words:      ['Hello',  'my',   'name',  'is',   'Codplay'],
  wtimes:     [0,        350,    500,     700,    850],   // ms (start de chaque mot)
  wdurations: [300,      120,    170,     120,    400],   // ms (durée de chaque mot)
})
```
TalkingHead génère les visèmes lui-même depuis le texte + timing. L'audio et les visèmes sont séparés.

**Interface 2 — blendshapes frame-par-frame** (fichier `azure-blendshapes.html`) :
```js
head.speakAudio({
  audio: [rawPCM],
  anim: {
    name: "blendshapes",
    dt: [16, 16, 16, ...],          // durée de chaque frame en ms
    vs: {
      jawOpen:      [0, 0.2, 0.5, 0.3, ...],
      mouthSmile:   [0, 0,   0,   0.1, ...],
      // 52 ARKit blend shapes par frame
    }
  }
})
```
C'est la forme la plus proche du modèle Codplay — les `vs` sont exactement des pistes
de blend shapes indexées par frame. À retenir pour la phase d'extraction.

### Assets confirmés — aucune API requise

**Avatar masculin** : `TalkingHead/avatars/avatarsdk.glb`
- Seul modèle `body: 'M'` de la collection TalkingHead
- 15 visèmes Oculus (`viseme_PP` … `viseme_sil`) + ARKit complet (66 morph targets)
- Skeleton Mixamo ✓ — compatible retarget + animations corporelles
- Config retarget documentée dans `siteconfig.js` :
  ```js
  { Neck: { z:-0.01, rx:-0.15 }, LeftShoulder: { rz:-0.3 }, RightShoulder: { rz:0.3 },
    scaleToEyesLevel: 1.0, origin: { y:-0.1 } }
  ```

**Audio français** : `/phonemes/1_7b_e.mp3` (original sans suffixe = version FR, 96kbps)

**Word timestamps français** : `/phonemes/1_7b_e_01/1_7b_e.mp3-words.ts`
- Format timecode `HH:MM:SS.mmm`, commence par "Vous l'avez donc…"
- Conversion → ms : `timecodeToDuration()` déjà dans le fichier

**Phonèmes français** : `/phonemes/1_7b_e_01/1_7b_e_fr-phonemes.ts`
- Cues Preston Blair (A-H, X) avec timestamps réels (Rhubarb Lip Sync)
- Déjà convertis en events Codplay `{ startAt, name, channel, data: { duration } }`

**Module lipsync FR** : `TalkingHead/modules/lipsync-fr.mjs` ✓

**Animations** : `TalkingHead/animations/walking.fbx`, `poses/dance.fbx`

### Scène POC Codplay

TalkingHead tourne dans son propre canvas avec sa propre boucle.
Codplay orchestre la timeline via events → straps → appels TalkingHead.

```
Scène Codplay (POC) — version FR, modèle masculin
├── story 'avatar'
│   └── eventimes
│       ├── t=0      : event 'avatar:speak'   → strap → head.speakAudio(phraseDataFR)
│       ├── t=17800  : event 'avatar:mood'    → strap → head.setMood('happy')
│
└── story 'subtitles'
    └── eventimes — depuis 1_7b_e.mp3-words.ts (timestamps convertis en ms)
        ├── t=180    : { word: 'Vous', duration: 150 }
        ├── t=330    : { word: "l'avez", duration: 240 }
        └── …
```

`phraseDataFR` est construit depuis `1_7b_e.mp3-words.ts` :
```js
const phraseDataFR = {
  audio: audioBuffer,          // fetch('1_7b_e.mp3') → decodeAudioData
  words:      wordsCues.map(w => w.Word),
  wtimes:     wordsCues.map(w => timecodeToDuration(w['Start Timecode'])),
  wdurations: wordsCues.map(w => timecodeToDuration(w['End Timecode'])
                                 - timecodeToDuration(w['Start Timecode']))
}
```

`showAvatar` est appelé avec la config `avatarsdk` :
```js
await head.showAvatar({
  url: './avatars/avatarsdk.glb',
  body: 'M',
  avatarMood: 'neutral',
  lipsyncLang: 'fr',
  retarget: { Neck: { z:-0.01, rx:-0.15 }, LeftShoulder:{rz:-0.3}, RightShoulder:{rz:0.3},
              scaleToEyesLevel: 1.0, origin: { y:-0.1 } }
})
```

Le `head` TalkingHead est passé dans le `context` des straps via la `strapCollection`.

### Ce que valide ce POC

- ✓ Avatar GLB réaliste charge et s'affiche dans un canvas TalkingHead
- ✓ Lip-sync fonctionne avec des word-timestamps externes (pas de TTS API)
- ✓ Codplay peut orchestrer l'avatar depuis sa timeline d'events
- ✓ Expressions et gestes pilotables via events Codplay
- ✗ (pas encore) seek Codplay contrôle l'état de l'avatar
- ✗ (pas encore) tick Codplay remplace la boucle TalkingHead

---

## Phases d'implémentation

### Phase 1 — Prototype minimal (5-7 j)
- [ ] Créer `packages/avatar3d/` (package.json, tsconfig, dépendances Three.js + TalkingHead)
- [ ] `avatar3d-component.ts` : init avec `avatarOnly: true`, tick `animate(dt)` depuis Codplay
- [ ] Piste `gesture` : entry → `talkinghead.playGesture(name)` ou `playAnimation(url)`
- [ ] Piste `expression` : entry → `talkinghead.setFixedValue(expression, weight)`
- [ ] Démo : avatar GLB (opensourceavatars.com CC0), idle loop, expressions pilotées par events

### Phase 2 — Piste visème + authoring (4-5 j)
- [ ] Copier `lipsync-en.mjs` + `lipsync-fr.mjs` dans `packages/avatar3d/lipsync/`
- [ ] `avatar-authoring.ts` : `wordsToVisemeTracks(wordTimestamps, lang)`
  - normalisation temps relatifs → timestamps absolus
- [ ] Piste `viseme` : entry → `talkinghead.setFixedValue('viseme_' + name, weight)`
- [ ] Piste `word` → event Codplay (sous-titres)
- [ ] Démo complète : texte + word-timestamps → pistes synchronisées

### Phase 3 — Seek partiel + polish (3-4 j)
- [ ] Seek morph targets : on résout l'état visème/expression à `timelineMs` en rejouant les entries
  (dernière valeur active avant la position seek → `setFixedValue`)
- [ ] Seek gesture : reset à idle, aucun replay (limite acceptée en approche A)
- [ ] Tests
- [ ] Évaluation : seek complet nécessaire ? → décider approche B

---

## Points ouverts

1. **Seek gestures** : avec l'approche A, les gestes ne sont pas seekables. Acceptable pour V1 ?

2. **Normalisation des temps visème** : la formule `scaleFactor = wordDurationMs / sum(durations)`
   suppose une durée de mot fixe. Si un mot s'étire (speech lent), les visèmes s'étirent aussi.
   Est-ce le bon comportement ?

3. **Modèle de démo** : `brunette.glb` ou `brunette-t.glb` sont déjà dans TalkingHead/avatars/ —
   utilisables directement pour le prototype (vérifier licence).

4. **Canvas ownership** : en mode `avatarOnly`, Codplay fournit la scène Three.js.
   La démo devra créer son propre renderer + scene + camera et les passer au composant.
   Ou TalkingHead crée le canvas et Codplay n'appelle que `animate(dt)` — à trancher.

5. **lipsync-fr.mjs** : présent dans TalkingHead, à copier avec le même traitement que `lipsync-en`.

---

## Références

- TalkingHead source : `/Users/hervesaintmacary/Projets/Talking-head/` (MIT)
- Mode avatarOnly : `talkinghead.mjs` lignes 187–189, 833–838, 2409–2418
- MorphTargetController : lignes 694–748 (init), 1652–1812 (update), 2201–2216 (setFixedValue)
- LipsyncEn : `modules/lipsync-en.mjs` — `wordsToVisemes()` ligne 491
- Retargeter : `modules/retargeter.mjs` — `retarget()` ligne 253
- Modèles test : `TalkingHead/avatars/` (brunette.glb, brunette-t.glb, mpfb.glb…)
- Modèles CC0 : opensourceavatars.com
