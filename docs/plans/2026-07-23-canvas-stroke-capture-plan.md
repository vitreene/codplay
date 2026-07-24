# Plan — capture continue d'un tracé libre (canvas → SVG)

## Techniques employées

- **Capture pointeur existante** (`v1-capture-spec.md`) : `trackOn: pointermove` / `endOn: pointerup|pointercancel` sur un perso `layout`. `trackCommand` accumule les points en pure donnée (aucun accès node), sans jamais émettre d'`action` tant qu'il n'y a pas au moins deux points.
- **Deux `layout` (`format: "svg"`), zéro nouveau composant** : `strokeArea` porte le viewport `<svg>` réel et déclare la capture ; `strokePath` est un second `layout` dont le markup est un `<path>` seul (racine à un noeud), monté dans l'`outlet` de `strokeArea` via `move.parentId`. Nécessaire parce qu'un `outlet` est une cible de noeud, jamais d'attribut (`v1-layout-spec.md`), et que `LayoutComponent.update()` ne patch que sa propre racine.
- **Repère auto-porté** : le `d` du path est toujours recalculé en coordonnées locales à `strokeArea` (`clientX/Y` moins un offset écran mesuré une fois), lissé en courbes quadratiques (`buildSmoothPath`), arrondi à 1 décimale — jamais de bounding box recalculée à chaque tick (ça ferait sauter le tracé déjà dessiné).
- **Deux canaux de capture-tick distincts, non interchangeables** : `style` passe par le canal `CaptureUpdate` dédié (anime.js `createAnimatable`, adapté aux valeurs interpolables simples) ; `attr` fait un `setAttribute` direct, sans anime.js (un `d` de path n'a pas de forme interpolable générique, et `trackCommand` recalcule de toute façon la valeur complète à chaque tick). Extension normative de `v1-capture-spec.md` (règle 5) et de `create-player.ts` (`applyCaptureAttr`, nouveau, à côté d'`applyCaptureProperties`).
- **Mesure d'environnement hors contrat de capture** : l'offset écran de `strokeArea` est mesuré une fois (+ sur `resize`) côté démo (`getBoundingClientRect`, code applicatif ordinaire, jamais dans `trackCommand`), poussé dans `story.state` via un `player.emit` explicite (`source: "system"`, `scopeStoryId` explicite), lu par `initCaptureState`.
- **Réduction Douglas-Peucker au commit uniquement** : `stroke-build-path` simplifie les points (`reducePoints`, tolérance `RDP_EPSILON` px) avant `buildSmoothPath` — jamais pendant le tracking (`trackCommand` reste sur les points bruts, sinon le tracé déjà dessiné bougerait à chaque tick, même défaut que la bounding box récursive abandonnée).

## Cadrage

Capture d'un geste pointeur libre, restitué comme tracé SVG lissé qui suit le
pointeur en direct puis se fige (couleur aléatoire par tracé) au relâchement.
Reste hors scope, tranché indépendamment de ce plan :

