# CodPlay V2 - tranche listen, transform, straps et dispatch runtime

## Statut

> Status: Fixe
> CodPlay version: V2 foundation
> Review: pipeline borné validé le 2026-08-20; extension V1 multi-événements acceptée le 2026-08-29; l'invalidation des résultats asynchrones est reportée à V3, live et effets restent des extensions

## Frontiere

Cette tranche distingue une primitive pure et son orchestration runtime. Les
primitives `propagateListenEvent` et `executeListenPipeline` ne connaissent ni le
DOM ni le journal. `RuntimeEventDispatcher` est le seul point qui transforme un
event live en faits journalises; `RuntimePlayer.emit()` l'utilise et `seek()` ne
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

## Limite du contrat live

Le contrat `live` a evolue pour rester compatible avec `f(t)`. Il ne doit pas etre
porte depuis la spec V1 ni etre implemente comme une suite d'emissions liees au
rythme des frames. Les compteurs temporels relevent d'un behavior/tween evaluable;
les compteurs d'occurrences relevent d'un etat mis a jour par events.

La tranche actuelle ne definit donc ni `context.live`, ni `onUpdate`, ni helper live.
La forme future devra etre specifiee en V2 avant toute implementation.

## Hors perimetre V2

- helpers `live` et emissions liees aux frames;
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
- `HtmlPlayerRunner` partage le journal entre l'hote visible et l'hote de mesure.

La tranche est couverte par les tests du dispatcher, du player, du journal, de
`listen` et des straps. La demo reste un banc visible et ne constitue pas une
seconde implementation du pipeline.

## Extension de compatibilité V1 acceptée le 2026-08-29

La forme V2 initiale qui traitait `listen.transform` comme une transformation
unique de `event.data` était trop restrictive pour le contrat effectivement
utilisé par V1. La forme retenue est désormais la suivante :

```ts
type ListenTransform = (event: ListenEventInput) => readonly ListenEvent[] | undefined
```

Chaque élément produit est un event (`name`, `data` et les champs d'event
explicitement supportés). Le dispatcher l'ajoute au journal avec un nouvel
identifiant d'occurrence, puis le réinjecte dans le même pipeline que toute
autre émission déclarée. `seek()` ne réexécute jamais le transform : il relit
les events déjà journalisés. Cette règle conserve l'identité `Play(t) = Seek(t)`.

Cette extension ne concerne ni `capture`, ni les effects live par tick, ni le
composant polygon. Elle porte uniquement la production multi-événements déjà
présente dans `listen.transform` V1.
