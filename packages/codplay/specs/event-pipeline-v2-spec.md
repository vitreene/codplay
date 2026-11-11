# CodPlay V2 — pipeline événementiel

> Version de référence : CodPlay V2 — 2026-11-11.

## Périmètre vérifié

Cette spécification décrit le dispatch runtime des événements, le pipeline
`listen → transform → straps → emit`, leur inscription au journal et les
frontières de reset d’une story. Les règles d’isolation `active` ont leur
[spécification dédiée](./story-isolation-spec.md). La déclaration et les
sorties de capture sont couvertes par la [spécification capture](./capture-v2-spec.md),
qui utilise les mêmes valeurs `visibility` et le même routage.
L'appel ordonné des straps et leurs helpers planifiés sont décrits par la
[spécification straps](./strap-execution-v2-spec.md).

## Frontière entre événements discrets et sources continues

Le circuit événementiel porte des faits discrets. Son utilisation comme source
continue, par exemple en émettant 60 événements par seconde pour transmettre
une position, une progression ou une mesure par frame, est interdite par le
contrat. Cette frontière porte sur la nature du flux, pas sur un seuil de
fréquence : réduire la cadence ne transforme pas une source continue en faits
discrets.

Une source continue utilise le [circuit de capture](./capture-v2-spec.md) :
ouverture de session, samples et `trackCommand` pour le suivi live, puis sorties
de fin explicites pour les faits à conserver. Les samples ne sont pas des
événements du journal. Les événements discrets d'ouverture et de conclusion
gardent le dispatcher commun.

L'absence d'émetteur d'événements `loop` est une frontière d'interface
délibérée qui évite d'exposer une source continue par le circuit événementiel.
Elle ne constitue pas une capacité manquante à compléter. Une réémission
récursive, un timer ou une répétition planifiée utilisés pour représenter un
flux continu restent hors contrat. L'échantillonnage d'une animation calculée
depuis le temps du player relève de la présentation, sans événement par frame.

## Dispatch et portée

`RuntimePlayer.emit()` envoie un événement au dispatcher unique de l’instance.
Le dispatcher choisit le journal et les règles `listen`, puis inscrit les
sorties dans ce même journal. Il ne crée pas de track pendant le dispatch.
`seek()` reconstruit la présentation à partir des faits journalisés ; il
n’exécute pas de nouveau les transforms ou les straps.

Le dispatch est porté par [`RuntimeEventDispatcher`](../src/runtime/player/pipeline/runtime-event-dispatcher.ts),
les transforms et émissions déclarées par [`listen.ts`](../src/runtime/player/pipeline/listen.ts),
et la persistance par [`RuntimeTrackJournal`](../src/runtime/player/pipeline/track-journal.ts).
La source HTML ordinaire de [`Perso.emit`](./perso-emit-v2-spec.md) rejoint ce
dispatcher par `RuntimePlayer.emit()` ; elle ne possède pas de journal distinct.

La cible fournie à l’injection et la visibilité de l’événement sont deux
informations distinctes. La cible choisit `scene` ou `story` et, si demandé,
une track. La visibilité détermine où l’événement est journalisé et qui peut
l’observer. Elle ne désigne pas un transport vers un autre destinataire :

| `visibility` | Routage vérifié |
|---|---|
| `story` | L’événement est adressé à une story déclarée et inscrit sur sa track. `storyId` est requis. |
| `scene` | L’événement est inscrit sur la track globale et participe à la matérialisation des stories. |
| `public` | L’événement est inscrit sur la track globale et publié à l’observateur public lorsque sa date de lecture est atteinte. Le transport vers d’autres instances relève de l’hôte. |

Pour les eventimes auteur compilés, la déclaration dans la scène ou la story
conserve la portée de leurs actions. `visibility: 'public'` ajoute leur
observation pendant la lecture sans les réinjecter dans le dispatcher ni les
copier au journal. La notification passe par le même observateur public que
les faits runtime, après présentation, avec l'identité compilée et la date
absolue de l'occurrence, y compris pour les enfants relatifs. Une track
inactive n'alimente pas ces notifications compilées.

Une occurrence publique est publiée une seule fois par cycle de lecture.
Pause et Seek ne publient pas les occurrences reconstruites ; un reset ouvre
un nouveau cycle d'observation. `sequence:end` conserve son dispatch terminal
et sa notification uniques. Les occurrences compilées ordinaires ne déclenchent
pas de nouveau `listen`, transform ou strap à cette occasion.

Quand `visibility` est omise, aucun nom de visibilité n'est ajouté à
l'événement. La cible existante détermine alors son circuit : `storyId` route
vers la track et le pipeline de cette story ; sans `storyId`, l'événement
emprunte la track globale et le pipeline scène. Cette forme n'implique pas une
publication publique, qui nécessite `visibility: 'public'`. Le test du
[dispatcher](../tests/runtime/player/runtime-event-dispatcher.spec.ts) exerce
les cibles story et scène sans visibilité explicite.

