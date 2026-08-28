# Reprise V2 — runner HTML déclaratif et stress-test FLIP

> Note historique remplacée le 2026-08-19 par
> [`plan/runner-flip-integration-study.md`](../../plan/runner-flip-integration-study.md).
> Les captures, bridges et runtimes FLIP nommés ci-dessous ont été supprimés ;
> ils ne décrivent plus l'architecture V2 courante.
> Depuis le 2026-08-20, le catalogue runtime de composants, services et modules
> est également unifié par `RuntimeCapabilityCatalog`; les passages de cette note
> qui mentionnent des catalogues de démo ou des materializers concurrents ne sont
> pas des contrats actuels.

## Statut

Status: Remplacée
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
- Aucun import du runtime V1 dans `packages/codplay`.
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
  de `translate`, `rotate` et `scale` dans des slots CSS réservés; la déclaration
  `style` auteur n'est plus restaurée par snapshot complet.
- Overlays scoped au `root` du host.
- Présentation des overlays actifs avant une nouvelle capture overlay et à la borne
  LAST après mutation.
- Composition d'une pose locale enfant avec la pose projetée d'un parent overlay.
- Masquage réversible des descendants dans les ghosts parents lorsqu'ils possèdent
  leur propre overlay.

### Tranche runner logique validée

- `packages/codplay/src/runtime/runner-html` fournit une façade HTML générique hors démo.
- `HtmlComponentMaterializer` matérialise le template de chaque composant, appelle
  `_materialize`, publie les parts sélectionnées par le catalogue et détache tout au
  teardown.
- Les déclarations des services HTML vivent dans `src/services/<service>` ; leurs
  adaptateurs HTML y sont séparés par service. `HtmlComponentMaterializer` ne fait
  qu'assembler `className`, `style`, `attr` et `content`, avec suppression des
  propriétés et attributs précédemment gérés. Les démos ne construisent pas de
  catalogue de services concurrent.
- Le transform HTML est isolé dans `src/services/style/html-transform-service.ts`.
  `content` reste une tranche minimale en cours d'enrichissement et ne constitue
  pas encore le contrat complet du service.
- `HtmlPlayerRunner` associe explicitement les IDs de targets root au root HTML,
  branche `RuntimeComponentRuntime`, `LayoutDomBackend` et le bridge FLIP
  transactionnel,
  et expose `init`, `play`, `pause`, `advance`, `seek`, `resize` et `destroy`.
- La verticale déclarative de test couvre montage initial, outlet, transfert logique,
  convergence `advance`/`seek`, epoch de resize et destruction.
- La démo navigateur unique `demos/validation/runner` porte maintenant la tranche
  FLIP transactionnelle: un transfert `source-outlet -> target-outlet` à `800ms`
  pendant `1400ms`, sans boucle de rendu secondaire ni parentage impératif.
- Le contrat `style.x/style.y` est relié à la résolution ACE `translateX/translateY`
  puis composé en `transform: translate(...)` par le service HTML du materializer. Cette
  intégration reste limitée aux deux canaux de translation nécessaires à la
  verticale; les autres canaux transform restent soumis à leur plan dédié.
- Le bridge `HtmlDomProjection` / `MoveFlipLayoutProjection` coordonne maintenant
  la transaction synchrone `FIRST -> authored/structural -> LAST`, le
  `HtmlMeasurementTree` numérique immutable et la projection numérique pour la
  tranche des moves compilés à durée positive. Cette tranche possède un journal
  d'occurrences stable et un resolver froid multi-captures, mais ne constitue pas
  encore le contrat général des événements live, des overlays ou du stress-test.
- La relecture d'architecture fixe maintenant la frontiere cible: le runner HTML
  possede la transaction synchrone FIRST/mutation/LAST et reinjecte un
  `HtmlMeasurementTree` numerique immutable dans le coordinateur FLIP. Le DOM ne
  retourne jamais dans `SolvedScene`; `HtmlFlipRuntime` ne devine ni le touched set
  ni une baseline FIRST depuis le DOM courant.
- Première tranche d'implementation: `flipMode` est conserve jusqu'au delta de
  move, le builder HTML derive les ancetres depuis les targets `perso` et `outlet`,
  et `LayoutDomBackend` synchronise l'etat auteur apres FIRST et avant l'ecriture
  structurelle. Les chaînes d'ancêtres restent un contexte géométrique; elles ne
  deviennent pas des entries animées implicitement. Un groupe `overlay-world`
  projette chaque item touché indépendamment et le host déclare les régimes
  `stable`/`composited`/`layout`.
