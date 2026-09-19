# Spécification Rive V2 — host, document et state machine

> Statut : **En cours — host, document et state machine générique implémentés ; validation complète ouverte**.

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
- `RiveStateMachineComponent` possède son instance native et la libère ;
- le host publie une cible opaque stable dont la révision change lorsqu’il
  reconstruit son artboard ;
- le host avance et dessine en phase `commit`, après les contributions logiques
  de la state machine ;
- un retour temporel reconstruit l’artboard et l’instance state machine ;
- `destroy()` libère chaque ressource par son propriétaire.

Le runtime ne charge pas de ressource dans un constructeur ou dans `update()`.
Le host lit uniquement une ressource déjà préparée par le preload.

## Application Rive de démonstration

La démo `packages/demos/src/v2/demos/rive/` exerce le host, la state machine,
le même document `/avatars/coach.riv`, le même audio
`/assets/1_7b_e.mp3`, le même artboard et la même state machine :

- les cues sont convertis par l'application en valeurs de l'input nommé du
  document lors de la construction des eventimes ;
- les eventimes portent ensuite des patches `inputs` génériques jusqu'au
  composant state machine ;
- les mots sont affichés dans le composant `tag` de caption ;
- `audio`, `avatar` et la state machine démarrent à l’eventime zéro ;
- la séquence conserve sa fin à `18_500` ms.

Les données de cues et leur conversion sont portées dans l'application de
démonstration. La relation entre l'avatar et les inputs internes du document reste
une convention du fichier Rive choisi pour cette démonstration ; CodPlay ne
cherche pas à inventer ou valider les nœuds internes du modèle.

## Validation

La validation du module porte sur la forme minimale des profils et actions :
`src`, `stateMachine`, les patches `inputs` et les broadcasts. Elle ne tente
pas d’inspecter un fichier Rive ni son artboard.

Les tests d’intégration du package utilisent leurs propres artboards, runtime
et state machines synthétiques. Ils ne lisent pas la scène de démonstration et
ne déduisent pas leurs valeurs de ses timings. La démo V2 est réservée à la
validation réelle du chemin navigateur engine → preload → host → state machine
→ audio/captions → play/seek/destroy.
