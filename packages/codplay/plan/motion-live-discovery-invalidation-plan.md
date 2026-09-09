# Plan — préparation motion déclenchée par occurrence `move`

## Statut

> Status: En cours — migration de l’architecture de découverte motion autorisée.
> CodPlay version: V2 foundation

Ce plan remplace la stratégie de découverte globale précédemment décrite dans
ce fichier. La note de cadrage
[`2026-09-07-motion-reparent-event-driven-preparation.md`](./notes/2026-09-07-motion-reparent-event-driven-preparation.md)
en conserve les constats et le raisonnement. La première tranche de migration
est en cours dans le code V2 ; les étapes encore ouvertes restent listées dans
la mise en œuvre ordonnée et ne sont pas présentées comme terminées.

## But et limites

Le runner ne doit préparer des positions et un graphe motion que lorsqu’il
matérialise une occurrence résolue de `move` qui nécessite une présentation
visuelle. Il ne doit ni anticiper les moves futurs, ni rescanner le journal à
chaque présentation normale.

Cette migration conserve le contrat structurel de `move` et ses capacités
existantes : destination, ordre, `reorder`, montage, démontage, transition,
easing, path, retarget et sorties de capture. Aucune méthode ni capacité de
déplacement n’est supprimée. La forme auteur remplace `flipMode` par `reparent`
et retire les deux paramètres d’intégration du path ; le compilateur fixe leurs
valeurs internes à `arc-length` et `center`. La forme cible est définie dans
[`move-contract-plan.md`](./move-contract-plan.md).

Le plan ne crée ni second player, ni second journal, ni API de visibilité de
story. Les démos restent des fixtures de validation : elles révèlent les cas que
le core doit traiter, mais ne fournissent aucune condition de runtime.

## Invariants à préserver

- `SolvedGraph` et le journal restent les seules sources de structure et de
  faits logiques ; la géométrie capturée est une donnée de présentation.
- Un événement sans action `move` ne déclenche pas la découverte, la capture ou
  l’overlay du graphe de positions traité par ce plan. Une action de pose qui
  relève d’un autre contrat conserve son traitement propre.
- Un `move` local conserve son host local. Lorsqu’il porte une transition
  temporisée (`duration > 0`), il engage néanmoins la capture FIRST/LAST et les
  keyframes requis ;
  il ne passe pas par le host d’overlay `reparent`.
- Un `move` structurel sans présentation animée reste immédiat et ne lit pas la
  géométrie.
- Les événements compilés, live, issus d’une cascade et reconstruits par Seek
  empruntent le même circuit interne.
- `play(t)` et `seek(t)` publient la même frame pour le même journal, viewport
  et état auteur.
- Les nœuds auteur, composants, services, player et runner survivent à un Seek
  et à un reset ; seules les ressources de présentation sont temporaires.

## Architecture cible

### Occurrence résolue, non catalogue global

Lorsque le player traite un événement, il résout déjà l’action, les items
concernés, les états structurels avant et après, ainsi que les stories de ces
états. À ce point, il transporte au runner une occurrence interne et éphémère
si l’action contient un `move`.

L’occurrence porte au minimum l’identité du fait ou de l’événement compilé,
l’instant absolu, le `move` résolu, les items concernés et l’appartenance de
story avant/après. Ses noms de champs restent internes au circuit player/runner.
Elle n’est ni exposée au public, ni stockée dans un second journal, ni
reconstruite par un scan du journal.

```text
événement traité
  -> action résolue et structure before / after
  -> occurrence interne de move
  -> décision local / reparent et besoin de présentation
  -> préparation du seul groupe nécessaire
  -> commit atomique du delta de graphe
  -> présentation de la frame demandée
```

Les trois origines doivent produire la même occurrence : franchissement d’un
événement compilé pendant Play, append live ou cascade, et reconstruction lors
d’un Seek. Un Seek ne prépare que les groupes nécessaires à sa frame cible ou à
la fermeture dont dépend cette frame ; un groupe déjà terminé et sans dépendance
de présentation n’est pas préparé par anticipation.

### Aucun travail motion à `init()` ni dans une présentation ordinaire

