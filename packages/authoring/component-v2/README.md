# Composants Three.js V2

Ce package fournit les composants génériques nécessaires à une scène Three.js
V2 : un hôte HTML, une caméra et une lumière. Il fournit aussi des composants
sur mesure, comme `three-instanced-grid`, qui sont enregistrés séparément.

L'engine prépare Three.js avant de créer les composants. Les classes reçoivent
ensuite le runtime préparé ; elles ne chargent pas la bibliothèque et ne
possèdent pas de boucle de rendu privée.

```ts
import { CodPlay } from 'codplay'
import {
  THREE_INSTANCED_GRID_DEFINITION,
  THREEJS_CORE_ENGINE,
} from '@codplay/component-v2'

const engine = {
  ...THREEJS_CORE_ENGINE,
  components: {
    register: [
      ...(THREEJS_CORE_ENGINE.components?.register ?? []),
      THREE_INSTANCED_GRID_DEFINITION,
    ],
  },
}

const codplay = new CodPlay({ engine })
const build = codplay.build({
  scene: {
    id: 'three-grid',
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: 'three-scene',
            type: 'three-scene-host',
            initial: { move: '@root', width: 640, height: 480 },
          },
          {
            id: 'camera',
            type: 'three-camera',
            initial: {
              rel: { host: 'three-scene' },
              position: [0, 0, 6],
            },
          },
          {
            id: 'light',
            type: 'three-light',
            initial: {
              rel: { host: 'three-scene' },
              kind: 'ambient',
              intensity: 1,
            },
          },
          {
            id: 'grid',
            type: 'three-instanced-grid',
            initial: {
              rel: { host: 'three-scene' },
              gridSize: 4,
            },
            actions: { start: { animate: true } },
          },
        ],
        eventimes: [{ name: 'start', startAt: 0 }],
      },
    },
  },
})

if (!build.ok) throw new Error('The scene is invalid.')

await codplay.engine.prepareScene(build.compiledScene)
const instance = codplay.instances.create({
  instanceId: 'three-grid-instance',
  compiledScene: build.compiledScene,
  functions: build.functions,
  root: document.querySelector('main')!,
})

await instance.telco.play()
```

La relation `rel.host` relie la caméra, la lumière et la grille au contexte
publié par le host Three. `rel.target` peut ensuite sélectionner une capacité
publiée dans ce contexte. Le host Three est le seul composant matérialisé et
le seul à recevoir `move` ; la scène Three.js et le renderer restent propres à
chaque instance. Pour ajouter un composant sur mesure, consultez
[`src/threejs/README.md`](src/threejs/README.md).

## Avatar

Le module Avatar charge un modèle Three.js dans un host existant. Les
composants spécialisés se rattachent à la capacité publiée par `avatar` avec
`rel: { host, target: 'avatar' }`. Ils ne reçoivent pas `move` et ne demandent
pas à l'auteur de connaître les morph targets du modèle.

Le GLB est préparé par le support Three.js, avec `THREE_PRELOAD_STRATEGIES`
et une entrée de manifeste `type: 'three-glb'`. Avatar consomme ensuite les
octets préparés et utilise le loader GLTF de Three.js pour construire son
instance ; il ne possède pas de fetch ni de cache de modèle séparé.

Le guide complet, les déclarations TypeScript et un exemple réunissant les six
possibilités Avatar sont disponibles dans
[`src/avatar/README.md`](src/avatar/README.md).

`avatar-mood` est l'entrée auteur des expressions faciales. Les morphs sont
une mécanique interne de cette capacité ; aucun composant `avatar-morph`
séparé n'est nécessaire pour choisir un état d'expression. Les entrées
disponibles sont :

