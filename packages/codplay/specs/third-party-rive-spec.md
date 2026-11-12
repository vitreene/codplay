# Spécification Rive V2 — document, state machine et ViewModel

> Version de référence : CodPlay V2 — 2026-11-10.

## Périmètre vérifié

Le contrat décrit le host Rive, ses inputs de state machine et le binding
ViewModel. Les fixtures vérifient ces comportements avec leurs données natives
et un runtime synthétique ; le parcours ViewModel a également été exercé dans
Safari avec Rive 2.38.3 et le fichier `my-matt-visemes.riv`. Les autres parcours
des intégrations tierces restent suivis dans le
[plan des composants tiers](../plan/2026-09-18-third-party-components-v2-plan.md).

## Rôle

Le module Rive adapte la bibliothèque Rive au circuit des composants tiers
CodPlay. Il réutilise le runtime engine, le preload player, l’horloge et le
commit V2. Il ne crée ni player, ni catalogue, ni boucle de rendu privée.

Le découpage est volontairement composé :

- `rive` est le host matérialisé qui possède le canvas, la ressource, l’artboard,
  les animations linéaires et le rendu ;
- `rive-state-machine` est un composant logique attaché au host par `rel` et
  possède uniquement l’instance native de state machine et ses inputs ;
- `rive-view-model` est un autre composant logique attaché au même host : il
  possède sa state machine et une instance ViewModel exportée, et partage le
  cycle du contrôleur existant. Il ne s’ajoute pas à `rive-state-machine` pour
  piloter la même machine.

Le host est le seul composant Rive qui reçoit `move`. La state machine ne
produit pas de markup et ne connaît pas le DOM.

## Organisation du code auteur

Dans `packages/authoring/component-v2/src/rive/`, `core/` contient le host,
le preload, les types et validations transversales, et l’assemblage de
l’engine. `state-machine/` possède son composant et sa validation ; sa classe
sert de base au composant isolé dans `view-model/`, qui possède aussi ses
transitions et sa validation. `src/rive/index.ts` réexporte ces composants.
La composition des stories est séparée dans `packages/authoring/story/` et
consomme l’API des composants sans s’installer dans leur package.

## Surface auteur

### Document Rive

```ts
{
  id: 'avatar',
  type: 'rive',
  initial: {
    src: '/avatars/coach.riv',
    artboard: 'Coach model',
    animations: [],
    move: { target: 'stage' },
  },
  actions: {
    start: { broadcast: { type: 'START' } },
  },
}
```

`src` est préchargé par la stratégie `rive` et l’extension `.riv` est dérivée
par le builder. `artboard` et `animations` restent des noms propres au
document Rive : CodPlay ne vérifie pas leur présence dans le fichier. Quand
`animations` est absent, le host joue les animations linéaires de l’artboard.
Le composant accepte `START`, `PAUSE` et `STOP`.

### State machine

```ts
{
  id: 'state-machine',
  type: 'rive-state-machine',
  initial: {
    stateMachine: 'State Machine 1',
    rel: { host: 'avatar' },
  },
  actions: {
    start: { broadcast: { type: 'START' } },
    setMood: { inputs: { mood: 1 } },
  },
}
```

La relation cible directement le host qui publie le document. `target` reste
disponible lorsqu’un host publie plusieurs capacités nommées ; il ne désigne
jamais un nœud interne du document Rive. Le composant state machine ne reçoit
pas `move`.

Les noms d’inputs et leurs valeurs sont des conventions du document fourni par
l’auteur. Le composant state machine transmet uniquement les entrées nommées
par l’auteur ; il ne connaît aucune sémantique de lip-sync, de visème ou
d’émotion.

### ViewModel

```ts
{
  id: 'expression',
  type: 'rive-view-model',
  initial: {
    rel: { host: 'avatar' },
    stateMachine: 'Matt_Visemes_SM',
    viewModel: 'VisemesVM',
    instance: 'Instance',
    blendSpeed: 18,
    values: { v100: 100, v102: 0, isTalking: false },
  },
  actions: {
    speak: { values: { v100: 0, v102: 100, isTalking: true } },
    turn: { values: { headX: 75 } },
    rest: { values: { v100: 100, v102: 0, isTalking: false } },
  },
}
```

`stateMachine`, `viewModel` et `instance` sont des sélections explicites non
vides. La ressource vient du host : le composant ne reçoit pas un deuxième
`src`. `values` associe des noms de propriétés racines à des nombres finis ou
des booléens. Les propriétés imbriquées, triggers, chaînes, listes et autres
types ViewModel ne sont pas pris en charge. Les noms ne constituent pas des
chemins interprétés par CodPlay.

