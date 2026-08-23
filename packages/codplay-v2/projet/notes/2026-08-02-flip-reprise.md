# FLIP V2 — état de reprise (archive historique)

> Cette note est conservée pour contexte historique uniquement. Elle a été
> remplacée par [`plan/runner-flip-integration-study.md`](../../plan/runner-flip-integration-study.md)
> et ne décrit pas l'architecture V2 courante. Les noms de runtime, caches,
> captures et bridges mentionnés ici sont non contractuels.

## Statut

**Archive historique — remplacée.**

## Référence validée

La demo actuellement validée reprend la présentation et la timeline de :

`packages/demos/src/scenes/player-poc-scene.ts`

Elle est portée dans :

`packages/authoring/selection-frame/demos/flip`

Elle utilise `HtmlFlipRuntime` V2 et le host HTML autonome de la tranche V2. Elle
possède un Play/Pause, un seek et des logs de diagnostic.

Cette demo est un contexte validé parmi d'autres. Elle ne devient pas l'unique
oracle du FLIP et ne remplace pas les futures demos normatives. La première demo
écartée avait des bugs non encore classés entre contexte de demo et moteur FLIP ;
elle ne doit pas être reprise sans investigation dédiée.

## Socle disponible

- Capture FIRST/mutation/LAST persist-only sans handle DOM.
- `FlipCapture`, `FlipItemCapture` et captures d'ancêtres numériques.
- Pose graph racine → feuille.
- Composition d'ancêtres composités et ancêtres layout via capacité host.
- Ancres AABB conservées exactement à FIRST et LAST, y compris avec transform-origin.
- Seek exact et même résolution temporelle pour play et seek.
- Résolution froide via `FlipCaptureResolver` consommateur.
- Cache par capture et cache de poses historiques par host/epoch/capture/ancêtre/instant.
- Isolation host context et projection epoch.
- Projection locale et overlay-world.
- Restauration des styles inline capturés lors de l'arrêt d'une projection locale ou overlay.

## Manques pour la suite normative

- Intégration réelle avec le pipeline V2 `move -> solve -> project`.
- Adaptateurs host concrets pour Sighty et HTML autonome hors demo.
- Détection automatique du plus haut ancêtre en reflow.
- Caractérisation et cache par segment inter-bornes.
- Mesures repositionnées complètes pour les ancêtres layout.
- Restauration/cancellation locale portée par le runtime, et non seulement par un host de demo.
- Captures concurrentes et transitions qui se chevauchent.
- Tests avec parent et grand-parent simultanément en FLIP.
- Tests avec ancêtres composités et layout mélangés.
- Tests scroll/resize, interruption, reprise et seek-back.
- Diagnostic de la première demo refusée dans son contexte propre.

## Reprise recommandée

1. Ne pas modifier V1.
2. Conserver `player-poc-scene.ts` comme première fixture validée, sans en faire la seule fixture.
3. Ajouter une fixture normative dédiée à un item dont le parent et le grand-parent sont eux-mêmes en FLIP.
4. Vérifier FIRST, milieu, borne de fin, seek direct et reprise après interruption.
5. Brancher ensuite le résultat au consommateur V2 `move` et à ses adaptateurs host.

## Vérifications actuelles

- Typecheck `packages/codplay-v2` réussi.
- Suite V2 : 47 fichiers, 281 tests réussis au moment de la consignation.
- Build Vite de la demo Player POC réussi.

## État après la reprise du 2026-08-17

La reprise reste volontairement autonome : aucune intégration avec `move`, `solve`,
la capacité `list` ou une autre couche du projet n'a été introduite.

La tranche ajoutée couvre désormais :

- une fixture normative avec un parent et un grand-parent FLIP simultanés ;
- la résolution de cette hiérarchie aux bornes et au milieu ;
- la résolution de plusieurs ancêtres `layout` par le cache historique du host ;
- la coupe historique d'un ancêtre `layout` au-dessus d'un descendant composité ;
- la détection des cycles et des chaînes d'ancêtres incohérentes avant capture ;
- la fin et la cancellation de la projection locale dans le runtime, et non plus
  seulement dans la démo host ;
- le retarget d'une projection locale par une capture plus récente.
- la résolution de captures chevauchantes pour des items distincts dans un seul
  commit de projection.

La suite V2 vérifiée après cette tranche compte **48 fichiers et 294 tests réussis**.

Les erreurs rencontrées à la frontière `HtmlFlipRuntime` sont maintenant retournées
dans le système V2 `DiagnosticCollector`, avec un `DiagnosticOutput` fourni par
l'application. Les algorithmes purs conservent leurs exceptions d'invariant ; le
runtime ne les laisse plus remonter directement à l'application.

