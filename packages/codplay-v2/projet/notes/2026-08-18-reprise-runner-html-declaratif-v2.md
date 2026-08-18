# Reprise V2 — runner HTML déclaratif et stress-test FLIP

## Statut

Status: En cours  
CodPlay version: V2 foundation  
Reprise recommandée dans une nouvelle session avec Safari Preview MCP actif.

Etude FLIP runner a relire: [`runner-flip-integration-study.md`](../../plan/runner-flip-integration-study.md).

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

### Tranche runner logique validée

- `packages/codplay-v2/src/runtime/runner` fournit une façade HTML générique hors démo.
- `HtmlComponentMaterializer` matérialise le template de chaque composant, appelle
  `_materialize`, publie les parts sélectionnées par le catalogue et détache tout au
  teardown.
- `createDomComponentServiceCatalog` fournit les services DOM `className`, `style`,
  `attr` et `content`, avec suppression des propriétés et attributs précédemment gérés.
- `HtmlPlayerRunner` associe explicitement les IDs de targets root au root HTML,
  branche `RuntimeComponentRuntime`, `LayoutDomBackend` et le bridge FLIP direct,
  et expose `init`, `play`, `pause`, `advance`, `seek`, `resize` et `destroy`.
- La verticale déclarative de test couvre montage initial, outlet, transfert logique,
  convergence `advance`/`seek`, epoch de resize et destruction.
- La démo navigateur unique `demos/validation/runner` porte maintenant la tranche
  FLIP directe: un transfert `source-outlet -> target-outlet` à `800ms` pendant
  `1200ms`, sans boucle de rendu secondaire ni parentage impératif.
- Le contrat `style.x/style.y` est relié à la résolution ACE `translateX/translateY`
  puis composé en `transform: translate(...)` par le service DOM du runner. Cette
  intégration reste limitée aux deux canaux de translation nécessaires à la
  verticale; les autres canaux transform restent soumis à leur plan dédié.
- Le bridge `HtmlDomProjection` / `MoveFlipLayoutProjection` coordonne maintenant
  la capture locale, la mutation auteur/structurelle et la projection numérique
  pour la tranche des moves compilés à durée positive. Cette tranche possède un
  journal d'occurrences et un resolver froid historique, mais ne constitue pas
  encore le contrat général des événements live, des reorders `list` historiques
  ou des captures concurrentes complexes.
- La relecture d'architecture fixe maintenant la frontiere cible: le runner HTML
  possede la transaction synchrone FIRST/mutation/LAST et reinjecte un
  `HtmlMeasurementTree` numerique immutable dans le coordinateur FLIP. Le DOM ne
  retourne jamais dans `SolvedScene`; `HtmlFlipRuntime` ne devine ni le touched set
  ni une baseline FIRST depuis le DOM courant.
- Première tranche d'implementation: `flipMode` est conserve jusqu'au delta de
  move, le builder HTML derive les ancetres depuis les targets `perso` et `outlet`,
  et `LayoutDomBackend` synchronise l'etat auteur apres FIRST et avant l'ecriture
  structurelle. `overlay-world` reste refuse par le builder local.
- `MoveFlipLayoutProjection.projectSeek` ne capture plus le DOM courant: il
  projette la scene cible puis utilise uniquement `seekCached`. Un seek froid sans
  occurrence persistée est réalisé pour les moves compilés à un instant strictement
  positif. Les reorders list historiques reconstruisent leur snapshot de module
  depuis `t=0`; les events live et occurrences à `0` restent hors de cette
  réalisation.
- `MoveTransitionJournal` indexe les transitions positives des `CompiledScene` et
  `HtmlPlayerRunner` realise leur FIRST/LAST dans une presentation historique avant
  de restaurer la scene courante. Cette tranche ne traite pas encore les moves
  live ni le touched set de liste.
- La transaction est extraite dans `html-compiled-move-capture-resolver.ts` et
  verifiee independamment du DOM: une erreur de capture restaure aussi la scene
  courante avant de remonter.
- Une fixture DOM deterministe couvre maintenant une chaine
  `target-layout -> target-container -> item`, les poses milieu/fin, le seek-back
  et l'invalidation d'epoch sans navigateur reel.
- La projection locale FLIP n'utilise plus `widthScale`/`heightScale` dans la
  matrice: les dimensions intermédiaires sont écrites en `width`/`height`, puis
  restaurées. La démo n'utilise plus de `scale()` pour distinguer ses conteneurs.
- Les ancetres de layout sont maintenant aussi entries locales quand ils
  appartiennent a la chaine before/after, afin d'animer leur changement de hauteur
  ou largeur avant la projection des enfants et d'eviter le saut de repere.
