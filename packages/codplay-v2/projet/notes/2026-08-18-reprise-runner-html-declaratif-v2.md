# Reprise V2 — runner HTML déclaratif et stress-test FLIP

## Statut

Status: En cours  
CodPlay version: V2 foundation  
Reprise recommandée dans une nouvelle session.

## Décision de reprise

Le prochain chantier ne doit pas ajouter de logique dans la démo FLIP stress-test.
Le moteur FLIP isolé est suffisamment avancé pour recevoir des fixtures normatives,
mais la verticale déclarative complète V2 n'est pas encore disponible.

La prochaine étape est donc de construire un runner HTML/Player générique partagé,
hors des démos, capable de consommer une scène V2 déclarative :

```text
SceneDoc
  -> SceneBuilder
  -> CompiledScene
  -> RuntimePlayer
  -> materialisation DOM
  -> LayoutDomBackend
  -> MoveFlipLayoutProjection
  -> HtmlDomProjection
  -> Play / Pause / Seek
```

Une fois ce runner disponible, `flip-stress` devra être réduit à une déclaration
d'éléments, de placements et d'actions `move`. La démo ne devra contenir ni
`renderScene`, ni capture FIRST/LAST manuelle, ni boucle de frames, ni nettoyage
de captures, ni algorithme de projection.

## Contraintes non négociables

- Ne pas supprimer `packages/authoring/selection-frame/demos/flip-stress`.
- Ne pas utiliser sa forme impérative actuelle comme validation normative.
- Ne pas corriger un défaut du moteur par une condition spécifique à la démo.
- Le nettoyage des captures expirées appartient entièrement à `HtmlFlipRuntime`.
- Les démos déclarent des scènes ; elles ne sont pas des moteurs secondaires.
- Ne pas modifier V1 pour faire avancer la verticale V2.
- Aucun import du runtime V1 dans `packages/codplay-v2`.
- Les calculs purs de matrice, AABB, origine et repère doivent être regroupés dans
  des helpers réutilisables et non recopiés entre les hosts.
- Une capacité absente du runner doit être ajoutée au core ou explicitement marquée
  hors tranche ; elle ne doit pas être simulée dans la démo.

## État V2 validé

### Fondation runtime

- Flux `SceneDoc -> CompiledScene -> materialize -> resolve -> solve` en place.
- Diagnostics V2 structurés en place.
- Codec et artefact `CompiledScene` sérialisable en place.
- `RuntimeEngine` et `RuntimePlayer` en place.
- Events, tracks, materialization, résolution et solve des placements en place.
- Policy `move` avec `target`, `@root`, `@off`, conflits same-tick et deltas
  `mount/unmount/move` en place.
- Composants V2 de base, `RuntimeComponentRuntime` et `LayoutDomBackend` en place.
- `MemoryRenderSink` et verticale de validation Player disponibles.

### Move et transitions

- La forme auteur `move` utilise `target`.
- La forme courte string est conservée.
- Les transitions portent `duration`, `ease`, `path` et `traversal`.
- `path` auteur est une chaîne SVG `d` limitée aux commandes `M`, `L` et `A`.
- Le compilateur normalise le chemin de `[0, 0]` à `[1, 0]` et quantifie la géométrie
  au centième.
- Le compilateur produit des segments internes d'arcs et de droites avec leurs
  longueurs cumulées.
- `arc-length` est le parcours par défaut ; `parameter` reste disponible.
- `MoveStateDelta` transporte la transition compilée.
- `MoveFlipLayoutProjection` existe comme bridge entre `MoveStateDelta`,
  `LayoutProjection` et `HtmlFlipRuntime`.
- Le builder concret qui associe les handles, ancêtres et entries FLIP reste une
  responsabilité du runner/host générique à construire.

### FLIP HTML core

- Capture FIRST / mutation / LAST persist-only.
- Pose graph racine-feuille.
- Ancêtres composités et ancêtres `layout` historiques.
- Parent et grand-parent FLIP.
- Modes `local` et `overlay-world`.
- Captures concurrentes et retarget.
- Isolation host context / projection epoch.
- Diagnostics runtime via `DiagnosticCollector`.
- Nettoyage des projections expirées dans le runtime, sans réappliquer l'ancienne
  pose finale.
- `play(t)` et `seek(t)` utilisent le même chemin de résolution temporelle.
- Pose HTML affine globale avec origine monde, matrice composée, dimensions locales
  et offset de layout.
- Projection locale par une unique `matrix(...)`, avec neutralisation temporaire
  de `translate`, `rotate` et `scale`, puis restauration du style auteur.
- Overlays scoped au `root` du host.
- Présentation des overlays actifs avant une nouvelle capture overlay et à la borne
  LAST après mutation.
- Composition d'une pose locale enfant avec la pose projetée d'un parent overlay.
- Masquage réversible des descendants dans les ghosts parents lorsqu'ils possèdent
  leur propre overlay.

