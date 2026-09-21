# Avatar V2 — guide auteur

Ce guide indique quoi déclarer et quels événements envoyer pour obtenir une
réaction de l'avatar.

Avatar V2 est composé d'un avatar central et de composants optionnels :

| Vous voulez… | Vous utilisez… | Vous envoyez… |
| --- | --- | --- |
| afficher un modèle | `avatar` | rien |
| jouer une animation liée au modèle | `avatar-motion` | `avatar:motion:<nom>` |
| changer son expression | `avatar-mood` | `avatar:mood:<nom>` |
| synchroniser sa bouche | `avatar-lip-sync` | `avatar:viseme` avec un visème |
| lui faire un geste | `avatar-gesture` | `avatar:gesture:<nom>` |
| le présenter au repos | `avatar-idle` | rien |
| lui faire suivre la caméra | `avatar-gaze` | `avatar:gaze:on` ou `avatar:gaze:off` |

Les composants Avatar sont logiques : ils ne reçoivent pas `move`. Seul le
`three-scene-host` possède le canvas et est placé dans la page. Les composants
Avatar se rattachent à lui avec `rel.host` et au composant `avatar` avec
`rel.target`.

## Installation

L'application enregistre le support Three.js, les composants Avatar et les
stratégies de preload des ressources binaires :

```ts
import {
  AVATAR_ENGINE,
  THREEJS_CORE_ENGINE,
  THREE_PRELOAD_STRATEGIES,
} from '@codplay/component-v2'

const engine = {
  ...THREEJS_CORE_ENGINE,
  components: {
    register: [
      ...(THREEJS_CORE_ENGINE.components?.register ?? []),
      ...(AVATAR_ENGINE.components?.register ?? []),
    ],
  },
}

const preload = {
  strategies: THREE_PRELOAD_STRATEGIES,
}

const preloadManifest = {
  entries: [
    {
      url: '/avatars/hero.glb',
      type: 'three-glb',
      policy: { cache: 'default', priority: 'high' },
    },
    {
      url: '/avatars/hero-walk.fbx',
      type: 'three-fbx',
      policy: { cache: 'default', priority: 'normal' },
    },
    {
      url: '/avatars/hero-bow.glb',
      type: 'three-glb',
      policy: { cache: 'default', priority: 'normal' },
    },
  ],
}
```

Les URLs de `avatar.initial.src` et de chaque `avatar.initial.animations.*.src`
doivent être exactement celles déclarées dans le manifeste. Une animation ne
doit donc pas être chargée au moment où un événement la réclame.

## Déclarer un avatar

Dans CodPlay, `avatar` est un perso logique de la scène : `id` identifie ce
perso et `type: 'avatar'` lui donne la capacité de charger et piloter un
modèle. Ce perso est distinct du perso `three-scene-host`, qui possède le
support Three et l'affichage. `three-host` est l'identifiant de ce host et
`avatar1` celui du perso Avatar que les autres composants vont piloter.

```ts
const hostId = 'three-host'
const avatarId = 'avatar1'

const avatar = {
  id: avatarId,
  type: 'avatar',
  initial: {
    rel: { host: hostId },
    src: '/avatars/hero.glb',
    mood: 'neutral',
    animations: {
      walk: {
        src: '/avatars/hero-walk.fbx',
        format: 'fbx',
        mode: 'animation',
      },
    },
  },
  actions: {},
}
```

Propriétés de `avatar` :

| Propriété | Rôle |
| --- | --- |
| `src` | URL du modèle GLB préparé. Obligatoire. |
| `mood` | Expression présente dès l'affichage. `neutral` par défaut. |
| `morphPrefix` | Préfixe des morphs du modèle, uniquement si le modèle en utilise un. |
| `retarget` | Ajustements propres à un modèle dont le squelette doit être adapté. |
| `modelRotationY` | Rotation initiale autour de l'axe vertical, en radians. |
| `position` | Position locale initiale du modèle dans le host Three. |
| `animations` | Ressources d'animation nommées et liées à cet avatar. Elles sont préchargées par Three.js. |

Les composants qui ajoutent un comportement utilisent cette relation :