`HtmlPlayerRunner.init()` initialise le runner et les nœuds auteur, sans
compiler un catalogue de moves et sans appeler de capture générale pour ce
graphe.
`present()` et son équivalent appelé après une matérialisation normale se
contentent de résoudre et d’appliquer des données déjà préparées. Ils ne lisent
ni le journal pour retrouver un move, ni la géométrie DOM, ni une frontière de
reset pour la branche `move`/`reparent`. Une action de pose qui relève d’un
contrat distinct conserve son propre cycle de préparation et de présentation.

Le mécanisme actuel de `rebuildMotionBoundaries()` est donc remplacé par deux
responsabilités distinctes :

1. la préparation ciblée d’un groupe à partir de l’occurrence qui vient d’être
   résolue ;
2. la présentation d’un graphe déjà committé.

Il n’existe plus de rebuild général à l’initialisation ou à chaque frame. Une
révision du journal n’est pas un signal suffisant pour déclencher une découverte
motion.

### Rappel du contrat de capture locale et des états `className`/`style`

Le contrat existant dissocie le choix `local`/`reparent` de la capture des
positions. Une occurrence `move` munie d’une transition temporisée (`duration >
0`) capture FIRST avant `startAt`, puis LAST à son endpoint, même lorsque la
target et le parent restent identiques. Dans ce cas, le host reste local et
aucune ressource d’overlay n’est créée. La migration doit conserver cette règle.

Les propriétés `className` et `style` de la même action sont appliquées lors des
matérialisations `before`, `afterStart`, keyframes et `after`. Leur effet de
layout ou de transform entre donc dans les positions mesurées. Un tween de style
reconnu par le materializer conserve aussi son chemin de capture FIRST/LAST,
sans reflow structurel ni overlay par défaut.

Le but d’interpoler une position doit donc être exprimé par une transition
temporisée du `move` ou par un tween de style reconnu. Une attribution directe de
classe ou de style sans cette durée ne donne pas de borne d’interpolation : elle
reste une mutation immédiate et ne crée pas à elle seule une frontière motion.
Le runner ne déduit pas une transition CSS calculée.

### Groupe de capture et commit unique

Les moves qui partagent une même frontière et une même fermeture de composition
sont préparés comme un groupe. Le regroupement emploie les données structurelles
déjà résolues, jamais une convention de démo. Les segments locaux et reparent
restent séparés selon leur régime de présentation.

La préparation produit un delta immuable : snapshots nécessaires, segments,
ressources de présentation et ensemble des stories touchées. Le système motion
ajoute ou remplace ce delta en une seule opération. Frontières, partitions de
reset et graphe ne sont donc plus affectés par plusieurs appels qui reconstruisent
successivement le même graphe.

La sortie de capture live `endEmit`, la frontière `persist-only`, les retargets
et les événements simultanés utilisent ce même regroupement ordonné. Le FIRST
live garde sa sémantique particulière de pose visible avant le commit ; il ne
devient pas un fait logique ni une trajectoire de relecture distincte.

## Transaction synchrone de Seek

Un `Seek` n’est pas une lecture ralentie. Il calcule entièrement la projection
de l’instant demandé, puis la présente une seule fois. Le navigateur ne repeint
pas au milieu d’un appel JavaScript synchrone ; aucune frame intermédiaire n’est
donc publiée et l’horloge CodPlay n’avance pas pendant l’opération.

```text
seek(t)
  -> valider toutes les cibles
  -> reconstruire les scènes et préparer les modules
  -> capturer synchroniquement les groupes motion nécessaires
  -> commit atomique des frontières, resets et graphe
  -> présenter la scène cible une seule fois
```

Pour un Seek groupé, toutes les instances terminent `validate` et `prepare`
avant le moindre `commit`, puis sont présentées après le commit de l’ensemble.
Une erreur avant la fin restaure la présentation précédente avant que l’appel
ne rende la main. Les mesures `FIRST`, `afterStart`, keyframes et `LAST` d’un
groupe sont capturées dans la même opération synchrone ; elles ne sont jamais
assemblées sur plusieurs frames.

