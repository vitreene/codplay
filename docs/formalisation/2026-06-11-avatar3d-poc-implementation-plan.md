# Plan d'implémentation — Avatar 3D POC

Date : 2026-06-11  
Mis à jour : 2026-06-12  
Statut : plan actif

---

## Vue d'ensemble

```
Phase Prep — Transformation données     adapter les fichiers phonèmes/words pour Codplay
Phase 0    — Demo standalone            valider le visuel (TalkingHead seul, hors Codplay)
Phase 1    — Intégration Codplay        composant avatar3d, audio media, visèmes en eventimes
Phase 2    — Composant allégé           extraire les helpers TH, supprimer la dépendance
```

Phase 0 est terminée — validation visuelle OK.  
Phase 1 est le prochain objectif : Codplay pilote entièrement l'avatar (audio + visèmes).  
Phase 2 est conditionnelle au succès de la Phase 1 et à la décision sur les helpers visèmes.

---

## Assets de référence

| Asset | Chemin | Usage |
|---|---|---|
| Avatar masculin | `TalkingHead/avatars/avatarsdk.glb` | rendu 3D |
| Audio FR | `phonemes/1_7b_e.mp3` | playback |
| Words FR | `phrase-fr.ts` | timestamps mots |
| Phonèmes FR | `phrase-fr.ts` (MOUTH_CUES) | cues Preston Blair |

---

## Phase Prep — Transformation des données ✓

Les données sont dans `packages/demos/src/scenes/avatar-data/phrase-fr.ts` :
- `phraseWordsFR` — mots avec timestamps ms
- `MOUTH_CUES` — cues Preston Blair (start/end en secondes)
- `PRESTON_TO_TH` — mapping Preston Blair → codes Oculus TalkingHead
- `activeCues` — cues filtrés (B et X = silence, exclus)

**Complément nécessaire pour Phase 1** : les `MOUTH_CUES` doivent être exportés
depuis `phrase-fr.ts` (actuellement non exportés) et convertis en eventimes Codplay.

---

## Phase 0 — Demo standalone ✓

Demo `avatar-poc-demo.ts` dans `packages/demos/src/codplay/`.  
TalkingHead standalone, hors Codplay. Validation visuelle réussie.  
Cette demo reste en place pour référence ; elle n'évolue plus.

---

## Phase 1 — Intégration Codplay

**Principe** : Codplay est souverain sur le temps, l'audio et les visèmes.
TalkingHead ne fait que le rendu Three.js.

```
Codplay player
  ├── perso audio (type: 'media')        ← gère 1_7b_e.mp3
  └── perso avatar (type: 'avatar3d')    ← Avatar3DComponent (registerComponent)
        └── TalkingHead en mode avatarOnly (Three.js + morph targets)
```

### Composant vs module

Le perso `avatar3d` utilise `registerComponent({ type: 'avatar3d', component: Avatar3DComponent })`.

- `RuntimeComponentClass` est le bon mécanisme : le composant possède le canvas,
  répond aux `update()`, retourne le canvas via `render()`.
- `RuntimeModule` (move/list/replace) est pour des comportements transversaux —
  inutile ici.

La tick Three.js (`head.animate(delta)`) ne passe pas par le composant.
Elle se câble dans la closure `renderFrame` de la démo, via une référence
exposée par `Avatar3DComponent` (`component.getHead()`).
En post-POC : `host.subscribeToRenderFrame()` sur `RuntimeModuleHost` —
ce point est documenté comme évolution architecture.

### Seek et morph targets

Les events `avatar:viseme` sont enregistrés dans la piste Codplay.  
Le morph target est une **conséquence de l'event**, pas une valeur stockée.  
Au seek, Codplay rejoue les events → `component.update()` est rappelé
→ `setFixedValue()` recalcule le morph target correct.  
Aucun stockage spécial des morph targets nécessaire.

### Emplacement du composant

Le composant `Avatar3DComponent` et ses helpers vont dans `packages/authoring/`.  
La démo reste dans `packages/demos/`.

### Scène Codplay