- la reproduction pixel-exacte du dessin brut au seek — si nécessaire un
  jour, passerait par un enregistrement en blob (snapshot), avec son propre
  traitement, explicitement hors sujet ici (le dessin live n'est de toute
  façon jamais matérialisé, seul le commit final au relâchement l'est).

## Mécanisme de capture réutilisé

`v1-capture-spec.md` définit le cycle `trackOn`/`endOn`,
`initCaptureState`/`trackCommand`/`endCapture`/`endEmit`. Règles qui pèsent
directement sur ce design :

- `trackCommand` n'a **aucun accès aux nodes runtime** — sa seule sortie
  possible est une `CaptureAction` (règle 5, règle 7).
- Le tracking n'est jamais matérialisé ; seuls `endEmit`/`endCapture.events`
  le sont (règle 4).
- `endEmit.data`, absent de la déclaration, retombe sur la dernière valeur
  de `captureState` (règle 3) : c'est le canal qui expose au strap le tracé
  accumulé par `trackCommand`, sans avoir besoin de déclarer `endCapture`.

## Composants : deux `layout`, pas de nouveau composant

`TagComponent` est écarté d'emblée : son node racine est créé par
`document.createElement` (`base-component.ts:buildNode`), jamais
`document.createElementNS` — un `tag: "svg"` générique ne produit pas un
véritable node SVG-namespaced.

`LayoutComponent` (`format: "svg"`) sait produire un vrai node SVG-namespaced
(`parseLayoutMarkup` utilise `DOMParser` en mode `image/svg+xml`). Mais deux
règles normatives de `v1-layout-spec.md` contraignent la façon de poser
`d` :

- « un `outlet` est une cible de noeud, jamais une cible d'attribut »
  (ligne 80) ;
- « un `outlet` n'est pas une cible d'action en V1 » (ligne 104).

`LayoutComponent.update()` ne patch jamais que son propre node racine
(`this.services.apply(this.node, ...)`) — jamais un `data-part` interne. Un
`<path>` doit donc être la racine d'un `layout` à part entière (markup à un
seul noeud top-level, sans wrapper) pour que `attr: { d }` l'atteigne
directement. Un `<path>` sans ancêtre `<svg>` ne rend rien visuellement (un
shape SVG a besoin d'un viewport pour établir son système de coordonnées) ;
il est donc monté comme enfant, via `move.parentId`, dans l'`outlet` d'un
second `layout` qui porte le vrai viewport. `v1-layout-spec.md` (ligne 91)
confirme que « tout type de composant » peut être inséré dans un `outlet`,
« dans les limites du contexte html ou svg ».

- `strokeArea` : le viewport `<svg>` (plein écran, sans `viewBox` — 1 unité
  svg = 1px css, aligné 1:1 avec `clientX`/`clientY` sans déformation) et la
  zone de capture (`emit.pointerdown.capture`).
- `strokePath` : le `<path>` seul, monté dans l'`outlet` de `strokeArea`,
  patché par `attr.d`/`attr.stroke`.

## Repère du tracé

Le `d` est recalculé en coordonnées **locales à `strokeArea`** :
`clientX - state.areaLeft`, `clientY - state.areaTop` (voir « Mesure de
l'offset écran » ci-dessous) — jamais une bounding box recalculée à chaque
tick (essayé, puis abandonné : un nouveau minimum décale rétroactivement
tous les points déjà tracés, ce qui fait sauter le dessin au lieu de suivre
le pointeur). `buildSmoothPath` lisse en courbes quadratiques (chaque point
brut sert de point de contrôle, la courbe se termine au milieu du segment
suivant) plutôt qu'en segments droits, et arrondit chaque coordonnée à 1
décimale.

## Dessin live : deux canaux de tick, pas un seul

`trackCommand` retourne, dès 2 points, `action: { actionName:
"stroke_tracking", data: { attr: { d, stroke } } }` — jamais avant (sinon
suivi 1:1 par défaut du capture-runtime, qui ne s'applique que si
`trackCommand` est absent). `strokePath` déclare `stroke_tracking` comme
action distincte de `stroke:path:ready` (le nom d'`endEmit`) : s'il
déclarait une action du même nom que `endEmit`, il recevrait directement les
points bruts comme payload (résolution standard `perso.actions[eventName]`,
indépendante de `listen`).

Côté runtime (`create-player.ts::applyCaptureTickActions`), `style` et
`attr` ne sont **pas** le même canal, malgré une première tentative en ce
sens :

- `style` transite par `applyCaptureProperties` → `renderer.applyCaptureUpdate`
  → anime.js `createAnimatable`, seedé avec `0` — fiable pour des valeurs
  simples interpolables (transforms, couleurs).
- `attr` transite par `applyCaptureAttr`, un `setAttribute` direct
  (`applyAttrPatch`, le même helper que le commit final utilise déjà) —
  jamais anime.js. Confirmé empiriquement : `createAnimatable` sur un `d` de
  path l'écrit comme une propriété **CSS** `d` invalide (visible « barré »
  dans l'inspecteur) au lieu du véritable attribut SVG. `attr` n'a de toute
  façon pas besoin d'interpolation : `trackCommand` recalcule la valeur
  complète à chaque tick.

Ni l'un ni l'autre ne passe par `component.update()` : le canal de tick
contourne structurellement toute la couche composant, applique directement
sur le node runtime. Seul le commit final (`endEmit`/`endCapture` → `Strap`
→ `perso.actions[eventName]`) passe par la résolution d'action normale d'un
composant.

## Commit final — strap, pas `endCapture`

```ts
listen: [{ on: "stroke:captured", straps: ["stroke-build-path"] }]
```

Le strap reçoit `event.data` (fallback `captureState`, règle 3), recalcule
le même `d` lissé (fonction partagée avec `trackCommand`), et retourne
`events` (jamais `update` — `update` mute `state`, il ne dispatche jamais
une action perso) : `{ events: [{ name: "stroke:path:ready", data: { attr:
{ d, stroke } } }] }`, routé vers `strokePath` par résolution standard.

## Mesure de l'offset écran (hors contrat de capture)

`initCaptureState` lit `story.state.areaLeft/areaTop` pour ancrer
`trackCommand` sur la vraie position écran de `strokeArea` — sans ça, le
tracé démarre à l'origine locale de `strokePath` (son propre coin), pas
sous le pointeur. Cette mesure (`getBoundingClientRect`) a lieu côté démo
(`stroke-path-demo.ts`), jamais dans `trackCommand` (qui n'a pas accès aux
nodes) : code applicatif ordinaire, hors du contrat de capture.

Pousser cette mesure dans `story.state` via `player.emit` a révélé deux
pièges, dans l'ordre :

1. `Player.emit` rejette silencieusement (`PLAYER_USER_EVENTS_PAUSED`) tout
   event `source: "user"` (la valeur par défaut) tant que le player est en
   pause — et il l'est en permanence ici (`play()` reste une action
   utilisateur, jamais automatisée). Fix : `source: "system"` — légitime,
   cette mesure n'est pas une interaction utilisateur.
2. Une fois débloqué, l'event sans `scopeStoryId` ni `cascade: true` fait
   router l'`update` du strap vers `scene.state` (`resolveStateTarget`,
   `player.ts:648-655`), pas `story.state` — alors qu'`initCaptureState` lit
   `story.state` par défaut (pas de `stateScope: 'scene'` déclaré). Fix :
   `scopeStoryId` explicite sur l'emit.

Un écouteur `resize` répète la mesure si la fenêtre change de taille.

## Contrat normatif — extensions faites

- `v1-capture-spec.md` règle 2 : écoute `trackOn`/`endOn` au niveau
  `window`, jamais bornée au node du perso.
- `v1-capture-spec.md` règle 3 : fallback `endEmit.data ?? captureState`.
- `v1-capture-spec.md` règle 5 : `style` et `attr` sont les deux seules clés
  de `CaptureAction.data` appliquées en direct pendant le tracking, chacune
  par un mécanisme distinct (anime.js `CaptureUpdate` pour `style`,
  `setAttribute` direct pour `attr`) — aucun des deux ne passe par
  `component.update()`.
- `v1-capture-spec.md` règle 10 (nouvelle) : pattern général de résolution
  narrow à la fermeture (illustré par `resolveDndTarget` du dnd) — non
  utilisé par ce design (le repère du path est auto-porté), mais documenté
  pour de futurs besoins similaires.
- `v1-layout-spec.md` lignes 80/91/104-105 : `outlet` = cible de noeud
  uniquement, tout type de composant accepté en contexte svg.

## Code livré

- `packages/codplay/src/player/create-player.ts` : `applyCaptureProperties`
  (style, anime.js) + `applyCaptureAttr` (attr, `setAttribute` direct),
  nouveau.
- `packages/demos/src/scenes/stroke-path-scene.ts` : scène (`strokeArea`,
  `strokePath`, straps, listen).
- `packages/demos/src/codplay/stroke-path-demo.ts` : point d'entrée, mesure
  d'offset écran.
- `packages/demos/src/main.ts`, `packages/demos/src/shared/demo-registry.ts` :
  câblage `?demo=stroke-path`.

## Hors scope (rappel)

Reproduction pixel-exacte du dessin brut au seek (blob) — non nécessaire
pour cette démo.

## Problème connu — horizon/timeline (non reproduit à volonté)

Observé une fois : progression de la timeline bloquée à 100% après le
dernier tracé ; un seek arrière puis avant rend ce dernier tracé
inaccessible ; un `play()` réexpanse la timeline normalement et le tracé
redevient atteignable.

Investigation faite (lecture de code uniquement, pas de repro live) :
l'hypothèse d'un défaut de frontière (calcul d'horizon asynchrone, borne
`<`/`<=` fautive) est **infirmée**. Le calcul de l'horizon est synchrone et
atomique (`create-player.ts:2225-2283` : matérialisation → application
live → recalcul de l'horizon, dans le même appel, avant tout repaint), et
les comparaisons de frontière (`shouldReplayEventForSeek`,
`TrackManager.collectDueEvents`) sont cohéremment inclusives (`<=`). Le
blocage à 100% après un tracé est le comportement **attendu** pour une
scène sans `eventimes` (pas de master track — `progressEndMs` est défini
comme la position la plus loin atteinte).

Ce qui reste réellement inexpliqué : pourquoi le seek arrière-puis-avant
rend le dernier event inaccessible, et pourquoi `play()` le débloque
spécifiquement. Le runtime émet déjà une trace dédiée à ce diagnostic
(`PLAYER_TRACE_EVENT.horizonSync`, `create-player.ts:380-397`) — à
capturer en direct pendant la repro exacte (tracé → seek arrière → seek
avant → play) si ça se reproduit un jour ; la lecture statique seule ne
suffit pas. Pas l'objet de cette démo — à surveiller, pas à corriger à
l'aveugle.

## Évolution — accumulation multi-tracés (composant `sketch`)

### Cadrage

Aujourd'hui, chaque tracé remplace le précédent (`strokePath` n'a qu'un seul
`d`). Cette évolution fait que chaque tracé s'ajoute aux précédents. Un
nouveau perso par tracé est écarté d'emblée (les persos sont déclarés
statiquement dans la scène, pas instanciés dynamiquement un par un) : les
tracés doivent être des éléments générés en interne par un composant, dont
les paramètres (points, couleur) voyagent en donnée — jamais un noeud DOM
manipulé individuellement depuis l'extérieur du composant.