- `MoveFlipLayoutProjection` ne possède plus de `projectSeek` séparé: `project()`
  projette Play et Seek par la même présentation `project()`/`seekCached()`.
  Le runner ne possède plus d'acquisition live parallèle: toute capture manquante
  passe par la transaction historique commune. Les reorders list historiques
  reconstruisent leur snapshot de module depuis `t=0`; les events live et
  occurrences à `0` restent hors de cette réalisation.
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
- Les ancetres de layout appartiennent au graphe de coordonnées historique quand
  ils sont déclarés par le host, mais une capture enfant ne les anime pas
  implicitement. Un conteneur n'est projeté que par sa capture directe, afin que
  sa trajectoire reste indépendante de celles de ses descendants.
- Le builder local capture maintenant le mover et les siblings montés des targets
  before/after. `ListCapabilityState` fournit maintenant l'ordre et le touched set
  normatifs au player pour la projection courante. Une présentation historique
  utilise des instances de modules temporaires et rejoue les frontières d'événements
  compilées depuis `t=0`, sans muter l'état du player courant.
- Lorsqu'un mover change de chaîne de parents, le builder ne lui associe plus la
  chaîne de destination pour la pose FIRST. Sa trajectoire est résolue dans le
  repère monde; un groupe `overlay-world` conserve ce mode pour tous les items
  touchés, tandis que le mode local conserve ses chaînes d'ancêtres comme
  contexte sans acquérir l'ownership des conteneurs.
- `RuntimePlayer.init` matérialise maintenant la première scène avant
  l'initialisation des modules player-scoped. Les outlets `markup` sont donc
  disponibles lorsque `list` capture son ordre initial, y compris pour une
  liste imbriquée dans un parent HTML.
- `MoveTransitionOccurrence.captureId` est propagé jusqu'au delta de projection;
  le builder ne dérive plus l'identité d'une capture du touched set lorsqu'une
  occurrence compilée est connue.
- `HtmlPresentationTransaction` groupe les lectures DOM FIRST/LAST et réutilise la
  même primitive pour les captures courantes et historiques. `HtmlFlipRuntime` les
  enregistre avec `recordMeasurementTree()` et résout toutes les captures actives
  manquantes dans un seul commit.
- Les captures groupées publient `sourceCaptureIds` pour toutes les occurrences
  compilées couvertes. Le cache ne relance ainsi pas la même réalisation lorsqu'une
  capture enfant apparaît à la frame suivante; les ghosts descendants conservent
  la même base FIRST que la trajectoire parent.
- `FlipCaptureCache` canonicalise désormais les captures par identité primaire et
  `sourceCaptureIds`: une capture groupée évince les captures unitaires qu'elle
  couvre et une réalisation unitaire ultérieure est ignorée. `HtmlFlipRuntime`
  conserve alors le handle de ghost actif au remplacement d'un alias. Cette
  correction traite structurellement le FIRST erroné de Kabc observé en Play,
  sans interrompre la trajectoire de K.
- `HtmlTransientStyleLayer` sépare désormais les contributions FLIP locales et de
  visibilité des valeurs auteur: le navigateur utilise des attributs
  `data-codplay-flip-*` et des variables CSS réservées; les doubles DOM sans feuille
  de style utilisent un ledger inline qui conserve une écriture auteur concurrente.
- Une régression DOM vérifie qu'une modification de `transform` et d'une autre
  propriété auteur pendant FLIP survit à la pose suivante et à la fin de la capture.
- La tranche ancêtres/overlays ajoute une coupe de reflow declarée par le host:
  le premier ancêtre `layout` et ses descendants sont résolus historiquement,
  avec suspension/restauration des contributions transitoires avant la mesure.
  Le runner réalise cette pose historique depuis `resolveSceneAt(timeMs)` et
  restaure la scène courante dans un `finally`.
- `HtmlDomProjection` calibre les ghosts dans le repère du root, masque les
  descendants overlay dans les ghosts parents, puis supprime les ghosts et la
  couche overlay lors de la destruction.

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

La composition FLIP générale reste hors tranche. La transaction render P0 est
maintenant implémentée pour les moves compilés positifs: présentation historique,
lecture groupée FIRST, écriture auteur et structure, lecture groupée LAST,
réinjection numérique et commit unique des poses temporaires.

Le prochain incrément doit traiter les ancêtres `layout`/overlays complets et les
gates de seek froid exhaustives avant toute extension de `flip-stress`.

### 2. Première verticale déclarative — tranche logique réalisée

