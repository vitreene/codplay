# CodPlay V2 - tranche listen, transform, straps et dispatch runtime

## Statut

> Status: Fixe
> CodPlay version: V2 foundation
> Review: pipeline borné validé le 2026-08-20; l'invalidation des résultats asynchrones est reportée à V3; les effets restent des extensions

## Frontiere

Cette tranche distingue une primitive pure et son orchestration runtime. Les
primitives `propagateListenEvent` et `executeListenPipeline` ne connaissent ni le
DOM ni le journal. `RuntimeEventDispatcher` est le seul point qui transforme un
event entrant en faits journalises; `RuntimePlayer.emit()` l'utilise et `seek()` ne
fait ensuite que relire ce journal.

```text
RuntimePlayer.emit(event)
    -> append source event on a declared track
    -> exact story rule, then scene fallback
    -> transform references
    -> sequential awaited straps
    -> append strap outputs on their declared tracks
    -> reinject immediate strap events with their declared scope
    -> append/reinject declared emits with bounded declared emissions
    -> materializeScene(journal, t)

RuntimePlayer.seek(t)
    -> materializeScene(journal, t)
    -> resolve -> solve
    -> occurrence `move` éventuelle vers le runner
    -> prepare -> commit -> present (synchrone si une capture est nécessaire)
```

## Invariants

- `listen.on` est compare par nom exact;
- une liste de regles non vide filtre les events sans correspondance;
- une story sans regle transmet l'event sans transformation;
- les transforms s'executent dans l'ordre de declaration;
- chaque transform peut retourner une liste ordonnée d'events produits; `undefined`
  produit une liste vide;
- chaque transform reçoit l'event déclencheur; les sorties de transforms successifs
  sont concaténées dans l'ordre et ne deviennent pas l'entrée du transform suivant;
- les events produits par les transforms héritent de l'ancrage et du contexte de
  l'event déclencheur, avec leur `name` et leur `data` propres;
- `emit` peut produire plusieurs events dans l'ordre de declaration;
- les fonctions sont resolues depuis la collection extraite du build;
- les erreurs de fonction sont retournees comme issues et ne font pas tomber le pipeline;
- les straps sont executes sequentiellement et attendus;
- `emit` est produit apres completion des straps de la regle;
- les sorties strap sont conservees separement des emissions de la regle, une
  track dediee par strap et par scope;
- les événements immédiats retournés par un strap sont réinjectés dans le même
  pipeline `listen`, après leur append unique au journal; les occurrences
  planifiées restent des faits temporels dans le journal et ne sont pas
  réinjectées par ce dispatch immédiat;
- l'event source est append une seule fois avant l'execution des regles;
- une story utilise ses regles si le nom correspond; sinon la scene est essayee,
  sans melanger les deux collections;
- un event de portée `scene` est stocke sur la track globale de la scene et est
  materialise pour chaque story;
- les `events` immédiats produits par les straps, les transforms et les `emit`
  déclarés sont réinjectés; la sortie pass-through d'une règle sans production
  ne reboucle pas dans `listen`;
- une profondeur maximale borne les cycles de declarations;
- aucune track n'est creee pendant le dispatch;
- les mises a jour d'etat sont journalisees avant d'etre presentees au strap et
  le `RuntimeStateStore` est reconcilie depuis la materialisation;
- Play et Seek consomment le meme `RuntimeTrackJournal`.

Le pipeline logique ne dépend pas de la capture motion : lorsqu’une action
résolue porte un `move`, le player remet au runner l’occurrence déjà traitée.
Une préparation de capture Seek retarde localement la publication de la frame
concernée jusqu’à la fin de la tâche synchrone, sans réexécuter `listen`, sans
modifier le fait journalisé et sans créer un circuit de dispatch parallèle.

## Reset événementiel d’une story

Une règle `listen` portée par une story peut déclarer `reset: true` pour un
nom d’événement. Lorsque cet événement est adressé à cette story, le
`RuntimeTrackJournal` conserve l’occurrence et l’utilise comme frontière de
projection : à cette frontière, la story repart de son état initial, puis les
faits strictement postérieurs sont rejoués dans l’ordre journalisé.