```ts
rel: { host: hostId, target: avatarId }
```

`target` désigne l'avatar, jamais un mesh, un os ou un morph du GLB.

## Ajouter les comportements

Il faut ajouter uniquement les composants nécessaires. Le bloc suivant active
les six comportements disponibles autour de l'avatar :

```ts
const avatarMood = {
  id: 'avatar-mood',
  type: 'avatar-mood',
  initial: {
    rel: { host: hostId, target: avatarId },
    mood: 'neutral',
  },
  actions: {
    'avatar:mood:happy': {},
    'avatar:mood:neutral': {},
  },
}

const avatarMotion = {
  id: 'avatar-motion',
  type: 'avatar-motion',
  initial: {
    rel: { host: hostId, target: avatarId },
    motion: null,
    speed: 1,
  },
  actions: {
    'avatar:motion:walk': {},
    'avatar:motion:release': {},
  },
}

const avatarLipSync = {
  // L'identifiant porte l'auto-action qui recevra les données du visème.
  id: 'avatar:viseme',
  type: 'avatar-lip-sync',
  initial: {
    rel: { host: hostId, target: avatarId },
    viseme: null,
  },
  actions: {},
}

const avatarGesture = {
  id: 'avatar-gesture',
  type: 'avatar-gesture',
  initial: {
    rel: { host: hostId, target: avatarId },
    gesture: null,
  },
  actions: {
    'avatar:gesture:wave_right': {},
    'avatar:gesture:release': {},
  },
}

const avatarIdle = {
  id: 'avatar-idle',
  type: 'avatar-idle',
  initial: {
    rel: { host: hostId, target: avatarId },
    pose: 'neutral',
    blink: true,
    breathe: true,
    headDrift: true,
  },
  actions: {},
}

const avatarGaze = {
  id: 'avatar-gaze',
  type: 'avatar-gaze',
  initial: {
    rel: { host: hostId, target: avatarId },
    enabled: true,
    contact: 1,
  },
  actions: {
    'avatar:gaze:on': {},
    'avatar:gaze:off': {},
  },
}
```

## Envoyer les événements

Les événements sont des eventimes ordinaires. `startAt` est exprimé en
millisecondes depuis le début de la scène.

```ts
const eventimes = [
  { name: 'avatar:motion:walk', startAt: 1_000 },
  { name: 'avatar:mood:happy', startAt: 2_000 },
  {
    name: 'avatar:viseme',
    startAt: 2_400,
    data: { viseme: 'aa' },
  },
  { name: 'avatar:gesture:wave_right', startAt: 3_000 },
  { name: 'avatar:gesture:release', startAt: 5_000 },
  { name: 'avatar:gaze:off', startAt: 6_000, data: { durationMs: 600 } },
  { name: 'avatar:gaze:on', startAt: 8_000, data: { durationMs: 600 } },
]
```

Le nom de l'action porte le choix stable. Les données ne portent que les
valeurs qui varient d'une occurrence à l'autre.

## Animations liées au modèle : `avatar-motion`

Le composant central `avatar` charge les ressources déclarées dans
`initial.animations`. `avatar-motion` choisit ensuite une ressource par son nom
et la joue sur le squelette de cet avatar. L'auteur ne manipule ni scène,
`AnimationMixer`, os ni clip Three.js.

Déclarez les ressources sur `avatar` :

```ts
initial: {
  rel: { host: hostId },
  src: '/avatars/hero.glb',
  animations: {
    walk: {
      src: '/avatars/hero-walk.fbx',
      format: 'fbx',
      mode: 'animation',
    },
    bow: {
      src: '/avatars/hero-bow.glb',
      format: 'glb',
      clip: 'Bow',
      mode: 'pose',
    },
  },
}
```

| Propriété d'une ressource | Effet |
| --- | --- |
| `src` | URL du fichier binaire déclaré dans le preload. Obligatoire. |
| `format` | `glb` ou `fbx`. Si absent, `.fbx` est détecté ; les autres URLs sont traitées comme GLB. |
| `clip` | Nom du clip ou index à utiliser lorsqu'un fichier en contient plusieurs. |
| `mode` | `animation` boucle par défaut ; `pose` conserve la dernière frame. |
| `scale` | Facteur optionnel appliqué aux translations du clip. Les translations FBX utilisent `0.01` par défaut. |

