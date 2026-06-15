# Plan — Composant `avatar3d` CodPlay V1

Date : 2026-06-14  
Statut : **à valider avant implémentation**  
Branche : `grid-editor`

---

## Définitions clés

### Gaze (regard-caméra)

Dans TH, `eyeContact` est un flag qui active, à chaque frame, un calcul géométrique :
les os `LeftEye` / `RightEye` sont projetés sur la caméra, l'angle résultant (pitch/yaw)
est converti en valeurs pour les morphs `eyeLookUpLeft/Right`, `eyeLookDownLeft/Right`,
`eyeLookInLeft/Right`, `eyeLookOutLeft/Right`.

Ce n'est pas un morph — c'est une computation par frame, totalement absente de notre
adaptation actuelle. Dans ce plan, elle devient un **`GazeService`** interne au composant :
- activé / désactivé par l'event CodPlay `avatar:gaze { enabled: bool }`
- calculé à chaque `tick()` dans le render adapter
- appliqué via `morphEngine.snapFixed` (instant, car recalculé chaque frame)
- rejoué correctement au seek : l'event `avatar:gaze` est matérialisé en track →
  le render adapter's `seek()` appelle `gaze.computeAndApply()` après `engine.commitSeek()`

---

## État de départ

### Sur disque (non trackés — survivent au stash)

| Fichier | État |
|---|---|
| `packages/authoring/avatar-engine/` | Complet : MorphEngine, ExpressionEngine, GestureEngine, AvatarEngine, ModelLoader ✓ |
| `packages/demos/src/codplay/avatar-idle-strap.ts` | Complet : blink (snapFixed), breathing, head micro-movement ✓ |

### Dans stash@{0} (ne pas pop sans analyse)

Contient des modifications à `packages/codplay/src/player/` (render-sync, create-player,
render-adapter-types). Ces modifications touchent le cœur CodPlay — elles ne seront pas
récupérées via `pop`. La scène et le démo seront reconstruits proprement.

### Règle absolue

Aucune modification du cœur CodPlay (`packages/codplay/src/`) sans arrêt et discussion préalable.

---

## Phase 2 — accord

TH est **absent du runtime**. Zéro import TH dans les démos. TH est une source d'emprunt de
code uniquement (algorithmes, templates, constantes), avec crédit dans les en-têtes de chaque
fichier extrait. Le package `@codplay/avatar-engine` est le résultat de cette extraction.

Le chargement GLB passe par `model-loader.ts` (GLTFLoader Three.js) + `retargeter.ts`
(converti TypeScript depuis TH). TH n'est pas une dépendance du démo.

---

## Inventaire TH — éléments nécessitant une adaptation

Seule la **gaze** nécessite un service per-frame géométrique. Les autres éléments sont
déjà dans le pattern events-CodPlay :

| Élément TH | Adaptation |
|---|---|
| `eyeContact` / `lookAtCamera()` — calcul géométrique per-frame | **GazeService** (à construire) |
| Idle blink, breathing, head micro-movement | Remplacés par `avatar-idle-strap.ts` ✓ |
| Gesture easing | `GestureEngine.update(dt)` dans tick() ✓ |
| Morph easing | `MorphEngine.update(dt)` dans tick() ✓ |
| Lipsync visèmes | Remplacé par eventimes CodPlay ✓ |
| Virtual morphs `eyesRotateX/Y` | Couvert par GazeService (mêmes cibles eyeLook*) |

---

## Choix architecturaux

### 1. TH absent — avatar-engine est le remplacement

Aucun import TH dans les démos. Le démo crée la scène Three.js directement, appelle
`engine.loadModel(url, { retarget: {...} })` qui utilise notre `model-loader.ts`.

Suppression de `patchVisemeEasing` — nos visèmes passent par `morphEngine.snapFixed`.

### 2. GazeService dans `avatar-engine`

Calcul géométrique pur — sans couplage CodPlay. Le service lit `LeftEye`/`RightEye` en
world-space, calcule pitch/yaw par rapport à la caméra, et écrit via `snapFixed` sur les
8 morphs `eyeLook*`.