### Précédent : `PolygonComponent`, pas `ListComponent`

`ListComponent` ne convient pas : ses enfants sont des *persos* séparés,
montés via `move.parentId` — exactement ce qui est écarté ici.
`PolygonComponent` est le bon modèle : un seul perso qui génère et gère ses
propres noeuds SVG internes (`createElementNS`), pilotés par un vocabulaire
d'action restreint, sans jamais exposer ces noeuds comme des persos.

### Contrainte structurelle : le tick live ne peut pas atteindre un composant

Confirmé pendant l'étape 2 (voir plus haut, « Dessin live ») : le canal de
tick d'une capture (`applyCaptureTickActions`) cible toujours le node
racine d'un perso directement (`renderer.getRuntimeRegistry().getNodeById`),
et contourne `component.update()` entièrement. Un composant `sketch` qui
gère en interne une collection de tracés ne peut donc jamais recevoir le
flux `trackCommand` tick-par-tick — son `update()` ne serait jamais appelé
pendant le geste.

Conséquence : le tracé *en cours* (le direct, sous le pointeur) reste un
perso séparé et « bête », strictement identique au `strokePath` actuel
(renommé `strokeLive` ci-dessous). Le composant `sketch` ne reçoit un tracé
qu'une fois *terminé*, via le pipeline d'event normal (`endEmit` → strap →
`perso.actions[eventName]` → `component.update()`), qui lui passe bien par
la couche composant.

