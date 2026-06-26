# Bonnes pratiques — projet CodPlay

Constats relevés en débuggant la démo quiz-hunt, mais valables comme bonnes pratiques générales
pour le projet — pas des règles spécifiques à quiz-hunt. Quiz-hunt sert ici d'illustration
concrète, pas de périmètre.
Statut : à valider, pas encore appliqué au code.

---

## 1. Ne pas porter une valeur continue (countdown, barre de progression) par un `context.live.loop` à haute fréquence

**Constaté dans** : `straps/game-timer.ts` (`startTick`, sélectionné dans l'IDE) — boucle
`context.live.loop({ eachMs: 250 }, ...)` qui, à chaque tick, met à jour `timerRemainingMs`
dans l'état scène et émet deux events (`game:timer:fill`, `game:timer:label`).

**Pourquoi c'est une mauvaise pratique** :

- Un strap est l'unité de comportement déclenchée par un event nommé (architecture CodPlay :
  "Straps are the primary behavior unit — pure functions triggered by named events"). Le faire
  retourner ici une boucle qui re-émet des events toutes les 250 ms le transforme en générateur
  de flux continu, alors que sa vocation est de réagir à des *changements d'état* (start, pause,
  resume, stop).
- Chaque tick (update + events) est matérialisé en `TrackEntry` ("Every event and state mutation
  emitted by a strap is written to a track as a TrackEntry"). Pour un timer de 5 minutes à 250 ms,
  ça représente jusqu'à ~3600 entrées track pour une simple barre de progression.
- Le `seek` doit alors rejouer toutes ces entrées une par une au lieu d'une évaluation directe —
  alors que c'est exactement le cas d'usage que `TweenAction` est fait pour couvrir : `fn` est
  "re-évaluable à n'importe quelle position T sans rejouer de strap" (`v1-tween-action-spec.md`,
  §Motivation).
- Chaque appel à `context.live.loop(...)` crée un job indépendant ; rien dans le contrat ne
  fusionne ou n'annule automatiquement un loop précédent (`until: { type:'event' }` "n'interrompt
  que ce loop" — `v1-strap-helpers-spec.md` §Règles normatives). Sans bookkeeping manuel du
  `HelperHandle`, deux démarrages successifs tournent en parallèle — c'est précisément la cause
  du bug n°1 du journal `BUGS.md` (double boucle de timer).

**Ce qu'il faut faire — pattern de référence `chrono-story.ts`** :

- Le strap ne gère que les transitions discrètes : `chrono:start` émet **un seul event par
  perso animé**, portant directement une `TweenAction` (`{ duration, ease, fn }`) en `event.data`
  (perso déclaré avec `actions["chrono:needle"] = true`, cf. `v1-tween-action-spec.md`
  §"event.data comme porteur de TweenAction"). `chrono:stop` émet `{ name: 'tween:stop' }`.
- Le runtime évalue `fn({ progress, data })` lui-même, à sa propre cadence d'animation (~60 fps),
  sans ré-invoquer le strap à chaque frame (`v1-tween-action-spec.md` §2). Le track ne
  matérialise qu'**un descripteur par tween déclenché**, jamais les valeurs intermédiaires (§4).
- "Pause" = `tween:stop` : interrompt **tous** les tweens actifs du perso d'un coup (clé
  d'action réservée, §11) — pas de handle à suivre soi-même, pas de risque de double-tween.
- "Les affichages haute fréquence (1/100s, barres de progression) sont le cas d'usage naturel"
  de `fn` (`v1-tween-action-spec.md` §2) — c'est texto le besoin du timer de quiz-hunt.

**Do**
- Strap = événements de changement d'état seulement (`start`/`pause`/`resume`/`stop`).
- Valeur qui varie en continu (countdown, jauge, position) → `TweenAction` (`fn`/`duration`/
  `ease`) déclarée sur le perso, déclenchée par un event unique.
- Arrêt/pause d'une valeur animée → event `tween:stop` réservé, pas un `HelperHandle` géré à la main.

**Don't**
- `context.live.loop` à cadence fixe (ex. `eachMs: 250`) pour piloter une valeur qui change en
  continu — réservé aux suites finies pilotées par des events futurs réels (pas un simple
  rafraîchissement visuel).
- Émettre un event + une mise à jour d'état à chaque tick d'une boucle pour simuler une animation.
- Démarrer un nouveau `context.live.loop`/`repeat` sans avoir conservé (et au besoin annulé) le
  `HelperHandle` du précédent sur la même responsabilité.

**Piste pour quiz-hunt** (non appliquée) : remplacer `startTick`/`context.live.loop` par une
`TweenAction` sur `game-timer-fill`/`game-timer-label` (`duration = remainingMs`, `fn` calcule
`width`/`content` depuis `progress`), `game:timer:pause`/`stop` émettant `tween:stop`. Réglerait
le bug n°1 (`BUGS.md`) comme effet de bord, pas seulement le style.

---

## 2. Styles statiques en `style:` inline au lieu de classes CSS, `position: absolute` non justifié, aucun responsive

**Constaté dans** : les 9 fichiers `stories/*.ts` de quiz-hunt — `layout-story.ts`,
`grid-story.ts`, `basket-story.ts`, `timer-story.ts`, `extra-story.ts`, `result-story.ts`,
`final-story.ts`, `build-reading-quiz.ts`, `answer-persos.ts`.

**Constat** :

- CodPlay expose `className` comme service d'action de premier rang, au même titre que `style`
  et `attr` (`v1-component-api.md` §"Props d'element interne", formes `className: 'x'`
  remplacement, ou `className: { add: 'x' }` additive). Rien n'empêche de styler par classes.
- Le markup de quiz-hunt pose déjà des hooks de classe (`class="quiz-hunt-layout"`,
  `quiz-hunt-footer`, `quiz-hunt-timer`, `quiz-hunt-basket`, `quiz-hunt-trial-panel`,
  `quiz-hunt-final-panel`, `quiz-hunt-result-card`) — mais **aucune règle CSS pour ces classes
  n'existe nulle part** (`grep` sur `packages/demos/src/style.css` et `shared/demo-shell.css` :
  0 résultat). Toute la mise en forme (couleurs, padding, border-radius, font-weight, gap…) est
  portée par des objets `style:` inline, répétés perso par perso.
