# Plan — préparation motion déclenchée par occurrence `move`

## Statut

> Status: En cours — direction de migration acceptée ; application et gates
> d'acceptation restent ouvertes.
> CodPlay version: V2 foundation

La note de cadrage
[`2026-09-07-motion-reparent-event-driven-preparation.md`](./notes/2026-09-07-motion-reparent-event-driven-preparation.md)
conserve le motif de cette direction. Ce plan ne garde que l'architecture
acceptée qui reste à appliquer et les gates ouvertes ; le comportement déjà
implémenté et vérifié est dans les spécifications citées ci-dessous.

Les comportements vérifiés sur le temps absolu et la capture des frontières
sont décrits dans la [spécification motion](../specs/motion-frame-v2-spec.md) ;
la dépendance à une target déplacée est décrite dans sa
[spécification retarget](../specs/move-target-dependency-v2-spec.md). Ce plan
garde la préparation par occurrence, la partition des ressources et les
validations motion qui ne sont pas encore acceptées.

## But et limites

Le runner ne doit préparer des positions et un graphe motion que lorsqu’il
matérialise une occurrence résolue de `move` qui nécessite une présentation
visuelle. Il ne doit ni anticiper les moves futurs sans dépendance de capture,
ni rescanner le journal à chaque présentation normale. Une fermeture locale
des ancêtres nécessaires au LAST d’une occurrence déjà résolue reste autorisée.

La forme auteur et les capacités structurelles de `move` sont définies dans la
[spécification `move`](../specs/move-v2-spec.md). Ce plan porte sur la
préparation motion déclenchée par occurrence et ses validations runtime.

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

Exception nécessaire pour les tweens de style répétés : lorsque la déclaration
porte `loop` ou `alternate` et que sa durée totale dépasse sa première itération,
ACE reste l'autorité de la valeur du style sur le nœud auteur. Le graphe
géométrique ne transforme pas cette séquence en un unique segment FIRST/LAST,
car cela supprimerait les retours successifs et pourrait créer un overlay
induit. Le nœud reste donc dans son parent pendant toute cette animation ; seuls
les `move` qui demandent réellement `reparent` utilisent l'overlay.

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

### Dépendance d’une trajectoire à sa target

Le sous-ensemble vérifié du retarget du graphe est normatif dans la
[spécification dédiée](../specs/move-target-dependency-v2-spec.md). Le plan
[d'acceptation target](./move-target-dependency-plan.md) garde les validations
runner, Play/Seek et cycle de vie encore ouvertes. Ce plan traite seulement le
raccord de ces occurrences au regroupement et à la préparation motion ; il ne
réouvre ni ne reformule le contrat déjà certifié.

## Travail restant

Le transport des occurrences et les comportements de temps absolu et de capture
vérifiés sont décrits dans la [spécification motion](../specs/motion-frame-v2-spec.md).
Le plan ne garde que les gates d’application encore ouvertes :

- [ ] Prouver qu’une présentation sans occurrence move ne déclenche ni
      capture géométrique ni construction du graphe de positions.
- [ ] Vérifier que les occurrences compilées, live et reconstruites par Seek
      empruntent le même chemin de préparation.
- [ ] Achever et valider la partition des groupes par toutes les stories
      touchées : un reset retire entièrement les groupes concernés et leurs
      ressources ; un Seek antérieur ne les reconstruit que si la frame le
      requiert.
- [ ] Valider l’invalidation paresseuse après resize : ne recapturer que les
      groupes requis par la frame active et conserver les occurrences futures
      pour leur présentation.

L’acceptation intégrée sur position et flip-stress — Play/Seek, reset,
resize, persistance, lifecycle, destruction et Safari — reste au
[plan runner HTML](./runner-flip-integration-study.md), qui porte cette matrice
une seule fois.

## Validation ciblée restante

Les validations restantes doivent établir que :

- aucun événement sans occurrence `move` ne déclenche de capture géométrique
  ni de construction du graphe `move`/`reparent` ;
- les événements compilés, live et reconstruits par Seek transmettent les
  occurrences au même chemin de préparation ;
- le reset retire les groupes touchés sans capture, et le resize invalide les
  poses pour une recapture paresseuse.

Le retarget ciblé suit sa
[spécification](../specs/move-target-dependency-v2-spec.md) et son plan
d'acceptation. Les tests intégrés parent/enfant, Play/Seek, reset, resize,
persistance, lifecycle et navigateur sont centralisés dans le
[plan runner HTML](./runner-flip-integration-study.md).

## Clôture

Retirer ce plan quand ces gates sont closes et que la spécification motion
couvre les comportements nouvellement implémentés et vérifiés.
