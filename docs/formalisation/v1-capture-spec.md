# Capture spec V1 - events continus

## Statut

Spec normative V1 pour le canal de capture dans Codplay.

## Objectif

Figer le contrat d'un event capture : le canal dedie aux emissions continues
(pointeur, clavier, et tout device produisant un flux haute frequence) qui ne
peuvent pas transiter par le canal `StoryEvent` / track sans le saturer.

## Definition

Une capture est un cycle de vie declenche par un event d'entree classique et
cloture par un ou plusieurs events de fin.

- une capture appartient au perso et a l'action qui la declarent
- le tracking d'une capture (les valeurs emises pendant sa duree de vie) ne
  transite jamais par `StoryEvent`, n'est jamais materialise en track, et
  n'est jamais rejouable au seek
- seuls les events emis en fin de capture peuvent etre materialises en track,
  selon leur qualite (voir regle 3, Phase de fin)
- le routage de `endEmit`/`endCapture` vers les persos est un canal ouvert,
  symetrique au canal `emit`/`listen` : la capture declare un nom d'event,
  les persos y reagissent via leur action declaree du meme nom
- pendant le tracking, `trackCommand` cible une `actionName`, au meme titre
  que le nom d'event route `endEmit`/`endCapture` vers les persos abonnes :
  aucun `persoId` explicite n'est requis, le routage reste par nom d'action
  declaree, comme le canal `emit`/`listen`

## Forme d'authoring

`initCaptureState`/`trackCommand`/`endCapture` sont des fonctions JS portees
directement par `CaptureDeclaration`, exactement comme `StoryDef.straps`
porte des `StrapFn` reelles et comme `listen[].transform` porte des
`TransformFn` reelles. Le Builder ne fait aucune extraction ni resolution
par nom : `CompiledScene` reste une structure d'objets JS vivante (clonee
via `structuredClone` avec prise en charge explicite des fonctions, voir
`builder-artifact-cloner.ts`), pas un format JSON pur.

La production d'un artefact serialisable (mode diffusion) est un probleme de
packaging externe, distinct de l'authoring : `extractSceneFunctions`
(`v1-broadcast-spec.md` §10) extrait deja `listen[].transform` vers un
`StrapCollection` nomme au moment de produire un bundle diffusable. Les
fonctions de capture suivent la meme famille et le meme traitement — inline
ou nommee, une fonction de capture est traitee de facon identique par ce
mecanisme d'extraction, sans qu'aucune convention de nommage ne soit requise
a l'authoring pour cela.

## Contrat canonique

```ts
type NativeEventName = string

type CaptureSample = Record<string, unknown>
type CaptureState = Record<string, unknown>

/**
 * Forme concrete d'un CaptureSample issu d'un `trackOn` pointeur (ex:
 * 'pointermove'). `movementX`/`movementY` sont le delta natif depuis le
 * dernier `PointerEvent` (herite de `MouseEvent`), fournis par le navigateur
 * lui-meme — pas un calcul du player, unifie souris/trackpad/tactile.
 */
type PointerCaptureSample = CaptureSample & {
  clientX: number
  clientY: number
  movementX: number
  movementY: number
}

/**
 * Forme concrete d'un CaptureSample issu d'un `trackOn` clavier (ex: 'keydown').
 * `deltaMs`/`elapsedMs` proviennent du tick du player, pas de `KeyboardEvent` :
 * le clavier ne fournit aucune valeur continue entre `keydown` et `keyup`.
 * `altKey`/`shiftKey`/`ctrlKey`/`metaKey` sont les modificateurs natifs de
 * `KeyboardEvent`, lus a l'etat courant a chaque tick — permet par exemple a
 * `trackCommand` d'adapter son comportement (ex: vitesse reduite) si un
 * modificateur est maintenu en cours de geste.
 */
type KeyboardCaptureSample = CaptureSample & {
  keyCode: string
  deltaMs: number
  elapsedMs: number
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

type CaptureAction = {
  actionName: string
  data?: Record<string, unknown>
}

type CaptureDeclaration = {
  trackOn?: NativeEventName[]
  endOn?: NativeEventName[]
  stateScope?: 'scene' | 'story'
  initCaptureState?: CaptureInitFn
  trackCommand?: CaptureTrackFn
  endEmit?: StoryEvent
  endCapture?: CaptureEndFn
}

type CaptureInitInput = {
  state: DeepReadonly<Record<string, unknown>>
}

type CaptureInitFn = (input: CaptureInitInput) => CaptureState

type CaptureTrackInput = {
  sample: CaptureSample
  samples: readonly CaptureSample[]
  captureState: DeepReadonly<CaptureState>
}

type CaptureTrackOutput = {
  action?: CaptureAction
  captureState?: CaptureState
  updateState?: Record<string, unknown>
}

type CaptureTrackFn = (input: CaptureTrackInput) => CaptureTrackOutput | void

type CaptureEndInput = {
  samples: readonly CaptureSample[]
  captureState: DeepReadonly<CaptureState>
  state: DeepReadonly<Record<string, unknown>>
  meta: StrapMeta
}

type CaptureEndDurationMode = 'value' | 'default' | 'capture'

type CaptureEndOutput = {
  events?: StoryEvent[]
  duration?: number
  durationMode?: CaptureEndDurationMode
}

type CaptureEndFn = (input: CaptureEndInput) => CaptureEndOutput | void
```

