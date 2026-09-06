# Note d’étude — échelle des optimisations motion V2

## Statut

> Type : note d’examen, non contractuelle
> Date : 2026-09-06
> Version CodPlay : V2 foundation

Cette note conserve l’examen de la lenteur observée dans la scène `position`
et les pistes évoquées. Elle ne constitue pas une autorisation de modifier le
journal, le player ou le contrat d’événement.

## Constat mesuré

La mesure a été effectuée dans Safari Technology Preview, après rechargement
complet de la démo. La limite de capture au conteneur de story avait déjà été
appliquée.

| Transition | Avant la limite story | Après la limite story |
| --- | ---: | ---: |
| story 4 → story 5 | 6 244 mesures | 2 116 mesures |
| story 5 → story 4 | 1 716 mesures | 724 mesures |

Pour la story 5, les 2 116 mesures restantes comprennent notamment 516
mesures de la racine de story et 512 du stage. Les ancêtres du layout général
ne sont plus parcourus. Aucun message `error` ou `warn` n’a été relevé dans la
console Safari Technology Preview.

La géométrie ne croît donc plus à chaque passage. La lenteur résiduelle est
distincte : le journal conserve les faits, tandis que la révision globale du
journal provoque encore une relecture des plans et peut invalider la timeline
structurelle. Ce comportement est une limite d’implémentation observée, pas
une nécessité du contrat CodPlay.

## Pistes examinées

### 1. Révision incrémentale du journal

Un curseur d’événements, un index par `eventSeq` et une compilation delta
réduiraient les rescans de `getAllEvents()` et de `compileMotionSchedule()`.
Cette piste est jugée disproportionnée pour le problème actuel : elle est
mise de côté et ne doit pas être ajoutée au journal comme patch local.

### 2. Invalidation séparée des graphes

À long terme, il serait possible de distinguer les invalidations logique,
structurelle, motion et géométrique. Cette conception doit être examinée au
niveau global de la bibliothèque, avec des mesures sur plusieurs usages ; elle
n’est pas introduite dans la scène `position`.

### 3. Réutilisation de géométrie stable

La racine et le stage représentent une part importante des mesures restantes.
Un cache de poses stables pourrait être étudié dans une future optimisation du
présentateur HTML, avec invalidation explicite par `resize`, changement de
style d’un ancêtre ou reparent. Il ne faut pas le déduire d’une seule démo ni
le confondre avec une modification du journal.

### 4. Signal de présentation intentionnel

Un événement de présentation pourrait indiquer qu’un conteneur est présenté
et permettre de différer une capture motion. Ce signal ne devrait ni filtrer
les événements, ni créer un cycle de vie `active/inactive`, ni être déduit par
inspection du DOM. Cette piste reste ouverte, sans contrat ni implémentation.

### 5. Représentation compacte des répétitions

La représentation interne de `repeat(20)` pourrait un jour éviter de développer
immédiatement toutes les occurrences. La sémantique et le nombre d’occurrences
doivent rester identiques. Cette piste est indépendante de la limite story et
ne justifie aucune modification de la démo.

## Décision actuelle

- conserver la limite de capture au conteneur de story ;
- ne pas modifier `TrackJournal`, `RuntimePlayer` ou le contrat d’événement
  pour ce cas isolé ;
- ne pas ajouter de détection automatique de visibilité par le DOM ;
- ne pas introduire de cycle de vie `active/inactive` ;
- traiter les optimisations du journal et des graphes dans une étude globale
  ultérieure, avec un corpus de mesures plus large.

La scène `position` reste une validation du comportement existant. Elle ne doit
pas devenir le support d’une architecture spéciale destinée à masquer cette
limite de performance.
