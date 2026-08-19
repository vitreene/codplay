# Etude d'integration FLIP dans le runner HTML V2

Status: En cours
CodPlay version: V2 foundation

## Decision normative

Play et Seek sont deux moyens d'atteindre un temps logique. Ils ne sont pas deux
algorithmes de presentation.

Pour un même `CompiledScene` et un même temps `t`, les deux transports doivent
produire le même `SolvedScene.graph`, le même ensemble de captures actives et le
même commit DOM. Un seek ne prend jamais le DOM courant comme FIRST implicite.

Le bridge générique `FlipCaptureRequest.mutate` reste disponible pour le moteur
FLIP isolé. Il n'est pas un chemin de presentation du runner HTML. Le runner
utilise toujours la transaction historique et `HtmlFlipRuntime.seekCached()`.

## Source de vérité de presentation

`SolvedScene` contient maintenant un graphe immuable construit par `solveScene`:

```ts
type SolvedGraph = Readonly<{
  revision: string
  parentByPerso: Readonly<Record<string, string | undefined>>
  targetByPerso: Readonly<Record<string, string | undefined>>
  childrenByTarget: Readonly<Record<string, readonly string[]>>
  childrenByParent: Readonly<Record<string, readonly string[]>>
  rootPersoKeys: readonly string[]
}>
```

Ce graphe est le seul endroit qui décrit:

- le parent logique d'un composant, y compris le propriétaire d'un outlet;
- le target opaque exact de chaque perso;
- l'ordre des enfants par target;
- la traversal parent-first et la révision de la structure.

`LayoutDomBackend`, le builder FLIP, les modules historiques et les diagnostics
ne reconstruisent plus l'ascendance en interprétant les noms de targets. Ils
utilisent `resolveAncestorChain`, `traverseSolvedGraph` ou
`resolvePresentationOrder`. Un override d'un module `list` est accepté seulement
s'il appartient à la révision courante et contient exactement les enfants du
target concerné; un enfant ne peut donc pas apparaître temporairement dans Q
alors que le graphe le rattache à K.

## Schedule temporel

`MoveTransitionJournal` est le schedule immuable des occurrences compilées. Une
occurrence porte son identité stable, `startAt`, `endAt`, `sourceTimeMs`,
`destinationTimeMs`, la transition, le `flipMode` et les targets source/destination
quand ils sont connus.

La réalisation d'une occurrence suit toujours les mêmes bornes:

```text
sourceTimeMs       -> scene FIRST logique
destinationTimeMs  -> scene après le déplacement
endAt              -> scene LAST logique
```

La durée et la phase du parent ne sont jamais remplacées par celles d'un enfant.
Une capture enfant peut mesurer le parent actif à son propre `startAt` puis à son
propre `endAt`; cela ne termine ni ne recalcule la trajectoire du parent.

## Pipeline unique Play / Seek

Les deux chemins appellent le même commit de `RuntimePlayer`:

```text
evaluate(t)
  -> materialize -> resolve -> solve
  -> SolvedScene + SolvedGraph immuables
  -> diff des scènes et notification des modules
  -> LayoutDomBackend.project(scene, commit)
  -> HtmlFlipRuntime.seekCached(host, epoch, t)
       -> cache numérique, ou resolver historique si capture absente
       -> résolution du pose graph
       -> un flush DOM
```

Le frame de lecture et le seek ne changent plus la phase du
`MoveFlipLayoutProjection`. Celui-ci ne construit ni capture live ni capture de
seek: il projette la scène puis appelle `seekCached`. La présence de
`previousScene` et des deltas sert à l'observation et au journal, pas à choisir
un second circuit de pose.

Il n'existe pas de seconde étape `advance()` ni de phase de transport dans le
contrat de projection. Le player appelle toujours `project()` pour Play et Seek.

La reconstruction de modules historiques dans
`getHistoricalLayoutProjectionState()` est une instance temporaire déterministe
du même évaluateur de scène. Elle ne constitue pas un transport alternatif et ne
modifie jamais l'état des modules courants.

## Transaction historique HTML