Puis déclarez les actions réellement utilisées par la scène :

```ts
const avatarMotion = {
  id: 'avatar-motion',
  type: 'avatar-motion',
  initial: {
    rel: { host: hostId, target: avatarId },
  },
  actions: {
    'avatar:motion:walk': {},
    'avatar:motion:bow': {},
    'avatar:motion:release': {},
  },
}

const eventimes = [
  { name: 'avatar:motion:walk', startAt: 1_000 },
  {
    name: 'avatar:motion:bow',
    startAt: 4_000,
    data: { speed: 0.8, loop: false },
  },
  { name: 'avatar:motion:release', startAt: 6_000, data: { durationMs: 400 } },
]
```

| Propriété | Effet |
| --- | --- |
| `motion` | Nom de la ressource jouée au démarrage, ou `null`. |
| `speed` | Vitesse par défaut. `1` est la vitesse normale. |
| `loop` | Boucle par défaut pour les événements. |
| `data.speed` | Vitesse de cette occurrence uniquement. |
| `data.loop` | Boucle de cette occurrence uniquement. |
| `data.durationMs` | Durée de la transition vers la pose Avatar lors d'un `release`. |

Le mode de la ressource fournit la valeur par défaut de `loop` :

- `mode: 'animation'` boucle par défaut ;
- `mode: 'pose'` joue une fois et conserve la dernière frame.

`avatar:motion:release` rend progressivement la pose aux autres composants
Avatar (`avatar-gesture`, `avatar-idle`, `avatar-mood`, etc.) tout en
conservant la position atteinte. La transition dure 400 ms par défaut ;
`data.durationMs` permet de choisir une autre durée pour cette occurrence.
Elle utilise une interpolation rapide au début et ralentie à la fin. La
timeline CodPlay et le `startAt` de l'event ne sont pas modifiés. Les formats
`glb` et `fbx` sont acceptés. Le clip doit utiliser un squelette compatible
avec le modèle ; les noms d'os Mixamo usuels et leurs unités sont adaptés par
le composant.

## Expressions : `avatar-mood`

Déclarez les actions correspondant aux expressions que la scène peut utiliser,
puis envoyez l'action voulue :

```ts
actions: {
  'avatar:mood:happy': {},
  'avatar:mood:sad': {},
}

{ name: 'avatar:mood:sad', startAt: 4_000, data: { durationMs: 700 } }
```

Expressions disponibles :

```text
neutral  happy  angry  sad  fear  disgust  love  sleep
thinking  nervous  shy  listen  smirk  grimace  pleading  sleeping
frown  squint  curious
```

`durationMs` est facultatif. Sans cette donnée, l'expression change
immédiatement. Avec cette donnée, la transition dure le temps indiqué.

Pour déclarer toutes les expressions sans recopier la liste :

```ts
import { AVATAR_MOOD_MOTION_NAMES } from '@codplay/component-v2'

const moodActions = Object.fromEntries(
  AVATAR_MOOD_MOTION_NAMES.map((name) => [`avatar:mood:${name}`, {}]),
)
```

## Parole : `avatar-lip-sync`

Chaque événement de visème est ponctuel. Le composant transforme le visème en
forme de bouche et effectue la transition depuis la forme précédente.

```ts
{
  name: 'avatar:viseme',
  startAt: 1_250,
  data: { viseme: 'TH' },
}
```

Visèmes acceptés :

```text
PP  FF  TH  DD  kk  CH  SS  nn  RR  aa  E  I  O  U  sil
```

Ce sont des noms de formes de bouche, pas une transcription phonétique stricte.
Un même visème couvre plusieurs sons proches, et l'interprétation exacte peut
varier selon la langue :