Avant le stress-test, créer une petite scène déclarative avec :

- deux containers fixes ;
- un perso qui change de `target` ;
- une transition `move` ;
- un seek avant, pendant et après ;
- le même résultat par Play et Seek.

Cette verticale doit valider le runner, pas ajouter un cas particulier dans FLIP.

La verticale existe dans `tests/runtime/runner-html/player-runner.spec.ts`. Elle
utilise un faux DOM déterministe afin de vérifier uniquement le contrat logique;
elle ne sert pas d'oracle pour les poses FLIP.

La présentation manuelle correspondante se lance avec `npm run demo:runner` depuis
`packages/codplay`. Le build de contrôle est `npm run build:runner`. Les mêmes
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

- Détection automatique du régime de reflow sans déclaration du host.
- Mesures historiques item-par-item sous une coupe de reflow.
- Caractérisation et cache par segments inter-bornes.
- Contrat complet des valeurs par défaut de transition.
- Diagnostics détaillés des transitions invalides ou incomplètes.
- Support HTML 3D/perspective au-delà de la pose affine 2D actuelle.
- Runner HTML FLIP complet pour les événements live; le cold resolver
  multi-captures est maintenant limité aux moves compilés positifs.
- Intégration normative de la capacité list avec `reorderOnMove/Add/Remove`.
  Réalisée le 21 août 2026 : la capacité fournit la politique à la timeline
  structurelle, le composant `list` est distinct de `TagComponent`, et les
  transitions restent portées par `move.transition`.

## Vérifications au moment de la reprise

- `npm run typecheck` réussi depuis `packages/codplay`.
- `npm run build:runner` réussi depuis `packages/codplay`.
- La suite V2 complète passe après la tranche ancêtres/overlays: 60 fichiers et
  357 tests.
- Aucun commit ni suppression de la fixture ne doit être effectué sans demande
  explicite.

## Point de reprise après correction FLIP

- Le scénario démo est désormais une liste `[B, C]` qui reçoit A en première
  position à `800ms` avec une transition locale.
- Le DOM runner commit l'ordre list normatif `[A, B, C]`.
- Un mover qui change de chaîne de parents n'utilise plus la chaîne de destination
  pour sa pose FIRST; sa trajectoire est interpolée dans le repère monde. Les
  items locaux qui gardent la même chaîne restent projetés dans leur repère local;
  un conteneur n'est jamais animé implicitement par la capture de son descendant.
- Le cold resolver rejoue l'état des modules depuis `t=0` pour les scènes
  historiques, afin de préserver `play(t) = seek(t)` pour les reorders list
  compilés.
- `HtmlPresentationTransaction` est maintenant le chemin courant et historique:
  le runner mesure un `HtmlMeasurementTree`, l'enregistre par `captureId`, puis
  applique une seule résolution au timestamp du frame. `advance()` ne double plus
  cette présentation au même timestamp.
- La couche DOM auteur/transitoire est maintenant implémentée: local FLIP et
  visibilité overlay utilisent des slots réservés, le nettoyage retire ces slots
  sans remplacer la chaîne `style` auteur, et une écriture concurrente est couverte
  par test.
- Le gate P1 de réalisation froide est couvert: Play et Seek produisent les mêmes
  poses au début, au milieu et à la fin; le seek-back et les seeks répétés réutilisent
  la capture; `invalidateHost()` force une nouvelle réalisation dans le nouvel epoch.
- Vérifications réussies depuis `packages/codplay`: `npm run typecheck`,
  `npm run build:runner`, `npm run test` avec 60 fichiers et 357 tests, puis
  `git diff --check`.
- Aucun commit n'a été créé.
- La reprise navigateur a révélé puis corrigé un ordre DOM final `[B, C, A]`
  lorsque la liste était imbriquée dans des outlets non encore publiés au moment
  de l'initialisation des modules.
- Après correction, Safari Preview MCP confirme `[B, C]` à `0ms`, `[A, B, C]`
  à `1500ms` pendant la transition et `[A, B, C]` à `2200ms`, avec A en première
  position visuelle et sans transform résiduelle. Une régression runner couvre
  désormais cette initialisation imbriquée.
- Après la couche auteur/transitoire, Safari confirme à `1500ms` la présence des
  slots `data-codplay-flip-*` et de la matrice calculée, puis leur retrait à
  `2200ms`. Une modification auteur de `transform` et de `background-color` faite
  pendant la transition survit à la fin FLIP; la console reste sans warning ni
  erreur.