- Le repo a pourtant déjà la bonne convention sous la main : `packages/demos/src/style.css`
  utilise des classes réelles, `display: grid`/`flex`, variables CSS (`--accent`, `--card`…),
  `clamp()`, `min()`, et un vrai breakpoint `@media (max-width: 760px)`. Quiz-hunt n'en reprend
  rien.
- `position: absolute; inset: 0` est utilisé sur les **32 panneaux** trial+final
  (`build-reading-quiz.ts`, `final-story.ts`) alors qu'**un seul est visible à la fois**
  (`display: none`/`block` au show/hide suffit déjà à empêcher tout chevauchement) et que la
  zone parente réserve déjà sa hauteur (`game:zone:main { min-height: 420px }`,
  `layout-story.ts`). L'absolute n'apporte rien ici — un flux normal ferait exactement la même
  chose. Usages **légitimes** en revanche : `game-result-overlay` (modale plein écran avec
  fond semi-opaque par-dessus tout le reste, `zIndex: 10`) et `game-extra-token` (badge flottant
  en coin de zone) — deux vrais cas de superposition, dernier recours justifié.
- Aucune `@media`, aucun `clamp()`/`minmax()`/`auto-fit` nulle part dans quiz-hunt : grille à 4
  colonnes fixes (`gridTemplateColumns: repeat(4, 1fr)`), timer à largeur fixe (`width: 220px`),
  footer toujours en ligne (`display:flex` basket+timer côte à côte) — rien ne s'adapte à un
  viewport étroit.

**Do**
- Propriétés statiques (couleur, padding, border-radius, font-weight, gap, layout grid/flex…) →
  classe CSS déclarée dans une feuille de style du projet (suivre la convention `style.css` /
  `demo-shell.css` : variables CSS, sélecteurs nommés), appliquée via `className`.