| Entrée | Intention auteur |
| --- | --- |
| `neutral` | expression au repos |
| `happy` | expression joyeuse |
| `angry` | expression irritée |
| `sad` | expression triste |
| `fear` | expression inquiète |
| `disgust` | expression de dégoût |
| `love` | expression affectueuse |
| `sleep` | expression endormie |
| `thinking` | expression concentrée |
| `nervous` | tension nerveuse |
| `shy` | expression réservée |
| `listen` | écoute attentive |
| `smirk` | sourire en coin |
| `grimace` | grimace tendue |
| `pleading` | regard suppliant |
| `sleeping` | sommeil paisible |
| `frown` | mécontentement |
| `squint` | regard plissé |
| `curious` | curiosité |

```ts
{
  id: 'avatar-mood',
  type: 'avatar-mood',
  initial: {
    rel: { host: 'avatar-three-host', target: 'avatar' },
    mood: 'neutral',
  },
  actions: {
    'avatar:mood:neutral': {},
    'avatar:mood:happy': {},
    'avatar:mood:angry': {},
    'avatar:mood:sad': {},
    'avatar:mood:fear': {},
    'avatar:mood:disgust': {},
    'avatar:mood:love': {},
    'avatar:mood:sleep': {},
    'avatar:mood:thinking': {},
    'avatar:mood:nervous': {},
    'avatar:mood:shy': {},
    'avatar:mood:listen': {},
    'avatar:mood:smirk': {},
    'avatar:mood:grimace': {},
    'avatar:mood:pleading': {},
    'avatar:mood:sleeping': {},
    'avatar:mood:frown': {},
    'avatar:mood:squint': {},
    'avatar:mood:curious': {},
  },
}

// Un eventime change l'expression sans exposer les morphs internes.
{ name: 'avatar:mood:happy', startAt: 4600, data: { durationMs: 700 } }
```

`durationMs` est facultatif : lorsqu'il est fourni, le composant anime la
transition ; sinon le changement est immédiat. Les autres capacités Avatar
(`avatar-lip-sync`, `avatar-gesture`, `avatar-idle` et `avatar-gaze`) restent
séparées parce qu'elles représentent des familles d'actions différentes.

Le nom de l'action porte les choix stables du perso. Les données d'event sont
réservées aux valeurs qui peuvent changer d'une occurrence à l'autre.

Pour une action dont le contenu est entièrement dynamique, le perso peut
porter directement le nom de l'action. Ainsi, le composant lip-sync peut avoir
`id: 'avatar:viseme'` sans répéter une entrée vide dans `actions` ; la
normalisation lui fournit l'auto-action et transmet les données de chaque
eventime.

`avatar-gesture` pilote une motion complète avec une seule action. Le nom de
l'action choisit la motion ; le composant adapte en interne ses morphes, sa
pose native, son éventuel miroir et ses oscillations. L'auteur ne déclare donc
ni morph target, ni os, ni JSON de motion. L'action `release` reste disponible
pour interrompre un geste natif ou une motion active.

```ts
actions: {
  'avatar:gesture:wave_right': {},
  'avatar:gesture:thinking_face': {},
  'avatar:gesture:release': {},
}

{ name: 'avatar:gesture:wave_right', startAt: 6400 }
{ name: 'avatar:gesture:release', startAt: 9200 }
```

Une occurrence peut fournir `seed` pour rejouer exactement une variation et
`durationMs` pour adapter la durée active. Ce sont les seules données
dynamiques prévues par cette capacité ; la motion reste choisie par son nom.

Le catalogue complet embarqué par Avatar V2 contient 78 actions :