`HtmlPresentationTransaction.measure()` est la frontière unique des lectures:

```text
present FIRST scene explicite
  -> projeter les captures parentes déjà actives à la phase FIRST
  -> READ FIRST de tous les items et ancêtres
  -> capturer les templates FIRST des ghosts world
  -> present LAST scene explicite à endAt
  -> projeter les captures parentes à la phase LAST
  -> READ LAST du même ensemble
  -> restore de la presentation courante dans finally
```

Le résultat `HtmlMeasurementTree` ne contient que des poses numériques et les
références d'ownership source/destination. Pour un overlay parent, il contient aussi
la table FIRST `overlayTargetByPerso` des descendants présents dans son ghost. Les
templates DOM sont des ressources
runtime séparées, indexées par `captureId` et `itemId`; ils ne sont jamais relus
depuis le DOM courant.

Le template FIRST reste la ressource de création et de réactivation du ghost, mais
il ne constitue pas son contenu logique permanent. Avant chaque résolution de
pose, le runner publie un `HtmlFlipOverlayContentState` dérivé de la `SolvedScene`;
la projection HTML reconstruit alors le subtree de chaque ghost parent depuis le
DOM courant et remappe sa table de références. La géométrie reste celle de la
capture parent, tandis que les descendants reflètent l'ordre et les targets du
temps présenté. Cette synchronisation est identique en Play et en Seek et ne
dépend pas du passage préalable par la fin des captures enfants.

Cette séparation traite le cas Q/K: quand `kc` commence à 8200 ms, la mesure
FIRST voit Q et K à leurs phases respectives, et la réactivation d'un ghost parent
réutilise son clone FIRST. Le passage de `kc` dans le DOM courant ne peut donc pas
remplacer le contenu historique du ghost Q ou K.

La mesure distingue strictement l'origine affine de la boîte et son AABB
visuelle. Si un ancien ghost direct d'un enfant reste actif au moment d'un
reparentage, l'overlay du parent présent dans l'ascendance DOM est prioritaire;
le direct obsolète ne peut pas fournir la cible LAST.

La visibilité est ensuite réconciliée après construction complète de la forêt
d'overlays. Tout item encore porté par un nœud `capture` ou `handoff` masque tous
ses clones dans les ghosts parents; son propre ghost reste l'unique rendu. Cette
étape ne réutilise pas le `sourceTargetId` d'un alias regroupé, car ce target peut
être celui du dernier état historique et ne pas correspondre au target FIRST du
ghost parent. La restauration filtrée par `destinationTargetId` intervient
uniquement quand l'ownership est libéré.

## Ownership FLIP

Trois responsabilités restent séparées:

```text
MoveTransitionJournal  = occurrences et bornes historiques
FlipCaptureCache       = poses numériques réalisées par host + epoch
HtmlFlipRuntime        = ownership des overlays et poses transitoires
```

Le cache canonicalise les identités primaires et leurs aliases groupés. L'owner
DOM est conservé tant qu'une capture équivalente reste active. Une capture
descendante peut masquer son item dans un ghost parent, mais elle ne remplace pas
le handle parent et ne termine pas son intervalle.

`HtmlDomProjection` clone le subtree FIRST lors de la capture et utilise ce
template lors d'une réactivation. `excludeOverlayItem` ne sert qu'à masquer la
copie indépendante d'un descendant; `restoreOverlayItem` filtre la copie par la
cible LAST. Il ne change jamais le parentage logique de la scène. Ainsi, à la fin
d'un enfant Q→K, le clone Qa du ghost Q reste masqué tant que Q continue sa propre
trajectoire.

Lorsque l'enfant atteint son LAST avant le LAST de son parent de destination,
`destinationParentId` ouvre un handoff de projection: l'overlay enfant conserve sa
pose relative au parent au moment de son LAST, puis est recomposé avec la pose
courante du ghost parent à chaque commit. La fin de l'enfant ne restaure donc pas
son DOM ni ne le rend à un ghost FIRST; le parent termine sa propre trajectoire sans
être interrompu. La restitution au DOM intervient lorsque le parent atteint son
LAST. Un item groupé qui n'est pas mover direct est marqué `isDirectMover: false`
et ne peut pas reprendre l'ownership de l'enfant pendant ce handoff.

