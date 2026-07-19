# Guide d'usage Codplay — patterns observés dans les démos

Ce guide n'est pas une spécification. Il documente les usages réels, tels qu'ils
apparaissent dans `packages/demos/src/scenes/` et `packages/demos/src/codplay/`,
au moment de sa rédaction (2026-07-19). En cas de divergence avec
`docs/formalisation/`, la spec fait foi ; ce guide décrit ce que le code fait
en pratique, pas ce qu'il devrait faire.

Chaque affirmation ci-dessous est adossée à un exemple réel avec chemin de
fichier. Si une démo change de forme, ce guide peut devenir obsolète sur ce
point précis — vérifier avant de s'y fier pour un usage nouveau.

## 1. Perso

Forme systématique : `{ id, type, initial, actions, emit? }`.

- `actions` n'est **jamais absent**, même vide (`actions: {}`) : c'est ce qui
  permet au director de router les events vers le perso
  (`s5-drag-scene.ts`).
- Le type image s'appelle `img`, pas `image`
  (`carousel-scene.ts:96`).
- Types observés : `text`, `tag`, `img`, `media`, `list`, `layout`, `input`,
  `polygon`, `avatar3d`, `rive-coach`, `threejs`.

Nommage d'id : kebab-case, préfixé par le domaine/la story
(`game-basket-root`, `game-grid-tile-${wordId}`, `space-bubble-${color}`).
Convention pour l'id de story elle-même : `<contexte>-story`.

### Exemple minimal — `text`

`s1-canari-scene.ts:16-29`
```ts
{
  id: 'canari-title',
  type: 'text',
  initial: { tag: 'h1', move: '@root', content: 'Canari', style: { color: '#102643' } },
  actions: {}
}
```

### Exemple — `input` (quiz radio/checkbox)

`quiz-question-scene.ts:242-269`
```ts
{
  id: answerRootId,
  type: "input",
  initial: {
    inputType, name: groupName, value: answer.id, label: answer.label,
    hint: "", checked: false, disabled: false, visualState: "idle",
    move: { parentId: 'quiz-question:answers' }
  } as unknown as PersoDoc['initial'],
  actions: {},
  emit: { change: { data: { answerId: answer.id }, event: { name: 'quiz:question:answer:select' } } }
}
```

### Exemple — `media` (souvent `master: false`)

`quiz-hunt/stories/trials/build-reading-quiz.ts:42-57`
```ts
{
  id: `${prefix}-clue-video`,
  type: "media",
  initial: { tag: "video", src: clueMedia.src, master: false, className: "...", video: { style: {...}, controls: true, muted: true }, move: { parentId: `${prefix}:clue-slot` } },
  actions: {
    [startEventName]: { broadcast: { type: "START", startAt: 0 } },
    [stopEventName]: { broadcast: { type: "STOP" } }
  }
}
```

### Exemple — `layout` avec zones nommées

`quiz-hunt/stories/layout-story.ts:12-31` : un perso `layout` porte du markup
avec des `data-part="..."` qui servent ensuite de `parentId` pour d'autres
persos ou d'autres stories. Pattern omniprésent pour l'imbrication (voir §10).

## Do / Don't — Perso

- **Do** : toujours déclarer `actions: {}` même si le perso ne réagit à rien
  pour l'instant.
- **Do** : préfixer l'id par le domaine (`game-`, `space-`) pour éviter les
  collisions inter-story.
- **Don't** : ne pas utiliser `type: 'image'` — c'est `img`.
- **Don't** : ne pas donner de `move: '@root'` à un perso qui doit rester
  invisible jusqu'à un event `:show` (voir §7c) — laisser `initial` sans
  `move` du tout.

## 2. Story

Champs systématiques : `id`, `initial`, `persos`, `straps`, `listen`.
Optionnels selon besoin : `state`, `eventimes`.

### `eventimes` vs `listen` — distinction clé

- `eventimes` : déclenche un event à un `ms` fixe **de la timeline de la
  story** — déterministe, connu à l'avance.
  `s2-reference-scene.ts:71-76` :
  ```ts
  eventimes: [{ name: 'sequence:reference:start', startAt: 0 }]
  ```
- `listen` : réagit à un event runtime, avec `straps` à invoquer et,
  optionnellement, un `emit` local (chaînage d'un event sans passer par un
  strap dédié).
  `s4-quiz-reference-scene.ts:436-439` :
  ```ts
  { on: 'quiz:answer:yes', straps: ['quiz-answer'], emit: [{ name: 'quiz:question:hide' }] }
  ```