### Design

- `strokeArea` (viewport + capture) et `strokeLive` (l'actuel `strokePath`,
  scratch du tracé en cours, canal `attr` live) restent inchangés.
- Nouveau perso `sketch` (type `sketch`, nouveau `SketchingComponent`),
  monté dans le **même** `outlet` de `strokeArea` que `strokeLive`
  (`v1-layout-spec.md` l.90 : plusieurs persos peuvent partager un outlet).
- `SketchingComponent.render()` crée un `<g>` SVG-namespaced
  (`createElementNS`) comme racine — un conteneur, pas une forme. Sur
  réutilisation du node (seek — voir plus bas), il retire tous les `<path>`
  déjà ajoutés et vide sa `Map` interne avant tout replay : c'est ce reset
  en place, jamais une recréation du node, qui permet au seek de
  reconstruire l'état correct (voir « Cohérence au seek »).
- État interne du composant (jamais `state`/`captureState`, même famille que
  `authoredAttrs` de `PolygonComponent`/`LayoutComponent`) :
  `pathById: Map<string, SVGPathElement>`.
- Vocabulaire d'action (deux clés distinctes sur le même perso, comme
  `stroke_tracking`/`stroke:path:ready` sur l'actuel `strokePath`) :
  - `sketch:add-stroke` — `data: { id, d, stroke }` : crée un `<path>`
    (`fill:none`, `stroke-linecap/linejoin: round`, `stroke-width`),
    l'ajoute au `<g>`, l'enregistre dans `pathById`.
  - `sketch:clear` — vide `pathById` et retire tous les `<path>` du `<g>`.