- Le builder local capture maintenant le mover et les siblings montés des targets
  before/after. `ListCapabilityState` fournit maintenant l'ordre et le touched set
  normatifs au player pour la projection courante. Une présentation historique
  utilise des instances de modules temporaires et rejoue les frontières d'événements
  compilées depuis `t=0`, sans muter l'état du player courant.
- Lorsqu'un mover change de chaîne de parents, le builder ne lui associe plus la
  chaîne de destination pour la pose FIRST. Sa trajectoire est résolue dans le
  repère monde; les siblings qui gardent la même chaîne restent projetés localement.

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

### 1. Contrat du runner HTML V2 — tranche logique et FLIP directe réalisée

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

La tranche réalisée est volontairement bornée au parentage logique et au cycle de
vie HTML. Le ticker est possédé par le runner seulement lorsqu'il construit son
propre engine; un engine externe reste piloté par son host. Les roots sont fournis
par `rootTargets`, sans convention implicite sur le DOM.

La composition FLIP générale reste hors tranche. Le bridge direct actuel est
explicitement une preuve de principe non normative; l'integration propre est
specifiee dans l'etude a relire avant toute refonte.

La prochaine refonte doit commencer par le contrat de transaction render, avant
toute extension de `flip-stress`: presentation historique, lecture groupee FIRST,
ecriture auteur et structure, lecture groupee LAST, reinjection numerique, puis
un commit des poses temporaires.

### 2. Première verticale déclarative — tranche logique réalisée

Avant le stress-test, créer une petite scène déclarative avec :

- deux containers fixes ;
- un perso qui change de `target` ;
- une transition `move` ;
- un seek avant, pendant et après ;
- le même résultat par Play et Seek.

Cette verticale doit valider le runner, pas ajouter un cas particulier dans FLIP.

La verticale existe dans `tests/runtime/runner/html-player-runner.spec.ts`. Elle
utilise un faux DOM déterministe afin de vérifier uniquement le contrat logique;
elle ne sert pas d'oracle pour les poses FLIP.

La présentation manuelle correspondante se lance avec `npm run demo:runner` depuis
`packages/codplay-v2`. Le build de contrôle est `npm run build:runner`. Les mêmes
checkpoints doivent être parcourus par Seek puis par Play; les valeurs CSS
observées doivent être identiques à chaque borne et le parent DOM ne doit pas
changer.

La présentation FLIP directe se lance avec `npm run demo:runner` et son build est
`npm run build:runner`. Elle reste une fixture de preuve visuelle uniquement;
elle ne valide pas encore l'integration FLIP complete decrite par l'etude.

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
- Runner HTML FLIP complet avec overlays, événements live et cold resolver
  multi-captures.
- Intégration normative de la capacité list avec `reorderOnMove/Add/Remove`.

## Vérifications au moment de la reprise

- `npm run typecheck` réussi depuis `packages/codplay-v2`.
- `npm run build:runner` réussi depuis `packages/codplay-v2`.
- 29 tests ciblés FLIP/runner/list réussis depuis `packages/codplay-v2`.
- La suite V2 complète n'a pas été relancée dans cette reprise.
- Aucun commit ni suppression de la fixture ne doit être effectué sans demande
  explicite.

## Point de reprise après correction FLIP

- Le scénario démo est désormais une liste `[B, C]` qui reçoit A en première
  position à `800ms` avec une transition locale.
- Le DOM runner commit l'ordre list normatif `[A, B, C]`.
- Un mover qui change de chaîne de parents n'utilise plus la chaîne de destination
  pour sa pose FIRST; sa trajectoire est interpolée dans le repère monde. Les
  siblings qui gardent la même chaîne restent projetés localement.
- Le cold resolver rejoue l'état des modules depuis `t=0` pour les scènes
  historiques, afin de préserver `play(t) = seek(t)` pour les reorders list
  compilés.
- Vérifications réussies depuis `packages/codplay-v2`: `npm run typecheck`,
  `npm run build:runner`, `npm run test` avec 57 fichiers et 332 tests, puis
  `git diff --check`.
- Aucun commit n'a été créé.
- Prochaine action: lancer `npm run demo:runner`, inspecter le scénario dans
  Safari Preview MCP aux checkpoints `0`, `1500` et `2200`, puis corriger uniquement
  si l'observation navigateur contredit les invariants testés.

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
- `packages/codplay-v2/src/runtime/runner/README.md`
- `packages/codplay-v2/demos/validation/runner/main.ts`
- `packages/authoring/selection-frame/demos/flip/main.ts`
- `packages/authoring/selection-frame/demos/flip-stress/main.ts`
