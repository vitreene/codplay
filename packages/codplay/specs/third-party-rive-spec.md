# Spécification Rive V2 — host, document et state machine

## Périmètre vérifié

Le contrat ci-dessous décrit le host Rive et le composant state machine
exercés par les tests d'intégration avec un runtime synthétique. La validation
complète de la démo et du cycle de vie est décrite dans le
[plan des composants tiers](../plan/2026-09-18-third-party-components-v2-plan.md).

## Rôle

Le module Rive adapte la bibliothèque Rive au circuit des composants tiers
CodPlay. Il réutilise le runtime engine, le preload player, l’horloge et le
commit V2. Il ne crée ni player, ni catalogue, ni boucle de rendu privée.

Le découpage est volontairement composé :

- `rive` est le host matérialisé qui possède le canvas, la ressource, l’artboard,
  les animations linéaires et le rendu ;
- `rive-state-machine` est un composant logique attaché au host par `rel` et
  possède uniquement l’instance native de state machine et ses inputs.

Le host est le seul composant Rive qui reçoit `move`. La state machine ne
produit pas de markup et ne connaît pas le DOM.

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

## Propriété des ressources et du rendu

- `RIVE_LIBRARY` est préparée une fois par engine et injectée aux classes ;
- `RIVE_PRELOAD_STRATEGIES` charge le fichier et conserve la ressource dans le
  cache du package ;
- `RiveDocumentComponent` possède le renderer, l’artboard et les instances
  d’animations linéaires ;
- `RiveStateMachineComponent` possède son instance native ;
- le host publie une cible opaque stable dont la révision change lorsqu’il
  reconstruit son artboard ;
- le host avance et dessine en phase `commit`, après les contributions logiques
  de la state machine ;
- un retour temporel reconstruit l’artboard.

Le runtime ne charge pas de ressource dans un constructeur ou dans `update()`.
Le host lit uniquement une ressource déjà préparée par le preload.

## Validation

La validation du module porte sur la forme minimale des profils et actions :
`src`, `stateMachine`, les patches `inputs` et les broadcasts. Elle ne tente
pas d’inspecter un fichier Rive ni son artboard.

[`rive-integration.spec.ts`](../../authoring/component-v2/tests/rive-integration.spec.ts)
vérifie l'avancement sur le temps CodPlay, le commit, les inputs nommés, les
broadcasts, le rebuild au Seek et la stabilité de la cible.
[`rive-preload.spec.ts`](../../authoring/component-v2/tests/rive-preload.spec.ts)
vérifie le passage du document par la frontière de preload. Ces fixtures
possèdent leurs artboards, runtime et state machines synthétiques ; elles ne
lisent pas la scène de démonstration.