| Visème | Sons indicatifs | Forme de bouche |
| --- | --- | --- |
| `PP` | p, b, m | lèvres fermées ou sur le point de se fermer |
| `FF` | f, v | lèvre inférieure contre les incisives |
| `TH` | th voisés ou non voisés en anglais | langue entre ou contre les incisives |
| `DD` | t, d | pointe de la langue derrière les incisives |
| `kk` | k, g | arrière de la langue relevé |
| `CH` | ch, j, tch | lèvres resserrées et légèrement arrondies |
| `SS` | s, z | bouche étirée, passage d'air étroit |
| `nn` | n et sons nasaux proches | langue en position alvéolaire, bouche peu ouverte |
| `RR` | r | configuration rhotique, lèvres légèrement arrondies |
| `aa` | a ouvert | bouche largement ouverte |
| `E` | é, è, e | ouverture moyenne, lèvres étirées |
| `I` | i, y | lèvres étirées, ouverture faible |
| `O` | o ouvert ou moyen | lèvres arrondies, ouverture moyenne à large |
| `U` | ou, u fermé selon la langue | lèvres fortement arrondies, ouverture faible |
| `sil` | silence, pause | retour à la position neutre |

Ces labels correspondent aux morphs `viseme_<label>` attendus par l'avatar.
Ils décrivent une cible visuelle : le composant ne déduit pas le visème à
partir du texte ou de l'audio.

`weight` contrôle facultativement l'intensité et vaut `1` par défaut.
`durationMs` contrôle facultativement la durée de la transition ; sans cette
donnée, le visème est appliqué immédiatement. Pour un alignement qui fournit
`start` et `end`, envoyez `start` comme `startAt` et `end - start` comme
`durationMs`.

Exemple avec ces deux options :

```ts
{
  name: 'avatar:viseme',
  startAt: 1_250,
  data: { viseme: 'TH', weight: 0.7, durationMs: 90 },
}
```

La conversion d'un autre vocabulaire de visèmes doit être faite avant la
construction des eventimes. L'avatar ne reçoit pas de texte ni de fichier
audio : il reçoit les visèmes déjà traduits. L'audio reste un composant
`media` séparé et doit partager la même timeline.

Pour fermer la bouche, envoyez `sil` :

```ts
{ name: 'avatar:viseme', startAt: 1_500, data: { viseme: 'sil' } }
```

## Gestes : `avatar-gesture`

Un geste est choisi par le nom de l'action :

```ts
{ name: 'avatar:gesture:wave_right', startAt: 3_000 }
{ name: 'avatar:gesture:release', startAt: 5_000 }
```

`release` rend les axes contrôlés à la pose active. Une occurrence peut
modifier la durée ou le hasard déterministe :

```ts
{
  name: 'avatar:gesture:celebrate',
  startAt: 7_000,
  data: { durationMs: 1_800, seed: 42 },
}
```

Le catalogue de motions disponible dans `avatar-gesture` est :

```text
wave_right       wave_left        thumbup_right    thumbdown_right
point            ok_wink          shrug_confused   namaste_bow
nod_yes          shake_no         look_up          look_down
bow              jump             celebrate        turn_around
surprised        wink             laugh            yawn
applause         dance            facepalm         excited
dismiss          tongueout        kiss             eyeroll
sigh             raise_eyebrows   open_mouth       cheek_puff
close_eyes       look_left        look_right       head_circles
shiver           chew             deep_breath      vibrate
neutral_face     smug             slight_smile     warm_smile
grin             open_grin        squint_smile     beam
laugh_closed     tongue_out       crying_laugh     wink_smile
sobbing          puppy_eyes       disappointed     pensive
flushed          sad_frown        kiss_eyes_closed blow_kiss
adoring          heart_eyes       rage             unamused
scream           grimace_teeth    thinking_face    side_glance
zzz              hand_raise       hand_raise_left  thumbs_up
thumbs_down      ok_sign          shrug_both       pray
nod              head_shake
```

Les gestes courts suivants sont aussi disponibles :

```text
handup  index  point  ok  thumbup  thumbdown  side  shrug  namaste
```

Pour déclarer tout le catalogue dans un composant :

