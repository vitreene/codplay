# CodPlay V2 — preview DnD HTML sur une liste

## Périmètre certifié

Cette spécification décrit la preview HTML de réordonnancement, le commit
logique via capture persistante et la capacité `list`. Le contrat générique de
capture est dans la
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

## Capture persistante et commit `list`

La fixture S6 compile une déclaration de capture ordinaire. À la fermeture,
`endCapture` produit un événement `persist-only` de placement ancré avant
`endEmit`. `endEmit` reste le fait normal qui traverse `listen` et met à jour
l'état des listes et les compteurs. Le placement utilise un `move` compilé et
la capacité `list`, sans journal ni moteur de DnD parallèles. La compilation
et le commit logique sont vérifiés par les tests cités ci-dessous.

L'événement de départ de la fixture déclare `visibility: 'scene'`, qui conserve
son routage global dans le vocabulaire V2. Le test HTML runner vérifie cet
événement sur la track globale, le déplacement vers la destination fournie par
son callback de fin de capture, la mise à jour logique de l'appartenance et la
reconstruction par `runner.seek`.

Cette preuve runner utilise un DOM simulé et injecte directement la destination
`list-b`. Elle ne vérifie pas la résolution de cible par la géométrie de la
preview dans le parcours capture, ni l'appel à `instance.telco.seek` dans un
navigateur. `HtmlListDndPreview` est vérifié séparément ; son raccordement à la
fermeture de capture n'est pas couvert par ces tests.

## Preuves

- [`list-dnd-preview.spec.ts`](../tests/runtime/runner-html/list-dnd-preview.spec.ts)
  vérifie la position finale pointerup, l'hystérésis du slot source, la
  transition des voisins, la restauration et l'isolation des captures.
- [`drag-capture-scene.spec.ts`](../tests/scene/compiled/drag-capture-scene.spec.ts)
  vérifie la sortie persistante antérieure à `endEmit`, l'état de liste et
  l'occurrence `move` résultante.
- [`player-runner.spec.ts`](../tests/runtime/runner-html/player-runner.spec.ts)
  vérifie le routage de départ, le commit `list` et `runner.seek` de la fixture
  S6 avec une destination de drop injectée et un DOM simulé.

Validation ciblée exécutée le 2026-09-26 depuis la racine du dépôt :

```text
node node_modules/vitest/vitest.mjs run --config packages/codplay/vite.config.ts \
  packages/codplay/tests/runtime/runner-html/list-dnd-preview.spec.ts \
  packages/codplay/tests/scene/compiled/drag-capture-scene.spec.ts \
  packages/codplay/tests/runtime/runner-html/player-runner.spec.ts
3 fichiers, 24 tests réussis
```

La preview HTML a aussi été exercée dans Safari MCP le 2026-08-22 sur une
fixture alors intitulée « CodPlay V2 — Drag & Capture » : le ghost reste au
slot source sur un déplacement de `2 px`, suit le pointeur après franchissement
du slot, apparaît à l'index `0` dans la liste cible lors d'un transfert, puis
est retiré après deux transferts successifs. L'ordre final des éléments reste
cohérent et aucun diagnostic `warn` ou `error` n'a été observé. Cette
vérification concerne la preview et le placement visuel ; elle ne prouve pas
l'intégration capture S6 ni le seek navigateur.

## Limites

La présente spécification ne certifie pas le parcours navigateur complet reliant
le pointeur, la preview, la fermeture de capture et `instance.telco.seek`. Les
preuves à établir pour ce parcours sont suivies dans le
[plan DnD/capture S6](../plan/drag-capture-list-s6-validation-plan.md).