- `style:` inline réservé aux valeurs réellement dynamiques (calculées par strap/tween :
  pourcentage de remplissage, couleur d'accent paramétrée par mot/couleur de jeu).
- Grid/flex modernes (`grid-template-columns`, `gap`, `minmax()`, `auto-fit`) pour toute mise en
  page — déjà fait pour `game-grid-root` (grid) et `game-basket-slots` (flex), à généraliser et à
  sortir de `style:` vers une classe.
- `position: absolute` seulement quand un élément doit réellement se superposer à un autre
  visible en même temps (overlay modal, badge flottant) — jamais pour de simples panneaux
  exclusifs déjà gérés par `display:none`/`block`.
- Au moins un point de rupture responsive (`@media`) ou des unités fluides (`clamp()`,
  `minmax()`, `%`) sur les dimensions fixes (grille, largeur du timer, mise en page du footer).

**Don't**
- Dupliquer le même bloc `style: { padding, borderRadius, fontWeight… }` perso par perso quand
  une classe partagée suffirait.
- Poser une classe dans le markup (`class="quiz-hunt-…"`) sans jamais écrire la règle CSS
  correspondante — classe morte, aussi inerte qu'un commentaire non lu.
- `position: absolute; inset: 0` par réflexe pour empiler des panneaux qui ne sont jamais
  visibles simultanément.
- Dimensions/colonnes figées (`width: 220px`, `repeat(4, 1fr)`) sans réflexion sur un viewport
  étroit.

**Piste pour quiz-hunt** (non appliquée) : créer une feuille `quiz-hunt.css` co-localisée,
migrer les blocs `style:` statiques de chaque story vers des classes, retirer `position:absolute`
des panneaux trial/final, ajouter un breakpoint pour le footer (basket/timer empilés en colonne
sous ~640px) et une grille responsive (`repeat(auto-fit, minmax(64px, 1fr))`) pour les tuiles.

---

## 3. Tout monter dans le DOM dès l'init + `display:none`/`block` au lieu d'attacher/détacher dynamiquement

**Constaté dans** : `build-reading-quiz.ts` (32 panneaux trial), `final-story.ts` (32 panneaux
final), `result-story.ts`, `extra-story.ts` — tous montés à `game:zone:main` dès `initial.move`,
visibilité pilotée ensuite par `style.display` (`'none'`/`'block'`) sur les events `:show`/`:hide`.

**Constat (guidance utilisateur, à valider avant d'appliquer)** : CodPlay sait attacher/détacher
un perso du DOM dynamiquement (`move`), et la réapparition d'un élément doit passer par une
transition (`opacity`), pas par un simple basculement de visibilité. Seuls les éléments
structurels ("master" — conteneurs de zone, racine de layout) doivent être montés à la racine
de la scène dès l'init ; le reste s'attache à la demande.

**Do**
- Ne monter à l'init (`initial.move`) que les persos structurels/"master" (zones, racine de
  layout) — pas le contenu qui n'est affiché qu'une partie de la session (panneaux trial/final).
- Attacher un perso de contenu via une action `move` déclenchée par l'event qui le rend
  pertinent, le détacher quand il ne l'est plus, plutôt que le garder monté en permanence et
  jouer uniquement sur `display`.
- Révéler un élément qui vient d'être attaché par une transition d'opacité (action avec timing,
  ou `TweenAction`), pas par un saut `display:none → block`.

**Don't**
- Monter tous les persos de contenu à l'init puis ne piloter que leur `display` — ça maintient
  en mémoire/DOM des dizaines d'éléments jamais visibles (32 panneaux ici).
- Confondre `display:none` (élément présent mais masqué) avec un vrai détachement.

**⚠️ Point bloquant repéré en vérifiant le mécanisme actuel — à trancher avant d'appliquer** :
le détachement n'a, en l'état, **aucun sentinel propre et silencieux**. En lisant
`runtime/modules/move/index.ts` :
- `isMoveCommand` exige un `parentId` *string non vide* (`index.ts:14-21`) — un `move: {
  parentId: null }` est donc traité comme "pas de move du tout" (ignoré), pas comme un détachement.
- Le seul chemin qui détache réellement est de cibler un `parentId` qui ne résout à **aucune**
  liste/node connue (`'missing-list'` dans `tests/lot18/move-phase-c.spec.ts:187-198`, *L18-T1*)
  — et ce chemin émet systématiquement un warning `AUTHOR_LAYOUT_OUTLET_NOT_FOUND`
  (`index.ts:102-121`), pensé pour signaler une erreur d'auteur (cible introuvable par typo),
  pas un détachement volontaire.
- `warnOnce` dédoublonne par `{eventSeq, code, persoId}` (`runtime-component-orchestrator.ts:1044-1056`)
  — pas globalement par `persoId`. Donc chaque `hide` volontaire d'un panneau (nouvel `eventSeq`
  à chaque event) réémettrait ce warning, indéfiniment, pas juste une fois.