- La demo runner expose maintenant un selecteur entre la baseline A/B/C locale et
  une scene declarative P/Q `nested-overlay`. La seconde scene declare P et Q en
  `overlay-world`, B/C en local et `overlay-target-layout` comme coupe historique
  `layout`; le code de demo ne capture ni ne mute le FLIP.
- Safari Preview MCP confirme pour la scene P/Q: `0ms` sans ghost, `1500ms` avec
  deux ghosts dont un clone Q masque dans le ghost parent, puis `2200ms` sans ghost,
  avec Q vivant dans le dernier outlet de P. La baseline confirme de nouveau que A
  est le premier enfant DOM et le premier visuellement a `1500ms`.
- La fixture `packages/authoring/selection-frame/demos/flip-stress` est maintenant
  declarative et delegue son parentage, son transport, ses captures et ses
  overlays a `HtmlPlayerRunner`. Le contrat d'ownership hiérarchique est explicite:
  les ancêtres servent au calcul des coordonnées, une capture enfant ne projette
  ni ne remplace son conteneur parent, et la fenêtre active suit la capture la
  plus longue. Safari confirme à `1000ms`, `1400ms`, `2200ms` et `2600ms` que la
  trajectoire de B continue pendant les captures de contenu et que les ghosts
  Q/K persistent au-delà de la fin d'une capture enfant.
- La mesure historique d'une capture enfant présentait auparavant la scène cible
  à la seule phase de mutation. Le runner mesure désormais FIRST et LAST aux
  phases absolues `startAt` et `startAt + duration`, en présentant aussi la scène
  terminale avant la lecture LAST. La durée de l'enfant sélectionne donc la phase
  terminale du parent sans modifier son ownership. La régression couvre les deux
  appels de préparation et Safari confirme la cible de `qa` sans saut lorsque K
  continue sa propre trajectoire.
- La reproduction `Seek(1000) -> Reset -> Play` passe maintenant par les mêmes
  captures historiques canoniques pour Q/K. Safari Preview confirme au FIRST
  (`~1167ms`) seulement deux ghosts parents, avec `Ka/Kb/Kc` dans le repère FIRST
  de K (`x≈1045/1080/1115`, `y≈457`); le Seek à `1200ms` conserve la même base.
  La console applicative reste sans erreur.
- Le cache FLIP porte maintenant un index atomique des identités primaires et
  aliasées; le resolver froid déduplique aussi les occurrences répétées par un
  `Set` avant de construire leurs captures. Les alias répétés dans une métadonnée
  sont normalisés avant l’indexation.

## Refonte structurelle du 19 août 2026

Les observations des erreurs FIRST de Q/K ont montré que les correctifs précédents
laissaient trois sources de vérité concurrentes: `SolvedScene` et sa map d'ordre,
le parentage DOM courant, et le chemin de capture live distinct du resolver de
seek. Cette divergence est supprimée dans la structure V2 actuelle:

- `SolvedScene.graph` est le snapshot immuable unique de parentage, target,
  ordre, traversal parent-first et révision;
- les overrides `list` sont validés contre cette révision et ne peuvent plus
  fusionner silencieusement un item dans un autre target;
- Play et Seek passent tous deux par `LayoutDomBackend.project(...commit)` puis
  `HtmlFlipRuntime.seekCached()`. `MoveFlipLayoutProjection` ne possède plus de
  branche `seek` ni de présentateur live;
- le resolver historique est le seul resolver du runner. FIRST et LAST sont des
  scènes explicites aux bornes de l'occurrence;
- les captures world conservent un template FIRST DOM séparé des poses
  numériques. Une réactivation ne clone donc jamais la hiérarchie DOM courante;
- chaque entrée transporte ses targets source/destination, ce qui rend son
  ownership vérifiable indépendamment des positions numériques.

La nouvelle régression de graphe et la régression de template parent sont
couvertes par la suite V2. Safari Preview MCP a été vérifié à `0ms`, `1500ms` et
`2200ms`: l'ordre DOM des containers est `[A, B, C, D]`, A est visuellement le
premier, et les ghosts parents Q/K gardent leur subtree FIRST.

## Correction ownership enfant au LAST — 19 août 2026

La vérification fine autour de `2200ms`, borne LAST de `qa` (`1200→2200ms`), a
révélé une restauration incorrecte: le runtime réaffichait le clone Qa dans le
ghost FIRST de Q alors que le graphe courant le plaçait dans K. La cause était une
restauration globale par `itemId`, qui ignorait la cible LAST.