## Regles normatives

1. Etat de capture

- `initCaptureState`, s'il est declare, est appele une seule fois a
  l'ouverture de la capture (au declenchement de `event`), avant tout
  `CaptureSample`
- `initCaptureState` lit `state` en lecture seule et retourne la valeur
  initiale de `captureState`, propre a l'instance de capture en cours
- sans `initCaptureState`, `captureState` demarre a `{}`
- `state` recu par `initCaptureState`/`endCapture` est celui de la story qui
  possede le perso hote de la capture, par defaut : une capture appartient
  toujours a un perso (`emit` n'existe que sur `PersoDoc`), jamais a une story
  ou une scene directement, et sa portee de lecture suit cette appartenance
  sauf declaration contraire
- `stateScope: 'scene'` fait lire a `initCaptureState`/`endCapture` le `state`
  de la scene plutot que celui de la story hote ; absent ou `'story'`, le
  comportement par defaut ci-dessus s'applique
- `stateScope` est fixe une seule fois, a la declaration de la capture : il ne
  peut pas changer pendant le cycle de vie d'une capture en cours
- `stateScope` ne gouverne que la lecture (`initCaptureState`/`endCapture`) ;
  il ne fixe aucun scope d'ecriture — la mutation de `state` reste portee
  exclusivement par le strap declenche via `listen` sur l'event emis
  (`endEmit`/`endCapture.events`), qui choisit son propre scope par son
  `cascade`, independamment de `stateScope`
- un auteur qui choisit `stateScope: 'scene'` doit generalement faire
  correspondre `cascade: true` sur `endEmit`/les `events` d'`endCapture`, pour
  que la capture lise et ecrive le meme `state` — rien ne l'impose
  techniquement, mais un desaccord entre les deux romp la coherence de la
  capture avec elle-meme
- `captureState` n'est pas `state` : elle n'est ni lue ni ecrite en dehors du
  cycle de vie de la capture qui l'a creee, et disparait avec elle
- `captureState` n'est jamais materialisee, jamais rejouee au seek
- filtrer l'ouverture d'une capture sur une combinaison de touches (ex: n'ouvrir
  que si Alt est deja enfonce au `keydown` declencheur) est hors perimetre de
  cette spec : cette condition appartient a la declaration `emit` qui precede
  la capture, pas au cycle de vie de la capture elle-meme

2. Phase de tracking

- chaque occurrence d'un event declare dans `trackOn` produit un
  `CaptureSample` brut, non transforme
- l'ecoute des events `trackOn`/`endOn` est installee au niveau de la
  fenetre (`window`), jamais bornee au node du perso qui declare la
  capture : un pointeur qui quitte visuellement les bornes de ce node
  pendant le tracking continue de produire des `CaptureSample`, sans
  interruption ni event de sortie particulier
- la forme exacte d'un `CaptureSample` depend de la source native declaree
  dans `trackOn` ; `PointerCaptureSample`/`KeyboardCaptureSample` en sont les
  formes concretes documentees (voir Contrat canonique) — un auteur les
  importe et caste localement, au meme titre que le cast d'un `state`
  applicatif vers son type de story (ex: `readGameState`)
- `CaptureSample` reste generique (`Record<string, unknown>`) au niveau du
  contrat lui-meme, pour ne pas imposer un generique sur toute la chaine
  `CaptureTrackFn`/`CaptureEndFn` ; le typage precis est une responsabilite
  locale de l'auteur, pas du contrat
- les `CaptureSample` s'accumulent dans un tableau, dans l'ordre de
  production, pour la duree de vie de la capture
- l'accumulation dans `samples` n'est jamais transformee ; toute
  transformation du cumul est portee par `endCapture`, appliquee une seule
  fois sur le tableau complet
- `trackCommand`, s'il est declare, est appele a chaque `CaptureSample`
  produit ; il recoit le `sample` courant, le cumul `samples`, et
  `captureState` telle qu'elle se trouve apres le dernier appel (ou apres
  `initCaptureState`)
