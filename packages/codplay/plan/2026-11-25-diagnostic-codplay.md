# Diagnostic CodPlay — anomalies et optimisations

**Statut : A relire.** Revue de code du 25 novembre 2026, sur le modèle de la
revue étendue d’Editor. Aucun changement de code n’a été fait. Toute correction
du cœur reste soumise à l’autorisation explicite de l’utilisateur, à un plan
accepté et à la démonstration qu’aucune solution n’existe chez l’appelant.

Référence lue d’abord : [index V2](./codplay-v2-plan.md) et ses plans.

Périmètre : `src/` compte 333 fichiers et 45 000 lignes. Cette revue n’a pas
tout relu. Elle combine une analyse statique de tout le paquet (exports,
modules, noms de fonctions, marqueurs) et une lecture ciblée.

- Lu en entier : `facade/codplay-facade.ts`, `facade/engine-facade/instance-registry.ts`,
  `runtime/telco/`, les helpers de session des trois capacités replace.
- Lu en partie : `facade/instance-facade.ts`, `facade/engine-facade/mount-registry.ts`
  et `engine-facade.ts`, `runtime/runner-html/transient-flip.ts`,
  `motion-style-layer.ts`, `runtime/player/runtime-player/event-controller.ts`,
  `runtime/capture/capture-source-circuit.ts`, `ace/adapters/transform-adapter.ts`.
- Le système `move` et le module `replace` ont chacun leur revue détaillée
  plus bas.
- Non relus : le pipeline du player hors reconstruction, le compilateur
  (`scene/compiled/`), le loader de paquet, les composants, `ace/` hors
  adaptateurs.

État de base : typecheck propre ; 974 tests verts, 1 échec attendu, 2 échecs
(`tests/facade/sighty-layout.spec.ts`, voir C2).

## Défauts

- **C1 — Corrigé (2026-11-27).** Les écouteurs `onChange` sont isolés comme ceux
  de progression ; test `runtime-telco.spec.ts`. Constat d’origine :
  **un observateur interne qui lève une exception verrouille la telco**
  (confirmé en isolation, latent). `runCommand` passe `commandInFlight` à
  `true` puis appelle `notifyChange()` **avant** son `try`. Si un écouteur
  `onChange` lève, la commande rejette et `commandInFlight` reste `true` : toutes
  les commandes suivantes rendent `TELCO_COMMAND_IN_FLIGHT`. La façade publique
  protège chaque observateur par `try/catch`, donc aucun appelant actuel n’est
  touché ; seule une future souscription interne directe le serait. Les
  écouteurs de progression, eux, sont déjà isolés dans la telco.
- **C2 — Traité (2026-11-27), sauf `move`.** Les tests qui ne vérifiaient qu’une
  démo sont supprimés (une démo est elle-même le test de sa fonctionnalité) ;
  `open-duration-discovery.spec.ts` et `preload-media-node-handoff.spec.ts`
  vérifient leur fonctionnalité sur une scène propre. Restent, pour le chantier
  `move` : `position-demo`, `flip-stress-motion`, `story-five-motion`,
  `story-six-motion`. La suite n’a plus d’échec. Constat d’origine : **des tests
  du cœur dépendent des démos.** Dix fichiers de `tests/`
  importent `../../../demos/src/…` (dont `sighty-layout.spec.ts`,
  `sighty-demo4.spec.ts`, `components-demo.spec.ts`, `polygon-demo.spec.ts`,
  `chrono-demo.spec.ts`). La règle du projet l’interdit : un test possède ses
  fixtures. `sighty-layout.spec.ts` teste même la page partagée des démos, qui
  relève du paquet `demos`. Ses deux échecs viennent de l’environnement
  (`globalThis.localStorage` absent sous le Node actuel) et masquent l’état
  réel de la suite.