La donnée de capture porte désormais, pour chaque overlay parent, la table
`overlayTargetByPerso` des descendants contenus dans son template FIRST. Le
runtime masque/restaure les clones avec les targets source/destination de l'entrée;
un enfant Q→K reste donc masqué dans le ghost Q à son LAST, tandis qu'un retour K→Q
peut restaurer le clone dans le ghost Q si sa cible LAST correspond. Cette règle
est commune aux captures génériques et au resolver historique du runner.

Régression ajoutée dans `html-dom-overlay-integration.spec.ts` et vérification du
builder pour la table d'ownership. La suite V2 passe désormais à 60 fichiers et
360 tests. Safari Preview MCP confirme à `2199ms`, `2200ms` et `2201ms` que Qa est
visible dans K, absent visuellement du ghost Q, sans retour temporaire à sa pose
FIRST.

## Handoff enfant-parent au LAST — 19 août 2026

Le contrôle Play réel a ensuite isolé la fenêtre signalée autour de `2200ms`: une
transition enfant ne doit pas rendre son overlay au DOM dès son propre LAST lorsque
le parent de destination poursuit sa trajectoire. La correction structurelle porte
`destinationParentId` dans l'entrée et conserve alors le ghost enfant en handoff.
Sa pose relative est calculée au LAST de l'enfant puis recomposée avec la pose
courante du parent à chaque commit, jusqu'au LAST du parent. Les siblings stables
des captures groupées sont marqués `isDirectMover: false` afin de ne pas reprendre
cet ownership.

Le test DOM vérifie que l'overlay enfant reste présent et suit le déplacement du
parent entre `200ms` et `500ms`, puis que le DOM est restauré uniquement à `1000ms`.
Safari Preview MCP confirme en Play les frames `2150ms`, `2167ms`, `2183ms`,
`2217ms`, `2233ms` et `2250ms`: Qa reste visible dans la trajectoire de K, le clone
Q reste masqué et aucune frame observée ne revient à la pose FIRST. Les checkpoints
Seek `0ms`, `1500ms`, `2200ms`, `9000ms` et `10000ms` conservent l'ordre DOM
`[A, B, C, D]`, avec A visuellement premier; aucun warning ni error n'est remonté
par la console Safari.

## Graphe d'overlay récursif et références DOM — 19 août 2026

La disparition progressive de `Qabc`/`Kabc` au LAST venait d'une propriété
d'overlay représentée comme une liste plate: un enfant pouvait être libéré sans
que la continuation de son parent, ni celle des ancêtres du parent, soit résolue.
Le runtime porte maintenant une forêt de `OverlayProjectionNode`. Un noeud direct
possède sa capture; un noeud en handoff conserve son `parentItemId` et sa pose
relative. La pose, la continuation et la libération parcourent récursivement cette
forêt. La même structure fonctionne à profondeur 5, couverte par une régression,
et les cycles sont détectés dans le graphe plutôt que corrigés par cas particulier.

La projection DOM ne recherche plus les descendants d'un ghost par
`data-item-id`/`id`. Le template FIRST capture une `Map` de références vers les
clones des descendants connus, puis la rematérialisation remappe ces références
vers le nouveau clone. Les attributs de markup restent disponibles pour le
diagnostic; `data-codplay-flip-hidden` n'est qu'un marqueur CSS transitoire et ne
participe pas à l'ownership. Le suivi des poses locales utilise également une map
par référence `HTMLElement`.

Les autres frontières ont été auditées: `SolvedScene.graph`, le pose graph
numérique, `HtmlPresentationTransaction` et `FlipCaptureCache` restent les sources
de vérité adaptées et ne nécessitent pas une seconde implémentation. La seule
extension identifiée hors de cette tranche est la rétention longue durée des
occurrences live; elle reste explicitement hors périmètre et ne conditionne pas la
correction des captures déclaratives Q/K.

La suite V2 actuelle passe à 61 fichiers et 367 tests; typecheck, build runner et
`git diff --check` sont également verts.

## Correction des trajectoires K/Q et du repère affine — 19 août 2026

L'inspection des positions intermédiaires a isolé deux erreurs qui se
renforçaient. Le pose graph utilisait rect.left/top comme si la boîte visuelle
englobante était son origine affine; cela devient faux dès qu'une rotation ou
une matrice produit une AABB décalée. Le contrat est maintenant strict:
origin est la position monde de la boîte locale, matrix porte sa partie
linéaire, et rect est reconstruite à partir des coins transformés. Les
trajectoires qui partent d'une AABB sont converties en origine avant composition.