- Le strap `stroke-build-path` (commit au relâchement) change de cible :
  au lieu d'écraser `d` sur `strokeLive`, il émet vers `sketch:add-stroke`
  (le tracé devient permanent) puis remet `strokeLive` à `d: ""` (le
  scratch redevient vide, prêt pour le geste suivant).
- `id` du tracé est décidé **au commit**, dans le strap (ex. un compteur
  dans `story.state`), jamais recalculé côté composant : un id
  recalculé au replay serait différent à chaque seek, cassant la
  reconstruction déterministe.

### Bouton clear

Un perso bouton dédié dans la story (ex. `type: "tag"`, un élément
cliquable), avec `emit: { pointerdown: { event: { name: "sketch:clear" } } }`
— pas de capture, un clic simple. `sketch` déclare l'action `sketch:clear`
et la reçoit directement par résolution standard `perso.actions[eventName]`,
sans passer par un strap (rien à calculer, juste vider). Conforme à la
règle du projet : un contrôle fonctionnel est un perso dans la scène,
jamais un bouton hors scène.

### Cohérence au seek

`v1-seek-spec.md` : le seek réinitialise puis rejoue tous les events
matérialisés depuis zéro dans la même tâche synchrone (`loadPersos` reset →
replay), jamais de manière incrémentale. Puisque `sketch:add-stroke` et
`sketch:clear` sont des events normaux matérialisés (routés par le
pipeline standard, pas par le canal de tick), rejouer la séquence complète
depuis zéro reconstruit exactement le bon jeu de tracés à l'instant `T` —
à condition que `render()` réinitialise bien sa `Map`/ses `<path>` avant
que le replay ne commence (voir plus haut), exactement comme
`LayoutComponent`/`PolygonComponent` restaurent leur baseline avant
replay plutôt que de recréer leur node.

### Marges de la surface de tracé

