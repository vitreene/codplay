# ed2 — Faire piloter la lecture par le moteur codplay, pas par l'éditeur

Plan d'analyse et d'exécution, pas de code à ce stade. Fait suite au constat direct de l'auteur :
« c'est codplay et son tick qui pilotent l'éditeur et pas l'inverse » — confirmé en traçant le code,
pas supposé.

## 1. Constat — deux moteurs de tick, un seul aurait dû exister

### Ce qu'ed2 fait aujourd'hui (le mauvais sens)

`sequence-editor/mount.ts::rafLoop` (son propre `requestAnimationFrame`, ligne 86) appelle
`ctrl.tick(deltaMs)` à chaque frame → `sequence-editor/machine.ts` avance `context.playheadMs`
(assignation locale, ligne 726) → `sequence-editor-bridge.ts:16` relaie ce changement en `SEEK` vers
la machine centrale → `scene-player-bridge.ts` appelle `studio.player.seek({timelineMs})`.

**« Jouer » une scène dans ed2 = appeler `seek()` ~60 fois par seconde**, jamais `player.play()`.
Confirmé en Safari plus tôt cette session : le player réel ne quitte jamais son statut, aucune
notification `subscribeToPlayerState` ne se produit pendant toute la « lecture ».

### Ce que codplay possède déjà (le bon sens, jamais utilisé)