Une règle `listen` de reset peut intercepter un événement de portée `scene`
sans cible de story. Une déclaration de reset d’une story n’ajoute pas de cible
dans les données de l’événement.

## Registre et propriétés des tracks

Une track organise les occurrences éligibles à la matérialisation ; elle ne
possède pas d'horloge indépendante. Le registre est constitué avant le dispatch
à partir du compilé. Il comprend la track globale, les identités et tracks par
défaut des stories, les tracks dédiées aux straps déclarés et les déclarations
`scene.tracks` / `story.tracks`. Le journal refuse l'insertion vers une track
inconnue sans en créer une.

Le [registre](../src/runtime/player/pipeline/tracks.ts) expose `id`, `active`,
`order` et le `role` optionnel. `active` vaut `true` par défaut ; `role` est une
métadonnée textuelle sans effet de routage. `order` est dérivé de l'ordre
d'enregistrement, non d'une priorité numérique auteur. Une déclaration
ultérieure du même identifiant complète ses métadonnées sans changer cet ordre.
La track par défaut d'une story est `story.trackId`, sinon `story.id`.
Les destinations des straps sont dérivées de leur propriétaire et de leur nom
par le registre existant.

Les commandes reconnues `track:activate`, `track:deactivate` et `track:toggle`
consomment `data.trackIds`, tableau de chaînes, sur le circuit de contrôle de
scène. Elles changent la participation des tracks déclarées ; un identifiant
inconnu reste inconnu. La désactivation ne supprime aucun fait et ne constitue
ni une isolation de story, ni un reset, ni une opération sur l'horloge.
Ces symboles sont explicitement reconnus par la configuration runtime ; des
noms voisins ou une valeur de `role` n'ont pas cet effet.

## Sélection des événements live par track

Un événement live est matérialisé selon l'activité de la track à laquelle il
est ajouté. Le test `pipeline.spec.ts` vérifie qu'un événement adressé à une
story peut être matérialisé depuis une track `automatic` active alors que la
track `main` de cette story est inactive. L'activité par défaut de la story ne
masque donc pas cet événement live.

Les faits d'une track sont ordonnés par date absolue `applyAtMs`, puis par
séquence d'insertion `eventSeq`. Pour les actions matérialisées, la comparaison
utilise la date, puis l'ordre dérivé de track, puis le chemin de déclaration ;
le chemin d'un fait live conserve sa séquence d'insertion. Deux actions de
tracks différentes à la même date ne sont donc pas départagées uniquement par
l'ordre des appels externes. Le
[materializer](../src/runtime/player/pipeline/materialize.ts) porte cette
sélection. Le contrat ne garantit pas une reconstitution historique des
changements d'activité des tracks par Seek.

## Insertion dynamique d'eventimes

`instance.events.emit(eventime, target)` conserve la cible hors du payload.
Une cible story exige son identité ; `trackId` choisit une destination déjà
enregistrée. Le chemin ordinaire ajoute au journal un arbre relatif ancré au
temps courant de l'occurrence : la date de chaque entrée est celle de son
parent plus son `startAt`. Seule la racine peut omettre `startAt`, alors égal
à zéro. Les offsets auteur sont finis et non négatifs. La racine est elle-même
une occurrence, et les enfants conservent la track/story résolue de l'insertion.
Ce chemin ne crée pas une track ou un player et ne relance pas les listeners
aux futures dates d'application.

Le mode racine `apply-now`, implicite pour l'insertion ordinaire, rend les faits
éligibles à la présentation normale à leurs dates. `persist-only` les conserve
sans les appliquer à la présentation courante lors de l'insertion ; une
reconstruction ultérieure peut les inclure. Ce mode ne change ni leur portée,
ni leur track, ni l'horloge. Les dates futures restent futures dans les deux
cas. Les politiques de conclusion de capture sont décrites par leur
[contrat](./capture-v2-spec.md).

