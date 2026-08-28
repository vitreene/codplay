# Evolution de `context.live` vers le Plan Temporel Declaratif

## Statut

Decision active de cadrage. CodPlay V2.

## Nom retenu

Le modele V2 est nomme **Plan Temporel Declaratif**. Le nom anglais utilise dans
le code et les API est **Planned Temporal Plan**.

Il ne s'agit pas d'un nouveau scheduler frame-based. C'est une representation de
faits temporels finis, calcules avant leur lecture, puis ecrits dans le journal
des tracks.

## Pourquoi `context.live` V1 ne peut pas etre porte

Le `live` V1 produit des occurrences au fil des frames. Cette cadence appartient au
runtime d'affichage, pas a l'intention auteur. Une telle sortie n'est pas une
fonction stable de `t` et ne peut pas etre evaluee directement par seek/replay.

Porter `context.live`, `onUpdate` ou ses helpers tels quels reintroduirait une
dependance implicite au rythme d'affichage et contredirait `f(t)`.

## Transformation des intentions

| Intention V1 | Forme V2 |
|---|---|
| chronometre ou progression temporelle | Behavior/tween evaluable par `f(t)` |
| compteur d'occurrences | etat de scope mis a jour par events rejouables |
| suite finie d'emissions | `context.planned.wait/repeat/stagger/sequence` |
| repetition bornee | `context.planned.loop({ times })` ou `loop({ durationMs })` |
| repetition arretee par un event futur | non portee automatiquement; necessite une spec V2 |
| callback a chaque frame | non porte |

Un compteur temporel ne doit donc jamais etre simule par une emission par frame.
Un compteur d'occurrences reste un etat, dont les modifications passent par des
events `runtime:state:update` dans le journal.

## Flux V2

```text
Strap stateless
  -> context.planned
  -> PlannedStrapOccurrence[]
  -> track dediee deja declaree
  -> RuntimeTrackEvent avec eventSeq
  -> materialize(scene, t)
  -> state / behavior / PersoState
```

Les occurrences planifiees n'ont aucun effet de bord lors de leur creation. Elles
deviennent des faits temporels avant leur lecture normale.

## Invariants

- le Plan Temporel Declaratif ne depend pas du nombre de frames affichees;
- chaque repetition est finie et bornee par une donnee inspectable;
- `loop` exige exactement une borne `times` ou `durationMs`;
- aucun `context.live` n'est introduit par compatibilite V1;
- aucun event futur implicite n'arrete un plan sans contrat V2 explicite;
- le seek relit le journal et ne reexecute pas le strap;
- les updates sont scopees `story` ou `scene` et passent par le journal;
- les helpers sont purs et retournent des occurrences, sans scheduler.

## Limite actuelle

Le cas d'une periodicite dont la loi depend d'un etat calcule au fil de l'eau reste
a examiner sur des usages reels. Il devra devenir soit un behavior, soit un etat
explicite, soit une nouvelle capacite V2 specifiee. Il ne doit pas etre resolu par
une copie du `live` V1.