### Story avec `state` local

`quiz-hunt/stories/trials/build-reading-quiz.ts:202-210`
```ts
state: {
  question, config, selectedAnswerIds: [],
  revealed: undefined, resolved: undefined, disabled: false, retryCount: 0
},
straps: quizQuestionStoryStraps,
listen: [
  { on: "quiz:question:answer:select", straps: ["quiz-question-select"] },
  { on: "quiz:question:validate", straps: ["quiz-question-submit"] }
]
```

### Story « absente jusqu'à show » (pattern panel)

`quiz-hunt/stories/trials/build-reading-quiz.ts:196-200`, commentaire du
code : *"No move: '@root' here on purpose — this panel is absent until its
own :show action moves it, and detached again on :hide (move:'@off')"*.

## Do / Don't — Story

- **Do** : utiliser `eventimes` pour tout ce qui est chronométré et connu à
  l'avance ; `listen` pour tout ce qui réagit à un event externe/utilisateur.
- **Do** : isoler le `state` propre à une story si sa donnée n'a pas besoin
  d'être visible ailleurs (ex. un trial de quiz-hunt).
- **Don't** : ne pas donner de `move` initial à une story/un perso qui doit
  rester détaché tant qu'un event ne l'active pas explicitement.

## 3. Scene

Pas de champ `rootStories` observé dans les démos réelles : `stories` est un
dictionnaire simple `Record<string, SceneStoryDoc>`, sans hiérarchie
root/enfant déclarée. Toutes les stories du dictionnaire coexistent dès le
chargement — la présence visuelle est gérée par `move`, pas par une notion de
« racine ».

### SceneDoc minimal

`s1-canari-scene.ts:6-37`
```ts
return {
  id: 's1-canari-scene',
  initial: undefined,
  straps: undefined,
  listen: [],
  stories: { 's1-canari-story': { ... } },
  tracks: {}
}
```

`scene.initial` joue le rôle d'état global partagé, lu/écrit par les straps
déclarés au niveau scene (`listen` de la scène). Exemple quiz-hunt :
`initial: { phase: "grid", currentTrialId: null, trialStatus: {}, basket: {...}, ... }`
(`quiz-hunt/index.ts:64-76`).

### `tracks` avec `role: "master"`

Usage rare — un seul exemple dans toute la codebase demos,
`s4-quiz-reference-scene.ts:613-620` :
```ts
tracks: {
  "s4-quiz-intro-story": { role: "master" },
  "s4-quiz-question-story": { role: "master" }
}
```
Pas de commentaire explicatif dans le code source — à utiliser avec prudence,
sans généraliser sans avoir vérifié le comportement exact dans la spec
horizon/seek.

### `tracks` pour une timeline globale pilotée par `ms`

`space-bubbles-scene.ts:473-489`
```ts
tracks: {
  [INTRO_TRACK_ID]: {
    id: INTRO_TRACK_ID, active: true, order: 1, source: "story",
    events: [
      { ms: 100, name: "space:intro:go-show", payload: {...} },
      { ms: GAME_START_MS, name: "space:game:start" },
      { ms: SCENE_END_MS, name: "sequence:end" },
    ],
  },
}
```

### `tracks` debug, activable en direct

`quiz-hunt/index.ts:98-100` + `quiz-hunt/debug-question-track.ts`, activé
depuis le code hôte via :
```ts
player.emit({ name: 'track:activate', payload: { trackIds: [...] } })
```

## Do / Don't — Scene

- **Do** : mettre dans `scene.initial` toute donnée partagée entre plusieurs
  stories (score global, phase de jeu).
- **Do** : utiliser `tracks` pour une timeline globale indépendante des
  stories individuelles (intro chronométrée, fin de séquence).
- **Don't** : ne pas chercher un mécanisme `rootStories` — il n'existe pas
  dans l'usage actuel ; la composition se fait par `move`/`listen` (§10).

## 4. Straps

### Strap simple — retour direct

`quiz-hunt/straps/game-extra-collect.ts:4-13`
```ts
export const gameExtraCollectStrap: StrapFn = ({ state }) => {
  if (state.extraToken === true || state.extraConsumedOn != null) return undefined
  return { update: { extraToken: true }, events: [{ name: "game:extra:inventory:collect" }] }
}
```