L'exception de dispatch immédiat d'une commande story et la frontière de
contrôle des tracks appartiennent au
[routage de façade](./facade-v2-spec.md#temps-événements-et-observation).
Pour une commande publique de contrôle de track sans enfants, l'absence de
`startAt` sélectionne le contrôle immédiat ; une valeur explicite n'est pas
équivalente à cette absence.

## Sélection et exécution de `listen`

- Les noms de `listen.on` sont comparés exactement.
- Le vocabulaire et la ponctuation d'un nom n'induisent ni action, ni portée,
  ni cascade. Des conventions différentes sont admissibles tant que les
  producteurs, clés d'actions et règles référencées restent cohérents. Les
  événements de contrôle explicitement reconnus suivent leurs constantes et
  contrats ; cette reconnaissance ne s'étend pas aux noms qui leur ressemblent.
- Pour un événement adressé à une story, ses règles correspondantes sont
  sélectionnées en priorité. En l’absence de règle story correspondante, le
  dispatcher cherche une règle scène ; il ne fusionne pas les deux collections.
- Un pipeline sans règles transmet l’événement. Un pipeline avec des règles ne
  traite que celles dont `on` correspond au nom de l’événement.
- Les transforms s’exécutent dans l’ordre déclaré. Chacune reçoit l’événement
  source ; ses sorties ordonnées sont ajoutées au résultat sans devenir l’entrée
  de la transform suivante. Une liste vide ne produit pas de sortie.
- Une transform manquante produit une issue de diagnostic.
- Les événements déclarés par `emit` sont produits après l’exécution séquentielle
  et attendue des straps de la règle.

## Straps et journal

Les straps sont résolus dans leur portée déclarée, scène ou story. Une
déclaration locale remplace l’entrée homonyme d’une collection réutilisable ;
une résolution ne bascule pas vers l’autre portée. Les straps d’une règle sont
exécutés dans l’ordre déclaré. Leurs événements immédiats, mises à jour, plans
et avertissements restent séparés dans le résultat du strap ; une référence
manquante ou une exception produit une issue associée au strap.

La poursuite des straps suivants après une exception est exclue du périmètre
certifié de ce document.

L’événement source est ajouté une fois au journal avant l’exécution des règles.
Les événements immédiats d’un strap sont ajoutés une fois à leur track, puis
réinjectés dans le même dispatcher afin de pouvoir déclencher d’autres règles
`listen`. Les occurrences planifiées sont inscrites comme faits temporels ;
elles ne sont pas réinjectées dans le dispatch immédiat.

Les sorties d’un strap restent sur la track propre à ce strap et à sa portée.
Les mises à jour d’état passent par le journal ; l’état runtime est réconcilié
à partir de la matérialisation. Play et Seek lisent le même journal.

## Reset événementiel d’une story

Une règle `listen` d’une story avec `reset: true` crée une frontière de
projection lorsque le nom de l’événement correspond exactement. La frontière
est ordonnée par date et séquence du journal. Les faits antérieurs sont
conservés ; à partir de la frontière, la story repart de son état initial et
les faits ultérieurs sont projetés dans l’ordre du journal. Le reset ne change
pas l’horloge et ne modifie pas l’état de scène ni celui des autres stories.

Un événement `scene` sans `storyId` peut créer une frontière pour chaque story
qui déclare un reset correspondant. Une émission adressée à une story conserve
son adresse à l’injection ; elle ne l’encode pas dans `data`.

## Preuves

- [`public-compiled-eventimes.spec.ts`](../tests/facade/public-compiled-eventimes.spec.ts)
  vérifie la notification après présentation par le runner/façade réels,
  les occurrences scène/story/enfants, le filtrage public et des tracks,
  l'unicité, la coexistence avec le journal, Pause, Seek, reset et la fin terminale.
- [`listen.spec.ts`](../tests/runtime/player/listen.spec.ts) couvre la sélection
  exacte, le fan-out des transforms, leur ordre, les diagnostics et l’ordre
  straps puis `emit`.
- [`strap-executor.spec.ts`](../tests/runtime/player/strap-executor.spec.ts)
  et [`strap-collections.spec.ts`](../tests/runtime/player/strap-collections.spec.ts)
  couvrent l’ordre, les issues, les sorties planifiées et les portées de
  résolution ; [`planned-helpers.spec.ts`](../tests/runtime/player/planned-helpers.spec.ts)
  couvre les formes et offsets des helpers documentés par la spécification
  straps.
- [`runtime-event-dispatcher.spec.ts`](../tests/runtime/player/runtime-event-dispatcher.spec.ts)
  couvre l’append, les sorties de straps et leur réinjection, les tracks dédiées,
  la matérialisation `scene`, le routage sans visibilité explicite et
  l’interception de reset.
- [`pipeline.spec.ts`](../tests/runtime/player/pipeline.spec.ts) couvre les
  frontières ordonnées de reset, la conservation des faits journalisés,
  l’indépendance des états de stories et de scène, et la sélection d'un
  événement live sur une track active.
- [`runtime-player.spec.ts`](../tests/runtime/player/runtime-player.spec.ts)
  couvre le rejeu par Seek sans nouvelle exécution des transforms et des straps,
  ainsi que les frontières de reset sans déplacement de l’horloge.
- [`story-isolation.spec.ts`](../tests/runtime/player/story-isolation.spec.ts),
  [`position-demo.spec.ts`](../tests/facade/position-demo.spec.ts) et
  [`sighty-demo4.spec.ts`](../tests/facade/sighty-demo4.spec.ts) couvrent les
  règles de portée et d’observation employées par leurs parcours respectifs.
