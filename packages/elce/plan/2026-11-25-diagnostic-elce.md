# Diagnostic Elcé — anomalies et optimisations

**Statut : A relire.** Revue de code du 25 novembre 2026, sur le modèle de la
revue étendue d’Editor. Aucun changement de code n’a été fait. Chaque point
reste à décider avant toute correction ; un point accepté rejoint le plan
propriétaire ou un plan dédié.

Périmètre : `src/` compte 427 fichiers de production et 81 000 lignes. Cette
revue n’a pas tout relu. Elle combine une analyse statique de tout le paquet
(exports, modules, noms de fonctions, marqueurs, interpolations HTML) et une
lecture ciblée.

- Lu en entier : `scripts/check-mod-boundaries.mjs`,
  `player/elce-player-engine.ts`, `core/document/stable-id.ts`, les clients
  d’export Sighty et de médias des deux mods, les fonctions d’échappement HTML.
- Lu en partie : la persistance SQLite des deux mods (helpers et médias),
  `learning-project-document-reader.ts`, et le
  [plan des machines explicites](./2026-11-09-elce-explicit-state-machines-plan.md).
- Non relus : le contrôleur auteur (`core/controller/`), les coordinateurs de
  session et de synchronisation, l’interface d’édition Remix, les builders de
  scène des BDC et des pages. Le plan des machines explicites couvre déjà le
  verrou de fenêtre, la file de synchronisation et la session de preview ; ce
  diagnostic ne les reprend pas.

État de base : 668 tests verts (111 fichiers), typecheck propre, frontières de
mods propres (`check:architecture` : 427 fichiers, 2 201 imports), build
propre. Le runtime Rive (2,6 Mo) est chargé par `import()` dynamique, donc hors
du chargement initial.

## Défauts

- **E1 — Identifiants interpolés sans échappement dans le HTML généré**
  (à qualifier). 223 interpolations `${…}` dans des attributs `id`, `class`,
  `data-*` ou `aria-*` des builders de scène n’échappent pas la valeur. Exemple :
  `quiz-hunt-page-scene-catalog.ts` écrit
  `id="quiz-hunt-page-${pageId}-game-eyebrow"`. Les identifiants créés par
  l’éditeur sont des UUID préfixés (`createStableId`), donc sûrs ; mais le
  lecteur de document accepte tout `id` de type texte
  (`learning-project-document-reader.ts`). Un document stocké ou importé (import
  Rise, futur import standard) dont un identifiant contient `"` ou `>` casse ou
  injecte du balisage dans la preview, l’export Sighty et le paquet SCORM.
  _Décision à prendre_ : valider la forme des identifiants à la frontière du
  document, ou échapper à chaque interpolation.
- **E2 — Terme interdit dans le balisage et le CSS.** La règle du projet interdit
  `shell`. Le graphe statistique l’emploie dans
  `elce-statistical-graph__chart-shell` et l’identifiant `${rootId}-chart-shell`
  (`statistical-graph-scene-builder.ts`, `statistical-graph-player-style.ts`,
  `authoring/statistical-graph.css`).
- **E3 — Même SQL des médias dans deux mods.** `learning` et `quiz-hunt`
  écrivent chacun la synchronisation de la table partagée `media_resources`
  (`synchronizeMediaRows`, `mediaFromRow`), avec deux jeux de helpers
  (`stringValue` / `sqliteStringValue`, `nullableTextValue` /
  `encodeNullableSqliteText`). `queryRows` existe en quatre versions (les deux
  mods, `core/server/projects/sqlite-project-edit-access.ts`,
  `core/server/media/sqlite-media-publication.ts`). Une évolution du schéma doit
  être faite deux fois et peut diverger ; ce circuit relève de `core`.
- **E4 — Deux conventions pour le codec de document.** `learning` sérialise par
  `document.toJSON()` (codec de 12 lignes), `quiz-hunt` par une fonction
  `writeQuizHuntDocument` (codec de 207 lignes). Les deux clients d’export,
  identiques par ailleurs, appellent donc deux formes différentes.

## Duplications et code mort

- Modules de réexportation que rien n’importe (anciens chemins laissés après
  l’intégration des mods) : `app/controller/document-persistence.ts`,
  `app/history/document-history.ts`, `app/projects/project-session-coordinator.ts`,
  `app/sync/project-sync-coordinator.ts`,
  `infrastructure/indexed-db/document-store.ts`,
  `infrastructure/project-api/project-api-client.ts`. Les deux fichiers
  `infrastructure/*-types.ts` restants ne font que réexporter `core` ou
  `mods/learning` : `core/authoring/layout/project-application.tsx` importe un
  type de `core` par ce détour.
- Exports morts (aucune référence, même locale) : `getAppearanceTypographyPair`
  et quatre types d’identifiants (`appearance-config.ts`),
  `resolveAppearanceContrastBackground`, `createPageRemoveCommand`,
  `LEARNING_DEFINITION`, `createElceAnchorAttributes`, `cardLayoutHasMedia`,
  `defaultCarouselDurationSeconds`, et une dizaine de types
  (`CatalogResourceTab`, `ControllerSelectionChapterEvent`,
  `ControllerSelectionPageEvent`, `BdcLocationKind`, `ScenarioEntryKind`,
  `PageLocationKind`, `ScenarioSceneCatalog`, `QuizHuntProjectSession`,
  `ElceQuestionChange`, `ConfiguredQuestionType`, `StatisticalGraphLayout`).
  127 autres exports ne servent que dans leur propre fichier.
- Utilitaires répétés : `isRecord` ×12, `errorMessage` ×7, `isStringArray` ×5,
  `readRecord` ×4, `isFile` ×4, `exportError` ×4, `requestExportZip` ×3.
- Échappement HTML écrit dix fois sous trois noms (`escapeHtml` ×4,
  `escapeHtmlText` ×3, `escapeAttribute` ×3), avec deux variantes : avec ou sans
  guillemets. Les usages relus mettent bien la variante sans guillemets dans du
  texte ; une fonction partagée par usage (texte, attribut) supprimerait le
  risque de confusion.

## Optimisations

- `page-editor-view` (548 Ko), `elce-player-engine` (458 Ko) et
  `carousel-scene-builder` (334 Ko) dépassent la limite d’avertissement de Vite.
  Ils sont déjà découpés par route ; leur composition reste à examiner avant
  tout découpage supplémentaire.

## Documentation

- 23 des 31 specs contiennent des comptes rendus de validation (« Safari MCP
  vérifie… », « Le 8 novembre… », comptes de tests) : contenu de plan, contraire
  à la règle des specs.
- Plans marqués « Fini » encore présents (`2026-10-06-plan-transposition-remix-3.md`,
  `2026-11-02-elce-mods-into-elce-plan.md`, `2026-11-09-elce-document-routing-plan.md`)
  et rapports de reprise conservés (`notes/2026-10-04-elce-reprise-report.md`,
  `plan/2026-10-08-remix-reprise-report.md`) : à transférer dans les specs puis
  à retirer. Une vingtaine de plans sont « En cours ».
- Les tests d’Elcé sont colocalisés (`*.test.ts` dans `src/`), ceux de CodPlay et
  Sighty dans `tests/*.spec.ts` : deux conventions dans le dépôt.
