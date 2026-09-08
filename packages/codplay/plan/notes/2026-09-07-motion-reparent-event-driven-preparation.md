# Note de travail — préparation motion déclenchée par `move`

## Statut

> Type : note d’étude et de cadrage, non contractuelle
> Date : 2026-09-07
> Version CodPlay : V2 foundation

Cette note rassemble les conclusions de travail issues de l’examen de la
surcharge motion révélée par la démo `position`. Elle conserve le raisonnement
et les décisions préparatoires ; l’implémentation de la première tranche est
suivie dans le plan d’action regroupé dans
[`motion-live-discovery-invalidation-plan.md`](../motion-live-discovery-invalidation-plan.md),
désormais marqué `En cours`.

## Constat de départ

Le chemin observé avant la migration préparait des frontières motion avant
qu’elles soient utiles :

- `HtmlPlayerRunner.init()` appelle `rebuildMotionBoundaries({ forceAll: true })` ;
- chaque matérialisation normale appelle ensuite `rebuildMotionBoundaries()`
  depuis `presentMotion()` ;
- cette fonction relit au minimum les frontières de reset et la révision du
  journal avant de pouvoir sortir ; lorsqu’une révision est observée, elle
  recompile le planning depuis la scène et le journal ;
- le système HTML reçoit séparément les frontières et les resets, ce qui peut
  reconstruire le graphe deux fois pour une même préparation.

Ce fonctionnement anticipe des `move` qui ne sont pas encore présentés. Il
mélange aussi deux responsabilités : découvrir qu’une action motion existe et
préparer la géométrie qui permet de la présenter.

Le problème n’est pas une particularité à masquer dans `position`. Cette démo
est une fixture de validation : elle rend visibles des défauts et des cas
limites du runtime. Elle ne définit ni une notion de vue, ni une notion de
story active, ni une politique de cycle de vie pour CodPlay.

## Vocabulaire à exclure du core

Les termes suivants appartiennent au carousel ou à une autre démo et ne doivent
pas entrer dans le raisonnement ou l’API CodPlay :

- `intro` et `outro` ;
- vue visible ou cachée ;
- story active ou inactive ;
- activation ou désactivation de story.

Le runtime ne connaît que des événements, des actions résolues, des scènes
résolues, une matérialisation, des captures géométriques et des frames de
présentation. La visibilité éventuelle d’un composant est un effet de son
matériau auteur, jamais un signal à interpréter par le graphe motion.

## Règle existante et optimisation de découverte

La capture FIRST/LAST d’un `move` transitionnel est une règle existante. Elle
s’applique aussi au régime `local` ; `reparent` détermine seulement si la
présentation utilise l’overlay ou le host local. La migration ne change pas cette
sémantique.

L’optimisation étudiée ici concerne le moment de découverte : la construction de
la géométrie et du graphe de présentation doit intervenir à la matérialisation
d’un événement dont l’action résolue porte ce `move`, plutôt qu’à `init()` ou
dans chaque présentation ordinaire.

```text
événement atteint ou émis
  -> résolution de l’action, y compris ses données dynamiques
  -> résolution logique avant / après la frontière
  -> matérialisation normale de la scène résultante
  -> si le move résolu est transitionnel : capture FIRST / LAST du groupe
  -> ajout atomique de la frontière au graphe
  -> présentation de la frame demandée
```

Les propriétés de l’action qui ont une incidence sur la géométrie font partie
de la matérialisation normale située avant la capture. Il n’existe pas de phase
spéciale fondée sur le nom d’un événement de démo.

Un événement sans `move` ne produit ni intention, capture ou construction du
graphe `move`/`reparent` traité ici. Une action de pose relevant d’un autre
contrat conserve son propre traitement. Un `move` local transitionnel
(`duration > 0`) engage la capture FIRST/LAST, mais reste sur le chemin de
présentation locale et ne crée pas d’overlay. Les `className` et `style` de la
même action sont appliqués avant les mesures ; une attribution directe sans
timing reste immédiate.
Cette note porte sur la préparation du graphe d’overlay et ne supprime pas les
sémantiques locales déjà nécessaires au runtime.

Il n’est donc pas nécessaire d’évaluer si une story est présentée, cachée ou
active. Si l’événement n’est pas matérialisé, il ne déclenche rien. S’il est
matérialisé et porte un `move` transitionnel (`duration > 0`), il fournit
lui-même le point précis où la préparation devient nécessaire, quel que soit son
régime de présentation.

## Vérification du contrat existant dans le chemin actuel — 2026-09-08

Cette vérification ne redéfinit pas la règle ; elle contrôle qu’elle est encore
respectée par le chemin publié pour la démo `position` :