Un événement de portée `scene`, sans `storyId`, peut également être intercepté
par toute story dont la règle `reset` correspond exactement à son nom. Cette
forme sert aux événements diffusés par une scène, notamment lorsqu’un nom
distinct est émis pour la sortie de chaque story ; elle ne déclenche pas les
autres règles `listen` des stories et n’ajoute aucune cible à l’événement.

L’événement ne contient aucune cible. L’adresse éventuelle de la story reste
dans l’argument séparé de l’injection `events.emit()`. Le reset ne rembobine
pas l’horloge, ne modifie pas `playing`/`paused`, n’efface aucun fait et ne
touche ni l’état de scène ni les autres stories. Le runner HTML reçoit la
portée de la frontière pour libérer les ressources motion temporaires et
retirer les groupes capturés qui touchent cette story, sans remonter ses nœuds
auteur.

## Isolation exclusive déclarative

Le contrat validé est défini dans
[`../specs/story-isolation-spec.md`](../specs/story-isolation-spec.md) et sa
implémentation est suivie dans
[`story-isolation-plan.md`](./story-isolation-plan.md). Il répond au cas où
une instance CodPlay enchaîne plusieurs stories dans le même espace
d'exécution : une seule zone d'isolation est active à la fois, afin que les
plans futurs de la story quittée ne puissent pas perturber la story suivante.

L'isolation est une capacité déclarative de la story, au même niveau que
`reset`. Elle ne crée pas de manager parallèle et ne change pas le nom des
événements. Les noms d'événements restent des noms d'auteur ; la règle
`listen` leur donne leur effet pour la story qui reçoit l'événement.

### Exemple complet du `listen`

La notation ci-dessous est la forme contractuelle. `active` est une propriété
booléenne unique : `true` ouvre
l'isolation et `false` la ferme. Son absence ne demande aucune transition.
Cette propriété porte les deux transitions de la story.

```ts
const POSITION_STORY_FIVE_ENTER = 'position:story-five:enter'
const POSITION_STORY_FIVE_LEAVE = 'position:story-five:leave'

const positionStoryFiveListen = [
  // L'événement est adressé à position-story-five : la story est réinitialisée
  // et une nouvelle zone d'isolation est ouverte pour elle.
  {
    on: POSITION_STORY_FIVE_ENTER,
    active: true,
    reset: true,
  },

  // L'événement est adressé à position-story-five : sa zone est fermée.
  {
    on: POSITION_STORY_FIVE_LEAVE,
    active: false,
  },
]
```

L'adresse de `POSITION_STORY_FIVE_ENTER` et de
`POSITION_STORY_FIVE_LEAVE` reste portée par la cible séparée de l'injection
(`scope: 'story'`, `storyId: 'position-story-five'`) ; elle n'est pas ajoutée
au contenu de l'événement. Une règle `active` ne doit donc pas
être déclenchée par la seule présence d'un même nom dans une autre story.

### Routage d'une story inactive

La compilation construit un index exact des règles `active: true`, par story
et par nom d'événement. Lorsqu'une story est inactive, le dispatcher consulte
cet index avant d'exécuter le pipeline. Il ne sonde pas `event.data` et ne
parcourt pas toutes les règles.

L'événement source reste ajouté une seule fois au journal. Sans règle de
réveil correspondante, il ne déclenche ni transform, ni strap, ni emit, ni
reset pour la story inactive. Avec une règle `active: true`, la nouvelle zone
est ouverte puis la règle est exécutée dans cette zone. L'événement qui ouvre
l'isolation est donc toujours recevable par la story inactive.

### Sémantique contractuelle

- `active: true` ferme d'abord la zone actuellement active dans l'instance,
  puis ouvre une nouvelle zone appartenant à la story qui vient d'être
  adressée. Une seconde activation de la même story ferme donc l'activation
  précédente et en ouvre une nouvelle.