- `trackCommand` peut retourner `action` (une `CaptureAction` ciblant une
  `actionName`, avec ses donnees d'action), `captureState` (la nouvelle
  valeur, remplacant integralement la precedente), et/ou `updateState` (une
  mutation partielle de `state`) ; les trois sont optionnels et independants
- tout perso declarant `actionName` dans ses `actions` recoit `action` et
  l'applique immediatement, comme le fait `actions[event.name]` pour un event
  standard
- une `CaptureAction` n'est jamais un `event` : elle ne porte pas de
  `name`/`cascade`/`context`, n'est jamais routee par `story.listen` ou
  `scene.listen`, et n'est jamais materialisee en track
- `updateState`, s'il est retourne, est fusionne (`Object.assign`) dans le
  `state` du scope choisi par `stateScope` (le meme scope que celui lu par
  `initCaptureState`/`endCapture` — voir regle 1), a chaque `CaptureSample`
  traite : c'est la seule facon pour un autre strap, dans le reste de
  l'application, de lire une valeur a jour pendant qu'une capture est encore
  active (ex: un tir declenche pendant un deplacement clavier maintenu doit
  voir la position courante, pas celle d'avant l'ouverture de la capture)
- `updateState` n'est jamais materialise en track ni rejoue au seek — au
  meme titre que le reste du tracking (regle 4, Materialisation) ; l'etat
  final visible au seek vient exclusivement de la reconstruction normale
  (`endEmit`/`endCapture.events` -> strap -> `update`), jamais de
  `updateState`
- en dehors de `trackCommand`, la phase de tracking ne peut ni emettre
  d'`event`, ni planifier via `context.planned`/`context.live`, ni acceder
  directement aux nodes runtime ; `trackCommand` lui-meme ne mute `state` que
  via `updateState`, jamais directement ou par un autre moyen

3. Phase de fin

- un event declare dans `endOn` termine la capture
- `endEmit` et `endCapture` sont deux mecanismes independants ; chacun est
  optionnel ; une capture peut declarer l'un, l'autre, les deux, ou aucun
- `endEmit` est un `StoryEvent` normal : il suit le contrat `v1-event-spec.md`
  sans particularite liee a la capture
- si `endEmit.data` est absent de la declaration, sa valeur retombe sur la
  derniere valeur de `captureState` au moment de la fermeture : c'est la
  maniere normale d'exposer a un `Strap` (via `listen` sur le nom
  d'`endEmit`) le resultat accumule par `trackCommand`, sans avoir a
  declarer `endCapture` du tout ; un `endEmit.data` fourni explicitement par
  l'auteur n'est jamais ecrase par ce fallback
- `endCapture` recoit le tableau complet des `CaptureSample` accumules
  (`samples`), la derniere valeur de `captureState`, le `state` courant en
  lecture seule, et `meta`
- `endCapture` peut retourner `events` (`StoryEvent[]`) ou ne rien retourner
  du tout (`void`) ; `endCapture` n'a pas de `update` — il ne mute jamais
  `state`, directement ou indirectement
- la donnee preparee par `endCapture` (calculee depuis `samples`/
  `captureState`) se retrouve dans le `data` des `events` qu'il retourne,
  exactement comme un strap construit le `data` de ses propres `events`
- toute mutation de `state` a partir du resultat d'une capture passe
  exclusivement par un `Strap` declenche via `listen` sur un `event` emis par
  `endCapture` ou `endEmit` ; ce strap applique `update` avec son mecanisme
  deja connu (`v1-strap-spec.md`), jamais court-circuite par la capture
  elle-meme
- son placement en retour de `endCapture` fait de tout `event` produit un
  event persist-only : materialise en track pour la relecture au seek,
  jamais applique en direct
- `endCapture` ne retourne jamais d'occurrence planifiee (`PlannedStrapOccurrence`)
- `endCapture` n'est jamais asynchrone ; tout traitement asynchrone (ex: un
  worker de post-traitement) doit etre confie a un strap declenche par un des
  `events` emis (`endCapture` ou `endEmit`), jamais lance depuis `endCapture`
  lui-meme
