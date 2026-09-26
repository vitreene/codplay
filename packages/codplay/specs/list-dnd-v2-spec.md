# CodPlay V2 — preview DnD HTML sur une liste

## Périmètre certifié

Cette spécification décrit la preview HTML de réordonnancement et la première
intégration vérifiée avec la capture persistante et la capacité `list`. Le
contrat générique de capture est dans la
[spécification capture](./capture-v2-spec.md), le placement auteur `move` dans
sa [spécification](./move-v2-spec.md), et les règles d'ordre dans la
[spécification de capacité `list`](./list-capability-v2-spec.md). L'acceptation
du seek navigateur reste au
[plan DnD/capture S6](../plan/drag-capture-list-s6-validation-plan.md).

## Preview HTML

[`HtmlListDndPreview`](../src/runtime/runner-html/list-dnd-preview.ts) reçoit
l'identité du perso saisi, son origine logique et les accès aux listes. La
preview déplace temporairement le node saisi hors de la liste et représente sa
place par un ghost. Elle ne change pas l'appartenance logique du perso ; le
commit final passe par `move` et la capacité `list`.

Les tests vérifient que :

- le point de `pointerup` est utilisé même sans dernier `pointermove` ; hors de
  toute liste, le perso conserve son emplacement d'origine ;
- un léger déplacement conserve le slot source, puis le ghost suit le pointeur
  lorsqu'un slot est réellement franchi ; les voisins reçoivent une transition
  HTML pendant le changement de slot ;
- la destruction de la preview rétablit l'ordre des nodes auteur ;
- deux captures du même perso restent isolées si la fermeture de la première
  arrive après l'ouverture de la seconde.

## Intégration capture et `list`

La fixture S6 compile une déclaration de capture ordinaire. À la fermeture,
`endCapture` produit un événement `persist-only` de placement ancré avant
`endEmit`. `endEmit` reste le fait normal qui traverse `listen` et met à jour
l'état des listes et les compteurs. Le placement utilise un `move` compilé et
la capacité `list`, sans journal ni moteur de DnD parallèles.

L'événement de départ de la fixture déclare `visibility: 'scene'`, qui conserve
son routage global dans le vocabulaire V2. Le test HTML runner vérifie cet
événement sur la track globale ainsi que la résolution finale du drop, le
déplacement de l'item vers la liste cible, la mise à jour logique de son
appartenance et sa reconstruction par Seek.

## Preuves

- [`list-dnd-preview.spec.ts`](../tests/runtime/runner-html/list-dnd-preview.spec.ts)
  vérifie la position finale pointerup, l'hystérésis du slot source, la
  transition des voisins, la restauration et l'isolation des captures.
- [`drag-capture-scene.spec.ts`](../tests/scene/compiled/drag-capture-scene.spec.ts)
  vérifie la sortie persistante antérieure à `endEmit`, l'état de liste et
  l'occurrence `move` résultante.
- [`player-runner.spec.ts`](../tests/runtime/runner-html/player-runner.spec.ts)
  vérifie l'intégration du runner HTML, le commit list et le Seek de la fixture
  S6 avec le chemin runtime réel.

Validation ciblée exécutée le 2026-09-26 depuis la racine du dépôt :

```text
node node_modules/vitest/vitest.mjs run --config packages/codplay/vite.config.ts \
  packages/codplay/tests/runtime/runner-html/list-dnd-preview.spec.ts \
  packages/codplay/tests/scene/compiled/drag-capture-scene.spec.ts \
  packages/codplay/tests/runtime/runner-html/player-runner.spec.ts
3 fichiers, 24 tests réussis
```

La preview HTML a aussi été exercée dans Safari MCP le 2026-08-22 sur la
fixture visible « CodPlay V2 — Drag & Capture » : le ghost reste au slot source
sur un déplacement de `2 px`, suit le pointeur après franchissement du slot,
apparaît à l'index `0` dans la liste cible lors d'un transfert, puis est retiré
après deux transferts successifs. L'ordre final des éléments reste cohérent et
aucun diagnostic `warn` ou `error` n'a été observé. Cette vérification concerne
la preview et le placement visuel ; elle ne valide pas le seek navigateur S6.

## Limites

Le seek navigateur S6 n'est pas encore accepté ; sa commande telco a été
rejetée pendant le parcours de la démo. Le chemin runner et le routage de départ
ont été rejoués après la migration ; seule l'acceptance navigateur reste au
[plan DnD/capture S6](../plan/drag-capture-list-s6-validation-plan.md).