- `active: false` ferme la zone si la story adressée en est la propriétaire.
  L'opération est idempotente : si elle n'est pas active, elle ne produit pas
  d'erreur et ne touche pas une autre story. Une règle sans propriété `active`
  ne modifie pas l'isolation.
- `active: true` et `reset: true` peuvent être portés par la même règle. Ils
  forment une transition unique : le reset établit la frontière de projection
  de la story et l'activation établit la nouvelle provenance des plans futurs.
  Aucun état intermédiaire ne doit être observable.
- La fermeture n'efface aucun fait du journal. Elle invalide, pour la
  projection courante et les matérialisations futures, les occurrences
  planifiées sous l'activation fermée. Une réactivation reçoit une nouvelle
  identité d'activation ; les occurrences `repeat` qu'elle produira ne
  pourront pas être confondues avec celles de l'activation précédente.
- L'isolation porte uniquement sur les plans runtime futurs et leur
  provenance. Elle ne remplace ni `reset`, ni le changement de visibilité, ni
  le montage DOM, ni l'état de scène ou de session.
- Une émission issue d'une source externe à la story doit être explicitement
  rattachée à l'activation si elle doit être isolée. Sinon, elle reste une
  émission de scène et n'est pas supprimée implicitement. Cette distinction
  évite de prétendre qu'un préfixe de nom pourrait couvrir les sources
  externes.

La conséquence technique à spécifier est la propagation d'une identité
d'activation dans les occurrences planifiées et les événements différés. Le
`RuntimeTrackJournal` conserve les faits ; la projection vérifie que leur
identité d'activation est encore ouverte. Cette identité est le mécanisme
d'isolation, pas une suppression opportuniste des événements futurs et pas un
nouveau circuit de dispatch.

### Critères d'acceptation

L'implémentation suit la spécification ciblée et doit notamment prouver :

- l'index de réveil et le diagnostic des règles d'activation en doublon ;
- le réveil d'une story inactive et l'ignorance des événements ordinaires ;
- la transition atomique `active: true` avec `reset: true` ;
- la provenance des `repeat`, straps et événements différés ;
- la conservation des faits et la stabilité de Play/Seek avant et après
  fermeture puis réactivation.

Le contrat est validé pour implémentation ; les propriétés `active` et l'index
de réveil sont présents dans l'API interne V2. La validation de sortie reste
ouverte selon les gates indiquées ci-dessus.

## Hors perimetre V2

- invalidation et generation obsolete des resultats de straps asynchrones; ce protocole relève de V3;
- effects non rejouables;
- composants et renderer.

## Implementation

- `src/runtime/player/pipeline/listen.ts` porte les primitives pures;
- `src/runtime/player/pipeline/runtime-event-dispatcher.ts` porte le routage
  scene/story, la réinjection des sorties immédiates de straps, transforms et
  émissions déclarées bornées, ainsi que l'append journal;
- `src/runtime/player/runtime-player.ts` expose `emit()` et reconcilie l'etat
  depuis le journal;
- `HtmlPlayerRunner` reçoit les occurrences motion et capture sur les mêmes
  materialisations auteur persistantes ; aucun player ni arbre DOM de mesure
  séparé n'est créé.

La tranche est couverte par les tests du dispatcher, du player, du journal, de
`listen` et des straps. La demo reste un banc visible et ne constitue pas une
seconde implementation du pipeline.

## Transformations multi-événements

Une règle `listen.transform` peut produire une liste ordonnée d'événements :

```ts
type ListenTransform = (event: ListenEventInput) => readonly ListenEvent[] | undefined
```

Chaque élément produit est un event (`name`, `data` et les champs d'event
explicitement supportés). Le dispatcher l'ajoute au journal avec un nouvel
identifiant d'occurrence, puis le réinjecte dans le même pipeline que toute
autre émission déclarée. `seek()` ne réexécute jamais le transform : il relit
les events déjà journalisés. Cette règle conserve l'identité `Play(t) = Seek(t)`.