- **C3 — FLIP transitoire : matrice 3D ignorée et nettoyage dépendant de
  `transitionend`** (à qualifier). `transient-flip.ts` a sa propre
  `parseCssMatrix`, limitée à `matrix(...)` : un `matrix3d(...)` donne l’identité
  et fausse le rectangle mesuré ; `motion/html-pose.ts` lit, lui, les deux
  formes. Le nettoyage ne s’exécute qu’à `transitionend` sur `transform` ; une
  transition annulée (nœud masqué ou retiré, `transitioncancel`) laisse
  `transition: transform …` dans le style inline de l’auteur jusqu’au FLIP
  suivant du même nœud.
- **C4 — Corrigé (2026-11-27).** Feuille partagée par document, comptée par
  hôte, réinstallée si la page l’a retirée, supprimée avec le dernier hôte ;
  tests `motion-presentation-host.spec.ts`. Constat d’origine : **feuille de seek
  installée une fois par document, jamais retirée.**
  `motion-style-layer.ts` mémorise le document dans un `WeakSet` global et
  ajoute un `<style>` dans `head` hors de tout `@scope`. `CodPlay.destroy()` ne
  le retire pas ; si l’hôte retire ce style, le `WeakSet` empêche de le
  réinstaller.
- **C5 — Sans défaut après examen (2026-11-27)** pour la capture et le chargeur :
  `openSession`/`endNow` interceptent leurs erreurs, et le chargeur transmet
  le rejet (`.then(resolve, reject)`). Le cas FLIP relève du chantier FLIP.
  Constat d’origine : **promesses non observées** (à qualifier au cas par cas). `void
  this.end(...)` (`capture-source-circuit.ts`), `void captureHtmlPose(node)`
  (`transient-flip.ts`) et `void decoded.then(...)` (loader de paquet) ne
  traitent pas un rejet. `event-controller.ts` traite le sien pour la fin de
  séquence et l’inactivité.
- **C6 — Clos (2026-11-27).** Aucun circuit n’émet d’événement public pendant la
  création d’une instance, et ni Sighty ni Elcé n’en dépendent : la branche qui
  distribuait ces événements avant l’enregistrement de l’instance est retirée.
  Constat d’origine : **événements publics émis pendant l’initialisation.**
  `forwardPublicEvent` distribue aux écouteurs locaux tant que l’instance n’est
  pas enregistrée, mais cet ensemble est forcément vide à ce moment (l’instance
  n’est pas encore rendue à l’appelant) : un événement public émis par
  l’initialisation est perdu. À confirmer par la spec façade.

## Duplications et code mort

- **Retiré (2026-11-27)** : **`src/ace/vendor/` (18 fichiers, 2 768 lignes,
  copie d’anime.js) n’était importé par aucun fichier du dépôt.** Seuls ses `TODO` et `console.warn`
  apparaissent dans les recherches. Candidat à la suppression.