- `compileMotionSchedule()` reconnaît `move.transition` avec `duration > 0` et
  crée une intention `targetReflow: true`, avec `presentationMode: 'local'` par
  défaut ;
- `captureHtmlMotionBoundaries()` capture alors `before`/FIRST, `afterStart` et
  `after`/LAST, sans exiger le mode overlay ;
- `applyActionPayload()` applique les patches `className` et `style` pendant
  chaque matérialisation de capture, de sorte que leur effet sur le layout est
  mesuré dans FIRST/LAST ;
- `resolveHtmlMotionActionTransition()` reconnaît séparément les tweens de style
  de layout/transform et leur fournit leurs bornes de capture.

La limite est explicite : une attribution directe de classe ou de style sans
`move.transition` temporisé ni tween reconnu ne contient pas de durée ni
d’endpoint. Elle ne crée donc pas d’intention motion dans le code actuel ; aucune
inférence d’une transition CSS calculée n’est faite. La démo `position` associe
bien ses patches de classe à `move.transition`, ce qui déclenche la capture
locale attendue.

La couverture automatisée vérifie le planning `move`, le planning de pose style
et les payloads de `position`, mais ne contient pas encore d’assertion dédiée
sur la paire FIRST/LAST d’un `move` local accompagné d’un patch de classe. Cette
assertion relève de la validation d’implémentation après relecture du plan.

## Portée du conteneur d’overlay

Le conteneur d’overlay est choisi pour chaque occurrence `move` résolue, à
partir de ses stories logiques avant et après la frontière. Ce choix ne dépend
ni de l’ascendance DOM courante, ni d’une notion de vue ou de visibilité.

- Pour un `move` reparent dont la source et la destination appartiennent à la
  même story, l’overlay est enfant du conteneur de cette story. Les captures et
  les poses restent dans ce repère local, ce qui limite la portée de la
  découverte et du travail géométrique.
- Pour un reparent entre deux stories distinctes, l’overlay est enfant du
  conteneur racine de la scène. Ce repère commun est nécessaire pour présenter
  une transition qui traverse les deux conteneurs de story.

Le second cas est une exception de dernier ressort. Il élargit la fermeture de
capture, la composition des repères et la couche d’overlay ; son coût peut donc
être sensiblement plus élevé. Un `reparent: true` interne à une story ne doit
jamais escalader vers la racine par commodité, et aucune couche globale ne doit
être créée par anticipation.

Cette règle ne modifie pas ici le traitement déjà documenté d’une story qui ne
possède pas de racine visuelle unique. Le plan central articule ce repli
structurel existant avec le cas explicite du reparent inter-story, sans faire de
la racine le comportement normal.

Le transport interne de l’occurrence devra donc porter les identifiants de
story résolus au FIRST et au LAST — ou une information équivalente déjà résolue
par le player. Le résolveur HTML actuel ne reçoit qu’un `storyId` et ne peut pas
encore prendre cette décision de portée.

## Reset chaud d’une story

Le reset d’une story est une opération chaude sur l’instance existante. À sa
frontière, la story retrouve les valeurs initiales compilées dans le même
player, runner et matérialisateur ; il ne détruit ni ne recrée l’instance de
présentation, ses composants ou ses services. Un Seek applique cette même
réinitialisation chaude : il ne doit jamais devenir une source de créations
d’instances non maîtrisées.

Le reset libère les ressources d’overlay et efface les graphes `move` capturés
pour la story. Il ne s’agit pas seulement de rendre leurs segments inactifs au
moyen d’une barrière temporelle : leurs frontières et leur géométrie ne restent
pas conservées dans le graphe de présentation. Toute transaction inter-story
dont la fermeture touche la story réinitialisée est effacée avec elle, afin de
ne laisser aucune dépendance de pose vers une géométrie invalidée.

Le fait de reset reste dans le journal, qui demeure la seule source logique.
Un Seek vers un instant antérieur reconstruit l’état logique sur l’instance
existante ; s’il doit présenter un `move` antérieur, il prépare ce graphe à la
rencontre de cet événement, sans conserver en mémoire les graphes effacés par
le reset. Le reset lui-même ne déclenche ni découverte, ni capture, ni
construction de graphe.

## Pas de catalogue motion à `init()`

Aucun catalogue d’intentions motion ne doit être construit à l’initialisation.
Il dupliquerait les informations de la scène compilée et du journal tout en
réintroduisant l’anticipation qui cause la surcharge.

L’index général des cibles d’actions produit par la compilation reste utile :
il sert à résoudre une action lorsqu’un événement est réellement traité. Il ne
constitue pas un catalogue motion.

Le player doit pouvoir transmettre au runner une occurrence interne, éphémère,
du `move` qui vient d’être résolu : identité de l’événement, instant absolu,
items concernés et données de move résolues. Cette occurrence n’est ni une API
publique, ni un deuxième journal, ni un planning persistant. Elle évite de
scanner le journal complet pour redécouvrir ce que le player vient déjà de
résoudre.