- `endEmit` et les `events` de `endCapture` sont des `StoryEvent` normaux,
  routes par le pipeline standard (`emitRuntimeEvent`) : un strap qu'ils
  declenchent peut etre asynchrone, et n'a donc aucune garantie d'ordre
  d'execution vis-a-vis d'un autre event emis par la meme fin de capture —
  seul le retour (eventuellement differe) de ce strap peut a son tour emettre
  d'autres events

3bis. Ancrage temporel des `events` de `endCapture`

- `CaptureEndOutput.duration` et `durationMode` controlent a quel `ms` les
  `events` de `endCapture` sont materialises dans la track : `ms = nowMs -
  duration_resolue`, ou `nowMs` est l'instant reel de fin de capture
  (`endOn`)
- `durationMode: 'value'` utilise `duration` tel que fourni par l'auteur :
  l'auteur reprend entierement la main, aucun automatisme ne s'applique
- `durationMode: 'default'` ignore `duration` et utilise une duree par
  defaut du runtime ; c'est le mode implicite quand `durationMode` est
  absent
- `durationMode: 'capture'` ignore `duration` et utilise la duree reelle de
  la capture, mesuree en interne par le player entre l'ouverture (au
  declenchement de `event`) et la fermeture (`endOn`) ; ce calcul n'est
  jamais expose a l'auteur, ni dans `CaptureInitInput` ni dans
  `CaptureEndInput` — `initCaptureState`/`endCapture` n'ont pas a s'en
  soucier
- choisir explicitement `'default'` ou `'capture'` vaut acceptation des
  automatismes qui en decoulent (voir plus bas, propagation dans
  `style.*.duration`) : l'auteur delegue au player, pas seulement le calcul
  de la duree, mais sa coherence partout ou elle s'applique
- cet ancrage est un choix purement visuel (ou une transition portee par un
  `event` doit se terminer dans le temps), sans aucun rapport avec la
  securite anti-rejeu du curseur (voir Materialisation) : un `ms` mal choisi
  ne peut jamais faire rejouer un event en double ou le perdre en direct
- pour `durationMode: 'default'` et `'capture'`, le player propage la duree
  qu'il a resolue dans tout `style.*.duration` absent des `events` retournes
  par `endCapture`, avant materialisation ; l'auteur n'a donc jamais besoin
  de dupliquer une valeur qu'il ne connait pas — un `style.*.duration` deja
  fourni explicitement par l'auteur n'est jamais ecrase

4. Materialisation

- le tracking n'est jamais materialise en track, quel que soit son volume,
  y compris les `CaptureAction`, les mises a jour de `captureState`, et les
  mutations `updateState` de `state`, produites par `trackCommand`
- `endEmit` est materialise selon l'`eventInsertMode` de l'event `StoryEvent`
  standard (`apply-now` par defaut)
- les `events` de `endCapture` sont materialises en `persist-only`
- la materialisation d'un event `persist-only` ne risque jamais d'etre
  executee par la lecture en cours au moment meme de son insertion, quel que
  soit le `ms` retenu par `duration`/`durationMode` : garantie generale du
  track manager, voir `v1-seek-spec.md` regle 1 (`syncCursor`)
- au seek, seuls les events materialises (`endEmit`, `events` de
  `endCapture`) sont rejoues ; le tracking intermediaire, y compris l'effet
  visuel produit par `trackCommand`, n'est jamais reconstitue tel quel — sa
  trace au seek est entierement portee par ce que `endCapture`/`endEmit`
  materialisent

5. Resolution de `action`

- tout perso declarant `actionName` dans ses `actions` recoit la
  `CaptureAction`, au meme titre qu'un event standard adresse par nom
- le player resout `actionName` vers le renderer ; l'auteur d'une capture ne
  recoit et ne manipule jamais de reference a un node runtime
- `trackCommand` n'a pas acces a `context.api` ni a aucune primitive
  d'acces direct aux nodes : la seule sortie possible pendant le tracking est
  la `CaptureAction`, resolue exclusivement par le player
- seules les cles `style` et `attr` de `CaptureAction.data` sont appliquees
  en direct pendant le tracking, chacune restreinte a des valeurs `number`/
  `string` par propriete ; toute autre cle presente dans `data` n'a aucun
  effet visuel pendant le tracking (elle ne devient utile qu'au commit final,
  voir plus bas)
