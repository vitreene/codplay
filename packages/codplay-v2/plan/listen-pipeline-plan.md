# CodPlay V2 - tranche listen, transform, straps et dispatch runtime

## Statut

> Status: En cours
> CodPlay version: V2 foundation
> Review: required before cancellation/obsolete generations

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
    -> append/reinject declared emits with bounded cascade
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
- une transform retourne une data ou `undefined`, sans modifier le nom de l'event;
- `emit` peut produire plusieurs events dans l'ordre de declaration;
- les fonctions sont resolues depuis la collection extraite du build;
- les erreurs de fonction sont retournees comme issues et ne font pas tomber le pipeline;
- les straps sont executes sequentiellement et attendus;
- `emit` est produit apres completion des straps de la regle;
- les sorties strap sont conservees separement des emissions de la regle, une
  track dediee par strap et par scope;
- l'event source est append une seule fois avant l'execution des regles;
- une story utilise ses regles si le nom correspond; sinon la scene est essayee,
  sans melanger les deux collections;
- un event `cascade` est stocke sur la track `global` et est materialise pour
  chaque story;
- seuls les `emit` declares sont reinjectes: la sortie pass-through d'une regle
  sans `emit` ne reboucle pas dans `listen`;
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

## Hors perimetre

- helpers `live` et emissions liees aux frames;
- annulation et generation obsolete des straps asynchrones;
- effects non rejouables;
- composants et renderer.

## Implementation

- `src/runtime/player/pipeline/listen.ts` porte les primitives pures;
- `src/runtime/player/pipeline/runtime-event-dispatcher.ts` porte le routage
  scene/story, le cascade borne et l'append journal;
- `src/runtime/player/runtime-player.ts` expose `emit()` et reconcilie l'etat
  depuis le journal;
- `HtmlPlayerRunner` partage le journal entre l'hote visible et l'hote de mesure.

La tranche est couverte par les tests du dispatcher, du player, du journal, de
`listen` et des straps. La demo reste un banc visible et ne constitue pas une
seconde implementation du pipeline.
