# Bonnes pratiques — projet CodPlay

Recommandations curées, valables comme bonnes pratiques générales pour le projet — pas des
règles spécifiques à une démo. Les illustrations citées (`chrono-story.ts`, `carousel-scene.ts`…)
servent d'exemples concrets, pas de périmètre. Le statut d'application de ces pratiques sur une
démo donnée (quiz-hunt ou autre) se suit dans le `BUGS.md` de cette démo, pas ici.

---

## 1. Ne pas porter une valeur continue (countdown, barre de progression) par un `context.live.loop` à haute fréquence

**Pourquoi c'est une mauvaise pratique** :

- Un strap est l'unité de comportement déclenchée par un event nommé (architecture CodPlay :
  "Straps are the primary behavior unit — pure functions triggered by named events"). Le faire
  retourner une boucle qui re-émet des events à cadence fixe (ex. toutes les 250 ms) le
  transforme en générateur de flux continu, alors que sa vocation est de réagir à des
  *changements d'état* (start, pause, resume, stop).
- Chaque tick (update + events) est matérialisé en `TrackEntry` ("Every event and state mutation
  emitted by a strap is written to a track as a TrackEntry"). Pour un timer de plusieurs minutes
  à 250 ms, ça représente des milliers d'entrées track pour une simple barre de progression.
- Le `seek` doit alors rejouer toutes ces entrées une par une au lieu d'une évaluation directe —
  alors que c'est exactement le cas d'usage que `TweenAction` est fait pour couvrir : `fn` est
  "re-évaluable à n'importe quelle position T sans rejouer de strap" (`v1-tween-action-spec.md`,
  §Motivation).
- Chaque appel à `context.live.loop(...)` crée un job indépendant ; rien dans le contrat ne
  fusionne ou n'annule automatiquement un loop précédent (`until: { type:'event' }` "n'interrompt
  que ce loop" — `v1-strap-helpers-spec.md` §Règles normatives). Sans bookkeeping manuel du
  `HelperHandle`, deux démarrages successifs tournent en parallèle.

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
  de `fn` (`v1-tween-action-spec.md` §2).

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

---

## 2. Styles statiques en `style:` inline au lieu de classes CSS, `position: absolute` non justifié, aucun responsive

**Constat** :

- CodPlay expose `className` comme service d'action de premier rang, au même titre que `style`
  et `attr` (`v1-component-api.md` §"Props d'element interne", formes `className: 'x'`
  remplacement, ou `className: { add: 'x' }` additive). Rien n'empêche de styler par classes.
- Poser une classe dans le markup sans jamais écrire la règle CSS correspondante revient à une
  classe morte, aussi inerte qu'un commentaire non lu.
- `position: absolute; inset: 0` n'apporte rien quand un seul élément d'un groupe est visible à
  la fois et que la zone parente réserve déjà sa hauteur — un flux normal (`display: none`/`block`
  au show/hide) ferait exactement la même chose, sans le risque de chevauchement que l'absolute
  ouvre. Usages légitimes : overlay modal plein écran par-dessus le reste, badge flottant en coin
  de zone — deux vrais cas de superposition simultanée.
- L'absence de `@media`, `clamp()`/`minmax()`/`auto-fit` sur des dimensions fixes (grille à
  colonnes fixes, largeur figée, mise en page toujours en ligne) empêche toute adaptation à un
  viewport étroit.

**Do**
- Propriétés statiques (couleur, padding, border-radius, font-weight, gap, layout grid/flex…) →
  classe CSS déclarée dans une feuille de style du projet (variables CSS, sélecteurs nommés),
  appliquée via `className`.
- Dans les classes CSS, privilégier des valeurs exprimées en `em` quand l'échelle doit suivre la
  typo ou le contexte du composant ; garder `px` en dernière intention, pour les cas où une valeur
  fixe est réellement voulue.
- `style:` inline réservé aux valeurs réellement dynamiques (calculées par strap/tween :
  pourcentage de remplissage, couleur d'accent paramétrée).
- Grid/flex modernes (`grid-template-columns`, `gap`, `minmax()`, `auto-fit`) pour toute mise en
  page.
- `position: absolute` seulement quand un élément doit réellement se superposer à un autre
  visible en même temps (overlay modal, badge flottant) — jamais pour de simples panneaux
  exclusifs déjà gérés par `display:none`/`block`.
- Au moins un point de rupture responsive (`@media`) ou des unités fluides (`clamp()`,
  `minmax()`, `%`) sur les dimensions fixes.

**Don't**
- Dupliquer le même bloc `style: { padding, borderRadius, fontWeight… }` perso par perso quand
  une classe partagée suffirait.
- Remplir les classes CSS de dimensions en `px` par défaut quand une valeur relative (`em`) ferait
  mieux ressortir l'intention de mise à l'échelle.
- Poser une classe dans le markup sans jamais écrire la règle CSS correspondante.
- `position: absolute; inset: 0` par réflexe pour empiler des panneaux qui ne sont jamais
  visibles simultanément.
- Dimensions/colonnes figées sans réflexion sur un viewport étroit.

---

## 3. Tout monter dans le DOM dès l'init + `display:none`/`block` au lieu d'attacher/détacher dynamiquement

**Constat** : CodPlay sait attacher/détacher un perso du DOM dynamiquement (`move`), et la
réapparition d'un élément doit passer par une transition (`opacity`), pas par un simple
basculement de visibilité. Seuls les éléments structurels ("master" — conteneurs de zone, racine
de layout) doivent être montés à la racine de la scène dès l'init (`move: '@root'`) ; le reste
s'attache à la demande.

**Do**
- Ne monter à l'init (`initial.move`) que les persos structurels/"master" (zones, racine de
  layout) — pas le contenu qui n'est affiché qu'une partie de la session.