| Action | Effet |
| --- | --- |
| `wave_right` | salut de la main droite |
| `wave_left` | salut de la main gauche |
| `thumbup_right` | pouce levé à droite |
| `thumbdown_right` | pouce baissé à droite |
| `point` | geste de désignation |
| `ok_wink` | signe OK et clin d'œil |
| `shrug_confused` | haussement d'épaules confus |
| `namaste_bow` | mains jointes et révérence |
| `nod_yes` | hochement affirmatif |
| `shake_no` | mouvement négatif de la tête |
| `look_up` | regard vers le haut |
| `look_down` | regard vers le bas |
| `bow` | révérence |
| `jump` | saut joyeux |
| `celebrate` | célébration |
| `turn_around` | rotation complète |
| `surprised` | surprise |
| `wink` | clin d'œil |
| `laugh` | rire |
| `yawn` | bâillement |
| `applause` | applaudissements |
| `dance` | danse |
| `facepalm` | main sur le visage |
| `excited` | excitation |
| `dismiss` | geste de renvoi |
| `tongueout` | langue tirée |
| `kiss` | baiser |
| `eyeroll` | yeux levés au ciel |
| `sigh` | soupir |
| `raise_eyebrows` | sourcils levés |
| `open_mouth` | bouche ouverte |
| `cheek_puff` | joues gonflées |
| `close_eyes` | yeux fermés |
| `look_left` | regard à gauche |
| `look_right` | regard à droite |
| `head_circles` | cercles de tête |
| `shiver` | frisson |
| `chew` | mastication |
| `deep_breath` | respiration profonde |
| `vibrate` | vibration rapide |
| `neutral_face` | visage neutre |
| `smug` | air satisfait |
| `slight_smile` | léger sourire |
| `warm_smile` | sourire chaleureux |
| `grin` | grand sourire |
| `open_grin` | grand sourire ouvert |
| `squint_smile` | sourire plissé |
| `beam` | sourire rayonnant |
| `laugh_closed` | rire yeux fermés |
| `tongue_out` | langue tirée, variante |
| `crying_laugh` | rire aux larmes |
| `wink_smile` | sourire avec clin d'œil |
| `sobbing` | sanglots |
| `puppy_eyes` | regard suppliant |
| `disappointed` | déception |
| `pensive` | tristesse pensive |
| `flushed` | embarras |
| `sad_frown` | moue triste |
| `kiss_eyes_closed` | baiser yeux fermés |
| `blow_kiss` | baiser envoyé |
| `adoring` | regard attendri |
| `heart_eyes` | admiration |
| `rage` | colère intense |
| `unamused` | air blasé |
| `scream` | cri |
| `grimace_teeth` | grimace montrant les dents |
| `thinking_face` | réflexion concentrée |
| `side_glance` | regard en biais |
| `zzz` | endormissement |
| `hand_raise` | main droite levée |
| `hand_raise_left` | main gauche levée |
| `thumbs_up` | pouce levé |
| `thumbs_down` | pouce baissé |
| `ok_sign` | signe OK |
| `shrug_both` | haussement des deux épaules |
| `pray` | prière |
| `nod` | hochement simple |
| `head_shake` | secouement négatif |

Les neuf gestes natifs simples `handup`, `index`, `point`, `ok`, `thumbup`,
`thumbdown`, `side`, `shrug` et `namaste` restent également acceptés pour les
modèles qui les utilisent directement. Les noms disponibles sont exportés par
`AVATAR_GESTURE_MOTION_NAMES` et les métadonnées par
`AVATAR_MOTION_CATALOG`, afin que l'application puisse construire sa liste
d'actions sans recopier le catalogue.