`blendSpeed` est facultatif et doit être un nombre fini positif ou nul. Omettre
ce réglage ou lui donner `0` applique les valeurs numériques immédiatement.
Pour une valeur positive, le composant échantillonne les nombres à l’instant
absolu du player avec `cible + (source - cible) × exp(-blendSpeed × durée)`, où
la durée est en secondes. Le seuil de convergence de `0,05` reproduit le
comportement du réglage Blend speed du
[testeur de référence](https://www.animattor.co/viseme-tester). Les booléens,
dont `isTalking`, restent immédiats. Le réglage s’applique à toutes les
propriétés numériques racines, y compris `headX`, `headY` et `headTilt`.

Dans le testeur, ce réglage lisse les poids de bouche. Le suivi caméra de la
tête est une autre voie : son contrôle `Smoothing` applique un coefficient par
frame aux mesures live et ne produit pas de piste exportée dans le JSON de
visèmes. CodPlay applique la transition sur le temps absolu aux événements de
tête explicitement enregistrés ; cela rend ces événements seekables, sans
prétendre reconstruire les mouvements webcam live.

À chaque occurrence portant `values`, la source numérique est échantillonnée à
l’heure de cette occurrence avant d’appliquer son patch. Les patches partiels
conservent ainsi les cibles précédentes et les transitions restent continues
quand une nouvelle valeur arrive avant convergence.

À chaque présentation, le composant restaure les valeurs exportées des
propriétés numériques/booléennes, puis applique `initial.values` et les valeurs
de l’état logique résolu. Un patch partiel conserve donc les contributions
antérieures encore dues. Une propriété dont la contribution a disparu après
reconstruction retrouve son override initial ou son défaut exporté ; aucune
valeur native issue d’une visite future ne devient une donnée auteur.

Le composant partage les broadcasts natifs `START`, `PAUSE`, `STOP` du
contrôleur de state machine. Sans action broadcast déclarée, il démarre en
lecture ; avec de telles actions, il attend `START`. `PAUSE` arrête l’avancement
positif de la machine tout en permettant la projection de nouvelles valeurs.
`STOP` recrée sa machine et son ViewModel et présente les valeurs initiales ;
`START` reprend les valeurs logiques dues. Ces broadcasts ne remplacent pas le
transport du player : `instance.telco.pause()` et `reset()` restent ses commandes.

`activeActions` est un instantané temporel : une occurrence persistante y reste
présente lors des mises à jour suivantes, sans être un nouveau broadcast.
L’effet d’horloge de `START` et `PAUSE`, ainsi que la recréation de `STOP`, ne
s’exécutent qu’à l’entrée de leur occurrence dans cet instantané. Une mise à
jour de visème ne remet donc pas le temps natif à l’occurrence `START` ; Rive
reçoit le delta entre deux présentations. Un retour temporel retire les
occurrences futures de l’instantané ; en les recroisant, leurs effets peuvent
se produire de nouveau.

Les erreurs de sélection native ou de propriété absente/incompatible sont
explicites et remontent par les diagnostics existants du runtime. La validation
auteur contrôle la forme et les types scalaires ainsi que la plage de
`blendSpeed` ; la présence et le type exact dans le fichier ne peuvent être
vérifiés qu’après preload et binding.

### Seek narratif du ViewModel

Le Seek garantit les contributions CodPlay dues à T, y compris celles d’un
événement antérieur qui restent applicables. Le composant projette l’état
reconstruit par le player ; il ne construit ni journal ni replay parallèle.
Les événements runtime empruntent le même journal que les événements déclarés.

Lors d’un retour temporel, l’artboard est préparé avant le binding même si le
composant logique précède le host dans les données auteur. Les valeurs sont
appliquées avant l’avancement natif ; un delta nul permet leur présentation
pendant une pause ou après un événement au même instant. Le host redessine
alors au commit, même sans changement de temps.

Les procédés internes Rive ne sont pas reconstruits par rejeu de la scène :
idle, clignements libres, transitions ou autres phases natives peuvent différer
entre lecture et Seek. Le contrat porte sur les commandes et valeurs dues,
pas sur une égalité pixel à pixel ni sur la phase exacte de la machine native.
Un geste narratif doit être porté explicitement par les données CodPlay.

## Propriété des ressources et du rendu

- `RIVE_LIBRARY` est préparée une fois par engine et injectée aux classes ;
  dans `component-v2`, le runtime bas niveau vient de
  `@rive-app/canvas-advanced-single@2.38.3`, chargé en ESM par le preload ;
- `RIVE_PRELOAD_STRATEGIES` charge le fichier et conserve la ressource dans le
  cache du package ;
- `RiveDocumentComponent` possède le renderer, l’artboard et les instances
  d’animations linéaires ;
- `RiveStateMachineComponent` possède son instance native ;
- `RiveViewModelComponent` possède également son instance ViewModel et les
  références de propriétés associées, distinctes pour chaque composant ;
- le host publie une cible opaque stable dont la révision change lorsqu’il
  reconstruit son artboard ;
- le host avance et dessine en phase `commit`, après les contributions logiques
  de la state machine ;
- aucun composant Rive ne possède d’horloge ni de boucle de rendu autonome :
  `advance` et `draw` ne reçoivent du temps que dans les animations
  enregistrées sur la présentation CodPlay ; l’état `playing` ou un broadcast
  `START` n’avance rien sans progression CodPlay ;
- un retour temporel reconstruit l’artboard.

Avant de libérer ou reconstruire l’artboard, le host demande aux composants
attachés de libérer leurs machines et bindings natifs. Les machines sont
détruites avant leur artboard, puis les références ViewModel sont relâchées.
L’abonnement est retiré à la destruction du composant logique. Ce raccord se
situe dans la cible Rive opaque existante, sans modification du core.

Cette ordonnance répond à une erreur WASM reproduite sur un deuxième Seek :
l’ancien ordre détruisait l’artboard avant `StateMachineInstance.delete()`.
La fixture de régression refuse désormais toute destruction d’une machine
après son artboard, dans les deux ordres de déclaration auteur.

Le runtime ne charge pas de ressource dans un constructeur ou dans `update()`.
Le host lit uniquement une ressource déjà préparée par le preload.

La [story d’avatar Rive parlant](../../authoring/story/specs/rive-talking-avatar-story-spec.md)
assemble ces composants avec une voix et des pistes déjà horodatées. Son
contrat de construction reste distinct du binding natif décrit ici.

## Validation

La validation du module porte sur la forme minimale des profils et actions :
`src`, `stateMachine`, les patches `inputs` et les broadcasts. Elle ne tente
pas d’inspecter un fichier Rive ni son artboard.

[`rive-integration.spec.ts`](../../authoring/component-v2/tests/rive-integration.spec.ts)
vérifie l'avancement sur le temps CodPlay, le commit, les inputs nommés, les
broadcasts, le rebuild au Seek et la stabilité de la cible.
Il vérifie aussi que deux mises à jour de visèmes sous le même `START` actif
font avancer la machine par deux deltas consécutifs de 100 ms et qu’un `STOP`
persistant ne recrée pas la machine à chaque mise à jour.
[`rive-preload.spec.ts`](../../authoring/component-v2/tests/rive-preload.spec.ts)
vérifie le passage du document par la frontière de preload. Ces fixtures
possèdent leurs artboards, runtime et state machines synthétiques ; elles ne
lisent pas la scène de démonstration.
Le module ESM est aussi servi et initialisé par l’asset server Remix Elcé ; la
démo CodPlay V2 charge le même paquet avec le fichier Matt réel. La validation
de l’intégration à l’aperçu d’un projet Elcé reste suivie dans le
[plan tête parlante](../../elce/plan/2026-11-04-talking-head-plan.md).

[`rive-view-model.spec.ts`](../../authoring/component-v2/tests/rive-view-model.spec.ts)
vérifie les sélections, types natifs, défauts, deltas nuls et broadcasts, ainsi
que la transition exponentielle des propriétés numériques, l’immédiateté des
booléens et la continuité entre deux patches.
[`rive-view-model-player.spec.ts`](../../authoring/component-v2/tests/rive-view-model-player.spec.ts)
exerce builder, moteur, matérialisation HTML, journal, rendu au commit, Seek
direct/arrière/aux frontières, événements runtime, Play/Pause/reset/rejeu,
isolation, ordre host/enfant et destruction ; il vérifie aussi qu’un Seek
arrière puis avant restitue les mêmes poids de bouche et de tête. Les scènes de
test sont propres aux tests et leurs données auteur sont sérialisées avant
construction.

Le [relevé navigateur du 4 novembre 2026](../../elce/notes/assets/talking-head/rive-player-acceptance.json)
borne la preuve native à ce fichier, cette version et Safari : preload réel,
commandes bouche/tête, événements au même instant, broadcasts, retour temporel,
resize CSS, destruction et remontage. Les phases natives libres ne servent pas
de critère d’égalité d’image. La persistance applicative Elcé, le nouveau
scénario de démo et les autres familles Rive restent hors de cette preuve.
Le POC Elcé exerce aussi le chemin réel Sighty/CodPlay : un Seek telco à 1 s
puis à 7,5 s change le rendu du canvas Rive ; après Pause à 7,5 s, le rendu et
le temps restent stables pendant 1,2 s. Ces observations sont suivies dans le
[plan tête parlante](../../elce/plan/2026-11-04-talking-head-plan.md). Le Play
naturel et la fin restent à vérifier avec une page visible.