La préparation peut bloquer brièvement le thread principal si la scène est
lourde. C’est le coût assumé de l’atomicité et de l’égalité `play(t) = seek(t)`.
Il n’existe pas de budget coopératif, de yield multi-frame ou d’attente interne
à ajouter au contrat de Seek. La promesse publique de `telco.seek()` reste une
enveloppe de commande ; elle se résout après cette transaction synchrone.

## Portée de l’overlay

Le conteneur est choisi à partir des stories logiques résolues avant et après la
frontière, jamais à partir de l’ascendance DOM ni d’un état de présentation.

| Situation résolue | Conteneur d’overlay | Règle de coût |
|---|---|---|
| Même story, racine visuelle unique | conteneur de cette story | chemin normal et fermeture locale |
| Même story, plusieurs racines visuelles | repli existant sous la racine de scène, identifié par story | conserve le parentage et l’ordre de `flip-stress` |
| Stories différentes | racine de scène, identifiée par transaction | exception de dernier ressort, fermeture élargie |

Un `reparent: true` interne à une story ne monte jamais à la racine par
commodité. Un reparent structurel inter-story est le seul cas courant qui exige
un repère commun. L’identité de groupe doit donc porter les stories touchées et
une clé de scope ; `motion-container.ts` ne peut plus décider avec un seul
`storyId` lorsqu’une occurrence traverse deux stories.

## Reset chaud

Le reset restaure les valeurs initiales compilées de sa story dans l’instance
existante. Il ne recrée ni player, ni runner, ni composant, ni service, et ne
déclenche aucune découverte ou capture motion.

Le journal conserve le fait de reset. Le graphe de présentation, lui, doit être
partitionné par groupe et stories touchées : le reset libère les ressources
overlay et retire tout groupe qui touche la story réinitialisée, y compris un
groupe inter-story. Il ne masque pas des segments historiques à l’aide d’une
barrière temporelle. Les données de position retirées ne sont plus retenues par
le graphe.

Un Seek avant le reset reconstruit l’état logique sur la même instance et prépare
à nouveau seulement un move qui doit être présenté. Ce comportement remplace la
conservation de graphes précédents sous `resetTimesByItem`.

## Invalidation géométrique

Un resize invalide les poses capturées, sans réintroduire un catalogue global ni
une recapture immédiate de tous les moves. Les groupes devenus invalides sont
recapturés lorsqu’ils doivent à nouveau être présentés par Play ou Seek. Une
destruction finale libère leurs ressources comme aujourd’hui.

### Dépendance d’une trajectoire à sa target — implémentation en cours

Le retarget déclenché par le déplacement d’une cible est détaillé dans
[`move-target-dependency-plan.md`](./move-target-dependency-plan.md). La
frontière capturée depuis une occurrence `move` conserve l’identité de la target
montée résolue dans l’attachement `LAST` dont elle dépend. Lorsqu’un nouvel événement
résout un `move` qui modifie cette target pendant la
trajectoire, le chemin normal de conflit traite le nouveau `move`, puis le
runner retargete les segments dépendants dans la même transaction : pose
visuelle courante de l’item en `FIRST`, projection post-move de la target en
`LAST`. Le déplacement continu ne recapture rien ; le relâchement produit un
`move` normal. Si ce relâchement produit également un nouveau `move` pour
l’item en trajectoire, ce segment direct repart de la pose visible et sa durée
est réduite au temps restant jusqu’à l’`endAt` initial ; il ne réutilise ni la
pose initiale ni la pose provisoire du segment futur. Cette règle est validée
pour implémentation ; elle ne constitue pas encore une modification normative
du contrat `move` tant que les
validations d’acceptation du plan dédié ne sont pas terminées.

## Migration de la propriété auteur

La migration de `move` est atomique à l’échelle des types, compilation,
résolution, payloads runtime, démos et tests :

```ts
type MoveObject = {
  target: string
  mode?: MoveOrderMode
  reparent?: boolean
  reorder?: boolean
  transition?: MoveTransition
}
```