Pour la démo, `strokeArea` garde des marges visibles autour de lui plutôt
que de coller aux bords du conteneur : `margin` fixe sur le `<svg>` avec
`width`/`height` en `calc(100% - 2 × marge)`. Aucun changement du calcul de
repère nécessaire : `getBoundingClientRect()` (mesure déjà en place, voir
« Mesure de l'offset écran ») lit la boîte réellement rendue, marge déjà
incluse.

### Composant externe, pas dans le coeur codplay

Vu son caractère expérimental, `sketch` n'est pas enregistré dans
`DEFAULT_COMPONENT_CLASSES`/`packages/codplay` : il suit exactement le
patron déjà établi par `avatar3d`/`rive`
(`packages/authoring/components/<nom>/`), résolu via l'alias
`@codplay/<nom>` (`packages/demos/build/resolve-codplay-authoring.ts`,
déjà en place, aucun changement d'outillage nécessaire) :

- `packages/authoring/components/sketch/package.json` — `@codplay/sketch`,
  `exports: {".": "./src/index.ts"}`, dépendance unique : `codplay` (pas de
  lib tierce, contrairement à rive/`@rive-app` ou avatar3d/three.js).
- `packages/authoring/components/sketch/tsconfig.json` — copie du
  `tsconfig.json` de `rive` (paths vers `codplay`/`codplay/*` en source).
- `packages/authoring/components/sketch/src/sketching-component.ts` —
  `SketchingComponent extends BaseComponent`, import
  `'codplay/runtime/components/lib/base-component'` (exactement comme
  `rive-base-component.ts`).
- `packages/authoring/components/sketch/src/create-sketch-binding.ts` —
  `createSketchBinding(): ThirdPartyBinding`, retourne
  `{ components: { sketch: SketchingComponent } }` — ni `renderAdapter`
  (pas de boucle de rendu par frame, un `<path>` une fois posé est statique)
  ni `preload` (aucune ressource externe à charger), les deux optionnels
  sur `ThirdPartyBinding` (`third-party-binding.ts:14-19`).
- `packages/authoring/components/sketch/src/index.ts` — réexporte
  `createSketchBinding`.

### Persistance — localStorage (POC), scene-strap async

« Action side-effect » n'est pas un type de strap à part : c'est la faculté,
déjà normative (`v1-strap-spec.md` règles 2-3), d'un **scene-strap** d'être
async pour réaliser une opération externe (« destiné à l'orchestration
cross-stories et aux side-effects globaux »). Remplacée demain par un fetch
vers une vraie base, l'interface ne change pas.

Routage vérifié dans `player.ts::routeSceneEvent` (lignes 1355-1374), pas
supposé :

- `isLocalStoryEvent = scopeStoryId !== undefined` : un event de
  **story-strap** (`scopeStoryId` = sa story) n'atteint `scene.listen` que
  si son `cascade: true` fait passer son `scopeStoryId` à `undefined` au
  re-routage — sans ça, il reste local à sa story.
- un event de **scene-strap** a `scopeStoryId: undefined` par construction
  (pas de story d'origine) : `cascade` y est sans objet. S'il ne matche
  aucune règle `listen` (story ni scene), il tombe en fallback sur
  `emitRuntimeEvent`, qui résout `perso.actions[eventName]` à travers
  **toutes** les stories montées, sans filtre de scope (même mécanisme que
  `resolvePersoIdsForActionName` pour le canal de capture) — donc un event
  de scene-strap peut piloter directement l'action d'un perso, sans strap ni
  règle `listen` supplémentaire.

Conséquence pour le design : le commit (`stroke-build-path`) et l'effacement
doivent chacun émettre un **event dédié et cascadé** vers `scene.listen`
(jamais réutiliser tel quel un event déjà consommé localement) ; en retour,
`save:done` (émis par le scene-strap) pilote directement l'action de flash
sans avoir besoin d'un strap ni d'une règle `listen` côté story.

```ts
// story straps (stroke-path-scene.ts) — inchangé sauf ajout de deux events
"stroke-build-path": ({ event, state }) => {
  // ...calcul de d existant...
  const strokeId = (state as { nextStrokeId: number }).nextStrokeId
  return {
    update: { nextStrokeId: strokeId + 1 },
    events: [
      { name: "sketch:add-stroke", data: { id: strokeId, attr: { d, stroke: color } } },
      { name: "sketch:stroke:committed", data: { id: strokeId, d, color }, cascade: true }
    ]
  }
},
"notify-sketch-cleared": () => ({
  events: [{ name: "sketch:cleared", cascade: true }]
})
```

```ts
// scene straps, injectés via PlayerSceneDemoConfig.strapCollection
// (déjà câblé dans run-codplay-scene-demo.ts -> studio.load({ strapCollection }))
const STORAGE_KEY = "codplay-stroke-path-sketch"

async function readStoredStrokes(): Promise<StoredStroke[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const sceneStraps: StrapCollection = {
  "save-sketch": async ({ event }) => {
    if (event.name === "sketch:cleared") {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      const stroke = event.data as StoredStroke
      const current = await readStoredStrokes()
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, stroke]))
    }
    return { events: [{ name: "save:done" }] } // scopeStoryId déjà undefined, rien à cascader
  }
}
```

```ts
// scene.listen (stroke-path-scene.ts)
listen: [
  { on: "sketch:stroke:committed", straps: ["save-sketch"] },
  { on: "sketch:cleared", straps: ["save-sketch"] }
]
```

Pas de cache intermédiaire dans `scene.state` : le scene-strap lit/écrit
directement `localStorage` à chaque notification (read-modify-write) —
plus simple, une seule source de vérité, cohérent avec « POC, on reste
simple ».

### Lecture au démarrage

À l'init, lire `localStorage`, vide si absent/invalide. Fait côté démo
(`stroke-path-demo.ts::onReady`, même emplacement et même raison que la
mesure d'offset écran : `Player.emit` rejette les events `source: "user"`
tant que le player est en pause, donc `source: "system"` ici aussi) plutôt
que dans `scene.init()` : la restitution visuelle est un event vers
`sketch` (`sketch:restore`, `data: { strokes }`), et `scene.init()`/
`onStart` n'exposent pas de primitive d'emit directe
(`PlayerSceneLifecycleOptions` ne porte que `schedule`) — cohérent avec le
mécanisme déjà validé plutôt qu'un nouveau chemin.

### Flash de confirmation

Un perso (ex. `strokeArea`) déclare `actions: { "save:done": {} }` — reçoit
directement `save:done` (résolution globale `perso.actions[eventName]`,
voir plus haut, aucune règle `listen` requise) avec `data: { style: {
background: { from: "#22c55e", to: "#eef2f7", duration: 1000 } } }` — même
mécanisme de transition `{from,to,duration}` que `style.x`/`style.y` dans
l'exemple drag de `v1-capture-spec.md`.

### Composants à livrer

- Le package `@codplay/sketch` (section précédente).
- `stroke-path-scene.ts` : renommage `strokePath` → `strokeLive`, nouveau
  perso `sketch`, nouveau perso bouton clear, compteur `nextStrokeId` dans
  `story.state`, strap `stroke-build-path` retargeté (garde son appel
  `reducePoints` déjà en place) + `notify-sketch-cleared`, `scene.listen`/
  scene straps pour la persistance.
- `stroke-path-demo.ts` : `setup()` (comme `rive-coach-demo.ts`) pour
  `createSketchBinding()`, `strapCollection` passé à `runCodPlaySceneDemo`,
  lecture localStorage + `sketch:restore` dans `onReady`.

### Hors scope de cette évolution

Suppression/undo d'un tracé individuel, limite du nombre de tracés
accumulés, style par-tracé au-delà de la couleur (épaisseur variable,
opacité) — non demandés, non traités ici.
