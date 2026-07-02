# Plan — `move: '@root'` comme seul mécanisme de placement racine pour les `Story`

## Décisions actées (par l'auteur du projet, suite à `2026-06-29-rootstories-vers-move-plan.md`)

1. **Un seul mode retenu** : une `Story` se déclare elle-même via `move: '@root'`, porté par
   `story.initial.move` — même vocabulaire que pour un perso (`v1-perso-spec.md` 4bis), mais
   **statique uniquement** côté story (voir révision du point 1.2 : pas d'équivalent "action"
   au niveau story, le besoin de placement dynamique se délègue au perso). `rootStories`,
   `options.mount()` disparaissent.
2. **Pas de move du tout → la story n'apparaît pas.** Symétrie stricte avec la règle perso :
   aucune racine implicite par défaut.
3. **Mode auteur : warning** quand une story n'a aucun `move` résolu (`initial.move` absent) —
   signal de "y a-t-il un oubli ?", silencieux en diffusion.
4. **Nouvel invariant (suite à cette session)** : un perso ne cible jamais directement un
   outlet d'une **autre** story. Toute composition cross-story passe exclusivement par
   `story.initial.move` (la story cible l'outlet d'une autre story) ; le perso, à l'intérieur,
   utilise `move: '@root'` pour rejoindre son propre `story host`. Un perso visant directement un
   `parentId` hors de sa story est désormais un anti-pattern (constaté massivement dans
   quiz-hunt, à corriger en partie 3/4, pas à préserver) — ça dissout la tension du warning du
   point 3 : sous ce pattern, plus aucune story ne reste légitimement sans `move`.
5. **`Story.disabled` (champ dédié, distinct de `move`)** : annotation de retrait volontaire et
   temporaire, par l'auteur, d'une story hors de la construction de la scène — équivalent
   "commenter la story" sans toucher au code source. Le **builder** retire entièrement la story
   du `CompiledScene` quand `disabled` est vrai (la story, ses persos, ses tracks, ses listen
   rules n'existent plus dans l'artefact compilé). Silencieux par construction (la story n'existe
   plus, rien à signaler). **N'a aucun rapport avec `move`/`@root`/le placement** — correction
   d'une mauvaise lecture initiale de ce point (voir "Décision révisée" ci-dessous).
   Comportement sur les références pendantes (un perso d'une autre story ciblant un outlet qui
   vivait dans la story désactivée, une `listen.on` qui la visait, etc.) : **warning non
   bloquant** à la compilation — le builder compile quand même, signale les références devenues
   orphelines, l'auteur reste responsable de nettoyer pendant qu'il travaille.

## Rappel factuel clé (de `2026-06-29-rootstories-vers-move-plan.md`)

- `options.mount()` est déjà mort : `activateAllSceneStories()` active sans condition **toutes**
  les stories avant que le hook auteur `init()` ne s'exécute ; le garde-fou de `mountStory()`
  (`mountedStoryIds.has(id)` déjà vrai) rend tout appel ultérieur inerte. 16 démos sur 20 n'ont
  déjà plus aucun hook `init` et fonctionnent correctement.
- **Ce qui doit rester inchangé** : l'activation/instanciation des persos d'une story (création
  des composants/nodes runtime) reste **inconditionnelle pour toutes les stories**, quel que soit
  leur `move`. **Le `move` story-level ne gouverne que le sort du `story host` synthétique de
  CETTE story** (est-il monté à la racine de la page, ou ailleurs, ou nulle part) — jamais
  l'instanciation de ses persos.
- **Anti-pattern constaté et à corriger (pas à préserver)** : aujourd'hui, des persos ciblent
  directement un outlet d'une **autre** story (ex. `game-grid-root` →
  `move:{parentId:'game:zone:main'}`, alors que `game:zone:main` vit dans `layout-story`). Le
  bon pattern (point 4 ci-dessus) : la story porte la composition (`story.initial.move:
  {parentId:'game:zone:main'}`), le perso utilise `move:'@root'`. Conséquence : dans une scène
  multi-story comme quiz-hunt, une fois ce pattern appliqué partout, **toutes** les stories
  porteront un `move` réel (`@root` pour la vraie racine page, `{parentId}` pour toutes les
  autres) — il ne reste plus de cas légitime de story sans `move`.

---

## Partie 1 — Installation de `@root` (placement) et `Story.disabled` (exclusion builder)