- Mécanique de session replace écrite trois fois : voir la
  [revue du module `replace`](#module-replace--revue-détaillée).
- Copies à l’identique : `resolveMotionStoryIds` (`capture-intents.ts`,
  `motion-occurrences.ts`), `transformedBounds` (`html-pose.ts`,
  `motion-pose.ts`), le filtre scalaire `resolveTransformProperty`
  (`pipeline/resolve.ts`, `html-transform-service.ts`), qui porte en plus le
  même nom que la fonction d’ACE qu’il enveloppe.
- Variantes d’une même règle : `addAncestorClosure` ×3 (dont une qui s’arrête
  aux stories), `isAfterStoryReset` ×2 (deux formes d’événement),
  `parseCssMatrix` ×2 (voir C3), `isParentNode` ×4, `isPlainRecord` et
  `isRecord` répétés alors que `shared/is-plain-record.ts` existe.
- **Traité (2026-11-27), hors `move` et FLIP** : 4 exports morts retirés, `export`
  retiré des déclarations utilisées dans leur seul fichier, doublons
  `resolveTransformProperty`, `isAfterStoryReset`, `isParentNode` (×6 sous
  plusieurs noms), `isPlainRecord`/`isRecord` et `listMaterializedRoots` (×4)
  remplacés par `ace` et `shared`, fonctions d’une ligne triviales inlinées.
  Le catalogue ACE reprend désormais l’intégralité des définitions d’anime.js
  (`linear(…)`, `steps`, `cubicBezier`, `irregular` graine par sa déclaration),
  comme la spec ACE l’annonçait. Constat d’origine — exports morts (aucune référence, même locale) : `RuntimePlayerEventInput`
  (`player-state.ts`), `DndPointerSample` (`list-dnd-preview/types.ts`),
  `HtmlRootTarget` (`runner-types.ts`), `appendMaskPath` (`masks.ts`). 72 autres
  exports ne servent que dans leur propre fichier (mot-clé `export` inutile).
- Aucun module n’est orphelin ou réservé aux tests ; aucune référence propre à
  Editor, Elcé, Sighty ou aux démos dans le cœur.

## Optimisations

- `runCommand` notifie deux fois par commande (avant et après) et recalcule
  l’état complet à chaque notification ; un `onChange` lourd est donc appelé
  deux fois par `seek`.

## Système `move` — revue détaillée

Références lues d’abord : specs [move](../specs/move-v2-spec.md),
[motion](../specs/motion-frame-v2-spec.md) et
[retarget](../specs/move-target-dependency-v2-spec.md) ; plans
[préparation par occurrence](./motion-live-discovery-invalidation-plan.md),
[intégration runner](./runner-flip-integration-study.md),
[retarget](./move-target-dependency-plan.md),
[dimensions](./list-dimension-interpolation-plan.md) et
[interpolation des poses](./motion-pose-interpolation-plan.md).

Lu en entier : `runner-html/player-runner/motion-controller.ts`,
`runner-html/motion-capture/` (3 fichiers), `runner-html/motion-system.ts`,
`runner-html/layout-snapshot.ts`, `runner-html/motion-container.ts`,
`runner-html/motion-presentation-host/motion-presentation-host.ts` et
`overlay-presenter.ts`, `motion/motion-graph/graph-builder.ts`,
`motion/motion-layout.ts`, `motion/motion-schedule.ts`,
`motion/motion-materializer.ts`, `player/structural-timeline.ts`,
`player/runtime-player/motion-occurrences.ts`, `scene-state.ts`,
`player/scene/scene-reconstruction.ts`. Lu en partie : `graph-pose.ts`
(résolution de frame et de pose), `html-pose.ts` (capture affine),
`local-presenter.ts` (commit), `move/move-policy.ts` (lecture de la
transition), `runtime-runner.ts` (seek, resize, raccords motion). Non relus :
`motion-pose.ts` (couvert par le plan d’interpolation), `motion-presentation/tree.ts`,
`motion-style-layer.ts`, `ace/path.ts`, `move-path-compiler.ts`.

### Mesure

Test jetable (supprimé) sur la fixture `flip-stress` (20 persos, 10 s), en
comptant les appels sur le vrai runtime :

| Opération | Reconstructions de scène | dont distinctes | Présentations de capture | `getComputedStyle` |
|---|---|---|---|---|
| création de l’instance | 20 | 20 | 0 | 0 |
| Seek 2 500 ms | 36 | 20 | 19 | 248 |
| Seek 5 000 ms | 38 | 23 | 16 | 359 |
| Seek 7 500 ms | 37 | 25 | 13 | 285 |
| Seek 5 000 ms (groupes déjà capturés) | 13 | 13 | 0 | 12 |

Une reconstruction rejoue le journal depuis 0 (`materializeScene`, puis
`resolveScene` et `solveScene`) ; une présentation de capture rematérialise
toute la scène dans le DOM. Sur la session (création, Seeks 2 500, 5 000,
7 500, 5 000 et 0), 146 reconstructions pour 69 distinctes. Chaque Seek fait
une seule capture, et ses 13 à 19 présentations portent toutes sur des scènes
distinctes. En Play avec 4 reparents actifs dans une racine : 4 alignements de
couche et 8 `getComputedStyle` par frame.

### Défauts et coûts

- **MV1 — Aucune mémorisation des scènes reconstruites** (mesuré). Environ
  40 % des reconstructions d’un Seek sont des doublons exacts (même instant,
  mêmes options). Les sources : `collectMoveOccurrences` reconstruit la scène
  « avant » de chaque occurrence pour lire ses stories ;
  `expandLateDestinationAncestorIntents` reconstruit deux scènes par move
  structurel, que `captureHtmlMotionBoundaries` reconstruit de nouveau ; chaque
  groupe reconstruit ses scènes FIRST, après-start, keyframes et LAST, sans
  partage entre groupes qui commencent au même instant ;
  `captureCurrentMotionFirstSnapshots` reconstruit et présente une scène par
  occurrence. La reconstruction est pure (contrat « frame au temps absolu »).
- **MV2 — Deux captures du même groupe quand la tête exclut `persist-only`.**
  Le contrôleur tient deux jeux de frontières (`replayMotionBoundaries`,
  `presentationMotionBoundaries`). Ils partagent une capture quand la tête
  courante inclut les faits `persist-only`, ce qui est le cas mesuré. La tête
  ne les exclut qu’après l’émission d’un tel fait (`event-controller.ts`) :
  les deux captures diffèrent alors légitimement, et un partage demanderait
  de prouver que le fait ne touche pas le groupe. Coût réel limité aux
  sessions live (DnD, capture), non mesuré.
  `selectMotionIntentGroupsForOccurrences` y est calculé deux fois avec les
  mêmes arguments.
- **MV3 — Layout forcé à chaque frame pour chaque reparent actif.**
  `ensureOverlay` appelle `getOverlayLayer`, donc `alignOverlayLayer`, qui
  écrit `transform: none` sur la couche puis lit les poses de la racine et de la
  couche (`getComputedStyle`, offsets). Avec k reparents actifs dans une même
  racine, chaque frame de Play force k recalculs de layout synchrones, pour une
  valeur qui ne change qu’au resize ou au scroll.
- **MV4 — Resize : ni regroupement, ni recapture différée.** `observeRootResize`
  appelle `runner.resize` à chaque notification ; chaque appel jette toutes les
  frontières puis relance `refresh({ emitMotionOccurrences: true })`, qui
  recapture tout de suite les moves actifs. Pendant un redimensionnement de
  fenêtre, chaque frame refait la capture complète (MV1, MV2). Le plan prévoit
  une recapture différée des seuls groupes requis (gate ouverte). De plus,
  `isMoveActiveAt` ne lit que `move.transition` : un mouvement géométrique porté
  par un tween de style reconnu n’est pas réoffert après un resize, alors que le
  plan lui garde son chemin de capture (à qualifier).
- **MV5 — Trois définitions du groupe de capture.** `groupMotionIntents` (une
  story, ou `<root>` pour toutes les autres), `scheduledMotionGroupKey`
  (stories triées, début, fin, régime) et `motionBoundaryGroupKey` (stories,
  début, régime et liste des items, sans la fin) ne découpent pas de la même
  façon. Un groupe recapturé avec un item de plus a une autre clé de fusion :
  l’ancienne frontière et la nouvelle coexistent pour les mêmes items au même
  instant (à qualifier par un test).
- **MV6 — Circuits morts de l’ancienne préparation.** `compileMotionSchedule`
  (catalogue global à l’initialisation, avec `flattenEventimes`,
  `resolveAction` et `journalEvents`) n’a plus d’appelant de production ; seul
  `motion-schedule.spec.ts` l’exerce, alors que la spec move le cite comme
  preuve du schedule. Les barrières de reset du graphe (`resetTimesByItem`,
  21 occurrences dans `motion/`) reçoivent toujours une `Map` vide en
  production ; `setResetTimesByItem`, `invalidate` et `setBoundaries` ne
  servent qu’aux tests. Le plan dit que le partitionnement par groupe remplace
  ces barrières. La lecture refuse encore la propriété V1 `flipMode`.
- **MV7 — La valeur `move` est relue trois fois.** `move-policy.readMoveTransition`
  (diagnostic `INVALID_TRANSITION`), `motion-schedule.readTransition` (abandon
  silencieux, ou exception pour un chemin non préparé, défaut d’ease
  `out(2)`) et `motion-occurrences.isMoveActiveAt` (délai invalide lu comme 0)
  ne réagissent pas de la même façon à une même donnée, déjà validée par le
  compilateur. La règle « une déclaration par item et par instant, la dernière
  gagne » est écrite deux fois (`compileMotionSchedule` et
  `createMotionIntentsFromOccurrences`), et la création d’intention à partir
  d’une occurrence deux fois (contrôleur et `expandLateDestinationAncestorIntents`).
- **MV8 — Chronologie structurelle quadratique.** `StructuralTimeline` fait une
  reconstruction complète par instant d’événement (20 à la création ici), chacune
  rejouant le journal : O(E²). Elle est reconstruite entièrement à chaque
  changement de révision du journal, donc à chaque événement live ou capture.
  `resolveAt` parcourt les instantanés linéairement, et chaque instantané
  sérialise tout l’ordre en JSON pour sa révision.
- **MV9 — Coûts mineurs par frame et par commit.** `resolvePresentationFrame`
  parcourt tous les items ayant eu un segment, même terminé depuis longtemps ;
  chaque `commit` reconstruit tout le graphe depuis toutes les frontières ;
  `presentMotion` peut présenter deux fois la même frame.

### Optimisations possibles, par gain et par risque

1. **Mémoriser les reconstructions** dans `RuntimePlayerSceneState`, avec
   invalidation par révision du journal et par signature des cibles de montage
   (qui changent hors journal, à la matérialisation des composants), hors
   aperçu de snapshot. Gain mesuré : −40 % par Seek, −53 % sur la session.
   Risque faible. Plan d’exécution :
   [mémorisation des reconstructions](./scene-reconstruction-memo-plan.md).
2. **Une seule capture par groupe et par transaction** : non planifié. La
   mesure ne montre ni double capture ni scène présentée deux fois sur
   `flip-stress` (voir MV2). À reprendre seulement avec une mesure sur une
   session live DnD ou capture.
3. **Aligner la couche d’overlay une fois par racine et par frame**, au lieu
   d’une fois par reparent actif (MV3) : 4 alignements par frame deviennent 1
   sur `flip-stress`. Aligner seulement au resize ou au scroll reste une
   décision ouverte, car la racine peut bouger pendant un segment. Plan
   d’exécution : [alignement de la couche overlay](./motion-overlay-alignment-plan.md).
4. **Regrouper les resize** (une fois par frame, et rien si l’échelle et la
   taille de racine n’ont pas changé), puis recapturer à la demande, comme le
   prévoit déjà le plan (MV4).
5. **Retirer les circuits morts et unifier** : `compileMotionSchedule`,
   les barrières de reset, une seule lecture de la valeur `move` (à la frontière
   de compilation), une seule clé de groupe (MV5 à MV7). Réduit la surface
   avant d’optimiser, et corrige la preuve citée par la spec.
6. **Chronologie structurelle incrémentale** : recalculer à partir du premier
   instant modifié par le nouvel événement, recherche binaire dans
   `resolveAt`. Gain sur les scènes longues et les captures live ; risque plus
   élevé (ordre des listes, politiques des modules).

Ces optimisations touchent le cœur `packages/codplay` : elles demandent
l’autorisation explicite de l’utilisateur, un plan accepté, et le parcours de
validation du [plan runner](./runner-flip-integration-study.md) (Play/Seek,
reset, resize, lifecycle, Safari). Les points 1 et 3 sont indépendants des
gates ouvertes ; les points 4 et 6 en recoupent.

## Module `replace` — revue détaillée

Références lues d’abord : specs [présentation replace](../specs/replace-presentation-v2-spec.md),
[texte](../specs/replace-text-v2-spec.md), [média](../specs/replace-media-v2-spec.md),
[presets](../specs/replace-presets-v2-spec.md) et la partie replace de la
[spec slot](../specs/slot-component-spec.md). Aucun plan replace n’est ouvert.

Lu en entier : les capacités `replace-text`, `replace-media` et `replace-slot`
(dont `replace-slot-profile.ts`), `replace-presets/` sauf le catalogue JSON,
la partie replace des validateurs `text-validation.ts`,
`replace-media-validation.ts` et `slot-validation.ts`. Lu en partie :
`runner-html/replace-presentation/session.ts` (API de session) et `motion.ts`
(durées et propagation), `presentation.ts` (`replayForSeek`), `materialize.ts`
(liste des actions d’un perso). Non relus : le reste de
`runner-html/replace-presentation/` (DOM, texte, média, masques, profils).

Trois probes jetables (supprimés) ont confirmé RP1 à RP3.

### Défauts et coûts

- **RP1 — Corrigé** (plan `replace`, A3). **Le builder accepte des réglages de
  grille que le runtime refuse en bloc** (confirmé). Pour une image ou une vidéo, `{ transition: 'curtain',
  stagger: 100 }`, `{ transition: 'fade', direction: 'left' }` ou
  `{ transition: 'wipe', cellX: 4 }` passent `SceneBuilder` sans diagnostic.
  À l’exécution, `normalizeReplaceMediaCommand` passe ces transitions CSS du
  slot à `parseSlotReplaceProfile`, qui rejette tout réglage de grille sans
  `split: 'cells'` : la commande vaut `undefined` et la source change sans
  aucune transition ni avertissement. Le validateur du slot refuse ces mêmes
  formes, celui des médias ne les vérifie que pour `staggerPattern` et
  `cellSize`. Cause : chaque capacité valide deux fois, au build puis à chaque
  mise à jour, avec deux jeux de règles écrits séparément (voir RP5).
  _Décision à prendre_ : refuser ces formes au build, comme le slot, ou les
  ignorer au runtime comme les splits texte historiques du slot.
- **RP2 — Corrigé** (A1). **La clé d’occurrence texte et média dépend de la
  position dans la liste des actions** (confirmé sur la clé, effet visuel à vérifier).
  `replace-text` et `replace-media` identifient une occurrence par
  `${eventId ?? name}:${startAt}:${index}`, où `index` est sa place dans
  `activeActions`. Cette liste peut perdre une action plus ancienne en cours de
  route : un tween arrêté par `tween:stop`, ou l’étape tween d’une séquence
  relancée. Mesure : un `swap` à 300 ms (600 ms de fondu) après un tween à 0 ms
  arrêté à 500 ms a la clé `swap:300:1` à 450 ms puis `swap:300:0` à 550 ms. Le
  module la prend alors pour une nouvelle occurrence : il annule la session,
  capture la composition visible et recommence la transition au milieu. Un
  Seek direct à 550 ms ne crée qu’une session : Play et Seek divergent.
  `replace-slot` n’utilise pas l’indice, mais deux occurrences de même nom au
  même instant y partagent la même clé. `MaterializedAction` porte déjà
  `eventSeq` et `declarationPath`, que `ComponentActionOccurrence` ne transmet
  pas ; `move` s’en sert pour la même identification (`actionOccurrenceKey`).
- **RP3 — Corrigé** (A2). **Un Seek crée une session DOM pour chaque
  remplacement passé**
  (mesuré). Un `tag` avec 10 remplacements à 1 s d’intervalle : un Seek à
  10 500 ms ouvre 10 sessions, un Seek à 5 100 ms en ouvre 5, alors qu’une
  seule est visible à l’arrivée. `replayForSeek` présente chaque frontière
  logique antérieure avec `componentPhase: 'seek'`, et les trois modules ouvrent
  une session dans cette phase : clonage, mesures DOM, découpage texte, puis
  fin immédiate. La présentation finale du Seek utilise aussi `'seek'`
  (`seek-controller.ts`) : les modules ne peuvent pas distinguer le rejeu
  intermédiaire de la cible. Le coût croît avec le nombre de remplacements
  passés. _Décision à prendre_ : comment le player signale le rejeu
  intermédiaire (phase distincte ou absence de hook replace).
- **RP4 — Corrigé** (B1 : preset JSON sur un média). **`fade` désigne deux effets** (à qualifier). Le nom existe comme
  transition CSS du slot et comme preset JSON (300 ms tous les deux). Sur
  `tag`/`text`, `fade` prend le preset JSON ; sur `img`/`media`,
  `normalizeReplaceMediaCommand` teste d’abord les transitions du slot et prend
  le fondu CSS : le preset JSON `fade` n’est jamais atteint pour un média. Le
  helper auteur `resolveReplacePresetChoice('fade', 'default')` rend `'fade'`
  pour les deux. La spec média dit accepter « les sept transitions CSS ainsi
  que les noms du catalogue » sans trancher ce cas.
- **RP5 — Corrigé** (B2). **Normalisation complète à chaque mise à jour.** Chaque
  `beforeComponentUpdate` et `afterComponentUpdate` appelle
  `resolveLatestReplaceOccurrence`, qui renormalise toutes les actions de
  l’historique du perso. Pour le texte, chacune relance aussi
  `resolveContentBeforeOccurrence` sur toutes les actions précédentes : le coût
  est quadratique en nombre d’actions, deux fois par mise à jour (non mesuré ;
  sensible pour un texte souvent remplacé, comme un chrono). La commande est
  déjà validée par le builder, et sa forme compilée ne change pas.

### Duplications et code mort

- Les trois modules recopient la même mécanique de session :
  `sessions` / `handledOccurrences`, `cancelSession`, l’enchaînement
  `beforeComponentUpdate` → `afterComponentUpdate`, `beforeSeek` et `destroy`,
  et `createReplaceAnimation`, dont le calcul de progression et la fin sont
  identiques. Le média n’y ajoute que l’attente de frame, et le slot que la
  présentation externe. `resolveLatestReplaceOccurrence` existe en trois
  variantes (filtre sur `content`, `src` ou aucun ; clé avec ou sans indice).
- Six circuits de validation pour trois capacités : un validateur de build et
  un normaliseur runtime par capacité, aux règles proches mais non partagées
  (cause de RP1).
- Valeurs par défaut répétées et non spécifiées : propagation à 40 % de la
  durée pour le texte et 50 % pour le texte rouleau, les médias et le slot
  (`motion.ts` ×3, `replace-media-capability.ts`), grille 4 × 3
  (`getGridDuration`). La spec ne donne le 4 × 3 que pour le slot, et ne donne
  la part de propagation par défaut nulle part.
- Code mort : `normalizeReplaceSimpleCommand`, `ReplaceSimpleCommand` et
  `DEFAULT_REPLACE_DURATION_MS` (« compatibilité » d’un ancien helper image)
  n’ont aucun appelant dans le dépôt et ne sont pas exportés par la racine du
  paquet. `getGridDuration` ne sert que de repli quand la session n’a pas de
  `getDuration`, ce qui n’arrive jamais, et il ignore `cellSize` et la
  déduction d’un axe par le ratio : sa durée diffère de celle de la surface
  dans ces cas.

### Corrections et optimisations possibles, par priorité

1. **Clé d’occurrence stable** (RP2) : transmettre `eventSeq` et
   `declarationPath` dans `ComponentActionOccurrence` et former la clé comme
   `move`, sans indice. Correction de comportement Play/Seek, à couvrir par un
   test `tween:stop` pendant un remplacement.
2. **Une seule règle de validation par capacité** (RP1, RP5) : le validateur de
   build appelle le normaliseur runtime et rapporte son refus, au lieu de
   réécrire les règles. Supprime la divergence et trois circuits.
3. **Pas de session pendant le rejeu intermédiaire d’un Seek** (RP3), une fois
   le signal du player décidé. Gain proportionnel au nombre de remplacements
   passés.
4. **Mécanique de session commune** aux trois modules, avec le code mort retiré
   et les valeurs par défaut regroupées en configuration, puis reportées dans
   les specs.
5. **Commande normalisée une fois** (RP5), à la compilation ou au premier
   usage de l’occurrence, et contenu sortant calculé en un seul parcours. Plus
   risqué si la normalisation passe par le codec compilé.

Ces corrections sont planifiées dans le [plan `replace`](./replace-media-live-video-plan.md)
(tranche A pour 1 à 4, tranche B pour RP4 et 5) ; elles touchent
`packages/codplay` et attendent l’autorisation explicite de l’utilisateur.

## Couleurs

Revue faite après coup (2026-11-27). Elle a relevé cinq défauts : tween
impossible entre deux espaces, alpha non prémultiplié (assombrissement vers
`transparent`), teinte interpolée depuis une couleur achromatique, formes CSS
Color 4 rejetées (`hsl()`, `lab()`, `color()`…), chroma replace désactivé hors
sRGB. **Traité** : un seul espace actif, OKLCH, normalisé par le compilateur ;
voir le [plan couleur](./color-values-plan.md) pour le reste.

## Documentation

- **Traité en partie (2026-11-27)** : relevé daté et travail restant retirés de
  `third-party-rive-spec.md`. Le lien mort d’`AGENTS.md` est à corriger sur
  `develop`, puis à propager (décision utilisateur). Constat d’origine — la note
  de découverte exigée par `AGENTS.md`
  (`plan/notes/2026-08-26-decouverte-etat-codplay-v2.md`) n’existe pas : lien
  mort dans les règles de travail.
- `list-dnd-v2-spec.md` et `third-party-rive-spec.md` portent un statut ;
  `third-party-rive-spec.md` décrit aussi un parcours Safari daté : contenu de
  plan dans une spec.
- Une quinzaine de plans sont « En cours » sans date de dernière vérification,
  et `evolutions/evolution-backlog.md` est « A relire ».

## Structure des modules du cœur — revue du 2026-11-27

Relevé fait contre les specs existantes, hors move et FLIP.

- **Traité** : faux DOM de test retiré d’`image` et `media` ; commentaire cité
  Sighty retiré de `layout` ; défaut `div` en double retiré de `slot` ; alias
  `HTMLComponentInput` / `HTMLComponentServices` supprimés ; mesure des lignes
  de `layout` ramenée au repère local du paragraphe par la pose affine ;
  `isNonEmptyString` et `samePoint` dédupliquées ; deux appels d’une ligne de
  replace inlinés.
- **Specs complétées** : contrat d’un module (`component-materialization-v2-spec`),
  typage d’un perso externe et champs `name` / `list` du perso
  (`scene-authoring-spec`), preuves des six comportements qui reposaient sur
  des tests de démo supprimés (voir leurs nouveaux tests de fonctionnalité).
- **Décision ouverte — surface d’import des composants externes** :
  `package.json` exporte `.` et `./*`, donc tout chemin interne est importable.
  `authoring/component-v2` importe vingt symboles par des chemins internes, dont
  quinze sont absents de l’entrée `codplay` : `isComponentRecord`,
  `reportInvalidComponentValue`, `isMeasurableHtmlElement`, `resolveAncestorChain`,
  `SolvedScene`, `PLAYER_LIFECYCLE_PLAYING`, `PLAYER_LIFECYCLE_READY`,
  `Diagnostic`, `RuntimeCaptureSourceSession`, `HtmlSourceAdapter`,
  `HtmlSourceAdapterContext`, `HtmlSourceAdapterFactory`,
  `CompiledScrollObservation`, `CompiledScrollObservationEvent` et
  `AuthorScrollObservationDeclaration`. La plupart servent `scroll-container`,
  qui s’accroche aux sources de capture et au runner. Les promouvoir à l’entrée
  publique élargit l’API du cœur : décision utilisateur, avec modification de
  `component-v2` sur `develop`.
- **Imports entre modules — pas de règle adoptée** : 146 imports atteignent
  directement un fichier interne d’un autre module au lieu de son `index`.
  Imposer l’`index` créerait des cycles : `scene` importe
  `runtime/components` (9 imports) et `runtime/components` importe `scene`. Une
  règle suppose de casser ce cycle d’abord.
- **Reste ouvert, hors décision** : trois liens de `plan/` pointent vers des
  notes ou un plan absents (`action-sequence-tween-plan`,
  `2026-09-18-third-party-components-v2-plan`) ; cinq doublons à corps
  différents (tests « élément HTML », `freezeValue` / `freezeRecord`, tailles
  locales) ; douze fonctions d’`ace` sans commentaire.