`mode` conserve exclusivement l’ordre de placement. `reparent: true` force la
présentation overlay ; un changement structurel de parent ou de cible impose
toujours ce régime. L’absence de `reparent`, ou `false`, ne peut pas annuler un
reparent structurel. `flipMode` est remplacé par cette propriété ;
`traversal` et `pathAnchor` ne sont plus acceptés dans le payload auteur et sont
fixés respectivement à `arc-length` et `center` dans le pipeline interne. Aucune
autre capacité de `move` n’est retirée et aucun alias de syntaxe auteur ne
subsiste après la migration. Les anciens alias de types conservés sur des
sous-chemins internes servent uniquement à éviter une suppression d’API ; ils
ne rendent pas les anciennes propriétés acceptées. `mode` ne change donc ni de
nom ni de domaine pendant cette migration.

## Mise en œuvre ordonnée

### 1. Stabiliser le contrat et les interfaces internes — première passe réalisée

- Mettre à jour le type auteur, les validateurs, le compilateur, les résolveurs
  et les payloads de tests pour `reparent?: boolean`.
- Définir le transport runner-local de l’occurrence résolue, sans l’exposer dans
  les façades ou le journal.
- Définir la clé de groupe, les stories touchées et le choix de scope avant de
  modifier la capture.

La forme `Move`/`MoveObject`, la validation `reparent`, les defaults internes du
path et le transport interne `RuntimeMoveOccurrence` sont en place. L'occurrence
transporte l'action complète après résolution des données d'événement, son
ordre, ainsi que les stories source et destination ; la résolution locale ou
racine de ce scope est maintenant portée jusqu'à la capture. L'indexation
persistante des groupes reste à finaliser avec le reset chaud.

**Gate :** aucun appel d’auteur ne perd `target`, `mode`, `reorder` ou les
propriétés de `transition`.

### 2. Émettre l’occurrence depuis le circuit player réel — première passe réalisée

- Raccorder la même émission aux événements compilés, live, cascades et à la
  reconstruction de Seek.
- Grouper les occurrences à une frontière sans modifier leur ordre logique.
- Ne préparer à froid que les groupes nécessaires à la frame demandée.

La matérialisation canonique identifie maintenant les actions `move` actives et
les transporte avec la scène résolue pour les frontières compilées, les
événements live et les seeks. En présentation normale, le runner fabrique
directement l'intention à partir de cette occurrence — y compris les données
dynamiques du payload — sans recompiler le planning ni rescanner le journal.
La compilation globale du planning n’est plus utilisée par le runner motion.
La fermeture live `endEmit` réutilise maintenant l'occurrence conservée
par la materialisation normale : elle ne reconstruit plus le planning depuis le
journal et ne remplace que le FIRST visible dans le groupe live. Les
reconstructions utilisées uniquement par la timeline d'ordre omettent cette
métadonnée de présentation.

**Gate :** le runner ne lit pas le journal pour redécouvrir une occurrence déjà
résolue par le player.

### 3. Remplacer la découverte générale par une préparation ciblée — en cours

- Retirer la construction motion forcée de `HtmlPlayerRunner.init()`.
- Retirer l’appel de découverte `move`/`reparent` de `presentMotion()` et de
  toute présentation normale ; conserver le traitement propre des actions de
  pose explicitement reconnues par un autre contrat.
- Extraire du code actuel la sélection, la capture et la construction du delta
  d’un seul groupe, en conservant les contrats de FIRST, LAST, keyframes et
  retarget.
- Réunir l’affectation des frontières et du graphe dans un seul commit du
  système HTML.

`init()` et la présentation normale ne lancent plus de découverte générale. La
capture ciblée reçoit directement l'intention résolue et choisit désormais le
conteneur à partir de toutes les stories touchées. La fermeture `endEmit` suit
le même transport pour son FIRST live. `HtmlMotionSystem.commit()` réunit
désormais frontières et partition de reset dans une seule reconstruction
immutable ; la partition durable complète des groupes reste à valider.

**Gate :** un événement sans `move` ne provoque aucune lecture géométrique ni
construction du graphe de positions `move`/`reparent`.

### 4. Finaliser la préparation ciblée et le Seek synchrone — première passe réalisée

- Préparer et capturer le groupe requis dans la même tâche synchrone.
- Ne publier aucune frame intermédiaire et ne faire avancer aucune horloge.
- Restaurer la présentation et le graphe précédents si le Seek échoue.