- `style` et `attr` s'appliquent chacun directement au node runtime, jamais a
  travers `component.update()` : un composant ne peut jamais intercepter ni
  reinterpreter une valeur de tracking, quelle que soit sa cle (`style` ou
  `attr`) ; seul le commit final (`endEmit`/`endCapture` -> `Strap` ->
  `perso.actions[eventName]`) passe par la resolution d'action normale d'un
  composant
- `style` transite par le canal `CaptureUpdate` dedie (implementation de
  reference : anime.js `createAnimatable`) : jamais `enqueueCommit`/
  `director`/une transition normale, jamais de nouvelle transition creee par
  frame quel que soit le volume de tracking (voir
  `2026-07-21-capture-animatable-channel-plan.md`) — adapte a des valeurs
  simples interpolables (transforms, couleurs)
- `attr` n'emprunte PAS ce canal : un attribut comme un `d` de path SVG n'a
  pas de forme interpolable generique (confirme empiriquement — l'animateur
  generique de reference l'ecrit comme une propriete CSS `d` invalide plutot
  que l'attribut reel), et `trackCommand` recalcule de toute facon la valeur
  complete a chaque tick, sans besoin d'interpolation entre deux valeurs.
  `attr` est donc un `setAttribute` direct et immediat sur le node, distinct
  du canal `CaptureUpdate` — une divergence de mecanisme assumee, pas une
  seconde cle du meme canal

6. Convention de nommage (non normative)

- il est recommande de prefixer `actionName` par `capture_` (ex:
  `capture_turret_move`) lorsque l'action est destinee a recevoir une
  `CaptureAction` de `trackCommand`, pour la distinguer au premier coup
  d'oeil d'une action ciblee par un `event` standard
- cette convention est une recommandation de lisibilite, pas une regle
  verifiee ou imposee par le runtime : une action prefixee `capture_` reste
  une action `perso.actions` ordinaire a tout autre egard

7. Isolation vis-a-vis du strap

- une capture n'est pas un `Strap` : `initCaptureState`/`trackCommand`/
  `endCapture` sont portes directement par `CaptureDeclaration`, jamais
  adresses par nom dans une collection separee, et ne sont jamais invoques
  par `story.listen`/`scene.listen`
- ni `trackCommand` ni `endCapture` n'ont acces a `context.planned`/
  `context.live` : une capture ne peut structurellement pas se substituer a
  la mecanique de planification normale (helpers, tick, tracks de strap)

8. Portee de `state`

- le `state` recu par `initCaptureState` et `endCapture` est le meme `state`
  que celui defini par `v1-strap-spec.md` pour un story-strap : celui de la
  story du perso qui declare la capture
- il n'existe pas de state propre a la capture au-dela de `captureState`
  (memoire ephemere, voir regle 1) ; `state` reste la seule source
  canonique et persistante, au meme titre que pour un `Strap`

9. Appartenance

- une capture appartient toujours a la story du perso qui la declare : une
  capture est portee par `perso.emit[...].capture`, et un perso n'existe que
  dans exactement une story — il n'y a pas de niveau "scene-capture"
  equivalent au scene-strap, faute d'un perso qui vivrait hors story
- `initCaptureState`/`trackCommand`/`endCapture` sont des fonctions portees
  directement dans le `CompiledScene` (au meme titre que `StoryDef.straps`
  ou `listen[].transform`) ; aucune injection separee au niveau
  `PlayerInitInput` n'est necessaire pour la capture

10. Extension narrow a la fermeture

- une capture peut avoir besoin, une seule fois, d'une valeur que seule la
  couche possedant l'acces au node du perso peut produire (ex: une cible de
  drop resolue par hit-test, un offset ecran mesure par
  `getBoundingClientRect`) — une donnee que ni `trackCommand` ni
  `endCapture` ne peuvent calculer eux-memes, faute d'acces node (regle
  5/7)
- cette valeur est fournie par un canal narrow, distinct de
  `trackCommand`/`endCapture`, appele une seule fois a la fermeture
  (`onEnd`), avant que `endCapture`/`endEmit` lisent `captureState` —
  jamais par tick, jamais expose a l'auteur de la capture comme un acces
  direct au node
- la valeur resolue est fusionnee dans `captureState` a cet instant precis,
  avant l'appel a `endCapture` et avant la resolution du fallback
  `endEmit.data ?? captureState` (regle 3) — le strap declenche en fin de
  capture recoit ainsi toujours une donnee deja complete
- exemple existant : la resolution de la cible de drop d'une capture dnd
  (`captureState.dropIn`), qui fusionne `move` (`parentId`/`mode`/
  `flipMode`) dans `captureState` a `onEnd`, avant toute lecture par
  `endCapture`/`endEmit`