- Attacher un perso de contenu via une action `move` déclenchée par l'event qui le rend
  pertinent, le détacher quand il ne l'est plus, plutôt que le garder monté en permanence et
  jouer uniquement sur `display`.
- Révéler un élément qui vient d'être attaché par une transition d'opacité (action avec timing,
  ou `TweenAction`), pas par un saut `display:none → block`.

**Don't**
- Monter tous les persos de contenu à l'init puis ne piloter que leur `display` — ça maintient
  en mémoire/DOM des dizaines d'éléments jamais visibles.
- Confondre `display:none` (élément présent mais masqué) avec un vrai détachement.
- Laisser un perso censé n'être présent qu'à la demande sans aucun `move` ni `move: '@off'`
  initial — un perso sans `move` du tout n'est jamais monté par défaut (`v1-perso-spec.md`
  §4bis) ; lui donner `move: '@root'` prématurément (ou par copier-coller d'un perso structurel)
  neutralise silencieusement tout détachement/filtrage de seek qu'on croit avoir mis en place
  sur ce perso.

Mécanisme : `move: '@off'` (Phase 3 de `2026-06-28-unify-action-execution-and-move-off-plan.md`)
— sentinel de détachement intentionnel, détache réellement le nœud du DOM.

---

## 4. Connaître `capsule-automation` (`AutoCapsule`) — une trousse à outils disponible, pas un passage obligé

**Précision importante** : `capsule-automation` est une boîte à outils optionnelle parmi
d'autres, pas une brique d'infrastructure obligatoire. Ce qui suit n'est pas "il faut migrer
vers `AutoCapsule`" — c'est "cet outil existe, il résout déjà certains problèmes (grille,
classes, transitions nommées), donc le connaître avant de recoder la même chose à la main est
utile". Y recourir reste un choix au cas par cas, pas une règle.

**Comment `carousel-scene.ts` s'en sert** (pattern à reprendre) :
- `new AutoCapsule({ capsule: { type:'carrousel', grid:{mode:'forced'}, defaults:{
  introTransitionRef:'swipe-right', outroTransitionRef:'swipe-left' } }, children })` résout,
  par enfant, un événement nommé avec une définition de transition (`style` avec `from`/`to`)
  et une durée.
- `buildImageActions()` convertit chaque `event.definition.style[action]` résolu en payload
  d'action `{ style: { [prop]: { from, to, duration } } }` — exactement la forme d'action CodPlay
  attendue, générée plutôt qu'écrite à la main par perso.
- `CAPSULE_TYPE.carrousel` + `GRID_MODE.forced` (grille `1×1`) = sémantique "un seul enfant
  visible à la fois".

**Nuance importante** : le déclenchement résolu par `AutoCapsule` est **temporel** —
`triggerMs` par enfant à partir d'un `timeRange` fixe, consommé via `eventimes` (planifié sur la
timeline). Pour un flux **événementiel** (un clic, une réponse juste/fausse), il n'y a pas de
`timeRange` fixe à distribuer : la partie de `AutoCapsule` directement réutilisable dans ce cas
est la résolution **grille/classes/définitions de transition nommées**, pas la résolution de
**timing** — le déclenchement reste porté par les straps event-driven existants ; seul le payload
d'action appliqué peut venir d'`AutoCapsule` au lieu d'un objet `style:` écrit à la main.

**Do**
- Savoir que `capsule-automation` existe avant d'écrire à la main une grille, des classes, ou
  des transitions nommées répétées sur plusieurs personas — l'utiliser quand le besoin
  correspond à ce qu'il résout (transitions nommées partagées, grille calculée).
- Si on s'en sert : transitions nommées via `AutoCapsuleEventDefinition` (`style` from/to +
  `durationMs`) plutôt que des blocs `style:` dupliqués perso par perso.
- Garder le déclenchement (quand un élément s'affiche) dans les straps event-driven existants ;
  ne demander à `AutoCapsule`, le cas échéant, que la forme de l'action (classe/style résolus),
  pas le timing, quand le déclenchement n'est pas planifiable à l'avance.

**Don't**
- Considérer `capsule-automation` comme un passage obligé ou une dépendance à introduire
  systématiquement — c'est un outil parmi d'autres, à mobiliser quand il rend service, pas par
  défaut.
- Forcer le `timeRange`/`triggerMs` d'`AutoCapsule` sur un flux qui est en réalité piloté par des
  events utilisateur, pas par une planification temporelle fixe.

---

## 5. Séparer logique de scène (cumul cross-story) et logique de story (résolution locale) — penser story d'abord

**Constat** :

- Un état qui n'existe qu'au niveau scène (cumul à travers plusieurs stories — score global,
  inventaire partagé, temps restant commun) justifie un strap de **scène**.
- Une logique qui résout *une* instance locale (sélection, validation, correction sur l'état
  propre à une story) n'a aucune raison de monter au niveau scène — elle reste embarquée
  (`story.straps` + `story.listen`).
- La raison n'est pas qu'une question de goût : c'est une contrainte dure du routage CodPlay —
  un event émis par le strap d'une story A n'atteint **jamais** le `listen` embarqué d'une story
  B ; un strap résolu via une règle `listen` de **scène** exécute toujours avec
  `scope.scopeStoryId === undefined` (portée globale, jamais ciblée vers une story précise).
  Donc : logique qui ne concerne qu'une story → embarquée, story-local ; logique qui doit
  lire/écrire un état partagé entre stories ou re-diffuser vers plusieurs cibles → scène.

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
- Dupliquer un état déjà local à une story dans l'état scène "pour pouvoir le lire depuis un
  strap scène" — si la logique a besoin de cet état, c'est qu'elle devrait rester côté story.