```ts
import { AVATAR_GESTURE_MOTION_NAMES } from '@codplay/component-v2'

const gestureActions = Object.fromEntries([
  ...AVATAR_GESTURE_MOTION_NAMES,
  'handup', 'index', 'point', 'ok', 'thumbup',
  'thumbdown', 'side', 'shrug', 'namaste', 'release',
].map((name) => [`avatar:gesture:${name}`, {}]))
```

## Présentation spontanée : `avatar-idle`

Ce composant ne reçoit pas d'événement. Il suffit de régler ses propriétés
initiales :

```ts
initial: {
  rel: { host: hostId, target: avatarId },
  pose: 'neutral',
  blink: true,
  breathe: true,
  headDrift: true,
}
```

| Propriété | Effet | Valeur par défaut |
| --- | --- | --- |
| `pose` | Pose corporelle de départ et pose de retour des gestes | `neutral` |
| `blink` | Clignements spontanés | `true` |
| `blinkSeed` | Reproductibilité du rythme des clignements | dérivé de l'identifiant |
| `breathe` | Respiration naturelle du torse et du visage, sans allonger le corps | `true` |
| `headDrift` | Léger balancement de la tête et du corps | `true` |

Poses disponibles : `neutral`, `straight` (alias), `side`, `hip`, `turn` et `wide`.

## Contact visuel : `avatar-gaze`

Pour que l'avatar suive la caméra dès son apparition :

```ts
initial: {
  rel: { host: hostId, target: avatarId },
  enabled: true,
  contact: 1,
}
```

`contact` est compris entre `0` et `1` : `0` désactive la correction et `1`
demande le contact complet. La tête et les yeux se répartissent le mouvement
et restent dans leurs limites naturelles ; l'avatar ne force pas une rotation
impossible.

Pour activer ou désactiver le contact pendant la scène :

```ts
{ name: 'avatar:gaze:off', startAt: 5_000 }
{ name: 'avatar:gaze:on', startAt: 8_000, data: { contact: 0.7 } }
```

`durationMs` permet une transition progressive :

```ts
{
  name: 'avatar:gaze:off',
  startAt: 5_000,
  data: { durationMs: 600 },
}
```

Le composant utilise la caméra courante du host. Il ne faut donc pas lui
envoyer une caméra ou une référence Three.js.

## Exemple de scène complet

```ts
const scene = {
  id: 'avatar-scene',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'three-host',
          type: 'three-scene-host',
          initial: {
            move: '@root',
            width: 720,
            height: 720,
          },
          actions: {},
        },
        avatar,
        avatarMotion,
        avatarMood,
        avatarLipSync,
        avatarGesture,
        avatarIdle,
        avatarGaze,
      ],
      eventimes: [
        { name: 'avatar:mood:happy', startAt: 2_000 },
        { name: 'avatar:gesture:wave_right', startAt: 3_000 },
        { name: 'avatar:gesture:release', startAt: 5_000 },
        { name: 'avatar:gaze:off', startAt: 6_000, data: { durationMs: 600 } },
        {
          name: 'avatar:viseme',
          startAt: 6_800,
          data: { viseme: 'aa' },
        },
        { name: 'avatar:gaze:on', startAt: 8_000 },
      ],
    },
  },
}
```

## Types publics

Les types correspondent aux propriétés des déclarations :

```ts
import type {
  AvatarAnimationFormat,
  AvatarAnimationSource,
  AvatarGestureAction,
  AvatarGestureInitial,
  AvatarGazeAction,
  AvatarGazeInitial,
  AvatarIdleInitial,
  AvatarInitial,
  AvatarLipSyncAction,
  AvatarLipSyncInitial,
  AvatarMoodAction,
  AvatarMoodInitial,
  AvatarMotionAction,
  AvatarMotionInitial,
} from '@codplay/component-v2'
```

Utilisez les constantes suivantes pour construire les déclarations sans
recopier les catalogues :

```ts
import {
  AVATAR_GESTURE_MOTION_NAMES,
  AVATAR_MOOD_MOTION_NAMES,
} from '@codplay/component-v2'
```

La scène envoie toujours des événements et des données auteur. Elle ne doit
jamais envoyer de morph target, de nom d'os, d'objet Three.js ou de référence
au modèle interne.