### `context.planned.*` — séquence entièrement déterministe

Usage massif de `context.planned.delay(ms, step)`, composable dans un tableau
retourné par le strap. Exemple à delays chaînés,
`quiz-hunt/straps/game-router.ts:44-68` :
```ts
const extraSchedule = shouldOfferExtra ? [
  ...context.planned.delay(draw.extraOffsetMs, { event: { name: "game:extra:window:show", ... } }),
  ...context.planned.delay(draw.extraOffsetMs + config.extraDurationMs, { event: { name: "game:extra:window:hide" } })
] : []
```

Pattern « expiry check reprogrammé, revalidé au réveil » (`game-timer.ts:126-128`) :
un seul `context.planned.delay` reposé à chaque event de contrôle, avec un
garde-fou de fraîcheur (comparaison de `segmentStartedAtMs`) plutôt qu'une
annulation. Commentaire du code (`game-timer.ts:58-63`) : *"Staleness is
handled declaratively instead of by cancellation"*.

**Quand l'utiliser** : la séquence entière est connue au moment du strap —
pas de dépendance à un futur incertain, pas de handle à gérer.

### `context.live.*` — boucle interruptible par event

Seulement 3 usages dans toute la codebase demos, tous avec le même schéma
« compteur arrêté par un event dédié ». `s4-quiz-reference-scene.ts:625-645` :
```ts
"quiz-countdown-start": ({ context }) => {
  void context.live.loop(
    { eachMs: 1000, until: [{ type: "times", max: 11 }, { type: "event", name: "counter:stop" }] },
    ({ index }) => {
      const countStep = { event: { name: "quiz-count", data: { content: String(Math.max(0, 10 - index)) }, cascade: true } }
      if (index === 10) return [countStep, { event: { name: "perdu" } }]
      return countStep
    }
  )
  return { events: [{ name: "quiz:count:show", cascade: true }] }
}
```
Mouvement clavier continu, arrêté au `keyup` (`space-bubbles-straps.ts:201-220`) :
```ts
context.live.loop(
  { eachMs: TURRET_KEYBOARD_STEP_MS, until: { type: "event", name: "space:keyboard:stop" } },
  () => ({ event: { name: "space:keyboard:step" } }),
)
```

**Point important** : dans les 3 cas observés, le retour de
`context.live.loop` (le `HelperHandle`) n'est **jamais stocké ni annulé
directement** (`void context.live.loop(...)`) — l'arrêt se fait toujours en
émettant l'event attendu par `until`, jamais en gardant une référence pour
appeler `.cancel()` dessus (voir §6).

**Quand l'utiliser** : la boucle dépend d'un état externe changeant en
continu (touche maintenue, action utilisateur) et doit pouvoir être
interrompue par un event.

## Do / Don't — Straps

- **Do** : utiliser `context.planned.*` par défaut pour toute séquence
  temporelle connue à l'avance.
- **Do** : passer à `context.live.*` uniquement quand la durée/l'arrêt dépend
  d'un event futur imprévisible, et prévoir systématiquement un event
  `until: { type: 'event', name: ... }` dédié pour l'arrêt.
- **Don't** : ne pas stocker/manipuler le `HelperHandle` retourné par
  `context.live.*` — préférer un event d'arrêt déclaratif (aucun exemple
  observé ne fait autrement).

## 5. Recette — construire un compteur

Trois mécaniques réelles selon le besoin :

### a) Countdown visuel affiché (10 → 0, non persisté en state)

Utiliser `context.live.loop` avec `index`, recalculer le contenu affiché à
chaque tick, sans jamais stocker le compte dans `state` (voir §4, exemple
`s4-quiz-reference-scene.ts:625-645`). Adapté à un décompte qui n'a pas besoin
de survivre à un seek/reload.

### b) Score agrégé (ex. bonnes réponses / total répondu)