La propriété d'overlay est représentée par une forêt explicite de
`OverlayProjectionNode`, indexée par `itemId`. Chaque noeud possède soit une
capture directe, soit un lien `parentItemId` et une pose relative de handoff. La
résolution, la continuation et la libération parcourent ce graphe récursivement;
elles ne contiennent aucune branche particulière pour Q/K ni pour une profondeur
fixe. La détection de cycle est centralisée dans ce module. La régression de
profondeur 5 vérifie que chaque descendant reste résoluble lorsque ses parents
passent successivement en handoff.

Un sibling de reflow marqué `isDirectMover: false` possède également son propre
ghost, mais il n'est plus interpolé comme une trajectoire monde indépendante
lorsque son parent logique possède un overlay actif. Le noeud conserve la pose
FIRST/LAST de sa capture, les convertit dans le repère du parent aux deux bornes,
puis compose la pose locale courante avec la trajectoire parent courante. Le
mover direct reste en `overlay-world`; cette distinction évite que la même liste
soit simultanément refluée dans le monde et recomposée lors du handoff parent.
La table `overlayParentIds` conserve toute la chaîne root-to-parent; la recherche
part du parent immédiat et remonte jusqu'au premier ghost actif, donc un ancêtre
d'ancêtre animé compose lui aussi le sibling sans devenir une nouvelle entry.

La frontière DOM conserve les références de descendants dans le template FIRST:
`Map<itemId, HTMLElement>` pour chaque ghost, remappée vers le clone lors d'une
réactivation. Les opérations d'ownership ne font donc pas de recherche par
attribut dans le subtree cloné. Les attributs `data-item-id`/`id` restent des
données de markup ou de diagnostic; `data-codplay-flip-hidden` reste seulement le
marqueur CSS transitoire de visibilité.

## Contrat des modules structurels

Un module peut publier un ordre pour ses targets et un touched set. Le player:

1. vérifie la révision de graphe;
2. refuse deux ordres contradictoires pour un même target;
3. vérifie qu'aucun item n'est dupliqué, omis ou placé dans un autre target;
4. transmet un état complet et versionné au backend.

Le backend applique ensuite le graphe canonique avec l'override validé. Il ne
fusionne plus silencieusement une map de module arbitraire avec la scène.

## Invariants

- une scène résolue possède un seul graphe parentage/ordre;
- un mounted perso possède un target résolu et n'apparaît qu'une fois;
- un parent perso absent ou non monté est une erreur de graphe;
- un outlet fourni par un host externe peut exister sans perso propriétaire dans
  la scène, mais ne crée pas une ascendance fictive;
- Play et Seek appellent le même commit et le même resolver de captures;
- FIRST et LAST sont toujours des scènes logiques explicites;
- les trajectoires de conteneurs sont indépendantes de celles de leurs enfants;
- les captures numériques sont immuables et vérifiées par host/epoch;
- un ghost réactivé provient du template FIRST de sa capture;
- le contenu courant d'un ghost parent provient de l'état logique de la scène,
  jamais de la seule présence de captures enfants terminées;
- un sibling de reflow ne mélange pas une interpolation monde autonome avec la
  trajectoire de son parent: sa pose locale est composée avec le parent actif;
- un flush termine chaque commit de poses.

## Suivi d'implementation

- [x] Remplacer les champs parallèles `rootPersoKeys` / `childrenByTarget` de
  `SolvedScene` par `SolvedGraph`.
- [x] Centraliser la traversal d'ancêtres, la traversal parent-first et la
  validation des ordres de modules.
- [x] Supprimer la branche `phase === 'seek'` de
  `MoveFlipLayoutProjection`.
- [x] Faire passer Play et Seek par `project -> seekCached`.
- [x] Utiliser la transaction historique comme seul resolver du runner HTML.
- [x] Porter les targets FIRST/LAST dans chaque entrée de capture.
- [x] Porter l'ownership FIRST des descendants dans les ghosts parents et filtrer
  leur restauration par la cible LAST.
