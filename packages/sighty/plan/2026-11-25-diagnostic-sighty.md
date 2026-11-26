# Diagnostic Sighty — anomalies et optimisations

**Statut : A relire.** Revue de code du 25 novembre 2026, sur le modèle de la
revue étendue d’Editor. Aucun changement de code n’a été fait. Chaque point
reste à décider avant toute correction ; un point accepté rejoint le plan
propriétaire ou un plan dédié.

Référence lue d’abord : [spec auteur et runtime](../specs/authoring-library-spec.md).

Lu en entier : `src/` (35 fichiers, 5 444 lignes) — `sighty.ts`, `scenario.ts`,
`authoring-validation.ts`, `view-graph.ts`, `scenario-package-loader.ts`,
`types.ts`, `navigation/` et `runtime/`. Lu en partie :
`tools/scenario-export/cli.mjs` (sérialisation compacte, sélection des guards,
résolution de l’export). Non relus : `tools/library-build/cli.mjs`, les tests.

État de base : 64 tests verts (7 fichiers), typecheck et build propres.

## Défauts

- **S1 — Trois ordres de priorité pour l’héritage par portée** (confirmé en
  isolation sur les fonctions pures). Pour une même sélection :
  - `accessBy`, `exitBy`, `onDenied` et `showMode` (`getConditionScopes`) prennent
    la vue, puis **tous** les graphes ancêtres (du plus proche à la racine), puis
    les vues parentes ;
  - `data` (`resolveViewData`) trie par profondeur de chemin ;
  - les actions (`resolveActionCandidates`) trient aussi par profondeur, mais
    leur handler par défaut `action` hérité suit l’ordre du premier circuit.

  Reproduction : graphe racine `{ showMode: 'maintain', data: { level: 'root' } }`
  et vue `layout` `{ showMode: 'reset', data: { level: 'layout' } }` ; pour la vue
  `layout/main/a`, `showMode` vaut `maintain` (graphe racine) et `data.level`
  vaut `layout` (vue parente). Un `accessBy` du graphe racine masque donc celui
  d’une vue parente plus proche. La spec (§3.4, §3.5) dit « la déclaration la
  plus spécifique » mais énumère « vue, graphe contenant, puis vues parentes ».
  _Décision à prendre_ : une seule règle (profondeur, ou ordre déclaré) et un
  seul parcours des portées partagé par les quatre lectures.
- **S2 — Une route vers une vue masquée passe la validation** (confirmé en
  isolation). `validate()` et les mutations parcourent `view-graph.ts`, qui
  garde les vues `hidden` ; l’index de navigation (`getDirectEntries`) les
  retire. `go: { path }` vers une vue masquée donne 0 diagnostic, puis
  `dispatch` résout `undefined` et renvoie `false` sans avertissement. Même
  écart pour `label` (une vue masquée compte dans l’unicité du label à la
  validation, pas à l’exécution). `hidden` n’apparaît pas dans la spec §3.1.
- **S3 — Deux circuits de validation des références.** `scenario.validate()`
  (`authoring-validation.ts`) vérifie seulement la forme des clés
  `action:`/`guard:` ; leur existence dans `scenario.actions`/`guards` n’est
  vérifiée qu’au runtime (`runtime/scenario-validation.ts`), par une exception
  levée à la première absence, à `initialize()` et à chaque mutation.
  `validate()` peut donc renvoyer `[]` pour un scénario que `initialize()`
  refuse. `onDenied` n’est validé par aucun des deux.
- **S4 — Événements perdus pendant une transition** (à confirmer par un test).
  `isCurrentBinding` refuse tout événement tant que `state.transitioning` vaut
  `true`, y compris ceux de la scène layout et des sélections conservées.
  `receivePublicEvent` sort alors avant la publication à l’hôte. Or
  `transitioning` reste vrai pendant la pause des sortantes et
  `ensureScenesForComposition`, qui peut résoudre une source lazy et précharger
  ses ressources. Un clic de télécommande dans cet intervalle disparaît sans
  trace. La spec (§4.3) n’abandonne que les événements d’une scène **sortie**.
- **S5 — Intention de transition classée à l’entrée de la file**
  (à qualifier). `enqueue` décide `isTransitionRequest` contre la composition
  courante, puis `dispatchNow` résout de nouveau les candidats à l’exécution.
  Une demande classée « discrète » derrière une transition peut devenir une
  transition sans verrou ; à l’inverse, le verrou est tenu pendant l’attente
  dans la file. Deux mécanismes portent l’idée de « transition en cours » :
  `RuntimeNavigationStateMachine.phase` et `state.transitioning`
  (`isChanging()` n’a aucun appelant).