La trajectoire de Ka révélait aussi une divergence de propriété pendant la
mesure historique de son LAST: le capture Q/K avait encore un ghost direct de
Ka, et ce ghost était consulté avant le nouveau parent logique Q après le
reparentage. La mesure consulte désormais d'abord l'overlay du parent présent
dans l'ascendance DOM; le direct obsolète reste un repli seulement sans parent
actif. La cible de l'enfant est ainsi capturée à startAt + duration avec la
phase absolue du parent, puis le handoff la recombine avec Q sans interrompre
la trajectoire de Q.

Régressions ajoutées: parent tourné/mis à l'échelle avec AABB non triviale, et
reparentage sous un parent actif malgré un ghost direct enfant préexistant.
Safari Preview MCP confirme après correction, en Seek et en Play, que Ka est
sur la trajectoire Q à environ 3600ms, que Qa continue vers K, et qu'aucun
retour à la pose FIRST ni erreur console n'est observé. La suite passe à
61 fichiers / 367 tests; typecheck, build runner et git diff --check sont verts.

## Ownership global des ghosts enfants au seek froid — 19 août 2026

L'inspection de `8500ms` a révélé un cas différent d'une mauvaise trajectoire:
chaque `Qa…Kc` apparaissait à la fois dans son ghost direct et dans le ghost
parent Q ou K. Au seek froid, les occurrences enfants déjà terminées ne sont pas
réalisées une par une; la capture courante de `Kc` regroupe leurs aliases. Le
`sourceTargetId` de ces aliases correspond alors au dernier état historique et
ne suffit plus à identifier le clone FIRST à masquer dans le parent.

La règle de visibilité est maintenant appliquée en deux temps: le filtrage par
target continue de gérer la restauration après libération, puis un commit final
parcourt la forêt `OverlayProjectionNode` et masque globalement chaque item qui
possède encore un ghost `capture` ou `handoff`. Le ghost parent continue donc sa
trajectoire, mais tous ses clones d'un item détenu par un ghost enfant sont
masqués. Le ghost enfant est l'unique représentation visible, quelle que soit
l'origine historique de l'alias.

Une régression DOM couvre un enfant dont le source target courant ne correspond
plus au target FIRST du parent. Safari Preview MCP confirme le seek froid à
`8500ms` et Play à `8480ms`: une seule occurrence visible par `Qa/Qb/Qc/Ka/Kb/Kc`,
ghosts parents masqués pour ces descendants, `ghosts 8, hidden 6`, sans warning
ni error console. La suite V2 passe à 61 fichiers et 368 tests; typecheck, build
runner et `git diff --check` sont verts.

## Contenu courant des ghosts parents au seek — 19 août 2026

Le seek à `8190ms`, avant l'occurrence `kc` de `8200ms`, révélait une divergence
que les points `8200ms` et `8210ms` masquaient : l'ordre logique indiquait déjà
`Q = ka → kb` et `K = kc → qa → qb → qc`, mais les ghosts parents affichaient
encore leur subtree FIRST (`Qa/Qb/Qc` et `Ka/Kb/Kc`). Play ne révélait pas le
défaut car il traversait progressivement les fins des captures enfants et
exécutait les restaurations intermédiaires.

La cause était structurelle : le seek froid ne réalise que les captures actives,
et `HtmlFlipRuntime` ne réconciliait le contenu d'un ghost parent que lorsqu'un
ghost enfant était libéré. Le template FIRST reste désormais la base de création
géométrique du ghost, mais chaque commit reçoit un `HtmlFlipOverlayContentState`
issu de la `SolvedScene`. La projection HTML reconstruit le subtree courant du
ghost et remappe ses références avant la passe d'ownership. Les contenus entrants
dans Q/K sont donc visibles même lorsque leurs captures enfants sont déjà
terminées, sans interrompre la trajectoire du parent.

La régression DOM couvre un enfant remplacé avant un seek froid. Safari Preview
MCP confirme avec des pas de `10ms` à `8190ms`, `8200ms` et `8210ms` que les ghosts
parents reflètent l'ordre courant; Play à `8267ms` conserve le même ownership.
La suite V2 passe à 61 fichiers / 372 tests; typecheck, build runner et
`git diff --check` sont verts.

## Reflow simultané et ordre list au seek froid — 19 août 2026

Le scénario à `7800ms`/`8200ms` a mis en évidence une divergence structurelle :
les siblings stables d'un premier reflow pouvaient rester en `handoff` et ne plus
être réadressés par un reflow simultané plus récent. En parallèle, Q/K étaient
déclarés comme de simples composants `layout` dans la démo ; l'ordre cold seek
retombait alors sur l'ordre du graphe au lieu de l'ordre append produit par le
module `list` pendant Play.

