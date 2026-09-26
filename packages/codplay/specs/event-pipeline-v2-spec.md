# CodPlay V2 — pipeline événementiel

## Périmètre vérifié

Cette spécification décrit le dispatch runtime des événements, le pipeline
`listen → transform → straps → emit`, leur inscription au journal et les
frontières de reset d’une story. Les règles d’isolation `active` ont leur
[spécification dédiée](./story-isolation-spec.md). La déclaration et les
sorties de capture sont couvertes par la [spécification capture](./capture-v2-spec.md) ;
leur migration de portée reste au [plan capture](../plan/capture-authoring-plan.md).
L'appel ordonné des straps et leurs helpers planifiés sont décrits par la
[spécification straps](./strap-execution-v2-spec.md).

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

## Sélection des événements live par track

Un événement live est matérialisé selon l'activité de la track à laquelle il
est ajouté. Le test `pipeline.spec.ts` vérifie qu'un événement adressé à une
story peut être matérialisé depuis une track `automatic` active alors que la
track `main` de cette story est inactive. L'activité par défaut de la story ne
masque donc pas cet événement live.

## Sélection et exécution de `listen`

- Les noms de `listen.on` sont comparés exactement.
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

La poursuite des straps suivants après une exception n'est pas certifiée par les
tests actuels ; cette frontière reste au
[plan d'exécution des straps](../plan/strap-execution-plan.md).

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

Validation ciblée exécutée le 2026-09-26 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run tests/runtime/player/pipeline.spec.ts
1 fichier, 31 tests réussis
```