Le state contient la donnée brute (liste des réponses), le strap recalcule
les totaux dérivés à chaque event et les repousse via `update` + `events`.
`quiz-question-scene.ts:700-735` :
```ts
function handleQuestionAggregate(state, eventData) {
  const payload = eventData as QuizQuestionResolvedPayload | undefined
  const sceneState = resolveSceneState(state)
  const nextAnswer = { questionIndex: payload.questionIndex, ... }
  const previousAnswers = sceneState.answers.filter((a) => a.questionIndex !== nextAnswer.questionIndex)
  const answers = [...previousAnswers, nextAnswer].sort((l, r) => l.questionIndex - r.questionIndex)
  const answeredCount = answers.length
  const correctCount = answers.filter((a) => a.isCorrect).length
  return { update: { answers, answeredCount, correctCount, lastQuestionIndex: nextAnswer.questionIndex, lastResult: nextAnswer.isCorrect } }
}
```
Câblé au niveau **scene** (`listen: [{ on: "quiz:question:answered", straps: ["quiz-question-aggregate"] }]`)
pour rester visible/partagé entre plusieurs stories de question.

### c) Compteur par catégorie (ex. items répartis dans deux zones)

`s6-dnd-list-scene.ts:33-60` — le state stocke une map `{ itemId: zone }`,
recalculée à chaque event, et le strap pousse directement le texte affiché :
```ts
'drop-resolver': ({ event, state, context }) => {
  const oldAssignments = state.assignments as Record<string, string>
  const newAssignments = { ...oldAssignments, [itemId]: targetList }
  const countA = Object.values(newAssignments).filter((v) => v === 'a').length
  const countB = Object.values(newAssignments).filter((v) => v === 'b').length
  return { update: { assignments: newAssignments }, events: [..., { name: 'count:update:a', data: { content: String(countA) } }, { name: 'count:update:b', data: { content: String(countB) } }] }
}
```

### Pattern constant pour un compteur

1. Le `state` (scene ou story) contient toujours la **donnée brute** (map,
   array), jamais directement le total affiché.
2. Le strap recalcule les valeurs dérivées à chaque event pertinent.
3. Le résultat est poussé via un `event` avec `data.content` directement
   consommable par un perso `text`/`tag`, sans strap dédié côté affichage.

## 6. Destruction / cleanup — pas de handle impératif

Grep exhaustif : **aucun appel `.cancel()`**, aucun stockage de
`HelperHandle` dans toute la codebase des démos. Le nettoyage est toujours
déclaratif, par l'un de ces trois mécanismes :

### a) Event d'arrêt dédié, consommé par `until: { type: 'event', ... }`

Voir §4 — `counter:stop`, `space:keyboard:stop`. L'appelant émet l'event,
sans jamais référencer le loop lui-même.

### b) `tween:stop` pour interrompre une animation en cours

`chrono-story.ts:104-106` :
```ts
if (event.name === 'chrono:stop') {
  return { events: [{ name: 'tween:stop' }] }
}
```
Repris à l'identique dans `game-timer.ts:94-99`.

### c) `move: '@off'` pour détacher un perso, souvent après un fade

Pattern répété dans `move-off-story.ts:66-74` et
`quiz-hunt/stories/trials/build-reading-quiz.ts:129-132` :
```ts
[`game:trial:${word.id}:hide`]: [
  { action: { className: { add: "is-hidden", remove: "is-visible" } }, durationMs: 200 },
  { action: { move: "@off" } }
]
```
Commentaire du code : *"Attached on demand on :show, detached for real on
:hide once the fade-out ... has had time to play"*.

### d) Reset manuel de `story.state` depuis une closure (cas rare)

`quiz-hunt/straps/index.ts:39-56` — seul exemple de manipulation directe du
SceneDoc trouvé, pour remettre à zéro l'état d'une story trial après un
retry :
```ts
function createTrialStoryStateReset(scene: SceneDoc, words: QuizHuntWord[]): (trialId: string) => void {
  const initialStateByTrialId = new Map<string, Record<string, unknown> | undefined>()
  for (const word of words) {
    const storyId = `game-trial-${word.id}-story`
    initialStateByTrialId.set(word.id, cloneState(scene.stories[storyId]?.state))
  }
  return (trialId: string) => {
    const story = scene.stories[`game-trial-${trialId}-story`]
    if (story === undefined) return
    story.state = cloneState(initialStateByTrialId.get(trialId))
  }
}
```

## Do / Don't — cleanup

- **Do** : toujours prévoir un event d'arrêt dédié (`xxx:stop`) plutôt que de
  garder un handle pour l'annuler.
- **Do** : utiliser `move: '@off'` pour détacher un perso, en l'enchaînant
  après un fade visuel via une séquence d'actions à `durationMs`.