Les trois sources doivent produire la même occurrence interne :

- un événement temporel compilé franchi pendant Play ;
- un événement live ou une cascade ajoutée au journal ;
- un événement rejoué par une reconstruction de Seek.

## Invariant `play(t) = seek(t)`

L’état logique reste immédiat à la frontière de l’événement. La préparation
géométrique d’un Seek est elle aussi synchrone dans la tâche de commande : elle
se termine avant la présentation et ne laisse aucune frame intermédiaire
visible. Une préparation lancée sans attente, puis terminée après la frame,
créerait un saut visuel et ferait dépendre le résultat de Seek du fait que Play
a déjà rencontré ou non l’événement.

Les règles à préserver sont les suivantes :

1. le journal reste l’unique historique des faits logiques ;
2. une frontière géométrique est une donnée de présentation indexée par le fait
   du journal ou l’événement compilé correspondant, jamais une nouvelle histoire
   logique ;
3. Play capture la frontière au moment où le move est présenté ;
4. un Seek à froid prépare les frontières manquantes nécessaires à l’instant
   demandé avant de publier sa frame ;
5. à journal, viewport et géométrie auteur identiques, Play et Seek résolvent
   la même frame au même temps absolu.

### Décision : transaction synchrone de Seek

Un `Seek` ne reproduit pas la boucle de `Play`. Il reconstruit entièrement la
projection demandée, prépare les groupes motion nécessaires, puis présente le
résultat une seule fois. Le navigateur ne repeint pas au milieu de la tâche
JavaScript synchrone ; aucune frame partielle n’est donc visible et le temps
logique ne progresse pas pendant l’opération.

```text
seek(t) : validate -> prepare -> commit -> present
```

Pour un Seek groupé, toutes les instances ciblées terminent `validate` et
`prepare` avant le moindre `commit`, puis sont présentées après le commit de
l’ensemble. La scène logique et les mesures de géométrie ne sont jamais
exposées partiellement.

La sélection, la topologie et les captures `FIRST`, `afterStart`, keyframes et
`LAST` sont effectuées dans la même tâche synchrone. Le runner remplace ensuite
en une seule opération les frontières, les partitions de reset et le graphe
immuable. La présentation précédente reste en place jusqu’à ce commit.

Une scène lourde peut bloquer brièvement le thread principal ; ce coût est
accepté pour préserver l’atomicité et l’égalité `play(t) = seek(t)`. La
préparation multi-frame, le budget de yield et la barrière de temps locale ne
font pas partie du contrat.

En cas d’échec avant le retour de l’appel, le runtime restaure la présentation
et le graphe précédents. La promesse publique de `telco.seek()` reste une
enveloppe de commande ; elle se résout après cette transaction synchrone et ne
rend pas la préparation asynchrone.

## Compatibilité fonctionnelle et syntaxe cible de `move`

La migration ne retire aucune capacité de `move`. `mode` porte déjà l’ordre de
placement et reste inchangé. La notation de présentation du reparent change, et
les deux paramètres de chemin issus d’intégrations passées sortent de la surface
auteur. Cible, ordre, réordonnancement, montage, démontage, transition, easing et
path conservent leurs sémantiques ; le pipeline fixe `arc-length` et `center`.

La forme cible qui conserve ces capacités est :

```ts
type MoveObject = {
  target: string
  mode?: MoveOrderMode
  reparent?: boolean
  reorder?: boolean
  transition?: MoveTransition
}
```

| Syntaxe actuelle | Syntaxe cible | Comportement conservé |
| --- | --- | --- |
| `mode: 'append'`, `mode: 'first'`, position numérique, etc. | propriété inchangée | Policy de placement et ordre des enfants |
| `flipMode: 'local'` | `reparent: false` ou absence de la propriété | Intention de présentation locale ; elle ne peut pas annuler un reparent structurel |
| `flipMode: 'overlay-world'` | `reparent: true` | Présentation par overlay |
| `reorder`, `transition`, `path` | propriété inchangée | Même transition et même calcul de trajectoire, avec les defaults internes |
| `traversal`, `pathAnchor` | propriétés retirées du payload | `arc-length` et `center` appliqués par le pipeline |

Quand la source et la cible résolues diffèrent, le runtime impose le reparent,
comme aujourd’hui. `reparent: true` conserve la possibilité de forcer l’overlay
alors que la structure ne change pas. `reparent: false` ou l’absence de la
propriété ne peut pas annuler un reparent structurel. Le runner utilise le mode
résolu pour choisir le chemin overlay.