La correction conserve le handle d'un même capture groupé, mais permet à une
nouvelle occurrence de remplacer le handoff d'un sibling stable. Q et K sont
maintenant de vrais composants `list`; le module initialise aussi les outlets
qu'ils possèdent et expose un snapshot historique de leur ordre et de leur
touched set. `prepareSeek` en stage une copie avant le commit commun, de sorte
que Play et Seek utilisent le même `LayoutProjection.project()` et le même
`HtmlFlipRuntime.seekCached()`.

Safari Preview MCP confirme sans erreur à `7800ms` `K = kc → qa → qb → qc`, puis
à `8200ms` `Q = ka → kb → kc` et `K = qa → qb → qc`. La suite V2 passe à
61 fichiers / 371 tests; typecheck, build runner et `git diff --check` sont verts.

## Siblings de reflow et trajectoire du parent — 19 août 2026

Entre `2000ms` et `4000ms`, Qb/Qc révélaient que les siblings d'un reflow
étaient interpolés comme des ghosts monde autonomes, puis recomposés sur Q lors
du handoff. Cette double composition rendait leur déplacement relatif au
conteneur instable pendant que Q/K poursuivaient leur propre transition.

Le graphe d'overlays conserve désormais un ghost distinct pour chaque sibling
`isDirectMover: false`, mais lui associe le ghost actif de son parent logique.
Aux bornes de sa capture, ses poses monde sont converties en poses relatives au
parent; à chaque commit, la pose relative suit la durée/easing du sibling et est
composée avec la pose parent courante. Les movers directs comme Ka et Qb lors de
leur transfert restent autonomes dans l'espace monde, puis passent en handoff à
leur parent de destination. Aucun parent n'est interrompu ou recalculé par cet
ajustement.

La régression du pose graph couvre un parent `inOutQuad` et un sibling à durée
distincte; la régression runtime couvre aussi le remplacement d'un handoff par
un reflow simultané. Safari Preview MCP, avec des points séparés d'au moins
`10ms`, confirme en Play de `1750ms` à `4117ms` que Qb/Qc restent à des offsets
locaux stables pendant l'arrivée de Ka (`qbLocal=10`, `qcLocal=45` de `2250ms`
à `3900ms`), puis que le nouveau transfert de Qb ne déplace pas Qc/Ka. Seek à
`1600ms`, `2200ms`, `2600ms`, `2800ms`, `3000ms`, `3400ms` et `3600ms` produit
les mêmes poses; la console ne contient aucun warning/error applicatif.

La suite V2 passe à 61 fichiers / 374 tests; typecheck, build runner et
`git diff --check` sont verts.

## Borne DOM/overlay et placements fractionnaires — 19 août 2026

À l'entrée de la première capture Q/K (`1000ms`), puis à sa restitution
(`9000ms`), Safari révélait un écart d'environ un pixel entre le node DOM et son
ghost. La source était la reconstruction de l'origine avec `offsetLeft` /
`offsetTop`, entiers, alors que le layout CSS rendait Q/K à des coordonnées
fractionnaires (`580.125`, par exemple).

La mesure HTML conserve maintenant les offsets comme repli, mais recale la
translation fractionnaire à partir du `getBoundingClientRect()` rendu, après
soustraction de l'AABB calculée depuis la matrice affine. Le rect n'est donc
jamais traité comme l'origine affine. Une régression DOM couvre un placement
fractionnaire; Safari confirme à `999ms`/`1000ms`/`1001ms` et
`8999ms`/`9000ms`/`9001ms` une continuité sans saut visible, en conservant le
même chemin Play/Seek.

La suite V2 passe à 61 fichiers / 375 tests; typecheck, build runner et
`git diff --check` sont verts.

## Échanges de contenu simultanés — 19 août 2026

La démo `flip-stress` déclenche maintenant les six échanges à `1200ms`,
`1700ms`, `2200ms`, `2700ms`, `3200ms` et `3700ms`. Chaque transition de
contenu dure `1000ms`; l'espacement de `500ms` maintient donc deux items en
transition pendant chaque intervalle normal de recouvrement, avec des
directions opposées (`Q → K` et `K → Q`). La durée de la transition n'a pas
été raccourcie et le runtime n'a pas reçu de branche spéciale pour ce scénario.

