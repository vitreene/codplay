# Story d’avatar Rive parlant

## Périmètre vérifié

`createRiveTalkingAvatarStory` construit un `StoryDoc<string>` depuis un profil
Rive, une voix et des pistes horodatées. La factory appartient au package
`@codplay/story`, dans `rive-talking-avatar/`. Elle compose les
composants indépendants du package `@codplay/component-v2` ; les deux packages
ne dépendent pas d’Elcé.

Elle assemble les composants `tag`, `media`, `rive` et `rive-view-model`.
Le chargement, l’horloge, les événements, le binding et le rendu restent ceux
de leurs contrats existants. L’appelant enregistre `RIVE_ENGINE` et
`RIVE_PRELOAD_STRATEGIES` avant de construire et préparer sa scène.

Le contrat concerne une story narrée et son API de construction, distincte des
composants Rive. La
compilation de deux identités distinctes est vérifiée ; une lecture simultanée
de plusieurs voix master n’est pas certifiée par cette factory.

## Entrée et sortie

| Champ | Rôle |
| --- | --- |
| `id` | Identité de story et préfixe de tous ses persos et événements. |
| `profile.document` | Source `.riv`, artboard, résolution interne et options de cadrage du host Rive. |
| `profile.viewModel` | State machine, ViewModel, instance exportée, valeurs initiales, booléen `isTalking` requis et `blendSpeed`. |
| `voice` | Source audio et `durationMs`. L’audio est déclaré `sync: 'master'`. |
| `frames` | Patches `{ startAt, values }` du ViewModel, déjà adaptés au rig. |
| `frame` | Destination `move`, classe et style du conteneur visible. |
| `captions` | Intervalles `{ startAt, endAt, text }`, classe et style facultatifs du texte. |

Les temps sont exprimés en millisecondes. La factory conserve les temps et
valeurs fournis ; le mapping des visèmes et un éventuel décalage audio/bouche
appartiennent à l’adaptateur de données du personnage. La sortie reste une
déclaration auteur sérialisable, consommée par `CodPlay.build`.

Le profil et les pistes d’entrée ne sont pas modifiés. Les tableaux d’événements
et les patches de frame construits appartiennent à la story retournée. Cette
API ne définit pas un format persistant de prise ni un format de capture.

## Composition temporelle

Le conteneur porte `${id}-stage`. L’audio et le host Rive y sont placés ; le
contrôleur ViewModel se lie au host `${id}-avatar` par `rel.host`.
Le host sélectionne `animations: []` pour laisser la state machine liée
piloter le rig.

Une occurrence `${id}:start` à zéro démarre l’audio, le host et le contrôleur.
Les frames deviennent des événements `${id}:values` dont les données portent
`values`. L’auto-action du perso de même identité emploie le routage CodPlay
ordinaire. Les sous-titres deviennent des événements `${id}:caption` affichant
le texte au début puis le vidant à la fin de chaque intervalle.

Le booléen initial `profile.viewModel.values.isTalking` est requis. Deux actions
écrivent directement `isTalking: true` à zéro et `isTalking: false` à
`voice.durationMs`.

La factory n’émet ni `scene:end` ni `sequence:end`. Le constructeur de la scène
ou de la page choisit sa fin fonctionnelle. Le Seek et les phases libres du
rig restent régis par la
[spécification Rive](../../../../packages/codplay/specs/third-party-rive-spec.md).

## Placement responsive

Le conteneur reçoit par défaut `position: relative`, une largeur de `100 %`
et un ratio carré. `frame.move` utilise le contrat `move` existant ; les
valeurs `frame.style`, y compris `cqw`, sont transmises sans conversion au
service de style. Les dimensions numériques du profil document règlent le
buffer natif du canvas et ne définissent pas le placement auteur.

La démo borne son cadre à la largeur et à la hauteur disponibles avec
`min(100cqw, 100cqh, 37.5rem)` dans un conteneur CSS de type `size`. Cette
géométrie est une donnée de la démo, consommée par le même service de style ;
elle n’ajoute aucune mesure DOM ou règle de placement au runtime.

## Preuves

- [`rive-talking-avatar-story.spec.ts`](../tests/rive-talking-avatar-story.spec.ts) possède ses
  profils et pistes. Ses quatre tests vérifient deux identités, le routage des
  actions, la compilation, les ressources dédupliquées, les temps, l’audio
  master, les options facultatives et l’absence de mutation des sources.
- Le package `component-v2` passe **72 tests** et `story` ses **4 tests** ;
  leurs typechecks passent, ainsi que le typecheck et le build des démos V2.
- Le [relevé Safari MCP du 4 novembre 2026](../../../../packages/elce/notes/assets/talking-head/rive-talking-avatar-story-acceptance.json)
  exerce la factory dans la démo V2 réelle : voix, Play/Pause, Seek direct et
  arrière, replay, libération des anciens nœuds au remontage et redimensionnement.
  À 7,5 s, le média est à 7,5 s et le sous-titre est « l’espace » ; un retour
  par 1 s restitue les mêmes valeurs ViewModel. Les cadres et sous-titres sont
  contenus à 1280 × 720 et 800 × 900, sans modifier le temps audio.

Le [guide d’usage](../rive-talking-avatar/README.md) fournit un exemple de
story intégrable à une scène.