- **Don't** : ne pas stocker de `HelperHandle` pour annulation directe — ce
  n'est un pattern observé nulle part et casse la rejouabilité par seek
  (cohérent avec les commentaires de `move-off-story.ts` et
  `avatar-mood-transition-scene.ts` sur la reproductibilité).

## 7. `eventInsertMode` — pas de pattern observable

Grep exhaustif sur `packages/demos/src` : **zéro occurrence** de
`eventInsertMode`, `persist-only` ou `persist-future`. Le type existe côté
runtime (`player/types.ts`, `strap-types.ts`) mais aucune démo ne s'en sert
actuellement.

Le cas d'usage « pointermove » évoqué dans CLAUDE.md n'est pas illustré via
`eventInsertMode` dans les démos réelles — il est probablement géré
autrement (via `emit.<event>.capture`, à vérifier au besoin dans le code du
drag). Ne pas présenter `eventInsertMode` comme un pattern éprouvé tant
qu'aucun exemple concret n'existe dans les démos.

## 8. Variables / état partagé (`scene.initial`, pas `scene.state`)

Il n'y a pas de champ littéral `scene.state` dans le SceneDoc — c'est
`scene.initial` qui joue ce rôle et devient le state runtime lu par les
straps scene-level.

Trois niveaux de partage observés :

- **Scene-level** : state partagé par tous les straps déclarés dans le
  `listen` de la scène (ex. quiz-hunt : `phase`, `trialStatus`, `basket`,
  `extraToken`, `timerRemainingMs`).
- **Story-level** : state isolé par story (`SceneStoryDoc.state`), ex. un
  trial de quiz-hunt a son propre `question`/`selectedAnswerIds`/`resolved`,
  remis à zéro indépendamment des autres trials.
- **Inter-story** : jamais d'accès direct à l'état d'une autre story —
  toujours via des **events** émis par un strap (souvent scene-level) et
  consommés par le `listen` d'une autre story ou de la scène. Exemple :
  `quiz:question:answered` émis par chaque trial, consommé au niveau scene
  par `game-trial-resolve`.

## Do / Don't — état

- **Do** : mettre dans `scene.initial` tout ce qui doit être lu par plusieurs
  stories.
- **Do** : garder le state d'une story isolé si rien d'autre n'en a besoin
  (facilite le reset individuel, voir §6d).
- **Don't** : ne jamais faire lire/écrire directement le state d'une story
  par une autre — toujours passer par un event.

## 9. Commandes clavier

Pattern unique observé — un seul exemple dans toute la codebase demos,
`space-bubbles-demo.ts:17-69` : listener DOM natif branché dans le callback
`onReady` fourni à `runCodPlaySceneDemo`, qui traduit l'event clavier en
`player.emit(...)`.

```ts
onReady: ({ player }) => {
  globalThis.addEventListener("keydown", (event) => {
    const name = resolveKeyboardEventName(event) // ArrowLeft -> 'space:keyboard:left:start', Space -> 'space:fire', ...
    if (name === null) return
    if (isKeyboardMoveKey(event)) {
      void player.emit({ name, cascade: true })
      return
    }
    if (event.repeat) { event.preventDefault(); return }
    void player.emit({ name, cascade: true })
  })
  globalThis.addEventListener("keyup", (event) => {
    if (!isKeyboardMoveKey(event) || !activeMoveKeys.has(event.code)) return
    activeMoveKeys.delete(event.code)
    void player.emit({ name: "space:keyboard:stop", cascade: true })
  })
}
```

Points à retenir :
- Anti-répétition gérée manuellement (`event.repeat`, `Set` de touches
  maintenues) avant d'émettre.
- Le `keyup` émet l'event d'arrêt dédié (`space:keyboard:stop`) qui alimente
  le `until` du `context.live.loop` côté strap (voir §4, §6a).
- Les persos `input` (radio/checkbox) sont réservés aux formulaires de quiz —
  aucun usage de perso input pour de la saisie clavier libre.

## Do / Don't — clavier

- **Do** : traduire chaque touche en un event nommé et dédié
  (`space:keyboard:left:start`), jamais un event générique `keydown` porté
  jusqu'au strap.
- **Do** : émettre un event d'arrêt explicite au `keyup`, cohérent avec le
  pattern de cleanup du §6a.
- **Don't** : ne pas laisser passer les repeats du navigateur sans filtrage
  (`event.repeat`).