- ce canal est reserve aux valeurs qu'aucun autre mecanisme de la capture ne
  peut produire ; il ne se substitue jamais a `trackCommand`/`endCapture`
  pour un calcul que l'auteur peut faire lui-meme

## Invariants Capture V1

- le tracking d'une capture n'est jamais materialise en track ni rejoue au
  seek, y compris les `CaptureAction` et `captureState`
- une capture ne declare jamais de liste explicite de persos cibles ; le
  routage de `endEmit`/`endCapture` passe par le nom d'event et celui de
  `trackCommand` par le nom d'action, comme `emit`/`listen`
- `initCaptureState`, `trackCommand`, `endEmit` et `endCapture` sont quatre
  mecanismes independants, tous optionnels
- `endCapture` n'a pas de `update` : il ne mute jamais `state`, ni
  directement ni indirectement ; toute mutation passe par un `Strap`
  declenche via `listen` sur un `event` emis par `endCapture` ou `endEmit`
- `endCapture` n'est jamais asynchrone ; un traitement asynchrone declenche en
  fin de capture passe exclusivement par un strap invoque via un des `events`
  emis, jamais par `endCapture` lui-meme
- `endEmit` et les `events` de `endCapture` transitent par le pipeline
  `emitRuntimeEvent` standard : aucune garantie d'ordre d'execution n'existe
  entre plusieurs events emis en fin de capture des lors qu'un strap
  declenche peut etre asynchrone
- l'ancrage temporel (`duration`/`durationMode`) des `events` de `endCapture`
  est un choix visuel, sans rapport avec la securite anti-rejeu deja assuree
  par le curseur du track manager (`v1-seek-spec.md`)
- `captureState` est initialisee depuis `state` par `initCaptureState` (ou
  `{}` par defaut), puis vit et evolue hors de `state`, exclusivement pour
  la duree de vie de la capture qui l'a creee
- `endCapture` ne recoit que le tableau brut de `CaptureSample` et la
  derniere valeur de `captureState`, jamais une version deja transformee du
  cumul
- tout `event` retourne par `endCapture` est persist-only du seul fait de son
  placement en retour de `endCapture` ; aucun marqueur explicite n'est requis
- ni `trackCommand` ni `endCapture` ne peuvent emettre d'`event` applique en
  direct, planifier une occurrence, ou acceder directement aux nodes runtime
- une `CaptureAction` n'est jamais un `event` et n'est jamais materialisee ;
  seul le player la resout vers le renderer
- l'ecoute `trackOn`/`endOn` n'est jamais bornee au node du perso qui
  declare la capture ; elle continue de produire des `CaptureSample` meme
  si le pointeur quitte visuellement ses bornes
- `endEmit.data` absent retombe sur `captureState` a la fermeture : le seul
  moyen d'exposer le resultat de `trackCommand` a un `Strap` sans declarer
  `endCapture`
- une valeur necessitant l'acces au node (offset ecran, hit-test) ne peut
  etre produite que par un canal narrow resolu une seule fois a la
  fermeture, jamais par `trackCommand`/`endCapture` eux-memes

## Exemple applique - deplacement clavier borne

Contexte : une story `world` affiche un perso `turret`, un canon mobile
horizontalement dans une scene de tir. Le joueur le deplace au clavier
(`ArrowLeft`/`ArrowRight`) le temps de viser, avant de tirer via une autre
action non montree ici. Le canon ne doit jamais visuellement sortir de la
zone de jeu, meme pendant un appui prolonge.

Use case:

- perso `turret`, deplacement horizontal borne entre `70` et `930` (les
  bords gauche/droit de la zone de jeu)
- maintien de `ArrowLeft`/`ArrowRight` : deplacement continu, vitesse
  constante, jamais visuellement au-dela des bornes pendant le maintien
- relachement (`keyup`) : la position finale devient la valeur canonique
  dans `state`

Squelette de la scene : la story `world` declare `turretX` dans son `state`
initial — c'est cette valeur, ecrite au depart et mise a jour par
`endCapture` a chaque capture suivante, qu'`initCaptureState` lit :

```ts
const scene: SceneDoc = {
  id: "space-bubbles",
  stories: {
    world: {
      id: "world",
      initial: { move: "@root" },
      persos: [
        turretPerso   // defini plus bas, avec sa declaration capture
        // ...autres persos de la story
      ],
      straps: undefined,
      listen: [],
      init: () => ({
        turretX: 500
        // ...reste du state de la story
      })
    }
    // ...autres stories
  },
  initial: undefined,
  straps: undefined,
  listen: [],
  init: () => undefined,
  tracks: {}
}
```