Le catalogue est adapté des données MIT de
[`lhupyn/motion-engine`](https://github.com/lhupyn/motion-engine). Seules les
données de motions sont reprises ; son runtime TalkingHead n'est pas importé.

`avatar-gaze` déclare `avatar:gaze:on` et `avatar:gaze:off`. Le choix reste
dans le nom de l'action ; `contact` et `durationMs` peuvent rester dans
`data` lorsqu'ils varient d'une occurrence à l'autre.

`avatar-idle` regroupe la présentation au repos : il applique la pose initiale
`neutral` par défaut, les clignements, une respiration et un léger balancement
déterministe de la tête et du corps. Ces comportements restent des indications
auteur simples ; l'engine Avatar masque leurs détails et les adapte au modèle.

```ts
{
  id: 'avatar-idle',
  type: 'avatar-idle',
  initial: {
    rel: { host: 'avatar-three-host', target: 'avatar' },
    pose: 'neutral',
    blink: true,
    breathe: true,
    headDrift: true,
  },
}
```

`blink: false`, `breathe: false` ou `headDrift: false` désactive séparément l'un
de ces comportements. Les gestes restent portés par `avatar-gesture` et reviennent
vers cette pose de repos.

## Rive

Le module fournit un host `rive` qui charge et joue un document Rive, ainsi
qu’un composant logique `rive-state-machine` pour piloter une state machine
attachée au host. Le package fournit les capacités et la stratégie de preload :

```ts
import { CodPlay } from 'codplay'
import { RIVE_ENGINE, RIVE_PRELOAD_STRATEGIES } from '@codplay/component-v2'

const codplay = new CodPlay({
  engine: RIVE_ENGINE,
  preload: { strategies: RIVE_PRELOAD_STRATEGIES },
})
```

Le document se déclare avec `type: 'rive'`, un `src` `.riv` et, si besoin, un
nom d’artboard. La state machine se déclare séparément avec
`type: 'rive-state-machine'` et une relation `rel.host` vers le host. Un lip-sync,
une expression ou toute autre fonctionnalité d’application peut utiliser les
valeurs nommées de ce composant pour piloter les inputs de la state machine.
Voir [`src/rive/README.md`](src/rive/README.md).

## Scroll container

Enregistrez le composant et son module dans l’engine, puis ajoutez la source
HTML au host pour activer les observations :

```ts
import { CodPlay } from 'codplay'
import {
  SCROLL_CONTAINER_COMPONENT_DEFINITION,
  SCROLL_CONTAINER_MODULE_DEFINITION,
  createScrollContainerSourceAdapter,
} from '@codplay/component-v2'

const codplay = new CodPlay({
  engine: {
    components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
    modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
  },
  htmlHost: { sourceAdapterFactories: [createScrollContainerSourceAdapter] },
})

const build = codplay.build({
  scene: {
    id: 'chapters',
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        persos: [
          {
            id: 'chapter-scroll',
            type: 'scroll-container',
            initial: {
              tag: 'section',
              attr: { id: 'chapter-scroll' },
              style: { height: '24rem', overflowY: 'auto' },
              move: { target: '@root' },
            },
          },
          {
            id: 'chapter-card',
            type: 'tag',
            initial: {
              tag: 'article',
              content: 'Introduction',
              move: { target: 'chapter-scroll' },
            },
            emit: {
              observe: {
                enter: [{ name: 'chapter:appear', once: true }],
                leave: [{ name: 'chapter:leave' }],
              },
            },
          },
        ],
      },
    },
  },
})

if (!build.ok) throw new Error('The scene is invalid.')
```

By default, an observation uses the closest ancestor scroll container. Add
`root: 'chapter-scroll'` to `emit.observe` to choose a particular ancestor.
Events repeat at each enter or leave transition unless that event declares
`once: true`.

To drive a card's own ACE color from its visible proportion, name one of its
TweenActions with `liveAction`. Its function reads `input.data.ratio` from 0 to
1; `zone.threshold` controls how often the browser supplies a new ratio. This
live update does not create a journal event.

```ts
import { prepareTween, resolveTween } from 'ace'

const cardColor = prepareTween({
  from: '#1b2633',
  to: '#286b57',
  duration: 1,
  ease: 'linear',
})

function colorByVisibility({ data }: { data: Record<string, unknown> }) {
  return {
    style: {
      backgroundColor: resolveTween(cardColor, data.ratio as number),
    },
  }
}

emit: {
  observe: {
    liveAction: 'chapter-card:visibility',
    zone: { threshold: [0, 0.25, 0.5, 0.75, 1] },
  },
},
actions: {
  'chapter-card:visibility': {
    duration: 1,
    fn: colorByVisibility,
  },
}
```