**Gate :** aucune frame partielle, aucun saut à l’entrée du move, aucune
progression accumulée pendant le calcul.

### 5. Partitionner les ressources de présentation et traiter le reset — en cours

- Porter les stories source/destination sur chaque frontière et indexer les
  groupes par ce scope — première passe réalisée.
- Retirer au reset les groupes concernés, leurs dépendances mesurées et leurs
  ressources HTML — première passe réalisée.
- Appliquer les trois scopes d’overlay définis plus haut, sans modifier le repli
  multi-racines de `flip-stress`.
- Remplacer les barrières `resetTimesByItem` par la suppression des groupes
  concernés au reset et sur les seeks qui traversent un reset ; le chemin
  `forceAll` n’est plus utilisé par `resize`.
- Rendre le resize invalide sans recapture anticipée et recapturer paresseusement
  le groupe requis. Les poses retenues sont supprimées, puis seules les
  occurrences actives de la scène courante sont réémises ; les groupes
  historiques et futurs attendent un Play ou un Seek qui les rende nécessaires.

**Gate :** un reset ne lance pas de capture et un groupe inter-story est retiré
en entier lorsque l’une de ses stories est réinitialisée.

### 6. Migrer les fixtures, spécifications et validation — en cours

- Remplacer la propriété auteur dans les scènes, les payloads live et les tests.
- Mettre à jour les contrats et le suivi du plan une fois le circuit exécuté et vérifié.
- Garder `position` et `flip-stress` sur le chemin runtime réel, sans
  contournement spécifique.

**Gate :** aucun document de contrat ne mélange `flipMode` et `reparent` comme
deux options auteur permanentes.

## Validation requise

La validation doit traverser le player, le materializer, le runner HTML et le
navigateur réel. Une suite isolée n’est pas suffisante.

- **Absence de travail inutile :** init puis événements sans `move`, statiques ou
  live, n’exécutent ni découverte du journal, ni mesure, ni création d’overlay
  pour le graphe `move`/`reparent`.
- **Moves :** local transitionnel avec `className`/`style` (FIRST/LAST sans
  overlay), tween de style, reparent structurel, `reparent: true`,
  montage/démontage, parent/enfant, reflow, retarget, événements simultanés,
  `endEmit` et `persist-only` conservent leur comportement.
- **Scopes :** overlay story-local, reparent inter-story à la racine, et repli
  multi-racines de `flip-stress` avec son ordre d’empilement à FIRST, MIDDLE et
  LAST.
- **Temps :** Play et Seek froid/chaud aux frontières et au milieu du segment,
  avec transaction synchrone, rollback, plusieurs instances et événements en
  attente.
- **Cycle :** resize, reset avant/pendant/après move, persistence, replay,
  lifecycle et destruction.
- **Navigateurs :** parcours réel de `position` et de `flip-stress`, incluant
  Safari, sans erreur console ni circuit parallèle de démo.

## Observation de performance

L’instrumentation distingue au minimum la résolution d’occurrence, la
préparation synchrone, la capture, le commit de graphe et les lectures de
journal. Elle ne mesure pas seulement `getBoundingClientRect`.

Le relevé navigateur ciblé du 2026-09-08 utilise Safari MCP sur `position`.
Après remount, remise à zéro des compteurs, puis Seek de `0` à `1500 ms`, le
parcours a produit `30` appels `getBoundingClientRect`, `31` lectures de style
calculé, `33` ajouts DOM, aucun retrait DOM et aucune `requestAnimationFrame`.
Sur le même circuit, un Play de `1200 ms` a produit `30` appels
`getBoundingClientRect`, `31` lectures de style calculé et `242`
`requestAnimationFrame`. Les mesures géométriques ne progressent donc plus avec
les frames ordinaires ; le Seek calcule et présente sans frame intermédiaire.

## Relecture de cohérence — 2026-09-08

Les plans dépendants ont été relus contre cette cible :

- `mode` reste l’ordre de placement ; `flipMode` est remplacé par `reparent` et
  `traversal`/`pathAnchor` sortent de la surface auteur, avec les defaults
  internes `arc-length`/`center` ; les capacités de `move` sont conservées ;