Avant la migration, le dépôt portait la présentation dans `flipMode`. La
première tranche remplace cette seule propriété par `reparent` dans les types,
le compilateur, le resolver, les payloads dynamiques, les démos et les tests.
`mode` d’ordre et les autres capacités de `move` restent inchangés.

## Conséquences architecturales attendues

Le prochain plan doit remplacer le mécanisme de découverte globale par une
transaction ciblée :

- supprimer la construction forcée de frontières motion à `init()` ;
- ne plus appeler un rebuild de découverte depuis chaque présentation normale ;
- ne plus utiliser une révision globale du journal pour retrouver un move déjà
  résolu ;
- capturer uniquement le groupe temporel et structurel de l’occurrence reçue ;
- fusionner la nouvelle frontière avec les données déjà capturées ;
- publier les frontières d’une occurrence `move` par un seul commit atomique,
  afin de ne construire le graphe qu’une fois ;
- laisser `present(t)` sélectionner et interpoler un graphe déjà préparé, sans
  mesure DOM ni découverte de structure ;
- traiter le reset comme une réinitialisation chaude : restaurer les valeurs
  initiales sur l’instance existante, libérer la présentation transitoire et
  effacer les graphes `move` de la story, sans capture ni découverte.

Un resize reste une invalidation explicite de la géométrie. Il ne doit pas
réintroduire une découverte anticipée : la géométrie invalidée est recapturée
lorsqu’un move concerné doit de nouveau être présenté ou reconstruit par Seek.

Les regroupements d’événements au même instant, les retargets pendant un
segment actif, les captures live `endEmit` et les frontières `persist-only`
doivent rester des transactions ordonnées du même circuit. Ils ne justifient
ni second player, ni second journal, ni graphe parallèle.

## Points restant à traiter

La forme `reparent`, les defaults du path, le transport interne de l’occurrence
`move`, la transaction Seek synchrone, le rollback de présentation et
l’invalidation lazy du resize sont désormais raccordés. Restent à valider ou à
préciser dans les tranches spécialisées :

1. La préparation d’un Seek qui traverse plusieurs moves, notamment leurs
   groupes simultanés et leur ordre `eventSeq`.
2. La distinction complète du chemin local et du chemin overlay pour les cas
   de reflow et de parent/enfant.
3. Les stories source et destination résolues pour le choix du conteneur de
   story et l’exception de reparent inter-story.
4. Le corpus navigateur indépendant de `flip-stress`. La démo `position` a
   déjà été vérifiée dans Safari MCP avec le relevé d’appels demandé.

## Validation attendue

Le plan d’implémentation devra couvrir le runtime réel, et pas seulement une
démo :

- aucun graphe ni aucune capture motion à `init()` ; la préparation commence
  seulement lorsqu’une occurrence `move` le requiert ;
- aucun travail overlay pour un événement sans `move` ;
- un seul groupe capturé lorsqu’un `move` reparent est matérialisé ;
- même résultat pour un événement statique, live, dynamique dans `event.data`
  et émis par cascade ;
- un reparent intra-story conserve un overlay dans le conteneur de sa story et
  ne parcourt pas la portée de la scène entière ;
- un reparent inter-story utilise le conteneur racine seulement pour sa propre
  transaction, sans déplacer ni élargir les overlays des moves intra-story ;
- même frame après Play puis Seek, et après un Seek direct à travers un move non
  encore rencontré par Play ;
- reparent parent/enfant, retarget, événements simultanés, `persist-only`,
  reset et resize ;
- un reset rétablit les valeurs initiales dans la même instance de présentation,
  sans `destroy`, recréation ni remount déclenché par Reset ou Seek ;
- un reset libère les overlays et efface les graphes `move` de sa story, y
  compris une frontière inter-story dépendante, sans capturer de nouvelle
  géométrie ;
- un Seek vers un instant antérieur au reset réutilise cette même instance et
  ne prépare un graphe effacé qu’à la présentation du `move` requis ;
- absence de mesure DOM dans les frames ordinaires ;
- un Seek calcule entièrement sa cible dans une tâche synchrone, sans frame
  intermédiaire ni progression d’horloge ;
- une erreur de Seek restaure la présentation et le graphe précédents avant le
  retour de l’appel ;
- contrôle navigateur ciblé de `position` dans Safari MCP ; le parcours
  `flip-stress` reste le corpus navigateur indépendant à valider dans son plan.

## État documentaire

Le plan central et le contrat cible de `move` restent `En cours` pour leurs
validations spécialisées. La première tranche couvre la migration `flipMode` →
`reparent`, les defaults internes, le transport par occurrence, la capture
ciblée et le Seek synchrone avec restauration en cas d’échec. Cette note reste
la justification et le relevé de contraintes ; elle ne devient pas une
spécification exécutable et n’autorise aucune modification ad hoc de la démo.
