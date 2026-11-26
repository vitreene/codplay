# Plan — mémorisation des scènes reconstruites

## Statut

> Status: A relire — aucune ligne de code ne doit être écrite avant
> l’acceptation de ce plan et l’autorisation explicite de modifier le cœur
> `packages/codplay`.
> CodPlay version: V2 foundation

Origine : point MV1 du [diagnostic CodPlay](./2026-11-25-diagnostic-codplay.md#système-move--revue-détaillée).
Spécification propriétaire : [reconstruction logique](../specs/runtime-reconstruction-v2-spec.md).
Parcours de validation motion : [plan d’intégration runner](./runner-flip-integration-study.md#parcours-de-validation).

## But

Ne plus recalculer une scène déjà reconstruite tant que rien de ce dont elle
dépend n’a changé. Aucun comportement observable ne change : même scène, mêmes
captures, mêmes frames ; seul le nombre de reconstructions baisse.

Mesure de départ (fixture `flip-stress`, 20 persos, 10 s, comptage sur
`RuntimePlayerSceneState.reconstructBaseScene`) :

| Opération | Reconstructions | dont distinctes |
|---|---|---|
| création de l’instance | 20 | 20 |
| Seek 2 500 ms | 36 | 20 |
| Seek 5 000 ms | 38 | 23 |
| Seek 7 500 ms | 37 | 25 |
| Seek 5 000 ms de nouveau | 13 | 13, toutes déjà calculées |
| Seek 0 | 2 | 2 |
| **cumul de la session** | **146** | **69** |

Résultat attendu : 69 calculs au lieu de 146 sur cette session (−53 %), et
aucun calcul au second Seek 5 000 ms.

## Circuit existant et propriétaire

- [`scene-state.ts`](../src/runtime/player/runtime-player/scene-state.ts),
  `RuntimePlayerSceneState`, est le seul point d’entrée des reconstructions du
  player : `reconstructBase`, `reconstruct`, `reconstructBeforeBoundary`, et
  `rebuildStructuralTimeline` passent tous par la méthode privée
  `reconstructBaseScene`. Le cache se place **dans `reconstructBaseScene`**,
  sans nouveau module, sans nouvelle API publique.
- [`scene-reconstruction.ts`](../src/runtime/player/scene/scene-reconstruction.ts),
  `reconstructPlayerScene`, fait le calcul (`materializeScene` ou
  `materializeSceneBeforeBoundary`, puis `resolveScene` et `solveScene`). Son
  seul appelant est `scene-state.ts`.
- `StructuralTimeline` a déjà un cache par révision du journal
  (`structuralTimelineRevision`) ; le nouveau cache suit la même règle.

## Ce dont dépend une reconstruction (vérifié dans le code)

| Entrée | Variable ? | Traitement |
|---|---|---|
| `compiledScene`, `functions`, `context.mountTargets` | non (fixés à la création du player) | hors clé |
| journal (`trackJournal`) : événements, activité des tracks, périodes d’isolation, resets | oui ; **chaque** mutation incrémente `getRevision()` (`reset`, `appendLiveEvent`, `appendAnchoredEventimes`/`appendStrapOutput` via `appendLiveEvent`, `applyControlEvent`) | le cache est vidé quand la révision change |
| `timeMs`, `includeBoundary`, `includePersistOnly`, `includeMoveOccurrences` | oui | dans la clé |
| `childrenByTarget` | dépend de la chronologie structurelle, elle-même déterminée par la révision et `includePersistOnly` | dans la clé par le **mode** d’appel : `base` (aucun), `at` (`resolveAt`), `before` (`resolveBefore`) |
| cibles de montage des modules (`instance.getMountTargets()`, module markup) | **oui, hors journal** : elles changent quand des composants sont matérialisés ou retirés du DOM (`registerMaterializedComponent`). Mesuré : deux jeux de cibles différents pendant la création de l’instance | dans la clé, par une signature des cibles |
| `snapshotContribution` (aperçu `setSnapshot`) | oui, hors journal | **pas de cache** quand elle est définie |

`journal.reconcileStoryIsolationAt` ne change que `currentIsolation`, que
`materializeScene` ne lit pas (il lit les périodes, via
`isStoryEventEligibleAt`) : il reste hors clé.

## Décisions prises

- Cache borné, du plus ancien au plus récent (LRU sur l’ordre d’insertion
  d’une `Map` : sur un succès, supprimer puis réinsérer l’entrée). Limite
  `SCENE_RECONSTRUCTION_CACHE_LIMIT = 64`, dans un nouveau fichier
  `src/runtime/config/scene-reconstruction.ts`. Les Seeks mesurés demandent
  20 à 25 scènes distinctes ; 64 couvre deux à trois Seeks sans garder des
  centaines de scènes pendant un Play à tweens (une reconstruction par frame).
- Les scènes en cache sont partagées entre appelants. C’est admis parce que
  `SolvedScene` est `Readonly` et que la relecture n’a trouvé aucune mutation
  (voir l’étape 3, qui le prouve à l’exécution). Une seule comparaison par
  identité existe : `previousMoves === currentMoves` dans
  `collectMoveOccurrences` ; elle ne devient vraie qu’entre deux scènes au même
  instant et donne alors le même résultat qu’avant (aucune occurrence nouvelle).
- Hors périmètre : garder deux chronologies structurelles (avec et sans faits
  `persist-only`). La capacité `list` n’a qu’un historique structurel
  (`resetStructuralOrder`), partagé par toute reconstruction de la chronologie ;
  deux chronologies simultanées se l’écraseraient.

## Actions

### 0. Préalables

1. Lire la [spec de reconstruction](../specs/runtime-reconstruction-v2-spec.md)
   et ce plan en entier.
2. Depuis `packages/codplay` : `npx vitest run` et `npm run typecheck`.
   Noter l’état de base. Au 25 novembre : typecheck propre, 974 tests verts,
   1 échec attendu, 2 échecs dans `tests/facade/sighty-layout.spec.ts`
   (`localStorage` absent sous Node, point C2 du diagnostic). Tout autre
   échec bloque le chantier : le signaler avant de continuer.

### 1. Tests d’abord (ils doivent échouer avant l’étape 2)

Créer `tests/runtime/player/scene-reconstruction-memo.spec.ts`
(`/** @vitest-environment jsdom */`). Le test possède sa scène ; ne rien
importer de `packages/demos`.

Fixture : dériver de `motionSceneDoc()` de
[`facade.spec.ts`](../tests/facade/facade.spec.ts) (copier la forme, pas
l’import) : un perso `layout` avec deux parts `source` et `target`, puis six
persos `tag` `item-0` à `item-5`, placés dans `source`, avec deux actions
`toTarget` / `toSource` (`move: { target, transition: { duration: 150, ease: 'linear' } }`),
et des eventimes qui se chevauchent : `toTarget` à `100 + 60 × i`, `toSource` à
`500 + 60 × i`. Ajouter un état de story modifié par un eventime à 300
(`update`) pour que l’étape d’invalidation ait une valeur à lire.

Compter les calculs avec
`vi.spyOn(sceneReconstruction, 'reconstructPlayerScene')`, où
`sceneReconstruction` est `import * as … from '../../../src/runtime/player/scene/scene-reconstruction'`.
Vérifier d’abord que l’espion voit des appels (`> 0`) : `scene-state.ts`
importe la fonction par l’index `../scene`. Si l’espion ne voit rien, espionner
`RuntimePlayerSceneState.prototype` comme dans le probe du diagnostic, mais
alors sur le calcul et non sur la recherche dans le cache.

Cas :

1. **Une seule reconstruction par demande distincte.** Créer l’instance par
   la façade (`new CodPlay(…)`, `codplay.instances.create`, ordonnanceur
   manuel comme `createManualFrameScheduler`), vider l’espion, `telco.seek(400)`.
   Construire pour chaque appel la clé `[timeMs, includeBoundary,
   includePersistOnly, includeMoveOccurrences, childrenByTarget !== undefined]`
   et attendre autant d’appels que de clés distinctes.
2. **Re-Seek sans calcul.** `seek(400)`, `seek(100)`, `seek(400)` : le dernier
   Seek n’appelle pas `reconstructPlayerScene`, et `instance.snapshot.get()`
   rend le même état qu’après le premier `seek(400)` (`toEqual`).
3. **Invalidation par le journal.** Après `seek(400)`, émettre un événement par
   `instance.events.emit(…)` qui modifie l’état lu au point 2, puis
   `seek(400)` : `reconstructPlayerScene` est rappelé, et le snapshot reflète
   l’événement émis.
4. **Invalidation par les cibles de montage.** Test direct de
   `RuntimePlayerSceneState` : scène compilée par `SceneBuilder` où un perso
   vise une cible `extra` absente au départ ; `moduleServiceInstances`
   contient une instance minimale `{ getMountTargets: () => targets }` dont le
   tableau `targets` est modifiable par le test. `reconstruct(0)` :
   `persos[key].placement.mounted === false` (une cible inconnue n’est pas une
   erreur dans `solve.ts`) ; ajouter
   `{ id: 'extra', kind: MOUNT_TARGET_KIND_OUTLET }` (`src/runtime/config/mount-target.ts`) ;
   `reconstruct(0)` : `mounted === true`. Si le compilateur refuse `extra`,
   viser une part `outlet` déclarée par un perso `layout` et faire varier sa
   présence dans `targets`. Sans signature dans la clé, ce test échoue après
   l’étape 2 : c’est sa raison d’être.
5. **Aperçu hors cache.** Même instance qu’en 1 : `instance.snapshot.set([...])`
   (patch de style sur `item-0` au temps courant), puis `instance.snapshot.clear()` ;
   l’état rendu après `clear` est celui d’avant `set`, et l’état pendant `set`
   contient le patch.

Les cas 1 et 2 échouent avant l’étape 2 ; les cas 3 à 5 passent avant et
après (non-régression).

### 2. Implémentation (`scene-state.ts` seulement, plus la constante)

1. `src/runtime/config/scene-reconstruction.ts` : exporter
   `SCENE_RECONSTRUCTION_CACHE_LIMIT = 64`, avec un commentaire de rôle.
2. `scene-reconstruction.ts` : `reconstructPlayerScene` reçoit dans son
   contexte la liste complète `mountTargets` et ne concatène plus lui-même les
   cibles des modules (retirer `moduleServiceInstances` de
   `RuntimePlayerSceneContext`). La concaténation se fait une seule fois, dans
   `scene-state.ts`, qui en a besoin pour la clé. Aucun autre appelant.
3. `RuntimePlayerSceneState` :
   - champs privés `reconstructionCache = new Map<string, SolvedScene>()` et
     `reconstructionCacheRevision = -1` ;
   - `reconstructBaseScene` reçoit un argument `mode: 'base' | 'at' | 'before'`
     (passé par `reconstructBase`/`rebuildStructuralTimeline` = `base`,
     `reconstruct` = `at`, `reconstructBeforeBoundary` = `before`) ;
   - au début : si `trackJournal.getRevision()` diffère de
     `reconstructionCacheRevision`, vider le cache et noter la révision ;
   - composer `mountTargets` (statiques + `getMountTargets?.()` de chaque
     module), puis leur signature
     `targets.map(t => [t.id, t.kind, t.storyId ?? '', t.ownerId ?? ''].join(':')).join('|')` ;
   - si `snapshotContribution` est défini : calculer et rendre sans lire ni
     écrire le cache ;
   - sinon clé `[mode, timeMs, includeBoundary, includePersistOnly,
     includeMoveOccurrences, signature].join('\u0000')` ; succès : supprimer et
     réinsérer l’entrée, la rendre ; échec : calculer, insérer, retirer la plus
     ancienne entrée (`keys().next()`) au-delà de la limite.
4. Commentaires de rôle sur chaque ajout (règle du projet). Pas de `try/catch`,
   pas d’option pour désactiver le cache.

### 3. Preuve d’immuabilité (temporaire, ne pas livrer)

Geler en profondeur, localement, chaque scène insérée dans le cache, sauf le
champ `scene` (la `CompiledScene` partagée). Lancer toute la suite CodPlay,
puis depuis `packages/editor` `npx vitest run tests/builder-v2`. Une
`TypeError` « read only » désigne un code qui modifie une scène reçue : arrêter
et rapporter le cas ; ne pas le contourner. Retirer le gel avant de livrer.

### 4. Validation

Depuis `packages/codplay` :

- `npx vitest run tests/runtime/player/scene-reconstruction-memo.spec.ts` ;
- régressions ciblées : `tests/runtime/player/pipeline.spec.ts`,
  `runtime-player.spec.ts`, `story-isolation.spec.ts`,
  `runtime-capture-player.spec.ts`, `tests/runtime/runner-html/motion-capture.spec.ts`,
  `player-runner.spec.ts`, `tests/facade/facade.spec.ts`, `snapshot.spec.ts`,
  `story-six-motion.spec.ts`, `flip-stress-motion.spec.ts` ;
- suite complète et `npm run typecheck` : même état qu’à l’étape 0 ;
- `npm run build` depuis la racine du dépôt ;
- depuis `packages/editor` : `npx vitest run tests/builder-v2/motion-path.spec.ts`.

Mesure : refaire le comptage de la section « But » par un test jetable
(supprimé ensuite) et reporter les chiffres dans la réponse finale, pas dans la
spec.

Navigateur (Safari Technology Preview, onglet existant ; le serveur est lancé
par l’utilisateur, ne jamais en lancer un) : démos `flip-stress` et `position`,
Play complet, Seek à 2 500, 5 000 et 7 500 ms puis retour à 5 000 ms, resize de
la fenêtre pendant un mouvement, reset. Attendu : aucune différence visible
avec l’état d’avant, aucune erreur ni avertissement en console, aucun overlay
résiduel. Puis revue visuelle manuelle par l’utilisateur avant acceptation.

### 5. Documentation

- [Spec de reconstruction](../specs/runtime-reconstruction-v2-spec.md) : ajouter
  une section « Mémorisation » : rôle, clé, invalidation par révision du
  journal et par signature des cibles de montage, exclusion de l’aperçu, borne,
  partage en lecture seule des scènes ; preuve : le nouveau test.
- [Diagnostic](./2026-11-25-diagnostic-codplay.md) : marquer MV1 traité avec un
  lien vers la spec.
- Retirer ce plan une fois la spec à jour, et retirer son lien de
  [`codplay-v2-plan.md`](./codplay-v2-plan.md).

## Critères d’acceptation

- Les cinq cas de l’étape 1 passent ; les cas 1 et 2 échouaient avant.
- La suite, le typecheck et le build sont dans l’état de l’étape 0.
- Le comptage sur `flip-stress` donne au plus 69 calculs sur la session
  mesurée, et 0 au second Seek 5 000 ms.
- Aucune différence visible dans Safari ; revue manuelle de l’utilisateur
  acceptée.
- La spec décrit le cache ; ce plan est retiré.