- une occurrence résolue de `move` déclenche la préparation du groupe concerné ;
  un événement sans `move` ne fournit aucune condition de visibilité et n’ouvre
  pas ce chemin ; les actions de pose relevant d’un autre contrat gardent leur
  traitement ; un `move` local transitionnel (`duration > 0`) capture FIRST/LAST,
  et les `className`/`style` de la même action sont appliqués avant les mesures ;
- la sélection, la topologie et les poses publiées sont préparées dans une même
  opération synchrone ; la dernière présentation engagée reste en place jusqu’au
  commit ;
- l’overlay reste dans le conteneur de story par défaut, utilise le repli racine
  déjà requis par `flip-stress` pour les stories multi-racines et ne monte à la
  racine que pour un reparent inter-story ;
- un reset est chaud, conserve le journal et retire les groupes et ressources
  qui touchent sa story ; un Seek antérieur les reconstruit seulement s’il doit
  présenter le move correspondant.
Les plans `player-engine`, `move-contract`, `runner-flip-integration-study` et
`story-reset` restent `En cours` pour leurs propres validations. Le code et les
fixtures V2 suivent déjà `reparent`, les defaults internes, la capture par
occurrence et le Seek synchrone atomique. La préparation multi-frame et
l’attente groupée ne font plus partie du contrat.

## Reprise d’intégration — 2026-09-08

La première intégration du transport d’occurrence est vérifiée sur le circuit
réel : `RuntimeMoveOccurrence` conserve l’action résolue, l’identité et l’ordre
de l’événement, ainsi que les stories avant/après ; le runner fabrique alors
directement l’intention et la capture ciblée choisit le host local ou la racine
selon ce scope. Les tests couvrent le payload complet de l’occurrence et les
trois résolutions de conteneur (story unique, stories multiples, racines
multiples). La fermeture `captureLiveFirstLayout` de `endEmit` reste un chemin
spécial pour la pose FIRST, mais elle réutilise maintenant l’occurrence déjà
transportée et ne relit plus le calendrier du journal.

Validation exécutée :

- suite V2 CodPlay : 90 fichiers, 574 tests passés (`npm test --workspace=codplay`) ;
- typecheck CodPlay et `@codplay/scene-factory` passés (`npm run typecheck --workspace=codplay` et
  `npm run typecheck --workspace=@codplay/scene-factory`) ;
- suite V1 historique : 69 fichiers, 342 tests passés (`npm test`) ;
- build des démos V2 passé (`npm run build --workspace=@codplay/demos`) ;
- `git diff --check` passé ;

La résolution provenait du graphe TypeScript : les démos V2 réimportent les
sources de `scene-factory` dans le programme `codplay`, dont le `tsconfig` ne
déclarait pas les alias `codplay-v1` et n’incluait pas le shim de type
`typed-om-polyfill` suivi par `player/strap-types`. Les deux configurations
incluent maintenant ces éléments ; aucun pont runtime V1/V2 n’est ajouté.

La validation navigateur ciblée de `position` et le relevé d’appels sont
maintenant consignés ci-dessus. Le reset chaud partitionné, l’invalidation lazy
du resize et la transaction Seek synchrone atomique sont implémentés dans le
runner ; les validations de corpus indépendantes de `flip-stress` restent
suivies dans leurs plans propres.

## Reprise d’intégration — 2026-09-08 — fermeture live et reset partitionné

La fermeture `endEmit` ne compile plus le calendrier motion après le retour de
`RuntimePlayer.endCapture()`. Pendant la materialisation de l’événement, le
runner associe l’occurrence résolue au capture id qui a fourni FIRST ; la
fermeture réutilise ensuite cette donnée, restaure explicitement la scène `after`
avant de mesurer LAST et remplace la frontière de présentation live. Le chemin
de relecture `persist-only` reste distinct et conserve sa capture rejouable.

