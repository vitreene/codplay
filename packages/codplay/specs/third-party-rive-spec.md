# Spécification Rive V2 — host, document et state machine

> Statut : **En cours — port V1 réalisé, chemin lip-sync validé dans Safari, validation complète ouverte**.

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
  id: 'lip-sync',
  type: 'rive-state-machine',
  initial: {
    stateMachine: 'State Machine 1',
    lipSyncInput: 'lips sync id',
    emotionInput: 'emotion',
    rel: { target: { scene: 'rive-scene', perso: 'avatar' } },
  },
  actions: {
    start: { broadcast: { type: 'START' } },
    viseme: { viseme: 'PP' },
    emotion: { emotion: 1 },
  },
}
```

La relation cible le `perso` host qui publie le document. Dans le vocabulaire
de l’architecture, ce `perso` est le host ; le champ `scene` de la forme
relationnelle actuelle est seulement l’identifiant de la scène compilée. Le
composant state machine ne reçoit pas `move`.

Le lip-sync est l’identifiant du composant state machine (`lip-sync` dans
l’exemple), pas une propriété du document générique. `lipSyncInput` et
`emotionInput` désignent des inputs natifs du document fourni par l’auteur.
Le composant ne garantit pas que ces conventions internes existent ; il les
utilise lorsque le host les expose.

## Propriété des ressources et du rendu

- `RIVE_LIBRARY` est préparée une fois par engine et injectée aux classes ;
- `RIVE_PRELOAD_STRATEGIES` charge le fichier et conserve la ressource dans le
  cache du package ;
- `RiveDocumentComponent` possède le renderer, l’artboard et les instances
  d’animations linéaires ;
- `RiveStateMachineComponent` possède son instance native et la libère ;
- le host publie une cible opaque stable dont la révision change lorsqu’il
  reconstruit son artboard ;
- le host avance et dessine en phase `commit`, après les contributions logiques
  de la state machine ;
- un retour temporel reconstruit l’artboard et l’instance state machine ;
- `destroy()` libère chaque ressource par son propriétaire.

Le runtime ne charge pas de ressource dans un constructeur ou dans `update()`.
Le host lit uniquement une ressource déjà préparée par le preload.

## Port de la démo Rive V1

La démo V2 `packages/demos/src/v2/demos/rive/` reprend le parcours V1 complet
avec le même document `/avatars/coach.riv`, le même audio
`/assets/1_7b_e.mp3`, le même artboard et la même state machine :

- les cues Rhubarb sont convertis en noms de visèmes attendus par l'action
  `avatar:viseme` lors de la construction des eventimes ;
- les eventimes `avatar:viseme` portent directement ces noms jusqu'au composant
  `lip-sync`, qui les projette sur l'input numérique Rive ;
- les mots sont affichés dans le composant `tag` de caption ;
- `audio`, `avatar` et `lip-sync` démarrent à l’eventime zéro ;
- la séquence conserve sa fin à `18_500` ms.

Les données de cues et leur conversion sont portées dans la démo V2 sans
importer le runtime V1. La relation entre l'avatar et les inputs internes du document reste
une convention du fichier Rive choisi pour cette démonstration ; CodPlay ne
cherche pas à inventer ou valider les nœuds internes du modèle.

## Validation

La validation du module porte sur la forme minimale des profils et actions :
`src`, `stateMachine`, les noms d’inputs, les broadcasts, `viseme` et
`emotion`. Elle ne tente pas d’inspecter un fichier Rive ni son artboard.

Les tests d’intégration du package utilisent leurs propres artboards, runtime
et state machines synthétiques. Ils ne lisent pas la scène de démonstration et
ne déduisent pas leurs valeurs de ses timings. La démo V2 est réservée à la
validation réelle du chemin navigateur engine → preload → host → state machine
→ audio/captions → play/seek/destroy.
