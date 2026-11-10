# CodPlay V2 — preview DnD HTML sur une liste

> Version de référence : CodPlay V2 — 2026-11-10.

## Périmètre certifié

Cette spécification décrit la preview HTML de réordonnancement, le commit
logique via capture persistante et la capacité `list`. Le contrat générique de
capture est dans la
[spécification capture](./capture-v2-spec.md), le placement auteur `move` dans
sa [spécification](./move-v2-spec.md), et les règles d'ordre dans la
[spécification de capacité `list`](./list-capability-v2-spec.md).

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

Le parcours intégré de test compile une déclaration de capture ordinaire.
À la fermeture,
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
  de capture avec une destination de drop injectée et un DOM simulé.

## Limites

La présente spécification ne certifie pas le parcours navigateur complet reliant
le pointeur, la preview, la fermeture de capture et `instance.telco.seek`.