### 3. Composant + render adapter dans `@codplay/avatar3d` (nouveau package)

Même pattern que `@codplay/avatar-rive` : une couche fine au-dessus de `avatar-engine`,
qui traduit les events CodPlay en appels moteur. Connaît CodPlay ; `avatar-engine` ne le
connaît pas.

### 4. Les animations idle viennent des straps CodPlay

`avatar-idle-strap.ts` pilote blink, respiration et micro-mouvement via events `avatar:morph`.
Le composant ne sait rien des idle : il reçoit des events comme n'importe quel autre event.

### 5. Pilotage perso = même modèle que `media`

Le perso `avatar3d` accepte un event `broadcast { type: 'START' | 'STOP' }` exactement
comme le perso `media`. Les autres commandes (visème, morph, geste, gaze, mood) sont
des objets dans les actions, chacun avec sa clé d'event.

---

## Interface du composant — contrat events

### Actions du perso avatar3d

| Event | Payload | Effet dans le composant |
|---|---|---|
| broadcast `START` | `{ broadcast: { type: 'START' } }` | no-op (idle est dans le strap) |
| broadcast `STOP` | `{ broadcast: { type: 'STOP' } }` | `engine.prepareSeek()` — reset propre |
| `avatar:viseme` | `{ viseme: string \| null }` | `morphEngine.snapFixed('viseme_'+name, weight)` |
| `avatar:morph` | `{ name: string, value: number, snap?: boolean }` | `snapFixed` (si `snap`) ou `setFixed` |
| `avatar:gesture` | `{ name: string \| null }` | `engine.playGesture` / `releaseGesture` |
| `avatar:gaze` | `{ enabled: boolean }` | `gazeService.setEnabled(bool)` |
| `avatar:mood` | `{ mood: MoodName }` | `engine.setMood(mood)` |

### Render adapter

```
tick(dt)     → engine.animate(dt); gaze.computeAndApply(); renderer.render(scene, camera)
seekStart()  → engine.prepareSeek()
seek()       → engine.commitSeek(); gaze.computeAndApply(); renderer.render(scene, camera)
pause()      → no-op (CodPlay arrête tick())
resume()     → no-op (CodPlay reprend tick())
stop()       → engine.prepareSeek(); renderer.render(scene, camera)
```

### Point clé : visème = snapFixed

Les mouth cues CodPlay arrivent à l'échantillon exact — pas besoin d'easing entrant.
`snapFixed` réplique le canal `newvalue` TH (bypass easing). L'ouverture de bouche
entre phonèmes est gérée par la transition naturelle vers `baseline = 0`.

---

## Étapes d'implémentation

### Étape 0 — Gate tests verts (base saine)

```bash
npm run test:gates   # doit passer : lot7, lot8, lot18
```

### Étape 1 — GazeService

Fichier : `packages/authoring/avatar-engine/src/gaze-service.ts`

```ts
class GazeService {
  constructor(morphEngine: MorphEngine, leftEye: Object3D, rightEye: Object3D, camera: Camera)
  setEnabled(enabled: boolean): void
  computeAndApply(): void  // appelé par tick() et seek()
}
```

`computeAndApply()` :
1. `leftEye.getWorldPosition(pL)`, `rightEye.getWorldPosition(pR)` — positions world-space
2. `pEyes = pL.clone().add(pR).multiplyScalar(0.5)` — centre yeux
3. `dir = camera.position.clone().sub(pEyes).normalize()`
4. `pitch = Math.asin(-dir.y)` — angle vertical
5. Valeurs morphs eyeLook : si pitch > 0 → `eyeLookUp* = pitch / REF_ANGLE` ; si pitch < 0 → `eyeLookDown*`
6. `morphEngine.snapFixed('eyeLookUpLeft', ...)` × 4 (Up/Down/In/Out gauche + droite)

Validation : gate tests toujours verts.