### 1.1 Résolution statique (`initial.move`)

- `story.initial.move` accepte déjà la forme `{ parentId }` (composition — déjà utilisé,
  ex. `quiz-question-story` embarquée via `options.parentId`). Étendre la reconnaissance pour
  accepter la string `'@root'` au même niveau, signifiant "racine de la page".
- `RUNTIME_CONFIG.move.rootToken` (déjà `'@root'`) reste la même configuration, partagée entre
  les deux niveaux.
- **Invariant moteur, pas seulement une correction ponctuelle** : le moteur ne crée jamais de
  node lui-même, c'est l'entière responsabilité des composants (`nodeFactory`) — invariant
  désormais posé dans les specs fondamentales (`v1-invariants.md` "Invariants moteur",
  `v1-component-api.md` "Principe fondamental"), pas seulement dans ce plan.
  `createStoryHostNode` (`document.createElement('div')` en dur, sans `nodeFactory`, pour un nœud
  sans perso authored derrière) en est une violation déjà commise, à corriger ici — d'où la
  suppression complète (pas un ajustement) décrite plus bas : pas une simplification de confort,
  une mise en conformité.
- Un perso avec `move:'@root'` ne doit donc **pas** se résoudre contre un nœud `story host`
  synthétique — il doit se résoudre **directement** contre la cible réelle déjà désignée par le
  `move` de SA PROPRE story (un chaînage, pas un nœud intermédiaire). Concrètement,
  `resolveMoveTargetNode` (`runtime-component-orchestrator.ts:1034-1044`), quand
  `parentId === rootToken`, doit résoudre récursivement le `move` de la story courante :
  - si la story compose vers un outlet réel (`{parentId: 'game:zone:timer'}`) → le perso devient
    **enfant direct** de cet outlet, exactement comme aujourd'hui quand le perso ciblait l'outlet
    lui-même (anti-pattern corrigé en 1.6) — aucun `<div>` ajouté, aucun changement visuel.
  - si la story est `'@root'` (vraie racine page) → pas de parent résolu côté orchestrateur (la
    page n'est pas un concept connu de ce niveau, frontière Player/PlayerFacade à préserver,
    cf. `CLAUDE.md`) ; le perso rejoint `rootNodeIds` via le mécanisme déjà existant (1.3bis).
  - si la story n'a pas de `move` → pas de parent du tout (cohérent avec la règle "pas de move =
    pas monté").
  Ça rend `createStoryHostNode`/`storyHostNodeByStoryId`/`resolveStoryHostNode`/
  `mountStoryHosts()` **inutiles** — pas seulement "à ajuster" comme prévu dans une version
  antérieure de ce plan. Voir Partie 2.

### 1.2 Résolution dynamique — déléguée au perso, pas de nouvelle infrastructure story-level

**Révision** (proposition de l'auteur du projet) : plutôt que construire un second système
parallèle de matérialisation/replay au niveau story (track entries, `effectiveMoveByStoryId`,
idempotence — tout ce qui a été bâti pour les persos cette session, "défaut 2"), **déléguer le
besoin de placement dynamique au perso**, qui porte déjà cette capacité de bout en bout
(actions, matérialisation en track, reconstruction au seek, idempotence).

Conséquence directe : `story.initial.move` reste **statique uniquement** — résolu une fois,
comme c'est déjà le cas aujourd'hui via `storyMovesByStoryId`. Pas de `StoryDef.actions`, pas de
nouveau pipeline de seek côté story. Tout besoin de replacement dynamique d'une story (un
"contenant" qui devrait changer de parent en cours de session) se résout en donnant un `move`
dynamique (action) au(x) perso(s) concerné(s) **à l'intérieur** de la story plutôt qu'à la story
elle-même — ce que le moteur sait déjà faire intégralement. La story garde un rôle purement
statique de regroupement/placement initial ; toute la dynamique reste, comme avant cette
réflexion, une affaire de perso.

Ça supprime entièrement ce qui était présenté comme "la pièce la plus lourde du chantier" — il
n'y a plus de pièce lourde sur ce point.

### 1.3 Règle "pas de move = pas monté" (placement uniquement, pas l'instanciation)

- Si une story n'a pas de `initial.move` : aucun de ses persos `@root` ne résout de parent (voir
  1.1, dernier cas) — **aucun impact sur l'instanciation des persos**, qui suit le comportement
  actuel d'`activateAllSceneStories()` (inchangé, voir rappel ci-dessus).