Adopter ce pattern sur quiz-hunt aujourd'hui produirait donc un warning d'erreur d'auteur à
chaque masquage volontaire d'un panneau. Avant de migrer le code : faut-il un vrai mécanisme de
détachement intentionnel (ex. `move: { parentId: null }` traité comme détachement explicite et
silencieux, distinct d'un `parentId` invalide), ou la pratique demandée doit-elle attendre cet
ajout côté CodPlay ? Je n'ai pas tranché — point à discuter, pas encore de gap noté côté spec
formelle (`v1-move-separation-policy-state-backend-dom.md` documente l'état actuel du
détachement-par-cible-manquante mais pas de sentinel dédié).

**Volet seek isolé séparément** : cette pratique ne pose pas de souci en lecture normale, mais sa
compatibilité avec le `seek` (scrubbing rapide notamment) est un sujet à part, plus profond que
le sentinel de détachement ci-dessus — formalisé dans
`docs/formalisation/2026-06-26-mount-unmount-seek-intention.md` (intention + précédent direct
`2026-06-25-image-node-per-src-plan.md`, questions ouvertes). Analyse de faisabilité à mener
séparément, pas encore faite.

---

## 4. Connaître `capsule-automation` (`AutoCapsule`) — une trousse à outils disponible, pas un passage obligé

**Précision importante** : `capsule-automation` est une boîte à outils optionnelle parmi
d'autres, pas une brique d'infrastructure obligatoire. Ce qui suit n'est pas "il faut migrer
quiz-hunt vers `AutoCapsule`" — c'est "cet outil existe, il résout déjà certains problèmes
(grille, classes, transitions nommées), donc le connaître avant de recoder la même chose à la
main est utile". Y recourir reste un choix au cas par cas, pas une règle.

**Constaté** : `packages/authoring/capsule-automation/` existe déjà et a un précédent d'usage
réel dans la base : `packages/demos/src/scenes/carousel-scene.ts`. Quiz-hunt n'en utilise rien
et recode à la main des choses que ce package sait résoudre : classes/grid CSS (item n°2
ci-dessus), et transitions de révélation (item n°3).

**Comment `carousel-scene.ts` s'en sert** (pattern à reprendre) :
- `new AutoCapsule({ capsule: { type:'carrousel', grid:{mode:'forced'}, defaults:{
  introTransitionRef:'swipe-right', outroTransitionRef:'swipe-left' } }, children })` résout,
  par enfant, un événement nommé avec une définition de transition (`style` avec `from`/`to`)
  et une durée.
- `buildImageActions()` convertit chaque `event.definition.style[action]` résolu en payload
  d'action `{ style: { [prop]: { from, to, duration } } }` — exactement la forme d'action CodPlay
  attendue, générée plutôt qu'écrite à la main par perso.
- `CAPSULE_TYPE.carrousel` + `GRID_MODE.forced` (grille `1×1`) = sémantique "un seul enfant
  visible à la fois" — **c'est exactement le rôle de `game:zone:main`** (grille ↔ trial-N ↔
  final-N ↔ résultat, un seul affiché).

**Nuance importante** : dans `carousel-scene.ts`, le déclenchement est **temporel** —
`AutoCapsule` résout un `triggerMs` par enfant à partir d'un `timeRange` fixe, consommé via
`eventimes` (planifié sur la timeline). Quiz-hunt est **événementiel** (un clic, une réponse
juste/fausse) — il n'y a pas de `timeRange` fixe à distribuer. La partie de `AutoCapsule`
directement réutilisable pour quiz-hunt est donc la résolution **grille/classes/définitions de
transition nommées**, pas la résolution de **timing** : le déclenchement (`show`/`hide` sur
`game:trial:{id}:show`) reste porté par les straps scène (`game-router`, `game-trial-resolve`)
comme aujourd'hui ; seul le payload d'action appliqué devrait venir d'`AutoCapsule` au lieu
d'un objet `style:` écrit à la main par panneau.

**Do**
- Savoir que `capsule-automation` existe avant d'écrire à la main une grille, des classes, ou
  des transitions nommées répétées sur plusieurs personas — l'utiliser quand le besoin
  correspond à ce qu'il résout (transitions nommées partagées, grille calculée).
