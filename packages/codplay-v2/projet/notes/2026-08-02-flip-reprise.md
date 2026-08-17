# FLIP V2 — état de reprise

## Statut

FLIP HTML V2 est **En cours**. Le socle est exploitable et une première demo de
validation est approuvée, mais la capacité n'est pas terminée pour les contextes
normatifs complexes.

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
