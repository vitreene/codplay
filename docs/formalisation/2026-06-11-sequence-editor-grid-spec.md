# Sequence Editor Grid — Spécification et plans

**Date** : 2026-06-11  
**Périmètre** : composant `SequenceEditorGrid` dans `packages/editor`  
**Statut** : définition — aucun code produit

---

## 1. Définition du projet

### 1.1 Ce que c'est

`SequenceEditorGrid` est un composant d'édition temporelle à double axe :

- **Axe X** : temps absolu en millisecondes, avec règle, zoom, panoramique
- **Axe Y** : liste ordonnée d'éléments (tracks), organisés en arbre (capsules imbriquées)

Chaque élément dispose d'une ligne temporelle sur laquelle l'auteur place des **keyframes**. Un keyframe fixe l'état visuel (décor) de l'élément à un instant donné. L'interpolation entre deux keyframes produit une transition animée.

### 1.2 Périmètre de ce document

Ce document couvre :

1. Le modèle de données propre à l'éditeur (distinct de `SceneDoc` Codplay)
2. L'architecture en couches : domaine → machine XState → contrôleur → rendu
3. La spec de chaque couche
4. Un plan d'implémentation par phase

Ce document **ne couvre pas** :

- L'intégration audio multi-pistes (évoquée mais hors scope immédiat)
- Le builder éditeur → `SceneDoc` Codplay (phase ultérieure)
- La persistance base de données (JSON de test pour l'instant)
- Le déplacement de l'API métier vers `packages/authoring` (phase ultérieure)

### 1.3 Avertissement — dimensions et support multi-écran

> **Warning** : cet éditeur doit fonctionner de façon satisfaisante sur iPad (écran ~1024 × 768 pt, interaction tactile) autant que sur desktop (écran large, souris ou trackpad). Ces deux contextes ont des contraintes sensiblement différentes.

Points d'attention concrets :

- **Cibles tactiles** : sur iPad, une cible interactive (keyframe handle, bouton de contrôle) doit mesurer au minimum 44 × 44 pt (Apple HIG). Les valeurs en pixels pensées pour la souris sont trop petites pour le toucher.
- **Hauteurs de rows** : les valeurs fixes définies dans ce document (28 px, 24 px…) sont des valeurs desktop par défaut. Elles doivent être dérivées d'un profil de layout, pas codées en dur dans la logique métier.
- **Seuil de snap** : 8 px est adapté à un curseur de souris avec précision sub-pixel. Pour un doigt, ce seuil doit être significativement plus grand (~20–24 pt).
- **Zoom/pan** : sur desktop, `wheel` + drag. Sur iPad, pinch-to-zoom + pan deux doigts. Les deux modalités doivent envoyer les mêmes events à la machine (`VIEWPORT.ZOOM`, `VIEWPORT.PAN_*`) — c'est la couche de gestes qui les traduit.
- **Unités CSS** : toutes les dimensions passées au rendu doivent être exprimées en **CSS pixels** (unités logiques), pas en pixels physiques. Ne jamais multiplier par `devicePixelRatio` dans la logique de layout.

**`LayoutProfile`** — les valeurs qui varient selon le support sont regroupées dans un objet de configuration passé au contrôleur à l'initialisation :

```typescript
interface LayoutProfile {
  rowHeightElement: number       // px CSS — défaut desktop: 28, touch: 44
  rowHeightCapsule: number       // défaut: 24, touch: 36
  rowHeightCues: number          // défaut: 32, touch: 32 (inchangé)
  rowHeightCuesExpanded: number  // défaut: 80, touch: 80
  rowHeightMarkers: number       // défaut: 20, touch: 28
  rowHeightWaveform: number      // défaut: 48, touch: 48 (inchangé — lecture, pas interaction)
  snapThresholdPx: number        // défaut: 8, touch: 22
  keyframeHandleSizePx: number   // défaut: 10, touch: 20
}

const LAYOUT_DESKTOP: LayoutProfile = { rowHeightElement: 28, rowHeightCapsule: 24, rowHeightCues: 32, rowHeightCuesExpanded: 80, rowHeightMarkers: 20, snapThresholdPx: 8, keyframeHandleSizePx: 10 }
const LAYOUT_TOUCH: LayoutProfile   = { rowHeightElement: 44, rowHeightCapsule: 36, rowHeightCues: 32, rowHeightCuesExpanded: 80, rowHeightMarkers: 28, snapThresholdPx: 22, keyframeHandleSizePx: 20 }
```

Le profil actif est injecté dans le contexte de la machine et consulté par le rendu. Il peut être changé à chaud (redimensionnement de fenêtre, détection du mode tactile via `pointer: coarse`). **Aucune valeur de dimension ne doit être codée en dur** en dehors de `LayoutProfile`.

Le choix du profil par défaut (auto-détection via media query `pointer: coarse` ou passage explicite) est décidé à la Phase 5.

---

### 1.4 Contraintes architecturales

**Séparation stricte des couches** :

```
[Domain types + pure functions]
         ↓
[XState machine] ← seule source de vérité
         ↓
[Controller class] ← enveloppe l'acteur, expose les commandes
         ↓
[Render adapter] ← projection pure du snapshot, zéro state propre
```

- L'acteur XState est la seule source de vérité à l'exécution
- Le rendu est une **projection** du snapshot machine : il ne gère pas d'état réactif propre
- En particulier, un binding React **ne doit pas** utiliser `useState` / `useEffect` pour de la logique métier. Il souscrit à l'acteur via `actor.subscribe()` ou `useSelector` et se re-rend
- Pas de concurrence XState / React state : si c'est dans la machine, ce n'est pas dans React
- Une librairie de rendu (Canvas 2D, PixiJS, SVG) peut être employée pour la zone temporelle. Le choix reste ouvert à la phase de rendu

### 1.4 Localisation dans le monorepo

```
packages/editor/
  src/
    sequence-editor/
      types.ts              ← modèle de données
      constants.ts          ← constantes nommées (zoom, graduation, arrondi…)
      layout-profile.ts     ← LayoutProfile, LAYOUT_DESKTOP, LAYOUT_TOUCH
      display-config.ts     ← DisplayConfig, DISPLAY_CONFIG_DEFAULT
      machine.ts            ← machine XState
      controller.ts         ← classe contrôleur
      fixtures/             ← JSON de test + prototype-observations.md
      render/               ← adaptateurs de rendu
        time-ruler.ts       ← SVG
        track-row.ts        ← DOM + SVG inline
        keyframe-handle.ts  ← SVG <polygon>
        playhead-line.ts    ← SVG overlay
        waveform-row.ts     ← Canvas 2D (exception documentée)
        cue-row.ts          ← SVG
        marker-row.ts       ← SVG
        react/              ← binding React (optionnel)
          use-sequence-editor.ts
      sequence-editor.css   ← custom properties, layout CSS Grid
```

L'API métier (add/remove track, serialize, deserialize) migrera vers `packages/authoring` dans une phase ultérieure, sans modifier l'interface externe du contrôleur.

```
packages/editor/
  src/
    sequence-editor/
      constants.ts       ← toutes les valeurs nommées (zoom, graduation, buffer…)
      layout-profile.ts  ← LayoutProfile, LAYOUT_DESKTOP, LAYOUT_TOUCH
      …
```

### 1.6 Conventions de code — constantes et configuration

**Aucune valeur numérique ou de chaîne significative ne doit apparaître en dur** dans la logique métier, la machine ou le rendu. Toute valeur qui pourrait varier selon le contexte, évoluer ou faire l'objet d'un réglage est une constante nommée.

Les constantes vivent dans `constants.ts` (valeurs fixes du domaine) ou dans `LayoutProfile` / `layout-profile.ts` (valeurs dépendant du support). Elles sont importées explicitement — jamais réécrites localement.

Constantes à définir dès la Phase 1 :

```typescript
// Zoom
export const ZOOM_MIN_PX_PER_SEC  = 10    // pixels par seconde, zoom minimum
export const ZOOM_MAX_PX_PER_SEC  = 800
export const ZOOM_DEFAULT_PX_PER_SEC = 80

// Règle temporelle — niveaux de graduation (ms)
export const RULER_GRADUATION_LEVELS_MS = [100, 500, 1000, 5000, 10000, 30000, 60000]
// Niveau affiché = plus petit intervalle tel que widthPx ≥ MIN_GRADUATION_GAP_PX
export const MIN_GRADUATION_GAP_PX = 48

// Virtualisation
export const VIRTUAL_SCROLL_BUFFER_ROWS = 3

// Arrondi temporel
export const TIME_STEP_MS = 100   // granularité d'arrondi au commit

// Transitions par défaut
export const DEFAULT_TRANSITION_DURATION_MS = 400
export const DEFAULT_EASING: EasingValue = 'ease-in-out'

// Formatage temporel (voir DisplayConfig §1.8)
export function formatTimeMs(ms: number, unit: 's' | 'ms'): string {
  if (unit === 'ms') return `${ms} ms`
  return `${(Math.round(ms / 100) / 10).toFixed(1)} s`
}
```

Toute valeur issue de `LayoutProfile` (seuils, hauteurs) est lue depuis `context.layoutProfile` — jamais répétée.

### 1.8 Configuration d'affichage — `DisplayConfig`

`DisplayConfig` regroupe les préférences d'affichage qui ne dépendent ni du support physique ni du domaine métier. Elle est distincte de `LayoutProfile` (dimensions) et de `constants.ts` (valeurs fixes).

```typescript
interface DisplayConfig {
  timeUnit: 's' | 'ms'   // unité d'affichage des valeurs temporelles — défaut : 's'
}

const DISPLAY_CONFIG_DEFAULT: DisplayConfig = { timeUnit: 's' }
```

**Formatage selon `timeUnit`** :

| Valeur interne | `'s'` (défaut) | `'ms'` |
|---|---|---|
| 0 ms | `"0.0 s"` | `"0 ms"` |
| 1523 ms | `"1.5 s"` | `"1523 ms"` |
| 10000 ms | `"10.0 s"` | `"10000 ms"` |

En mode `'s'`, l'arrondi est `(Math.round(ms / 100) / 10).toFixed(1) + ' s'`.  
En mode `'ms'`, la valeur entière est affichée telle quelle : `ms + ' ms'`.

`DisplayConfig` est passée au contrôleur à l'initialisation et modifiable à chaud via `setDisplayConfig()`. Elle est stockée dans le contexte de la machine et lue par tous les composants de rendu qui affichent une valeur temporelle.

### 1.9 Conventions de code — CSS

**CSS Grid en priorité.** `position: absolute` est réservé aux éléments qui doivent flotter au-dessus du flux (overlay SVG du playhead, éventuel ghost de drag). Le layout de la grille elle-même — répartition labels / zone temporelle, empilement des rows — est exprimé en CSS Grid.

**CSS custom properties** pour toutes les variables visuelles thématiques (couleurs, espacements, tailles de police). Elles sont déclarées sur `:root` ou sur le conteneur du composant, jamais en inline style sauf pour les valeurs calculées dynamiquement (position X d'un keyframe, largeur de la fenêtre active).

```css
/* Exemple — variables du composant */
.seq-editor {
  --seq-track-h: 28px;         /* surchargé par LayoutProfile via JS */
  --seq-kf-size: 10px;
  --seq-color-kf: #6366f1;
  --seq-color-window: color-mix(in srgb, #6366f1 15%, transparent);
  --seq-color-playhead: #ef4444;
}
```

Les valeurs dépendant du `LayoutProfile` sont appliquées en JS via `element.style.setProperty('--seq-track-h', profile.rowHeightElement + 'px')` au montage et à chaque `setLayoutProfile()`.

**Fonctions CSS modernes autorisées** : `clamp()`, `min()`, `max()`, `color-mix()`, `container queries` si nécessaire pour l'adaptation iPad/desktop. Compatibilité cible : navigateurs ≥ 2023 (Safari 16.4+, Chrome 112+, Firefox 113+).

**`position: absolute` reste acceptable** pour :
- L'overlay SVG du playhead (positionné sur toute la hauteur de la zone temporelle)
- Le ghost d'un élément en cours de drag (hors flux par nature)
- Les tooltips et popovers

Dans ces cas, le parent direct doit avoir `position: relative` ou être un contexte de positionnement établi — jamais implicite.

---

## 2. Modèle de données

### 2.1 Principes

- Le modèle éditeur est **autonome** : il n'est pas un sous-ensemble de `SceneDoc`
- Les identifiants sont des strings (UUID ou slug pour les tests)
- Tout est sérialisable en JSON sans perte
- **Unité interne** : toutes les valeurs temporelles (`timeMs`, `durationMs`, `startMs`…) sont en **millisecondes entières** — la granularité maximale est 1 ms. Toute valeur à précision inférieure (ex. timestamp Whisper en secondes flottantes) est arrondie au milliseconde le plus proche à l'entrée : `Math.round(valueSec * 1000)`
- **Granularité d'affichage** : le dixième de seconde (100 ms). Les valeurs sont affichées en secondes avec une décimale — ex. 1500 ms → `"1.5 s"`, 300 ms → `"0.3 s"`. Aucune interface n'expose une précision inférieure au dixième de seconde
- **Arrondi au commit** : toute valeur temporelle produite par un geste utilisateur (drag, clic sur la règle) est arrondie à 100 ms avant d'être écrite dans le modèle : `Math.round(rawMs / 100) * 100`. Exception : les snap points issus de cues ou de markers sont commités à leur valeur exacte (non arrondie), même si elle n'est pas un multiple de 100 ms — un cue Whisper peut être défini au millième de seconde près
- **Position visuelle vs valeur affichée** : ces deux notions sont indépendantes. La position d'un keyframe sur l'axe X est toujours calculée depuis son `timeMs` exact — un keyframe à 1523 ms est positionné précisément à `1523 * pixelsPerMs`. La valeur textuelle affichée (label, infobulle, champ) dépend de `DisplayConfig.timeUnit` (voir §1.8)
- **`DisplayConfig.timeUnit`** : `'s'` → arrondi au dixième, ex. `"1.5 s"` ; `'ms'` → valeur entière brute, ex. `"1523 ms"`. Défaut : `'s'`

**Le composant est décor-agnostique.**  
La grille met en relation un keyframe, un élément, et une **référence** de décor. Elle ne lit pas, n'écrit pas et n'interprète pas le contenu d'un décor. La structure interne d'un `EditorDecor` (propriétés CSS, position, etc.) est opaque pour la grille — c'est le domaine du builder et des outils d'édition externes. Les propriétés décrites dans ce document sont indicatives du contenu attendu, non normatives pour la grille elle-même.

### 2.2 Types principaux

#### `EditorScene`

Racine du document éditeur.

```typescript
interface EditorScene {
  id: string
  title: string
  durationMs: number
  durationSource: 'arbitrary' | 'audio-primary' | 'mixed'
  tracks: TrackNode[]                       // arbre ordonné
  decors: Record<string, EditorDecor>       // registre de décors, indexé par id
  cues: TextCue[]                           // repères textuels (Whisper ou manuels)
  markers: AuthorMarker[]                   // repères magnétiques auteur
  audio?: AudioTrack                        // piste audio principale (optionnelle, v1)
}
```

`durationMs` est toujours la valeur résolue ; `durationSource` indique son origine pour le recalcul. Quand `durationSource === 'audio-primary'`, `durationMs` est calqué sur `audio.durationMs` — il est recalculé si l'audio change.

`decors` est le registre plat des décors référencés par les keyframes. La grille le transporte pour assurer le roundtrip JSON, mais n'en lit pas le contenu.

#### `AudioTrack`

Représentation d'une piste audio attachée à la scène. Périmètre v1 : une seule piste, affichage de la forme d'onde, pas de clipping ni de scission (défini dans l'intégration audio complète).

```typescript
interface AudioTrack {
  id: string
  label: string
  srcUrl: string              // URL ou chemin du fichier audio
  durationMs: number          // durée de l'audio, en ms
  waveform?: WaveformDataV1   // données de forme d'onde, calculées asynchronement
}

// Réutilisé depuis Eddy (packages/editor ou re-export depuis packages/authoring)
interface WaveformDataV1 {
  version: 1
  sampleRate: number
  durationSec: number
  points: number
  min: number[]   // amplitude min par point (longueur = points)
  max: number[]   // amplitude max par point (longueur = points)
}
```

`waveform` est optionnel : la piste peut être présente sans données de forme d'onde (avant que le calcul asynchrone soit terminé). La grille affiche alors la piste audio sans rendu de signal.

Le calcul de la forme d'onde est **hors périmètre de la grille** — il est déclenché par le contrôleur via un worker (même pattern que `waveform/worker.ts` dans Eddy) et injecté via la commande `setAudioWaveform`.

#### `TrackNode`

Un nœud de l'arbre Y. Peut être un élément ou une capsule.

```typescript
interface TrackNode {
  id: string
  kind: 'element' | 'capsule'
  label: string
  visible: boolean

  // Uniquement pour kind === 'element'
  contentType?: 'text' | 'image' | 'media' | 'video'

  // Uniquement pour kind === 'capsule'
  capsuleType?: CapsuleKind
  children?: TrackNode[]     // imbrication arbitraire

  // Timeline de l'élément
  keyframes: Keyframe[]
}
```

`CapsuleKind` reprend le registre Eddy : `'carousel' | 'rangee' | 'liste' | 'grille' | 'position' | 'card'`.

#### `Keyframe`

Un instant nommable, lié à une référence de décor et portant des transitions optionnelles.

```typescript
interface Keyframe {
  id: string
  timeMs: number
  name?: string              // lie ce kf à un repère nommé global
  decorId: string | null     // référence vers EditorScene.decors — opaque pour la grille
  markerId?: string          // accrochage à un AuthorMarker — optionnel
  transitionIn?: TransitionDef   // transition vers ce kf (s'achève au timeMs)
  transitionOut?: TransitionDef  // transition depuis ce kf (débute au timeMs)
}
```

`decorId` est la seule information de décor que la grille connaît. Elle ne lit pas `EditorScene.decors[decorId]`. Quand un keyframe est créé, la grille copie le `decorId` du keyframe adjacent le plus proche (voir §2.5).

**Accrochage à un marker (`markerId`)** :

Quand un keyframe est accroché à un `AuthorMarker`, son `timeMs` est toujours égal au `timeMs` du marker. Si le marker est déplacé (event `MARKER.MOVE`), tous les keyframes portant ce `markerId` se déplacent avec lui — leur `timeMs` est recalculé en même temps.

**Modalité d'accrochage — à valider au prototype.**

Deux comportements sont envisageables et seront mis à l'épreuve en Phase 2 :

- **Accrochage explicite** : l'auteur déclenche l'accrochage via une action dédiée après avoir placé le keyframe (menu contextuel, raccourci, bouton). Le drop ne suffit pas.
- **Accrochage implicite au drop** : si au moment du `pointerup`, le keyframe se trouve dans le rayon de snap d'un marker (distance `≤ snapThresholdPx`), il est automatiquement attaché à ce marker. Le survol du repère au moment du relâché constitue l'intention d'accrochage.

La seconde modalité est plus fluide. Elle implique que `DRAG.END` vérifie non seulement les cues (déjà fait pour le snap de position) mais aussi les markers, et émet `KEYFRAME.ATTACH_MARKER` si la condition est réunie.

Le décrochage reste dans les deux cas une action explicite : le keyframe conserve son `timeMs` courant mais perd `markerId`.

La résolution `markerId → timeMs` est faite par le builder lors de la compilation vers `SceneDoc` ; dans le modèle éditeur, `timeMs` est toujours la valeur résolue et à jour.

**Sémantique des transitions** :

- `transitionIn.durationMs = 800` sur kf2 à t=5000 ms : la transition débute à t=4200 ms et se termine à t=5000 ms. Entre kf1 et t=4200 ms, l'état de kf1 est maintenu.
- `transitionOut` sur kf1 : la transition débute à l'instant de kf1 et s'achève `durationMs` plus tard.

**Règle d'exclusivité** : entre deux keyframes adjacents, `transitionOut` (sur le keyframe source) et `transitionIn` (sur le keyframe destination) ne peuvent pas coexister. L'UI l'interdit : créer l'une exige d'avoir supprimé l'autre. Le modèle ne peut donc pas se trouver dans cet état — aucune logique de résolution de priorité n'est nécessaire.

#### `TransitionDef`

`TransitionDef` est une union discriminée selon la position du keyframe :

- **intro/outro** (`kind: 'named'`) : transition par preset nommé (identique à Eddy). Les propriétés animées (opacité, x, y, scale…) sont définies dans le preset, hors du décor.
- **inter-keyframes** (`kind: 'interpolated'`) : le builder calcule l'animation à partir du diff entre les décors adjacents. La grille stocke uniquement la durée et l'easing.

```typescript
type TransitionKey = '--' | 'cut' | 'fade' | 'swipe-left' | 'swipe-right' | 'swipe-top' | 'swipe-down' | 'zoom'

type TransitionDef =
  | { kind: 'named'; name: TransitionKey; durationMs: number }
  | { kind: 'interpolated'; durationMs: number; easing: EasingValue }

type EasingValue =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | { type: 'cubic-bezier'; p1x: number; p1y: number; p2x: number; p2y: number }
```

`transitionIn` et `transitionOut` sur les keyframes intro/outro utilisent `kind: 'named'`. Les keyframes intermédiaires utilisent `kind: 'interpolated'`.

#### `EditorDecor`

Un décor est une entrée opaque du registre. La grille ne connaît que son `id` — elle ne lit pas `data`.

```typescript
interface EditorDecor {
  id: string
  data: Record<string, unknown>   // opaque pour la grille — domaine du builder et du panel
}
```

`data` contiendra, dans les outils externes, les propriétés visuelles de l'élément à cet instant (styles, position, classes…). La structure exacte de `data` est définie dans la spec du builder, hors périmètre de ce composant.

**Ce que la grille fait avec les décors** :
- créer une entrée vide `{ id, data: {} }` dans `scene.decors` à chaque `addKeyframe`
- supprimer l'entrée dans `scene.decors` à chaque `removeKeyframe` (si aucun autre kf ne la référence)
- transporter le registre dans `serialize()` / `deserialize()`
- exposer `registerDecor` et `getDecorData` pour permettre aux outils externes d'écrire et lire le contenu

**Ce que la grille ne fait pas** :
- lire les propriétés de `data`
- calculer des interpolations
- valider le contenu de `data`

#### `TextCue`

Repère temporel textuel (issu de Whisper ou saisi manuellement).

```typescript
interface TextCue {
  id: string
  name: string              // identifiant unique dans la scène
  text: string
  startMs: number
  endMs: number
  source: 'whisper' | 'manual'
}
```

Les cues textuels sont des **points magnétiques** : un keyframe peut s'y accrocher. Si un cue nommé est déplacé, les keyframes accrochés se déplacent avec lui.

#### `AuthorMarker`

Repère magnétique libre ajouté par l'auteur sur la timeline.

```typescript
interface AuthorMarker {
  id: string
  name: string
  timeMs: number
}
```

### 2.3 Cycle de vie des décors (copy-on-write)

La grille gère les références de décors selon ce protocole :

**À la création d'un keyframe (`addKeyframe`)** : la grille cherche le keyframe adjacent le plus proche (précédent ou suivant) sur le même track. Si un voisin existe, le nouveau keyframe hérite de son `decorId` — les deux keyframes partagent la même entrée dans `scene.decors`. Si aucun voisin n'existe (premier keyframe du track), une entrée vide `{ id: newId, data: {} }` est créée.

**À la modification d'un décor (externe)** : l'éditeur de décors est responsable de vérifier si le `decorId` courant est partagé. Si oui, il doit créer une nouvelle entrée dans `scene.decors` (via `registerDecor`) et appeler `assignDecor` pour lier le keyframe à ce nouvel id, avant d'écrire les propriétés. Cette logique copy-on-write est **hors périmètre** de la grille.

**À la suppression d'un keyframe** : la grille supprime l'entrée `scene.decors[decorId]` seulement si aucun autre keyframe (dans toute la scène) ne référence ce `decorId`.

Cette approche garantit que plusieurs keyframes consécutifs au même décor ne dupliquent pas inutilement les données, et que le coût de création d'un nouveau décor n'est payé que lors d'une modification réelle.

### 2.4 Intro et Outro

Intro et Outro ne sont pas des types distincts : ce sont des **keyframes avec nom réservé** :

- Le premier keyframe d'un élément dont `name === 'intro'` définit le bord d'entrée
- Le dernier dont `name === 'outro'` définit le bord de sortie
- En dehors des bornes intro/outro, l'élément n'est pas visible (il ne reçoit pas d'events Codplay)

**Assignation automatique** : si intro ou outro ne sont pas définis, l'élément est considéré présent sur toute la durée de la scène. Cela est représenté en mémoire par l'absence de keyframes intro/outro, pas par leur création automatique.

**Héritage capsule** : si un élément est dans une capsule qui a ses propres bornes intro/outro, la fenêtre effective de l'élément est l'intersection des deux. Cela se calcule au build, pas dans le modèle éditeur.

### 2.4 JSON de test

Format de sérialisation de `EditorScene` : JSON plat, pas de classes, pas de méthodes. Exemple minimaliste pour les fixtures de test :

```json
{
  "id": "scene-test-01",
  "title": "Test simple",
  "durationMs": 10000,
  "durationSource": "arbitrary",
  "tracks": [
    {
      "id": "track-01",
      "kind": "element",
      "contentType": "text",
      "label": "Titre",
      "visible": true,
      "keyframes": [
        {
          "id": "kf-01",
          "timeMs": 0,
          "name": "intro",
          "decorId": "decor-01",
          "transitionOut": { "kind": "named", "name": "fade", "durationMs": 600 }
        },
        {
          "id": "kf-02",
          "timeMs": 600,
          "decorId": "decor-02",
          "transitionOut": { "kind": "interpolated", "durationMs": 400, "easing": "ease-in-out" }
        },
        {
          "id": "kf-03",
          "timeMs": 9000,
          "name": "outro",
          "decorId": "decor-02",
          "transitionOut": { "kind": "named", "name": "fade", "durationMs": 500 }
        }
      ]
    }
  ],
  "decors": {
    "decor-01": { "id": "decor-01", "data": {} },
    "decor-02": { "id": "decor-02", "data": {} }
  },
  "cues": [],
  "markers": []
}
```

Les `data` sont vides dans les fixtures de test de la grille. Les fixtures avec contenu peuplé appartiennent aux tests du builder.

---

## 3. Machine XState

### 3.1 Contexte

Le contexte de la machine contient tout l'état de la session d'édition :

```typescript
interface SequenceEditorContext {
  // Document
  scene: EditorScene

  // Viewport
  viewport: {
    startMs: number          // bord gauche visible
    endMs: number            // bord droit visible
    pixelsPerMs: number      // zoom courant
    viewWidthPx: number      // largeur du conteneur (informé par le DOM)
    viewHeightPx: number
  }

  // Lecture
  playheadMs: number
  isPlaying: boolean

  // Sélection
  selection: {
    trackId: string | null
    keyframeId: string | null
  }

  // Interaction en cours
  interaction: InteractionState | null

  // Profil de layout (desktop / touch)
  layoutProfile: LayoutProfile

  // Configuration d'affichage
  displayConfig: DisplayConfig

  // Mode de vue
  viewMode: 'full-sequence' | 'text-priority'

  // Cues snap (lecture seule, calculé depuis scene.cues + scene.markers)
  snapGrid: SnapPoint[]
}

type SnapPoint = {
  timeMs: number
  kind: 'cue-start' | 'cue-end' | 'marker' | 'keyframe'
  sourceId: string
}

type InteractionState =
  | { kind: 'dragging-keyframe'; trackId: string; keyframeId: string; originMs: number; currentMs: number }
  | { kind: 'dragging-playhead'; originMs: number; currentMs: number }
  | { kind: 'panning'; originPx: number; originStartMs: number }
  | { kind: 'drawing-window'; trackId: string; startMs: number; currentMs: number }
```

### 3.2 Topologie des états

```
idle
├── on SELECT_TRACK       → idle (selection mise à jour)
├── on SELECT_KEYFRAME    → idle (selection mise à jour)
├── on ADD_KEYFRAME       → idle (keyframe ajouté)
├── on REMOVE_KEYFRAME    → idle
├── on SET_DECOR          → idle
├── on SET_PLAYHEAD       → idle
├── on START_PLAY         → playing
├── on START_PAN          → panning
├── on START_KF_DRAG      → dragging-keyframe
├── on START_WINDOW_DRAW  → drawing-window
├── on ZOOM               → idle (viewport mis à jour)
├── on SET_VIEW_MODE      → idle
├── on RESIZE_VIEWPORT    → idle
├── on LOAD_SCENE         → idle (scène remplacée)
└── on …mutations d'arbre → idle

playing
├── on TICK               → playing (playhead avancé)
├── on STOP_PLAY          → idle
└── on SEEK               → playing

panning
├── on PAN_MOVE           → panning
└── on PAN_END            → idle

dragging-keyframe
├── on DRAG_MOVE          → dragging-keyframe (currentMs mis à jour, snap appliqué)
└── on DRAG_END           → idle (timeMs du keyframe commité)

drawing-window
├── on DRAW_MOVE          → drawing-window
└── on DRAW_END           → idle (intro/outro assignés ou keyframe créé)
```

### 3.3 Actions et guards

**Actions pures** (pas de side-effects) :

- `assignViewport` — recalcule `endMs` depuis `startMs + viewWidthPx / pixelsPerMs`
- `assignSelection`
- `assignSnapGrid` — recalcule depuis `scene.cues`, `scene.markers`, keyframes de tous les tracks
- `commitKeyframeDrag` — applique `currentMs` → `keyframe.timeMs` avec arrondi à 100 ms (sauf si `currentMs` provient d'un snap sur cue/marker), reset interaction
- `commitWindowDraw` — créé ou met à jour intro/outro sur le track ciblé
- `addKeyframe` — insère un keyframe trié par `timeMs`
- `removeKeyframe` — retire par id, recalcule les transitions adjacentes si nécessaire
- `mutateTrackTree` — wraps add/remove/move/nest track

**Guards** :

- `canCommitDrag` : `currentMs` dans `[0, scene.durationMs]`
- `snapThresholdReached` : distance en px entre `currentMs` et le snap point le plus proche `≤ context.layoutProfile.snapThresholdPx` (8 px desktop, 22 px touch — voir §1.3)

### 3.4 Events envoyés à la machine

Nomenclature : `DOMAINE.ACTION` en snake_case majuscule.

```typescript
type SequenceEditorEvent =
  // Sélection
  | { type: 'TRACK.SELECT'; trackId: string | null }
  | { type: 'KEYFRAME.SELECT'; trackId: string; keyframeId: string | null }

  // Keyframes
  | { type: 'KEYFRAME.ADD'; trackId: string; timeMs: number }
  | { type: 'KEYFRAME.REMOVE'; trackId: string; keyframeId: string }
  | { type: 'KEYFRAME.RENAME'; trackId: string; keyframeId: string; name: string | null }
  | { type: 'KEYFRAME.ASSIGN_DECOR'; trackId: string; keyframeId: string; decorId: string | null }
  | { type: 'DECOR.REGISTER'; decorId: string; data: Record<string, unknown> }
  | { type: 'KEYFRAME.SET_TRANSITION_IN'; trackId: string; keyframeId: string; def: TransitionDef | null }
  | { type: 'KEYFRAME.SET_TRANSITION_OUT'; trackId: string; keyframeId: string; def: TransitionDef | null }

  // Drag
  | { type: 'DRAG.START_KEYFRAME'; trackId: string; keyframeId: string }
  | { type: 'DRAG.MOVE'; pointerMs: number }
  | { type: 'DRAG.END' }

  // Window draw (intro/outro)
  | { type: 'WINDOW.START_DRAW'; trackId: string; pointerMs: number }
  | { type: 'WINDOW.DRAW_MOVE'; pointerMs: number }
  | { type: 'WINDOW.DRAW_END'; pointerMs: number }

  // Playhead
  | { type: 'PLAYHEAD.SET'; timeMs: number }
  | { type: 'PLAYHEAD.START_PLAY' }
  | { type: 'PLAYHEAD.STOP' }
  | { type: 'PLAYHEAD.TICK'; deltaMs: number }

  // Viewport
  | { type: 'VIEWPORT.PAN_START'; pointerPx: number }
  | { type: 'VIEWPORT.PAN_MOVE'; pointerPx: number }
  | { type: 'VIEWPORT.PAN_END' }
  | { type: 'VIEWPORT.ZOOM'; factor: number; focusMs: number }  // zoom centré sur focusMs
  | { type: 'VIEWPORT.RESIZE'; widthPx: number; heightPx: number }
  | { type: 'VIEWPORT.SET_MODE'; mode: 'full-sequence' | 'text-priority' }
  | { type: 'VIEWPORT.SET_LAYOUT_PROFILE'; profile: LayoutProfile }  // changement desktop ↔ touch
  | { type: 'VIEWPORT.SET_DISPLAY_CONFIG'; config: DisplayConfig }

  // Track tree
  | { type: 'TRACK.ADD'; node: Omit<TrackNode, 'keyframes'>; afterId?: string }
  | { type: 'TRACK.REMOVE'; trackId: string }
  | { type: 'TRACK.MOVE'; trackId: string; afterId: string | null; parentId?: string }
  | { type: 'TRACK.TOGGLE_VISIBILITY'; trackId: string }
  | { type: 'TRACK.NEST_IN_CAPSULE'; trackId: string; capsuleId: string }
  | { type: 'TRACK.RESET_KEYFRAMES'; trackId: string }

  // Cues / Markers
  | { type: 'CUE.ADD'; cue: TextCue }
  | { type: 'CUE.REMOVE'; cueId: string }
  | { type: 'MARKER.ADD'; marker: AuthorMarker }
  | { type: 'MARKER.MOVE'; markerId: string; timeMs: number }  // propage aux kf accrochés
  | { type: 'MARKER.REMOVE'; markerId: string }                // détache les kf accrochés (markerId → undefined, timeMs conservé)
  | { type: 'KEYFRAME.ATTACH_MARKER'; trackId: string; keyframeId: string; markerId: string }
  | { type: 'KEYFRAME.DETACH_MARKER'; trackId: string; keyframeId: string }

  // Audio
  | { type: 'AUDIO.SET'; track: AudioTrack }            // charge ou remplace la piste audio
  | { type: 'AUDIO.CLEAR' }                             // retire la piste audio
  | { type: 'AUDIO.SET_WAVEFORM'; waveform: WaveformDataV1 }  // injecté par le worker après calcul

  // Document
  | { type: 'SCENE.LOAD'; scene: EditorScene }
  | { type: 'SCENE.SET_DURATION'; durationMs: number; source?: EditorScene['durationSource'] }
```

---

## 4. Classe contrôleur

### 4.1 Rôle

`SequenceEditorController` encapsule l'acteur XState et expose :

- Une API impérative (commandes), utilisée par le rendu et par les intégrations externes
- Un mécanisme de souscription aux snapshots (pour le rendu)
- La sérialisation / désérialisation du document

La classe ne fait **pas** de rendu. Elle ne dépend pas de React.

### 4.2 Interface

```typescript
class SequenceEditorController {
  // Cycle de vie
  constructor(initialScene?: EditorScene)
  destroy(): void

  // Souscription
  subscribe(callback: (snapshot: SequenceEditorSnapshot) => void): () => void
  getSnapshot(): SequenceEditorSnapshot

  // Accès direct au contexte (lecture)
  getScene(): EditorScene
  getViewport(): SequenceEditorContext['viewport']
  getPlayheadMs(): number
  getSelection(): SequenceEditorContext['selection']

  // Commandes viewport
  zoom(factor: number, focusPx?: number): void  // focusPx → converti en Ms
  pan(deltaPx: number): void                    // wrapper autour de PAN_START/MOVE/END
  setViewMode(mode: 'full-sequence' | 'text-priority'): void
  notifyResize(widthPx: number, heightPx: number): void
  setLayoutProfile(profile: LayoutProfile): void   // permet la bascule desktop ↔ touch à chaud
  setDisplayConfig(config: Partial<DisplayConfig>): void

  // Commandes playhead
  play(): void
  stop(): void
  seek(timeMs: number): void

  // Commandes sélection
  selectTrack(trackId: string | null): void
  selectKeyframe(trackId: string, keyframeId: string | null): void

  // Commandes keyframe
  addKeyframe(trackId: string, timeMs: number): string  // retourne l'id créé ; clone le decorId du kf adjacent le plus proche
  removeKeyframe(trackId: string, keyframeId: string): void  // supprime l'entrée decor du registre seulement si aucun autre kf ne la partage
  moveKeyframe(trackId: string, keyframeId: string, timeMs: number): void
  renameKeyframe(trackId: string, keyframeId: string, name: string | null): void
  assignDecor(trackId: string, keyframeId: string, decorId: string | null): void
  setTransitionIn(trackId: string, keyframeId: string, def: TransitionDef | null): void
  setTransitionOut(trackId: string, keyframeId: string, def: TransitionDef | null): void

  // Registre de décors (accès pour les outils externes — panel, import)
  registerDecor(decorId: string, data: Record<string, unknown>): void  // crée ou remplace
  getDecorData(decorId: string): Record<string, unknown> | null         // lecture opaque

  // Commandes track tree
  addTrack(node: Omit<TrackNode, 'keyframes'>, afterId?: string): string
  removeTrack(trackId: string): void
  moveTrack(trackId: string, afterId: string | null, parentId?: string): void
  nestTrack(trackId: string, capsuleId: string): void
  toggleVisibility(trackId: string): void
  resetKeyframes(trackId: string): void

  // Commandes cues / markers
  addCue(cue: Omit<TextCue, 'id'>): string
  removeCue(cueId: string): void
  addMarker(timeMs: number, name?: string): string
  moveMarker(markerId: string, timeMs: number): void   // déplace le marker et tous ses kf accrochés
  removeMarker(markerId: string): void                 // détache les kf (markerId supprimé, timeMs conservé)
  attachMarker(trackId: string, keyframeId: string, markerId: string): void
  detachMarker(trackId: string, keyframeId: string): void

  // Audio (v1 — piste unique)
  setAudio(track: Omit<AudioTrack, 'waveform'>): void   // charge la piste, déclenche le worker
  clearAudio(): void
  setAudioWaveform(waveform: WaveformDataV1): void       // appelé par le worker en fin de calcul

  // Durée de la scène
  setDuration(durationMs: number, source?: EditorScene['durationSource']): void

  // Sérialisation
  serialize(): EditorScene          // snapshot JSON du document courant
  deserialize(scene: EditorScene): void  // remplace le document courant

  // Conversion de coordonnées (utilitaires pour le rendu)
  msToPixel(timeMs: number): number
  pixelToMs(px: number): number
  clampToViewport(timeMs: number): number
  snapToGrid(timeMs: number): number   // retourne le snap le plus proche si dans le seuil
}

type SequenceEditorSnapshot = {
  context: SequenceEditorContext
  value: string   // état courant de la machine (ex. 'idle', 'dragging-keyframe')
}
```

### 4.3 Cycle de vie et intégration

```typescript
// Instanciation
const controller = new SequenceEditorController(myScene)

// Souscription (rendu vanilla)
const unsubscribe = controller.subscribe((snapshot) => {
  render(snapshot.context)
})

// Souscription React (binding thin)
function useSequenceEditor(controller: SequenceEditorController) {
  const [snapshot, setSnapshot] = useState(() => controller.getSnapshot())
  useEffect(() => controller.subscribe(setSnapshot), [controller])
  return snapshot
}

// Nettoyage
controller.destroy()
unsubscribe()
```

---

## 5. Architecture du rendu

### 5.1 Layout CSS Grid du composant

L'éditeur est structuré en CSS Grid à deux niveaux.

**Niveau racine** — grille à deux colonnes (labels | zone temporelle) et deux lignes (règle | contenu) :

```css
.seq-editor {
  display: grid;
  grid-template-columns: var(--seq-label-w, 200px) 1fr;
  grid-template-rows: var(--seq-ruler-h, 28px) 1fr;
  grid-template-areas:
    "corner ruler"
    "labels timeline";
  overflow: hidden;
}

.seq-ruler    { grid-area: ruler; }
.seq-labels   { grid-area: labels; overflow-y: hidden; }  /* synchronisé avec timeline */
.seq-timeline { grid-area: timeline; overflow: hidden; position: relative; }
```

**Niveau timeline** — le conteneur virtuel est un `<div>` dont la hauteur totale = somme des rows visibles. Les rows sont des `<div>` positionnés en `translateY` (pas en `top` absolu) pour éviter les reflows.

```css
.seq-track-row {
  display: grid;
  grid-template-columns: 1fr;   /* une seule colonne : la zone temporelle */
  height: var(--seq-track-h);   /* lu depuis LayoutProfile */
  position: relative;           /* contexte de positionnement pour le SVG inline */
}
```

`position: absolute` n'intervient que pour l'overlay SVG du playhead, positionné sur `.seq-timeline`.

### 5.2 Décomposition visuelle

```
┌──────────────────────────────────────────────────────────────────┐
│  [Règle temporelle]     ← SVG                                    │
├─────────────────┬────────────────────────────────────────────────┤
│  [Track labels] │  [Zone temporelle — DOM + SVG overlay]         │
│  nom + contrôles│  ┌──── keyframes (SVG) ──────────────────┐     │
│  (DOM)          │  │ ◆──────◆───────◆   (fenêtre DOM)      │     │
│                 │  └───────────────────────────────────────┘     │
│                 │  ┌── capsule header (DOM) ────────────────┐    │
│                 │  │  ┌─ enfant 1 (DOM) ────────────────┐   │    │
│                 │  │  │ ◆──────◆                        │   │    │
│                 │  │  └────────────────────────────────-┘   │    │
│                 │  │  ┌─ enfant 2 (DOM) ────────────────┐   │    │
│                 │  │  │ ◆──────────────◆                │   │    │
│                 │  │  └────────────────────────────────-┘   │    │
│                 │  └────────────────────────────────────────┘    │
│                 │  [Waveform — Canvas 2D]  ← si audio présent     │
│                 │  [Piste cues — SVG]                            │
│                 │  [Piste markers — SVG]                         │
├─────────────────┴────────────────────────────────────────────────┤
│  [Playhead]             ← SVG overlay full-height                │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Composants de rendu

Chaque sous-composant reçoit uniquement les données dont il a besoin, dérivées du snapshot de la machine. Il n'a pas d'accès direct au contrôleur sauf pour envoyer des commandes en réponse aux événements utilisateur.

**`TimeRuler`**

- Entrées : `viewport`, `viewMode`
- Rendu : SVG. Graduations adaptatives selon le zoom, avec 100 ms (0.1 s) comme graduation minimale. Les labels affichent toujours des secondes à une décimale (`"0.0"`, `"1.5"`, `"12.0"`). Aux niveaux de zoom faibles, les graduations passent à 1 s, 5 s, 10 s — la précision 100 ms n'est visible qu'en zoom fort. Les traits de graduation sont des `<line>`, les labels des `<text>`.
- Événements : pointerdown → `controller.seek(ms)` (valeur arrondie à 100 ms)

**`TrackLabelList`**

- Entrées : `scene.tracks` (arbre), `selection.trackId`
- Rendu : DOM. Arbre collapsible. Bouton visibilité. Drag pour réordonnancement.
- Événements : click → `controller.selectTrack`, toggle → `controller.toggleVisibility`, drag-drop → `controller.moveTrack`

**`TimelineArea`**

Zone principale. Conteneur DOM avec scroll vertical virtuel. Contient une `TrackRow` par nœud visible de l'arbre.

- Entrées : `scene.tracks`, `viewport`, `playheadMs`, `snapGrid`, `selection`
- Rendu : DOM (voir §5.4 et §5.5 pour la virtualisation)
- Gestion des gestes : pan (pointer sur fond), zoom (wheel), drag keyframe, draw window
- Contient un `<svg>` overlay full-area pour le playhead et les guides de snap

**`TrackRow`** (par track)

- Entrées : `track`, `viewport`, `selection`, `capsuleGuidance?`
- Rendu : DOM. Élément `<div>` de hauteur fixe positionnée selon son index virtuel.
- La fenêtre active (zone entre intro et outro) est un `<div>` positionné en `position: absolute` sur l'axe X, calculé depuis `viewport`
- Les keyframe handles sont des éléments SVG enfants (`<svg>` inline dans la row)

**`KeyframeHandle`**

- Entrée : `keyframe`, `positionPx`, `isSelected`
- SVG `<polygon>` (losange). Sélectionné → couleur d'accentuation.
- `pointerdown` → `DRAG.START_KEYFRAME`

**`PlayheadLine`**

- Entrée : `playheadMs`, `viewport`
- SVG overlay full-height, `pointer-events: none`. Ligne verticale `<line>` + tête de lecture `<polygon>`.

**`WaveformRow`**

- Entrée : `scene.audio`, `viewport`
- Rendu : **Canvas 2D** — justification : rendu pixel-par-pixel du signal audio, impossible en SVG de façon performante. C'est la seule exception documentée à la règle SVG (voir §1.7).
- La row est présente dès que `scene.audio` est défini, même sans `waveform` (fond neutre affiché).
- Le Canvas est redimensionné et redessiné à chaque changement de `viewport` (zoom, pan, resize). Les valeurs `min[]` / `max[]` de `WaveformDataV1` sont projetées sur l'axe X selon `pixelsPerMs`.
- Hauteur fixe : `var(--seq-waveform-h, 48px)` — ajouté à `LayoutProfile` (`rowHeightWaveform`).
- La piste audio **ne fait pas partie de l'arbre `tracks`** — c'est une row spéciale affichée sous la règle, au-dessus des tracks éléments (ou en bas, selon le choix UI final).

**`CueRow`**

- Entrée : `scene.cues`, `viewport`
- Rendu : SVG. Segments proportionnels à la durée du cue (`<rect>` + `<text>`) sur axe linéaire. Magnétisme passif : les handles de keyframes s'y accrochent pendant le drag.

**`MarkerRow`**

- Entrée : `scene.markers`, `viewport`
- Rendu : SVG. Marqueurs draggables (`<line>` + `<polygon>`). Double-clic sur label pour nommer.

### 5.3 Gestion des gestes

Tous les gestes passent par des **event handlers purs** attachés à la zone temporelle. Ils envoient des events à la machine via le contrôleur. Pas de state local pour les gestes.

```
pointerdown sur fond    → VIEWPORT.PAN_START ou WINDOW.START_DRAW (selon context)
pointerdown sur kf      → DRAG.START_KEYFRAME
pointermove (global)    → DRAG.MOVE / VIEWPORT.PAN_MOVE / WINDOW.DRAW_MOVE
pointerup   (global)    → DRAG.END / VIEWPORT.PAN_END / WINDOW.DRAW_END
wheel                   → VIEWPORT.ZOOM (factor dérivé de deltaY, focus sur pointerMs)
```

Le snap s'applique dans `DRAG.MOVE` via la garde `snapThresholdReached` : la machine maintient la position "snappée" dans `interaction.currentMs`.

### 5.4 Stratégie de rendu

**Ordre de préférence pour les éléments graphiques** :

1. **HTML** — pour tout ce qui est contrôle, label, texte éditable, bouton, scroll natif
2. **SVG** — pour tout élément graphique non textuel : règle, keyframe handles, playhead, segments de cues, marqueurs, fenêtres intro/outro, fond de track
3. **Canvas 2D** — réservé au rendu de **données de signal** (waveform audio) qui exige un accès pixel-par-pixel et ne bénéficie pas du modèle objet SVG

Cette hiérarchie tient pour la v1. Une librairie de rendu SVG peut être employée si elle facilite la gestion des mises à jour (ex. D3 pour les axes, ou un wrapper SVG réactif léger) — à décider à la phase implémentation.

| Zone | Technologie | Justification |
|---|---|---|
| Labels tracks, contrôles | HTML | natif, accessible |
| Règle temporelle | SVG | `<line>`, `<text>`, redimensionnable sans redraw |
| Fond de track + fenêtre active | DOM `<div>` | scroll virtuel natif, layout CSS |
| Keyframe handles | SVG `<polygon>` inline dans la row | hit-testing natif, draggable |
| Playhead | SVG overlay | full-height, pointer-events none |
| Segments cues, marqueurs | SVG | formes simples, labels |
| Waveform audio (`WaveformRow`) | Canvas 2D | seule exception — rendu pixel du signal min/max |

### 5.5 Virtualisation de l'axe Y

Le scroll virtuel est **toujours actif** — il n'y a pas de seuil de bascule. La liste de tracks est rendue comme une fenêtre glissante sur un conteneur de hauteur totale calculée, dès la première track.

**Hauteurs de row** — lues depuis `LayoutProfile` (voir §1.3), valeurs desktop par défaut :

| Type de row | Desktop | Touch (iPad) |
|---|---|---|
| Track élément | 28 px | 44 px |
| Header capsule | 24 px | 36 px |
| Piste cues (`full-sequence`) | 32 px | 32 px |
| Piste cues (`text-priority`) | 80 px | 80 px |
| Piste markers | 20 px | 28 px |

> Ces valeurs ne sont **jamais codées en dur** dans le rendu ou la machine — elles sont lues depuis `context.layoutProfile`.

La hauteur totale du conteneur virtuel = somme des hauteurs des rows visibles (les enfants d'une capsule repliée ne comptent pas). Le scroll Y est géré par `viewport.scrollOffsetPx` dans le contexte de la machine.

**Buffer de rendu** : 3 rows au-dessus et en-dessous de la zone visible sont maintenues dans le DOM pour éviter le flash lors du scroll.

### 5.6 Mode de vue

Deux modes pilotés par `viewport.viewMode` :

**`full-sequence`** : zoom adapté pour voir la totalité de la durée. Hauteur des rows uniforme. La piste cues est compressée (1 ligne).

**`text-priority`** : les cues textuels ont une hauteur étendue (lisibilité). Le zoom est réduit si nécessaire pour montrer la totalité. Les tracks éléments sont compressés (hauteur minimale).

La bascule envoie `VIEWPORT.SET_MODE` → la machine recalcule `pixelsPerMs` et `startMs` pour garantir la vue totale.

---

## 6. Plans d'implémentation

### Phase 1 — Domaine et types

**Objectif** : `types.ts` compilable avec toutes les interfaces définies + fixtures JSON de test.

Tâches :
- [ ] Définir tous les types TypeScript (`EditorScene`, `TrackNode`, `Keyframe`, `EditorDecor`, `TransitionDef`, `TextCue`, `AuthorMarker`, `SnapPoint`, `SequenceEditorContext`, `LayoutProfile`, events)
- [ ] Écrire `constants.ts` : `ZOOM_MIN/MAX/DEFAULT_PX_PER_SEC`, `RULER_GRADUATION_LEVELS_MS`, `MIN_GRADUATION_GAP_PX`, `VIRTUAL_SCROLL_BUFFER_ROWS`, `TIME_STEP_MS`, `DEFAULT_TRANSITION_DURATION_MS`, `DEFAULT_EASING`
- [ ] Écrire `layout-profile.ts` : `LAYOUT_DESKTOP`, `LAYOUT_TOUCH`
- [ ] Écrire 3 fixtures JSON (`scene-empty.json`, `scene-one-track.json`, `scene-nested-capsule.json`)
- [ ] Écrire les fonctions pures utilitaires : `findTrackById`, `insertKeyframeSorted`, `resolveEffectiveWindow`, `computeSnapGrid`

**Critère de sortie** : `tsc --noEmit` passe, les fixtures sont valides contre les types.

---

### Phase 2 — Prototype UI

**Objectif** : valider l'usage et détecter les obstacles d'implémentation avant d'investir dans la machine complète.

Le prototype est une **maquette interactive partielle** : la grille s'affiche et deux interactions fonctionnent réellement — le déplacement de la tête de lecture et le placement d'un keyframe. Toutes les autres commandes émettent un `console.log` et ne modifient pas l'état.

#### 2.1 Stub contrôleur

Un `StubSequenceEditorController` remplace temporairement la vraie classe contrôleur. Il tient son état dans un objet JS ordinaire (pas de XState) et expose la même interface publique que `SequenceEditorController`.

Seules deux commandes sont implémentées :
- `seek(timeMs)` — met à jour `playheadMs`, notifie les abonnés
- `addKeyframe(trackId, timeMs)` — insère un keyframe trié dans le track, clone le `decorId` du voisin, notifie les abonnés

Toutes les autres commandes (`moveKeyframe`, `zoom`, `pan`, `selectTrack`, `attachMarker`…) font :
```
console.log('[stub] commande ignorée :', { command, args })
```

Le stub expose `subscribe` / `getSnapshot` / `serialize` de la même façon que le vrai contrôleur.

#### 2.2 Scène de référence

La scène source est **`scene-02.ts`** d'Eddy (capsule liste, items text/image/text, durée 5000 ms, 5 eventtimes). Elle est adaptée manuellement en `EditorScene` JSON et placée dans `packages/editor/src/sequence-editor/fixtures/scene-eddy-ref.json`.

Structure cible de la fixture :

```
EditorScene
  durationMs: 8000
  tracks:
    capsule "conteneur" (kind: capsule, capsuleType: liste)
      element "titre"   (kind: element, contentType: text)   — 2 kf: intro t=0, outro t=7500
      element "image"   (kind: element, contentType: image)  — 2 kf: intro t=500, outro t=6000
      element "légende" (kind: element, contentType: text)   — 2 kf: intro t=1000, outro t=7000
  cues: 4 cues textuels (t=0, t=1500, t=3500, t=6000) — simulés, pas de Whisper
  markers: 1 marker auteur à t=3500
  audio: { id: "audio-01", label: "Voix off", srcUrl: "/fixtures/voice.mp3", durationMs: 8000 }
          — waveform absente dans la fixture (non calculée) ; la row s'affiche sans signal
```

Cette fixture couvre intentionnellement : imbrication capsule/éléments, intro/outro sur chaque track, cues et marker, durée non triviale.

#### 2.3 Périmètre du rendu

Tous les composants décrits en §5 sont présents visuellement :

| Composant | État dans le prototype |
|---|---|
| `TimeRuler` | affiché, graduation 100 ms / 1 s / 5 s selon zoom fixe |
| `TrackLabelList` | affiché, noms visibles, pas de drag |
| `TimelineArea` | affiché, scroll Y fonctionnel |
| `TrackRow` | affiché, fenêtre intro/outro visible |
| `KeyframeHandle` | affiché + **cliquable** (placement via click sur la row) |
| `PlayheadLine` | affiché + **déplaçable** (click sur la règle → seek) |
| `WaveformRow` | affichée si `scene.audio` présent — fond neutre sans signal (waveform non calculée) |
| `CueRow` | affichée, segments visibles, pas de snap |
| `MarkerRow` | affichée, markers visibles, pas de drag |
| Panel décor | absent |

Le zoom et le pan sont désactivés (valeurs fixes dans le snapshot du stub).

#### 2.4 Critère de sortie

1. La scène de référence s'affiche correctement dans `npm run dev:editor`
2. Cliquer sur la règle déplace la tête de lecture
3. Cliquer sur une `TrackRow` à un instant T ajoute un keyframe visible
4. Toute autre interaction produit un log console sans erreur
5. Le prototype est testé avec `LAYOUT_TOUCH` activé manuellement : les cibles sont utilisables à 44 px sur une fenêtre simulant un iPad (~1024 px de large)
6. Un **document d'observations** est rédigé (`packages/editor/src/sequence-editor/fixtures/prototype-observations.md`) listant les obstacles identifiés : ambiguïtés de layout, lisibilité sur petit écran, interactions manquantes non anticipées, questions sur la spec — en particulier la question de la modalité d'accrochage (explicite vs. implicite au drop)

---

### Phase 3 — Machine XState

**Objectif** : machine testable sans rendu.

Tâches :
- [ ] Implémenter la machine avec les états `idle`, `playing`, `panning`, `dragging-keyframe`, `drawing-window`
- [ ] Implémenter toutes les actions pures du contexte
- [ ] Implémenter les guards `canCommitDrag`, `snapThresholdReached`
- [ ] Tests unitaires Vitest sur les transitions d'état clés :
  - add/remove keyframe
  - drag start → move (avec snap) → end → keyframe déplacé
  - window draw → intro/outro assignés
  - zoom centré sur focusMs
  - pan start → move → end → viewport déplacé

**Critère de sortie** : tests Vitest passent.

---

### Phase 4 — Classe contrôleur

**Objectif** : `SequenceEditorController` utilisable sans framework.

Tâches :
- [ ] Implémenter la classe avec le wrapping de l'acteur
- [ ] Implémenter `subscribe` / `getSnapshot`
- [ ] Implémenter les utilitaires de conversion `msToPixel`, `pixelToMs`, `snapToGrid`
- [ ] Implémenter `serialize` / `deserialize` (roundtrip exact sur les fixtures)
- [ ] Tests d'intégration : instanciation → commandes → vérification snapshot

**Critère de sortie** : roundtrip JSON exact sur les 3 fixtures, tests passent.

---

### Phase 5 — Rendu de base (règle + tracks)

**Objectif** : remplacer le rendu approximatif du prototype par les vrais composants branchés sur le contrôleur réel.

Tâches :
- [ ] `TimeRuler` : SVG, graduations adaptatives (100 ms / 1 s / 5 s / 10 s)
- [ ] `TrackLabelList` : DOM, arbre plat, sans drag encore
- [ ] `TrackRow` : DOM + SVG inline, fenêtre intro/outro, keyframes
- [ ] `PlayheadLine` : SVG overlay
- [ ] Brancher le vrai contrôleur (Phase 4) sur la scène `scene-eddy-ref.json`
- [ ] Intégrer les observations du prototype (§2.4) : corriger les obstacles identifiés

**Critère de sortie** : `scene-eddy-ref.json` s'affiche avec le vrai contrôleur, playhead déplaçable, keyframes visibles.

---

### Phase 6 — Interactions

**Objectif** : grille pleinement interactive.

Tâches :
- [ ] Pan (pointermove sur fond)
- [ ] Zoom (wheel avec focus)
- [ ] Drag keyframe avec snap
- [ ] Window draw (intro/outro)
- [ ] Sélection track / keyframe
- [ ] Bascule de mode de vue (full-sequence ↔ text-priority)

**Critère de sortie** : scénario complet utilisable : charger scène → zoomer → déplacer un keyframe → assigner intro/outro.

---

### Phase 7 — Intégration panel décor (externe)

**Objectif** : valider le contrat `registerDecor` / `getDecorData` avec un panel externe minimal.

La grille n'implémente pas de panel décor. Elle expose uniquement le point d'ancrage :
- `controller.registerDecor(id, data)` — le panel écrit
- `controller.getDecorData(id)` — le panel lit
- `controller.subscribe(...)` — le panel se resynchronise quand la sélection change (snapshot → `selection.keyframeId` → `track.keyframes[n].decorId`)

Tâches :
- [ ] Écrire un panel de test minimal (hors grille) : sélectionner un kf → lire `data` → modifier un champ → `registerDecor` → vérifier dans `serialize()`
- [ ] Valider que la machine émet correctement `DECOR.REGISTER` sans perturber les autres états
- [ ] Tester la suppression d'un kf : le decor est bien retiré du registre si non partagé

**Critère de sortie** : roundtrip complet — panel écrit `data`, `serialize()` le restitue intact.

---

### Phase 8 — Cues et magnétisme

**Objectif** : piste cues fonctionnelle avec snap.

Tâches :
- [ ] `CueRow` avec rendu proportionnel linéaire
- [ ] `MarkerRow` avec ajout/déplacement/suppression
- [ ] Snap actif pendant drag keyframe (seuil 8px)
- [ ] Liaison keyframe nommé ↔ marker : déplacer le marker déplace les keyframes accrochés

**Critère de sortie** : drag d'un keyframe nommé s'accroche et se déplace avec son marker.

---

### Phase 9 — API authoring (futur)

Extraction des commandes métier API vers `packages/authoring`, sans modifier l'interface externe de `SequenceEditorController`. Cette phase est **hors scope** de ce document.

---

## 7. Questions résolues

| # | Décision |
|---|---|
| Q1 | Exclusivité `transitionIn` / `transitionOut` : l'UI interdit la coexistence — suppression obligatoire avant création. Aucune logique de priorité dans le modèle. |
| Q2 | `TimelineArea` et `TrackRow` : DOM. Les éléments graphiques (handles, fenêtres) restent SVG inline. |
| Q3 | Virtualisation Y toujours active. Hauteurs fixes : élément 28 px, capsule header 24 px, cues 32/80 px, markers 20 px. Buffer 3 rows. `scrollOffsetPx` dans le contexte machine. |
| Q4 | `Keyframe.markerId` stocke la référence. Accrochage/décrochage explicites. `MARKER.MOVE` propage à tous les kf accrochés. Suppression du marker détache (conserve `timeMs`). |
| Q5 | `addKeyframe` clone le `decorId` du voisin le plus proche. Copy-on-write à la modification : responsabilité de l'éditeur de décors (hors périmètre). |