`PlayerFacade.play()` (`create-player.ts`) appelle `startPlaybackLoop()` qui démarre
`this.ticker` — une instance de `TimeTicker` (`core/time/ticker.ts`), **son propre**
`requestAnimationFrame`, avec gestion de la visibilité de l'onglet (pause automatique si masqué) et
un scheduler dédié. Ce ticker pilote `runPlaybackTick()` en autonomie complète : résolution du temps
courant (`resolveCurrentTimelineMs()`), déclenchement des JIT subscribers (`subscribeJitTick`, utilisé
pour l'ordonnancement des straps), déclenchement des eventimes dus (`runDueTimelineEventsSync`) — dont
les transitions inter-keyframes compilées par `buildKeyframeDecorActions`
(`{to, duration, ease}`, résolues ensuite par anime.js, en continu, sans repasser par le player).

**`player.play()` seul suffit** à faire animer une scène compilée du début à la fin, à la fréquence et
à la cadence que le NAVIGATEUR (pas l'éditeur) décide — aucun sondage externe requis pour l'animation
visuelle elle-même.

### Pourquoi c'est une impasse, précisément

`seek()` n'est pas une opération légère symétrique d'un tick interne : `create-player.ts` documente
elle-même (`v1-seek-spec.md`) que seek rejoue les track entries, resynchronise le renderer et
l'horizon, potentiellement replay une portion de l'historique matérialisé. Le coût grandit avec le
nombre d'items/pistes/eventimes de la scène. L'appeler à la cadence d'une boucle rAF (~60/s) transforme
une opération O(scène) en un coût O(scène × 60/s) — pas une inefficacité mineure, une classe de
performance différente. Sur une machine modeste ou une scène chargée, ce n'est pas de la marge perdue,
c'est un plafond dur : la lecture saccade, ou l'éditeur ne peut plus suivre du tout. Confirmé par le
code lui-même (les deux AUTRES sites `emitStateSnapshot()`, hors `setStatus`, s'excluent explicitement
`if (status === playing) return` — le moteur est conçu en sachant que rien ne doit sonder son état à
chaque frame pendant la lecture réelle).

## 2. Architecture cible

```
AVANT (actuel, mauvais sens)                  APRÈS (cible)
                                               
sequence-editor (rAF propre)                  sequence-editor (rAF propre — INCHANGÉ,
   │ tick → playheadMs (local)                   mais ne pilote plus rien du player)
   │                                              │ tick → playheadMs LOCAL, calculé depuis
   ▼                                              │   startPlayheadMs + (nowTs-startWallMs)×rate
SEEK (machine centrale)                           │   — pure lecture, jamais envoyé nulle part
   │                                              ▼
   ▼                                          curseur visuel du playhead (UI only)
scene-player-bridge
   │ studio.player.seek()  ← 60×/s                
   ▼                                          scene-player-bridge
scène recalculée 60×/s                           │ studio.player.play() — UNE SEULE FOIS
(coût O(scène) par frame)                        ▼
                                               TimeTicker (codplay, rAF propre)
                                                  │ runPlaybackTick() en autonomie
                                                  ▼
                                               scène animée en continu (coût interne,
                                               indépendant de l'éditeur)
```

### Étape A — Play/Pause/Stop pilotent le vrai player

`sequence-editor/controller.ts::play()`/`pause()` (et l'équivalent stop) cessent d'être de purs
événements internes à la machine sequence-editor — le pont (`sequence-editor-bridge.ts` ou un nouveau
point d'entrée) doit aussi appeler `studio.player.play()`/`.pause()` réels, via un canal vers
`scene-player-bridge.ts` (même patron que `SEEK`/`PLAYHEAD_PLAYING_CHANGED` déjà esquissé cette
session — mais cette fois pour DÉCLENCHER, pas seulement relayer un drapeau local).

`scene-player-bridge.ts` est le seul endroit qui détient `studio.player` — il doit exposer (ou réagir
à) un nouvel event machine, ex. `PLAYHEAD.REQUEST_PLAY`/`PLAYHEAD.REQUEST_PAUSE`, et appeler
`studio.player.play()`/`.pause()` en retour.

### Étape B — Le curseur de lecture devient une lecture locale, jamais un pilote

`sequence-editor/mount.ts::rafLoop` reste (l'affichage du curseur a besoin de sa propre boucle de
rendu), mais son calcul change de nature :
- Au déclenchement de `play()` : lire `authorApi.getPlayerState()`/une lecture ponctuelle de
  `player.getState().timelineMs` UNE SEULE FOIS, mémoriser `(startPlayheadMs, startWallClockTs)`.
- À chaque frame : `playheadMs = startPlayheadMs + (now - startWallClockTs) * rate` — pur calcul
  local, écrit uniquement dans l'affichage du curseur (le composant DOM de la timeline), **jamais**
  envoyé en `SEEK` vers la machine centrale.
- Le seek RÉEL ne part plus que sur une action explicite et ponctuelle de l'auteur : glisser le
  curseur à la main (`startPlayheadScrub`, déjà correct aujourd'hui, inchangé), ou l'arrêt/fin de
  lecture (resynchronisation ponctuelle, pas un flux continu).

### Étape C — Fin de lecture et resynchronisation

`player.getState().sequenceEnded` (déjà exposé) est la source de vérité pour la fin — pas le calcul
local qui pourrait légèrement dériver sur une scène longue (arrondi rAF cumulé). Piste : le pont
`scenePlayer` observe `sequenceEnded` (déjà accessible via une lecture d'état, pas besoin de sonder à
haute fréquence — un événement de fin existe déjà côté player, `PLAYER_SEQUENCE_EVENT.sequenceEnd`)
et resynchronise le curseur local UNE FOIS à cet instant, pas en continu.

### Étape D — CS pendant la lecture : le fix déjà commencé devient correct tel quel

Une fois l'étape A en place, `player.play()` fait réellement transiter le statut à `'playing'` —
`AuthorApi.subscribeToPlayerState`/`setPartActive('cs', false)`, déjà câblés cette session (avant
l'interruption), deviennent alors le mécanisme SUFFISANT et CORRECT. **Le relais
`PLAYHEAD_PLAYING_CHANGED`/`playingChanged` commencé juste avant ce plan (types.ts,
controller-machine.ts) devient une duplication à retirer**, pas à finir — exactement le risque que ce
plan sert à éviter : ne pas construire un second canal à côté du bon, une fois le bon existant.

## 3. Ce qui NE bouge PAS

- Le modèle de compilation des transitions inter-keyframes (`build-scene.ts::buildKeyframeDecorActions`)
  — déjà correct, déjà pensé pour ce mode de fonctionnement.
- Le scrubbing manuel (`startPlayheadScrub`, glisser le curseur) — un vrai seek ponctuel reste
  l'opération correcte, inchangée.
- `packages/codplay` — aucune modification nécessaire, tout le nécessaire existe déjà
  (`play`/`pause`/`getState`/`onStateChange`/le ticker interne).

## 4. Risques / points à trancher avant exécution

- **Rate variable** : `player`'s `_rate` interne — si ed2 expose un jour une vitesse de lecture
  différente de 1×, le calcul local `startPlayheadMs + elapsed × rate` doit lire ce taux quelque part
  exposé (aujourd'hui non exposé publiquement, à vérifier si besoin réel).
- **Reprise après pause** : `pause()` doit correctement figer `timelineMs` côté player (déjà le cas,
  `PlayerFacade.pause()` existant) — la relecture locale doit se re-seeder depuis cette valeur, pas
  depuis un calcul continu qui aurait dérivé pendant la pause.
- **`followPlayhead`/scroll automatique de la timeline** (`ctx.followPlayhead`, déjà dans
  `rafLoop`) — reste un calcul purement local sur `playheadMs`, inchangé par ce plan.

## 5. Combien de surprises de ce type restent-elles ? — inventaire honnête, pas une estimation

Comptage des instances confirmées, une seule session (2026-07-17), toutes de la même forme
exacte : **une API/interface correcte existe déjà, mais soit jamais appelée, soit contournée par un
mécanisme plus étroit construit à côté** :

1. `selectItem` : no-op même-item jamais dans un plan validé — la sélection ne survivait à aucun commit.
2. Débounce 250 ms jamais remplacé par la cadence de fin de phase pourtant déjà écrite (chantier 3 §6).
3. `AppLayout.tsx` avait déjà le clic-hors-CS + Échap→désélection câblés — near-miss de duplication.
4. `SelectionFrameHandle.sync()` existait, câblé dans les démos, jamais dans `scene-player-bridge.ts`
   (resize/scroll).
5. `mountDecorEditor` abonnait `subscribeToNode` une seule fois, avant tout item attaché — preview
   décor live jamais fonctionnelle depuis la création du fichier.
6. `ITEMS.ATTACH` réinitialisait la présentation (panneau actif) à chaque re-attache, y compris du
   même item — panneau qui saute sur chaque modification.
7. Clic-direct-sur-item → sélection : jamais câblé, malgré la réciproque (clic-hors-CS) déjà présente
   et la résolution DOM→persoId triviale (`base-component.ts`, `id = perso.id`, universel).
8. **Celui-ci** : le moteur de lecture autonome de codplay (`TimeTicker`/`play()`) jamais utilisé,
   remplacé par une simulation coûteuse à base de seeks répétés.

**Réponse honnête à « combien en reste-t-il » : inconnu, et toute estimation serait inventée.** Les 8
ci-dessus ont été trouvés soit par un test manuel de l'auteur qui a révélé un symptôme, soit
incidemment en creusant un sujet voisin — jamais par un audit systématique. Ce qui EST faisable et
mécanique : cross-référencer chaque méthode publique de `AuthorApi`/`PlayerApi`/
`SelectionFrameHandle`/`DecorEditorController` contre les fichiers de `packages/editor/src/app/bridges/`
et repérer celles qui n'apparaissent dans AUCUN appel — un grep systématique, pas une relecture
exhaustive. Proposé comme chantier séparé si utile : transformerait « combien de surprises restent »
d'une question sans réponse fiable en une liste concrète, vérifiable une fois pour toutes.

## 6. Ordre proposé

Étape A (Play/Pause réels) → Étape D (CS pendant lecture, quasi gratuite une fois A faite) → Étape B
(curseur local, retire le seek storm) → Étape C (fin de lecture propre). A et D peuvent se valider
ensemble en une passe Safari ; B est le gros morceau (revoir `rafLoop`) ; C est un raffinement final.