### Étape 2 — Package `@codplay/avatar3d`

Structure :
```
packages/authoring/avatar3d/
  src/
    avatar3d-component.ts
    avatar3d-render-adapter.ts
    index.ts
  package.json
  tsconfig.json
```

`avatar3d-component.ts` — reçoit `{ engine, gazeService, canvas }` dans son constructeur de deps.
`update(input)` dispatch selon la clé présente dans `action`.

`avatar3d-render-adapter.ts` — implémente le contrat ci-dessus (tick/seek/seekStart/pause/resume/stop).

Validation : gate tests toujours verts.

### Étape 3 — Scene (`avatar-poc-scene.ts`)

Changements :
- `SCENE_END_MS = 18000` (dernière syllabe : "parler." se termine à 18000ms)
- Actions du perso `avatar` : ajouter `avatar:morph`, `avatar:gesture`, `avatar:gaze`, `avatar:mood`
- Eventimes :
  - `{ name: 'avatar:gaze', startAt: 0, data: { enabled: true } }`
  - Gestes : 8000ms, 11000ms, 15000ms, 17500ms (valeurs à confirmer à l'implémentation)
- `listen: [{ on: 'scene:start', straps: ['avatar:idle'] }]`

Validation : gate tests toujours verts.

### Étape 4 — Demo (`avatar-poc-1-demo.ts`)

**Zéro import TH.** Le démo crée la scène Three.js en direct.

Structure :
1. Créer `THREE.WebGLRenderer`, `THREE.PerspectiveCamera`, `THREE.Scene`, lumières
2. Appeler `engine.loadModel('/avatars/avatarsdk.glb', { retarget: {...} })` → ajouter le groupe à la scène
3. Récupérer les eye bones : `result.boneMap.get('LeftEye')`, `result.boneMap.get('RightEye')`
4. Instancier `new GazeService(engine.morphEngine, leftEye, rightEye, camera)`
5. Créer `Avatar3DComponent` (deps : engine, gazeService, canvas) + render adapter
6. Passer `avatarIdleStraps` dans la `StrapCollection` de `runCodPlaySceneDemo`

Point de récupération : le stash@{0} contient une version intermédiaire de ce démo
qui utilisait déjà `@codplay/avatar-engine`. Elle sera inspectée et utilisée comme base,
sans pop aveugle (les modifications CodPlay core dans le stash restent ignorées).

Validation : `npm run test` — 0 régression sur les tests existants (8 pré-existants toujours
identiques, gate tests verts).

---

## Questions ouvertes à trancher avant implémentation

### Q1 — Package `@codplay/avatar3d` : nouveau ou dans `avatar-engine` ?

**Recommandation** : nouveau package séparé (identique au pattern `avatar-rive`).  
`avatar-engine` reste réutilisable sans CodPlay.  
→ Valider ce choix.

### Q2 — `avatar:gaze` toujours ON, ou configurable par scène ?

Certaines scènes n'auront peut-être pas de gaze (présentation face caméra fixe vs tableau
interactif où l'avatar regarde l'utilisateur). La gaze est donc pilotée par eventime explicite.

**Recommandation** : toujours un eventime `avatar:gaze` dans la scène — pas d'activation
implicite dans le composant.  
→ Valider ce choix.

### Q3 — Accès à `head.armature` sans appeler `head.animate()`

Après `head.showAvatar()` et `head.start()`, les bones sont en place. On accède à
`head.armature.getObjectByName('LeftEye')` directement.

Si TH surscrit les bones quand `start()` est appelé sans `animate()` → à vérifier au
premier test visuel. Si problème, on pourra appeler `head.animate(0)` une seule fois
pour initialiser la pose de repos.

---

## Ce que ce plan ne couvre PAS (futur)

- Lipsync live (stream TTS)
- Clips d'animation FBX / AnimationMixer
- Multi-modèles (modèle féminin)
- `@codplay/tts` et `@codplay/stream`
- Tests unitaires pour `GazeService` et `Avatar3DComponent`