```ts
// packages/demos/src/scenes/avatar-poc-scene.ts
const scene: SceneDoc = {
  rootStories: ['avatar'],
  stories: {
    avatar: {
      persos: {
        audio: {
          type: 'media',
          initial: { src: '/assets/1_7b_e.mp3' },
          actions: {
            'avatar:play':  { media: { command: 'play'  } },
            'avatar:pause': { media: { command: 'pause' } },
            'avatar:stop':  { media: { command: 'stop'  } },
          }
        },
        avatar: {
          type: 'avatar3d',
          initial: {
            avatarUrl: '/avatars/avatarsdk.glb',
            body: 'M',
            cameraView: 'upper',
            retarget: {
              Neck: { z: -0.01, rx: -0.15 }, Neck1: { z: -0.01, rx: -0.15 },
              Neck2: { z: -0.01, rx: -0.15 },
              LeftShoulder: { rz: -0.3 }, RightShoulder: { rz: 0.3 },
              scaleToEyesLevel: 1.0, origin: { y: -0.1 },
            },
          },
          actions: {
            'avatar:viseme': { broadcast: { type: 'VISEME' } },
            'avatar:mood':   { broadcast: { type: 'MOOD'   } },
          }
        },
        caption: {
          type: 'text',
          initial: { content: '' },
          actions: {
            'subtitle:word': { content: '{{payload.word}}' },
          }
        }
      },
      eventimes: [
        { at: 0, event: 'avatar:play' },
        // visèmes générés depuis MOUTH_CUES (voir "Génération des eventimes")
        // mots générés depuis phraseWordsFR
      ]
    }
  }
}
```

### Génération des eventimes visèmes

Les `MOUTH_CUES` contiennent des intervalles (start/end en secondes).  
Le visème actif à un instant donné est celui dont l'intervalle contient cet instant.  
L'event `avatar:viseme` est émis au `start` de chaque cue actif (non-null).

```ts
// Depuis MOUTH_CUES, filtrer les silences et produire des eventimes
import { MOUTH_CUES, PRESTON_TO_TH } from './avatar-data/phrase-fr'

const visemeEventimes = MOUTH_CUES
  .filter(c => PRESTON_TO_TH[c.value] !== null)
  .map(c => ({
    at: Math.round(c.start * 1000),
    event: 'avatar:viseme',
    payload: {
      viseme:     PRESTON_TO_TH[c.value],
      durationMs: Math.round((c.end - c.start) * 1000),
    }
  }))

const wordEventimes = phraseWordsFR.map(w => ({
  at: w.startMs,
  event: 'subtitle:word',
  payload: { word: w.word, durationMs: w.durationMs }
}))
```

### Avatar3DComponent (interface minimale)

```ts
// packages/authoring/<avatar3d>/avatar3d-component.ts
export class Avatar3DComponent implements RuntimeComponent {
  node: HTMLCanvasElement
  readonly modules: ComponentModules

  constructor(input: RuntimeComponentClassInput) { /* ... */ }

  _init(): void {
    // Créer TalkingHead en mode avatarOnly
    // Appeler showAvatar(config de perso.initial)
  }

  render(): HTMLCanvasElement {
    return this.node  // canvas Three.js
  }

  update(input: RuntimeComponentUpdateInput): void {
    const cmd = input.action['broadcast'] as { type: string; viseme?: string; mood?: string }
    if (cmd?.type === 'VISEME' && cmd.viseme) {
      this.applyViseme(cmd.viseme)
    }
    if (cmd?.type === 'MOOD' && cmd.mood) {
      this.head?.setMood(cmd.mood)
    }
  }

  getHead(): TalkingHead | null { return this.head }

  private applyViseme(visemeName: string): void {
    // reset tous les visèmes, appliquer le nouveau
    for (const v of ALL_VISEMES) {
      this.head?.setFixedValue('viseme_' + v, v === visemeName ? VISEME_WEIGHT : 0)
    }
  }
}
```

### Tick Three.js (closure renderFrame dans la démo)

```ts
// Dans avatar-poc-1-demo.ts, avant player.init :
let prevFrameMs: number | null = null

const animationAdapter = createAnimationAdapter(createAnimeImplementation(), {
  renderFrame: (nowMs: number) => {
    engine.update()  // anime.js
    const head = avatarComponent?.getHead()
    if (head) {
      const delta = prevFrameMs !== null ? nowMs - prevFrameMs : 0
      head.animate(delta)
    }
    prevFrameMs = nowMs
  }
})
```