## 10. Composition de stories — pas de `rootStories`

Confirmation : toutes les stories démarrent ensemble au chargement
(`stories` est un dictionnaire plat). La coexistence/imbrication se fait par
deux mécanismes, jamais par une relation formelle parent/enfant :

1. **Positionnement spatial** : une story « layout » hôte expose des
   `data-part="..."` ; les stories filles pointent leur
   `initial.move.parentId` vers ce `data-part`
   (`quiz-hunt/stories/grid-story.ts:59`, `basket-story.ts:28`,
   `timer-story.ts:69`, tous rattachés à `quiz-hunt/stories/layout-story.ts`).
2. **Écoute d'events partagés** : une story ne « démarre » pas au sens
   propre — elle est chargée dès le début mais reste invisible/détachée
   (`initial: undefined`) jusqu'à ce qu'un strap scene-level (ex.
   `game-router`) émette l'event `:show` ciblant ses persos.

### Composition programmatique de story (story factory)

`mashup-rive-three-quiz-scene.ts:57-67` construit une story réutilisable
(`createQuizQuestionStory`), l'enrichit en JS avant assemblage :
```ts
const quizStory = createQuizQuestionStory(mashupQuestion, { storyId: 'mashup-quiz-story', parentId: 'mashup-quiz-slot', ... })
quizStory.listen.push(
  { on: 'scene:start', straps: ['mashup-quiz-countdown-start'] },
  { on: 'quiz:question:resolved', straps: ['mashup-quiz-countdown-stop'] },
  { on: 'mashup:quiz-timeout', straps: ['mashup-quiz-timeout'] },
)
quizStory.persos.unshift({ id: 'mashup-quiz-count', ... })
```

## Do / Don't — composition

- **Do** : construire un layout hôte avec des `data-part` nommés avant
  d'y rattacher des stories filles par `move.parentId`.
- **Do** : garder une story chargée mais détachée (`initial: undefined`) si
  elle doit apparaître/disparaître dynamiquement, plutôt que de la
  créer/détruire.
- **Don't** : ne pas chercher un mécanisme de démarrage hiérarchique —
  utiliser des events `:show`/`:hide` pilotés par un strap routeur.

## 11. Démos avancées représentatives

- **quiz-hunt** (`packages/demos/src/scenes/quiz-hunt/`) : 6 stories fixes
  (layout, grid, basket, timer, extra, result) + 32 stories dynamiques (16
  trials + 16 finals), ~10 straps scene-level écoutant ~17 events. Usage
  massif de `context.planned.delay`, strap timer auto-reprogrammé avec garde
  de fraîcheur, `move:'@off'` pour l'attache/détache, reset direct de
  `story.state` pour les retries, track debug activable en direct.
- **space-bubbles** (`packages/demos/src/scenes/space-bubbles/`) : jeu temps
  réel (tourelle/bulles/collisions), 4 stories fixes, ~26 straps scene-level,
  capture clavier native déclarée dans `emit.keydown` : le maintien
  échantillonne une valeur continue vers un strap live sans créer d'events de
  timeline, puis le `keyup` matérialise la position finale. Moteur de collision maison, PRNG
  déterministe par seed, track d'intro pilotée par `ms`.
- **mashup-rive-three-quiz** (`mashup-rive-three-quiz-scene.ts`) : assemblage
  de briques hétérogènes (avatar Rive, scène Three.js, story de quiz
  réutilisée et enrichie par composition JS). Bon exemple de story factory
  réutilisable entre plusieurs scènes.
- **s4-quiz-reference-scene** (`s4-quiz-reference-scene.ts`) : scène de
  référence combinant layout hôte multi-`data-part`, `tracks` avec
  `role: "master"`, countdown `context.live.loop` à double condition
  `until`, et `emit` local dans `listen`.

## Points ouverts / non observés dans les démos

- `eventInsertMode` (`apply-now`/`persist-only`/`persist-future`) : type
  existant côté runtime mais aucun usage dans les démos actuelles (§7).
- `HelperHandle` retourné par `context.live.*` : jamais stocké ni annulé
  directement — à vérifier si un besoin futur en justifie l'usage avant de
  l'introduire (§6).
- `tracks[...].role: "master"` : un seul exemple, sans commentaire
  explicatif — comportement exact à vérifier dans `v1-horizon-spec.md` avant
  généralisation (§3).
