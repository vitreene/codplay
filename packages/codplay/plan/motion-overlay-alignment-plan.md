# Plan — un alignement de couche overlay par racine et par frame

## Statut

> Status: A relire — aucune ligne de code ne doit être écrite avant
> l’acceptation de ce plan et l’autorisation explicite de modifier le cœur
> `packages/codplay`.
> CodPlay version: V2 foundation

Origine : point MV3 du [diagnostic CodPlay](./2026-11-25-diagnostic-codplay.md#système-move--revue-détaillée).
Spécification propriétaire : [frontières motion](../specs/motion-frame-v2-spec.md)
(section « Capture affine des items HTML »).
Parcours de validation : [plan d’intégration runner](./runner-flip-integration-study.md#parcours-de-validation).

## But

Pendant Play, ne plus réaligner la couche overlay d’une racine locale une fois
par item réparenté actif, mais une seule fois par racine et par frame. Les
poses présentées ne changent pas.

Mesure de départ (`flip-stress`, Play à partir de 2 000 ms, 4 reparents actifs
dans une même racine) : à chaque frame, 1 `commit` du host, **4**
`alignOverlayLayer`, **8** `getComputedStyle`. Chaque alignement écrit
`transform: none` sur la couche puis lit des poses : chaque lecture après la
première force donc un recalcul de style et de layout. Attendu : 1 alignement et
2 `getComputedStyle` par frame et par racine, quel que soit le nombre de
reparents.

## Circuit existant et propriétaire

[`overlay-presenter.ts`](../src/runtime/runner-html/motion-presentation-host/overlay-presenter.ts),
`OverlayMotionPresenter`, appelé par `HtmlMotionPresentationHost.commit` à
chaque frame présentée :

- `prepareFrame` parcourt les items actifs dans l’ordre `orderOverlayStack`,
  résout la racine de chacun (`resolveRootState`) et appelle `ensureOverlay`
  par item ;
- `ensureOverlay` appelle `getOverlayLayer(rootState)` avant toute autre chose ;
- `getOverlayLayer` crée la couche au premier usage, puis appelle **toujours**
  `alignOverlayLayer` ;
- `reconcileOverlayOrder` rappelle `getOverlayLayer`, donc un alignement de
  plus, quand l’ordre de la pile change.

L’alignement ne dépend que de la racine et de la couche. Dans `prepareFrame`,
rien ne déplace la racine entre deux alignements : `ensureOverlay` ajoute des
fantômes dans une couche `position: fixed` (hors flux), et cache les sources
par `visibility: hidden` (`HIDDEN_PROPERTIES` de `motion-style-layer.ts`), qui
ne change pas le layout. Un seul alignement en tête de frame donne donc la même
matrice que les k alignements actuels.

## Décisions prises

- L’alignement reste fait **à chaque frame**. La racine peut bouger pendant un
  segment : scroll d’un ancêtre, racine elle-même animée ou déplacée par un
  move. La spec ne décrit pas quand réaligner, et l’alignement n’a pas de
  déclencheur fiable hors de la frame.
- Aucune nouvelle API, aucun cache entre frames.

## Décision ouverte (hors de ce plan)

- **Aligner seulement au resize, au scroll ou au début d’un segment.** Cela
  supprimerait le dernier layout forcé par frame, mais suppose une règle « une
  racine locale ne bouge pas pendant un segment reparent » que la spec ne porte
  pas. À décider par l’utilisateur, avec un cas mesuré, avant tout plan.

## Actions

### 0. Préalables

1. Lire la [spec motion](../specs/motion-frame-v2-spec.md) et ce plan.
2. Depuis `packages/codplay` : `npx vitest run` et `npm run typecheck` ; noter
   l’état de base. Au 25 novembre : 974 tests verts, 1 échec attendu, 2 échecs
   dans `tests/facade/sighty-layout.spec.ts` (point C2 du diagnostic). Tout autre
   échec bloque le chantier.

### 1. Test d’abord (il doit échouer avant l’étape 2)

Dans [`motion-presentation-host.spec.ts`](../tests/runtime/runner-html/motion-presentation-host.spec.ts),
réutiliser les helpers du fichier (`createFrame`, `createItem`, `createPose`,
`findTestOverlayLayer`) et la construction du cas existant « keeps simultaneous
reparent overlays in their own local roots » (racines passées par
`resolveMotionRoot`, items avec `motionRootKey` et `motionRootPose`). Ajouter :

1. **Coût indépendant du nombre de reparents.** Une fonction locale au test
   mesure une racine portant n items actifs : premier `commit` (création des
   fantômes, qui lit aussi le style des sources : non compté), puis
   `vi.spyOn(window, 'getComputedStyle')` et second `commit` des mêmes items
   avec une pose différente ; elle rend le nombre d’appels. Attendu :
   `mesure(3) === mesure(1)`. Aujourd’hui `mesure(3) === 3 × mesure(1)`
   (sur `flip-stress`, 2 lectures par alignement).
2. **Deux racines.** Deux racines avec deux items chacune : au second commit,
   le nombre d’appels vaut `2 × mesure(1)`, et la `style.transform` de chaque
   couche est identique à celle du premier commit.

Le cas existant « maps reparent poses from an offset static root into viewport
coordinates » prouve que la matrice d’alignement reste juste ; il doit passer
sans modification.

### 2. Implémentation (`overlay-presenter.ts` seulement)

1. `prepareFrame` :
   - premier parcours de `orderedActiveItemIds` : résoudre `rootState` et
     regrouper les items par `rootToken`, en gardant l’ordre (filtre
     `isMeasurableHtmlElement` inchangé) ;
   - pour chaque racine qui a des items : `const layer = this.getOverlayLayer(rootState)`
     (création et alignement, une fois), puis `ensureOverlay(itemId,
     resolveRevision?.(itemId), rootState, layer)` pour chacun de ses items,
     dans l’ordre ;
   - la boucle sur `this.motionRoots` (retrait des couches sans item, puis
     `reconcileOverlayOrder`) est inchangée.
2. `ensureOverlay` reçoit `overlayLayer` en paramètre et n’appelle plus
   `getOverlayLayer`.
3. `reconcileOverlayOrder` utilise `rootState.overlayLayer`, déjà créée et
   alignée dans la frame, au lieu de `getOverlayLayer`.
4. `getOverlayLayer` et `alignOverlayLayer` sont inchangés. Mettre à jour les
   commentaires de rôle : l’alignement est fait une fois par racine dans
   `prepareFrame`.

Seul change l’ordre de création des ressources entre racines différentes : il
ne compte pas, car `resources` n’est parcouru que pour tout cacher ou tout
libérer. L’ordre des fantômes dans une couche est fixé par
`reconcileOverlayOrder`, comme aujourd’hui.

### 3. Validation

Depuis `packages/codplay` :

- `npx vitest run tests/runtime/runner-html/motion-presentation-host.spec.ts` ;
- régressions : `tests/runtime/runner-html/motion-system.spec.ts`,
  `player-runner.spec.ts`, `list-dnd-preview.spec.ts`,
  `tests/facade/facade.spec.ts` (overlay après Seek et reset),
  `flip-stress-motion.spec.ts`, `story-six-motion.spec.ts`,
  `story-five-motion.spec.ts` ;
- suite complète et `npm run typecheck` : même état qu’à l’étape 0 ;
  `npm run build` depuis la racine du dépôt ;
- depuis `packages/editor` : `npx vitest run tests/builder-v2/motion-path.spec.ts`.

Mesure : refaire le comptage de la section « But » par un test jetable
(supprimé ensuite) et reporter les chiffres dans la réponse finale.

Navigateur (Safari Technology Preview, onglet existant ; le serveur est lancé
par l’utilisateur) : démos `flip-stress` et `position`, Play complet avec les
échanges reparent, puis scroll de la page et resize pendant un échange. Attendu :
les fantômes suivent leur trajectoire sans saut ni décalage, aucun fantôme
résiduel à la fin, aucune erreur en console. Puis revue visuelle manuelle par
l’utilisateur avant acceptation.

### 4. Documentation

- [Spec motion](../specs/motion-frame-v2-spec.md), section « Capture affine » :
  une phrase sur l’alignement de la couche overlay, une fois par racine locale
  et par frame présentée ; preuve : le nouveau test.
- [Diagnostic](./2026-11-25-diagnostic-codplay.md) : marquer MV3 traité, avec
  la décision ouverte ci-dessus.
- Retirer ce plan une fois la spec à jour, et retirer son lien de
  [`codplay-v2-plan.md`](./codplay-v2-plan.md) ; reporter la décision ouverte
  dans le [plan motion](./motion-live-discovery-invalidation-plan.md) si elle
  n’est pas tranchée.

## Critères d’acceptation

- Les deux nouveaux cas passent ; le premier échouait avant (coût triplé pour
  trois reparents).
- Les tests existants du host passent sans modification.
- La suite, le typecheck et le build sont dans l’état de l’étape 0.
- Sur `flip-stress`, 1 alignement par frame au lieu de 4.
- Aucune différence visible dans Safari, scroll et resize compris ; revue
  manuelle de l’utilisateur acceptée.