- Si on s'en sert : transitions nommées via `AutoCapsuleEventDefinition` (`style` from/to +
  `durationMs`) plutôt que des blocs `style:` dupliqués perso par perso.
- Garder le déclenchement (quand un panneau s'affiche) dans les straps event-driven existants ;
  ne demander à `AutoCapsule`, le cas échéant, que la forme de l'action (classe/style résolus),
  pas le timing, quand le déclenchement n'est pas planifiable à l'avance.

**Don't**
- Considérer `capsule-automation` comme un passage obligé ou une dépendance à introduire
  systématiquement — c'est un outil parmi d'autres, à mobiliser quand il rend service, pas par
  défaut.
- Forcer le `timeRange`/`triggerMs` d'`AutoCapsule` sur un flux qui est en réalité piloté par des
  events utilisateur, pas par une planification temporelle fixe.

**Piste pour quiz-hunt** (non appliquée, à évaluer au cas par cas) : si la duplication des
blocs `style:` (item n°2) est jugée gênante, un `AutoCapsule` (ou directement ses fonctions
`core/`) pourrait factoriser la grille des 16 tuiles et un jeu de transitions nommées partagé
par les panneaux `game:zone:main` — sans que ce soit la seule façon de résoudre l'item n°2.

---

## 5. Séparer logique de scène (cumul cross-story) et logique de story (résolution locale) — penser story d'abord

**Constaté** : ce point est **déjà bien posé** dans quiz-hunt — à documenter comme référence
positive, pas comme défaut à corriger.

- `straps/game-trial-resolve.ts` et `straps/game-result.ts` (scène) : cumulent un état qui
  n'existe qu'au niveau scène — `trialStatus` (16 épreuves), `basket` (4 couleurs), temps
  restant — aucune trial-story individuelle ne pourrait porter cet état seule. C'est l'exemple
  même de "cumul des résultats" qui justifie un strap scène.
- `quizQuestionStoryStraps` (embarqué via `straps: quizQuestionStoryStraps` dans chaque
  `game-trial-{id}-story` et `game-final-{wordId}-story`) : résout *une* question — sélection,
  validation, correction — sur de l'état strictement local à cette story
  (`selectedAnswerIds`, `resolved`, `retryCount`). Aucune raison d'en faire un strap scène.
- La raison n'est pas qu'une question de goût : c'est une contrainte dure du routage CodPlay
  (déjà tracée dans `docs/formalisation/2026-06-19-quiz-hunt-plan.md` §"Correction
  d'architecture") — un event émis par le strap d'une story A n'atteint **jamais** le `listen`
  embarqué d'une story B ; un strap résolu via une règle `listen` de **scène** exécute toujours
  avec `scope.scopeStoryId === undefined` (portée globale, jamais ciblée vers une story
  précise). Donc : logique qui ne concerne qu'une story → embarquée, story-local ; logique qui
  doit lire/écrire un état partagé entre stories ou re-diffuser vers plusieurs cibles → scène.

**Do**
- Par défaut, écrire la logique dans la story concernée (`story.straps` + `story.listen`),
  sur l'état local de cette story.
- Ne monter un strap au niveau scène que s'il doit : (a) lire/écrire un état partagé entre
  plusieurs stories, ou (b) re-diffuser un event vers plusieurs cibles par nom (un strap scène
  ne peut cibler qu'une portée globale, jamais une story précise).
- Au moment d'écrire un nouveau strap, se poser la question dans cet ordre : "cet état/cet
  effet est-il local à une story ?" → story d'abord ; "non, il agrège/redistribue à travers
  plusieurs stories" → scène ensuite.

**Don't**
- Mettre un strap au niveau scène par réflexe "pour être sûr qu'il s'exécute", alors qu'une
  règle `listen` story-locale suffirait — ça casse la portabilité de la story (elle devient
  dépendante d'un strap externe) sans bénéfice, et le strap ne pourra jamais re-cibler une autre
  story précisément de toute façon.
- Dupliquer un état déjà local à la story (ex. `selectedAnswerIds`) dans l'état scène "pour
  pouvoir le lire depuis un strap scène" — si la logique a besoin de cet état, c'est qu'elle
  devrait rester côté story.