- **S6 — `state` des conditions et actions aplati** (à décider).
  `readState` fusionne les états de tous les persos d’un snapshot par
  `Object.assign` : deux persos qui portent la même clé se masquent, selon
  l’ordre du snapshot. Le contrat (§3.4 « l’état lisible de l’occurrence ») ne
  dit pas comment une condition désigne un perso.
- **S7 — Collision de chemins entre slot et vues enfants** (à qualifier). Les
  vues d’un graphe `views` prennent le chemin `parent/clé` et celles d’un slot
  `parent/slot/clé`. Une vue enfant dont la clé égale un nom de slot de la même
  vue partage le chemin du graphe de slot : `index.graphs` et
  `locateMutationEntry` (qui essaie les slots en premier) résolvent alors une
  seule des deux. Aucune validation ne l’interdit.
- **S8 — Destruction pendant une opération en vol** (à qualifier). `destroy()`
  détruit l’owner sans attendre la file `RuntimeOperationCoordinator`. Une
  transition en cours (montage, preload) continue contre des instances
  détruites. `restoreComposition` relance la lecture par `void telco.play()`,
  dont un rejet n’est pas observé.
- **S9 — `createSightyRuntime` exporté publiquement.** `index.ts` l’exporte
  alors que la spec (§2) fait de `Sighty` l’unique point d’entrée. Aucun
  appelant hors du paquet (vérifié dans `packages/`). Les types
  `SightyRuntimeApi`… sont aussi exportés deux fois (`./runtime` et
  `./runtime/types`).
- **S10 — Ambiguïtés d’observation.** `getMountedSceneKey(slotName)` et
  `onSlotChange(slotName)` désignent un slot par son nom seul : deux slots de
  même nom dans deux branches (cas admis par la spec §5) se confondent.
  `scenario.getView(sceneKey)` et `getSlotNames(sceneKey)` renvoient la
  première vue de la scène.
- **S11 — Écarts entre types et spec.** `SightyViewScope.action` (handler par
  défaut hérité), `hidden` et `scenario.resolveScene` existent dans le code
  mais pas dans la spec (§3.1, §4.1). L’ordre des sections §3.4/§3.5 est
  inversé.

## Duplications et code mort

- Parcours du graphe : `view-graph.ts` (`getGraphEntries`,
  `findGraphViewByPath`, utilisé par la validation et les mutations) et
  `navigation/graph-index.ts` (`createViewIndex`) dérivent chacun les chemins ;
  seul le second filtre `hidden` (cause de S2). `findGraphViewByPath`
  reconstruit toute la liste à chaque appel, une fois par route validée.
- Capture de lecture `{ timelineMs, rate, wasPlaying }` écrite trois fois
  (`captureEntryStates`, `captureExitedStates`, `capturePlaybackStates`).
- Clé de l’occurrence layout `layoutEntry?.path ?? 'layout'` répétée à cinq
  endroits (`binding-manager` ×3, `presentation-manager`, `scene-manager`),
  alors que `layoutOccurrenceKey()` existe.
- Garde « détruit / non initialisé » répétée dans `dispatch`, `updateContext`,
  `reset` et `mutate`, à côté de `requireInitialized()`.
- Sélection de l’export de scénario écrite deux fois : `resolveScenarioExport`
  (CLI) et `resolveScenarioDefinition` (loader). Collecte des guards du graphe
  écrite deux fois : `collectScenarioGuardReferences` (CLI) et
  `validateScenarioGuards` (runtime).
- Code mort : `RuntimeNavigationStateMachine.isChanging()`, la garde
  `entry.view.hidden` de `resolvePreservedTarget` (l’index exclut déjà les vues
  masquées), `if (keys.length === 0)` dans `applyReset` (la validation l’interdit).

## Optimisations

- `ensureScenesForComposition` rappelle `ensureScene` (et donc
  `engine.prepareScene` pour une scène à bibliothèques) à chaque transition,
  pour la layout et chaque sélection déjà construite. La déduplication relève
  de CodPlay, mais l’appel pourrait être limité aux scènes entrantes.
- `showMode: 'maintain'` rejoue `telco.seek(previous.timelineMs)` sur une
  occurrence qui n’a pas bougé depuis sa pause ; un seek est une projection
  forcée que la spec (§6.3) réserve à une intention explicite.

## Documentation

- La spec porte un statut (« En cours »), des comptes de tests périmés (47, puis
  51 ; 64 aujourd’hui), des dates de parcours Safari et une section §8
  « Validation de la tranche actuelle » : contenu de plan, contraire à la règle
  des specs.
- `plan/2026-09-15-sighty-navigation-reconstruction-reprise-report.md` est un
  rapport de reprise conservé à côté de son plan « En cours » ; plusieurs plans
  de démo sont « Différée » et `2026-11-11-widgets-foreign-plan.md` est
  « A relire » : à trier (garder, fermer ou reporter dans la spec).