Les fonctions de capture sont ecrites directement dans la declaration
`capture`, comme des `StrapFn`/`TransformFn` le sont deja ailleurs dans
codplay :

```ts
const TURRET_SPEED_PX_PER_S = 520
const TURRET_MIN_X = 70
const TURRET_MAX_X = 930

type WorldStoryState = { turretX: number }
type TurretCaptureState = { x: number }

function clampTurretX(x: number): number {
  return Math.max(TURRET_MIN_X, Math.min(TURRET_MAX_X, x))
}

const initTurretCaptureState: CaptureInitFn = ({ state }) => {
  const worldState = state as WorldStoryState
  return { x: worldState.turretX }
}

const trackTurret: CaptureTrackFn = ({ sample, captureState }) => {
  const keySample = sample as KeyboardCaptureSample
  const turretCaptureState = captureState as TurretCaptureState
  const direction = keySample.keyCode === "ArrowLeft" ? -1 : 1
  const x = clampTurretX(turretCaptureState.x + direction * TURRET_SPEED_PX_PER_S * (keySample.deltaMs / 1000))

  return {
    action: { actionName: "capture_turret_move", data: { style: { x } } },
    captureState: { x }
  }
}

const endTurretCapture: CaptureEndFn = ({ captureState }) => {
  const turretCaptureState = captureState as TurretCaptureState
  return { events: [{ name: "turret:capture:settled", data: { x: turretCaptureState.x } }] }
}

const turretPerso = {
  id: "turret",
  actions: {
    capture_turret_move: {}
  },
  emit: {
    keydown: [
      {
        keyCode: "ArrowLeft",
        event: { name: "turret:key:start" },
        capture: {
          trackOn: ["keydown"],
          endOn: ["keyup"],
          initCaptureState: initTurretCaptureState,
          trackCommand: trackTurret,
          endCapture: endTurretCapture
        }
      },
      {
        keyCode: "ArrowRight",
        event: { name: "turret:key:start" },
        capture: {
          trackOn: ["keydown"],
          endOn: ["keyup"],
          initCaptureState: initTurretCaptureState,
          trackCommand: trackTurret,
          endCapture: endTurretCapture
        }
      }
    ]
  }
}
```

`endTurretCapture` ne mute jamais `state` lui-meme : il emet
`turret:capture:settled`, route par la story vers un strap qui applique
`update` avec le mecanisme deja connu (`v1-strap-spec.md`) :

```ts
const straps: StrapCollection = {
  "turret-settle": ({ event }) => ({
    update: { turretX: (event.data as { x: number }).x }
  })
}
```

```ts
listen: [
  { on: "turret:capture:settled", straps: ["turret-settle"] }
]
```

`turretPerso` est ensuite place dans `stories.world.persos` (voir le
squelette de scene plus haut) et compile normalement — `initCaptureState`/
`trackCommand`/`endCapture` traversent le Builder tels quels, sans
extraction ni resolution par nom, exactement comme le `straps: undefined`
de cette meme story porterait de vraies `StrapFn` s'il en declarait. Rien
d'autre a fournir a `player.init()` pour cette capture :

```ts
await player.init({
  mountTarget,
  compiledScene
})
```

Ce que cet exemple illustre :

- `initTurretCaptureState` lit `state.turretX` une seule fois, a l'ouverture
  de la capture — la borne gauche-droite-gauche-gauche-droite reste
  coherente d'une capture a l'autre sans jamais lire le DOM
- `trackTurret` borne `x` a chaque tick via `captureState`, jamais via
  `state` (inaccessible ici) ni via une lecture de pose du node
- le mouvement visuel passe par une valeur `to` absolue deja bornee, portee
  par `action.data`, appliquee a l'action `capture_turret_move` du perso —
  aucun acces direct au node
- `endTurretCapture` ne recalcule rien depuis `samples` : la position bornee
  est deja disponible dans `captureState`, portee telle quelle dans le
  `data` de l'event `turret:capture:settled`
- `endTurretCapture` ne mute jamais `state` lui-meme ; c'est le strap
  `turret-settle`, declenche via `listen`, qui applique `update` avec le
  mecanisme deja connu des straps

## Exemple applique - drag pointeur avec substitution economique