Les frontières capturées portent désormais les `storyIds` source/destination
du groupe. Lorsqu’un reset franchit la tête de présentation, le runner retire
les groupes qui touchent la story réinitialisée — y compris leurs dépendances
mesurées — libère leurs ressources HTML et reconstruit le graphe de présentation
avec les groupes restants. Le même filtrage physique est appliqué avant un Seek
vers une position située après un reset. Un resize invalide maintenant toutes
les poses retenues dans le runner, vide le graphe et réémet seulement les moves
actifs de la scène courante ; il ne compile donc plus le calendrier historique
et ne prépare pas les moves futurs. `HtmlMotionSystem.commit()` échange les
frontières et la partition de reset dans une seule reconstruction. Le Seek
synchrone atomique est implémenté ; la validation Safari MCP de `position` et
le relevé d’appels sont consignés dans l’observation de performance.

Validation ciblée de cette reprise : tests runner/facade motion passés, avec
recapture du move actif après resize ; le cas S6 réel couvre la fermeture
`endEmit`, le commit de liste et le seek de relecture. Le test de reset couvre
aussi un Seek vers l’instant antérieur : le player retransporte une occurrence
active lors d’un Seek arrière même lorsque la materialisation réutilise le même
tableau d’actions, et la capture borne son endpoint avant le reset invalidant.

## Reprise d’intégration — 2026-09-08 — commit unique et resize paresseux

Le système HTML expose maintenant un commit interne unique pour remplacer les
frontières capturées et la partition de reset avant de reconstruire le graphe.
Les chemins de Seek, reset chaud et fermeture live l’emploient afin de ne pas
publier un état intermédiaire entre deux reconstructions cohérentes.

Après un resize, le runner libère les ressources de présentation et invalide
les frontières replay/presentation retenues. Il demande ensuite au player de
réémettre les occurrences `move` encore actives sur la scène courante ; la
capture ciblée se fait dans ce seul groupe. Une occurrence future n’est pas
préparée par ce refresh et sera capturée lorsqu’elle atteindra réellement la
présentation. La résolution de la scène source reste logique et ne constitue
pas une redécouverte du calendrier motion.

Le Seek est désormais documenté comme une transaction synchrone atomique : le
runner calcule la cible, capture les groupes requis, commit le graphe et ne
présente qu’après cette préparation. La démo `position` a été contrôlée dans
Safari MCP : le Seek à `1500 ms` n’a produit aucune frame intermédiaire et le
relevé d’appels est consigné dans l’observation de performance.

## Réexamen d'intégration — 2026-09-08 — trajectoire de la story 2

La précédente attribution de la régression à `layout-snapshot.ts` n'est pas
confirmée pour cette démo. Le test de parent mis à l'échelle couvre une
frontière géométrique distincte ; dans Safari MCP, le root de la story 2 n'a
ni transformation ni échelle CSS et l'overlay est bien présenté dans ce root.

Le relevé dans l'onglet Safari MCP existant donne, relativement au root de la
story, une pose de départ `(157.21875, 221.70874)` à `1 350 ms` et une pose
d'arrivée `(756.203125, 67.022476)` à `3 350 ms`. Les poses intermédiaires
restent collinéaires avec ces deux points : le calcul spatial n'ajoute donc pas
de soulèvement ni de courbe.

La non-linéarité observée était temporelle et correspondait à l'easing auteur
`inOutQuint` déclaré par le `move` de la story 2. À `1 800 ms`, l'overlay restait
presque au départ ; à `2 500 ms`, il avait déjà parcouru environ `77,8 %` de la
distance alors que `57,5 %` de la durée s'était écoulée. Les déplacements
`translateY` indépendants des ancres expliquent en plus le déplacement vertical
avant `1 350 ms` et après `3 350 ms`.

La validation précédente limitée au début, au milieu et à la fin était donc
insuffisante : elle ne distinguait pas une interpolation linéaire d'une easing
symétrique. La story 2 ne déclare maintenant plus d'easing pour son item ; cela
retire `inOutQuint` de la démo sans modifier les tweens verticaux des ancres.
La correction de la capture d'ascendance reste une frontière distincte et n'est
pas utilisée pour expliquer ce symptôme. Le parcours Safari MCP après correction
confirme le départ horizontal : `x=157,219` à `1 350 ms`, `186,794` à
`1 400 ms`, `243,697` à `1 500 ms` et `323,437` à `1 650 ms`, sans warning ni
erreur console. L'absence du champ auteur laisse inchangé le défaut global du
runtime ; elle retire seulement l'easing explicite de cette démo.
