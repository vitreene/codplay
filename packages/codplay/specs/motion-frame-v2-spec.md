# CodPlay V2 — préparation et capture des bornes motion

## Périmètre vérifié

Cette spécification décrit les comportements vérifiés de préparation et de
présentation motion HTML : le transport d’une occurrence de `move`, la
résolution d’une frame à un temps absolu et la capture des snapshots d’une
frontière. La forme auteur de move reste dans la
[spécification move](./move-v2-spec.md). Le retarget vers une target déplacée
est décrit par sa [spécification dédiée](./move-target-dependency-v2-spec.md).

## Transport d’une occurrence de `move`

La matérialisation canonique attache les actions `move` actives à la scène sous
forme d’occurrences internes. `resolveScene` et `solveScene` conservent ces
occurrences pour le runner HTML ; ils ne sont pas inscrits dans un second
journal. Le `HtmlMotionSystem` présente les frontières capturées qui lui sont
fournies : ses appels ordinaires à `present()` ne déclenchent pas une nouvelle
capture naturelle du DOM à chaque frame.

Les tests de pipeline vérifient la production de l’occurrence et son transport
à travers résolution et solve. Les tests du système motion vérifient la
présentation à partir des frontières fournies sans capture naturelle par frame.
Ils ne certifient pas l’acceptation complète des sources compilées, live et
Seek, ni la partition des groupes au reset et au resize ; ces gates restent au
[plan de préparation motion](../plan/motion-live-discovery-invalidation-plan.md).

Une présentation runner sans occurrence `move` ne capture pas de snapshot
géométrique et ne construit pas le système ni le graphe motion. Le test runner
exerce un événement qui ne change que des styles et vérifie l’absence de lecture
géométrique et d’appel au constructeur de graphe.

Sur le chemin facade HTML, un reset de story arrivé à la tête du player retire
l’overlay et le segment actif du move/reparent de cette story. Un Seek avant la
frontière rétablit les deux ; un Seek sur la frontière les retire à nouveau.
Cette preuve couvre une story et un segment actif, pas le retrait des groupes
inter-story ni l’ordre avec une préparation concurrente.

## Frame au temps absolu

Le graphe motion produit la même frame pour un même temps absolu, quel que soit
l’ordre des évaluations précédentes. Le test compare un seek direct à 820 ms à
une évaluation après des demandes à 100 ms et 700 ms ; les résultats sont
identiques.

## Snapshots d'une frontière

La capture HTML conserve des snapshots distincts pour l’état juste avant la
frontière, l’état appliqué à cette frontière, les keyframes déclarées et
l’endpoint. Dans le cas vérifié, la destination est absente au FIRST et apparaît
à l’endpoint : elle fournit le contexte du LAST sans être ajoutée aux snapshots
avant ou après-start.

Le test de frontière du runner sur la story 6 confirme ce raccord avec la scène
réelle : le mouvement de Qa garde Q comme parent au départ, utilise K et son
cadre dans le contexte de destination, et ne crée pas de retarget parasite.

## Preuves

- [motion-occurrences.ts](../src/runtime/player/runtime-player/motion-occurrences.ts)
  et [presentation.ts](../src/runtime/player/runtime-player/presentation.ts)
  portent l’occurrence issue de la matérialisation canonique ; le
  [contrôleur motion HTML](../src/runtime/runner-html/player-runner/motion-controller.ts)
  la consomme.
- [motion-graph.spec.ts](../tests/runtime/motion/motion-graph.spec.ts) compare
  deux résolutions du même temps après des historiques d’évaluation distincts.
- [pipeline.spec.ts](../tests/runtime/player/pipeline.spec.ts) vérifie le
  transport de l’occurrence de move à travers la matérialisation canonique,
  `resolveScene` et `solveScene`.
- [motion-system.spec.ts](../tests/runtime/runner-html/motion-system.spec.ts)
  vérifie que la présentation utilise les frontières fournies sans capture
  naturelle à chaque frame.
- [player-runner.spec.ts](../tests/runtime/runner-html/player-runner.spec.ts)
  vérifie qu’une présentation de style sans occurrence `move` n’effectue pas
  de capture géométrique et ne construit pas le graphe motion.
- [facade.spec.ts](../tests/facade/facade.spec.ts) vérifie au reset d’une story
  le retrait de l’overlay et du segment actif, puis leur restauration et leur
  retrait en repassant la frontière avec Seek.
- [motion-capture.spec.ts](../tests/runtime/runner-html/motion-capture.spec.ts)
  vérifie les snapshots FIRST, après-start, keyframes et LAST.
- [story-six-motion.spec.ts](../tests/facade/story-six-motion.spec.ts) vérifie
  la branche de destination tardive par le runner réel.

Le 2026-09-26, les suites ciblées ont passé cinq fichiers et 50 tests. Le même
groupe de validation comprend les tests de dépendance à la target suivis dans
la [spécification dédiée](./move-target-dependency-v2-spec.md).

## Limites

La matrice complète des transitions locales et reparent, du reset, du resize,
de la persistance, du lifecycle et de la destruction reste au
[plan motion](../plan/motion-live-discovery-invalidation-plan.md) et au
[plan runner HTML](../plan/runner-flip-integration-study.md).