Un correctif supplémentaire sépare désormais les deux espaces de résolution : un
item `overlay-world` qui change de conteneur est interpolé directement entre ses
ancres FIRST/LAST en espace monde ; il ne reçoit plus la matrice du conteneur cible
comme si sa pose FIRST lui appartenait déjà. Ce cas est couvert par une fixture
cross-container dédiée.

Le host HTML V2 convertit aussi désormais les deltas de pose monde dans le repère
local du parent avant d'écrire un `translate(...)` CSS. Cette conversion est
nécessaire lorsque le parent est tourné ou mis à l'échelle ; elle est couverte par
les tests de mathématiques du host.

Restent dans cette tranche autonome : la détection automatique du plus haut ancêtre
en reflow, la caractérisation et le cache par segment inter-bornes et les mesures
repositionnées complètes. Ces points demandent encore un contrat host précis ; ils
ne sont pas remplacés par une approximation dans le runtime actuel.

## État après la correction overlay et le bridge `move` — 2026-08-17

La projection `overlay-world` de `HtmlDomProjection` est maintenant scoped au
`root` du host. Le ghost est placé dans un layer enfant absolu et sa pose monde
est convertie dans le repère local de ce root. La translation CSS finale est
portée par la matrice localisée elle-même ; elle ne soustrait pas une seconde
fois le minimum vertical de l'AABB transformée.

Cette correction est couverte par `html-dom-projection.spec.ts`, qui vérifie la
translation d'un item tourné dont le sommet visuel est différent de son origine
locale.

Le bridge `MoveFlipLayoutProjection` est également présent entre
`MoveStateDelta`, `LayoutProjection` et `HtmlFlipRuntime`. Il capture avant la
projection structurelle, délègue la mutation, puis avance la capture avec le
temps du `RuntimePlayer`. Le host conserve la responsabilité de construire les
entries, les ancêtres et la forme FLIP de la transition.

Vérifications au 2026-08-17 : typecheck V2 réussi, **51 fichiers et 303 tests
réussis**, build Vite de la démo FLIP réussi.

La syntaxe auteur de `transition.path` est une chaîne SVG `d` limitée aux
commandes `M`, `L` et `A`. Le compilateur normalise le départ en `[0, 0]`, l'arrivée
en `[1, 0]`, quantifie la géométrie au centième et produit des segments internes
d'arcs et de droites avec leurs longueurs cumulées. Le runtime FLIP ne parse donc
aucun SVG. Restent à fixer les valeurs par défaut de transition et les diagnostics
détaillés des transitions invalides ou incomplètes.

## Fixtures de démonstration — 2026-08-18

La démo `packages/authoring/selection-frame/demos/flip` est conservée comme
référence Player POC validée. La fixture `demos/flip-stress` est également
conservée avec son scénario A/B/C/D, ses transferts Q/K et ses échanges alternés,
mais son utilisation est suspendue : elle ne doit pas servir de validation tant
qu'elle n'est pas une simple déclaration de scène consommée par un runner V2/HTML
partagé. L'architecture de navigation et ce runner restent à construire.

La fixture stress-test impose désormais des dimensions fixes aux containers A/B/C/D
et Q/K afin que les montages et démontages internes ne modifient pas la géométrie
des parents pendant les captures. A/B sont visibles au FIRST ; C/D apparaissent à
`1s`. Les quatre trajectoires de containers sont verticales pour isoler les défauts
de parentage et de timing.

La projection locale HTML a ensuite été restructurée autour d'une pose affine
globale : origine monde, matrice composée, dimensions locales et offset de layout.
Elle neutralise temporairement les propriétés CSS individuelles et écrit une
unique `matrix(...)`, en réutilisant les helpers de matrice ACE. La fixture ne
contourne donc pas les rotations ou les ordres de transform ; ces cas sont traités
par le host core.

Le runtime présente aussi les overlays actifs avant une nouvelle capture overlay.
Le host HTML compose désormais la pose projetée d'un parent overlay avec la pose
locale de son descendant, et retire d'un ghost les descendants qui obtiennent leur
propre overlay. Ces descendants sont restaurés dans le ghost parent lorsque leur
overlay atteint LAST. Cela évite qu'un item comme `Qa` soit capturé depuis B/C ou
rendu deux fois dans le ghost de K lorsqu'il doit aller de Q vers K, tout en le
laissant visible après son LAST pendant que Q/K poursuivent leur transition.

La suite V2 compte désormais **51 fichiers et 306 tests réussis**.

La fixture stress-test a aussi révélé une divergence `Play`/`Seek` aux bornes des
captures. Le chemin de lecture continue ne doit pas résoudre à nouveau une
ancienne capture expirée avant la capture courante : le runtime réconcilie
désormais les projections expirées sans leur réappliquer leur pose finale. Cela
préserve `play(t) = seek(t)` lorsque plusieurs captures successives touchent les
mêmes items.