- [x] Maintenir un overlay enfant en handoff sur la trajectoire de son parent
  jusqu'au LAST du parent, avec test de restitution au DOM.
- [x] Remplacer le handoff plat par un graphe de projection récursif et couvrir
  une chaîne de profondeur 5.
- [x] Conserver un template FIRST par capture world pour toute réactivation.
- [x] Conserver les références DOM des descendants dans les templates plutôt que
  de rechercher les clones par attribut.
- [x] Tester graph, ordre module, transaction commune, aliases et ghosts
  imbriqués.
- [x] Vérifier la démo Safari à 0, 1500 et 2200 ms: ordre DOM `[A, B, C, D]`,
  A visuellement premier, ghosts Q/K stables.
- [x] Vérifier Play autour de 2200 ms: Qa reste projeté vers K entre les frames
  2184 et 2234, sans retour à sa pose FIRST.
- [x] Séparer les calculs d'origine affine et d'AABB, avec régression sur parent
  tourné/mis à l'échelle.
- [x] Vérifier le reparentage Kabc/Qabc avec un ghost enfant direct encore actif,
  puis valider la cible LAST à la phase absolue de fin de l'enfant.
- [x] Vérifier Safari après correction: Ka rejoint Q à 3600ms et y reste en
  handoff, Qa reste sur K, en Seek et en Play; console sans warning/error.
- [x] Réconcilier la visibilité après la résolution complète de la forêt: un
  alias groupé actif masque tous ses clones parents; vérifier le seek froid et
  Play à environ 8500ms sans doublon Qa/Qb/Qc/Ka/Kb/Kc.
- [x] Resynchroniser le contenu des ghosts parents depuis la scène courante et
  vérifier Seek à `8190ms`, `8200ms` et `8210ms` avec un pas minimal de `10ms`.
- [x] Composer les siblings de reflow avec la trajectoire du parent actif et
  vérifier la démo entre `2000ms` et `4000ms`, ainsi que les transitions
  suivantes, sans double interpolation monde/handoff.
- [x] Préserver les translations DOM fractionnaires lors de l'entrée et de la
  sortie overlay; vérifier les bornes `1000ms` et `9000ms` sans saut d'un pixel.
- [x] Espacer les échanges de contenu de `500ms` avec une durée de `1000ms`,
  puis vérifier en Seek et en Play que deux items de directions opposées restent
  actifs simultanément, sans doublon ni erreur console.
- [x] Préserver l'ownership d'un item déjà animé lorsqu'un nouvel échange
  concurrent republie le touched set de sa liste; vérifier la continuité de
  `qa`/`ka`, puis `qb`/`kb`, au milieu de chaque recouvrement.
- [x] Distinguer les lectures FIRST/LAST d'un overlay concurrent: FIRST reprend
  la pose du ghost déjà en vol, LAST résout la cible avec l'ancêtre actif.
- [ ] Étendre la même source de vérité aux occurrences live et à la rétention
  longue durée du journal, hors du périmètre de cette tranche.

## Gates de validation

```text
npm run typecheck --workspace=packages/codplay-v2
npm test --workspace=packages/codplay-v2 -- --run
npm run build:runner                 # depuis packages/codplay-v2
```

La démo `flip-stress` reste une validation déclarative: elle ne construit pas
de capture et ne corrige pas le runtime à coups de conditions particulières.

## References

- `src/runtime/player/pipeline/presentation-graph.ts`
- `src/runtime/player/runtime-player.ts`
- `src/runtime/player/flip/move-flip-layout-projection.ts`
- `src/runtime/flip/html-flip-runtime.ts`
- `src/runtime/flip/html-dom-projection.ts`
- `src/runtime/runner/html-compiled-move-capture-resolver.ts`
- `src/runtime/runner/html-presentation-transaction.ts`
- `projet/notes/2026-08-18-reprise-runner-html-declaratif-v2.md`