### 1.3bis `rootNodeIds` page-level — réutilise le mécanisme existant, juste re-scopé

- Le mécanisme déjà en place (`deriveRootNodeIds`, `Player.mountRootNodes()`) reste structurellement
  identique : une liste de **perso ids** que `Player` monte directement sous `mountTarget`.
  Seul le critère de sélection change : aujourd'hui scanne les persos des stories listées dans
  `rootStories` ; après la migration, scanne les persos dont le `move` effectif est `'@root'`
  **et** dont la story elle-même a `initial.move:'@root'` (les deux niveaux doivent coïncider —
  un perso `@root` dans une story composée ailleurs ne doit jamais atterrir directement sous
  `mountTarget`). Aucune nouvelle méthode de registry nécessaire (`getNodeById` suffit déjà,
  comme aujourd'hui) — contrairement à ce qu'une version antérieure de ce plan prévoyait.

### 1.4 Warning mode auteur

- Réutiliser la distinction `mode: 'author' | 'broadcast'` déjà présente côté `Player.init()`
  (vue dans `third-party-binding-registration.spec.ts`).
- À l'issue de la résolution statique d'une story (`initial.move`), si elle est `null`/absente →
  émettre un warning de trace (nouveau code, ex. `AUTHOR_STORY_MOVE_MISSING`), uniquement en
  mode `author`.
- **Portée résolue** (correction par rapport à une version antérieure de ce plan) : ce warning
  n'a plus de faux positif à gérer, à condition d'appliquer le nouvel invariant (point 4 des
  décisions actées) — voir 1.6 ci-dessous, qui montre que le cas qui semblait "fréquent et
  légitime" était en réalité l'anti-pattern lui-même, pas une exception à tolérer.

### 1.5 `Story.disabled` — exclusion builder, sans rapport avec `move`

**Correction par rapport à une première version de ce plan** : ce point avait été conflé à tort
avec le placement (`@null` lu comme une variante de résolution de `move`). Confirmé par l'auteur
du projet : c'est un mécanisme de **retrait volontaire et temporaire au niveau du builder**, pas
une troisième valeur de `move`.

- Champ dédié `StoryDef.disabled?: boolean` (`builder/types.ts`), distinct et indépendant de
  `move`/`initial`.
- Au compile (`BuilderFacade.compile`) : toute story avec `disabled: true` est retirée du
  `CompiledScene` produit — elle reste dans le `SceneDef`/`SceneDoc` source (l'auteur peut la
  réactiver en un mot-clé), mais n'existe plus dans l'artefact compilé (persos, tracks, listen
  rules inclus).
- Validation : nouveau warning non bloquant (pas une erreur) quand une référence externe
  (`move.parentId` d'un perso d'une autre story, `listen.on` ciblant un event scope-locked à la
  story désactivée, etc.) pointe vers une story `disabled` — la compilation réussit quand même.
- Pas de helper authoring spécifique nécessaire au-delà d'un simple setter
  (`SceneDocEditor.setStoryDisabled({ storyId, disabled })` ou équivalent) — c'est un booléen, pas
  une grammaire à apprendre.

### 1.6 Anti-pattern résolu : composition cross-story via la story, pas via le perso

**Correction** (suite à la remarque de l'auteur du projet) : ce qui semblait être un cas
"fréquent et légitime de story sans `move`" était en réalité l'anti-pattern décrit au point 4
des décisions actées. Trois exemples actuels, déjà dans le code, montrant l'état AVANT
correction et la cible APRÈS :

```ts
// timer-story.ts — AVANT (anti-pattern : le perso cible directement un outlet d'une autre story)
return {
  id: "game-timer-story",
  initial: undefined,                              // ← la story elle-même n'a pas de move
  persos: [
    { id: "game-timer-root", type: "layout",
      initial: { move: { parentId: "game:zone:timer" }, markup: `...` },   // ← cross-story ici
      actions: {} },
    // ...game-timer-label, game-timer-fill...
  ]
}

// timer-story.ts — APRÈS (la story porte la composition, le perso rejoint son propre host)
return {
  id: "game-timer-story",
  initial: { move: { parentId: "game:zone:timer" } },   // ← composition au niveau story
  persos: [
    { id: "game-timer-root", type: "layout",
      initial: { move: "@root", markup: `...` },         // ← rejoint le host de SA story
      actions: {} },
    // ...game-timer-label, game-timer-fill...
  ]
}
```

Même transformation pour `basket-story.ts` (`game-basket-root` → `game:zone:basket`) et
`grid-story.ts` (`game-grid-root` → `game:zone:main`), et plus généralement pour toute story de
quiz-hunt dont un perso ciblait jusqu'ici un outlet hors de sa propre story.

**Conséquence sur la tension 1.4** : une fois ce pattern appliqué partout, `layout-story` porte
`'@root'`, toutes les autres stories de quiz-hunt portent un `{parentId}` réel — il ne reste
aucune story légitimement sans `move`. Le warning 1.4 n'a donc plus de faux positif à gérer ;
les options (a)/(b)/(c) envisagées dans une version antérieure de ce plan deviennent inutiles.

**Correction par rapport à une version antérieure de ce plan** : cette section affirmait qu'un
`<div>` synthétique s'intercalerait nécessairement entre l'outlet et le perso après la migration
(`game:zone:timer` → host → `game-timer-root`), et proposait de "vérifier empiriquement" si ça
casse le layout. Remarque de l'auteur du projet : ce n'est pas une fatalité à vérifier, c'est une
omission de conception à corriger (voir 1.1) — CodPlay n'a aucune raison de créer un nœud
intermédiaire quand la cible réelle (le slot `data-part`) existe déjà. Avec la résolution en
chaîne décrite en 1.1, `game-timer-root` reste enfant **direct** de `game:zone:timer` après la
migration, exactement comme avant — aucun `<div>` ajouté, donc plus de risque visuel à vérifier
sur ce point.

---

## Partie 2 — Retrait des fonctions mortes et obsolètes

### Code source (`packages/codplay/src`)

- `Scene.rootStories` — retiré de `builder/types.ts`, `player/types.ts`.
- `AUTHOR_ROOT_STORIES_INVALID` et sa validation (`builder-validation.ts`) — retirés ; pas de
  remplacement nécessaire (`scene.stories` reste l'inventaire canonique ; les ids invalides dans
  un `move.parentId` sont déjà couverts par la validation générique des cibles de `move`).
- `deriveRootNodeIds()` (version actuelle, scanne `rootStories` → persos) — réécrite pour scanner
  **toutes** les stories non `disabled` dont `initial.move === '@root'`, et retenir leurs persos
  dont le `move` effectif est lui-même `'@root'` (voir 1.3bis). Toujours des **perso ids** en
  sortie — pas de changement de forme côté `rootNodeIds`/`Player.mountRootNodes()`.
- `builder-artifact-cloner.ts` — retire le clonage de `rootStories`.
- `PlayerSceneLifecycleOptions.mount`, `options.mount()`, `mountStory()` (`create-player.ts`) —
  retirés (confirmé mort, partie 0).
- `activateAllSceneStories()` — **conservée**, mais commentaire/doc mis à jour pour clarifier
  qu'elle ne concerne que l'instanciation des persos, indépendante de tout `move` story-level.
- `RuntimeComponentOrchestrator` : **suppression complète** (pas un ajustement) de
  `createStoryHostNode`, `storyHostNodeByStoryId`, `resolveStoryHostNode`, `mountStoryHosts()` —
  remplacés par la résolution en chaîne décrite en 1.1 (`resolveMoveTargetNode` résout `@root`
  contre la cible réelle de la story courante, récursivement, sans nœud synthétique). Aucune
  nouvelle méthode de registry nécessaire.
- `Player.mountRootNodes()` (player.ts) : **inchangé** — continue de monter des perso ids via
  `getNodeById`, exactement comme aujourd'hui.

### Demos

- Les 4 scènes encore pourvues d'un hook `init` uniquement pour `options.mount()`
  (`s1-canari-scene.ts`, `s3-robustesse-scene.ts`, `s5-drag-scene.ts`, `s6-dnd-list-scene.ts`)
  perdent ce hook (déjà sans effet, confirmé partie 0).

### Specs (`docs/formalisation/`)

Même balayage que celui fait pour `entries` → `move:'@root'` côté perso, à refaire pour
`rootStories`/`mount` côté story : `v1-scene-spec.md` (§3 "Stories racine" entièrement réécrit),
`v1-story-spec.md` (placement statique via `move`, `disabled`), `v1-invariants.md`,
`v1-player-api.md`, `v1-authoring-api.md` (retrait de `mount` de l'API, ajout du setter
`disabled`), `v1-error-catalog.md` (`AUTHOR_ROOT_STORIES_INVALID` retiré, nouveau
`AUTHOR_STORY_MOVE_MISSING` ajouté côté warnings), `v1-validation.md`,
`v1-broadcast-spec.md`/`v1-broadcast-guide.md` (dérivation de `rootNodeIds` revue),
`v1-construction-strategy-slices-scenes.md`.

---

## Partie 3 — Application à quiz-hunt d'abord

Quiz-hunt est la démo multi-story la plus complexe du projet — bon test de charge pour ce
mécanisme avant généralisation.

1. **Inventaire des stories de quiz-hunt** et décision de `move`, en appliquant le pattern
   corrigé du point 1.6 (composition portée par la story, jamais par le perso directement) :
   - `layout-story` (contient `game-layout-root`) → `initial.move: '@root'` (vraie racine page).
   - `decor-story`, `grid-story`, `basket-story`, `timer-story`, `extra-story`, `result-story`,
     chaque `game-trial-{id}-story`, chaque `game-final-{wordId}-story` → `initial.move:
     {parentId: ...}` au niveau **story** (vers `game:zone:main`/`game:zone:timer`/
     `game:zone:basket` selon le rôle), et leur perso racine bascule de `move:{parentId:...}` à
     `move:'@root'`. Toutes ces stories portent désormais un `move` réel — `disabled` ne
     s'applique à aucune d'entre elles (ce ne sont pas des stories à exclure).
2. Retirer `rootStories: [...]` du `SceneDoc` de quiz-hunt (le champ disparaît entièrement).
3. Lancer en mode `author` et vérifier qu'aucun warning "story sans move" ne se déclenche — la
   correction du point 1.6 doit avoir éliminé tous les cas, sans exception à gérer au cas par cas.
4. Suite de tests quiz-hunt (vitest) + vérification manuelle navigateur réelle (le même protocole
   que pour le défaut 2 : comptage DOM, seek avant/après, captures du pattern 43→90→43) — confirme
   au passage que la résolution en chaîne (1.1) ne change rien à la structure DOM existante.
5. Geler ce pattern de migration (quel move pour quel rôle de story) comme référence avant de
   l'appliquer ailleurs.

---

## Partie 4 — Généralisation à toutes les démos

1. Reprendre, démo par démo, le même inventaire qu'en partie 3 : pour chaque `Story` de chaque
   scène, décider `@root` (racine page) ou `{parentId}` (composition — y compris pour tout perso
   qui ciblait jusqu'ici directement un outlet d'une autre story, à corriger selon le pattern du
   point 1.6). `disabled` reste un outil d'auteur ponctuel, pas une étape systématique de cette
   migration.
2. Retirer `rootStories: [...]` de chaque `SceneDoc`.
3. Pour les 4 démos identifiées en partie 2 ayant encore un hook `init` mort : le retirer.
4. Suite complète + gates après chaque lot de démos migrées (même méthode que pour
   `entries` → `move:'@root'` : migration par fichier, vérification tsc, puis suite globale en
   fin de passe).

---

## Points laissés ouverts pour l'implémentation (non bloquants pour démarrer la partie 1)

- Audit plus large (hors scope de cette migration, à faire séparément) : confirmer qu'aucun
  autre site du moteur ne crée de nœud directement hors du contrat `nodeFactory`/composant —
  `createStoryHostNode` est le seul cas confirmé à ce stade ; pas encore vérifié ailleurs dans
  `runtime/modules/`, `renderer/`. Invariant posé par l'auteur du projet : le moteur ne doit
  jamais créer de nœud lui-même, pour permettre un rendu 100% canvas sans DOM avec des
  composants adéquats.
- Code de warning exact (`AUTHOR_STORY_MOVE_MISSING` est une proposition de nom, pas figé).
- Nom/forme exacts du setter authoring pour `disabled` (`SceneDocEditor.setStoryDisabled` est une
  proposition, pas figée).
- Vérifier qu'aucun autre appelant ne dépend de `createStoryHostNode`/`storyHostNodeByStoryId`/
  `resolveStoryHostNode`/`mountStoryHosts()` avant de les supprimer (grep ciblé en tout début
  d'implémentation de la Partie 2 — un seul site d'appel identifié à ce stade,
  `resolveMoveTargetNode`, mais à reconfirmer sur le code au moment de coder).
