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

## Transaction de préparation coopérative

Le move visuel commence seulement après que ses positions ont été préparées. La
préparation peut étaler son travail topologique sur plusieurs frames, mais les
mesures numériques engagées ne peuvent pas être étalées : une position lue avant
un resize ou un changement de layout ne peut pas être combinée avec une position
lue plus tard.

```text
frontière b atteinte
  -> conserver la dernière présentation engagée de cette instance
  -> préparer sélection, dépendances, timings et delta topologique par tranches
  -> fenêtre finale sans yield : FIRST, états nécessaires, LAST et restauration
  -> commit atomique du groupe et de sa présentation
  -> reprendre l’horloge de l’instance à b
```

Le temps logique est tenu à `b` pour l’instance concernée pendant cette
préparation. Les autres instances continuent. Les événements adressés à
l’instance retenue restent ordonnés après la transaction. Cette attente est
coopérative : aucune boucle synchrone ne monopolise le thread et la boucle de
rendu peut traiter les autres instances. Le temps écoulé durant la préparation
ne devient jamais une progression cachée du segment.

La phase répartissable peut résoudre la fermeture minimale, les dépendances
parent/enfant, les timings, le régime de présentation et le conteneur d’overlay.
Ses mesures éventuelles ne servent qu’à estimer le travail. La fenêtre finale,
elle, lit le FIRST réellement affiché, matérialise les états `before`,
`afterStart`, keyframes nécessaires et `after`, lit leurs poses, puis restaure
la présentation retenue avant de rendre la main. Toutes les poses publiées
proviennent de cette unique fenêtre cohérente.

La capture finale reste obligatoire même si la topologie a été préparée sans
changement apparent : les positions peuvent avoir évolué entre deux frames. Si
sa fermeture dépasse le budget accepté, la première réponse est de réduire le
scope de capture. Une présentation explicitement figée pendant une capture
longue demanderait un contrat propre ; elle ne fait pas partie de cette tranche.

`telco.seek()` retourne déjà une promesse. La migration rend attendables les
transactions internes de Seek, du moteur au runner, et conserve leurs garanties
de rollback. La promesse publique ne se résout qu’après préparation, commit et
présentation cohérente de la cible.

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
path et le transport interne `RuntimeMoveOccurrence` sont en place. La clé de
scope inter-story et l'indexation des stories touchées restent à finaliser.

**Gate :** aucun appel d’auteur ne perd `target`, `mode`, `reorder` ou les
propriétés de `transition`.

### 2. Émettre l’occurrence depuis le circuit player réel — première passe réalisée

- Raccorder la même émission aux événements compilés, live, cascades et à la
  reconstruction de Seek.
- Grouper les occurrences à une frontière sans modifier leur ordre logique.
- Ne préparer à froid que les groupes nécessaires à la frame demandée.

La matérialisation canonique identifie maintenant les actions `move` actives et
les transporte avec la scène résolue pour les frontières compilées, les
événements live et les seeks. Le runner sélectionne encore le groupe à partir
du planning compilé ; l'optimisation d'un index direct de groupes reste ouverte.
Les reconstructions utilisées uniquement par la timeline d'ordre omettent cette
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
capture ciblée est en place ; la préparation coopérative et le commit de delta
unique restent à compléter.

**Gate :** un événement sans `move` ne provoque aucune lecture géométrique ni
construction du graphe de positions `move`/`reparent`.

### 4. Rendre la préparation et Seek transactionnels — à faire

- Découper uniquement le travail topologique ; capturer les positions publiées
  dans une fenêtre finale cohérente.
- Tenir l’horloge de l’instance à la frontière pendant la transaction.
- Rendre attendables `RuntimeEngine.seek()`, les participants de groupe et le
  runner, avec rollback identique en cas d’échec.

**Gate :** aucune frame partielle, aucun saut à l’entrée du move, aucune
progression accumulée pendant le calcul.

### 5. Partitionner les ressources de présentation et traiter le reset — à faire

- Indexer les graphes et ressources par groupe et stories touchées.
- Appliquer les trois scopes d’overlay définis plus haut, sans modifier le repli
  multi-racines de `flip-stress`.
- Remplacer les barrières `resetTimesByItem` par la suppression des groupes
  concernés et la libération de leurs ressources.
- Rendre le resize invalide sans recapture anticipée.

**Gate :** un reset ne lance pas de capture et un groupe inter-story est retiré
en entier lorsque l’une de ses stories est réinitialisée.

### 6. Migrer les fixtures, spécifications et validation — en cours

- Remplacer la propriété auteur dans les scènes, les payloads live et les tests.
- Mettre à jour les contrats et README une fois le circuit exécuté et vérifié.
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
  avec transaction longue simulée, rollback, plusieurs instances et événements
  en attente.
- **Cycle :** resize, reset avant/pendant/après move, persistence, replay,
  lifecycle et destruction.
- **Navigateurs :** parcours réel de `position` et de `flip-stress`, incluant
  Safari, sans erreur console ni circuit parallèle de démo.

## Observation de performance

L’instrumentation distingue au minimum la résolution d’occurrence, la
préparation topologique, la fenêtre finale de capture, le commit de graphe et
les lectures de journal. Elle ne mesure pas seulement `getBoundingClientRect`.

Sur le relevé actuel de `position`, 928 entrées dans
`rebuildMotionBoundaries()` n’ont produit que 8 constructions de graphe. Le
parcours équivalent doit supprimer les 920 entrées sans groupe à préparer ; ce
chiffre est une cible d’observation, pas une promesse de temps de rendu. La
validation décidera ensuite si la fermeture de certains groupes exige un travail
supplémentaire.

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
- la sélection et la topologie peuvent être préparées sur plusieurs frames,
  mais les poses publiées sont capturées dans une fenêtre finale cohérente ; la
  dernière présentation engagée reste affichée pendant l’attente ;
- l’overlay reste dans le conteneur de story par défaut, utilise le repli racine
  déjà requis par `flip-stress` pour les stories multi-racines et ne monte à la
  racine que pour un reparent inter-story ;
- un reset est chaud, conserve le journal et retire les groupes et ressources
  qui touchent sa story ; un Seek antérieur les reconstruit seulement s’il doit
  présenter le move correspondant.

Les plans `player-engine`, `move-contract`, `runner-flip-integration-study` et
`story-reset` sont `En cours` avec ce plan. Les README V2 et les fixtures V2
suivent déjà `reparent`, les defaults internes et la capture par occurrence.
Les plans ne sont pas déclarés terminés : préparation multi-frame, scope
inter-story, retrait physique des groupes au reset et invalidation lazy du
resize restent des étapes de validation.