### Comportement PAUSE / STOP

- **PAUSE** : cesser d'appeler `head.animate(delta)` — Three.js gèle, état conservé.
  Ne pas émettre d'event `avatar:viseme` supplémentaire.
- **STOP** : `head.stopSpeaking()` + reset idle. Le canvas reste actif.
- La telco Codplay (play/pause/stop) contrôle naturellement ces états.

### Critère de succès Phase 1

- [ ] `registerComponent` accepte `avatar3d` sans modifier le core Codplay
- [ ] Canvas Three.js monté par Codplay comme tout autre perso
- [ ] Audio joue via le perso `media` Codplay
- [ ] Visèmes synchronisés : eventimes → component.update() → setFixedValue()
- [ ] Mots affichés en caption (sous-titres) depuis les eventimes
- [ ] PAUSE Codplay gèle l'avatar (tick arrêté) sans perte d'état
- [ ] Seek rejoue les events visèmes → morphs reconstruits correctement
- [ ] TalkingHead n'a pas de `requestAnimationFrame` propre (mode avatarOnly)

---

## Phase 2 — Composant allégé (si succès Phase 1)

**Objectif** : supprimer la dépendance TalkingHead.
Extraire dans `packages/authoring/<avatar3d>/` uniquement ce dont Codplay a besoin.

### Décision helpers visèmes

Deux options :
- **Option A — Rhubarb** : conserver les cues pré-calculés (Preston Blair → Oculus).
  Simple, précis, mais nécessite un fichier de cues par audio.
- **Option B — helpers TH** : extraire les classes `lipsync-fr.mjs` / `lipsync-en.mjs`
  de TalkingHead (licence MIT) pour calculer les visèmes à partir des mots.
  Plus flexible (pas de fichier cues), mais moins précis que Rhubarb.

À trancher après validation Phase 1 (comparaison visuelle).

### Ce qu'on extrait de TalkingHead

| Module | Source TH | Rôle |
|---|---|---|
| `avatar-loader.ts` | `showAvatar()` | chargement GLB, retarget, découverte morph targets |
| `morph-target-controller.ts` | `updateMorphTargets()` | priorité, smoothing |
| `animation-controller.ts` | AnimationMixer wrapper | tick externe |
| `lipsync-processor.ts` (opt. B) | `lipsync-fr/en.mjs` | calcul visèmes depuis mots |

### Ce qu'on jette

- Boucle `animate()` interne (remplacée par ticker Codplay)
- Pipeline TTS / Google / Azure / microphone
- `speakAudio()` / `speakText()`
- `audioCtx` / Web Audio (géré par perso `media` Codplay)
- Queue `animQueue` (remplacée par les pistes Codplay)

### Critère de succès Phase 2

- [ ] Zéro import TalkingHead dans le composant final
- [ ] Seek complet : morph targets et expressions reconstruits
- [ ] Tests unitaires sur le controller morph targets et la normalisation timestamps

---

## Décisions architecturales

| Question | Décision |
|---|---|
| **Composant vs module** | `registerComponent()` uniquement. Pas de `RuntimeModule` pour avatar3d. |
| **Tick Three.js** | Closure `renderFrame` dans la démo (phase 1). `host.subscribeToRenderFrame()` en post-POC. |
| **Seek morph targets** | Events enregistrés, morph targets recalculés au rejeu. Pas de stockage dédié. |
| **PAUSE** | Arrêt du tick `animate()`. État Three.js conservé. Reprise transparente. |
| **Emplacement composant** | `packages/authoring/` (pas dans le core Codplay). |
| **Canvas** | `Avatar3DComponent.render()` retourne le canvas — Codplay le monte comme tout nœud. |
| **Helpers visèmes** | Option A (Rhubarb) vs Option B (helpers TH) — décision après Phase 1. |

## Question ouverte post-Phase 1

| Question | Impact |
|---|---|
| Seek des gestes/animations idle (AnimationMixer) : reset à idle ou lecture partielle ? | Fidélité seek Phase 2 |
| `host.subscribeToRenderFrame()` dans `RuntimeModuleHost` : design à valider avec l'archi Codplay | Phase 2+ |