Seek confirme les recouvrements aux checkpoints `1700ms`, `2200ms`, `2700ms`,
`3200ms` et `3700ms`. En Play, le statut observe `qa` et `ka` actifs à
`1700ms`, puis `qb` et `kb` actifs à environ `2733ms`; chaque item n'a qu'une
occurrence visible et les huit ghosts restent présents. Safari Preview MCP ne
rapporte aucun warning ni erreur.

La compilation Vite de `demos/flip-stress` et la suite V2 restent vertes
(`61` fichiers / `375` tests). Le typecheck du workspace `selection-frame`
reste limité par des erreurs préexistantes dans le code V1 importé
(`typed-om-polyfill` et `list-dnd`), sans erreur dans la démo modifiée.

## Ownership pendant les échanges recouvrants — 19 août 2026

La première version de l'espacement à `500ms` révélait une interruption à
chaque nouveau départ. À `1600ms`, `qa` était encore au milieu de son transfert
Q → K; à `1700ms`, le touched set event-local du module `list` republiait pourtant
`qa` avec tous les enfants Q/K. Le nouveau capture remplaçait alors l'ancien
ghost de `qa` par son FIRST logique, ce qui provoquait un saut vers la cible et
interrompait aussi les trajectoires des occurrences déjà propriétaires.

La correction reste dans le resolver partagé des captures. Au moment de réaliser
une occurrence, il consulte les occurrences directes actives au même instant et
retire leurs `persoKey` du touched set transmis au nouveau capture. Le mover
direct de l'occurrence courante est toujours réintroduit; les siblings non déjà
propriétaires restent disponibles pour le reflow. Il n'y a donc ni annulation ni
reconstruction de l'ancienne trajectoire.

La régression du resolver couvre un item déjà détenu par une occurrence
concurrente. Safari Preview MCP confirme en Seek que `qa` progresse sans saut de
`1600ms` à `2200ms` pendant que `ka` démarre à `1700ms`, puis que `ka` continue
pendant le départ simultané de `qb` et `kb`. Play observe les mêmes recouvrements
à `1700ms` et environ `2700ms`; Q et K restent continus, huit ghosts sont
présents, et la console ne rapporte aucun warning/error.

La suite V2 passe à `61` fichiers / `376` tests; typecheck, build runner et
`git diff --check` sont verts.

## FIRST visuel et LAST historique des captures concurrentes — 19 août 2026

Après conservation de l'ownership, un saut persistait encore autour de
`1700ms`: le ghost précédent était actif, mais la lecture FIRST de la nouvelle
capture passait par l'ancêtre DOM actif. Elle relisait donc la position logique
de l'item (`ka` autour de `1039,456`) au lieu de sa pose en vol (`~862,325`).
Les siblings déjà en reflow subissaient le même reset.

La frontière de mesure porte désormais explicitement la phase de lecture. FIRST
réutilise la pose du ghost direct actif, qui est la photographie visuelle de
l'instant de recouvrement. LAST conserve la résolution par l'ancêtre actif afin
que la cible soit mesurée dans le repère parent à `startAt + duration`. La règle
ne modifie ni l'horloge ni la trajectoire du parent et s'applique à chaque
capture concurrente.

La régression transactionnelle vérifie le marquage `first`/`last`. Safari
Preview MCP confirme en frames Play et en Seek la continuité de `qa`, `ka` et
`qb` autour de `1700ms`, puis de `qa`/`ka` à `2200ms` et `qb`/`kb` à `2700ms`.
Les positions ne reviennent plus à FIRST, les ghosts restent uniques et la
console ne rapporte aucun warning/error.

La suite V2 et le typecheck restent verts; le build runner et `git diff --check`
le sont également.

## Fichiers principaux

- `packages/codplay/plan/codplay-v2-plan.md`
- `packages/codplay/plan/move-contract-plan.md`
- `packages/codplay/src/runtime/player/runtime-player.ts`
- `packages/codplay/src/runtime/player/layout-dom-backend.ts`
- `packages/codplay/src/runtime/player/flip/move-flip-layout-projection.ts`
- `packages/codplay/src/runtime/flip/html-flip-runtime.ts`
- `packages/codplay/src/runtime/flip/html-dom-projection.ts`
- `packages/codplay/src/runtime/flip/html-pose.ts`
- `packages/codplay/src/runtime/flip/README.md`
- `packages/codplay/src/runtime/runner-html/README.md`
- `packages/codplay/demos/validation/runner/main.ts`
- `packages/authoring/selection-frame/demos/flip/main.ts`
- `packages/authoring/selection-frame/demos/flip-stress/main.ts`
