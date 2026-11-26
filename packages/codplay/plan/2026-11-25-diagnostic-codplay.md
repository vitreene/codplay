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
- Le système `move` a sa revue détaillée plus bas.
- Non relus : le pipeline du player hors reconstruction, le compilateur
  (`scene/compiled/`), le loader de paquet, les composants, `ace/` hors
  adaptateurs.

État de base : typecheck propre ; 974 tests verts, 1 échec attendu, 2 échecs
(`tests/facade/sighty-layout.spec.ts`, voir C2).

## Défauts

- **C1 — Un observateur interne qui lève une exception verrouille la telco**
  (confirmé en isolation, latent). `runCommand` passe `commandInFlight` à
  `true` puis appelle `notifyChange()` **avant** son `try`. Si un écouteur
  `onChange` lève, la commande rejette et `commandInFlight` reste `true` : toutes
  les commandes suivantes rendent `TELCO_COMMAND_IN_FLIGHT`. La façade publique
  protège chaque observateur par `try/catch`, donc aucun appelant actuel n’est
  touché ; seule une future souscription interne directe le serait. Les
  écouteurs de progression, eux, sont déjà isolés dans la telco.
- **C2 — Des tests du cœur dépendent des démos.** Dix fichiers de `tests/`
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
- **C4 — Feuille de seek installée une fois par document, jamais retirée.**
  `motion-style-layer.ts` mémorise le document dans un `WeakSet` global et
  ajoute un `<style>` dans `head` hors de tout `@scope`. `CodPlay.destroy()` ne
  le retire pas ; si l’hôte retire ce style, le `WeakSet` empêche de le
  réinstaller.
- **C5 — Promesses non observées** (à qualifier au cas par cas). `void
  this.end(...)` (`capture-source-circuit.ts`), `void captureHtmlPose(node)`
  (`transient-flip.ts`) et `void decoded.then(...)` (loader de paquet) ne
  traitent pas un rejet. `event-controller.ts` traite le sien pour la fin de
  séquence et l’inactivité.
- **C6 — Événements publics émis pendant l’initialisation.**
  `forwardPublicEvent` distribue aux écouteurs locaux tant que l’instance n’est
  pas enregistrée, mais cet ensemble est forcément vide à ce moment (l’instance
  n’est pas encore rendue à l’appelant) : un événement public émis par
  l’initialisation est perdu. À confirmer par la spec façade.

## Duplications et code mort

- **`src/ace/vendor/` (18 fichiers, 2 768 lignes, copie d’anime.js) n’est
  importé par aucun fichier du dépôt.** Seuls ses `TODO` et `console.warn`
  apparaissent dans les recherches. Candidat à la suppression.
- Animation de session replace écrite trois fois (`replace-text`,
  `replace-slot`, `replace-media`) : même calcul de progression, même fin de
  session ; `text` et `slot` ne diffèrent que par le préfixe d’identifiant.
  `resolveLatestReplaceOccurrence` est aussi triplé avec des variantes.
- Copies à l’identique : `resolveMotionStoryIds` (`capture-intents.ts`,
  `motion-occurrences.ts`), `transformedBounds` (`html-pose.ts`,
  `motion-pose.ts`), le filtre scalaire `resolveTransformProperty`
  (`pipeline/resolve.ts`, `html-transform-service.ts`), qui porte en plus le
  même nom que la fonction d’ACE qu’il enveloppe.
- Variantes d’une même règle : `addAncestorClosure` ×3 (dont une qui s’arrête
  aux stories), `isAfterStoryReset` ×2 (deux formes d’événement),
  `parseCssMatrix` ×2 (voir C3), `isParentNode` ×4, `isPlainRecord` et
  `isRecord` répétés alors que `shared/is-plain-record.ts` existe.
- Exports morts (aucune référence, même locale) : `RuntimePlayerEventInput`
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

## Documentation

- La note de découverte exigée par `AGENTS.md`
  (`plan/notes/2026-08-26-decouverte-etat-codplay-v2.md`) n’existe pas : lien
  mort dans les règles de travail.
- `list-dnd-v2-spec.md` et `third-party-rive-spec.md` portent un statut ;
  `third-party-rive-spec.md` décrit aussi un parcours Safari daté : contenu de
  plan dans une spec.
- Une quinzaine de plans sont « En cours » sans date de dernière vérification,
  et `evolutions/evolution-backlog.md` est « A relire ».