Contexte : une story `s5-drag-story` affiche un perso `draggable`, deplace
librement a la souris/au toigt. Contrairement au turret, aucune borne : le
perso suit le pointeur pendant le geste, puis sa position finale est
persistee. Au seek, il n'est pas necessaire de rejouer le trajet exact —
une seule transition animee, du point de depart au point d'arrivee, suffit
a reconstituer visuellement le geste avec un minimum de donnees. C'est le
regime economique de `endCapture`, oppose au regime "trajet conserve"
qu'exigerait par exemple un trace de dessin (hors scope de cet exemple).

```ts
type DragStoryState = { draggableX: number; draggableY: number }
type DragCaptureState = { x: number; y: number }

const initDragCaptureState: CaptureInitFn = ({ state }) => {
  const dragState = state as DragStoryState
  return { x: dragState.draggableX, y: dragState.draggableY }
}

const trackDrag: CaptureTrackFn = ({ sample, captureState }) => {
  const pointerSample = sample as PointerCaptureSample
  const dragCaptureState = captureState as DragCaptureState
  const x = dragCaptureState.x + pointerSample.movementX
  const y = dragCaptureState.y + pointerSample.movementY

  return {
    action: { actionName: "capture_draggable_move", data: { style: { x, y } } },
    captureState: { x, y }
  }
}

const endDragCapture: CaptureEndFn = ({ captureState, state }) => {
  const dragCaptureState = captureState as DragCaptureState
  const dragState = state as DragStoryState

  return {
    events: [
      {
        name: "draggable:dropped",
        data: {
          x: dragCaptureState.x,
          y: dragCaptureState.y,
          style: {
            x: { from: dragState.draggableX, to: dragCaptureState.x },
            y: { from: dragState.draggableY, to: dragCaptureState.y }
          }
        }
      }
    ],
    durationMode: "capture"
  }
}

const draggablePerso = {
  id: "draggable",
  actions: {
    capture_draggable_move: {},
    "draggable:dropped": {}
  },
  emit: {
    pointerdown: {
      event: { name: "draggable:grabbed" },
      capture: {
        trackOn: ["pointermove"],
        endOn: ["pointerup"],
        initCaptureState: initDragCaptureState,
        trackCommand: trackDrag,
        endCapture: endDragCapture
      }
    }
  }
}
```

`endDragCapture` ne mute jamais `state` lui-meme : `draggable:dropped` porte
a la fois la transition visuelle (`style`) consommee par l'action perso, et
la position finale brute (`x`/`y`) que le strap suivant applique a `state` :

```ts
const straps: StrapCollection = {
  "drag-settle": ({ event }) => {
    const data = event.data as { x: number; y: number }
    return { update: { draggableX: data.x, draggableY: data.y } }
  }
}
```

```ts
listen: [
  { on: "draggable:dropped", straps: ["drag-settle"] }
]
```

Le `sample` d'un `pointermove` est un `PointerCaptureSample` : il porte a la
fois la position absolue (`clientX`/`clientY`) et le delta natif depuis le
dernier `pointermove` (`movementX`/`movementY`), fournis tels quels par le
navigateur, sans transformation. `trackDrag` n'utilise ici que
`movementX`/`movementY`, mais la forme absolue reste disponible si un autre
usage en a besoin.

Ce que cet exemple ajoute par rapport au turret :

- pas de bornage : `trackDrag` suit le pointeur sans clamp, `captureState`
  accumule simplement la position courante
- `endDragCapture` ne retourne que `events`, jamais `update` : la position
  finale (`x`/`y`) et la transition visuelle (`style`) voyagent ensemble
  dans le meme `draggable:dropped`, consommees respectivement par le strap
  `drag-settle` (via `listen`) et par l'action perso
- l'event `draggable:dropped` porte une transition complete `{from, to}` en
  un seul point — le trajet intermediaire (chaque `pointermove`) n'est
  jamais reconstruit au seek, conformement a la regle de Materialisation
- `style.x/y` n'a pas besoin de `duration` : `durationMode: "capture"` fait
  que le player mesure lui-meme la duree reelle du geste (entre l'ouverture
  de la capture et `endOn`) et la propage dans `style.x/y.duration` en plus
  de l'ancrage `ms` de l'event — la transition de substitution demarre a
  `ms` et se termine exactement au moment ou `endOn` (`pointerup`) s'est
  reellement produit, sans que `endDragCapture` ait a mesurer ou reporter
  cette duree lui-meme
- l'event `draggable:dropped` n'est jamais emis en direct (il est
  persist-only par construction, voir Phase de fin) : le deplacement visible
  pendant le geste est deja entierement produit par `trackCommand`