## Fixtures

### Référence conservée

`packages/authoring/selection-frame/demos/flip`

Cette démo est conservée comme fixture de référence actuelle. Elle possède son
propre bootstrap historique et ne doit pas être enrichie avec de nouvelles règles
FLIP. Elle reste utile pour les observations déjà validées.

### Stress-test suspendu mais conservé

`packages/authoring/selection-frame/demos/flip-stress`

Le scénario à conserver est :

- A/B/C/D aux positions de scène prévues ;
- A/B visibles au FIRST ; C/D visibles à `1s` ;
- trajectoires verticales avec rotations de test ;
- dimensions fixes des containers A/B/C/D et Q/K ;
- Q de A vers B ; K de D vers C ;
- Q et K en overlay pendant `8s` ;
- Q/K comme listes horizontales de pastilles colorées ;
- échanges alternés `Qa -> K`, `Ka -> Q`, `Qb -> K`, `Kb -> Q`, `Qc -> K`,
  `Kc -> Q` ;
- tous les enfants capturés lors d'un échange afin de tester les reflows internes.

La version actuelle est impérative et n'est pas une démo V2 acceptable. Elle est
conservée uniquement comme description visuelle et oracle de scénario. Elle devra
être remplacée par une déclaration `SceneDoc` lorsque le runner générique sera prêt.

## Prochain chantier recommandé

### 1. Contrat du runner HTML V2

Définir une façade qui reçoit une scène compilée, un root HTML, un catalogue de
composants et les cibles de montage. Elle doit posséder l'orchestration générique,
pas la démo :

- materialisation des composants déclarés ;
- résolution des handles et des targets ;
- création de `HtmlDomProjection` ;
- création de `MoveFlipLayoutProjection` ;
- branchement au `RuntimePlayer` ;
- avance d'un temps déterministe ;
- Play, Pause et Seek convergents ;
- resize et invalidation d'epoch ;
- destruction complète.

### 2. Première verticale déclarative

Avant le stress-test, créer une petite scène déclarative avec :

- deux containers fixes ;
- un perso qui change de `target` ;
- une transition `move` ;
- un seek avant, pendant et après ;
- le même résultat par Play et Seek.

Cette verticale doit valider le runner, pas ajouter un cas particulier dans FLIP.

### 3. Reprise de `flip-stress`

Transformer le scénario conservé en données déclaratives uniquement. Les captures
et les mutations doivent être produites par le pipeline `move -> solve -> project`.
Les enfants Q/K ne doivent pas être déplacés par une fonction de démo ; leur
parentage doit résulter des actions `move` déclarées.

### 4. Validation normative

Lorsque le runner existe, vérifier :

- FIRST, milieu, LAST ;
- Play et Seek à la même valeur temporelle ;
- apparition différée de C/D ;
- rotation des quatre containers ;
- transfert Q/K pendant le mouvement des parents ;
- reflow interne des listes ;
- absence de doublons dans les ghosts ;
- capture des enfants au bon repère Q/K et non B/C ;
- interruption, reprise, seek-back, resize et scroll.

## Limites encore ouvertes

- Détection automatique du plus haut ancêtre en reflow.
- Mesures historiques complètes pour tous les ancêtres `layout`.
- Caractérisation et cache par segments inter-bornes.
- Contrat complet des valeurs par défaut de transition.
- Diagnostics détaillés des transitions invalides ou incomplètes.
- Support HTML 3D/perspective au-delà de la pose affine 2D actuelle.
- Runner générique de materialisation HTML/Player.
- Intégration concrète de la capacité list avec `reorderOnMove/Add/Remove`.

## Vérifications au moment de la reprise

- Typecheck V2 réussi.
- Suite V2 : **51 fichiers, 306 tests réussis**.
- Build Vite de la démo `flip` réussi.
- Build Vite de la fixture conservée `flip-stress` réussi.
- Aucun commit ni suppression de la fixture ne doit être effectué sans demande
  explicite.

## Fichiers principaux

- `packages/codplay-v2/plan/codplay-v2-plan.md`
- `packages/codplay-v2/plan/move-contract-plan.md`
- `packages/codplay-v2/src/runtime/player/runtime-player.ts`
- `packages/codplay-v2/src/runtime/player/layout-dom-backend.ts`
- `packages/codplay-v2/src/runtime/player/flip/move-flip-layout-projection.ts`
- `packages/codplay-v2/src/runtime/flip/html-flip-runtime.ts`
- `packages/codplay-v2/src/runtime/flip/html-dom-projection.ts`
- `packages/codplay-v2/src/runtime/flip/html-pose.ts`
- `packages/codplay-v2/src/runtime/flip/README.md`
- `packages/authoring/selection-frame/demos/flip/main.ts`
- `packages/authoring/selection-frame/demos/flip-stress/main.ts`
